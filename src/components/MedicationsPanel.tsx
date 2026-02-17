// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
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
  
  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Panel theme colors
  const [panelTheme, setPanelTheme] = useState<'purple' | 'blue' | 'cyan' | 'teal' | 'green' | 'orange' | 'red' | 'pink'>('green')
  
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
      setSaveStatus('saved')
      setLastSaved(new Date())
      
    } catch (err) {
      console.error('Add error:', err)
      setError(err instanceof Error ? err.message : 'Failed to add medication')
      setSaveStatus('error')
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
      setSaveStatus('saved')
      setLastSaved(new Date())
      
    } catch (err) {
      console.error('Update error:', err)
      setError(err instanceof Error ? err.message : 'Failed to update medication')
      setSaveStatus('error')
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
  // AUTO-SAVE (2 second debounce after typing stops)
  // ---------------------------------------------------------------------------
  
  const autoSaveEdit = async () => {
    if (!editingId || !formData.medication_name.trim()) return
    
    setSaveStatus('saving')
    
    try {
      const { error: updateError } = await supabase
        .from('medications')
        .update({
          medication_name: formData.medication_name,
          dosage: formData.dosage || null,
          frequency: formData.frequency || null,
          route: formData.route || null,
          status: formData.status || 'active',
          start_taking_datetime: formData.start_taking_datetime || null,
          end_taking_datetime: formData.end_taking_datetime || null,
          prescriber: formData.prescriber || null,
          notes: formData.notes || null
        })
        .eq('id', editingId)
      
      if (updateError) {
        setSaveStatus('error')
        console.error('Auto-save error:', updateError)
        return
      }
      
      setSaveStatus('saved')
      setLastSaved(new Date())
      console.log('Auto-saved medication at', new Date().toLocaleTimeString())
      
      // Refresh data in background
      fetchMedications()
      
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
      className="fixed z-[60] rounded-xl shadow-2xl flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: '650px',
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
            <Pill className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Medications</h2>
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
            <span className="text-gray-400">{filteredMedications.length} of {medications.length} medications</span>
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


