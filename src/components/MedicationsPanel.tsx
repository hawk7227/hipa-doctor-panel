'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  X, GripHorizontal, Pill, Plus, Edit2, Trash2, Save, 
  Search, Download, Clock, CheckCircle, XCircle, 
  AlertTriangle, Calendar
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// =============================================================================
// INTERFACES
// =============================================================================

interface Medication {
  id: string
  patient_id: string
  chart_id?: string
  medication_name: string
  dosage?: string
  frequency?: string
  route?: string
  status: string
  prescribed_datetime?: string
  start_taking_datetime?: string
  end_taking_datetime?: string
  recorded_at: string
  prescriber?: string
  notes?: string
}

interface MedicationsPanelProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName: string
}

// =============================================================================
// CONSTANTS
// =============================================================================

const FREQUENCY_OPTIONS = [
  'Once daily',
  'Twice daily (BID)',
  'Three times daily (TID)',
  'Four times daily (QID)',
  'Every morning',
  'Every evening',
  'At bedtime (HS)',
  'Every 4 hours',
  'Every 6 hours',
  'Every 8 hours',
  'Every 12 hours',
  'As needed (PRN)',
  'Weekly',
  'Monthly',
  'Other'
]

const ROUTE_OPTIONS = [
  'Oral',
  'Sublingual',
  'Topical',
  'Transdermal',
  'Inhalation',
  'Subcutaneous',
  'Intramuscular',
  'Intravenous',
  'Rectal',
  'Ophthalmic',
  'Otic',
  'Nasal',
  'Other'
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-green-900/50 text-green-400', icon: CheckCircle },
  { value: 'on-hold', label: 'On Hold', color: 'bg-yellow-900/50 text-yellow-400', icon: Clock },
  { value: 'discontinued', label: 'Discontinued', color: 'bg-red-900/50 text-red-400', icon: XCircle },
  { value: 'completed', label: 'Completed', color: 'bg-gray-700 text-gray-400', icon: CheckCircle }
]

// =============================================================================
// COMPONENT
// =============================================================================

export default function MedicationsPanel({
  isOpen,
  onClose,
  patientId,
  patientName
}: MedicationsPanelProps) {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  
  // Data
  const [medications, setMedications] = useState<Medication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // UI State
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [saving, setSaving] = useState(false)
  
  // Form State
  const [formData, setFormData] = useState({
    medication_name: '',
    dosage: '',
    frequency: '',
    route: 'Oral',
    status: 'active',
    start_taking_datetime: '',
    end_taking_datetime: '',
    prescriber: '',
    notes: ''
  })
  
  // Draggable State
  const [position, setPosition] = useState({ x: 120, y: 70 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // DATA FETCHING
  // ---------------------------------------------------------------------------
  
  const fetchMedications = async () => {
    setLoading(true)
    setError(null)
    
    console.log('Fetching medications for patient:', patientId)
    
    try {
      const { data, error: queryError } = await supabase
        .from('patient_medications')
        .select('*')
        .eq('patient_id', patientId)
        .order('recorded_at', { ascending: false })
      
      console.log('Medications query result:', { data, queryError })
      
      if (queryError) {
        setError(queryError.message)
        return
      }
      
      setMedications(data || [])
      
    } catch (err) {
      console.error('Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch medications')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    if (isOpen && patientId) {
      fetchMedications()
    }
  }, [isOpen, patientId])

  // ---------------------------------------------------------------------------
  // CRUD OPERATIONS
  // ---------------------------------------------------------------------------
  
  const handleAdd = async () => {
    if (!formData.medication_name.trim()) {
      setError('Medication name is required')
      return
    }
    
    setSaving(true)
    setError(null)
    
    console.log('Adding medication:', formData)
    
    try {
      const insertData: any = {
        patient_id: patientId,
        medication_name: formData.medication_name,
        status: formData.status,
        recorded_at: new Date().toISOString()
      }
      
      if (formData.start_taking_datetime) insertData.start_taking_datetime = formData.start_taking_datetime
      if (formData.end_taking_datetime) insertData.end_taking_datetime = formData.end_taking_datetime
      
      const { data, error: insertError } = await supabase
        .from('patient_medications')
        .insert(insertData)
        .select()
        .single()
      
      console.log('Insert result:', { data, insertError })
      
      if (insertError) {
        setError(insertError.message)
        return
      }
      
      await fetchMedications()
      resetForm()
      setShowAddForm(false)
      
    } catch (err) {
      console.error('Add error:', err)
      setError(err instanceof Error ? err.message : 'Failed to add medication')
    } finally {
      setSaving(false)
    }
  }
  
  const handleUpdate = async () => {
    if (!editingId || !formData.medication_name.trim()) {
      setError('Medication name is required')
      return
    }
    
    setSaving(true)
    setError(null)
    
    console.log('Updating medication:', editingId, formData)
    
    try {
      const updateData: any = {
        medication_name: formData.medication_name,
        status: formData.status
      }
      
      if (formData.start_taking_datetime) updateData.start_taking_datetime = formData.start_taking_datetime
      if (formData.end_taking_datetime) updateData.end_taking_datetime = formData.end_taking_datetime
      
      const { error: updateError } = await supabase
        .from('patient_medications')
        .update(updateData)
        .eq('id', editingId)
      
      console.log('Update result:', { updateError })
      
      if (updateError) {
        setError(updateError.message)
        return
      }
      
      await fetchMedications()
      resetForm()
      setEditingId(null)
      
    } catch (err) {
      console.error('Update error:', err)
      setError(err instanceof Error ? err.message : 'Failed to update medication')
    } finally {
      setSaving(false)
    }
  }
  
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this medication record?')) {
      return
    }
    
    setError(null)
    
    console.log('Deleting medication:', id)
    
    try {
      const { error: deleteError } = await supabase
        .from('patient_medications')
        .delete()
        .eq('id', id)
      
      console.log('Delete result:', { deleteError })
      
      if (deleteError) {
        setError(deleteError.message)
        return
      }
      
      await fetchMedications()
      
    } catch (err) {
      console.error('Delete error:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete medication')
    }
  }
  
  const handleDiscontinue = async (id: string) => {
    setError(null)
    
    try {
      const { error: updateError } = await supabase
        .from('patient_medications')
        .update({
          status: 'discontinued',
          end_taking_datetime: new Date().toISOString()
        })
        .eq('id', id)
      
      if (updateError) {
        setError(updateError.message)
        return
      }
      
      await fetchMedications()
      
    } catch (err) {
      console.error('Discontinue error:', err)
      setError(err instanceof Error ? err.message : 'Failed to discontinue medication')
    }
  }

  // ---------------------------------------------------------------------------
  // FORM HELPERS
  // ---------------------------------------------------------------------------
  
  const resetForm = () => {
    setFormData({
      medication_name: '',
      dosage: '',
      frequency: '',
      route: 'Oral',
      status: 'active',
      start_taking_datetime: '',
      end_taking_datetime: '',
      prescriber: '',
      notes: ''
    })
  }
  
  const startEdit = (med: Medication) => {
    setFormData({
      medication_name: med.medication_name || '',
      dosage: med.dosage || '',
      frequency: med.frequency || '',
      route: med.route || 'Oral',
      status: med.status || 'active',
      start_taking_datetime: med.start_taking_datetime?.split('T')[0] || '',
      end_taking_datetime: med.end_taking_datetime?.split('T')[0] || '',
      prescriber: med.prescriber || '',
      notes: med.notes || ''
    })
    setEditingId(med.id)
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
  
  const filteredMedications = medications.filter(med => {
    const matchesSearch = med.medication_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || med.status === filterStatus
    return matchesSearch && matchesStatus
  })
  
  // Separate active and inactive
  const activeMeds = filteredMedications.filter(m => m.status === 'active')
  const inactiveMeds = filteredMedications.filter(m => m.status !== 'active')

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  
  const formatDate = (date: string) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }
  
  const getStatusConfig = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]
  }

  // ---------------------------------------------------------------------------
  // EXPORT
  // ---------------------------------------------------------------------------
  
  const exportToCSV = () => {
    const headers = ['Medication', 'Status', 'Start Date', 'End Date', 'Recorded']
    const rows = medications.map(m => [
      m.medication_name || '',
      m.status || '',
      m.start_taking_datetime ? formatDate(m.start_taking_datetime) : '',
      m.end_taking_datetime ? formatDate(m.end_taking_datetime) : '',
      m.recorded_at ? formatDate(m.recorded_at) : ''
    ])
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `medications_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
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
        width: '650px',
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
          <div className="p-2 bg-green-900/30 rounded-lg">
            <Pill className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Medications</h2>
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
      
      {/* Summary Stats */}
      <div className="p-4 border-b border-[#1b2b4d] bg-[#0d1424]">
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 bg-[#0a1628] rounded-lg text-center border border-[#1b2b4d]">
            <p className="text-2xl font-bold text-green-400">{activeMeds.length}</p>
            <p className="text-xs text-gray-400">Active</p>
          </div>
          <div className="p-3 bg-[#0a1628] rounded-lg text-center border border-[#1b2b4d]">
            <p className="text-2xl font-bold text-yellow-400">
              {medications.filter(m => m.status === 'on-hold').length}
            </p>
            <p className="text-xs text-gray-400">On Hold</p>
          </div>
          <div className="p-3 bg-[#0a1628] rounded-lg text-center border border-[#1b2b4d]">
            <p className="text-2xl font-bold text-red-400">
              {medications.filter(m => m.status === 'discontinued').length}
            </p>
            <p className="text-xs text-gray-400">Discontinued</p>
          </div>
          <div className="p-3 bg-[#0a1628] rounded-lg text-center border border-[#1b2b4d]">
            <p className="text-2xl font-bold text-white">{medications.length}</p>
            <p className="text-xs text-gray-400">Total</p>
          </div>
        </div>
      </div>
      
      {/* Toolbar */}
      <div className="p-4 border-b border-[#1b2b4d] space-y-3">
        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { resetForm(); setShowAddForm(true); setEditingId(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Medication
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
              placeholder="Search medications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#0d1424] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-[#0d1424] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="discontinued">Discontinued</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>
      
      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="p-4 border-b border-[#1b2b4d] bg-[#0d1424]">
          <h3 className="text-sm font-semibold text-white mb-3">
            {editingId ? 'Edit Medication' : 'Add New Medication'}
          </h3>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Medication Name */}
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Medication Name *</label>
              <input
                type="text"
                value={formData.medication_name}
                onChange={(e) => setFormData({ ...formData, medication_name: e.target.value })}
                placeholder="e.g., Lisinopril 10mg"
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            
            {/* Frequency */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Frequency</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
              >
                <option value="">Select frequency</option>
                {FREQUENCY_OPTIONS.map(freq => (
                  <option key={freq} value={freq}>{freq}</option>
                ))}
              </select>
            </div>
            
            {/* Route */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Route</label>
              <select
                value={formData.route}
                onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
              >
                {ROUTE_OPTIONS.map(route => (
                  <option key={route} value={route}>{route}</option>
                ))}
              </select>
            </div>
            
            {/* Start Date */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.start_taking_datetime}
                onChange={(e) => setFormData({ ...formData, start_taking_datetime: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            
            {/* Status */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
              >
                {STATUS_OPTIONS.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
            
            {/* Notes */}
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={2}
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-green-500 resize-none"
              />
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
              disabled={saving || !formData.medication_name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
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
            <div className="animate-spin h-8 w-8 border-2 border-green-400 border-t-transparent rounded-full"></div>
          </div>
        ) : filteredMedications.length === 0 ? (
          <div className="text-center py-12">
            {medications.length === 0 ? (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1b2b4d] rounded-full mb-4">
                  <Pill className="h-8 w-8 text-gray-500" />
                </div>
                <p className="text-gray-400">No medications on record</p>
                <p className="text-gray-500 text-sm mt-1">Click "Add Medication" to add one</p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1b2b4d] rounded-full mb-4">
                  <Search className="h-8 w-8 text-gray-500" />
                </div>
                <p className="text-gray-400">No medications match your search</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Medications */}
            {activeMeds.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Active Medications ({activeMeds.length})
                </h3>
                <div className="space-y-2">
                  {activeMeds.map((med) => (
                    <MedicationCard 
                      key={med.id}
                      medication={med}
                      onEdit={() => startEdit(med)}
                      onDelete={() => handleDelete(med.id)}
                      onDiscontinue={() => handleDiscontinue(med.id)}
                      formatDate={formatDate}
                      getStatusConfig={getStatusConfig}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Inactive Medications */}
            {inactiveMeds.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Past Medications ({inactiveMeds.length})
                </h3>
                <div className="space-y-2 opacity-75">
                  {inactiveMeds.map((med) => (
                    <MedicationCard 
                      key={med.id}
                      medication={med}
                      onEdit={() => startEdit(med)}
                      onDelete={() => handleDelete(med.id)}
                      formatDate={formatDate}
                      getStatusConfig={getStatusConfig}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="p-3 border-t border-[#1b2b4d] bg-[#0d1424] rounded-b-xl">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{filteredMedications.length} of {medications.length} medications</span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-yellow-500" />
            Check for drug interactions before prescribing
          </span>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface MedicationCardProps {
  medication: Medication
  onEdit: () => void
  onDelete: () => void
  onDiscontinue?: () => void
  formatDate: (date: string) => string
  getStatusConfig: (status: string) => any
}

function MedicationCard({ 
  medication, 
  onEdit, 
  onDelete, 
  onDiscontinue,
  formatDate, 
  getStatusConfig 
}: MedicationCardProps) {
  const statusConfig = getStatusConfig(medication.status)
  const StatusIcon = statusConfig.icon
  
  return (
    <div className="p-4 bg-[#0d1424] border border-[#1b4d2b] rounded-lg hover:border-green-600/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-900/30 rounded-lg mt-0.5">
            <Pill className="h-4 w-4 text-green-400" />
          </div>
          <div>
            <h4 className="text-white font-semibold">{medication.medication_name}</h4>
            
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 ${statusConfig.color}`}>
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </span>
            </div>
            
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
              {medication.start_taking_datetime && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Started: {formatDate(medication.start_taking_datetime)}
                </span>
              )}
              {medication.end_taking_datetime && (
                <span>Ended: {formatDate(medication.end_taking_datetime)}</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {medication.status === 'active' && onDiscontinue && (
            <button
              onClick={onDiscontinue}
              className="p-2 hover:bg-yellow-900/30 rounded-lg transition-colors"
              title="Discontinue"
            >
              <XCircle className="h-4 w-4 text-gray-400 hover:text-yellow-400" />
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-2 hover:bg-[#1b2b4d] rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 className="h-4 w-4 text-gray-400 hover:text-white" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-900/30 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-400" />
          </button>
        </div>
      </div>
    </div>
  )
}
