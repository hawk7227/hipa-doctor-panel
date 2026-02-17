// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import React from 'react'
import { Shield } from 'lucide-react'
import type { PriorAuth } from '../hooks/usePriorAuth'
import ChartFileUpload from '../../ChartFileUpload'

interface PriorAuthSectionProps {
  priorAuths: PriorAuth[]
  showPriorAuthForm: boolean
  setShowPriorAuthForm: (show: boolean) => void
  newPriorAuth: {
    medication: string
    insurance: string
    notes: string
  }
  setNewPriorAuth: (auth: any) => void
  isSubmitting: boolean
  isCustomizeMode: boolean
  sectionProps: any
  onSubmitPriorAuth: () => Promise<void>
  error?: string | null
  patientId?: string
  appointmentId?: string
}

export default function PriorAuthSection({
  priorAuths,
  showPriorAuthForm,
  setShowPriorAuthForm,
  newPriorAuth,
  setNewPriorAuth,
  isSubmitting,
  isCustomizeMode,
  sectionProps,
  onSubmitPriorAuth,
  error,
  patientId,
  appointmentId
}: PriorAuthSectionProps) {
  return (
    <div {...sectionProps}>
      {isCustomizeMode && (
        <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
      )}
      <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
            Prior Authorization
          </h3>
          <button
            onClick={() => setShowPriorAuthForm(!showPriorAuthForm)}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            {showPriorAuthForm ? 'Cancel' : '+ New PA'}
          </button>
        </div>
        
        {showPriorAuthForm && (
          <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg space-y-2">
            <input
              type="text"
              placeholder="Medication requiring PA"
              value={newPriorAuth.medication}
              onChange={(e) => setNewPriorAuth({ ...newPriorAuth, medication: e.target.value })}
              className="w-full h-8 px-2 rounded border border-white/20 bg-slate-700/50 text-white text-sm placeholder-gray-400"
            />
            <input
              type="text"
              placeholder="Insurance Provider"
              value={newPriorAuth.insurance}
              onChange={(e) => setNewPriorAuth({ ...newPriorAuth, insurance: e.target.value })}
              className="w-full h-8 px-2 rounded border border-white/20 bg-slate-700/50 text-white text-sm placeholder-gray-400"
            />
            <textarea
              placeholder="Clinical justification"
              value={newPriorAuth.notes}
              onChange={(e) => setNewPriorAuth({ ...newPriorAuth, notes: e.target.value })}
              className="w-full px-2 py-1 rounded border border-white/20 bg-slate-700/50 text-white text-sm placeholder-gray-400 resize-none"
              rows={2}
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              onClick={onSubmitPriorAuth}
              disabled={isSubmitting}
              className="w-full py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Prior Auth'}
            </button>
          </div>
        )}

        {priorAuths.length > 0 ? (
          <div className="space-y-2">
            {priorAuths.map(pa => (
              <div key={pa.id} className={`p-3 rounded-lg border ${
                pa.status === 'approved' ? 'bg-green-500/10 border-green-500/30' :
                pa.status === 'denied' ? 'bg-red-500/10 border-red-500/30' :
                pa.status === 'appeal' ? 'bg-purple-500/10 border-purple-500/30' :
                'bg-yellow-500/10 border-yellow-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium text-sm">{pa.medication}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    pa.status === 'approved' ? 'bg-green-600' :
                    pa.status === 'denied' ? 'bg-red-600' :
                    pa.status === 'appeal' ? 'bg-purple-600' :
                    'bg-yellow-600'
                  } text-white`}>
                    {pa.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-1">{pa.insurance}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Submitted: {new Date(pa.submittedDate).toLocaleDateString()}
                  {pa.authNumber && <span className="ml-2">• Auth #: {pa.authNumber}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-4">No prior authorizations. Click "+ New PA" to submit one.</p>
        )}

        {/* File Uploads */}
        {patientId && appointmentId && (
          <ChartFileUpload patientId={patientId} appointmentId={appointmentId} section="prior-auth" />
        )}
      </div>
    </div>
  )
}


