'use client'
import React, { lazy, Suspense } from 'react'
import { MessageSquare } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string; appointmentId?: string }

// Lazy load the heavy communication component
const UnifiedCommHub = lazy(() => import('@/components/UnifiedCommHub'))

export default function CommHubPanelV2({ isOpen, onClose, patientId, patientName, appointmentId }: Props) {
  if (!isOpen) return null
  return (
    <PanelBase title={`Communications — ${patientName}`} icon={MessageSquare} accentColor="#3b82f6" loading={false} error={null}
      hasData={true} onClose={onClose} draggable={false}>
      <Suspense fallback={<div className="p-4 text-center text-gray-500 text-sm">Loading communications...</div>}>
        <UnifiedCommHub isOpen={true} onClose={onClose} patientId={patientId} patientName={patientName} appointmentId={appointmentId} />
      </Suspense>
    </PanelBase>
  )
}
