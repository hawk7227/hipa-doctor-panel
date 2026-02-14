'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Shield, Activity } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'

export default function StaffManagementPage() {
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Staff Management</h1>
              <p className="text-sm text-gray-400">Add assistants, manage permissions, view activity</p>
            </div>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Add Staff</span>
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Active Staff</p>
                <p className="text-2xl font-bold text-white">0</p>
              </div>
            </div>
          </div>
          <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Pending Invites</p>
                <p className="text-2xl font-bold text-white">0</p>
              </div>
            </div>
          </div>
          <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Active Sessions</p>
                <p className="text-2xl font-bold text-white">0</p>
              </div>
            </div>
          </div>
        </div>

        {/* Staff List - Empty State */}
        <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-8">
          <div className="flex flex-col items-center justify-center text-center py-12">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Staff Members Yet</h3>
            <p className="text-gray-400 mb-6 max-w-md">Add assistants, scribes, or medical assistants to your practice. They&apos;ll get their own login and can help manage patient charts.</p>
            <button className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-lg font-bold transition-colors flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Add Your First Staff Member</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
