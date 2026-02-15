'use client'

/**
 * PatientSearchBar — Global patient search (Ctrl+K)
 * 
 * Smart search: DrChrono first, Supabase fallback
 * - Name → DrChrono API (first/last)
 * - DOB → DrChrono API (date_of_birth)
 * - Email → Supabase only (DrChrono doesn't support)
 * - Phone → Supabase only (DrChrono doesn't support)
 * 
 * Auto-syncs patient into local DB on select.
 * Always accessible from any /doctor/* page via Ctrl+K.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, User, Phone, Mail, Calendar, Loader2, ExternalLink, Zap } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────
interface SearchResult {
  id: string | null
  drchrono_id: number | null
  chart_id: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  pharmacy: string | null
  source: 'drchrono_api' | 'drchrono_local' | 'local'
}

// Also export for other components that reference old interface
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

interface SearchMeta {
  type: string
  sources: { drchrono_api: number; drchrono_local: number; local: number }
  elapsed: number
}

// ─── Component ──────────────────────────────────────────────────
export default function PatientSearchBar() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState<number | null>(null)
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // ── Ctrl+K hotkey ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen])

  // ── Focus input when opened ──
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setResults([])
      setSearchMeta(null)
      setSelectedIndex(0)
    }
  }, [isOpen])

  // ── Debounced search ──
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setSearchMeta(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results || [])
        setSearchMeta({
          type: data.search_type,
          sources: data.sources,
          elapsed: data.elapsed_ms,
        })
        setSelectedIndex(0)
      }
    } catch (err) {
      console.error('[PatientSearch] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  // ── Select patient → sync + navigate ──
  const selectPatient = useCallback(async (patient: SearchResult) => {
    // DrChrono patient → sync first
    if (patient.drchrono_id && patient.source !== 'local') {
      setSyncing(patient.drchrono_id)
      try {
        const res = await fetch('/api/patients/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drchrono_id: patient.drchrono_id }),
        })
        if (res.ok) {
          const data = await res.json()
          setIsOpen(false)
          router.push(`/doctor/appointments?patient=${data.patient.id}`)
          return
        }
      } catch (err) {
        console.error('[PatientSearch] Sync error:', err)
      } finally {
        setSyncing(null)
      }
    }

    // Local patient → navigate directly
    setIsOpen(false)
    if (patient.id) {
      router.push(`/doctor/appointments?patient=${patient.id}`)
    }
  }, [router])

  // ── Keyboard navigation ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      selectPatient(results[selectedIndex])
    }
  }

  // ── Search type hint ──
  const getSearchHint = () => {
    if (!query) return ''
    if (query.includes('@')) return '📧 Searching by email (local database)'
    if (/^\d{1,2}\//.test(query)) return '📅 Searching by date of birth'
    const digits = query.replace(/\D/g, '')
    if (digits.length >= 3 && /^[\d\s\-().+]+$/.test(query)) return '📞 Searching by phone (local database)'
    if (query.includes(' ')) return '👤 Searching first + last name via DrChrono'
    return '👤 Searching name via DrChrono'
  }

  // ── Source badge ──
  const SourceBadge = ({ source }: { source: string }) => {
    if (source === 'drchrono_api') return (
      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">DrChrono Live</span>
    )
    if (source === 'drchrono_local') return (
      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">Synced</span>
    )
    return (
      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-teal-500/20 text-teal-400 border border-teal-500/30">Local</span>
    )
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setIsOpen(false)} />

      {/* Search Modal */}
      <div className="fixed inset-x-0 top-0 z-[101] flex justify-center pt-[10vh]">
        <div className="w-full max-w-2xl mx-4 bg-[#0d2626] border border-[#1a3d3d] rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-[fadeIn_0.15s_ease-out]">

          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a3d3d]">
            <Search className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search patients — name, DOB (MM/DD/YYYY), email, phone..."
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-gray-500"
              autoComplete="off"
              spellCheck={false}
            />
            {loading && <Loader2 className="w-4 h-4 text-teal-400 animate-spin flex-shrink-0" />}
            <kbd className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold text-gray-500 bg-[#0a1f1f] border border-[#1a3d3d] rounded">ESC</kbd>
            <button onClick={() => setIsOpen(false)} className="p-1 text-gray-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search type hint */}
          {query.length > 0 && (
            <div className="px-4 py-1.5 text-[10px] text-gray-500 border-b border-[#1a3d3d]/50">
              {getSearchHint()}
            </div>
          )}

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto">
            {/* Empty state */}
            {results.length === 0 && query.length >= 2 && !loading && (
              <div className="px-4 py-8 text-center">
                <User className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No patients found</p>
                <p className="text-xs text-gray-600 mt-1">Try a different name, DOB, email, or phone</p>
              </div>
            )}

            {/* Initial state */}
            {results.length === 0 && query.length < 2 && !loading && (
              <div className="px-4 py-6 text-center">
                <Search className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Type at least 2 characters to search</p>
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  <span className="px-2 py-1 text-[10px] text-gray-500 bg-[#0a1f1f] rounded border border-[#1a3d3d]">Marcus Hawkins</span>
                  <span className="px-2 py-1 text-[10px] text-gray-500 bg-[#0a1f1f] rounded border border-[#1a3d3d]">01/02/1975</span>
                  <span className="px-2 py-1 text-[10px] text-gray-500 bg-[#0a1f1f] rounded border border-[#1a3d3d]">hawk7227@</span>
                  <span className="px-2 py-1 text-[10px] text-gray-500 bg-[#0a1f1f] rounded border border-[#1a3d3d]">602-549</span>
                </div>
              </div>
            )}

            {/* Results list */}
            {results.map((patient, idx) => (
              <button
                key={`${patient.source}-${patient.drchrono_id || patient.id}-${idx}`}
                onClick={() => selectPatient(patient)}
                disabled={syncing !== null}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-[#1a3d3d]/30 ${
                  idx === selectedIndex
                    ? 'bg-teal-500/10 border-l-2 border-l-teal-500'
                    : 'hover:bg-white/5 border-l-2 border-l-transparent'
                } ${syncing === patient.drchrono_id ? 'opacity-60' : ''}`}
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-[#1a3d3d] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-teal-400">
                    {(patient.first_name?.[0] || '').toUpperCase()}{(patient.last_name?.[0] || '').toUpperCase()}
                  </span>
                </div>

                {/* Patient info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">
                      {patient.first_name} {patient.last_name}
                    </span>
                    <SourceBadge source={patient.source} />
                    {syncing === patient.drchrono_id && (
                      <span className="flex items-center gap-1 text-[10px] text-teal-400">
                        <Zap className="w-3 h-3 animate-pulse" /> Syncing...
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                    {patient.date_of_birth && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-400">
                        <Calendar className="w-3 h-3" />
                        {new Date(patient.date_of_birth + 'T00:00:00').toLocaleDateString()}
                      </span>
                    )}
                    {patient.phone && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-400">
                        <Phone className="w-3 h-3" />
                        {patient.phone}
                      </span>
                    )}
                    {patient.email && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-400 truncate max-w-[200px]">
                        <Mail className="w-3 h-3" />
                        {patient.email}
                      </span>
                    )}
                    {patient.chart_id && (
                      <span className="text-[10px] text-gray-500">Chart #{patient.chart_id}</span>
                    )}
                  </div>
                  {(patient.address || patient.city) && (
                    <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                      {[patient.address, patient.city, patient.state, patient.zip_code].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>

                <ExternalLink className="w-4 h-4 text-gray-600 flex-shrink-0 mt-1" />
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[#1a3d3d] flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-gray-600">
              <span>↑↓ Navigate</span>
              <span>↵ Select & Sync</span>
              <span>ESC Close</span>
            </div>
            {searchMeta && (
              <div className="flex items-center gap-2 text-[10px] text-gray-600">
                {searchMeta.sources.drchrono_api > 0 && (
                  <span className="text-blue-400">{searchMeta.sources.drchrono_api} DrChrono</span>
                )}
                {searchMeta.sources.drchrono_local > 0 && (
                  <span className="text-purple-400">{searchMeta.sources.drchrono_local} synced</span>
                )}
                {searchMeta.sources.local > 0 && (
                  <span className="text-teal-400">{searchMeta.sources.local} local</span>
                )}
                <span>· {searchMeta.elapsed}ms</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
