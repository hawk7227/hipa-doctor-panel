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
      className="fixed z-[60] bg-[#0a1628] rounded-xl shadow-2xl border border-[#1b2b4d] flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: '600px',
        maxHeight: '85vh'
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b border-[#1b2b4d] cursor-move bg-[#0d1424] rounded-t-xl"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-3">
          <GripHorizontal className="h-5 w-5 text-gray-500" />
          <div className="p-2 bg-red-900/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Allergies</h2>
            <p className="text-xs text-gray-400">{patientName}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[#1b2b4d] rounded-lg transition-colors"
        >
          <X className="h-5 w-5 text-gray-400" />
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
      
      {/* Footer */}
      <div className="p-3 border-t border-[#1b2b4d] bg-[#0d1424] rounded-b-xl">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{filteredAllergies.length} of {allergies.length} allergies</span>
          <span>⚠️ Always verify allergies before prescribing</span>
        </div>
      </div>
    </div>
  )
}
