'use client'

import { useEffect, useState } from 'react'
import { supabase, MedicalRecordWithUser } from '@/lib/supabase'
import PatientSearchTrigger from '@/components/PatientSearchTrigger'

export default function DoctorRecords() {
  const [records, setRecords] = useState<MedicalRecordWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'prescription' | 'lab_result' | 'imaging' | 'visit_summary'>('all')

  useEffect(() => {
    fetchMedicalRecords()
  }, [filter])

  const fetchMedicalRecords = async () => {
    try {
      let query = supabase
        .from('medical_records')
        .select(`
          *,
          users!medical_records_user_id_fkey(first_name, last_name, email),
          appointments!medical_records_appointment_id_fkey(id, created_at)
        `)
        .eq('is_shared', true)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('record_type', filter)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching medical records:', error)
        return
      }

      setRecords(data || [])
    } catch (error) {
      console.error('Error fetching medical records:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadFile = async (record: MedicalRecordWithUser) => {
    if (!record.file_url) return

    try {
      const response = await fetch(record.file_url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = record.file_name || 'medical-record'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading file:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 p-2 md:p-4">
      {/* Header */}
      <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-4 md:p-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Medical Records</h1>
        <p className="text-gray-400 mt-2 text-sm md:text-base">Access and manage shared patient medical records</p>
      </div>

      {/* Patient Search */}
      <div className="mb-4">
        <PatientSearchTrigger placeholder="Search patient records — name, DOB, email, phone..." />
      </div>

      {/* Filters */}
      <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-4 md:p-6">
        <div className="flex flex-wrap gap-2 md:gap-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-medium text-sm md:text-base ${
              filter === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            All Records
          </button>
          <button
            onClick={() => setFilter('prescription')}
            className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-medium text-sm md:text-base ${
              filter === 'prescription' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            Prescriptions
          </button>
          <button
            onClick={() => setFilter('lab_result')}
            className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-medium text-sm md:text-base ${
              filter === 'lab_result' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            Lab Results
          </button>
          <button
            onClick={() => setFilter('imaging')}
            className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-medium text-sm md:text-base ${
              filter === 'imaging' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            Imaging
          </button>
          <button
            onClick={() => setFilter('visit_summary')}
            className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-medium text-sm md:text-base ${
              filter === 'visit_summary' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            Visit Summaries
          </button>
        </div>
      </div>

      {/* Records List */}
      <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d]">
        <div className="p-4 md:p-6 border-b border-[#1a3d3d]">
          <h2 className="text-base md:text-lg font-semibold text-white">
            {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)} Medical Records
          </h2>
        </div>
        <div className="divide-y divide-[#1a3d3d]">
          {records.length === 0 ? (
            <div className="p-4 md:p-6 text-center">
              <p className="text-gray-600 text-sm md:text-base">No medical records found</p>
            </div>
          ) : (
            records.map((record) => (
              <div key={record.id} className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between">
                  <div className="flex-1 w-full md:w-auto">
                    <div className="flex items-center space-x-4">
                      <div>
                        <h3 className="text-base md:text-lg font-medium text-white">{record.title}</h3>
                        <p className="text-xs md:text-sm text-gray-300 mt-1">
                          Patient: {record.users?.first_name} {record.users?.last_name}
                        </p>
                        <p className="text-xs md:text-sm text-gray-300">
                          Email: {record.users?.email}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-3 md:mt-4 grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
                      <div>
                        <p className="text-xs md:text-sm font-medium text-gray-400">Record Type</p>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-1 ${
                          record.record_type === 'prescription' ? 'bg-blue-100 text-blue-800' :
                          record.record_type === 'lab_result' ? 'bg-green-100 text-green-800' :
                          record.record_type === 'imaging' ? 'bg-purple-100 text-purple-800' :
                          record.record_type === 'visit_summary' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {record.record_type.replace('_', ' ')}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs md:text-sm font-medium text-gray-400">Upload Date</p>
                        <p className="text-xs md:text-sm text-white mt-1">
                          {new Date(record.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs md:text-sm font-medium text-gray-400">File Size</p>
                        <p className="text-xs md:text-sm text-white mt-1">
                          {record.file_size ? `${(record.file_size / 1024).toFixed(1)} KB` : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {record.description && (
                      <div className="mt-3 md:mt-4">
                        <p className="text-xs md:text-sm font-medium text-gray-400">Description</p>
                        <p className="text-xs md:text-sm text-gray-300 mt-1">{record.description}</p>
                      </div>
                    )}

                    {record.ai_summary && (
                      <div className="mt-3 md:mt-4">
                        <p className="text-xs md:text-sm font-medium text-gray-400">AI Summary</p>
                        <p className="text-xs md:text-sm text-gray-300 bg-[#164e4e] p-2 md:p-3 rounded-lg mt-1">{record.ai_summary}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 md:mt-0 md:ml-6 flex flex-row md:flex-col gap-2 md:gap-0 md:space-y-2 w-full md:w-auto">
                    {record.file_url && (
                      <button
                        onClick={() => downloadFile(record)}
                        className="flex-1 md:flex-none px-3 py-2 md:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm md:text-base"
                      >
                        Download
                      </button>
                    )}
                    
                    <button className="flex-1 md:flex-none px-3 py-2 md:px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm md:text-base">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
