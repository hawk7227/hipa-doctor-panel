// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import DraggableOverlayWrapper from './DraggableOverlayWrapper'
import { Building2, Loader2, Plus, Trash2, Phone, MapPin, Star } from 'lucide-react'

interface PharmacyPanelProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName?: string
}

interface Pharmacy {
  id: string
  patient_id: string
  name: string
  ncpdp_id: string | null
  phone: string | null
  fax: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  is_preferred: boolean
  created_at: string
}

export default function PharmacyPanel({ isOpen, onClose, patientId, patientName }: PharmacyPanelProps) {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newPharm, setNewPharm] = useState({ name: '', phone: '', fax: '', address: '', city: '', state: '', zip: '', ncpdp_id: '' })

  const fetchData = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('patient_pharmacies')
        .select('*')
        .eq('patient_id', patientId)
        .order('is_preferred', { ascending: false })
      if (error) {
        console.log('patient_pharmacies query:', error.message)
        setPharmacies([])
      } else {
        setPharmacies(data || [])
      }
    } catch (err) {
      console.error('Error fetching pharmacies:', err)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    if (isOpen) fetchData()
  }, [isOpen, fetchData])

  const handleAdd = async () => {
    if (!newPharm.name.trim()) return
    try {
      const { error } = await supabase.from('patient_pharmacies').insert({
        patient_id: patientId,
        name: newPharm.name,
        phone: newPharm.phone || null,
        fax: newPharm.fax || null,
        address: newPharm.address || null,
        city: newPharm.city || null,
        state: newPharm.state || null,
        zip: newPharm.zip || null,
        ncpdp_id: newPharm.ncpdp_id || null,
        is_preferred: pharmacies.length === 0,
      })
      if (error) throw error
      setNewPharm({ name: '', phone: '', fax: '', address: '', city: '', state: '', zip: '', ncpdp_id: '' })
      setAdding(false)
      fetchData()
    } catch (err) {
      console.error('Error adding pharmacy:', err)
    }
  }

  const handleSetPreferred = async (id: string) => {
    try {
      // Unset all, then set the selected one
      await supabase.from('patient_pharmacies').update({ is_preferred: false }).eq('patient_id', patientId)
      await supabase.from('patient_pharmacies').update({ is_preferred: true }).eq('id', id)
      fetchData()
    } catch (err) {
      console.error('Error setting preferred:', err)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('patient_pharmacies').delete().eq('id', id)
      setPharmacies(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      console.error('Error deleting pharmacy:', err)
    }
  }

  return (
    <DraggableOverlayWrapper
      panelId="pharmacy"
      isOpen={isOpen}
      onClose={onClose}
      title="Pharmacies"
      subtitle={patientName ? `${patientName} • ${pharmacies.length} pharmacies` : undefined}
      icon={<Building2 className="w-4 h-4" />}
      defaultTheme="teal"
      defaultWidth={500}
      headerActions={
        <button onClick={() => setAdding(v => !v)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors">
          <Plus className="w-3.5 h-3.5 text-white/60" />
        </button>
      }
    >
      <div className="p-4 space-y-3">
        {adding && (
          <div className="bg-white/5 rounded-xl border border-white/10 p-3 space-y-2">
            <input placeholder="Pharmacy name..." value={newPharm.name} onChange={e => setNewPharm(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:border-teal-500/50 focus:outline-none" autoFocus />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Phone" value={newPharm.phone} onChange={e => setNewPharm(p => ({ ...p, phone: e.target.value }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none" />
              <input placeholder="Fax" value={newPharm.fax} onChange={e => setNewPharm(p => ({ ...p, fax: e.target.value }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none" />
            </div>
            <input placeholder="Address" value={newPharm.address} onChange={e => setNewPharm(p => ({ ...p, address: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none" />
            <div className="grid grid-cols-3 gap-2">
              <input placeholder="City" value={newPharm.city} onChange={e => setNewPharm(p => ({ ...p, city: e.target.value }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none" />
              <input placeholder="State" value={newPharm.state} onChange={e => setNewPharm(p => ({ ...p, state: e.target.value }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none" />
              <input placeholder="ZIP" value={newPharm.zip} onChange={e => setNewPharm(p => ({ ...p, zip: e.target.value }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs text-white/50 hover:text-white">Cancel</button>
              <button onClick={handleAdd} className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg hover:bg-teal-700">Add Pharmacy</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-white/40 animate-spin" /></div>
        ) : pharmacies.length === 0 ? (
          <div className="text-center py-8 text-white/40 text-sm">No pharmacies on file</div>
        ) : (
          <div className="space-y-2">
            {pharmacies.map(pharm => (
              <div key={pharm.id} className={`bg-white/5 rounded-xl border ${pharm.is_preferred ? 'border-teal-500/30' : 'border-white/5'} p-3 group hover:border-white/10 transition-colors`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{pharm.name}</span>
                      {pharm.is_preferred && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded">
                          <Star className="w-2.5 h-2.5" />Preferred
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {pharm.phone && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-white/40">
                          <Phone className="w-2.5 h-2.5" />{pharm.phone}
                        </span>
                      )}
                      {pharm.address && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-white/40">
                          <MapPin className="w-2.5 h-2.5" />{[pharm.address, pharm.city, pharm.state, pharm.zip].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {pharm.ncpdp_id && <span className="text-[10px] font-mono text-white/30">NCPDP: {pharm.ncpdp_id}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!pharm.is_preferred && (
                      <button onClick={() => handleSetPreferred(pharm.id)} className="w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-teal-500/20 transition-all" title="Set as preferred">
                        <Star className="w-3 h-3 text-teal-400" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(pharm.id)} className="w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all">
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DraggableOverlayWrapper>
  )
}
