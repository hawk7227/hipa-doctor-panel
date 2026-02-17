// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import DraggableOverlayWrapper from './DraggableOverlayWrapper'
import { Syringe, Loader2, Plus, Trash2 } from 'lucide-react'

interface ImmunizationsPanelProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName?: string
}

interface Vaccine {
  id: number
  drchrono_vaccine_id: number
  drchrono_patient_id: number
  name: string
  cvx_code: string | null
  administered_date: string | null
  administered_by: string | null
  route: string | null
  site: string | null
  dose_quantity: string | null
  dose_unit: string | null
  lot_number: string | null
  manufacturer: string | null
  expiration_date: string | null
  notes: string | null
  status: string
}

export default function ImmunizationsPanel({ isOpen, onClose, patientId, patientName }: ImmunizationsPanelProps) {
  const [vaccines, setVaccines] = useState<Vaccine[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newVax, setNewVax] = useState({ name: '', administered_date: '', lot_number: '', manufacturer: '', notes: '' })

  const fetchData = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('drchrono_vaccines')
        .select('*')
        .eq('drchrono_patient_id', patientId)
        .order('administered_date', { ascending: false })
      if (error) throw error
      setVaccines(data || [])
    } catch (err) {
      console.error('Error fetching vaccines:', err)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    if (isOpen) fetchData()
  }, [isOpen, fetchData])

  const handleAdd = async () => {
    if (!newVax.name.trim()) return
    try {
      const { error } = await supabase.from('drchrono_vaccines').insert({
        drchrono_patient_id: parseInt(patientId),
        drchrono_vaccine_id: Date.now(),
        name: newVax.name,
        administered_date: newVax.administered_date || new Date().toISOString().split('T')[0],
        lot_number: newVax.lot_number || null,
        manufacturer: newVax.manufacturer || null,
        notes: newVax.notes || null,
        status: 'completed',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      setNewVax({ name: '', administered_date: '', lot_number: '', manufacturer: '', notes: '' })
      setAdding(false)
      fetchData()
    } catch (err) {
      console.error('Error adding vaccine:', err)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await supabase.from('drchrono_vaccines').delete().eq('id', id)
      setVaccines(prev => prev.filter(v => v.id !== id))
    } catch (err) {
      console.error('Error deleting vaccine:', err)
    }
  }

  return (
    <DraggableOverlayWrapper
      panelId="immunizations"
      isOpen={isOpen}
      onClose={onClose}
      title="Immunizations"
      subtitle={patientName ? `${patientName} • ${vaccines.length} records` : undefined}
      icon={<Syringe className="w-4 h-4" />}
      defaultTheme="emerald"
      defaultWidth={540}
      headerActions={
        <button onClick={() => setAdding(v => !v)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors" title="Add vaccine">
          <Plus className="w-3.5 h-3.5 text-white/60" />
        </button>
      }
    >
      <div className="p-4 space-y-3">
        {adding && (
          <div className="bg-white/5 rounded-xl border border-white/10 p-3 space-y-2">
            <input placeholder="Vaccine name..." value={newVax.name} onChange={e => setNewVax(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500/50 focus:outline-none" autoFocus />
            <div className="grid grid-cols-3 gap-2">
              <input type="date" value={newVax.administered_date} onChange={e => setNewVax(p => ({ ...p, administered_date: e.target.value }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none" />
              <input placeholder="Lot #" value={newVax.lot_number} onChange={e => setNewVax(p => ({ ...p, lot_number: e.target.value }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none" />
              <input placeholder="Manufacturer" value={newVax.manufacturer} onChange={e => setNewVax(p => ({ ...p, manufacturer: e.target.value }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs text-white/50 hover:text-white">Cancel</button>
              <button onClick={handleAdd} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700">Add</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-white/40 animate-spin" /></div>
        ) : vaccines.length === 0 ? (
          <div className="text-center py-8 text-white/40 text-sm">No immunization records found</div>
        ) : (
          <div className="space-y-2">
            {vaccines.map(vax => (
              <div key={vax.id} className="bg-white/5 rounded-xl border border-white/5 p-3 group hover:border-white/10 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{vax.name}</div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {vax.administered_date && <span className="text-[10px] text-white/40">{new Date(vax.administered_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                      {vax.cvx_code && <span className="text-[10px] font-mono bg-white/10 text-white/50 px-1.5 py-0.5 rounded">CVX: {vax.cvx_code}</span>}
                      {vax.lot_number && <span className="text-[10px] text-white/30">Lot: {vax.lot_number}</span>}
                      {vax.manufacturer && <span className="text-[10px] text-white/30">{vax.manufacturer}</span>}
                      {vax.route && <span className="text-[10px] text-white/30">{vax.route}</span>}
                      {vax.site && <span className="text-[10px] text-white/30">{vax.site}</span>}
                    </div>
                    {vax.notes && <p className="text-[11px] text-white/30 mt-1">{vax.notes}</p>}
                  </div>
                  <button onClick={() => handleDelete(vax.id)} className="w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all">
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DraggableOverlayWrapper>
  )
}
