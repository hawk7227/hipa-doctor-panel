import React, { memo } from 'react'
import { GripVertical } from 'lucide-react'

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

const PatientHeader = memo(function PatientHeader({
  appointment,
  surgeriesDetails = '',
  medicalIssuesDetails = '',
  chiefComplaint = '',
  isCustomizeMode = false,
  sectionProps = {},
  sectionId = 'patient-header',
  showIntakeAnswers = true
}: PatientHeaderProps) {
  return (
    <div {...sectionProps} style={{ contain: 'layout style paint' }}>
      {isCustomizeMode && (
        <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
          <div>
            <div className="text-xs text-gray-400 mb-1">Name</div>
            <div className="font-bold text-white text-sm sm:text-base">
              {appointment?.patients?.first_name && appointment?.patients?.last_name 
                ? `${appointment.patients.first_name} ${appointment.patients.last_name}` 
                : 'N/A'}
            </div>
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
          <div className="sm:col-span-2 lg:col-span-3">
            <div className="text-xs text-gray-400 mb-3 font-semibold">Patient Intake</div>
            
            {/* Chief Complaint / Symptoms */}
            {(chiefComplaint || appointment?.chief_complaint || appointment?.patients?.chief_complaint || appointment?.subjective_notes) && (
              <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <div className="text-xs text-gray-400 mb-3">Reason For Visit / Symptoms</div>
                <div className="text-red-500 text-sm">{chiefComplaint || appointment?.chief_complaint || appointment?.patients?.chief_complaint || appointment?.subjective_notes}</div>
              </div>
            )}
            
            {/* Intake Form Answers - Only show when showIntakeAnswers is true and patient has completed intake */}
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
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.appointment?.id === nextProps.appointment?.id &&
    prevProps.appointment?.patients?.id === nextProps.appointment?.patients?.id &&
    prevProps.surgeriesDetails === nextProps.surgeriesDetails &&
    prevProps.medicalIssuesDetails === nextProps.medicalIssuesDetails &&
    prevProps.chiefComplaint === nextProps.chiefComplaint &&
    prevProps.isCustomizeMode === nextProps.isCustomizeMode &&
    prevProps.showIntakeAnswers === nextProps.showIntakeAnswers
  )
})

export default PatientHeader


