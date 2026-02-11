'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import MedicalRecordsUpload from '@/components/MedicalRecordsUpload'
import PatientAppointmentChat from '@/components/PatientAppointmentChat'
import { Calendar, Clock, User, FileText, MessageCircle } from 'lucide-react'

interface Appointment {
  id: string
  service_type: string
  status: string
  visit_type: string
  requested_date_time: string | null
  zoom_meeting_url: string | null
  zoom_meeting_id: string | null
  zoom_meeting_password: string | null
  notes: string | null
  created_at: string
  doctors: {
    first_name: string
    last_name: string
    specialty: string
  } | null
}

export default function PatientAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    fetchUserAndAppointments()
  }, [])

  const fetchUserAndAppointments = async () => {
    try {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        console.error('No user found')
        return
      }
      setUser(currentUser)

      // Fetch appointments for this user
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          doctors!appointments_doctor_id_fkey(first_name, last_name, specialty)
        `)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching appointments:', error)
        return
      }

      setAppointments(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg p-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Appointments</h1>
          <p className="mt-2 text-gray-600">Manage your appointments and upload medical records</p>
        </div>

        {appointments.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments found</h3>
            <p className="text-gray-500">You haven't booked any appointments yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {appointments.map((appointment) => (
              <div key={appointment.id} className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {appointment.visit_type === 'video' ? 'Video Consultation' : 'Async Consultation'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {appointment.doctors ? 
                          `Dr. ${appointment.doctors.first_name} ${appointment.doctors.last_name} - ${appointment.doctors.specialty}` :
                          'Doctor to be assigned'
                        }
                      </p>
                    </div>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(appointment.status)}`}>
                      {appointment.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {appointment.requested_date_time ? 
                          formatDate(appointment.requested_date_time) : 
                          'Date to be confirmed'
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {appointment.service_type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {appointment.zoom_meeting_url && appointment.visit_type === 'video' && (
                    <div className="mb-4">
                      <a
                        href={appointment.zoom_meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        Join Zoom Meeting
                      </a>
                      {appointment.zoom_meeting_id && (
                        <div className="mt-2 text-sm text-gray-600">
                          <p>Meeting ID: {appointment.zoom_meeting_id}</p>
                          {appointment.zoom_meeting_password && (
                            <p>Password: {appointment.zoom_meeting_password}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {appointment.notes && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-800">
                        <strong>Doctor's Notes:</strong> {appointment.notes}
                      </p>
                    </div>
                  )}

                  {/* Medical Records Upload Section */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <h4 className="text-md font-medium text-gray-900">Medical Records</h4>
                      </div>
                      <button
                        onClick={() => setSelectedAppointment(
                          selectedAppointment === appointment.id ? null : appointment.id
                        )}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        {selectedAppointment === appointment.id ? 'Hide Upload' : 'Upload Records'}
                      </button>
                    </div>

                    {selectedAppointment === appointment.id && (
                      <MedicalRecordsUpload
                        appointmentId={appointment.id}
                        userId={user?.id}
                        onUploadSuccess={() => {
                          // Optionally refresh data or show success message
                          console.log('Medical records uploaded successfully')
                        }}
                      />
                    )}
                  </div>

                  {/* Chat Section for Text-based Appointments */}
                  {appointment.visit_type === 'async' && appointment.status === 'accepted' && user && (
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex items-center gap-2 mb-4">
                        <MessageCircle className="h-5 w-5 text-blue-600" />
                        <h4 className="text-md font-medium text-gray-900">Chat with Doctor</h4>
                      </div>
                      <PatientAppointmentChat
                        appointmentId={appointment.id}
                        currentUserId={user.id}
                        doctorName={appointment.doctors ? 
                          `Dr. ${appointment.doctors.first_name} ${appointment.doctors.last_name}` : 
                          'Dr. Provider'
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
