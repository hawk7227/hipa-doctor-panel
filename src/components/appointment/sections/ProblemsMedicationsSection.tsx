// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import React, { memo, useState, useCallback, useRef } from 'react'
import { GripVertical, Activity, X } from 'lucide-react'

interface ProblemsMedicationsSectionProps {
  activeProblems: Array<{id: string, problem: string, since: string}>
  resolvedProblems: Array<{id: string, problem: string, resolvedDate: string}>
  medicationHistory: Array<{id: string, medication: string, provider: string, date: string}>
  activeMedOrders: Array<{id: string, medication: string, sig: string, status: string}>
  pastMedOrders: Array<{id: string, medication: string, sig: string, date: string}>
  prescriptionLogs: Array<{id: string, date: string, medication: string, quantity: string, pharmacy: string, status: string}>
  savingProblems: boolean
  isCustomizeMode?: boolean
  sectionProps?: any
  sectionId?: string
  onAddActiveProblem: (problem: string, since: string) => void
  onRemoveActiveProblem: (id: string) => void
  onAddResolvedProblem: (problem: string, resolvedDate: string) => void
  onRemoveResolvedProblem: (id: string) => void
  onAddMedicationHistory: (medication: string, provider: string, date: string) => void
  onRemoveMedicationHistory: (id: string) => void
  onAddPrescriptionLog: (medication: string, quantity: string, pharmacy: string, date: string) => void
  onRemovePrescriptionLog: (id: string) => void
  onMoveToPastOrders?: (id: string) => void
}

const ProblemsMedicationsSection = memo(function ProblemsMedicationsSection({
  activeProblems,
  resolvedProblems,
  medicationHistory,
  activeMedOrders,
  pastMedOrders,
  prescriptionLogs,
  savingProblems,
  isCustomizeMode = false,
  sectionProps = {},
  sectionId = 'problems-medications',
  onAddActiveProblem,
  onRemoveActiveProblem,
  onAddResolvedProblem,
  onRemoveResolvedProblem,
  onAddMedicationHistory,
  onRemoveMedicationHistory,
  onAddPrescriptionLog,
  onRemovePrescriptionLog,
  onMoveToPastOrders
}: ProblemsMedicationsSectionProps) {
  // LOCAL STATE for input fields - this prevents parent re-renders on every keystroke!
  const [activeProblemInput, setActiveProblemInput] = useState({ problem: '', since: '' })
  const [resolvedProblemInput, setResolvedProblemInput] = useState({ problem: '', resolvedDate: '' })
  const [medHistoryInput, setMedHistoryInput] = useState({ medication: '', provider: '', date: '' })
  const [prescriptionLogInput, setPrescriptionLogInput] = useState({ medication: '', quantity: '', pharmacy: '', date: '' })

  // Handle add actions - sync with parent and clear local state
  const handleAddActiveProblem = useCallback(() => {
    if (!activeProblemInput.problem.trim()) return
    onAddActiveProblem(activeProblemInput.problem.trim(), activeProblemInput.since.trim())
    setActiveProblemInput({ problem: '', since: '' })
  }, [activeProblemInput, onAddActiveProblem])

  const handleAddResolvedProblem = useCallback(() => {
    if (!resolvedProblemInput.problem.trim()) return
    onAddResolvedProblem(resolvedProblemInput.problem.trim(), resolvedProblemInput.resolvedDate.trim())
    setResolvedProblemInput({ problem: '', resolvedDate: '' })
  }, [resolvedProblemInput, onAddResolvedProblem])

  const handleAddMedHistory = useCallback(() => {
    if (!medHistoryInput.medication.trim()) return
    onAddMedicationHistory(
      medHistoryInput.medication.trim(),
      medHistoryInput.provider.trim() || 'External Provider',
      medHistoryInput.date.trim()
    )
    setMedHistoryInput({ medication: '', provider: '', date: '' })
  }, [medHistoryInput, onAddMedicationHistory])

  const handleAddPrescriptionLog = useCallback(() => {
    if (!prescriptionLogInput.medication.trim()) return
    onAddPrescriptionLog(
      prescriptionLogInput.medication.trim(),
      prescriptionLogInput.quantity.trim(),
      prescriptionLogInput.pharmacy.trim(),
      prescriptionLogInput.date.trim() || new Date().toISOString().split('T')[0]
    )
    setPrescriptionLogInput({ medication: '', quantity: '', pharmacy: '', date: '' })
  }, [prescriptionLogInput, onAddPrescriptionLog])

  return (
    <div {...sectionProps} style={{ contain: 'layout style paint' }}>
      {isCustomizeMode && (
        <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-white/10">
        <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
          Problems & Medications
        </h3>
        
        <div className="space-y-6">
          {/* Active Problems */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-white">Active Problems</label>
              <button
                onClick={handleAddActiveProblem}
                disabled={!activeProblemInput.problem.trim() || savingProblems}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
              >
                + Add
              </button>
            </div>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={activeProblemInput.problem}
                onChange={(e) => setActiveProblemInput(prev => ({ ...prev, problem: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddActiveProblem()}
                placeholder="e.g., Type 2 Diabetes Mellitus"
                className="flex-1 h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              />
              <input
                type="text"
                value={activeProblemInput.since}
                onChange={(e) => setActiveProblemInput(prev => ({ ...prev, since: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddActiveProblem()}
                placeholder="since 2019"
                className="w-32 h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              />
            </div>
            <div className="space-y-2">
              {activeProblems.map((problem) => (
                <div key={problem.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg border border-white/10">
                  <span className="text-sm text-white">
                    {problem.problem}{problem.since && ` — since ${problem.since}`}
                  </span>
                  <button
                    onClick={() => onRemoveActiveProblem(problem.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Resolved Problems */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-white">Resolved Problems</label>
              <button
                onClick={handleAddResolvedProblem}
                disabled={!resolvedProblemInput.problem.trim() || savingProblems}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
              >
                + Add
              </button>
            </div>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={resolvedProblemInput.problem}
                onChange={(e) => setResolvedProblemInput(prev => ({ ...prev, problem: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddResolvedProblem()}
                placeholder="e.g., Acne"
                className="flex-1 h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              />
              <input
                type="text"
                value={resolvedProblemInput.resolvedDate}
                onChange={(e) => setResolvedProblemInput(prev => ({ ...prev, resolvedDate: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddResolvedProblem()}
                placeholder="resolved 2023"
                className="w-36 h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              />
            </div>
            <div className="space-y-2">
              {resolvedProblems.map((problem) => (
                <div key={problem.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg border border-white/10">
                  <span className="text-sm text-white">
                    {problem.problem}{problem.resolvedDate && ` — resolved ${problem.resolvedDate}`}
                  </span>
                  <button
                    onClick={() => onRemoveResolvedProblem(problem.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Medication History */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-white">Medication History (Surescripts)</label>
              <button
                onClick={handleAddMedHistory}
                disabled={!medHistoryInput.medication.trim() || savingProblems}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
              >
                + Add
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <input
                type="text"
                value={medHistoryInput.medication}
                onChange={(e) => setMedHistoryInput(prev => ({ ...prev, medication: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddMedHistory()}
                placeholder="e.g., Atorvastatin 20mg"
                className="col-span-2 h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              />
              <input
                type="text"
                value={medHistoryInput.provider}
                onChange={(e) => setMedHistoryInput(prev => ({ ...prev, provider: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddMedHistory()}
                placeholder="Provider"
                className="h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              />
              <input
                type="date"
                value={medHistoryInput.date}
                onChange={(e) => setMedHistoryInput(prev => ({ ...prev, date: e.target.value }))}
                className="col-span-3 h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              />
            </div>
            <div className="space-y-2">
              {medicationHistory.map((med) => (
                <div key={med.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg border border-white/10">
                  <span className="text-sm text-white">
                    {med.medication} — {med.provider}{med.date && ` — ${med.date}`}
                  </span>
                  <button
                    onClick={() => onRemoveMedicationHistory(med.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Active Medication Orders */}
          <div>
            <label className="text-sm font-semibold text-white block mb-2">Active Medication Orders</label>
            <div className="space-y-2">
              {activeMedOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg border border-white/10">
                  <span className="text-sm text-white">
                    {order.medication}{order.sig && ` — ${order.sig}`} — {order.status}
                  </span>
                  {onMoveToPastOrders && (
                    <button
                      onClick={() => onMoveToPastOrders(order.id)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Archive
                    </button>
                  )}
                </div>
              ))}
              {activeMedOrders.length === 0 && (
                <p className="text-xs text-gray-400">No active orders. Prescriptions sent from eRx Composer will appear here.</p>
              )}
            </div>
          </div>

          {/* Past Medication Orders */}
          <div>
            <label className="text-sm font-semibold text-white block mb-2">Past Medication Orders</label>
            <div className="space-y-2">
              {pastMedOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg border border-white/10">
                  <span className="text-sm text-white">
                    {order.medication}{order.sig && ` — ${order.sig}`}{order.date && ` — ${order.date}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Prescription Logs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-white">Prescription Logs</label>
              <button
                onClick={handleAddPrescriptionLog}
                disabled={!prescriptionLogInput.medication.trim() || savingProblems}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
              >
                + Add
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              <input
                type="date"
                value={prescriptionLogInput.date}
                onChange={(e) => setPrescriptionLogInput(prev => ({ ...prev, date: e.target.value }))}
                className="h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              />
              <input
                type="text"
                value={prescriptionLogInput.medication}
                onChange={(e) => setPrescriptionLogInput(prev => ({ ...prev, medication: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPrescriptionLog()}
                placeholder="Medication"
                className="h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              />
              <input
                type="text"
                value={prescriptionLogInput.quantity}
                onChange={(e) => setPrescriptionLogInput(prev => ({ ...prev, quantity: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPrescriptionLog()}
                placeholder="Quantity"
                className="h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              />
              <input
                type="text"
                value={prescriptionLogInput.pharmacy}
                onChange={(e) => setPrescriptionLogInput(prev => ({ ...prev, pharmacy: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPrescriptionLog()}
                placeholder="Pharmacy"
                className="h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              />
            </div>
            <div className="space-y-2">
              {prescriptionLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg border border-white/10">
                  <span className="text-sm text-white">
                    {log.date} — {log.medication} #{log.quantity} — {log.pharmacy} — {log.status}
                  </span>
                  <button
                    onClick={() => onRemovePrescriptionLog(log.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {savingProblems && (
            <div className="flex items-center gap-2 text-xs text-cyan-400">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-cyan-400"></div>
              <span>Saving...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Only re-render when list data or saving status changes
  // Input state is now LOCAL so it doesn't trigger re-renders
  // Use length and ID checks for arrays instead of === (which always fails for new array refs)
  const arraysEqual = (a: any[], b: any[], name: string) => {
    if (a.length !== b.length) {
      console.log(`[ProblemsMedicationsSection] Memo: ${name} length changed: ${a.length} → ${b.length}`)
      return false
    }
    if (a.length === 0) return true
    // Quick check: compare first and last IDs
    const equal = a[0]?.id === b[0]?.id && a[a.length - 1]?.id === b[b.length - 1]?.id
    if (!equal) {
      console.log(`[ProblemsMedicationsSection] Memo: ${name} IDs changed`, {
        prevFirst: a[0]?.id,
        nextFirst: b[0]?.id,
        prevLast: a[a.length - 1]?.id,
        nextLast: b[b.length - 1]?.id
      })
    }
    return equal
  }
  
  const shouldSkipRender = (
    arraysEqual(prevProps.activeProblems, nextProps.activeProblems, 'activeProblems') &&
    arraysEqual(prevProps.resolvedProblems, nextProps.resolvedProblems, 'resolvedProblems') &&
    arraysEqual(prevProps.medicationHistory, nextProps.medicationHistory, 'medicationHistory') &&
    arraysEqual(prevProps.activeMedOrders, nextProps.activeMedOrders, 'activeMedOrders') &&
    arraysEqual(prevProps.pastMedOrders, nextProps.pastMedOrders, 'pastMedOrders') &&
    arraysEqual(prevProps.prescriptionLogs, nextProps.prescriptionLogs, 'prescriptionLogs') &&
    prevProps.savingProblems === nextProps.savingProblems &&
    prevProps.isCustomizeMode === nextProps.isCustomizeMode
  )
  
  return shouldSkipRender
})

export default ProblemsMedicationsSection
