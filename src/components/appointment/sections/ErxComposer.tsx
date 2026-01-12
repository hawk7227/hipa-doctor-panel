import React, { memo, startTransition } from 'react'
import { GripVertical, Pill, Plus, Send, History, Edit, X, CheckCircle, XCircle, AlertCircle, ChevronRight, Loader2 } from 'lucide-react'

interface RxItem {
  id: string
  medication: string
  sig: string
  quantity: string
  refills: string
  pharmacy: string
  notes: string
  dbId?: string
}

interface ErxComposerProps {
  rxData: any
  rxList: RxItem[]
  recipientAddress: string
  editingRxId: string | null
  editingRxData: RxItem | null
  addingRx: boolean
  sendingRx: boolean
  showRxHistory: boolean
  isCustomizeMode?: boolean
  sectionProps?: any
  sectionId?: string
  onRxDataChange: (field: string, value: string) => void
  onRecipientAddressChange: (value: string) => void
  onAddToRxList: () => void
  onRemoveFromRxList: (id: string, dbId?: string) => void
  onClearRxList: () => void
  onStartEditRx: (id: string) => void
  onCancelEditRx: () => void
  onSaveEditRx: (id: string) => void
  onEditingRxDataChange: (data: RxItem) => void
  onSendERx: () => void
  onToggleRxHistory: () => void
  rxHistory?: any[]
  drugInteractions?: any[]
  isCheckingInteractions?: boolean
  onCheckDrugInteractions?: () => void
  favoriteMedications?: any[]
  showFavoritesDropdown?: boolean
  onSelectFavoriteMedication?: (favorite: any) => void
  onAddToFavorites?: () => void
  onToggleFavoritesDropdown?: () => void
}

const ErxComposer = memo(function ErxComposer({
  rxData,
  rxList,
  recipientAddress,
  editingRxId,
  editingRxData,
  addingRx,
  sendingRx,
  showRxHistory,
  isCustomizeMode = false,
  sectionProps = {},
  sectionId = 'erx-composer',
  onRxDataChange,
  onRecipientAddressChange,
  onAddToRxList,
  onRemoveFromRxList,
  onClearRxList,
  onStartEditRx,
  onCancelEditRx,
  onSaveEditRx,
  onEditingRxDataChange,
  onSendERx,
  onToggleRxHistory,
  rxHistory = [],
  drugInteractions = [],
  isCheckingInteractions = false,
  onCheckDrugInteractions,
  favoriteMedications = [],
  showFavoritesDropdown = false,
  onSelectFavoriteMedication,
  onAddToFavorites,
  onToggleFavoritesDropdown
}: ErxComposerProps) {
  return (
    <div {...sectionProps} style={{ contain: 'layout style paint' }}>
      {isCustomizeMode && (
        <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Pill className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
            eRx Composer
          </h3>
          {onCheckDrugInteractions && (
            <button
              onClick={onCheckDrugInteractions}
              disabled={isCheckingInteractions}
              className="px-2 py-1 text-xs bg-yellow-600/20 text-yellow-400 rounded hover:bg-yellow-600/30 transition-colors flex items-center gap-1"
              title="Check drug interactions"
            >
              {isCheckingInteractions ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <AlertCircle className="h-3 w-3" />
              )}
              Check Interactions
            </button>
          )}
        </div>

        {/* Drug Interaction Alerts */}
        {drugInteractions && drugInteractions.length > 0 && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <span className="text-sm font-semibold text-red-400">Drug Interactions Detected</span>
            </div>
            <div className="space-y-2">
              {drugInteractions.map((interaction: any) => (
                <div key={interaction.id} className={`p-2 rounded text-xs ${
                  interaction.severity === 'severe' ? 'bg-red-500/20 text-red-300' :
                  interaction.severity === 'moderate' ? 'bg-yellow-500/20 text-yellow-300' :
                  'bg-blue-500/20 text-blue-300'
                }`}>
                  <div className="font-semibold">{interaction.drug1} + {interaction.drug2}</div>
                  <div className="mt-1">{interaction.description}</div>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                    interaction.severity === 'severe' ? 'bg-red-600 text-white' :
                    interaction.severity === 'moderate' ? 'bg-yellow-600 text-white' :
                    'bg-blue-600 text-white'
                  }`}>
                    {interaction.severity.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Favorite Medications Dropdown */}
        {favoriteMedications && favoriteMedications.length > 0 && onToggleFavoritesDropdown && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-400">⭐ Favorite Medications</label>
              {rxData.medication && onAddToFavorites && (
                <button
                  onClick={onAddToFavorites}
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                >
                  + Add Current to Favorites
                </button>
              )}
            </div>
            <div className="relative">
              <button
                onClick={onToggleFavoritesDropdown}
                className="w-full h-9 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white text-sm text-left flex items-center justify-between hover:border-cyan-500/50 transition-colors"
              >
                <span className="text-gray-400">Select from favorites...</span>
                <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${showFavoritesDropdown ? 'rotate-90' : ''}`} />
              </button>
              {showFavoritesDropdown && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-slate-800 border border-white/20 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                  {favoriteMedications.map((fav: any) => (
                    <button
                      key={fav.id}
                      onClick={() => onSelectFavoriteMedication?.(fav)}
                      className="w-full p-3 text-left hover:bg-white/5 border-b border-white/5 last:border-0"
                    >
                      <div className="text-sm text-white font-medium">{fav.medication}</div>
                      <div className="text-xs text-gray-400 mt-1">{fav.sig}</div>
                      <div className="text-xs text-gray-500 mt-1">Qty: {fav.qty} | Refills: {fav.refills} | Used: {fav.useCount || 0}x</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm text-gray-400 mb-2">
              Recipient Direct Address <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => {
                startTransition(() => {
                  onRecipientAddressChange(e.target.value)
                })
              }}
              placeholder="pharmacy@example.direct.com"
              className="w-full h-8 sm:h-9 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
              style={{ contain: 'layout style' }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Direct messaging address for pharmacy or provider
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
            <span className="text-white text-sm sm:text-base">Medication:</span>
            <input
              type="text"
              value={rxData.medication}
              onChange={(e) => {
                startTransition(() => {
                  onRxDataChange('medication', e.target.value)
                })
              }}
              className="flex-1 h-8 sm:h-9 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
              style={{ contain: 'layout style' }}
            />
            <span className="text-white text-sm sm:text-base">×</span>
            <input
              type="text"
              value={rxData.sig}
              onChange={(e) => {
                startTransition(() => {
                  onRxDataChange('sig', e.target.value)
                })
              }}
              placeholder="e.g., BID × 5 days"
              className="flex-1 h-8 sm:h-9 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
              style={{ contain: 'layout style' }}
            />
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
            <span className="text-white text-sm sm:text-base">Qty:</span>
            <input
              type="text"
              value={rxData.quantity}
              onChange={(e) => {
                startTransition(() => {
                  onRxDataChange('quantity', e.target.value)
                })
              }}
              className="w-16 sm:w-20 h-8 sm:h-9 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
              style={{ contain: 'layout style' }}
            />
            <span className="text-white text-sm sm:text-base">Refills:</span>
            <input
              type="text"
              value={rxData.refills}
              onChange={(e) => {
                startTransition(() => {
                  onRxDataChange('refills', e.target.value)
                })
              }}
              className="w-16 sm:w-20 h-8 sm:h-9 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
              style={{ contain: 'layout style' }}
            />
            <span className="text-white text-sm sm:text-base">Notes:</span>
            <input
              type="text"
              value={rxData.notes}
              onChange={(e) => {
                startTransition(() => {
                  onRxDataChange('notes', e.target.value)
                })
              }}
              placeholder="Additional instructions (e.g., Generic allowed, Take with food)"
              className="flex-1 h-8 sm:h-9 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
              style={{ contain: 'layout style' }}
            />
          </div>

          {rxList.length > 0 && (
            <div className="mt-4 p-3 sm:p-4 bg-slate-700/50 rounded-lg border border-cyan-500/30">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-white font-semibold">
                  Medications to Send ({rxList.length})
                </div>
                <button
                  onClick={onClearRxList}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {rxList.map((rx) => (
                  <div key={rx.id} className="p-4 sm:p-5 bg-slate-600/50 rounded-lg border border-white/10">
                    {editingRxId === rx.id && editingRxData ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-white/10">
                          <h4 className="text-white font-semibold text-base">Edit Medication</h4>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onSaveEditRx(rx.id)}
                              className="p-2 text-green-400 hover:text-green-300 transition-colors rounded hover:bg-green-400/10"
                            >
                              <CheckCircle className="h-5 w-5" />
                            </button>
                            <button
                              onClick={onCancelEditRx}
                              className="p-2 text-gray-400 hover:text-gray-300 transition-colors rounded hover:bg-gray-400/10"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {/* Medication Name */}
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Medication</label>
                            <input
                              type="text"
                              value={editingRxData.medication}
                              onChange={(e) => onEditingRxDataChange({ ...editingRxData, medication: e.target.value })}
                              className="w-full h-10 px-3 rounded-lg border border-white/20 bg-slate-700/70 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
                              placeholder="Enter medication name"
                              style={{ contain: 'layout style' }}
                            />
                          </div>
                          
                          {/* Sig (Dosage Instructions) */}
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Sig (Dosage)</label>
                            <input
                              type="text"
                              value={editingRxData.sig}
                              onChange={(e) => onEditingRxDataChange({ ...editingRxData, sig: e.target.value })}
                              className="w-full h-10 px-3 rounded-lg border border-white/20 bg-slate-700/70 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
                              placeholder="e.g., BID × 5 days"
                              style={{ contain: 'layout style' }}
                            />
                          </div>
                          
                          {/* Quantity and Refills Row */}
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label className="block text-xs text-gray-400 mb-1">Quantity</label>
                              <input
                                type="text"
                                value={editingRxData.quantity}
                                onChange={(e) => onEditingRxDataChange({ ...editingRxData, quantity: e.target.value })}
                                className="w-full h-10 px-3 rounded-lg border border-white/20 bg-slate-700/70 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
                                placeholder="30"
                                style={{ contain: 'layout style' }}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs text-gray-400 mb-1">Refills</label>
                              <input
                                type="text"
                                value={editingRxData.refills}
                                onChange={(e) => onEditingRxDataChange({ ...editingRxData, refills: e.target.value })}
                                className="w-full h-10 px-3 rounded-lg border border-white/20 bg-slate-700/70 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
                                placeholder="0"
                                style={{ contain: 'layout style' }}
                              />
                            </div>
                          </div>
                          
                          {/* Notes */}
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Notes</label>
                            <textarea
                              value={editingRxData.notes}
                              onChange={(e) => onEditingRxDataChange({ ...editingRxData, notes: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg border border-white/20 bg-slate-700/70 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base resize-none"
                              placeholder="Additional instructions (e.g., Take with food)"
                              rows={2}
                              style={{ contain: 'layout style' }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium text-sm sm:text-base mb-2">
                            {rx.medication}
                          </div>
                          <div className="text-gray-300 text-xs space-y-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span><strong className="text-gray-400">Sig:</strong> <span className="text-white">{rx.sig}</span></span>
                              <span><strong className="text-gray-400">Qty:</strong> <span className="text-white">{rx.quantity}</span></span>
                              {rx.refills !== '0' && <span><strong className="text-gray-400">Refills:</strong> <span className="text-white">{rx.refills}</span></span>}
                            </div>
                            {rx.notes && (
                              <div className="mt-1 pt-1 border-t border-white/10">
                                <strong className="text-gray-400">Notes:</strong> <span className="text-white">{rx.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => onStartEditRx(rx.id)}
                            className="p-1.5 text-cyan-400 hover:text-cyan-300 transition-colors rounded hover:bg-cyan-400/10"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onRemoveFromRxList(rx.id, rx.dbId)}
                            className="p-1.5 text-red-400 hover:text-red-300 transition-colors rounded hover:bg-red-400/10"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
            <button
              onClick={onAddToRxList}
              disabled={addingRx || !rxData.medication || !rxData.sig}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm"
            >
              {addingRx ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Add to List
                </>
              )}
            </button>
            <button
              onClick={onSendERx}
              disabled={sendingRx || rxList.length === 0}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm"
            >
              {sendingRx ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {rxList.length > 0 ? `Send ${rxList.length} eRx` : 'Send eRx'}
                </>
              )}
            </button>
            <button
              onClick={onToggleRxHistory}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs sm:text-sm"
            >
              <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              View Recent Prescriptions
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.rxList.length === nextProps.rxList.length &&
    prevProps.rxData.medication === nextProps.rxData.medication &&
    prevProps.rxData.sig === nextProps.rxData.sig &&
    prevProps.recipientAddress === nextProps.recipientAddress &&
    prevProps.editingRxId === nextProps.editingRxId &&
    prevProps.editingRxData === nextProps.editingRxData &&
    prevProps.editingRxData?.medication === nextProps.editingRxData?.medication &&
    prevProps.editingRxData?.sig === nextProps.editingRxData?.sig &&
    prevProps.editingRxData?.quantity === nextProps.editingRxData?.quantity &&
    prevProps.editingRxData?.refills === nextProps.editingRxData?.refills &&
    prevProps.editingRxData?.notes === nextProps.editingRxData?.notes &&
    prevProps.addingRx === nextProps.addingRx &&
    prevProps.sendingRx === nextProps.sendingRx &&
    prevProps.isCustomizeMode === nextProps.isCustomizeMode
  )
})

export default ErxComposer
