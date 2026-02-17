// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

/**
 * PatientSearchBar — EHR-standard unified patient search
 * 
 * Follows Epic/Cerner/Athena patterns:
 * - Single search bar that auto-detects input type (name, phone, DOB, email)
 * - Debounced suggestions dropdown with patient avatar, name, DOB, phone
 * - Supports "Last, First" comma format
 * - DOB search in multiple formats: MM/DD/YYYY, YYYY-MM-DD, MM-DD-YYYY
 * - Phone search strips formatting: (480) 555-1234 → 4805551234
 * - Keyboard navigation (↑↓ Enter Esc)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, Phone, Calendar, Mail, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── Types ──────────────────────────────────────────────────────────
export interface PatientSearchResult {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  date_of_birth: string
  location?: string
  created_at?: string
}

interface PatientSearchBarProps {
  onSelect: (patient: PatientSearchResult) => void
  onClear?: () => void
  selectedPatient?: PatientSearchResult | null
  placeholder?: string
  className?: string
  /** Compact mode for top bars */
  compact?: boolean
  /** Show selected patient inline */
  showSelected?: boolean
  /** Auto-focus on mount */
  autoFocus?: boolean
}

// ─── Smart Input Detection ──────────────────────────────────────────
type InputType = 'name' | 'phone' | 'dob' | 'email' | 'unknown'

function detectInputType(input: string): InputType {
  const trimmed = input.trim()
  if (!trimmed) return 'unknown'

  // Email: contains @
  if (trimmed.includes('@')) return 'email'

  // Phone: mostly digits (with optional +, -, (, ), spaces)
  const digitsOnly = trimmed.replace(/[\s\-\(\)\+\.]/g, '')
  if (/^\d{4,15}$/.test(digitsOnly) && digitsOnly.length >= 4) return 'phone'

  // DOB: date-like patterns
  // MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD, M/D/YY
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(trimmed)) return 'dob'
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(trimmed)) return 'dob'

  // Name: everything else (letters, spaces, commas, hyphens, apostrophes)
  return 'name'
}

function normalizePhone(input: string): string {
  return input.replace(/[\s\-\(\)\+\.]/g, '')
}

function normalizeDOB(input: string): string {
  const trimmed = input.trim()
  
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  
  // MM/DD/YYYY or MM-DD-YYYY
  const mdyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  
  // MM/DD/YY
  const mdyShort = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/)
  if (mdyShort) {
    const [, m, d, y] = mdyShort
    const fullYear = parseInt(y) > 50 ? `19${y}` : `20${y}`
    return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  return trimmed
}

function parseName(input: string): { first: string; last: string } {
  const trimmed = input.trim()
  
  // "Last, First" format (Epic standard)
  if (trimmed.includes(',')) {
    const [last, first] = trimmed.split(',').map(s => s.trim())
    return { first: first || '', last: last || '' }
  }
  
  // "First Last" format
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: '' }
  if (parts.length === 2) return { first: parts[0], last: parts[1] }
  // "First Middle Last" — use first and last
  return { first: parts[0], last: parts[parts.length - 1] }
}

// ─── Component ──────────────────────────────────────────────────────
export default function PatientSearchBarInline({
  onSelect,
  onClear,
  selectedPatient,
  placeholder = 'Search by name, DOB, phone, or email...',
  className = '',
  compact = false,
  showSelected = true,
  autoFocus = false,
}: PatientSearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PatientSearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [detectedType, setDetectedType] = useState<InputType>('unknown')

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([])
      setIsOpen(false)
      setDetectedType('unknown')
      return
    }

    const type = detectInputType(query)
    setDetectedType(type)

    const timeout = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await searchPatients(query, type)
        setResults(results)
        setIsOpen(results.length > 0)
        setActiveIndex(-1)
      } catch (err) {
        console.error('Patient search error:', err)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 200) // 200ms debounce

    return () => clearTimeout(timeout)
  }, [query])

  // Search logic
  const searchPatients = async (q: string, type: InputType): Promise<PatientSearchResult[]> => {
    let supabaseQuery = supabase
      .from('patients')
      .select('id, first_name, last_name, email, phone, date_of_birth, location, created_at')
      .limit(15)

    switch (type) {
      case 'phone': {
        const digits = normalizePhone(q)
        // Search phone field containing these digits
        supabaseQuery = supabaseQuery.ilike('phone', `%${digits}%`)
        break
      }
      case 'dob': {
        const normalized = normalizeDOB(q)
        // Exact match or partial (for typing MM/DD before year)
        if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
          supabaseQuery = supabaseQuery.eq('date_of_birth', normalized)
        } else {
          // Partial DOB — cast to text and ilike
          supabaseQuery = supabaseQuery.ilike('date_of_birth::text', `%${normalized}%`)
        }
        break
      }
      case 'email': {
        supabaseQuery = supabaseQuery.ilike('email', `%${q.trim()}%`)
        break
      }
      case 'name':
      default: {
        const { first, last } = parseName(q)
        
        if (first && last) {
          // Both first and last name provided
          supabaseQuery = supabaseQuery
            .ilike('first_name', `%${first}%`)
            .ilike('last_name', `%${last}%`)
        } else if (first) {
          // Single term — search both first and last
          // Use or() for flexible matching
          supabaseQuery = supabaseQuery.or(
            `first_name.ilike.%${first}%,last_name.ilike.%${first}%`
          )
        }
        break
      }
    }

    const { data, error } = await supabaseQuery.order('last_name', { ascending: true })
    
    if (error) {
      console.error('Search query error:', error)
      return []
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      email: p.email || '',
      phone: p.phone || '',
      date_of_birth: p.date_of_birth || '',
      location: p.location || '',
      created_at: p.created_at || '',
    }))
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') { setQuery(''); setIsOpen(false) }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex(prev => (prev < results.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex(prev => (prev > 0 ? prev - 1 : results.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && results[activeIndex]) {
          selectPatient(results[activeIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  const selectPatient = (patient: PatientSearchResult) => {
    onSelect(patient)
    setQuery('')
    setIsOpen(false)
    setResults([])
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    onClear?.()
    inputRef.current?.focus()
  }

  const formatDOB = (dob: string) => {
    if (!dob) return ''
    try {
      const d = new Date(dob + 'T00:00:00')
      return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    } catch { return dob }
  }

  const formatPhone = (phone: string) => {
    if (!phone) return ''
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
    if (digits.length === 11 && digits[0] === '1') return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`
    return phone
  }

  const getTypeHint = () => {
    switch (detectedType) {
      case 'phone': return 'Searching by phone...'
      case 'dob': return 'Searching by date of birth...'
      case 'email': return 'Searching by email...'
      case 'name': return 'Searching by name...'
      default: return null
    }
  }

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected Patient Pill (when showSelected + patient selected) */}
      {showSelected && selectedPatient && !query && (
        <div className={`flex items-center gap-2 ${compact ? 'px-3 py-1.5' : 'px-4 py-2.5'} bg-[#0d2626] border border-teal-600/40 rounded-lg`}>
          <div className={`${compact ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'} rounded-full bg-teal-600/20 flex items-center justify-center font-semibold text-teal-400`}>
            {selectedPatient.first_name.charAt(0)}{selectedPatient.last_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <span className={`text-white font-medium ${compact ? 'text-xs' : 'text-sm'}`}>
              {selectedPatient.first_name} {selectedPatient.last_name}
            </span>
            {!compact && selectedPatient.date_of_birth && (
              <span className="text-gray-500 text-xs ml-2">DOB: {formatDOB(selectedPatient.date_of_birth)}</span>
            )}
            {!compact && selectedPatient.phone && (
              <span className="text-gray-500 text-xs ml-2">{formatPhone(selectedPatient.phone)}</span>
            )}
          </div>
          <button
            onClick={handleClear}
            className="p-1 rounded hover:bg-red-500/20 transition-colors"
            title="Clear selection"
          >
            <X className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-gray-400 hover:text-red-400`} />
          </button>
        </div>
      )}

      {/* Search Input */}
      {(!showSelected || !selectedPatient || query) && (
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${loading ? 'text-teal-400 animate-pulse' : 'text-gray-500'}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (results.length > 0) setIsOpen(true) }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={`w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-colors ${
              compact ? 'pl-8 pr-8 py-1.5 text-xs' : 'pl-10 pr-10 py-2.5 text-sm'
            }`}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); setIsOpen(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[#1a3d3d] transition-colors"
            >
              <X className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-gray-500`} />
            </button>
          )}
        </div>
      )}

      {/* Type detection hint */}
      {query.trim().length >= 2 && detectedType !== 'unknown' && (
        <p className="text-[10px] text-gray-600 mt-0.5 ml-1">{getTypeHint()}</p>
      )}

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#0d2626] border border-[#1a3d3d] rounded-lg shadow-2xl max-h-80 overflow-y-auto">
          {/* Results count */}
          <div className="px-3 py-1.5 border-b border-[#1a3d3d]/60 flex items-center justify-between">
            <span className="text-[10px] text-gray-600 uppercase tracking-wider">
              {results.length} patient{results.length !== 1 ? 's' : ''} found
            </span>
            {detectedType !== 'unknown' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                detectedType === 'phone' ? 'bg-blue-500/10 text-blue-400' :
                detectedType === 'dob' ? 'bg-amber-500/10 text-amber-400' :
                detectedType === 'email' ? 'bg-purple-500/10 text-purple-400' :
                'bg-teal-500/10 text-teal-400'
              }`}>
                {detectedType === 'dob' ? 'DOB' : detectedType.charAt(0).toUpperCase() + detectedType.slice(1)}
              </span>
            )}
          </div>

          {/* Patient Results */}
          {results.map((patient, idx) => (
            <button
              key={patient.id}
              onClick={() => selectPatient(patient)}
              className={`w-full text-left px-3 py-2.5 transition-colors border-b border-[#1a3d3d]/30 last:border-b-0 ${
                idx === activeIndex ? 'bg-teal-600/10 border-l-2 border-l-teal-500' : 'hover:bg-[#164e4e]/50'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-[#164e4e] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-teal-300">
                    {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {patient.first_name} {patient.last_name}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {patient.date_of_birth && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {formatDOB(patient.date_of_birth)}
                      </span>
                    )}
                    {patient.phone && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Phone className="w-3 h-3" />
                        {formatPhone(patient.phone)}
                      </span>
                    )}
                    {patient.email && !patient.phone && !patient.date_of_birth && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Mail className="w-3 h-3" />
                        {patient.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {isOpen && results.length === 0 && !loading && query.trim().length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-[#0d2626] border border-[#1a3d3d] rounded-lg shadow-2xl p-4 text-center">
          <User className="w-6 h-6 text-gray-600 mx-auto mb-1.5" />
          <p className="text-sm text-gray-500">No patients found</p>
          <p className="text-[10px] text-gray-600 mt-1">Try name, DOB (MM/DD/YYYY), phone, or email</p>
        </div>
      )}
    </div>
  )
}

