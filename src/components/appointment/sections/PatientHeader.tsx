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






