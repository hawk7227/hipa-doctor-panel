// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  X, GripHorizontal, Activity, Plus, Edit2, Trash2, Save, 
  Search, Download, Heart, Thermometer, TrendingUp, Clock
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// =============================================================================
// INTERFACES
// =============================================================================

interface Vital {
  id: string
  patient_id: string
  appointment_id?: string
  systolic_bp?: number
  diastolic_bp?: number
  heart_rate?: number
  temperature?: number
  weight?: number
  height?: number
  oxygen_saturation?: number
  respiratory_rate?: number
  recorded_at: string
}

interface VitalsPanelProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName: string
  appointmentId?: string
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function VitalsPanel({
  isOpen,
  onClose,
  patientId,
  patientName,
  appointmentId
}: VitalsPanelProps) {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  
  // Data
  const [vitals, setVitals] = useState<Vital[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // UI State
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list')
  
  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Panel theme colors
  const [panelTheme, setPanelTheme] = useState<'purple' | 'blue' | 'cyan' | 'teal' | 'green' | 'orange' | 'red' | 'pink'>('cyan')
  
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
    systolic_bp: '',
    diastolic_bp: '',
    heart_rate: '',
    temperature: '',
    weight: '',
    height: '',
    oxygen_saturation: '',
    respiratory_rate: ''
  })
  
  // Draggable State
  const [position, setPosition] = useState({ x: 100, y: 60 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // DATA FETCHING
  // ---------------------------------------------------------------------------
  
  const fetchVitals = async () => {
    setLoading(true)
    setError(null)
    
    console.log('Fetching vitals for patient:', patientId)
    
    try {
      const { data, error: queryError } = await supabase
        .from('vitals')
        .select('*')
        .eq('patient_id', patientId)
        .order('recorded_at', { ascending: false })
        .limit(50)
      
      console.log('Vitals query result:', { data, queryError })
      
      if (queryError) {
        setError(queryError.message)
        return
      }
      
      setVitals(data || [])
      
    } catch (err) {
      console.error('Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch vitals')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    if (isOpen && patientId) {
      fetchVitals()
    }
  }, [isOpen, patientId])

  // ---------------------------------------------------------------------------
  // CRUD OPERATIONS
  // ---------------------------------------------------------------------------
  
  const handleAdd = async () => {
    // At least one vital must be entered
    if (!formData.systolic_bp && !formData.heart_rate && !formData.temperature && !formData.weight && !formData.height && !formData.oxygen_saturation && !formData.respiratory_rate) {
      setError('Please enter at least one vital sign')
      return
    }
    
    setSaving(true)
    setError(null)
    
    console.log('Adding vitals:', formData)
    
    try {
      const insertData: any = {
        patient_id: patientId,
        recorded_at: new Date().toISOString()
      }
      
      // Only include fields that have values
      if (formData.systolic_bp) insertData.systolic_bp = parseInt(formData.systolic_bp)
      if (formData.diastolic_bp) insertData.diastolic_bp = parseInt(formData.diastolic_bp)
      if (formData.heart_rate) insertData.heart_rate = parseInt(formData.heart_rate)
      if (formData.temperature) insertData.temperature = parseFloat(formData.temperature)
      if (formData.weight) insertData.weight = parseFloat(formData.weight)
      if (formData.height) insertData.height = parseFloat(formData.height)
      if (formData.oxygen_saturation) insertData.oxygen_saturation = parseInt(formData.oxygen_saturation)
      if (formData.respiratory_rate) insertData.respiratory_rate = parseInt(formData.respiratory_rate)
      if (appointmentId) insertData.appointment_id = appointmentId
      
      const { data, error: insertError } = await supabase
        .from('vitals')
        .insert(insertData)
        .select()
        .single()
      
      console.log('Insert result:', { data, insertError })
      
      if (insertError) {
        setError(insertError.message)
        return
      }
      
      await fetchVitals()
      resetForm()
      setShowAddForm(false)
      setSaveStatus('saved')
      setLastSaved(new Date())
      
    } catch (err) {
      console.error('Add error:', err)
      setError(err instanceof Error ? err.message : 'Failed to add vitals')
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }
  
  const handleUpdate = async () => {
    if (!editingId) return
    
    setSaving(true)
    setError(null)
    
    console.log('Updating vitals:', editingId, formData)
    
    try {
      const updateData: any = {}
      
      if (formData.systolic_bp) updateData.systolic_bp = parseInt(formData.systolic_bp)
      if (formData.diastolic_bp) updateData.diastolic_bp = parseInt(formData.diastolic_bp)
      if (formData.heart_rate) updateData.heart_rate = parseInt(formData.heart_rate)
      if (formData.temperature) updateData.temperature = parseFloat(formData.temperature)
      if (formData.weight) updateData.weight = parseFloat(formData.weight)
      if (formData.height) updateData.height = parseFloat(formData.height)
      if (formData.oxygen_saturation) updateData.oxygen_saturation = parseInt(formData.oxygen_saturation)
      if (formData.respiratory_rate) updateData.respiratory_rate = parseInt(formData.respiratory_rate)
      
      const { error: updateError } = await supabase
        .from('vitals')
        .update(updateData)
        .eq('id', editingId)
      
      console.log('Update result:', { updateError })
      
      if (updateError) {
        setError(updateError.message)
        return
      }
      
      await fetchVitals()
      resetForm()
      setEditingId(null)
      setSaveStatus('saved')
      setLastSaved(new Date())
      
    } catch (err) {
      console.error('Update error:', err)
      setError(err instanceof Error ? err.message : 'Failed to update vitals')
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }
  
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vitals record?')) {
      return
    }
    
    setError(null)
    
    console.log('Deleting vitals:', id)
    
    try {
      const { error: deleteError } = await supabase
        .from('vitals')
        .delete()
        .eq('id', id)
      
      console.log('Delete result:', { deleteError })
      
      if (deleteError) {
        setError(deleteError.message)
        return
      }
      
      await fetchVitals()
      
    } catch (err) {
      console.error('Delete error:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete vitals')
    }
  }

  // ---------------------------------------------------------------------------
  // AUTO-SAVE (2 second debounce after typing stops)
  // ---------------------------------------------------------------------------
  
  const autoSaveEdit = async () => {
    if (!editingId) return
    
    setSaveStatus('saving')
    
    try {
      const updateData: any = {}
      
      if (formData.systolic_bp) updateData.systolic_bp = parseInt(formData.systolic_bp)
      if (formData.diastolic_bp) updateData.diastolic_bp = parseInt(formData.diastolic_bp)
      if (formData.heart_rate) updateData.heart_rate = parseInt(formData.heart_rate)
      if (formData.temperature) updateData.temperature = parseFloat(formData.temperature)
      if (formData.weight) updateData.weight = parseFloat(formData.weight)
      if (formData.height) updateData.height = parseFloat(formData.height)
      if (formData.oxygen_saturation) updateData.oxygen_saturation = parseInt(formData.oxygen_saturation)
      if (formData.respiratory_rate) updateData.respiratory_rate = parseInt(formData.respiratory_rate)
      
      const { error: updateError } = await supabase
        .from('vitals')
        .update(updateData)
        .eq('id', editingId)
      
      if (updateError) {
        setSaveStatus('error')
        console.error('Auto-save error:', updateError)
        return
      }
      
      setSaveStatus('saved')
      setLastSaved(new Date())
      console.log('Auto-saved vitals at', new Date().toLocaleTimeString())
      
      // Refresh data in background
      fetchVitals()
      
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
      systolic_bp: '',
      diastolic_bp: '',
      heart_rate: '',
      temperature: '',
      weight: '',
      height: '',
      oxygen_saturation: '',
      respiratory_rate: ''
    })
  }
  
  const startEdit = (vital: Vital) => {
    setFormData({
      systolic_bp: vital.systolic_bp?.toString() || '',
      diastolic_bp: vital.diastolic_bp?.toString() || '',
      heart_rate: vital.heart_rate?.toString() || '',
      temperature: vital.temperature?.toString() || '',
      weight: vital.weight?.toString() || '',
      height: vital.height?.toString() || '',
      oxygen_saturation: vital.oxygen_saturation?.toString() || '',
      respiratory_rate: vital.respiratory_rate?.toString() || ''
    })
    setEditingId(vital.id)
    setShowAddForm(true)
  }
  
  const cancelEdit = () => {
    resetForm()
    setEditingId(null)
    setShowAddForm(false)
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  
  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }
  
  const getBPStatus = (systolic?: number, diastolic?: number) => {
    if (!systolic || !diastolic) return { label: 'N/A', color: 'text-gray-400' }
    
    if (systolic < 90 || diastolic < 60) return { label: 'Low', color: 'text-blue-400' }
    if (systolic < 120 && diastolic < 80) return { label: 'Normal', color: 'text-green-400' }
    if (systolic < 130 && diastolic < 80) return { label: 'Elevated', color: 'text-yellow-400' }
    if (systolic < 140 || diastolic < 90) return { label: 'High Stage 1', color: 'text-orange-400' }
    if (systolic >= 140 || diastolic >= 90) return { label: 'High Stage 2', color: 'text-red-400' }
    if (systolic > 180 || diastolic > 120) return { label: 'Crisis', color: 'text-red-600' }
    
    return { label: 'Unknown', color: 'text-gray-400' }
  }
  
  const getHRStatus = (hr?: number) => {
    if (!hr) return { label: 'N/A', color: 'text-gray-400' }
    
    if (hr < 60) return { label: 'Low', color: 'text-blue-400' }
    if (hr >= 60 && hr <= 100) return { label: 'Normal', color: 'text-green-400' }
    if (hr > 100) return { label: 'High', color: 'text-red-400' }
    
    return { label: 'Unknown', color: 'text-gray-400' }
  }
  
  const getTempStatus = (temp?: number) => {
    if (!temp) return { label: 'N/A', color: 'text-gray-400' }
    
    if (temp < 97) return { label: 'Low', color: 'text-blue-400' }
    if (temp >= 97 && temp <= 99) return { label: 'Normal', color: 'text-green-400' }
    if (temp > 99 && temp <= 100.4) return { label: 'Elevated', color: 'text-yellow-400' }
    if (temp > 100.4) return { label: 'Fever', color: 'text-red-400' }
    
    return { label: 'Unknown', color: 'text-gray-400' }
  }

  // ---------------------------------------------------------------------------
  // EXPORT
  // ---------------------------------------------------------------------------
  
  const exportToCSV = () => {
    const headers = ['Date', 'Systolic', 'Diastolic', 'Heart Rate', 'Temperature']
    const rows = vitals.map(v => [
      v.recorded_at ? new Date(v.recorded_at).toLocaleString() : '',
      v.systolic_bp || '',
      v.diastolic_bp || '',
      v.heart_rate || '',
      v.temperature || ''
    ])
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vitals_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
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
  
  // Get latest vitals for summary
  const latestVital = vitals[0]
  
  return (
    <div
      ref={panelRef}
      className="fixed z-[60] rounded-xl shadow-2xl flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: '700px',
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
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Vitals</h2>
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
      
      {/* Latest Vitals Summary */}
      {latestVital && (
        <div className="p-4 border-b border-[#1b2b4d] bg-[#0d1424]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-400">Latest Reading</h3>
            <span className="text-xs text-gray-500">
              {latestVital.recorded_at ? formatDateTime(latestVital.recorded_at) : ''}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {/* Blood Pressure */}
            <div className="p-3 bg-[#0a1628] rounded-lg text-center border border-[#1b2b4d]">
              <Heart className="h-5 w-5 text-red-400 mx-auto mb-1" />
              <p className="text-xs text-gray-400 mb-1">Blood Pressure</p>
              <p className="text-white font-semibold">
                {latestVital.systolic_bp && latestVital.diastolic_bp 
                  ? `${latestVital.systolic_bp}/${latestVital.diastolic_bp}` 
                  : 'N/A'}
              </p>
              <p className={`text-xs mt-1 ${getBPStatus(latestVital.systolic_bp, latestVital.diastolic_bp).color}`}>
                {getBPStatus(latestVital.systolic_bp, latestVital.diastolic_bp).label}
              </p>
            </div>
            
            {/* Heart Rate */}
            <div className="p-3 bg-[#0a1628] rounded-lg text-center border border-[#1b2b4d]">
              <Activity className="h-5 w-5 text-pink-400 mx-auto mb-1" />
              <p className="text-xs text-gray-400 mb-1">Heart Rate</p>
              <p className="text-white font-semibold">
                {latestVital.heart_rate ? `${latestVital.heart_rate} bpm` : 'N/A'}
              </p>
              <p className={`text-xs mt-1 ${getHRStatus(latestVital.heart_rate).color}`}>
                {getHRStatus(latestVital.heart_rate).label}
              </p>
            </div>
            
            {/* Temperature */}
            <div className="p-3 bg-[#0a1628] rounded-lg text-center border border-[#1b2b4d]">
              <Thermometer className="h-5 w-5 text-orange-400 mx-auto mb-1" />
              <p className="text-xs text-gray-400 mb-1">Temperature</p>
              <p className="text-white font-semibold">
                {latestVital.temperature ? `${latestVital.temperature}°F` : 'N/A'}
              </p>
              <p className={`text-xs mt-1 ${getTempStatus(latestVital.temperature).color}`}>
                {getTempStatus(latestVital.temperature).label}
              </p>
            </div>
            
            {/* Weight */}
            <div className="p-3 bg-[#0a1628] rounded-lg text-center border border-[#1b2b4d]">
              <TrendingUp className="h-5 w-5 text-green-400 mx-auto mb-1" />
              <p className="text-xs text-gray-400 mb-1">Weight</p>
              <p className="text-white font-semibold">
                {latestVital.weight ? `${latestVital.weight} lbs` : 'N/A'}
              </p>
              {latestVital.height && latestVital.weight ? (
                <p className="text-xs mt-1 text-cyan-400">
                  BMI: {((latestVital.weight / (latestVital.height * latestVital.height)) * 703).toFixed(1)}
                </p>
              ) : (
                <p className="text-xs mt-1 text-gray-500">{latestVital.height ? `${latestVital.height} in` : 'No height'}</p>
              )}
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-4 gap-3 mt-3">
            {/* Height */}
            <div className="p-3 bg-[#0a1628] rounded-lg text-center border border-[#1b2b4d]">
              <p className="text-xs text-gray-400 mb-1">Height</p>
              <p className="text-white font-semibold">
                {latestVital.height ? `${Math.floor(latestVital.height / 12)}'${Math.round(latestVital.height % 12)}"` : 'N/A'}
              </p>
              <p className="text-xs mt-1 text-gray-500">{latestVital.height ? `${latestVital.height} in` : ''}</p>
            </div>

            {/* O2 Saturation */}
            <div className="p-3 bg-[#0a1628] rounded-lg text-center border border-[#1b2b4d]">
              <p className="text-xs text-gray-400 mb-1">O2 Sat</p>
              <p className="text-white font-semibold">
                {latestVital.oxygen_saturation ? `${latestVital.oxygen_saturation}%` : 'N/A'}
              </p>
              <p className={`text-xs mt-1 ${latestVital.oxygen_saturation && latestVital.oxygen_saturation >= 95 ? 'text-green-400' : latestVital.oxygen_saturation && latestVital.oxygen_saturation >= 90 ? 'text-yellow-400' : 'text-gray-500'}`}>
                {latestVital.oxygen_saturation ? (latestVital.oxygen_saturation >= 95 ? 'Normal' : latestVital.oxygen_saturation >= 90 ? 'Low' : 'Critical') : ''}
              </p>
            </div>

            {/* Respiratory Rate */}
            <div className="p-3 bg-[#0a1628] rounded-lg text-center border border-[#1b2b4d]">
              <p className="text-xs text-gray-400 mb-1">Resp Rate</p>
              <p className="text-white font-semibold">
                {latestVital.respiratory_rate ? `${latestVital.respiratory_rate}/min` : 'N/A'}
              </p>
              <p className={`text-xs mt-1 ${latestVital.respiratory_rate && latestVital.respiratory_rate >= 12 && latestVital.respiratory_rate <= 20 ? 'text-green-400' : latestVital.respiratory_rate ? 'text-yellow-400' : 'text-gray-500'}`}>
                {latestVital.respiratory_rate ? (latestVital.respiratory_rate >= 12 && latestVital.respiratory_rate <= 20 ? 'Normal' : 'Abnormal') : ''}
              </p>
            </div>

            {/* Total Readings */}
            <div className="p-3 bg-[#0a1628] rounded-lg text-center border border-[#1b2b4d]">
              <TrendingUp className="h-5 w-5 text-cyan-400 mx-auto mb-1" />
              <p className="text-xs text-gray-400 mb-1">Total Readings</p>
              <p className="text-white font-semibold">{vitals.length}</p>
              <p className="text-xs mt-1 text-gray-500">records</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Toolbar */}
      <div className="p-4 border-b border-[#1b2b4d]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { resetForm(); setShowAddForm(true); setEditingId(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              Record Vitals
            </button>
            
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-3 py-2 bg-[#1b2b4d] hover:bg-[#243656] text-gray-300 rounded-lg transition-colors text-sm"
              title="Export to CSV"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center bg-[#1b2b4d] rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'chart' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Chart
            </button>
          </div>
        </div>
      </div>
      
      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="p-4 border-b border-[#1b2b4d] bg-[#0d1424]">
          <h3 className="text-sm font-semibold text-white mb-3">
            {editingId ? 'Edit Vitals' : 'Record New Vitals'}
          </h3>
          
          <div className="grid grid-cols-4 gap-3">
            {/* Systolic BP */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Systolic (mmHg)</label>
              <input
                type="number"
                value={formData.systolic_bp}
                onChange={(e) => setFormData({ ...formData, systolic_bp: e.target.value })}
                placeholder="120"
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            
            {/* Diastolic BP */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Diastolic (mmHg)</label>
              <input
                type="number"
                value={formData.diastolic_bp}
                onChange={(e) => setFormData({ ...formData, diastolic_bp: e.target.value })}
                placeholder="80"
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            
            {/* Heart Rate */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Heart Rate (bpm)</label>
              <input
                type="number"
                value={formData.heart_rate}
                onChange={(e) => setFormData({ ...formData, heart_rate: e.target.value })}
                placeholder="72"
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            
            {/* Temperature */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Temp (°F)</label>
              <input
                type="number"
                step="0.1"
                value={formData.temperature}
                onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                placeholder="98.6"
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Row 2: Height, Weight, O2 Sat, Respiratory Rate */}
          <div className="grid grid-cols-4 gap-3 mt-3">
            {/* Height */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Height (in)</label>
              <input
                type="number"
                step="0.1"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                placeholder="64"
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            
            {/* Weight */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Weight (lbs)</label>
              <input
                type="number"
                step="0.1"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                placeholder="150"
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            
            {/* O2 Saturation */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">O2 Sat (%)</label>
              <input
                type="number"
                value={formData.oxygen_saturation}
                onChange={(e) => setFormData({ ...formData, oxygen_saturation: e.target.value })}
                placeholder="98"
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            
            {/* Respiratory Rate */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Resp Rate (/min)</label>
              <input
                type="number"
                value={formData.respiratory_rate}
                onChange={(e) => setFormData({ ...formData, respiratory_rate: e.target.value })}
                placeholder="16"
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1b2b4d] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
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
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-900 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
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
            <div className="animate-spin h-8 w-8 border-2 border-cyan-400 border-t-transparent rounded-full"></div>
          </div>
        ) : vitals.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1b2b4d] rounded-full mb-4">
              <Activity className="h-8 w-8 text-gray-500" />
            </div>
            <p className="text-gray-400">No vitals recorded</p>
            <p className="text-gray-500 text-sm mt-1">Click "Record Vitals" to add a reading</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-2">
            {vitals.map((vital) => (
              <div
                key={vital.id}
                className="p-4 bg-[#0d1424] border border-[#1b2b4d] rounded-lg hover:border-cyan-600/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs">
                    <Clock className="h-3 w-3" />
                    {vital.recorded_at ? formatDateTime(vital.recorded_at) : 'Unknown'}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(vital)}
                      className="p-2 hover:bg-[#1b2b4d] rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4 text-gray-400 hover:text-white" />
                    </button>
                    <button
                      onClick={() => handleDelete(vital.id)}
                      className="p-2 hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-400" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-4">
                  {/* Blood Pressure */}
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">BP</p>
                    <p className="text-white font-medium">
                      {vital.systolic_bp && vital.diastolic_bp 
                        ? `${vital.systolic_bp}/${vital.diastolic_bp}` 
                        : '-'}
                    </p>
                    {vital.systolic_bp && vital.diastolic_bp && (
                      <p className={`text-xs ${getBPStatus(vital.systolic_bp, vital.diastolic_bp).color}`}>
                        {getBPStatus(vital.systolic_bp, vital.diastolic_bp).label}
                      </p>
                    )}
                  </div>
                  
                  {/* Heart Rate */}
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">HR</p>
                    <p className="text-white font-medium">
                      {vital.heart_rate ? `${vital.heart_rate} bpm` : '-'}
                    </p>
                    {vital.heart_rate && (
                      <p className={`text-xs ${getHRStatus(vital.heart_rate).color}`}>
                        {getHRStatus(vital.heart_rate).label}
                      </p>
                    )}
                  </div>
                  
                  {/* Temperature */}
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Temp</p>
                    <p className="text-white font-medium">
                      {vital.temperature ? `${vital.temperature}°F` : '-'}
                    </p>
                    {vital.temperature && (
                      <p className={`text-xs ${getTempStatus(vital.temperature).color}`}>
                        {getTempStatus(vital.temperature).label}
                      </p>
                    )}
                  </div>
                  
                  {/* SpO2 if available */}
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">SpO2</p>
                    <p className="text-white font-medium">
                      {vital.oxygen_saturation ? `${vital.oxygen_saturation}%` : '-'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Chart View - Placeholder */
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">Chart view coming soon</p>
            <p className="text-gray-500 text-sm">Historical trending will be displayed here</p>
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
            <span className="text-gray-400">{vitals.length} vitals records</span>
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





