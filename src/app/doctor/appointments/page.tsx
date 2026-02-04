//                     ? 'linear-gradient(135deg, rgba(229, 57, 53, 0.3), rgba(211, 47, 47, 0.2))'
  //                     : slotAppointment
  //                       ? '#0a1222'
  //                       : 'linear-gradient(135deg, rgba(25,214,127,.18), rgba(25,214,127,.12))',
  //                 border: isMoveSelected
  //                   ? '2px solid #00e6ff'
  //                   : isSelected
  //                     ? '2px solid #00e6ff'
  //                     : slotAppointment
  //                       ? '2px solid #e53935'
  //                       : '2px solid rgba(25,214,127,.6)',
  //                 boxShadow: isMoveSelected
  //                   ? '0 0 12px rgba(0, 230, 255, 0.4)'
  //                   : isSelected
  //                     ? '0 0 12px rgba(229, 57, 53, 0.4), 0 0 20px rgba(0, 230, 255, 0.3)'
  //                     : slotAppointment
  //                       ? '0 0 8px rgba(229, 57, 53, 0.3)'
  //                       : 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  //                 color: slotAppointment ? '#ffffff' : '#cde7da'
  //               }}
  //               onMouseEnter={(e) => {
  //                 e.currentTarget.style.filter = 'brightness(1.15)'
  //               }}
  //               onMouseLeave={(e) => {
  //                 e.currentTarget.style.filter = 'brightness(1)'
  //               }}
  //             >
  //               <div style={{ fontWeight: 'bold', fontSize: '13px', color: slotAppointment ? '#ffffff' : '#cde7da' }}>{formatTime(time)}</div>
  //               {slotAppointment && (
  //                 <>
  //                   <div style={{ fontSize: '11px', marginTop: '4px', fontWeight: '600', color: '#ffffff' }}>
  //                     {slotAppointment.patients?.first_name} {slotAppointment.patients?.last_name}
  //                   </div>
  //                   <span style={{
  //                     display: 'inline-block',
  //                     padding: '2px 6px',
  //                     borderRadius: '4px',
  //                     fontSize: '9px',
  //                     fontWeight: 'bold',
  //                     marginTop: '4px',
  //                     textTransform: 'uppercase',
  //                     background: slotAppointment.visit_type === 'video' ? 'rgba(0, 230, 255, 0.25)' :
  //                                slotAppointment.visit_type === 'phone' ? 'rgba(0, 194, 110, 0.25)' :
  //                                slotAppointment.visit_type === 'async' ? 'rgba(176, 122, 255, 0.25)' : 'rgba(255,255,255,0.1)',
  //                     border: `1px solid ${slotAppointment.visit_type === 'video' ? '#00e6ff' :
  //                                         slotAppointment.visit_type === 'phone' ? '#00c26e' :
  //                                         slotAppointment.visit_type === 'async' ? '#b07aff' : 'transparent'}`,
  //                     color: slotAppointment.visit_type === 'video' ? '#00e6ff' :
  //                            slotAppointment.visit_type === 'phone' ? '#00c26e' :
  //                            slotAppointment.visit_type === 'async' ? '#b07aff' : '#fff'
  //                   }}>
  //                     {slotAppointment.visit_type === 'video' ? 'VIDEO' :
  //                      slotAppointment.visit_type === 'phone' ? 'PHONE' :
  //                      slotAppointment.visit_type === 'async' ? 'ASYNC' : 'VISIT'}
  //                   </span>
  //                   {(() => {
  //                     const reason = getAppointmentReason(slotAppointment)
  //                     if (!reason) return null
  //                     const words = reason.trim().split(/\s+/)
  //                     const shortReason = words.slice(0, 2).join(' ')
  //                     return (
  //                       <div style={{ fontSize: '10px', marginTop: '4px', color: '#ffffff', opacity: 0.9 }}>
  //                         {shortReason}
  //                       </div>
  //                     )
  //                   })()}
  //                 </>
  //               )}
  //               {isAvailable && (
  //                 <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8, fontWeight: '600' }}>Available</div>
  //               )}
  //             </div>
  //           )
  //         })}
  //       </div>
  //     </div>
  //   )
  // }

  if (!isOpen) return null

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Main container with calendar sidebar + panel */}
      <div className="fixed top-0 right-0 h-full w-full z-50 flex">
        {/* Left Calendar Sidebar - Updated styling */}
        <div style={{
          width: '12%',
          minWidth: '140px',
          maxWidth: '200px',
          height: '100%',
          borderRight: '1px solid #1b2b4d',
          background: 'linear-gradient(180deg, #0d1424, #0b1222)',
          boxShadow: '0 0 40px rgba(0,0,0,0.5)'
        }}>
          {renderCurrentDaySlots()}
        </div>
        
        {/* Right Panel - 90% width */}
        <div className={`flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-l border-white/20 shadow-2xl transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } flex flex-col overflow-hidden`}>
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-white/10 z-10 flex-shrink-0 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold text-sm sm:text-base">
              <span className="text-cyan-400">APPOINTMENT</span>
              {appointment?.requested_date_time && (
                <> • {(() => {
                  // CRITICAL: Provider timezone is ALWAYS America/Phoenix per industry standard requirements
                  // This must match the main calendar which always uses Phoenix timezone
                  const doctorTimezone = 'America/Phoenix'
                  const appointmentDate = convertToTimezone(appointment.requested_date_time, doctorTimezone)
                  return appointmentDate.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })
                })()}</>
              )}
              {appointment?.status && (
                <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                  appointment.status === 'pending' ? 'bg-yellow-600' :
                  appointment.status === 'accepted' ? 'bg-green-600' :
                  appointment.status === 'completed' ? 'bg-blue-600' :
                  appointment.status === 'cancelled' ? 'bg-gray-600' : 'bg-gray-600'
                }`}>
                  {appointment.status.toUpperCase()}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Action Buttons - only show when not in customize mode */}
              {!layout.isCustomizeMode && appointment && (
                <>
                  {/* Accept/Reject for pending appointments */}
                  {appointment.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleAppointmentAction('accept')}
                        disabled={actionLoading === 'accept'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs disabled:opacity-50"
                      >
                        {actionLoading === 'accept' ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5" />
                        )}
                        Accept
                      </button>
                      <button
                        onClick={() => handleAppointmentAction('reject')}
                        disabled={actionLoading === 'reject'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs disabled:opacity-50"
                      >
                        {actionLoading === 'reject' ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        Reject
                      </button>
                    </>
                  )}
                  
                  {/* Move button */}
                  <button
                    onClick={() => {
                      setShowMoveForm(!showMoveForm)
                      setShowRescheduleForm(false)
                      setShowCancelConfirm(false)
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 ${showMoveForm ? 'bg-cyan-700' : 'bg-cyan-600'} text-white rounded-lg hover:bg-cyan-700 transition-colors text-xs`}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    {showMoveForm ? 'Cancel Move' : 'Move'}
                  </button>
                  
                  {/* Reschedule button */}
                  <button
                    onClick={() => {
                      setShowRescheduleForm(!showRescheduleForm)
                      setShowMoveForm(false)
                      setShowCancelConfirm(false)
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 ${showRescheduleForm ? 'bg-orange-700' : 'bg-orange-600'} text-white rounded-lg hover:bg-orange-700 transition-colors text-xs`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {showRescheduleForm ? 'Cancel' : 'Reschedule'}
                  </button>
                  
                  {/* Cancel appointment button */}
                  <button
                    onClick={() => {
                      setShowCancelConfirm(!showCancelConfirm)
                      setShowMoveForm(false)
                      setShowRescheduleForm(false)
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 ${showCancelConfirm ? 'bg-red-700' : 'bg-red-600'} text-white rounded-lg hover:bg-red-700 transition-colors text-xs`}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Cancel Appt
                  </button>
                  
                  {/* Complete button for accepted appointments */}
                  {appointment.status === 'accepted' && (
                    <button
                      onClick={() => handleAppointmentAction('complete')}
                      disabled={actionLoading === 'complete'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs disabled:opacity-50"
                    >
                      {actionLoading === 'complete' ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5" />
                      )}
                      Complete
                    </button>
                  )}
                </>
              )}
              
              {layout.isCustomizeMode ? (
                <>
                  <button
                    onClick={layout.saveLayout}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm"
                  >
                    <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Save Layout</span>
                    <span className="sm:hidden">Save</span>
                  </button>
                  <button
                    onClick={() => layout.setIsCustomizeMode(false)}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs sm:text-sm"
                  >
                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Cancel</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => layout.setIsCustomizeMode(true)}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs sm:text-sm"
                  >
                    <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Customize</span>
                    <span className="sm:hidden">Edit</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs sm:text-sm"
                  >
                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Action Forms */}
          {showMoveForm && (
            <div className="mt-3 p-3 bg-cyan-900/50 rounded-lg border border-cyan-500/30">
              <div className="flex items-center justify-between">
                <div className="text-cyan-300 text-sm">
                  <Clock className="h-4 w-4 inline mr-2" />
                  Select a new time slot from the calendar on the left
                  {selectedMoveTime && (
                    <span className="ml-2 font-bold">Selected: {selectedMoveTime}</span>
                  )}
                </div>
                <button
                  onClick={handleMoveAppointment}
                  disabled={!selectedMoveTime || moveLoading}
                  className="px-4 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                >
                  {moveLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    'Confirm Move'
                  )}
                </button>
              </div>
            </div>
          )}
          
          {showRescheduleForm && (
            <div className="mt-3 p-3 bg-orange-900/50 rounded-lg border border-orange-500/30">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-orange-300" />
                <input
                  type="datetime-local"
                  value={newDateTime}
                  onChange={(e) => setNewDateTime(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-800 border border-white/20 rounded-lg text-white text-sm"
                />
                <button
                  onClick={handleReschedule}
                  disabled={!newDateTime || rescheduleLoading}
                  className="px-4 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                >
                  {rescheduleLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    'Confirm Reschedule'
                  )}
                </button>
              </div>
            </div>
          )}
          
          {showCancelConfirm && (
            <div className="mt-3 p-3 bg-red-900/50 rounded-lg border border-red-500/30">
              <div className="flex items-center justify-between">
                <div className="text-red-300 text-sm">
                  Are you sure you want to cancel this appointment? This action cannot be undone.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="px-4 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                  >
                    No, Keep It
                  </button>
                  <button
                    onClick={handleCancelAppointment}
                    disabled={cancelling}
                    className="px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm flex items-center gap-2"
                  >
                    {cancelling ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      'Yes, Cancel Appointment'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div 
          ref={layout.scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6"
          style={{ 
            scrollBehavior: 'auto',
            scrollPaddingTop: '0'
          }}
          onFocus={(e) => {
            // Prevent focus from causing scroll during initial load
            if (preventAutoScrollRef.current && layout.scrollContainerRef.current) {
              e.stopPropagation()
              // Reset scroll if it moved
              setTimeout(() => {
                if (layout.scrollContainerRef.current) {
                  layout.scrollContainerRef.current.scrollTop = 0
                }
              }, 0)
            }
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
              {error}
            </div>
          ) : appointment ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Left Panel */}
              <div className="space-y-4 sm:space-y-6">
                {layout.leftPanelSections.map((sectionId) => renderSection(sectionId, 'left'))}
              </div>

              {/* Right Panel */}
              <div className="space-y-4 sm:space-y-6">
                {layout.rightPanelSections.map((sectionId) => renderSection(sectionId, 'right'))}
              </div>
            </div>
          ) : null}
          </div>
        </div>
      </div>

      {/* Document Viewer Modal */}
      {documentUpload.selectedDocument && (
        <DocumentViewer
          document={documentUpload.selectedDocument}
          onClose={() => documentUpload.setSelectedDocument(null)}
        />
      )}
    </>
  )
}




























