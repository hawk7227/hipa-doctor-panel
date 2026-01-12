import React, { memo, useMemo } from 'react'

interface CDSSPanelProps {
  cdssResponse: any
  showCDSSResults: boolean
  isApplyingCDSS?: boolean
  onApplyCDSS?: () => void
  onCloseCDSS?: () => void
  appointmentLocked?: boolean
}

const CDSSPanel = memo(
  function CDSSPanel({
    cdssResponse,
    showCDSSResults,
    isApplyingCDSS = false,
    onApplyCDSS,
    onCloseCDSS,
    appointmentLocked = false
  }: CDSSPanelProps) {
    // 🚫 Hard guard – prevents any render work
    if (!showCDSSResults || !cdssResponse) return null

    const medications = cdssResponse?.medication_suggestions?.medications || []

    const medList = useMemo(() => {
      return medications.map((med: any, idx: number) => (
        <div
          key={idx}
          className="p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs"
        >
          <div className="font-medium text-blue-300 mb-1">
            {med.medication}
          </div>
          {med.sig && <div><strong>SIG:</strong> {med.sig}</div>}
          {med.quantity && <div><strong>Quantity:</strong> {med.quantity}</div>}
          {med.refills !== undefined && (
            <div><strong>Refills:</strong> {med.refills}</div>
          )}
          {med.notes && (
            <div className="mt-1 text-amber-300">
              <strong>Notes:</strong> {med.notes}
            </div>
          )}
        </div>
      ))
    }, [medications])

    return (
      <div className="mt-4 space-y-3 p-3 bg-slate-800/50 rounded-lg border border-purple-500/20">
        {/* Classification & Risk */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">Clinical Category</p>
            <p className="text-sm text-white font-medium">
              {cdssResponse.classification?.category || 'N/A'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {cdssResponse.classification?.description || ''}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1">Risk Level</p>
            <span
              className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                cdssResponse.risk_level === 'urgent_escalation'
                  ? 'bg-red-500/20 text-red-400'
                  : cdssResponse.risk_level === 'high_risk'
                  ? 'bg-orange-500/20 text-orange-400'
                  : cdssResponse.risk_level === 'moderate_risk'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-green-500/20 text-green-400'
              }`}
            >
              {cdssResponse.risk_level
                ?.replace('_', ' ')
                .toUpperCase() || 'N/A'}
            </span>
          </div>
        </div>

        {/* Medication Suggestions */}
        {medications.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-2">
              Medication Suggestions
            </p>
            <div className="space-y-2">{medList}</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/10">
          <button
            onClick={onApplyCDSS}
            disabled={appointmentLocked || isApplyingCDSS}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {isApplyingCDSS ? 'Applying...' : 'Apply to SOAP Notes'}
          </button>

          {onCloseCDSS && (
            <button
              onClick={onCloseCDSS}
              className="px-3 py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm"
            >
              Close
            </button>
          )}
        </div>
      </div>
    )
  },
  // 🔒 Custom comparator — prevents re-render on typing
  (prev, next) => {
    return (
      prev.showCDSSResults === next.showCDSSResults &&
      prev.isApplyingCDSS === next.isApplyingCDSS &&
      prev.appointmentLocked === next.appointmentLocked &&
      prev.cdssResponse?.id === next.cdssResponse?.id
    )
  }
)

export default CDSSPanel
