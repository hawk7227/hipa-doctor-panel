import React, { useState, useCallback } from 'react'
import { GripVertical, Minimize2, Maximize2, ChevronDown, ChevronUp, X, User } from 'lucide-react'

type ViewState = 'closed' | 'minimized' | 'default' | 'expanded'

interface PatientHeaderProps {
  appointment: any
  surgeriesDetails?: string
  medicalIssuesDetails?: string
  chiefComplaint?: string
  isCustomizeMode?: boolean
  sectionProps?: any
  sectionId?: string
  showIntakeAnswers?: boolean
}

function PatientHeader({
  appointment,
  surgeriesDetails = '',
  medicalIssuesDetails = '',
  chiefComplaint = '',
  isCustomizeMode = false,
  sectionProps = {},
  sectionId = 'patient-header',
  showIntakeAnswers = true
}: PatientHeaderProps) {
  const [viewState, setViewState] = useState<ViewState>('default')

  const patientName = appointment?.patients?.first_name && appointment?.patients?.last_name
    ? `${appointment.patients.first_name} ${appointment.patients.last_name}`
    : 'N/A'

  const patientPhone = appointment?.patients?.phone || ''
  const patientDOB = appointment?.patients?.date_of_birth
    ? new Date(appointment.patients.date_of_birth).toLocaleDateString()
    : ''

  const handleMinimize = useCallback(() => setViewState('minimized'), [])
  const handleDefault = useCallback(() => setViewState('default'), [])
  const handleExpand = useCallback(() => setViewState('expanded'), [])
  const handleClose = useCallback(() => setViewState('closed'), [])

  // ─── CLOSED: Just a reopen bar ───
  if (viewState === 'closed') {
    return (
      <div {...sectionProps} style={{ contain: 'layout style paint' }}>
        {isCustomizeMode && (
          <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <button
          onClick={handleDefault}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 hover:from-cyan-500/10 hover:to-blue-500/10 transition-all group"
        >
          <User className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-xs font-semibold text-cyan-400 group-hover:text-cyan-300">Show Patient Chart</span>
          <span className="text-xs text-gray-500">— {patientName}</span>
        </button>
      </div>
    )
  }

  // ─── Control buttons (shared across minimized/default/expanded) ───
  const ControlButtons = () => (
    <div className="flex items-center gap-1 flex-shrink-0">
      {viewState !== 'minimized' && (
        <button
          onClick={handleMinimize}
          className="p-1 rounded-md hover:bg-white/10 transition-colors group"
          title="Minimize"
        >
          <Minimize2 className="h-3.5 w-3.5 text-gray-500 group-hover:text-cyan-400" />
        </button>
      )}
      {viewState === 'minimized' && (
        <button
          onClick={handleDefault}
          className="p-1 rounded-md hover:bg-white/10 transition-colors group"
          title="Restore"
        >
          <Maximize2 className="h-3.5 w-3.5 text-gray-500 group-hover:text-cyan-400" />
        </button>
      )}
      {viewState !== 'expanded' && viewState !== 'minimized' && (
        <button
          onClick={handleExpand}
          className="p-1 rounded-md hover:bg-white/10 transition-colors group"
          title="Expand All"
        >
          <ChevronDown className="h-3.5 w-3.5 text-gray-500 group-hover:text-cyan-400" />
        </button>
      )}
      {viewState === 'expanded' && (
        <button
          onClick={handleDefault}
          className="p-1 rounded-md hover:bg-white/10 transition-colors group"
          title="Collapse Intake"
        >
          <ChevronUp className="h-3.5 w-3.5 text-gray-500 group-hover:text-cyan-400" />
        </button>
      )}
      <button
        onClick={handleClose}
        className="p-1 rounded-md hover:bg-white/10 transition-colors group"
        title="Close"
      >
        <X className="h-3.5 w-3.5 text-gray-500 group-hover:text-red-400" />
      </button>
    </div>
  )

  // ─── MINIMIZED: Compact single-line bar ───
  if (viewState === 'minimized') {
    return (
      <div {...sectionProps} style={{ contain: 'layout style paint' }}>
        {isCustomizeMode && (
          <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <div className="px-4 py-2.5 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-shrink-0">
                <User className="h-4 w-4 text-cyan-400" />
                <span className="font-bold text-white text-sm">{patientName}</span>
              </div>
              {patientPhone && (
                <span className="text-xs text-gray-400 flex-shrink-0">{patientPhone}</span>
              )}
              {patientDOB && (
                <span className="text-xs text-gray-400 flex-shrink-0">DOB: {patientDOB}</span>
              )}
              {appointment?.patients?.email && (
                <span className="text-xs text-gray-500 truncate min-w-0">{appointment.patients.email}</span>
              )}
            </div>
            <ControlButtons />
          </div>
        </div>
      </div>
    )
  }

  // ─── DEFAULT & EXPANDED: Full card ───
  return (
    <div {...sectionProps} style={{ contain: 'layout style paint' }}>
      {isCustomizeMode && (
        <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl">
        {/* Row 1: Name / Email / Phone / DOB + Controls */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 flex-1">
            <div>
              <div className="text-xs text-gray-400 mb-1">Name</div>
              <div className="font-bold text-white text-sm sm:text-base">{patientName}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Email</div>
              <div className="text-white text-sm sm:text-base break-all">{appointment?.patients?.email || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Phone</div>
              <div className="text-white text-sm sm:text-base">{appointment?.patients?.phone || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">DOB</div>
              <div className="text-white text-sm sm:text-base">
                {appointment?.patients?.date_of_birth ? new Date(appointment.patients.date_of_birth).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>
          <ControlButtons />
        </div>

        {/* Row 2: Address / Pharmacy */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="sm:col-span-2 lg:col-span-2">
            <div className="text-xs text-gray-400 mb-1">Address</div>
            <div className="text-white text-sm sm:text-base break-words">{appointment?.patients?.location || 'N/A'}</div>
          </div>
          <div className="sm:col-span-1 lg:col-span-1">
            <div className="text-xs text-gray-400 mb-1">Preferred Pharmacy</div>
            <div className="text-white font-bold text-sm sm:text-base">
              {appointment?.preferred_pharmacy || 'Not specified'}
            </div>
          </div>

          {/* ─── EXPANDED: Patient Intake section ─── */}
          {viewState === 'expanded' && (
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="text-xs text-gray-400 mb-3 font-semibold">Patient Intake</div>
              
              {/* Chief Complaint / Symptoms */}
              {(chiefComplaint || appointment?.chief_complaint || appointment?.patients?.chief_complaint || appointment?.subjective_notes) && (
                <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <div className="text-xs text-gray-400 mb-3">Reason For Visit / Symptoms</div>
                  <div className="text-red-500 text-sm">{chiefComplaint || appointment?.chief_complaint || appointment?.patients?.chief_complaint || appointment?.subjective_notes}</div>
                </div>
              )}
              
              {/* Intake Form Answers */}
              {showIntakeAnswers &&
                (appointment?.patients?.has_drug_allergies === true || appointment?.patients?.has_drug_allergies === false ||
                appointment?.patients?.has_ongoing_medical_issues === true || appointment?.patients?.has_ongoing_medical_issues === false ||
                appointment?.patients?.has_recent_surgeries === true || appointment?.patients?.has_recent_surgeries === false ||
                appointment?.has_drug_allergies === true || appointment?.has_drug_allergies === false ||
                appointment?.has_ongoing_medical_issues === true || appointment?.has_ongoing_medical_issues === false ||
                appointment?.has_recent_surgeries === true || appointment?.has_recent_surgeries === false) && (
                <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <div className="text-xs text-gray-400 mb-3 font-semibold">Intake Form Answers</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Drug Allergies</div>
                      <div className={`text-sm font-semibold ${(appointment?.patients?.has_drug_allergies || appointment?.has_drug_allergies) ? 'text-red-500' : 'text-green-400'}`}>
                        {(appointment?.patients?.has_drug_allergies || appointment?.has_drug_allergies) ? 'Yes' : 'No'}
                      </div>
                      {(appointment?.patients?.has_drug_allergies || appointment?.has_drug_allergies) && (appointment?.patients?.allergies || appointment?.allergies) && (
                        <div className="text-xs text-gray-300 mt-1">{appointment?.patients?.allergies || appointment?.allergies}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Ongoing Medical Issues</div>
                      <div className={`text-sm font-semibold ${(appointment?.patients?.has_ongoing_medical_issues || appointment?.has_ongoing_medical_issues) ? 'text-red-500' : 'text-green-400'}`}>
                        {(appointment?.patients?.has_ongoing_medical_issues || appointment?.has_ongoing_medical_issues) ? 'Yes' : 'No'}
                      </div>
                      {(appointment?.patients?.has_ongoing_medical_issues || appointment?.has_ongoing_medical_issues) && (appointment?.patients?.ongoing_medical_issues_details || appointment?.ongoing_medical_issues_details || medicalIssuesDetails) && (
                        <div className="text-xs text-gray-300 mt-1">{appointment?.patients?.ongoing_medical_issues_details || appointment?.ongoing_medical_issues_details || medicalIssuesDetails}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Recent Surgeries</div>
                      <div className={`text-sm font-semibold ${(appointment?.patients?.has_recent_surgeries || appointment?.has_recent_surgeries) ? 'text-red-500' : 'text-green-400'}`}>
                        {(appointment?.patients?.has_recent_surgeries || appointment?.has_recent_surgeries) ? 'Yes' : 'No'}
                      </div>
                      {(appointment?.patients?.has_recent_surgeries || appointment?.has_recent_surgeries) && (appointment?.patients?.recent_surgeries_details || appointment?.recent_surgeries_details || surgeriesDetails) && (
                        <div className="text-xs text-gray-300 mt-1">{appointment?.patients?.recent_surgeries_details || appointment?.recent_surgeries_details || surgeriesDetails}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {(appointment?.ros_general || appointment?.patients?.ros_general) && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1 font-semibold">Review of Systems (ROS) - General</div>
                  <div className="text-white text-sm">
                    {appointment?.ros_general || appointment?.patients?.ros_general}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {appointment?.notes && appointment.notes.includes('Onset:') && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Onset</div>
                    <div className="text-white text-sm">
                      {appointment.notes.match(/Onset:\s*([^•]+)/i)?.[1]?.trim() || 'N/A'}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-gray-500 mb-1">Allergies</div>
                  <div className="text-white text-sm">
                    {appointment?.patients?.allergies_list && appointment.patients.allergies_list.length > 0
                      ? appointment.patients.allergies_list.join(', ')
                      : '—'}
                  </div>
                </div>
                {(appointment?.active_problems || appointment?.patients?.active_problems) && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Active Problems</div>
                    <div className="text-white text-sm">
                      {appointment?.active_problems || appointment?.patients?.active_problems}
                    </div>
                  </div>
                )}
                {(appointment?.current_medications || appointment?.patients?.current_medications) && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Current Medications</div>
                    <div className="text-white text-sm">
                      {appointment?.current_medications || appointment?.patients?.current_medications}
                    </div>
                  </div>
                )}
                {surgeriesDetails && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Recent Surgeries</div>
                    <div className="text-white text-sm">{surgeriesDetails}</div>
                  </div>
                )}
                {medicalIssuesDetails && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Ongoing Medical Issues</div>
                    <div className="text-white text-sm">{medicalIssuesDetails}</div>
                  </div>
                )}
                {/* Show appointment notes if it contains intake information */}
                {appointment?.notes && !appointment.notes.includes('Onset:') && appointment.notes.length > 0 && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <div className="text-xs text-gray-500 mb-1">Additional Notes</div>
                    <div className="text-white text-sm whitespace-pre-wrap">
                      {appointment.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Default view: show expand hint when intake data exists */}
          {viewState === 'default' && (chiefComplaint || appointment?.chief_complaint || appointment?.patients?.chief_complaint || appointment?.subjective_notes || appointment?.patients?.allergies_list?.length > 0 || appointment?.active_problems || appointment?.current_medications) && (
            <div className="sm:col-span-2 lg:col-span-3">
              <button
                onClick={handleExpand}
                className="flex items-center gap-1.5 text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors"
              >
                <ChevronDown className="h-3 w-3" />
                <span>Show patient intake &amp; clinical details</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PatientHeader

