import React, { memo, useState, useEffect, useCallback, useRef } from 'react'
import { GripVertical, Shield, Brain, CheckCircle, FileImage, FileText, Eye, Download, X, Loader2 } from 'lucide-react'
import CDSSPanel from './CDSSPanel'

interface DoctorNotesSectionProps {
  appointment: any
  soapNotes: { chiefComplaint: string; rosGeneral: string; assessmentPlan: string }
  doctorNotes: string
  activeTab: 'SOAP' | 'Orders' | 'Files' | 'Notes' | 'Billing' | 'Audit'
  soapSaveStatus: 'saved' | 'saving' | 'idle'
  isSigning: boolean
  isCustomizeMode?: boolean
  sectionProps?: any
  sectionId?: string
  onSoapNotesChange: (field: 'chiefComplaint' | 'rosGeneral' | 'assessmentPlan', value: string) => void
  onDoctorNotesChange: (value: string) => void
  onTabChange: (tab: 'SOAP' | 'Orders' | 'Files' | 'Notes' | 'Billing' | 'Audit') => void
  onSignAndLock: () => void
  onGenerateCDSS?: () => void
  isGeneratingCDSS?: boolean
  showCDSSResults?: boolean
  cdssResponse?: any
  cdssError?: string | null
  onApplyCDSS?: () => void
  isApplyingCDSS?: boolean
  onCloseCDSS?: () => void
  appointmentDocuments?: any[]
  uploadingDocument?: boolean
  selectedDocument?: any | null
  uploadError?: string | null
  onDocumentUpload?: (event: React.ChangeEvent<HTMLInputElement>) => void
  onDocumentSelect?: (doc: any) => void
  onDocumentDownload?: (doc: any) => Promise<void>
}

const DoctorNotesSection = memo(function DoctorNotesSection({
  appointment,
  soapNotes,
  doctorNotes,
  activeTab,
  soapSaveStatus,
  isSigning,
  isCustomizeMode = false,
  sectionProps = {},
  sectionId = 'doctor-notes',
  onSoapNotesChange,
  onDoctorNotesChange,
  onTabChange,
  onSignAndLock,
  onGenerateCDSS,
  isGeneratingCDSS = false,
  showCDSSResults = false,
  cdssResponse,
  cdssError = null,
  onApplyCDSS,
  isApplyingCDSS = false,
  onCloseCDSS,
  appointmentDocuments = [],
  uploadingDocument = false,
  selectedDocument = null,
  uploadError,
  onDocumentUpload,
  onDocumentSelect,
  onDocumentDownload
}: DoctorNotesSectionProps) {
  // LOCAL STATE for text inputs - prevents parent re-renders on every keystroke
  const [localSoapNotes, setLocalSoapNotes] = useState(soapNotes)
  const [localDoctorNotes, setLocalDoctorNotes] = useState(doctorNotes)
  
const soapDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
useEffect(() => {
  setLocalSoapNotes(soapNotes)
}, [soapNotes])

  useEffect(() => {
    setLocalDoctorNotes(doctorNotes)
  }, [doctorNotes])

  // Debounced sync to parent for SOAP notes
  const handleSoapChange = useCallback((field: 'chiefComplaint' | 'rosGeneral' | 'assessmentPlan', value: string) => {
    // Immediate local update
    setLocalSoapNotes(prev => ({ ...prev, [field]: value }))
    
    // Debounced parent sync
    if (soapDebounceRef.current) clearTimeout(soapDebounceRef.current)
    soapDebounceRef.current = setTimeout(() => {
      onSoapNotesChange(field, value)
    }, 500)
  }, [onSoapNotesChange])

  // Debounced sync to parent for doctor notes
  const handleDoctorNotesChange = useCallback((value: string) => {
    // Immediate local update
    setLocalDoctorNotes(value)
    
    // Debounced parent sync
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current)
    notesDebounceRef.current = setTimeout(() => {
      onDoctorNotesChange(value)
    }, 500)
  }, [onDoctorNotesChange])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soapDebounceRef.current) clearTimeout(soapDebounceRef.current)
      if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current)
    }
  }, [])

  return (
    <div {...sectionProps} style={{ contain: 'contain' }}>
      {isCustomizeMode && (
        <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      <div className="bg-slate-800/50 rounded-2xl border border-white/10 overflow-hidden">
        <div className="flex border-b border-white/10 bg-slate-900/50">
          {(['SOAP', 'Orders', 'Files', 'Notes', 'Billing', 'Audit'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`flex-1 px-3 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'SOAP' && (
            <div className="space-y-4">
              {appointment?.is_locked && (
                <div className="p-3 bg-amber-900/30 border border-amber-500/50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-amber-400">
                    <Shield className="h-4 w-4" />
                    <span>Notes are locked and signed. Changes cannot be made.</span>
                  </div>
                </div>
              )}

              {onGenerateCDSS && (
                <div className="p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-purple-400" />
                      <h3 className="text-sm font-semibold text-white">Clinical Decision Support System (CDSS)</h3>
                    </div>
                    <button
                      onClick={() => {
                        if (onGenerateCDSS && !isGeneratingCDSS) {
                          onGenerateCDSS()
                        }
                      }}
                      disabled={isGeneratingCDSS || appointment?.is_locked}
                      className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-all text-sm font-medium ${
                        isGeneratingCDSS
                          ? 'bg-purple-700 cursor-wait'
                          : 'bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                    >
                      {isGeneratingCDSS ? (
                        <>
                          <svg
                            className="animate-spin h-5 w-5 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          <span>Generating CDSS...</span>
                        </>
                      ) : (
                        <>
                          <Brain className="h-5 w-5" />
                          <span>Generate CDSS</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    AI-powered clinical support: classification, risk assessment, and SOAP note templates. Provider must review and finalize all suggestions.
                  </p>

                  {/* CDSS Error Display */}
                  {cdssError && (
                    <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-red-400">
                        <X className="h-4 w-4" />
                        <span>{cdssError}</span>
                      </div>
                    </div>
                  )}

                  {/* CDSS Results Display */}
                  {/* 🔥 CRITICAL: CDSSPanel is memoized and isolated - it won't re-render on typing */}
                  {/* 🚫 REMOVE ANY console.log statements here - they cause re-renders on every keystroke! */}
                  {showCDSSResults && cdssResponse && (
                    <CDSSPanel
                      cdssResponse={cdssResponse}
                      showCDSSResults={showCDSSResults}
                      isApplyingCDSS={isApplyingCDSS}
                      onApplyCDSS={onApplyCDSS}
                      onCloseCDSS={onCloseCDSS}
                      appointmentLocked={appointment?.is_locked}
                    />
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-white mb-2">Chief Complaint</label>
                <textarea
                  value={localSoapNotes.chiefComplaint}
                  onChange={(e) => handleSoapChange('chiefComplaint', e.target.value)}
                  disabled={appointment?.is_locked || false}
                  placeholder="Follow-up for DM2; Rx refill; fasting sugars improved."
                  className="w-full h-24 px-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">ROS — General</label>
                  <textarea
                    value={localSoapNotes.rosGeneral}
                    onChange={(e) => handleSoapChange('rosGeneral', e.target.value)}
                    disabled={appointment?.is_locked || false}
                    placeholder="No fever. No chills. Good appetite."
                    className="w-full h-32 px-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Assessment & Plan</label>
                  <textarea
                    value={localSoapNotes.assessmentPlan}
                    onChange={(e) => handleSoapChange('assessmentPlan', e.target.value)}
                    disabled={appointment?.is_locked || false}
                    placeholder="Refill metformin 500mg BID. Order A1C. Lifestyle counseling."
                    className="w-full h-32 px-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {!appointment?.is_locked && (
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 text-sm">
                    {soapSaveStatus === 'saving' && (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-cyan-400"></div>
                        <span className="text-cyan-400">Saving...</span>
                      </>
                    )}
                    {soapSaveStatus === 'saved' && (
                      <>
                        <CheckCircle className="h-3 w-3 text-green-400" />
                        <span className="text-green-400">Saved</span>
                      </>
                    )}
                    {soapSaveStatus === 'idle' && (
                      <span className="text-gray-500 text-xs">Changes auto-save as you type</span>
                    )}
                  </div>
                  <button
                    onClick={onSignAndLock}
                    disabled={isSigning}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isSigning ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Signing...</span>
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4" />
                        <span>Sign & Lock</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Notes' && (
            <div className="space-y-4">
              <div className="relative">
                <textarea
                  value={localDoctorNotes}
                  onChange={(e) => handleDoctorNotesChange(e.target.value)}
                  placeholder="Additional notes (auto-saved to database)"
                  className="w-full h-64 px-3 py-2 pr-12 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                />
              </div>
              {appointment?.notes && (
                <div className="text-xs text-green-400">✓ Auto-saved</div>
              )}
            </div>
          )}

          {activeTab === 'Orders' && (
            <div className="text-center py-8 text-gray-400 text-sm">
              Orders functionality coming soon
            </div>
          )}

          {activeTab === 'Files' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">Documents</h4>
                {!appointment?.is_locked && onDocumentUpload && (
                  <label className="flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                    <FileImage className="h-4 w-4" />
                    <span>Upload Document</span>
                    <input
                      type="file"
                      onChange={async (e) => {
                        try {
                          await onDocumentUpload(e)
                        } catch (err: any) {
                          console.error('Document upload error in component:', err)
                        }
                      }}
                      disabled={uploadingDocument}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                    />
                  </label>
                )}
              </div>

              {uploadingDocument && (
                <div className="p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-blue-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Uploading document...</span>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-red-400">
                    <X className="h-4 w-4" />
                    <span>{uploadError}</span>
                  </div>
                </div>
              )}

              {!appointmentDocuments || appointmentDocuments.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No documents uploaded yet
                </div>
              ) : (
                <div className="space-y-2">
                  {appointmentDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 bg-slate-700/50 rounded-lg border border-white/10 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="h-5 w-5 text-cyan-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium truncate">
                            {doc.document_name || doc.file_name || 'Unknown'}
                          </div>
                          <div className="text-gray-400 text-xs">
                            {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''} • {new Date(doc.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="ml-3 flex items-center gap-2">
                        {onDocumentSelect && (
                          <button
                            onClick={() => onDocumentSelect(doc)}
                            className="p-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-600/20 rounded-md transition-colors"
                            title="View file"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        {onDocumentDownload && (
                          <button
                            onClick={() => onDocumentDownload(doc)}
                            className="p-2 text-green-400 hover:text-green-300 hover:bg-green-600/20 rounded-md transition-colors"
                            title="Download file"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'Billing' && (
            <div className="text-center py-8 text-gray-400 text-sm">
              Billing functionality coming soon
            </div>
          )}

          {activeTab === 'Audit' && (
            <div className="text-center py-8 text-gray-400 text-sm">
              Audit trail coming soon
            </div>
          )}
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // 🔥 CRITICAL: Custom comparison to prevent unnecessary re-renders
  // Only re-render when actual data changes, not when object references change
  // NOTE: sectionProps is ignored - it's recreated on every render for drag-and-drop but doesn't affect content
  
  const differences: string[] = []
  
  // Primitive comparisons
  if (prevProps.activeTab !== nextProps.activeTab) {
    differences.push(`activeTab: ${prevProps.activeTab} → ${nextProps.activeTab}`)
  }
  if (prevProps.soapSaveStatus !== nextProps.soapSaveStatus) {
    differences.push(`soapSaveStatus: ${prevProps.soapSaveStatus} → ${nextProps.soapSaveStatus}`)
  }
  if (prevProps.isSigning !== nextProps.isSigning) {
    differences.push(`isSigning: ${prevProps.isSigning} → ${nextProps.isSigning}`)
  }
  if (prevProps.isCustomizeMode !== nextProps.isCustomizeMode) {
    differences.push(`isCustomizeMode: ${prevProps.isCustomizeMode} → ${nextProps.isCustomizeMode}`)
  }
  if (prevProps.isGeneratingCDSS !== nextProps.isGeneratingCDSS) {
    differences.push(`isGeneratingCDSS: ${prevProps.isGeneratingCDSS} → ${nextProps.isGeneratingCDSS}`)
  }
  if (prevProps.showCDSSResults !== nextProps.showCDSSResults) {
    differences.push(`showCDSSResults: ${prevProps.showCDSSResults} → ${nextProps.showCDSSResults}`)
  }
  if (prevProps.isApplyingCDSS !== nextProps.isApplyingCDSS) {
    differences.push(`isApplyingCDSS: ${prevProps.isApplyingCDSS} → ${nextProps.isApplyingCDSS}`)
  }
  if (prevProps.uploadingDocument !== nextProps.uploadingDocument) {
    differences.push(`uploadingDocument: ${prevProps.uploadingDocument} → ${nextProps.uploadingDocument}`)
  }
  if (prevProps.uploadError !== nextProps.uploadError) {
    differences.push(`uploadError: ${prevProps.uploadError} → ${nextProps.uploadError}`)
  }
  if (prevProps.cdssError !== nextProps.cdssError) {
    differences.push(`cdssError: ${prevProps.cdssError} → ${nextProps.cdssError}`)
  }
  if (prevProps.doctorNotes !== nextProps.doctorNotes) {
    differences.push(`doctorNotes: length ${prevProps.doctorNotes?.length || 0} → ${nextProps.doctorNotes?.length || 0}`)
  }

  // Appointment comparison (by ID and is_locked)
  if (prevProps.appointment?.id !== nextProps.appointment?.id) {
    differences.push(`appointment.id: ${prevProps.appointment?.id} → ${nextProps.appointment?.id}`)
  }
  if (prevProps.appointment?.is_locked !== nextProps.appointment?.is_locked) {
    differences.push(`appointment.is_locked: ${prevProps.appointment?.is_locked} → ${nextProps.appointment?.is_locked}`)
  }

  // SOAP notes comparison (deep compare object)
  if (prevProps.soapNotes.chiefComplaint !== nextProps.soapNotes.chiefComplaint) {
    differences.push(`soapNotes.chiefComplaint: changed (length ${prevProps.soapNotes.chiefComplaint?.length || 0} → ${nextProps.soapNotes.chiefComplaint?.length || 0})`)
  }
  if (prevProps.soapNotes.rosGeneral !== nextProps.soapNotes.rosGeneral) {
    differences.push(`soapNotes.rosGeneral: changed (length ${prevProps.soapNotes.rosGeneral?.length || 0} → ${nextProps.soapNotes.rosGeneral?.length || 0})`)
  }
  if (prevProps.soapNotes.assessmentPlan !== nextProps.soapNotes.assessmentPlan) {
    differences.push(`soapNotes.assessmentPlan: changed (length ${prevProps.soapNotes.assessmentPlan?.length || 0} → ${nextProps.soapNotes.assessmentPlan?.length || 0})`)
  }

  // CDSS response comparison (by ID if available, or by reference)
  if (prevProps.cdssResponse?.id !== nextProps.cdssResponse?.id) {
    differences.push(`cdssResponse.id: ${prevProps.cdssResponse?.id} → ${nextProps.cdssResponse?.id}`)
  }
  // If no ID, compare by reference (should be stable if memoized in parent)
  if (prevProps.cdssResponse !== nextProps.cdssResponse) {
    // Only re-render if both are truthy (meaning data actually changed)
    if (prevProps.cdssResponse && nextProps.cdssResponse) {
      differences.push(`cdssResponse: reference changed (both exist, IDs: ${prevProps.cdssResponse?.id} vs ${nextProps.cdssResponse?.id})`)
    } else if (prevProps.cdssResponse && !nextProps.cdssResponse) {
      differences.push(`cdssResponse: removed`)
    } else if (!prevProps.cdssResponse && nextProps.cdssResponse) {
      differences.push(`cdssResponse: added`)
    }
  }

  // Selected document comparison
  if (prevProps.selectedDocument?.id !== nextProps.selectedDocument?.id) {
    differences.push(`selectedDocument.id: ${prevProps.selectedDocument?.id} → ${nextProps.selectedDocument?.id}`)
  }

  // Appointment documents array comparison (by length and IDs)
  const prevDocs = prevProps.appointmentDocuments || []
  const nextDocs = nextProps.appointmentDocuments || []
  if (prevDocs.length !== nextDocs.length) {
    differences.push(`appointmentDocuments.length: ${prevDocs.length} → ${nextDocs.length}`)
  }
  // Compare first and last document IDs for quick check
  if (prevDocs.length > 0) {
    if (prevDocs[0]?.id !== nextDocs[0]?.id) {
      differences.push(`appointmentDocuments[0].id: ${prevDocs[0]?.id} → ${nextDocs[0]?.id}`)
    }
    if (prevDocs[prevDocs.length - 1]?.id !== nextDocs[nextDocs.length - 1]?.id) {
      differences.push(`appointmentDocuments[last].id: ${prevDocs[prevDocs.length - 1]?.id} → ${nextDocs[nextDocs.length - 1]?.id}`)
    }
  }

  // Check handler function references (for debugging)
  const handlerChanges: string[] = []
  if (prevProps.onSoapNotesChange !== nextProps.onSoapNotesChange) handlerChanges.push('onSoapNotesChange')
  if (prevProps.onDoctorNotesChange !== nextProps.onDoctorNotesChange) handlerChanges.push('onDoctorNotesChange')
  if (prevProps.onTabChange !== nextProps.onTabChange) handlerChanges.push('onTabChange')
  if (prevProps.onSignAndLock !== nextProps.onSignAndLock) handlerChanges.push('onSignAndLock')
  if (prevProps.onGenerateCDSS !== nextProps.onGenerateCDSS) handlerChanges.push('onGenerateCDSS')
  if (prevProps.onApplyCDSS !== nextProps.onApplyCDSS) handlerChanges.push('onApplyCDSS')
  if (prevProps.onCloseCDSS !== nextProps.onCloseCDSS) handlerChanges.push('onCloseCDSS')
  if (prevProps.onDocumentUpload !== nextProps.onDocumentUpload) handlerChanges.push('onDocumentUpload')
  if (prevProps.onDocumentSelect !== nextProps.onDocumentSelect) handlerChanges.push('onDocumentSelect')
  if (prevProps.onDocumentDownload !== nextProps.onDocumentDownload) handlerChanges.push('onDocumentDownload')
  
  if (handlerChanges.length > 0) {
    differences.push(`⚠️ Handler refs changed: ${handlerChanges.join(', ')}`)
  }

  // Log only when re-render is needed (to avoid console spam)
  if (differences.length > 0) {
    console.log('🔄 DoctorNotesSection: RE-RENDER NEEDED', {
      differences,
      timestamp: new Date().toISOString()
    })
    return false // Re-render needed
  }

  // All props are equal - skip re-render
  return true
})

export default DoctorNotesSection
