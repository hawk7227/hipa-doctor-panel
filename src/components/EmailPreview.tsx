// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState } from 'react'
import { createAppointmentAcceptedEmail, createAppointmentRejectedEmail } from '@/lib/email'

export default function EmailPreview() {
  const [emailType, setEmailType] = useState<'accepted' | 'rejected'>('accepted')
  const [patientName, setPatientName] = useState('John Doe')
  const [doctorName, setDoctorName] = useState('Dr. Sarah Johnson')
  const [appointmentDate, setAppointmentDate] = useState('Monday, January 20, 2025 at 2:00 PM')
  const [meetingUrl, setMeetingUrl] = useState('https://us05web.zoom.us/j/123456789?pwd=example')
  const [reason, setReason] = useState('Doctor unavailable due to emergency')

  const getEmailTemplate = () => {
    if (emailType === 'accepted') {
      return createAppointmentAcceptedEmail(patientName, doctorName, appointmentDate, meetingUrl)
    } else {
      return createAppointmentRejectedEmail(patientName, doctorName, appointmentDate, reason)
    }
  }

  const template = getEmailTemplate()

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Template Preview</h1>
        <p className="text-gray-600">Preview and test the professional email templates for HealthCare Pro</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Email Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Type</label>
                <select
                  value={emailType}
                  onChange={(e) => setEmailType(e.target.value as 'accepted' | 'rejected')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="accepted">Appointment Accepted</option>
                  <option value="rejected">Appointment Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Patient Name</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Doctor Name</label>
                <input
                  type="text"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Appointment Date</label>
                <input
                  type="text"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {emailType === 'accepted' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meeting URL</label>
                  <input
                    type="text"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {emailType === 'rejected' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cancellation Reason</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Details</h3>
            <div className="space-y-2 text-sm">
              <div><strong>Subject:</strong> {template.subject}</div>
              <div><strong>Type:</strong> {emailType === 'accepted' ? 'Confirmation' : 'Cancellation'}</div>
              <div><strong>Platform:</strong> HealthCare Pro</div>
            </div>
          </div>
        </div>

        {/* Email Preview */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Email Preview</h2>
            <div className="text-sm text-gray-500">
              {emailType === 'accepted' ? '✅ Confirmation Email' : '❌ Cancellation Email'}
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <div className="text-sm text-gray-600">
                <strong>To:</strong> {patientName.toLowerCase().replace(' ', '.')}@example.com
              </div>
              <div className="text-sm text-gray-600">
                <strong>Subject:</strong> {template.subject}
              </div>
            </div>
            <div 
              className="p-4 bg-white max-h-96 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: template.html }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

