'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Users, Wine, Scissors, Plus, Pencil, Trash2 } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string; historyType: 'family' | 'social' | 'surgical' }

const TYPE_CONFIG = {
  family: { title: 'Family History', icon: Users, color: '#f43f5e', placeholder: 'e.g. Father — Diabetes, hypertension' },
  social: { title: 'Social History', icon: Wine, color: '#f59e0b', placeholder: 'e.g. Non-smoker, occasional alcohol' },
  surgical: { title: 'Surgical History', icon: Scissors, color: '#ef4444', placeholder: 'e.g. Appendectomy — 2019' },
}

export default function HistoryPanelV2({ isOpen, onClose, patientId, patientName, historyType }: Props) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ description: '', details: '', status: 'active' })
  const [saving, setSaving] = useState(false)

  const config = TYPE_CONFIG[historyType]
  const Icon = config.icon

  const fetchData = useCallback(async () => {
    if (!patientId) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/panels/history?patient_id=${patientId}&type=${historyType}`)
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Failed to load')
      else setData(json.data || [])
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }, [patientId, historyType])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    if (!form.description.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/panels/history', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId, history_type: historyType, ...form }) })
      const json = await res.json()
      if (res.ok) { setData(prev => [json.data, ...prev]); setForm({ description: '', details: '', status: 'active' }); setShowAdd(false) }
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/panels/history?id=${id}`, { method: 'DELETE' })
    setData(prev => prev.filter(d => d.id !== id))
  }

  if (!isOpen) return null
  return (
    <PanelBase title={`${config.title} — ${patientName}`} icon={Icon} accentColor={config.color} loading={loading} error={error}
      hasData={data.length > 0} emptyMessage={`No ${historyType} history`} emptyIcon={Icon} onRetry={fetchData} onClose={onClose} draggable={false}
      badge={data.length > 0 ? data.length : undefined}
      headerActions={<button onClick={() => setShowAdd(true)} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="p-3 space-y-2">
        {showAdd && (
          <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder={config.placeholder} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
            <textarea value={form.details} onChange={e => setForm({ ...form, details: e.target.value })}
              placeholder="Additional details..." rows={2} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.description.trim()} className="px-3 py-1 text-xs bg-teal-600 text-white rounded disabled:opacity-50">{saving ? 'Saving...' : 'Add'}</button>
            </div>
          </div>
        )}
        {data.map((item: any) => (
          <div key={item.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-2.5 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-white">{item.description}</span>
              {item.details && <p className="text-xs text-gray-500 mt-0.5">{item.details}</p>}
              {item.created_at && <p className="text-[10px] text-gray-600 mt-0.5">{new Date(item.created_at).toLocaleDateString()}</p>}
            </div>
            <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-600 hover:text-red-400 flex-shrink-0"><Trash2 className="w-3 h-3" /></button>
          </div>
        ))}
      </div>
    </PanelBase>
  )
}
