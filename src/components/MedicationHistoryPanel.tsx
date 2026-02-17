// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Download, Check, AlertTriangle, Search, Pill, ExternalLink, GripHorizontal, RefreshCw, Plus, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Reference colors from design:
// --cyan:#00e6ff; --mint:#19d67f; --amber:#f5a524; --pink:#ff7ad6;
// --panel:#0d1424; --panel2:#0b1222; --line:#1b2b4d;

interface MedicationHistoryItem {
  id: string
  medication_name: string
  dosage?: string
  frequency?: string
  route?: string
  sig?: string
  quantity?: number
  refills?: number
  prescriber?: string
  pharmacy?: string
  start_date?: string
  end_date?: string
  status?: string
  fill_status?: string
  source?: string
  notes?: string
  flag?: 'ok' | 'warn' | 'stop'
}

interface FillHistoryItem {
  date: string
  pharmacy: string
  quantity: number
  status: string
}

interface MedicationHistoryPanelProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName: string
  patientDOB?: string
  onReconcile?: (medications: MedicationHistoryItem[]) => void
  onMedicationAdded?: () => void
}

export default function MedicationHistoryPanel({
  isOpen,
  onClose,
  patientId,
  patientName,
  patientDOB,
  onReconcile,
  onMedicationAdded
}: MedicationHistoryPanelProps) {
  const [medications, setMedications] = useState<MedicationHistoryItem[]>([])
  const [selectedMeds, setSelectedMeds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fillHistory, setFillHistory] = useState<FillHistoryItem[]>([])
  const [interactionAlert, setInteractionAlert] = useState<string>('')
  
  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Panel theme colors
  const [panelTheme, setPanelTheme] = useState<'purple' | 'blue' | 'cyan' | 'teal' | 'green' | 'orange' | 'red' | 'pink'>('purple')
  
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
  
  // Filters
  const [dateRange, setDateRange] = useState('12')
  const [statusFilter, setStatusFilter] = useState('All')
  const [formFilter, setFormFilter] = useState('All')
  const [fillFilter, setFillFilter] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')

  // Add/Edit form
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingMed, setEditingMed] = useState<MedicationHistoryItem | null>(null)
  const [newMed, setNewMed] = useState({
    medication_name: '',
    dosage: '',
    route: 'oral',
    sig: '',
    quantity: '',
    refills: '0',
    prescriber: '',
    pharmacy: '',
    start_date: new Date().toISOString().split('T')[0],
    status: 'active',
    fill_status: 'Filled'
  })

  // Draggable state
  const [position, setPosition] = useState({ x: 100, y: 50 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  // Fetch medication history when panel opens
  useEffect(() => {
    if (isOpen && patientId) {
      fetchMedicationHistory()
    }
  }, [isOpen, patientId, dateRange, statusFilter, formFilter, fillFilter])

  const fetchMedicationHistory = async () => {
    setLoading(true)
    try {
      const now = new Date()
      const rangeMonths = parseInt(dateRange) || 12
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - rangeMonths)

      let query = supabase
        .from('medication_history')
        .select('*')
        .eq('patient_id', patientId)
        .order('start_date', { ascending: false })

      if (dateRange !== 'all') {
        query = query.gte('start_date', startDate.toISOString())
      }

      if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter.toLowerCase())
      }

      const { data, error } = await query

      if (error) throw error

      const transformedData: MedicationHistoryItem[] = (data || []).map((med, idx) => ({
        id: med.id || `mh-${idx}`,
        medication_name: med.medication_name || '',
        dosage: med.dosage || '',
        frequency: med.frequency || '',
        route: med.route || 'oral',
        sig: med.sig || '',
        quantity: med.quantity || 0,
        refills: med.refills || 0,
        prescriber: med.prescriber || 'External Provider',
        pharmacy: med.pharmacy || '',
        start_date: med.start_date,
        end_date: med.end_date,
        status: med.status || 'active',
        fill_status: med.fill_status || 'Filled',
        source: med.source || 'Surescripts',
        notes: med.notes,
        flag: determineMedFlag(med.medication_name, med.notes)
      }))

      let filteredData = transformedData
      if (formFilter !== 'All') {
        filteredData = filteredData.filter(m => 
          m.route?.toLowerCase() === formFilter.toLowerCase()
        )
      }
      if (fillFilter !== 'All') {
        filteredData = filteredData.filter(m => 
          m.fill_status === fillFilter
        )
      }

      setMedications(filteredData)
    } catch (error) {
      console.error('Error fetching medication history:', error)
      setMedications([])
    } finally {
      setLoading(false)
    }
  }

  const determineMedFlag = (medName?: string, notes?: string): 'ok' | 'warn' | 'stop' => {
    const name = (medName || '').toLowerCase()
    const noteText = (notes || '').toLowerCase()
    
    if (noteText.includes('interaction') || noteText.includes('contraindicated')) {
      return 'stop'
    }
    if (noteText.includes('duplication') || noteText.includes('watch') || noteText.includes('monitor')) {
      return 'warn'
    }
    if (name.includes('clarithromycin') || name.includes('erythromycin')) {
      return 'stop'
    }
    if (name.includes('adderall') || name.includes('controlled')) {
      return 'warn'
    }
    return 'ok'
  }

  // Add new medication
  const handleAddMedication = async () => {
    if (!newMed.medication_name.trim()) return
    setSaving(true)
    
    try {
      const { data, error } = await supabase
        .from('medication_history')
        .insert({
          patient_id: patientId,
          medication_name: newMed.medication_name,
          dosage: newMed.dosage,
          route: newMed.route,
          sig: newMed.sig,
          quantity: parseInt(newMed.quantity) || 0,
          refills: parseInt(newMed.refills) || 0,
          prescriber: newMed.prescriber,
          pharmacy: newMed.pharmacy,
          start_date: newMed.start_date,
          status: newMed.status,
          fill_status: newMed.fill_status,
          source: 'Manual Entry'
        })
        .select()
        .single()

      if (error) throw error

      await fetchMedicationHistory()
      resetForm()
      setShowAddForm(false)
      onMedicationAdded?.()
    } catch (error) {
      console.error('Error adding medication:', error)
      alert('Failed to add medication')
    } finally {
      setSaving(false)
    }
  }

  // Update existing medication
  const handleUpdateMedication = async () => {
    if (!editingMed) return
    setSaving(true)
    
    try {
      const { error } = await supabase
        .from('medication_history')
        .update({
          medication_name: newMed.medication_name,
          dosage: newMed.dosage,
          route: newMed.route,
          sig: newMed.sig,
          quantity: parseInt(newMed.quantity) || 0,
          refills: parseInt(newMed.refills) || 0,
          prescriber: newMed.prescriber,
          pharmacy: newMed.pharmacy,
          start_date: newMed.start_date,
          status: newMed.status,
          fill_status: newMed.fill_status
        })
        .eq('id', editingMed.id)

      if (error) throw error

      await fetchMedicationHistory()
      resetForm()
      setEditingMed(null)
      onMedicationAdded?.()
    } catch (error) {
      console.error('Error updating medication:', error)
      alert('Failed to update medication')
    } finally {
      setSaving(false)
    }
  }

  // Delete medication
  const handleDeleteMedication = async (medId: string) => {
    if (!confirm('Are you sure you want to delete this medication record?')) return
    
    try {
      const { error } = await supabase
        .from('medication_history')
        .delete()
        .eq('id', medId)

      if (error) throw error

      await fetchMedicationHistory()
      onMedicationAdded?.()
    } catch (error) {
      console.error('Error deleting medication:', error)
      alert('Failed to delete medication')
    }
  }

  const startEdit = (med: MedicationHistoryItem) => {
    setEditingMed(med)
    setNewMed({
      medication_name: med.medication_name,
      dosage: med.dosage || '',
      route: med.route || 'oral',
      sig: med.sig || '',
      quantity: String(med.quantity || ''),
      refills: String(med.refills || '0'),
      prescriber: med.prescriber || '',
      pharmacy: med.pharmacy || '',
      start_date: med.start_date || new Date().toISOString().split('T')[0],
      status: med.status || 'active',
      fill_status: med.fill_status || 'Filled'
    })
    setShowAddForm(true)
  }

  const resetForm = () => {
    setNewMed({
      medication_name: '',
      dosage: '',
      route: 'oral',
      sig: '',
      quantity: '',
      refills: '0',
      prescriber: '',
      pharmacy: '',
      start_date: new Date().toISOString().split('T')[0],
      status: 'active',
      fill_status: 'Filled'
    })
    setEditingMed(null)
  }

  // Draggable handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true)
      const rect = panelRef.current?.getBoundingClientRect()
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        })
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: Math.max(0, e.clientX - dragOffset.x),
        y: Math.max(0, e.clientY - dragOffset.y)
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Selection handlers
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedMeds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedMeds(newSelected)
    updateFillHistory(id, !selectedMeds.has(id))
  }

  const selectAll = () => {
    const allIds = new Set(medications.map(m => m.id))
    setSelectedMeds(allIds)
  }

  const clearSelection = () => {
    setSelectedMeds(new Set())
    setFillHistory([])
    setInteractionAlert('')
  }

  const updateFillHistory = (medId: string, isSelected: boolean) => {
    const med = medications.find(m => m.id === medId)
    if (!med || !isSelected) {
      setFillHistory([])
      setInteractionAlert('')
      return
    }

    setFillHistory([
      {
        date: med.start_date || new Date().toISOString().split('T')[0],
        pharmacy: med.pharmacy?.split(',')[0] || 'Pharmacy',
        quantity: med.quantity || 90,
        status: med.fill_status || 'Filled'
      }
    ])

    if (med.flag === 'stop') {
      setInteractionAlert('⚠ Interaction risk: clarify with provider before co-administering.')
    } else if (med.flag === 'warn') {
      setInteractionAlert('Note: possible duplication with current active therapy.')
    } else {
      setInteractionAlert('')
    }
  }

  const checkInteractions = () => {
    const selectedMedications = medications.filter(m => selectedMeds.has(m.id))
    const hasStop = selectedMedications.some(m => m.flag === 'stop')
    const hasWarn = selectedMedications.some(m => m.flag === 'warn')

    if (hasStop) {
      setInteractionAlert('⚠ Interaction risk detected in current selection.')
    } else if (hasWarn) {
      setInteractionAlert('Note: potential duplication detected in selection.')
    } else {
      setInteractionAlert('No interactions flagged for current selection.')
    }
  }

  const copySelectedToChart = () => {
    const selectedMedications = medications.filter(m => selectedMeds.has(m.id))
    if (selectedMedications.length === 0) {
      alert('Select at least one medication.')
      return
    }
    if (onReconcile) {
      onReconcile(selectedMedications)
    }
    alert(`Copied ${selectedMedications.length} medication(s) to chart med list.`)
  }

  const reconcileToChart = async () => {
    const selectedMedications = medications.filter(m => selectedMeds.has(m.id))
    if (onReconcile) {
      onReconcile(selectedMedications.length > 0 ? selectedMedications : medications)
    }
    alert('Reconciled external meds to chart.')
  }

  const exportCSV = () => {
    const headers = ['Medication', 'Details', 'Prescriber', 'Pharmacy', 'DateWritten', 'Status']
    const rows = medications.map(m => [
      `${m.medication_name}${m.sig ? ` - Route: ${m.route} · Sig: ${m.sig}` : ''}`,
      `Qty ${m.quantity} · Refills ${m.refills}`,
      m.prescriber,
      m.pharmacy,
      m.start_date,
      m.fill_status
    ])
    
    const csv = [headers, ...rows].map(row => 
      row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `medication_history_surescripts.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredMedications = medications.filter(m =>
    m.medication_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.prescriber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.pharmacy?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  // Exact colors from reference: mint #19d67f, amber #f5a524, pink #ff7ad6
  const getFlagDotClass = (flag?: string) => {
    switch (flag) {
      case 'ok': return 'bg-[#19d67f]'    // mint
      case 'warn': return 'bg-[#f5a524]'  // amber
      case 'stop': return 'bg-[#ff7ad6]'  // pink
      default: return 'bg-gray-500'
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[60]"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Backdrop - reduced opacity so appointment content shows through */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      
      {/* Panel - using dynamic theme colors */}
      <div
        ref={panelRef}
        className="absolute overflow-hidden flex flex-col"
        style={{
          left: position.x,
          top: position.y,
          width: '1100px',
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 40px)',
          cursor: isDragging ? 'grabbing' : 'default',
          background: currentTheme.bg,
          borderRadius: '16px',
          boxShadow: `0 12px 60px ${currentTheme.glow}, inset 0 0 0 2px ${currentTheme.border}`
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Header - Dynamic theme */}
        <div 
          className="drag-handle sticky top-0 z-10 cursor-grab active:cursor-grabbing"
          style={{ 
            background: currentTheme.gradient, 
            backdropFilter: 'blur(8px)', 
            borderBottom: `2px solid ${currentTheme.border}`,
            padding: '10px 16px'
          }}
        >
          <div className="flex items-center gap-3">
            <GripHorizontal className="h-5 w-5" style={{ color: currentTheme.light }} />
            <div className="flex items-center gap-2">
              <div 
                className="w-5 h-5 rounded-full"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${currentTheme.light}, ${currentTheme.border} 40%, rgba(0,0,0,0.5) 70%)`,
                  boxShadow: `0 0 24px ${currentTheme.border}88, inset 0 0 10px ${currentTheme.light}33`
                }}
              />
              <span className="font-black text-white">Medazon — Medication History (Surescripts)</span>
            </div>
            {/* Patient pills */}
            <span 
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-medium"
              style={{ background: `${currentTheme.glow}`, border: `1px solid ${currentTheme.border}`, color: currentTheme.text }}
            >
              {patientName}
            </span>
            {patientDOB && (
              <span 
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-medium"
                style={{ background: `${currentTheme.glow}`, border: `1px solid ${currentTheme.border}`, color: currentTheme.text }}
              >
                DOB {formatDate(patientDOB)}
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="hover:text-white transition-colors p-2"
              style={{ color: currentTheme.light }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4" style={{ maxWidth: '1240px', margin: '0 auto' }}>
          {/* Filters Card */}
          <section 
            className="mb-3 p-3.5"
            style={{ 
              background: 'linear-gradient(180deg, #0d1424, #0b1222)',
              borderRadius: '16px',
              boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #1b2b4d'
            }}
          >
            <h2 className="text-[#e6f4ff] font-bold mb-2">
              Medication History <span className="text-xs font-normal text-[#98b1c9]">All external prescriptions pulled via Surescripts</span>
            </h2>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Left: Filters */}
              <div className="flex flex-wrap gap-2">
                {/* Range filter */}
                <span 
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full"
                  style={{ background: '#0a1732', border: '1px solid #1b2b4d', color: '#cfe1ff' }}
                >
                  Range:
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="bg-[#081226] border border-[#1b2b4d] rounded-lg text-[#d7eaff] px-2 py-1 text-xs"
                  >
                    <option value="12">12 months</option>
                    <option value="24">24 months</option>
                    <option value="all">All time</option>
                  </select>
                </span>
                {/* Status filter */}
                <span 
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full"
                  style={{ background: '#0a1732', border: '1px solid #1b2b4d', color: '#cfe1ff' }}
                >
                  Status:
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-[#081226] border border-[#1b2b4d] rounded-lg text-[#d7eaff] px-2 py-1 text-xs"
                  >
                    <option>All</option>
                    <option>Active</option>
                    <option>Discontinued</option>
                    <option>Completed</option>
                  </select>
                </span>
                {/* Form filter */}
                <span 
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full"
                  style={{ background: '#0a1732', border: '1px solid #1b2b4d', color: '#cfe1ff' }}
                >
                  Form:
                  <select
                    value={formFilter}
                    onChange={(e) => setFormFilter(e.target.value)}
                    className="bg-[#081226] border border-[#1b2b4d] rounded-lg text-[#d7eaff] px-2 py-1 text-xs"
                  >
                    <option>All</option>
                    <option value="oral">Oral</option>
                    <option value="topical">Topical</option>
                    <option value="injection">Injection</option>
                    <option value="ophthalmic">Ophthalmic</option>
                  </select>
                </span>
                {/* Fill status filter */}
                <span 
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full"
                  style={{ background: '#0a1732', border: '1px solid #1b2b4d', color: '#cfe1ff' }}
                >
                  Fill status:
                  <select
                    value={fillFilter}
                    onChange={(e) => setFillFilter(e.target.value)}
                    className="bg-[#081226] border border-[#1b2b4d] rounded-lg text-[#d7eaff] px-2 py-1 text-xs"
                  >
                    <option>All</option>
                    <option>Filled</option>
                    <option>Partially Filled</option>
                    <option>Not Filled</option>
                  </select>
                </span>
              </div>
              
              {/* Right: Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { resetForm(); setShowAddForm(true); }}
                  className="font-extrabold px-3.5 py-2.5 rounded-xl text-sm transition-transform hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(90deg, #00e6ff, #86f3ff)',
                    color: '#021018',
                    boxShadow: '0 0 0 2px #00e6ff33, 0 12px 60px rgba(0,0,0,.45)'
                  }}
                >
                  <Plus className="h-4 w-4 inline mr-1" />
                  Add
                </button>
                <button
                  onClick={exportCSV}
                  className="font-extrabold px-3.5 py-2.5 rounded-xl text-sm transition-transform hover:-translate-y-0.5"
                  style={{
                    background: '#0b1428',
                    color: '#cfe1ff',
                    border: '1px solid #1b2b4d'
                  }}
                >
                  Export CSV
                </button>
                <button
                  onClick={reconcileToChart}
                  className="font-extrabold px-3.5 py-2.5 rounded-xl text-sm transition-transform hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(90deg, #19d67f, #7ff0b7)',
                    color: '#061218',
                    boxShadow: '0 0 0 2px #19d67f33, 0 12px 60px rgba(0,0,0,.45)'
                  }}
                >
                  Reconcile to Chart
                </button>
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#19d67f]"></span>
                <span className="text-[#cfe1ff]">Safe / No alerts</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f5a524]"></span>
                <span className="text-[#cfe1ff]">Watch — potential duplication</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff7ad6]"></span>
                <span className="text-[#cfe1ff]">Interaction flag</span>
              </span>
            </div>
          </section>

          {/* Add/Edit Form */}
          {showAddForm && (
            <section 
              className="mb-3 p-3.5"
              style={{ 
                background: 'linear-gradient(180deg, #0d1424, #0b1222)',
                borderRadius: '16px',
                boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #00e6ff44'
              }}
            >
              <h3 className="text-[#e6f4ff] font-bold mb-3 flex items-center gap-2">
                {editingMed ? <Edit2 className="h-4 w-4 text-[#00e6ff]" /> : <Plus className="h-4 w-4 text-[#00e6ff]" />}
                {editingMed ? 'Edit Medication' : 'Add New Medication'}
              </h3>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="col-span-2">
                  <label className="text-xs text-[#98b1c9] mb-1 block">Medication Name *</label>
                  <input
                    type="text"
                    value={newMed.medication_name}
                    onChange={(e) => setNewMed(prev => ({ ...prev, medication_name: e.target.value }))}
                    placeholder="e.g., Atorvastatin 20 mg tablet"
                    className="w-full px-3 py-2.5 bg-[#081226] border border-[#1b2b4d] rounded-xl text-[#d7eaff] placeholder-[#98b1c9] text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#98b1c9] mb-1 block">Route</label>
                  <select
                    value={newMed.route}
                    onChange={(e) => setNewMed(prev => ({ ...prev, route: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#081226] border border-[#1b2b4d] rounded-xl text-[#d7eaff] text-sm"
                  >
                    <option value="oral">Oral</option>
                    <option value="topical">Topical</option>
                    <option value="injection">Injection</option>
                    <option value="ophthalmic">Ophthalmic</option>
                    <option value="inhaled">Inhaled</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#98b1c9] mb-1 block">Sig (Directions)</label>
                  <input
                    type="text"
                    value={newMed.sig}
                    onChange={(e) => setNewMed(prev => ({ ...prev, sig: e.target.value }))}
                    placeholder="e.g., 1 tab qHS"
                    className="w-full px-3 py-2.5 bg-[#081226] border border-[#1b2b4d] rounded-xl text-[#d7eaff] placeholder-[#98b1c9] text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#98b1c9] mb-1 block">Quantity</label>
                  <input
                    type="number"
                    value={newMed.quantity}
                    onChange={(e) => setNewMed(prev => ({ ...prev, quantity: e.target.value }))}
                    placeholder="90"
                    className="w-full px-3 py-2.5 bg-[#081226] border border-[#1b2b4d] rounded-xl text-[#d7eaff] placeholder-[#98b1c9] text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#98b1c9] mb-1 block">Refills</label>
                  <input
                    type="number"
                    value={newMed.refills}
                    onChange={(e) => setNewMed(prev => ({ ...prev, refills: e.target.value }))}
                    placeholder="3"
                    className="w-full px-3 py-2.5 bg-[#081226] border border-[#1b2b4d] rounded-xl text-[#d7eaff] placeholder-[#98b1c9] text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#98b1c9] mb-1 block">Prescriber</label>
                  <input
                    type="text"
                    value={newMed.prescriber}
                    onChange={(e) => setNewMed(prev => ({ ...prev, prescriber: e.target.value }))}
                    placeholder="Dr. Smith"
                    className="w-full px-3 py-2.5 bg-[#081226] border border-[#1b2b4d] rounded-xl text-[#d7eaff] placeholder-[#98b1c9] text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#98b1c9] mb-1 block">Pharmacy</label>
                  <input
                    type="text"
                    value={newMed.pharmacy}
                    onChange={(e) => setNewMed(prev => ({ ...prev, pharmacy: e.target.value }))}
                    placeholder="CVS #5531, Round Rock"
                    className="w-full px-3 py-2.5 bg-[#081226] border border-[#1b2b4d] rounded-xl text-[#d7eaff] placeholder-[#98b1c9] text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#98b1c9] mb-1 block">Date Written</label>
                  <input
                    type="date"
                    value={newMed.start_date}
                    onChange={(e) => setNewMed(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#081226] border border-[#1b2b4d] rounded-xl text-[#d7eaff] text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#98b1c9] mb-1 block">Status</label>
                  <select
                    value={newMed.status}
                    onChange={(e) => setNewMed(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#081226] border border-[#1b2b4d] rounded-xl text-[#d7eaff] text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="discontinued">Discontinued</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#98b1c9] mb-1 block">Fill Status</label>
                  <select
                    value={newMed.fill_status}
                    onChange={(e) => setNewMed(prev => ({ ...prev, fill_status: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#081226] border border-[#1b2b4d] rounded-xl text-[#d7eaff] text-sm"
                  >
                    <option value="Filled">Filled</option>
                    <option value="Partially Filled">Partially Filled</option>
                    <option value="Not Filled">Not Filled</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={editingMed ? handleUpdateMedication : handleAddMedication}
                  disabled={saving || !newMed.medication_name.trim()}
                  className="font-extrabold px-3.5 py-2.5 rounded-xl text-sm transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(90deg, #00e6ff, #86f3ff)',
                    color: '#021018',
                    boxShadow: '0 0 0 2px #00e6ff33, 0 12px 60px rgba(0,0,0,.45)'
                  }}
                >
                  {saving ? 'Saving...' : (editingMed ? 'Update Medication' : 'Add Medication')}
                </button>
                <button
                  onClick={() => { setShowAddForm(false); resetForm(); }}
                  className="font-extrabold px-3.5 py-2.5 rounded-xl text-sm transition-transform hover:-translate-y-0.5"
                  style={{
                    background: '#0b1428',
                    color: '#cfe1ff',
                    border: '1px solid #1b2b4d'
                  }}
                >
                  Cancel
                </button>
              </div>
            </section>
          )}

          {/* Main Grid: 1.7fr 1.3fr */}
          <div className="grid gap-3" style={{ gridTemplateColumns: '1.7fr 1.3fr' }}>
            {/* Left: External Medications Table */}
            <section 
              className="p-3.5"
              style={{ 
                background: 'linear-gradient(180deg, #0d1424, #0b1222)',
                borderRadius: '16px',
                boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #1b2b4d'
              }}
            >
              <h3 className="text-[#e6f4ff] font-bold mb-2">External Medications</h3>
              
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00e6ff] mx-auto mb-2"></div>
                  <p className="text-[#98b1c9] text-sm">Loading medication history...</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr style={{ background: '#0a1732' }}>
                        <th className="text-left text-xs text-[#cfe1ff] p-2 border-b border-[#1b2b4d]">Medication</th>
                        <th className="text-left text-xs text-[#cfe1ff] p-2 border-b border-[#1b2b4d]">Details</th>
                        <th className="text-left text-xs text-[#cfe1ff] p-2 border-b border-[#1b2b4d]">Prescriber</th>
                        <th className="text-left text-xs text-[#cfe1ff] p-2 border-b border-[#1b2b4d]">Pharmacy</th>
                        <th className="text-left text-xs text-[#cfe1ff] p-2 border-b border-[#1b2b4d]">Date Written</th>
                        <th className="text-left text-xs text-[#cfe1ff] p-2 border-b border-[#1b2b4d]">Status</th>
                        <th className="text-left text-xs text-[#cfe1ff] p-2 border-b border-[#1b2b4d]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMedications.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-[#98b1c9] text-sm">
                            No medication history found
                          </td>
                        </tr>
                      ) : (
                        filteredMedications.map((med) => (
                          <tr
                            key={med.id}
                            onClick={() => toggleSelection(med.id)}
                            className="cursor-pointer transition-colors hover:bg-white/5"
                            style={{
                              outline: selectedMeds.has(med.id) ? '1px solid #00e6ff' : 'none',
                              background: selectedMeds.has(med.id) ? 'rgba(0,230,255,0.05)' : 'transparent'
                            }}
                          >
                            <td className="p-2 border-b border-[#1b2b4d] align-top">
                              <div className="flex items-start gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${getFlagDotClass(med.flag)}`}></span>
                                <div>
                                  <div className="font-bold text-[#e6f4ff] text-sm">{med.medication_name}</div>
                                  <div className="text-xs text-[#98b1c9]">
                                    Route: {med.route} · Sig: {med.sig || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-2 border-b border-[#1b2b4d] text-sm text-[#e6f4ff] align-top">
                              Qty {med.quantity} · Refills {med.refills}
                            </td>
                            <td className="p-2 border-b border-[#1b2b4d] text-sm text-[#e6f4ff] align-top">{med.prescriber}</td>
                            <td className="p-2 border-b border-[#1b2b4d] text-sm text-[#e6f4ff] align-top">{med.pharmacy}</td>
                            <td className="p-2 border-b border-[#1b2b4d] text-sm text-[#e6f4ff] align-top">{formatDate(med.start_date)}</td>
                            <td className="p-2 border-b border-[#1b2b4d] align-top">
                              <span 
                                className="inline-flex px-2 py-0.5 text-xs rounded-full"
                                style={{ background: '#0a1732', border: '1px solid #1b2b4d' }}
                              >
                                {med.fill_status}
                              </span>
                            </td>
                            <td className="p-2 border-b border-[#1b2b4d] align-top">
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => startEdit(med)}
                                  className="p-1.5 text-[#98b1c9] hover:text-[#00e6ff] transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMedication(med.id)}
                                  className="p-1.5 text-[#98b1c9] hover:text-[#ff7ad6] transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer Actions */}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={selectAll}
                  className="font-extrabold px-3.5 py-2.5 rounded-xl text-sm transition-transform hover:-translate-y-0.5"
                  style={{
                    background: '#0b1428',
                    color: '#cfe1ff',
                    border: '1px solid #1b2b4d'
                  }}
                >
                  Select All
                </button>
                <button
                  onClick={copySelectedToChart}
                  className="font-extrabold px-3.5 py-2.5 rounded-xl text-sm transition-transform hover:-translate-y-0.5"
                  style={{
                    background: '#0b1428',
                    color: '#cfe1ff',
                    border: '1px solid #1b2b4d'
                  }}
                >
                  Copy Selected to Chart
                </button>
                <button
                  onClick={checkInteractions}
                  className="font-extrabold px-3.5 py-2.5 rounded-xl text-sm transition-transform hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(90deg, #f5a524, #ffd07a)',
                    color: '#061218',
                    boxShadow: '0 0 0 2px #f5a52433, 0 12px 60px rgba(0,0,0,.45)'
                  }}
                >
                  Run Interaction Check
                </button>
              </div>
            </section>

            {/* Right: Fill History & Interactions */}
            <aside 
              className="p-3.5"
              style={{ 
                background: 'linear-gradient(180deg, #0d1424, #0b1222)',
                borderRadius: '16px',
                boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #1b2b4d'
              }}
            >
              <h3 className="text-[#e6f4ff] font-bold mb-2">Fill History (Selected)</h3>
              <div className="overflow-x-auto mb-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ background: '#0a1732' }}>
                      <th className="text-left text-xs text-[#cfe1ff] p-2 border-b border-[#1b2b4d]">Date</th>
                      <th className="text-left text-xs text-[#cfe1ff] p-2 border-b border-[#1b2b4d]">Pharmacy</th>
                      <th className="text-left text-xs text-[#cfe1ff] p-2 border-b border-[#1b2b4d]">Qty</th>
                      <th className="text-left text-xs text-[#cfe1ff] p-2 border-b border-[#1b2b4d]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fillHistory.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-[#98b1c9] text-xs">
                          Select a medication to view fill history
                        </td>
                      </tr>
                    ) : (
                      fillHistory.map((fill, idx) => (
                        <tr key={idx}>
                          <td className="p-2 border-b border-[#1b2b4d] text-sm text-[#e6f4ff]">{formatDate(fill.date)}</td>
                          <td className="p-2 border-b border-[#1b2b4d] text-sm text-[#e6f4ff]">{fill.pharmacy}</td>
                          <td className="p-2 border-b border-[#1b2b4d] text-sm text-[#e6f4ff]">{fill.quantity}</td>
                          <td className="p-2 border-b border-[#1b2b4d] text-sm text-[#e6f4ff]">{fill.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <h3 className="text-[#e6f4ff] font-bold mb-2">Interaction Alerts</h3>
              <p className="text-xs text-[#98b1c9] mb-4">
                {interactionAlert || 'No interactions flagged for current selection.'}
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  className="font-extrabold px-3.5 py-2.5 rounded-xl text-sm transition-transform hover:-translate-y-0.5"
                  style={{
                    background: '#0b1428',
                    color: '#cfe1ff',
                    border: '1px solid #1b2b4d'
                  }}
                >
                  Open Problems Page
                </button>
                <button
                  className="font-extrabold px-3.5 py-2.5 rounded-xl text-sm transition-transform hover:-translate-y-0.5"
                  style={{
                    background: '#0b1428',
                    color: '#cfe1ff',
                    border: '1px solid #1b2b4d'
                  }}
                >
                  Open Prescriptions
                </button>
              </div>
            </aside>
          </div>
        </div>

        {/* Footer with Save Status and Color Theme Selector */}
        <div 
          className="sticky bottom-0 p-3 border-t flex items-center justify-between"
          style={{ 
            background: 'rgba(0,0,0,0.5)', 
            backdropFilter: 'blur(8px)',
            borderColor: currentTheme.border 
          }}
        >
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">Panel Theme:</span>
            {/* Save Status Indicator */}
            <span className={`text-xs flex items-center gap-1 ${
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
          <div className="flex items-center gap-1.5">
            {(Object.keys(themeColors) as Array<keyof typeof themeColors>).map((color) => (
              <button
                key={color}
                onClick={() => setPanelTheme(color)}
                className={`w-6 h-6 rounded-full transition-all hover:scale-110 ${panelTheme === color ? 'ring-2 ring-white ring-offset-1 ring-offset-black scale-110' : ''}`}
                style={{ background: themeColors[color].gradient }}
                title={color.charAt(0).toUpperCase() + color.slice(1)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}









