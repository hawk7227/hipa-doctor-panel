// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  X, Plus, Search, Download, Edit2, Trash2, GripHorizontal, 
  FileText, Clock, CheckCircle, XCircle, AlertTriangle, Send, Printer,
  RefreshCw, Building2, Calendar, Filter, Pill, RotateCcw, Ban,
  ThumbsUp, ThumbsDown, History, ClipboardCheck, Phone
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// =============================================================================
// INTERFACES
// =============================================================================

interface Prescription {
  id: string
  patient_id: string
  medication_name: string
  dosage?: string
  sig?: string
  quantity?: number
  refills?: number
  refills_remaining?: number
  pharmacy_name?: string
  pharmacy_phone?: string
  pharmacy_address?: string
  prescriber?: string
  date_written?: string
  date_filled?: string
  date_discontinued?: string
  status: 'draft' | 'sent' | 'pending' | 'filled' | 'refill_pending' | 'completed' | 'discontinued' | 'rejected' | 'cancelled'
  rejection_reason?: string
  ndc_code?: string
  dea_schedule?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

interface PrescriptionLog {
  id: string
  prescription_id?: string
  action: string
  description: string
  pharmacy?: string
  status?: string
  user?: string
  timestamp: string
}

interface PrescriptionHistoryPanelProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName: string
  appointmentId?: string
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-700 text-gray-300', icon: FileText },
  { value: 'sent', label: 'Sent', color: 'bg-blue-900/50 text-blue-400', icon: Send },
  { value: 'pending', label: 'Pending', color: 'bg-yellow-900/50 text-yellow-400', icon: Clock },
  { value: 'filled', label: 'Filled', color: 'bg-green-900/50 text-green-400', icon: CheckCircle },
  { value: 'refill_pending', label: 'Refill Pending', color: 'bg-orange-900/50 text-orange-400', icon: RotateCcw },
  { value: 'completed', label: 'Completed', color: 'bg-gray-600 text-gray-300', icon: CheckCircle },
  { value: 'discontinued', label: 'Discontinued', color: 'bg-gray-700 text-gray-400', icon: Ban },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-900/50 text-red-400', icon: XCircle },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-700 text-gray-500', icon: XCircle }
]

const COMMON_MEDICATIONS = [
  'Metformin 500mg',
  'Metformin 1000mg',
  'Lisinopril 10mg',
  'Lisinopril 20mg',
  'Atorvastatin 20mg',
  'Atorvastatin 40mg',
  'Amlodipine 5mg',
  'Amlodipine 10mg',
  'Omeprazole 20mg',
  'Levothyroxine 50mcg',
  'Metoprolol 25mg',
  'Metoprolol 50mg',
  'Losartan 50mg',
  'Gabapentin 300mg',
  'Sertraline 50mg',
  'Escitalopram 10mg',
  'Tramadol 50mg',
  'Hydrocodone/APAP 5/325mg',
  'Prednisone 10mg',
  'Amoxicillin 500mg',
  'Azithromycin 250mg (Z-Pack)',
  'Ciprofloxacin 500mg'
]

const COMMON_SIGS = [
  '1 tab PO daily',
  '1 tab PO BID',
  '1 tab PO TID',
  '1 tab PO QID',
  '1 tab PO at bedtime',
  '1 tab PO PRN',
  '2 tabs PO daily',
  '1 cap PO daily',
  '1 cap PO BID',
  'Apply topically BID',
  '1 puff INH BID',
  '2 puffs INH PRN'
]

const COMMON_PHARMACIES = [
  'CVS Pharmacy',
  'Walgreens',
  'Walmart Pharmacy',
  'Rite Aid',
  'Publix Pharmacy',
  'Kroger Pharmacy',
  'Costco Pharmacy',
  'Amazon Pharmacy'
]

// =============================================================================
// COMPONENT
// =============================================================================

export default function PrescriptionHistoryPanel({
  isOpen,
  onClose,
  patientId,
  patientName,
  appointmentId
}: PrescriptionHistoryPanelProps) {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  
  // Data
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [logs, setLogs] = useState<PrescriptionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // UI State
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPharmacy, setFilterPharmacy] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)
  const [auditInfo, setAuditInfo] = useState<string | null>(null)
  
  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Panel theme colors
  const [panelTheme, setPanelTheme] = useState<'purple' | 'blue' | 'cyan' | 'teal' | 'green' | 'orange' | 'red' | 'pink'>('teal')
  
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
    sig: '',
    quantity: '30',
    refills: '0',
    pharmacy_name: '',
    pharmacy_phone: '',
    status: 'draft',
    dea_schedule: '',
    notes: ''
  })
  
  // Draggable State
  const [position, setPosition] = useState({ x: 60, y: 30 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // DATA FETCHING
  // ---------------------------------------------------------------------------
  
  const fetchPrescriptions = async () => {
    setLoading(true)
    setError(null)
    
    console.log('Fetching prescriptions for patient:', patientId)
    
    try {
      const { data, error: queryError } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
      
      console.log('Prescriptions query result:', { data, queryError })
      
      if (queryError) {
        setError(queryError.message)
        return
      }
      
      setPrescriptions(data || [])
      
      // Generate logs from prescriptions
      const generatedLogs: PrescriptionLog[] = (data || []).map(rx => ({
        id: rx.id,
        prescription_id: rx.id,
        action: rx.status === 'sent' ? 'Sent' : rx.status === 'rejected' ? 'Rejected' : 'Created',
        description: `${rx.medication_name} #${rx.quantity || 0}`,
        pharmacy: rx.pharmacy_name,
        status: rx.status,
        timestamp: rx.created_at || new Date().toISOString()
      }))
      setLogs(generatedLogs)
      
    } catch (err) {
      console.error('Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch prescriptions')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    if (isOpen && patientId) {
      fetchPrescriptions()
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
    
    console.log('Adding prescription:', formData)
    
    try {
      const { data, error: insertError } = await supabase
        .from('prescriptions')
        .insert({
          patient_id: patientId,
          medication_name: formData.medication_name,
          dosage: formData.dosage || null,
          sig: formData.sig || null,
          quantity: parseInt(formData.quantity) || 30,
          refills: parseInt(formData.refills) || 0,
          refills_remaining: parseInt(formData.refills) || 0,
          pharmacy_name: formData.pharmacy_name || null,
          pharmacy_phone: formData.pharmacy_phone || null,
          status: formData.status,
          dea_schedule: formData.dea_schedule || null,
          notes: formData.notes || null,
          date_written: new Date().toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      console.log('Insert result:', { data, insertError })
      
      if (insertError) {
        setError(insertError.message)
        return
      }
      
      await fetchPrescriptions()
      resetForm()
      setShowAddForm(false)
      setSaveStatus('saved')
      setLastSaved(new Date())
      addLog('Created', `New Rx: ${formData.medication_name}`, formData.pharmacy_name)
      
    } catch (err) {
      console.error('Add error:', err)
      setError(err instanceof Error ? err.message : 'Failed to add prescription')
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
    
    console.log('Updating prescription:', editingId, formData)
    
    try {
      const { error: updateError } = await supabase
        .from('prescriptions')
        .update({
          medication_name: formData.medication_name,
          dosage: formData.dosage || null,
          sig: formData.sig || null,
          quantity: parseInt(formData.quantity) || 30,
          refills: parseInt(formData.refills) || 0,
          pharmacy_name: formData.pharmacy_name || null,
          pharmacy_phone: formData.pharmacy_phone || null,
          status: formData.status,
          dea_schedule: formData.dea_schedule || null,
          notes: formData.notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingId)
      
      console.log('Update result:', { updateError })
      
      if (updateError) {
        setError(updateError.message)
        return
      }
      
      await fetchPrescriptions()
      resetForm()
      setEditingId(null)
      setSaveStatus('saved')
      setLastSaved(new Date())
      
    } catch (err) {
      console.error('Update error:', err)
      setError(err instanceof Error ? err.message : 'Failed to update prescription')
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }
  
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prescription?')) {
      return
    }
    
    setError(null)
    
    console.log('Deleting prescription:', id)
    
    try {
      const { error: deleteError } = await supabase
        .from('prescriptions')
        .delete()
        .eq('id', id)
      
      console.log('Delete result:', { deleteError })
      
      if (deleteError) {
        setError(deleteError.message)
        return
      }
      
      await fetchPrescriptions()
      if (selectedPrescription?.id === id) {
        setSelectedPrescription(null)
      }
      
    } catch (err) {
      console.error('Delete error:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete prescription')
    }
  }

  // ---------------------------------------------------------------------------
  // PRESCRIPTION ACTIONS
  // ---------------------------------------------------------------------------
  
  const handleSendRx = async (rx: Prescription) => {
    try {
      const { error: updateError } = await supabase
        .from('prescriptions')
        .update({
          status: 'sent',
          updated_at: new Date().toISOString()
        })
        .eq('id', rx.id)
      
      if (updateError) {
        setError(updateError.message)
        return
      }
      
      await fetchPrescriptions()
      addLog('Sent', rx.medication_name, rx.pharmacy_name)
      setSaveStatus('saved')
      setLastSaved(new Date())
      
    } catch (err) {
      console.error('Send error:', err)
      setError(err instanceof Error ? err.message : 'Failed to send prescription')
    }
  }
  
  const handleRenew = async (rx: Prescription) => {
    // Create a copy as a new prescription
    try {
      const { data, error: insertError } = await supabase
        .from('prescriptions')
        .insert({
          patient_id: patientId,
          medication_name: rx.medication_name,
          dosage: rx.dosage,
          sig: rx.sig,
          quantity: rx.quantity,
          refills: rx.refills,
          refills_remaining: rx.refills,
          pharmacy_name: rx.pharmacy_name,
          pharmacy_phone: rx.pharmacy_phone,
          status: 'draft',
          dea_schedule: rx.dea_schedule,
          notes: rx.notes,
          date_written: new Date().toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (insertError) {
        setError(insertError.message)
        return
      }
      
      await fetchPrescriptions()
      addLog('Renewed', rx.medication_name, rx.pharmacy_name)
      setSaveStatus('saved')
      setLastSaved(new Date())
      
    } catch (err) {
      console.error('Renew error:', err)
      setError(err instanceof Error ? err.message : 'Failed to renew prescription')
    }
  }
  
  const handleDiscontinue = async (rx: Prescription) => {
    if (!confirm(`Discontinue ${rx.medication_name}?`)) return
    
    try {
      const { error: updateError } = await supabase
        .from('prescriptions')
        .update({
          status: 'discontinued',
          date_discontinued: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', rx.id)
      
      if (updateError) {
        setError(updateError.message)
        return
      }
      
      await fetchPrescriptions()
      addLog('Discontinued', rx.medication_name, rx.pharmacy_name)
      
    } catch (err) {
      console.error('Discontinue error:', err)
      setError(err instanceof Error ? err.message : 'Failed to discontinue prescription')
    }
  }
  
  const handleApproveRefill = async (rx: Prescription) => {
    try {
      const { error: updateError } = await supabase
        .from('prescriptions')
        .update({
          status: 'sent',
          refills_remaining: Math.max(0, (rx.refills_remaining || 0) - 1),
          updated_at: new Date().toISOString()
        })
        .eq('id', rx.id)
      
      if (updateError) {
        setError(updateError.message)
        return
      }
      
      await fetchPrescriptions()
      addLog('Refill Approved', rx.medication_name, rx.pharmacy_name)
      setSaveStatus('saved')
      setLastSaved(new Date())
      
    } catch (err) {
      console.error('Approve refill error:', err)
      setError(err instanceof Error ? err.message : 'Failed to approve refill')
    }
  }
  
  const handleRejectRefill = async (rx: Prescription) => {
    const reason = prompt('Rejection reason:', 'Unable to approve at this time')
    if (!reason) return
    
    try {
      const { error: updateError } = await supabase
        .from('prescriptions')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', rx.id)
      
      if (updateError) {
        setError(updateError.message)
        return
      }
      
      await fetchPrescriptions()
      addLog('Refill Rejected', rx.medication_name, rx.pharmacy_name)
      setAuditInfo(`Refill Rejected\nReason: ${reason}\nTime: ${new Date().toLocaleString()}`)
      
    } catch (err) {
      console.error('Reject refill error:', err)
      setError(err instanceof Error ? err.message : 'Failed to reject refill')
    }
  }
  
  const handleResend = async (rx: Prescription) => {
    alert(`Resending ${rx.medication_name} to ${rx.pharmacy_name || 'pharmacy'}`)
    addLog('Resent', rx.medication_name, rx.pharmacy_name)
  }
  
  const handlePrintFax = (rx: Prescription) => {
    alert(`Generating PDF for ${rx.medication_name} - Print/Fax to ${rx.pharmacy_name || 'pharmacy'}`)
    addLog('Print/Fax', rx.medication_name, rx.pharmacy_name)
  }
  
  const addLog = (action: string, description: string, pharmacy?: string | null) => {
    const newLog: PrescriptionLog = {
      id: Date.now().toString(),
      action,
      description,
      pharmacy: pharmacy || undefined,
      timestamp: new Date().toISOString()
    }
    setLogs(prev => [newLog, ...prev])
  }

  // ---------------------------------------------------------------------------
  // AUTO-SAVE (2 second debounce after typing stops)
  // ---------------------------------------------------------------------------
  
  const autoSaveEdit = async () => {
    if (!editingId || !formData.medication_name.trim()) return
    
    setSaveStatus('saving')
    
    try {
      const { error: updateError } = await supabase
        .from('prescriptions')
        .update({
          medication_name: formData.medication_name,
          dosage: formData.dosage || null,
          sig: formData.sig || null,
          quantity: parseInt(formData.quantity) || 30,
          refills: parseInt(formData.refills) || 0,
          pharmacy_name: formData.pharmacy_name || null,
          pharmacy_phone: formData.pharmacy_phone || null,
          status: formData.status,
          notes: formData.notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingId)
      
      if (updateError) {
        setSaveStatus('error')
        console.error('Auto-save error:', updateError)
        return
      }
      
      setSaveStatus('saved')
      setLastSaved(new Date())
      console.log('Auto-saved prescription at', new Date().toLocaleTimeString())
      
      fetchPrescriptions()
      
    } catch (err) {
      setSaveStatus('error')
      console.error('Auto-save error:', err)
    }
  }
  
  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    if (editingId) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
      
      autoSaveTimerRef.current = setTimeout(() => {
        autoSaveEdit()
      }, 2000)
    }
  }
  
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
      sig: '',
      quantity: '30',
      refills: '0',
      pharmacy_name: '',
      pharmacy_phone: '',
      status: 'draft',
      dea_schedule: '',
      notes: ''
    })
  }
  
  const startEdit = (rx: Prescription) => {
    setFormData({
      medication_name: rx.medication_name || '',
      dosage: rx.dosage || '',
      sig: rx.sig || '',
      quantity: rx.quantity?.toString() || '30',
      refills: rx.refills?.toString() || '0',
      pharmacy_name: rx.pharmacy_name || '',
      pharmacy_phone: rx.pharmacy_phone || '',
      status: rx.status || 'draft',
      dea_schedule: rx.dea_schedule || '',
      notes: rx.notes || ''
    })
    setEditingId(rx.id)
    setShowAddForm(true)
  }
  
  const cancelEdit = () => {
    resetForm()
    setEditingId(null)
    setShowAddForm(false)
  }
  
  const copyToNew = (rx: Prescription) => {
    setFormData({
      medication_name: rx.medication_name || '',
      dosage: rx.dosage || '',
      sig: rx.sig || '',
      quantity: rx.quantity?.toString() || '30',
      refills: rx.refills?.toString() || '0',
      pharmacy_name: rx.pharmacy_name || '',
      pharmacy_phone: rx.pharmacy_phone || '',
      status: 'draft',
      dea_schedule: rx.dea_schedule || '',
      notes: rx.notes || ''
    })
    setEditingId(null)
    setShowAddForm(true)
  }

  // ---------------------------------------------------------------------------
  // FILTERING
  // ---------------------------------------------------------------------------
  
  const filteredPrescriptions = prescriptions.filter(rx => {
    const matchesSearch = rx.medication_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          rx.pharmacy_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || rx.status === filterStatus
    const matchesPharmacy = !filterPharmacy || rx.pharmacy_name?.toLowerCase().includes(filterPharmacy.toLowerCase())
    return matchesSearch && matchesStatus && matchesPharmacy
  })
  
  // Separate active and past prescriptions
  const activePrescriptions = filteredPrescriptions.filter(rx => 
    ['draft', 'sent', 'pending', 'filled', 'refill_pending'].includes(rx.status)
  )
  const pastPrescriptions = filteredPrescriptions.filter(rx => 
    ['completed', 'discontinued', 'rejected', 'cancelled'].includes(rx.status)
  )

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }
  
  const getStatusConfig = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]
  }
  
  const exportCSV = () => {
    const rows = [['Type', 'Medication', 'Sig', 'Qty', 'Refills', 'Pharmacy', 'Date', 'Status']]
    activePrescriptions.forEach(rx => {
      rows.push(['Active', rx.medication_name, rx.sig || '', rx.quantity?.toString() || '', rx.refills?.toString() || '', rx.pharmacy_name || '', rx.date_written || '', rx.status])
    })
    pastPrescriptions.forEach(rx => {
      rows.push(['Past', rx.medication_name, rx.sig || '', rx.quantity?.toString() || '', rx.refills?.toString() || '', rx.pharmacy_name || '', rx.date_written || '', rx.status])
    })
    const csv = rows.map(r => r.map(x => `"${String(x || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `prescriptions_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // ---------------------------------------------------------------------------
  // DRAGGING
  // ---------------------------------------------------------------------------
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
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
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      
      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed z-[60] rounded-xl shadow-2xl flex flex-col"
        style={{
          left: position.x,
          top: position.y,
          width: '1100px',
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: '90vh',
          background: currentTheme.bg,
          boxShadow: `0 12px 60px ${currentTheme.glow}, inset 0 0 0 2px ${currentTheme.border}`
        }}
      >
        {/* Header */}
        <div
          className="drag-handle flex items-center justify-between p-4 cursor-move rounded-t-xl"
          style={{
            background: currentTheme.gradient,
            borderBottom: `2px solid ${currentTheme.border}`
          }}
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-3">
            <GripHorizontal className="h-5 w-5" style={{ color: currentTheme.light }} />
            <div className="p-2 bg-white/20 rounded-lg">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Prescriptions</h2>
              <p className="text-xs" style={{ color: currentTheme.light }}>{patientName} • Active/Past Orders by this practice</p>
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
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => { resetForm(); setShowAddForm(true); setEditingId(null); }}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors text-sm font-medium"
                style={{ background: 'linear-gradient(90deg, #14b8a6, #5eead4)' }}
              >
                <Plus className="h-4 w-4" />
                New eRx
              </button>
              
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-[#1b2b4d] hover:bg-[#243656] text-gray-300 rounded-lg transition-colors text-sm"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              
              <button
                onClick={fetchPrescriptions}
                className="flex items-center gap-2 px-4 py-2 bg-[#1b2b4d] hover:bg-[#243656] text-gray-300 rounded-lg transition-colors text-sm"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-sm">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent text-white text-sm focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="refill_pending">Refill Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-sm">
              <Building2 className="h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search pharmacy..."
                value={filterPharmacy}
                onChange={(e) => setFilterPharmacy(e.target.value)}
                className="bg-transparent text-white text-sm focus:outline-none w-32"
              />
            </div>
            
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search medications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}
          
          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="mb-4 p-4 bg-[#0d1424] border border-[#1b2b4d] rounded-xl">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Pill className="h-5 w-5 text-teal-400" />
                {editingId ? 'Edit Prescription' : 'New eRx'}
              </h3>
              
              <div className="grid grid-cols-3 gap-4">
                {/* Medication Name */}
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Medication *</label>
                  <input
                    type="text"
                    value={formData.medication_name}
                    onChange={(e) => handleFormChange('medication_name', e.target.value)}
                    placeholder="e.g., Metformin 500mg"
                    list="common-meds"
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm"
                  />
                  <datalist id="common-meds">
                    {COMMON_MEDICATIONS.map(m => <option key={m} value={m} />)}
                  </datalist>
                </div>
                
                {/* Sig */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Sig</label>
                  <input
                    type="text"
                    value={formData.sig}
                    onChange={(e) => handleFormChange('sig', e.target.value)}
                    placeholder="e.g., 1 tab PO BID"
                    list="common-sigs"
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm"
                  />
                  <datalist id="common-sigs">
                    {COMMON_SIGS.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
                
                {/* Quantity */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => handleFormChange('quantity', e.target.value)}
                    placeholder="30"
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm"
                  />
                </div>
                
                {/* Refills */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Refills</label>
                  <input
                    type="number"
                    value={formData.refills}
                    onChange={(e) => handleFormChange('refills', e.target.value)}
                    placeholder="0"
                    min="0"
                    max="11"
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm"
                  />
                </div>
                
                {/* Status */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleFormChange('status', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm"
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                
                {/* Pharmacy */}
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Pharmacy</label>
                  <input
                    type="text"
                    value={formData.pharmacy_name}
                    onChange={(e) => handleFormChange('pharmacy_name', e.target.value)}
                    placeholder="e.g., CVS Pharmacy #35731"
                    list="common-pharmacies"
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm"
                  />
                  <datalist id="common-pharmacies">
                    {COMMON_PHARMACIES.map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>
                
                {/* Pharmacy Phone */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Pharmacy Phone</label>
                  <input
                    type="tel"
                    value={formData.pharmacy_phone}
                    onChange={(e) => handleFormChange('pharmacy_phone', e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm"
                  />
                </div>
                
                {/* Notes */}
                <div className="col-span-3">
                  <label className="block text-sm text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    placeholder="Special instructions..."
                    rows={2}
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm resize-none"
                  />
                </div>
              </div>
              
              {/* Form Actions */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={editingId ? handleUpdate : handleAdd}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                  style={{ background: 'linear-gradient(90deg, #14b8a6, #5eead4)' }}
                >
                  {saving ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    <>{editingId ? 'Update' : 'Create'} Prescription</>
                  )}
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 bg-[#1b2b4d] hover:bg-[#243656] text-gray-300 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          
          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin h-8 w-8 border-2 border-teal-400 border-t-transparent rounded-full"></div>
                <span className="text-gray-400 text-sm">Loading prescriptions...</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-4">
              {/* Left Column: Active + Past Orders */}
              <div className="col-span-3 space-y-4">
                {/* Active Orders */}
                <div className="bg-[#0d1424] border border-[#1b2b4d] rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-teal-400" />
                    Active Orders ({activePrescriptions.length})
                  </h3>
                  
                  {activePrescriptions.length === 0 ? (
                    <p className="text-gray-500 text-sm py-4 text-center">No active prescriptions</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#1b2b4d]">
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Medication</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Sig</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Pharmacy</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Date</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Status</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activePrescriptions.map(rx => {
                            const statusConfig = getStatusConfig(rx.status)
                            
                            return (
                              <tr 
                                key={rx.id} 
                                className="border-b border-[#1b2b4d] hover:bg-[#0a1628] cursor-pointer"
                                onClick={() => {
                                  setSelectedPrescription(rx)
                                  setAuditInfo(null)
                                }}
                              >
                                <td className="py-2 px-2">
                                  <span className="text-white font-medium">{rx.medication_name}</span>
                                  {rx.quantity && <span className="text-gray-500 text-xs ml-1">#{rx.quantity}</span>}
                                </td>
                                <td className="py-2 px-2 text-gray-400">{rx.sig || '—'}</td>
                                <td className="py-2 px-2 text-gray-400 text-xs">{rx.pharmacy_name || '—'}</td>
                                <td className="py-2 px-2 text-gray-500 text-xs">
                                  {rx.date_written ? formatDate(rx.date_written) : '—'}
                                </td>
                                <td className="py-2 px-2">
                                  <span className={`px-2 py-0.5 rounded text-xs ${statusConfig.color}`}>
                                    {statusConfig.label}
                                  </span>
                                </td>
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
                                    {rx.status === 'refill_pending' ? (
                                      <>
                                        <button
                                          onClick={() => handleApproveRefill(rx)}
                                          className="px-2 py-1 text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => handleRejectRefill(rx)}
                                          className="px-2 py-1 text-xs bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        {rx.status === 'draft' && (
                                          <button
                                            onClick={() => handleSendRx(rx)}
                                            className="px-2 py-1 text-xs bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 rounded"
                                          >
                                            Send
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleRenew(rx)}
                                          className="px-2 py-1 text-xs bg-[#1b2b4d] hover:bg-[#243656] text-gray-300 rounded"
                                        >
                                          Renew
                                        </button>
                                        <button
                                          onClick={() => handleDiscontinue(rx)}
                                          className="px-2 py-1 text-xs bg-[#1b2b4d] hover:bg-[#243656] text-gray-300 rounded"
                                        >
                                          D/C
                                        </button>
                                        <button
                                          onClick={() => handleResend(rx)}
                                          className="px-2 py-1 text-xs bg-[#1b2b4d] hover:bg-[#243656] text-gray-300 rounded"
                                        >
                                          Resend
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                
                {/* Past Orders */}
                <div className="bg-[#0d1424] border border-[#1b2b4d] rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <History className="h-4 w-4 text-gray-400" />
                    Past Orders ({pastPrescriptions.length})
                  </h3>
                  
                  {pastPrescriptions.length === 0 ? (
                    <p className="text-gray-500 text-sm py-4 text-center">No past prescriptions</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#1b2b4d]">
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Medication</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Sig</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Pharmacy</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Date</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Closed</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pastPrescriptions.slice(0, 10).map(rx => {
                            const statusConfig = getStatusConfig(rx.status)
                            
                            return (
                              <tr 
                                key={rx.id} 
                                className="border-b border-[#1b2b4d] hover:bg-[#0a1628] cursor-pointer"
                                onClick={() => {
                                  setSelectedPrescription(rx)
                                  setAuditInfo(null)
                                }}
                              >
                                <td className="py-2 px-2 text-gray-300">{rx.medication_name}</td>
                                <td className="py-2 px-2 text-gray-500">{rx.sig || '—'}</td>
                                <td className="py-2 px-2 text-gray-500 text-xs">{rx.pharmacy_name || '—'}</td>
                                <td className="py-2 px-2 text-gray-500 text-xs">
                                  {rx.date_written ? formatDate(rx.date_written) : '—'}
                                </td>
                                <td className="py-2 px-2">
                                  <span className={`px-2 py-0.5 rounded text-xs ${statusConfig.color}`}>
                                    {statusConfig.label}
                                  </span>
                                </td>
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <button
                                      onClick={() => copyToNew(rx)}
                                      className="px-2 py-1 text-xs bg-[#1b2b4d] hover:bg-[#243656] text-gray-300 rounded"
                                    >
                                      Copy to New
                                    </button>
                                    <button
                                      onClick={() => handleDelete(rx.id)}
                                      className="p-1 hover:bg-red-900/30 rounded text-gray-400"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Right Column: Logs + Audit */}
              <div className="col-span-2 space-y-4">
                {/* Prescription Logs */}
                <div className="bg-[#0d1424] border border-[#1b2b4d] rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-cyan-400" />
                    Prescription Logs
                  </h3>
                  
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#1b2b4d]">
                          <th className="text-left py-2 px-2 text-gray-400 font-medium">Date</th>
                          <th className="text-left py-2 px-2 text-gray-400 font-medium">Description</th>
                          <th className="text-left py-2 px-2 text-gray-400 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.slice(0, 15).map(log => (
                          <tr 
                            key={log.id} 
                            className="border-b border-[#1b2b4d] hover:bg-[#0a1628] cursor-pointer"
                            onClick={() => setAuditInfo(`Action: ${log.action}\nDescription: ${log.description}\nPharmacy: ${log.pharmacy || 'N/A'}\nTimestamp: ${new Date(log.timestamp).toLocaleString()}`)}
                          >
                            <td className="py-2 px-2 text-gray-500">{formatDate(log.timestamp)}</td>
                            <td className="py-2 px-2 text-gray-300">{log.description}</td>
                            <td className="py-2 px-2">
                              <span className="px-2 py-0.5 rounded bg-[#0a1732] border border-[#1b2b4d] text-gray-300">
                                {log.action}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* Rejection & Audit */}
                <div className="bg-[#0d1424] border border-[#1b2b4d] rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    Rejection & Audit
                  </h3>
                  
                  {auditInfo ? (
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap bg-[#0a1628] p-3 rounded-lg">
                      {auditInfo}
                    </pre>
                  ) : selectedPrescription?.rejection_reason ? (
                    <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
                      <p className="text-red-400 text-xs font-semibold">Rejection Reason:</p>
                      <p className="text-red-300 text-sm mt-1">{selectedPrescription.rejection_reason}</p>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      Select a log entry or prescription to see audit details.
                    </p>
                  )}
                </div>
                
                {/* Selected Rx Details */}
                {selectedPrescription && (
                  <div className="bg-[#0d1424] border border-[#1b2b4d] rounded-xl p-4">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Pill className="h-4 w-4 text-teal-400" />
                      Rx Details
                    </h3>
                    
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-500">Medication:</span>
                        <p className="text-white font-medium">{selectedPrescription.medication_name}</p>
                      </div>
                      {selectedPrescription.sig && (
                        <div>
                          <span className="text-gray-500">Sig:</span>
                          <p className="text-gray-300">{selectedPrescription.sig}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-gray-500">Qty:</span>
                          <p className="text-gray-300">{selectedPrescription.quantity || '—'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Refills:</span>
                          <p className="text-gray-300">{selectedPrescription.refills_remaining || 0} of {selectedPrescription.refills || 0}</p>
                        </div>
                      </div>
                      {selectedPrescription.pharmacy_name && (
                        <div>
                          <span className="text-gray-500">Pharmacy:</span>
                          <p className="text-gray-300">{selectedPrescription.pharmacy_name}</p>
                          {selectedPrescription.pharmacy_phone && (
                            <p className="text-gray-500 text-xs flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {selectedPrescription.pharmacy_phone}
                            </p>
                          )}
                        </div>
                      )}
                      {selectedPrescription.notes && (
                        <div>
                          <span className="text-gray-500">Notes:</span>
                          <p className="text-gray-300">{selectedPrescription.notes}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#1b2b4d]">
                      <button
                        onClick={() => startEdit(selectedPrescription)}
                        className="px-3 py-1.5 text-xs bg-[#1b2b4d] hover:bg-[#243656] text-gray-300 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handlePrintFax(selectedPrescription)}
                        className="px-3 py-1.5 text-xs bg-[#1b2b4d] hover:bg-[#243656] text-gray-300 rounded flex items-center gap-1"
                      >
                        <Printer className="h-3 w-3" /> Print/Fax
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
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
              <span className="text-gray-400">{filteredPrescriptions.length} prescriptions</span>
              <span className={`flex items-center gap-1 ${
                saveStatus === 'saving' ? 'text-yellow-400' :
                saveStatus === 'saved' ? 'text-green-400' :
                saveStatus === 'error' ? 'text-red-400' : 'text-gray-500'
              }`}>
                {saveStatus === 'saving' && <><span className="animate-spin">⟳</span> Saving...</>}
                {saveStatus === 'saved' && lastSaved && <>✓ Saved {lastSaved.toLocaleTimeString()}</>}
                {saveStatus === 'error' && <>✗ Save failed</>}
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
    </div>
  )
}
