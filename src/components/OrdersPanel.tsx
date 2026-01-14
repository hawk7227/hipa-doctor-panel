'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  X, Plus, Search, Download, Edit2, Trash2, GripHorizontal, 
  ClipboardList, TestTube, Scan, UserPlus, Stethoscope, 
  Clock, CheckCircle, XCircle, AlertTriangle, Send, Printer,
  RefreshCw, FileText, Building2, Calendar, Filter
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// =============================================================================
// INTERFACES
// =============================================================================

interface Order {
  id: string
  patient_id: string
  order_type: 'lab' | 'imaging' | 'referral' | 'procedure'
  order_name: string
  description?: string
  priority: 'routine' | 'urgent' | 'stat'
  status: 'draft' | 'pending' | 'sent' | 'completed' | 'cancelled' | 'rejected'
  facility?: string
  provider?: string
  ordering_provider?: string
  scheduled_date?: string
  completed_date?: string
  notes?: string
  diagnosis_code?: string
  rejection_reason?: string
  created_at?: string
  updated_at?: string
}

interface OrdersPanelProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName: string
  appointmentId?: string
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ORDER_TYPES = [
  { value: 'lab', label: 'Lab Order', icon: TestTube, color: 'cyan' },
  { value: 'imaging', label: 'Imaging', icon: Scan, color: 'purple' },
  { value: 'referral', label: 'Referral', icon: UserPlus, color: 'green' },
  { value: 'procedure', label: 'Procedure', icon: Stethoscope, color: 'orange' }
]

const PRIORITY_OPTIONS = [
  { value: 'routine', label: 'Routine', color: 'bg-gray-700 text-gray-300' },
  { value: 'urgent', label: 'Urgent', color: 'bg-yellow-900/50 text-yellow-400' },
  { value: 'stat', label: 'STAT', color: 'bg-red-900/50 text-red-400' }
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-700 text-gray-300', icon: FileText },
  { value: 'pending', label: 'Pending', color: 'bg-yellow-900/50 text-yellow-400', icon: Clock },
  { value: 'sent', label: 'Sent', color: 'bg-blue-900/50 text-blue-400', icon: Send },
  { value: 'completed', label: 'Completed', color: 'bg-green-900/50 text-green-400', icon: CheckCircle },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-700 text-gray-400', icon: XCircle },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-900/50 text-red-400', icon: AlertTriangle }
]

const COMMON_LAB_ORDERS = [
  'Complete Blood Count (CBC)',
  'Basic Metabolic Panel (BMP)',
  'Comprehensive Metabolic Panel (CMP)',
  'Lipid Panel',
  'Hemoglobin A1C',
  'Thyroid Panel (TSH, T3, T4)',
  'Urinalysis',
  'Liver Function Tests',
  'Coagulation Panel (PT/INR)',
  'Vitamin D Level'
]

const COMMON_IMAGING = [
  'X-Ray Chest',
  'X-Ray Extremity',
  'CT Head',
  'CT Abdomen/Pelvis',
  'MRI Brain',
  'MRI Spine',
  'Ultrasound Abdomen',
  'Ultrasound Pelvic',
  'Mammogram',
  'DEXA Bone Density'
]

// =============================================================================
// COMPONENT
// =============================================================================

export default function OrdersPanel({
  isOpen,
  onClose,
  patientId,
  patientName,
  appointmentId
}: OrdersPanelProps) {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  
  // Data
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // UI State
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [saving, setSaving] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  
  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Panel theme colors
  const [panelTheme, setPanelTheme] = useState<'purple' | 'blue' | 'cyan' | 'teal' | 'green' | 'orange' | 'red' | 'pink'>('blue')
  
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
    order_type: 'lab' as 'lab' | 'imaging' | 'referral' | 'procedure',
    order_name: '',
    description: '',
    priority: 'routine',
    status: 'draft',
    facility: '',
    provider: '',
    scheduled_date: '',
    diagnosis_code: '',
    notes: ''
  })
  
  // Draggable State
  const [position, setPosition] = useState({ x: 80, y: 40 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // DATA FETCHING
  // ---------------------------------------------------------------------------
  
  const fetchOrders = async () => {
    setLoading(true)
    setError(null)
    
    console.log('Fetching orders for patient:', patientId)
    
    try {
      const { data, error: queryError } = await supabase
        .from('orders')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
      
      console.log('Orders query result:', { data, queryError })
      
      if (queryError) {
        setError(queryError.message)
        return
      }
      
      setOrders(data || [])
      
    } catch (err) {
      console.error('Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch orders')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    if (isOpen && patientId) {
      fetchOrders()
    }
  }, [isOpen, patientId])

  // ---------------------------------------------------------------------------
  // CRUD OPERATIONS
  // ---------------------------------------------------------------------------
  
  const handleAdd = async () => {
    if (!formData.order_name.trim()) {
      setError('Order name is required')
      return
    }
    
    setSaving(true)
    setError(null)
    
    console.log('Adding order:', formData)
    
    try {
      const { data, error: insertError } = await supabase
        .from('orders')
        .insert({
          patient_id: patientId,
          order_type: formData.order_type,
          order_name: formData.order_name,
          description: formData.description || null,
          priority: formData.priority,
          status: formData.status,
          facility: formData.facility || null,
          provider: formData.provider || null,
          scheduled_date: formData.scheduled_date || null,
          diagnosis_code: formData.diagnosis_code || null,
          notes: formData.notes || null,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      console.log('Insert result:', { data, insertError })
      
      if (insertError) {
        setError(insertError.message)
        return
      }
      
      await fetchOrders()
      resetForm()
      setShowAddForm(false)
      setSaveStatus('saved')
      setLastSaved(new Date())
      
    } catch (err) {
      console.error('Add error:', err)
      setError(err instanceof Error ? err.message : 'Failed to add order')
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }
  
  const handleUpdate = async () => {
    if (!editingId || !formData.order_name.trim()) {
      setError('Order name is required')
      return
    }
    
    setSaving(true)
    setError(null)
    
    console.log('Updating order:', editingId, formData)
    
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          order_type: formData.order_type,
          order_name: formData.order_name,
          description: formData.description || null,
          priority: formData.priority,
          status: formData.status,
          facility: formData.facility || null,
          provider: formData.provider || null,
          scheduled_date: formData.scheduled_date || null,
          diagnosis_code: formData.diagnosis_code || null,
          notes: formData.notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingId)
      
      console.log('Update result:', { updateError })
      
      if (updateError) {
        setError(updateError.message)
        return
      }
      
      await fetchOrders()
      resetForm()
      setEditingId(null)
      setSaveStatus('saved')
      setLastSaved(new Date())
      
    } catch (err) {
      console.error('Update error:', err)
      setError(err instanceof Error ? err.message : 'Failed to update order')
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }
  
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this order?')) {
      return
    }
    
    setError(null)
    
    console.log('Deleting order:', id)
    
    try {
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .eq('id', id)
      
      console.log('Delete result:', { deleteError })
      
      if (deleteError) {
        setError(deleteError.message)
        return
      }
      
      await fetchOrders()
      if (selectedOrder?.id === id) {
        setSelectedOrder(null)
      }
      
    } catch (err) {
      console.error('Delete error:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete order')
    }
  }
  
  const handleSendOrder = async (order: Order) => {
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'sent',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
      
      if (updateError) {
        setError(updateError.message)
        return
      }
      
      await fetchOrders()
      setSaveStatus('saved')
      setLastSaved(new Date())
      
    } catch (err) {
      console.error('Send error:', err)
      setError(err instanceof Error ? err.message : 'Failed to send order')
    }
  }
  
  const handleCancelOrder = async (order: Order) => {
    if (!confirm('Are you sure you want to cancel this order?')) return
    
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
      
      if (updateError) {
        setError(updateError.message)
        return
      }
      
      await fetchOrders()
      
    } catch (err) {
      console.error('Cancel error:', err)
      setError(err instanceof Error ? err.message : 'Failed to cancel order')
    }
  }

  // ---------------------------------------------------------------------------
  // AUTO-SAVE (2 second debounce after typing stops)
  // ---------------------------------------------------------------------------
  
  const autoSaveEdit = async () => {
    if (!editingId || !formData.order_name.trim()) return
    
    setSaveStatus('saving')
    
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          order_type: formData.order_type,
          order_name: formData.order_name,
          description: formData.description || null,
          priority: formData.priority,
          status: formData.status,
          facility: formData.facility || null,
          provider: formData.provider || null,
          scheduled_date: formData.scheduled_date || null,
          diagnosis_code: formData.diagnosis_code || null,
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
      console.log('Auto-saved order at', new Date().toLocaleTimeString())
      
      // Refresh data in background
      fetchOrders()
      
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
      order_type: 'lab',
      order_name: '',
      description: '',
      priority: 'routine',
      status: 'draft',
      facility: '',
      provider: '',
      scheduled_date: '',
      diagnosis_code: '',
      notes: ''
    })
  }
  
  const startEdit = (order: Order) => {
    setFormData({
      order_type: order.order_type,
      order_name: order.order_name || '',
      description: order.description || '',
      priority: order.priority || 'routine',
      status: order.status || 'draft',
      facility: order.facility || '',
      provider: order.provider || '',
      scheduled_date: order.scheduled_date?.split('T')[0] || '',
      diagnosis_code: order.diagnosis_code || '',
      notes: order.notes || ''
    })
    setEditingId(order.id)
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
  
  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.facility?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || order.order_type === filterType
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus
    return matchesSearch && matchesType && matchesStatus
  })
  
  // Group orders by status
  const activeOrders = filteredOrders.filter(o => ['draft', 'pending', 'sent'].includes(o.status))
  const completedOrders = filteredOrders.filter(o => ['completed', 'cancelled', 'rejected'].includes(o.status))

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
  
  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }
  
  const getStatusConfig = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]
  }
  
  const getPriorityConfig = (priority: string) => {
    return PRIORITY_OPTIONS.find(p => p.value === priority) || PRIORITY_OPTIONS[0]
  }
  
  const getOrderTypeConfig = (type: string) => {
    return ORDER_TYPES.find(t => t.value === type) || ORDER_TYPES[0]
  }
  
  const exportToCSV = () => {
    const rows = [['Type', 'Order Name', 'Priority', 'Status', 'Facility', 'Scheduled', 'Created']]
    filteredOrders.forEach(order => {
      rows.push([
        order.order_type,
        order.order_name,
        order.priority,
        order.status,
        order.facility || '',
        order.scheduled_date || '',
        order.created_at || ''
      ])
    })
    const csv = rows.map(r => r.map(x => `"${String(x || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `orders_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
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
          width: '1000px',
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: '90vh',
          background: currentTheme.bg,
          boxShadow: `0 12px 60px ${currentTheme.glow}, inset 0 0 0 2px ${currentTheme.border}`
        }}
      >
        {/* Header - Dynamic theme */}
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
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Orders</h2>
              <p className="text-xs" style={{ color: currentTheme.light }}>{patientName} • Labs, Imaging, Referrals, Procedures</p>
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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { resetForm(); setShowAddForm(true); setEditingId(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              New Order
            </button>
            
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-[#1b2b4d] hover:bg-[#243656] text-gray-300 rounded-lg transition-colors text-sm"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            
            <button
              onClick={fetchOrders}
              className="flex items-center gap-2 px-4 py-2 bg-[#1b2b4d] hover:bg-[#243656] text-gray-300 rounded-lg transition-colors text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm w-64 focus:outline-none focus:border-blue-500"
              />
            </div>
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Types</option>
              {ORDER_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Status</option>
              {STATUS_OPTIONS.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
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
              <h3 className="text-white font-semibold mb-4">
                {editingId ? 'Edit Order' : 'New Order'}
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Order Type */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Order Type *</label>
                  <select
                    value={formData.order_type}
                    onChange={(e) => handleFormChange('order_type', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm"
                  >
                    {ORDER_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                
                {/* Order Name */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Order Name *</label>
                  <input
                    type="text"
                    value={formData.order_name}
                    onChange={(e) => handleFormChange('order_name', e.target.value)}
                    placeholder="e.g., Complete Blood Count"
                    list="common-orders"
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm"
                  />
                  <datalist id="common-orders">
                    {formData.order_type === 'lab' && COMMON_LAB_ORDERS.map(o => (
                      <option key={o} value={o} />
                    ))}
                    {formData.order_type === 'imaging' && COMMON_IMAGING.map(o => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                </div>
                
                {/* Priority */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => handleFormChange('priority', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm"
                  >
                    {PRIORITY_OPTIONS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
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
                
                {/* Facility */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Facility/Lab</label>
                  <input
                    type="text"
                    value={formData.facility}
                    onChange={(e) => handleFormChange('facility', e.target.value)}
                    placeholder="e.g., Quest Diagnostics"
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm"
                  />
                </div>
                
                {/* Provider */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Referred To / Provider</label>
                  <input
                    type="text"
                    value={formData.provider}
                    onChange={(e) => handleFormChange('provider', e.target.value)}
                    placeholder="e.g., Dr. Smith"
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm"
                  />
                </div>
                
                {/* Scheduled Date */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => handleFormChange('scheduled_date', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm"
                  />
                </div>
                
                {/* Diagnosis Code */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Diagnosis/ICD Code</label>
                  <input
                    type="text"
                    value={formData.diagnosis_code}
                    onChange={(e) => handleFormChange('diagnosis_code', e.target.value)}
                    placeholder="e.g., E11.9"
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm"
                  />
                </div>
                
                {/* Description */}
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    placeholder="Additional details..."
                    className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm"
                  />
                </div>
                
                {/* Notes */}
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    placeholder="Clinical notes, special instructions..."
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
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  {saving ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    <>{editingId ? 'Update' : 'Create'} Order</>
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
                <div className="animate-spin h-8 w-8 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                <span className="text-gray-400 text-sm">Loading orders...</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {/* Left Column: Active Orders */}
              <div className="col-span-2 space-y-4">
                {/* Active Orders Section */}
                <div className="bg-[#0d1424] border border-[#1b2b4d] rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-400" />
                    Active Orders ({activeOrders.length})
                  </h3>
                  
                  {activeOrders.length === 0 ? (
                    <p className="text-gray-500 text-sm py-4 text-center">No active orders</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#1b2b4d]">
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Type</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Order</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Facility</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Priority</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Status</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeOrders.map(order => {
                            const typeConfig = getOrderTypeConfig(order.order_type)
                            const TypeIcon = typeConfig.icon
                            const statusConfig = getStatusConfig(order.status)
                            const priorityConfig = getPriorityConfig(order.priority)
                            
                            return (
                              <tr 
                                key={order.id} 
                                className="border-b border-[#1b2b4d] hover:bg-[#0a1628] cursor-pointer"
                                onClick={() => setSelectedOrder(order)}
                              >
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-1">
                                    <TypeIcon className="h-4 w-4 text-blue-400" />
                                    <span className="text-gray-300 capitalize">{order.order_type}</span>
                                  </div>
                                </td>
                                <td className="py-2 px-2">
                                  <span className="text-white font-medium">{order.order_name}</span>
                                </td>
                                <td className="py-2 px-2 text-gray-400">{order.facility || '—'}</td>
                                <td className="py-2 px-2">
                                  <span className={`px-2 py-0.5 rounded text-xs ${priorityConfig.color}`}>
                                    {priorityConfig.label}
                                  </span>
                                </td>
                                <td className="py-2 px-2">
                                  <span className={`px-2 py-0.5 rounded text-xs ${statusConfig.color}`}>
                                    {statusConfig.label}
                                  </span>
                                </td>
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    {order.status === 'draft' && (
                                      <button
                                        onClick={() => handleSendOrder(order)}
                                        className="p-1 hover:bg-blue-900/30 rounded text-blue-400"
                                        title="Send Order"
                                      >
                                        <Send className="h-4 w-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => startEdit(order)}
                                      className="p-1 hover:bg-[#1b2b4d] rounded text-gray-400"
                                      title="Edit"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleCancelOrder(order)}
                                      className="p-1 hover:bg-red-900/30 rounded text-gray-400"
                                      title="Cancel"
                                    >
                                      <XCircle className="h-4 w-4" />
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
                
                {/* Past/Completed Orders Section */}
                <div className="bg-[#0d1424] border border-[#1b2b4d] rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    Completed/Past Orders ({completedOrders.length})
                  </h3>
                  
                  {completedOrders.length === 0 ? (
                    <p className="text-gray-500 text-sm py-4 text-center">No completed orders</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#1b2b4d]">
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Type</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Order</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Date</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Status</th>
                            <th className="text-left py-2 px-2 text-gray-400 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {completedOrders.slice(0, 10).map(order => {
                            const typeConfig = getOrderTypeConfig(order.order_type)
                            const TypeIcon = typeConfig.icon
                            const statusConfig = getStatusConfig(order.status)
                            
                            return (
                              <tr 
                                key={order.id} 
                                className="border-b border-[#1b2b4d] hover:bg-[#0a1628] cursor-pointer"
                                onClick={() => setSelectedOrder(order)}
                              >
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-1">
                                    <TypeIcon className="h-4 w-4 text-gray-500" />
                                    <span className="text-gray-400 capitalize">{order.order_type}</span>
                                  </div>
                                </td>
                                <td className="py-2 px-2 text-gray-300">{order.order_name}</td>
                                <td className="py-2 px-2 text-gray-500">
                                  {order.completed_date ? formatDate(order.completed_date) : formatDate(order.created_at || '')}
                                </td>
                                <td className="py-2 px-2">
                                  <span className={`px-2 py-0.5 rounded text-xs ${statusConfig.color}`}>
                                    {statusConfig.label}
                                  </span>
                                </td>
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <button
                                      onClick={() => {
                                        const newOrder = { ...order }
                                        delete (newOrder as any).id
                                        setFormData({
                                          order_type: newOrder.order_type,
                                          order_name: newOrder.order_name || '',
                                          description: newOrder.description || '',
                                          priority: newOrder.priority || 'routine',
                                          status: 'draft',
                                          facility: newOrder.facility || '',
                                          provider: newOrder.provider || '',
                                          scheduled_date: '',
                                          diagnosis_code: newOrder.diagnosis_code || '',
                                          notes: newOrder.notes || ''
                                        })
                                        setShowAddForm(true)
                                        setEditingId(null)
                                      }}
                                      className="p-1 hover:bg-[#1b2b4d] rounded text-gray-400 text-xs"
                                      title="Copy to New"
                                    >
                                      Copy
                                    </button>
                                    <button
                                      onClick={() => handleDelete(order.id)}
                                      className="p-1 hover:bg-red-900/30 rounded text-gray-400"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-4 w-4" />
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
              
              {/* Right Column: Order Details & Audit Log */}
              <div className="space-y-4">
                {/* Selected Order Details */}
                <div className="bg-[#0d1424] border border-[#1b2b4d] rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-cyan-400" />
                    Order Details
                  </h3>
                  
                  {selectedOrder ? (
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-gray-500">Order:</span>
                        <p className="text-white font-medium">{selectedOrder.order_name}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-gray-500">Type:</span>
                          <p className="text-gray-300 capitalize">{selectedOrder.order_type}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Priority:</span>
                          <p className="text-gray-300 capitalize">{selectedOrder.priority}</p>
                        </div>
                      </div>
                      {selectedOrder.facility && (
                        <div>
                          <span className="text-gray-500">Facility:</span>
                          <p className="text-gray-300">{selectedOrder.facility}</p>
                        </div>
                      )}
                      {selectedOrder.provider && (
                        <div>
                          <span className="text-gray-500">Provider:</span>
                          <p className="text-gray-300">{selectedOrder.provider}</p>
                        </div>
                      )}
                      {selectedOrder.scheduled_date && (
                        <div>
                          <span className="text-gray-500">Scheduled:</span>
                          <p className="text-gray-300">{formatDate(selectedOrder.scheduled_date)}</p>
                        </div>
                      )}
                      {selectedOrder.diagnosis_code && (
                        <div>
                          <span className="text-gray-500">Dx Code:</span>
                          <p className="text-gray-300">{selectedOrder.diagnosis_code}</p>
                        </div>
                      )}
                      {selectedOrder.notes && (
                        <div>
                          <span className="text-gray-500">Notes:</span>
                          <p className="text-gray-300">{selectedOrder.notes}</p>
                        </div>
                      )}
                      {selectedOrder.rejection_reason && (
                        <div className="p-2 bg-red-900/20 border border-red-700 rounded">
                          <span className="text-red-400 text-xs">Rejection Reason:</span>
                          <p className="text-red-300">{selectedOrder.rejection_reason}</p>
                        </div>
                      )}
                      <div className="pt-2 border-t border-[#1b2b4d]">
                        <span className="text-gray-500 text-xs">Created:</span>
                        <p className="text-gray-400 text-xs">
                          {selectedOrder.created_at ? formatDateTime(selectedOrder.created_at) : '—'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm py-4 text-center">
                      Select an order to view details
                    </p>
                  )}
                </div>
                
                {/* Order Log / Audit Trail */}
                <div className="bg-[#0d1424] border border-[#1b2b4d] rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-purple-400" />
                    Recent Activity
                  </h3>
                  
                  <div className="space-y-2 text-xs">
                    {filteredOrders.slice(0, 8).map(order => (
                      <div 
                        key={order.id} 
                        className="flex items-center gap-2 p-2 hover:bg-[#0a1628] rounded cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <span className={`w-2 h-2 rounded-full ${
                          order.status === 'completed' ? 'bg-green-400' :
                          order.status === 'sent' ? 'bg-blue-400' :
                          order.status === 'rejected' ? 'bg-red-400' :
                          'bg-gray-400'
                        }`} />
                        <span className="text-gray-400 flex-1 truncate">{order.order_name}</span>
                        <span className="text-gray-600">
                          {order.created_at ? formatDate(order.created_at) : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
              <span className="text-gray-400">{filteredOrders.length} orders</span>
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
    </div>
  )
}
