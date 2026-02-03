'use client'

/**
 * Route: /consultation/[id]
 * 
 * Standalone consultation window — opens in its own browser tab/window.
 * Usage from dashboard: 
 *   window.open(`/consultation/${appointmentId}`, 'consultation', 
 *     'width=1200,height=800,menubar=no,toolbar=no,location=no')
 */

import { useParams } from 'next/navigation'
import ConsultationPage from '@/components/ConsultationPage'

export default function ConsultationRoute() {
  const params = useParams()
  const id = params?.id as string

  if (!id) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0a1018' }}>
        <div className="text-red-400 text-sm">No appointment ID provided</div>
      </div>
    )
  }

  return <ConsultationPage appointmentId={id} />
}
