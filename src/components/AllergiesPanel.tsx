// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  X, GripHorizontal, AlertTriangle, Plus, Edit2, Trash2, Save, 
  Search, Download, Shield
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// =============================================================================
// INTERFACES
// =============================================================================

interface Allergy {
  id: string
  patient_id: string
  chart_id?: string
  allergen_name: string
  allergy?: string
  reaction?: string
  status: string
  recorded_at: string
}
 
interface AllergiesPanelProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName: string
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ALLERGY_TYPES = [
  'Drug',
  'Food',
  'Environmental',
  'Biological',
  'Other'
]

const SEVERITY_OPTIONS = [
  { value: 'mild', label: 'Mild', color: 'bg-yellow-900/50 text-yellow-400' },
  { value: 'moderate', label: 'Moderate', color: 'bg-orange-900/50 text-orange-400' },
  { value: 'severe', label: 'Severe', color: 'bg-red-900/50 text-red-400' },
  { value: 'life-threatening', label: 'Life-Threatening', color: 'bg-red-700 text-white' }
]

const COMMON_REACTIONS = [
  'Rash',
  'Hives',
  'Itching',
  'Swelling',
  'Anaphylaxis',
  'Difficulty breathing',
  'Nausea/Vomiting',
  'Diarrhea',
  'Dizziness',
  'Other'
]

const COMMON_DRUG_ALLERGIES = [
  'Penicillin',
  'Amoxicillin',
  'Sulfa drugs',
  'Aspirin',
  'Ibuprofen',
  'Codeine',
  'Morphine',
  'Latex',
  'Contrast dye',
  'Anesthesia'
]

// =============================================================================
// COMPONENT
// =============================================================================

export default function AllergiesPanel({
  isOpen,
  onClose,
  patientId,
  patientName
}: AllergiesPanelProps) {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  
  // Data
  const [allergies, setAllergies] = useState<Allergy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // UI State
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [saving, setSaving] = useState(false)
  const [isNKDA, setIsNKDA] = useState(false)
  
  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Panel theme colors
  const [panelTheme, setPanelTheme] = useState<'purple' | 'blue' | 'cyan' | 'teal' | 'green' | 'orange' | 'red' | 'pink'>('red')
  
  const themeColors = {
    purple: { gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 50%, #4c1d95 100%)', border: '#a78bfa', glow: 'rgba(124, 58, 237, 0.3)', bg: 'linear-gradient(180deg, #1e1033 0%, #0d0a1a 100%)', light: '#c4b5fd', text: '#f5f3ff' },
    blue: { gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)', border: '#60a5fa', glow: 'rgba(37, 99, 235, 0.3)', bg: 'linear-gradient(180deg, #0a1628 0%, #060d18 100%)', light: '#93c5fd', text: '#eff6ff' },
    cyan: { gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%)', border: '#67e8f9', glow: 'rgba(6, 182, 212, 0.3)', bg: 'linear-gradient(180deg, #061a1a 0%, #040d0d 100%)', light: '#a5f3fc', text: '#ecfeff' },
    teal: { gradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)', border: '#5eead4', glow: 'rgba(20, 184, 166, 0.3)', bg: 'linear-gradient(180deg, #0a1a1a 0%, #060d0d 100%)', light: '#99f6e4', text: '#f0fdfa' },
    green: { gradient: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)', border: '#6ee7b7', glow: 'rgba(16, 185, 129, 0.3)', bg: 'linear-gradient(180deg, #061a12 0%, #040d0a 100%)', light: '#a7f3d0', text: '#ecfdf5' },
    orange: { gradient: 'linear-gradient(135deg, #ea580c 0%, #c2410c 50%, #9a3412 100%)', border: '#fb923c', glow: 'rgba(234, 88, 12, 0.3)', bg: 'linear-gradient(180deg, #1a1008 0%, #0d0a06 100%)', light: '#fdba74', text: '#fff7ed' },
    red: { gradient: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%)', border: '#f87171', glow: 'rgba(220, 38, 38, 0.3)', bg: 'linear-gradient(180deg, #1a0808 0%, #0d0606 100%)', light: '#fca5a5', text: '#fef2f2' },
    pink: { gradient: 'linear-gradient(135deg, #db2777 0%, #be185d 50%, #9d174d 100%)', border: '#f472b6', glow: 'rgba(219, 39, 119, 0.3)', bg: 'linear-gradient(180deg, #1a0812 0%, #0d060a 100%)', light: '#f9a8d4', text: '#fdf2f8' }
  }
  
  const currentTheme = themeColors[panelTheme]
  
  // Form State
  const [formData, setFormData] = useState({
    allergen_name: '',
    allergy_type: 'Drug',
    reaction: '',
    severity: 'moderate',
    status: 'active',
    notes: ''
  })
  
  // Draggable State
  const [position, setPosition] = useState({ x: 80, y: 50 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // DATA FETCHING
  // ---------------------------------------------------------------------------
  
  const fetchAllergies = async () => {
    setLoading(true)
    setError(null)
    
    console.log('Fetching allergies for patient:', patientId)
    
    try {
      const { data, error: queryError } = await supabase
        .from('patient_allergies')
        .select('*')
        .eq('patient_id', patientId)
        .order('recorded_at', { ascending: false })
      
      console.log('Allergies query result:', { data, queryError })
      
      if (queryError) {
        setError(queryError.message)
        return
      }
      
      setAllergies(data || [])
      
      // Check if NKDA (no allergies and explicitly marked)
      if (data && data.length === 0) {
        // Could check a separate NKDA flag here
      }
      
    } catch (err) {
      console.error('Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch allergies')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    if (isOpen && patientId) {
      fetchAllergies()
    }
  }, [isOpen, patientId])

  // ---------------------------------------------------------------------------
  // CRUD OPERATIONS
  // ---------------------------------------------------------------------------
  
  const handleAdd = async () => {
    if (!formData.allergen_name.trim()) {
      setError('Allergen name is required')
      return
    }
    
    setSaving(true)
    setError(null)
    
    console.log('Adding allergy:', formData)
    
    try {
      const { data, error: insertError } = await supabase
        .from('patient_allergies')
        .insert({
          patient_id: patientId,
          allergen_name: formData.allergen_name,
          allergy: formData.allergy_type,
          reaction: formData.reaction,
          status: formData.status,
          recorded_at: new Date().toISOString()
        })
        .select()
        .single()
      
      console.log('Insert result:', { data, insertError })
      
      if (insertError) {
        setError(insertError.message)
        return
      }
      
      await fetchAllergies()
      resetForm()
      setShowAddForm(false)
      setSaveStatus('saved')
      setLastSaved(new Date())
      
    } catch (err) {
      console.error('Add error:', err)
      setError(err instanceof Error ? err.message : 'Failed to add allergy')
    } finally {
      setSaving(false)
    }
  }
  
  const handleUpdate = async () => {
    if (!editingId || !formData.allergen_name.trim()) {
      setError('Allergen name is required')
      return
    }
    
    setSaving(true)
    setError(null)
    
    console.log('Updating allergy:', editingId, formData)
    
    try {
      const { error: updateError } = await supabase
        .from('patient_allergies')
        .update({
          allergen_name: formData.allergen_name,
          allergy: formData.allergy_type,
          reaction: formData.reaction,
          status: formData.status
        })
        .eq('id', editingId)
      
      console.log('Update result:', { updateError })
      
      if (updateError) {
        setError(updateError.message)
        return
      }
      
      await fetchAllergies()
      resetForm()
      setEditingId(null)
      setSaveStatus('saved')
      setLastSaved(new Date())
      
    } catch (err) {
      console.error('Update error:', err)
      setError(err instanceof Error ? err.message : 'Failed to update allergy')
    } finally {
      setSaving(false)
    }
  }
  
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this allergy record?')) {
      return
    }
    
    setError(null)
    
    console.log('Deleting allergy:', id)
    
    try {
      const { error: deleteError } = await supabase
        .from('patient_allergies')
        .delete()
        .eq('id', id)
      
      console.log('Delete result:', { deleteError })
      
      if (deleteError) {
        setError(deleteError.message)
        return
      }
      
      await fetchAllergies()
      
    } catch (err) {
      console.error('Delete error:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete allergy')
    }
  }
  
  const handleMarkNKDA = async () => {
    // Mark patient as having no known drug allergies
    // This would typically set a flag in the patients table
    setIsNKDA(true)
    // Could also delete all existing allergies or add a special "NKDA" record
  }

  // ---------------------------------------------------------------------------
  // AUTO-SAVE (2 second debounce after typing stops)
  // ---------------------------------------------------------------------------
  
  const autoSaveEdit = async () => {
    if (!editingId || !formData.allergen_name.trim()) return
    
    setSaveStatus('saving')
    
    try {
      const { error: updateError } = await supabase
        .from('patient_allergies')
        .update({
          allergen_name: formData.allergen_name,
          allergy: formData.allergy_type,
          reaction: formData.reaction,
          status: formData.status
        })
        .eq('id', editingId)
      
      if (updateError) {
        setSaveStatus('error')
        console.error('Auto-save error:', updateError)
        return
      }
      
      setSaveStatus('saved')
      setLastSaved(new Date())
      console.log('Auto-saved allergy at', new Date().toLocaleTimeString())
      
      // Refresh data in background
      fetchAllergies()
      
    } catch (err) {
      setSaveStatus('error')
      console.error('Auto-save error:', err)
    }
  }
  
  // Debounced form change handler for auto-save
  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Only auto-save when editing existing record
    if (editingId) {
      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
      
      // Set new timer for 2 seconds
      autoSaveTimerRef.current = setTimeout(() => {
        autoSaveEdit()
      }, 2000)
    }
  }
  
  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  // ---------------------------------------------------------------------------
  // FORM HELPERS
  // ---------------------------------------------------------------------------
  
  const resetForm = () => {
    setFormData({
      allergen_name: '',
      allergy_type: 'Drug',
      reaction: '',
      severity: 'moderate',
      status: 'active',
      notes: ''
    })
  }
  
  const startEdit = (allergy: Allergy) => {
    setFormData({
      allergen_name: allergy.allergen_name || '',
      allergy_type: allergy.allergy || 'Drug',
      reaction: allergy.reaction || '',
      severity: 'moderate',
      status: allergy.status || 'active',
      notes: ''
    })
    setEditingId(allergy.id)
    setShowAddForm(true)
  }
  
  const cancelEdit = () => {
    resetForm()
    setEditingId(null)
    setShowAddForm(false)
  }

  // ---------------------------------------------------------------------------
  // FILTERING
  // ---------------------------------------------------------------------------
  
  const filteredAllergies = allergies.filter(allergy => {
    const matchesSearch = 
      (allergy.allergen_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (allergy.reaction?.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = filterStatus === 'all' || allergy.status === filterStatus
    
    return matchesSearch && matchesStatus
  })

  // ---------------------------------------------------------------------------
  // EXPORT
  // ---------------------------------------------------------------------------
  
  const exportToCSV = () => {
    const headers = ['Allergen', 'Type', 'Reaction', 'Status', 'Recorded Date']
    const rows = allergies.map(a => [
      a.allergen_name || '',
      a.allergy || '',
      a.reaction || '',
      a.status || '',
      a.recorded_at ? new Date(a.recorded_at).toLocaleDateString() : ''
    ])
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `allergies_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ---------------------------------------------------------------------------
  // DRAG HANDLERS
  // ---------------------------------------------------------------------------
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (panelRef.current) {
      setIsDragging(true)
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
    }
  }
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        })
      }
    }
    
    const handleMouseUp = () => {
      setIsDragging(false)
    }
    
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  
  if (!isOpen) return null
  
  return (
    <div
      ref={panelRef}
      className="fixed z-[60] rounded-xl shadow-2xl flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: '600px',
        maxHeight: '85vh',
        background: currentTheme.bg,
        boxShadow: `0 12px 60px ${currentTheme.glow}, inset 0 0 0 2px ${currentTheme.border}`
      }}
    >
      {/* Header - Dynamic theme */}
      <div
        className="flex items-center justify-between p-4 cursor-move rounded-t-xl"
        style={{
          background: currentTheme.gradient,
          borderBottom: `2px solid ${currentTheme.border}`
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-3">
          <GripHorizontal className="h-5 w-5" style={{ color: currentTheme.light }} />
          <div className="p-2 bg-white/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Allergies</h2>
            <p className="text-xs" style={{ color: currentTheme.light }}>{patientName}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/20 rounded-lg transition-colors"
        >
          <X className="h-5 w-5" style={{ color: currentTheme.light }} />
        </button>
      </div>
      
      {/* Toolbar */}
      <div className="p-4 border-b border-[#1b2b4d] space-y-3">
        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { resetForm(); setShowAddForm(true); setEditingId(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Allergy
          </button>
          
          <button
            onClick={handleMarkNKDA}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
              isNKDA || allergies.length === 0
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-[#1b2b4d] hover:bg-[#243656] text-gray-300'
            }`}
          >
            <Shield className="h-4 w-4" />
            NKDA
          </button>
          
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-3 py-2 bg-[#1b2b4d] hover:bg-[#243656] text-gray-300 rounded-lg transition-colors text-sm"
            title="Export to CSV"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
        
        {/* Search and Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search allergies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#0d1424] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-[#00e6ff]"
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-[#0d1424] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-[#00e6ff]"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      
      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="p-4 border-b border-[#1b2b4d] bg-[#0d1424]">
          <h3 className="text-sm font-semibold text-white mb-3">
            {editingId ? 'Edit Allergy' : 'Add New Allergy'}
          </h3>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Allergen Name */}
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Allergen Name *</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.allergen_name}
                  onChange={(e) => setFormData({ ...formData, allergen_name: e.target.value })}
                  placeholder="e.g., Penicillin"
                  className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
                  list="common-allergens"
                />
                <datalist id="common-allergens">
                  {COMMON_DRUG_ALLERGIES.map(drug => (
                    <option key={drug} value={drug} />
                  ))}
                </datalist>
              </div>
            </div>
            
            {/* Allergy Type */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Type</label>
              <select
                value={formData.allergy_type}
                onChange={(e) => setFormData({ ...formData, allergy_type: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
              >
                {ALLERGY_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            {/* Severity */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Severity</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
              >
                {SEVERITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            
            {/* Reaction */}
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Reaction</label>
              <input
                type="text"
                value={formData.reaction}
                onChange={(e) => setFormData({ ...formData, reaction: e.target.value })}
                placeholder="e.g., Hives, Anaphylaxis"
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
                list="common-reactions"
              />
              <datalist id="common-reactions">
                {COMMON_REACTIONS.map(reaction => (
                  <option key={reaction} value={reaction} />
                ))}
              </datalist>
            </div>
            
            {/* Status */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          
          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              onClick={cancelEdit}
              className="px-4 py-2 bg-[#1b2b4d] hover:bg-[#243656] text-gray-300 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={editingId ? handleUpdate : handleAdd}
              disabled={saving || !formData.allergen_name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : (editingId ? 'Update' : 'Save')}
            </button>
          </div>
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-red-400 border-t-transparent rounded-full"></div>
          </div>
        ) : filteredAllergies.length === 0 ? (
          <div className="text-center py-12">
            {allergies.length === 0 ? (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-900/30 rounded-full mb-4">
                  <Shield className="h-8 w-8 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-green-400 mb-1">NKDA</h3>
                <p className="text-gray-400 text-sm">No Known Drug Allergies</p>
                <p className="text-gray-500 text-xs mt-2">Click "Add Allergy" to record any allergies</p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1b2b4d] rounded-full mb-4">
                  <Search className="h-8 w-8 text-gray-500" />
                </div>
                <p className="text-gray-400">No allergies match your search</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAllergies.map((allergy) => (
              <div
                key={allergy.id}
                className="p-4 bg-[#0d1424] border border-[#4d1b1b] rounded-lg hover:border-red-600/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-900/30 rounded-lg mt-0.5">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">{allergy.allergen_name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        {allergy.allergy && (
                          <span className="px-2 py-0.5 bg-[#1b2b4d] text-gray-300 text-xs rounded">
                            {allergy.allergy}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          allergy.status === 'active' 
                            ? 'bg-red-900/50 text-red-400' 
                            : 'bg-gray-700 text-gray-400'
                        }`}>
                          {allergy.status}
                        </span>
                      </div>
                      {allergy.reaction && (
                        <p className="text-red-300 text-sm mt-2">
                          <span className="text-gray-500">Reaction:</span> {allergy.reaction}
                        </p>
                      )}
                      <p className="text-gray-500 text-xs mt-2">
                        Recorded: {allergy.recorded_at ? new Date(allergy.recorded_at).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(allergy)}
                      className="p-2 hover:bg-[#1b2b4d] rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4 text-gray-400 hover:text-white" />
                    </button>
                    <button
                      onClick={() => handleDelete(allergy.id)}
                      className="p-2 hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer with Save Status and Color Selector */}
      <div 
        className="p-3 border-t rounded-b-xl"
        style={{ 
          background: 'rgba(0,0,0,0.5)', 
          backdropFilter: 'blur(8px)',
          borderColor: currentTheme.border 
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-gray-400">{filteredAllergies.length} of {allergies.length} allergies</span>
            {/* Save Status Indicator */}
            <span className={`flex items-center gap-1 ${
              saveStatus === 'saving' ? 'text-yellow-400' :
              saveStatus === 'saved' ? 'text-green-400' :
              saveStatus === 'error' ? 'text-red-400' : 'text-gray-500'
            }`}>
              {saveStatus === 'saving' && (
                <><span className="animate-spin">⟳</span> Saving...</>
              )}
              {saveStatus === 'saved' && lastSaved && (
                <>✓ Saved {lastSaved.toLocaleTimeString()}</>
              )}
              {saveStatus === 'error' && (
                <>✗ Save failed</>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Theme:</span>
            <div className="flex items-center gap-1">
              {(Object.keys(themeColors) as Array<keyof typeof themeColors>).map((color) => (
                <button
                  key={color}
                  onClick={() => setPanelTheme(color)}
                  className={`w-5 h-5 rounded-full transition-all hover:scale-110 ${panelTheme === color ? 'ring-2 ring-white ring-offset-1 ring-offset-black scale-110' : ''}`}
                  style={{ background: themeColors[color].gradient }}
                  title={color.charAt(0).toUpperCase() + color.slice(1)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


