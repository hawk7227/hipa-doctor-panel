// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import React from 'react'
import { FileText, Download } from 'lucide-react'
import type { LabResult } from '../hooks/useLabResults'
import ChartFileUpload from '../../ChartFileUpload'

interface LabResultsSectionProps {
  labResults: LabResult[]
  isLoadingLabs: boolean
  isCustomizeMode: boolean
  sectionProps: any
  onLoadLabResults: () => void
  patientId?: string
  appointmentId?: string
}

export default function LabResultsSection({
  labResults,
  isLoadingLabs,
  isCustomizeMode,
  sectionProps,
  onLoadLabResults,
  patientId,
  appointmentId
}: LabResultsSectionProps) {
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
            <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
            Lab Results
          </h3>
          <button
            onClick={onLoadLabResults}
            disabled={isLoadingLabs}
            className="px-3 py-1.5 text-xs bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            {isLoadingLabs ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
            ) : (
              <Download className="h-3 w-3" />
            )}
            Import Labs
          </button>
        </div>
        {labResults.length > 0 ? (
          <div className="space-y-2">
            {labResults.map(lab => {
              // Use displayStatus for UI colors (if available), otherwise use status
              const displayStatus = lab.displayStatus || (lab.status === 'final' ? 'normal' : 'pending')
              return (
                <div
                  key={lab.id}
                  className={`p-3 rounded-lg border ${
                    displayStatus === 'critical'
                      ? 'bg-red-500/10 border-red-500/30'
                      : displayStatus === 'abnormal'
                      ? 'bg-yellow-500/10 border-yellow-500/30'
                      : lab.status === 'pending'
                      ? 'bg-gray-500/10 border-gray-500/30'
                      : 'bg-green-500/10 border-green-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium text-sm">{lab.test_name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        displayStatus === 'critical'
                          ? 'bg-red-600 text-white'
                          : displayStatus === 'abnormal'
                          ? 'bg-yellow-600 text-white'
                          : lab.status === 'pending'
                          ? 'bg-gray-600 text-white'
                          : 'bg-green-600 text-white'
                      }`}
                    >
                      {lab.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-1 text-sm">
                    <span className={displayStatus !== 'normal' && lab.status !== 'pending' ? 'text-red-400 font-semibold' : 'text-white'}>
                      {lab.result_value || 'Pending'} {lab.unit || ''}
                    </span>
                    {lab.reference_range && (
                      <span className="text-gray-400 ml-2">(Ref: {lab.reference_range})</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(lab.created_at).toLocaleDateString()} • {lab.ordered_by || 'Unknown'}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-4">
            No lab results available. Click "Import Labs" to fetch from lab system.
          </p>
        )}

        {/* File Uploads */}
        {patientId && appointmentId && (
          <ChartFileUpload patientId={patientId} appointmentId={appointmentId} section="labs" />
        )}
      </div>
    </div>
  )
}


