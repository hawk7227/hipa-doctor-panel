// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'
import React from 'react'
import { Pill } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import MedicationsList from '@/components/medications/MedicationsList'
import { useMedications } from '@/hooks/useMedications'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

export default function MedicationsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { medications, loading, error, refresh } = useMedications(patientId)
  const activeCount = medications.filter(m => m.status === 'active').length

  if (!isOpen) return null

  return (
    <PanelBase title={`Medications — ${patientName}`} icon={Pill} accentColor="#8b5cf6" loading={loading}
      error={error} hasData={medications.length > 0} emptyMessage="No medications recorded"
      onRetry={refresh} onClose={onClose} draggable={false}
      badge={activeCount || undefined}>
      <MedicationsList patientId={patientId} patientName={patientName} />
    </PanelBase>
  )
}
