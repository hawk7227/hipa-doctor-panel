'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, FileText, Clock, AlertTriangle, CheckCircle, Lock } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'

export default function ChartManagementPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authUser = await getCurrentUser()
        if (!authUser || !authUser.doctor) {
          router.push('/login')
          return
        }
        // TODO Phase G: Check if user is provider (not assistant)
        setAuthorized(true)
      } catch (error) {
        console.error('Auth check failed:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1f1f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400"></div>
      </div>
    )
  }

  if (!authorized) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#0a1f1f] text-white p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Chart Management</h1>
            <p className="text-sm text-gray-400">Enterprise chart lifecycle, cosign queue, timeliness compliance</p>
          </div>
        </div>

        {/* Chart Status Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
            <div className="flex items-center space-x-2 mb-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400 uppercase">Draft</span>
            </div>
            <p className="text-3xl font-bold text-white">0</p>
          </div>
          <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-400 uppercase">Preliminary</span>
            </div>
            <p className="text-3xl font-bold text-white">0</p>
          </div>
          <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-400 uppercase">Signed</span>
            </div>
            <p className="text-3xl font-bold text-white">0</p>
          </div>
          <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
            <div className="flex items-center space-x-2 mb-2">
              <Lock className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-blue-400 uppercase">Closed</span>
            </div>
            <p className="text-3xl font-bold text-white">0</p>
          </div>
          <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-purple-400 uppercase">Amended</span>
            </div>
            <p className="text-3xl font-bold text-white">0</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cosign Queue */}
          <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">Cosign Queue</h2>
              <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full font-medium">0</span>
            </div>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-gray-400">No notes awaiting cosign</p>
              <p className="text-xs text-gray-500 mt-1">Assistant-submitted notes will appear here</p>
            </div>
          </div>

          {/* Timeliness Alerts */}
          <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-6">
            <div className="flex items-center space-x-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h2 className="text-lg font-semibold text-white">Timeliness Alerts</h2>
              <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full font-medium">All Clear</span>
            </div>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-gray-400">No overdue charts</p>
              <p className="text-xs text-gray-500 mt-1">Charts unsigned after 24hrs will trigger warnings</p>
            </div>
          </div>

          {/* Unsigned Notes */}
          <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-6">
            <div className="flex items-center space-x-2 mb-4">
              <FileText className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-white">Unsigned Notes</h2>
            </div>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-gray-400">No unsigned notes</p>
              <p className="text-xs text-gray-500 mt-1">Draft and preliminary notes will appear here</p>
            </div>
          </div>

          {/* Recent Amendments */}
          <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Shield className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">Recent Amendments</h2>
            </div>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-gray-400">No recent amendments</p>
              <p className="text-xs text-gray-500 mt-1">Late entries, addendums, and corrections appear here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
