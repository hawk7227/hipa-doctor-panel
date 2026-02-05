'use client'

import { ReactNode, useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import AuthWrapper from '@/components/AuthWrapper'
import { signOutAndRedirect } from '@/lib/auth'
import { Menu, X, Bug } from 'lucide-react'
import BugReportWidget from '@/components/BugReportWidget'
import LiveSessionAlert from '@/components/LiveSessionAlert'

interface DoctorLayoutProps {
  children: ReactNode
}

export default function DoctorLayout({ children }: DoctorLayoutProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  const isActive = (path: string) => pathname === path

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [sidebarOpen])
  
  return (
    <AuthWrapper>
      <div className="min-h-screen bg-gray-900 flex">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden fixed top-4 left-4 z-[60] p-2 bg-[#0d2626] text-white rounded-lg border border-[#1a3d3d] hover:bg-[#164e4e] transition-colors"
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Backdrop overlay for mobile */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed left-0 top-0 h-screen w-64 bg-[#0d2626] shadow-xl border-r border-[#1a3d3d] z-50 transition-transform duration-300 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="h-full flex flex-col p-6">
            {/* Header */}
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center">
                <div className="w-6 h-6 bg-white rounded-full"></div>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Medazon Health</h1>
                <p className="text-xs text-teal-400">Doctor Panel</p>
              </div>
            </div>
            
            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto">
              <div className="space-y-2">
                <Link 
                  href="/doctor/dashboard" 
                  className={`block px-4 py-3 rounded-lg font-medium transition-colors ${
                    isActive('/doctor/dashboard') 
                      ? 'bg-[#164e4e] text-white' 
                      : 'text-gray-300 hover:bg-[#164e4e]'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  Dashboard
                </Link>
                
                <Link 
                  href="/doctor/appointments" 
                  className={`block px-4 py-3 rounded-lg transition-colors ${
                    isActive('/doctor/appointments') 
                      ? 'bg-[#164e4e] text-white font-medium' 
                      : 'text-gray-300 hover:bg-[#164e4e]'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  Appointments
                </Link>
                
                <Link 
                  href="/doctor/patients" 
                  className={`block px-4 py-3 rounded-lg transition-colors ${
                    isActive('/doctor/patients') 
                      ? 'bg-[#164e4e] text-white font-medium' 
                      : 'text-gray-300 hover:bg-[#164e4e]'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  Patients
                </Link>
                
                <Link 
                  href="/doctor/records" 
                  className={`block px-4 py-3 rounded-lg transition-colors ${
                    isActive('/doctor/records') 
                      ? 'bg-[#164e4e] text-white font-medium' 
                      : 'text-gray-300 hover:bg-[#164e4e]'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  Medical Records
                </Link>

                <Link 
                  href="/doctor/communication" 
                  className={`block px-4 py-3 rounded-lg transition-colors ${
                    isActive('/doctor/communication') 
                      ? 'bg-[#164e4e] text-white font-medium' 
                      : 'text-gray-300 hover:bg-[#164e4e]'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  Communication
                </Link>
                
                <Link 
                  href="/doctor/billing" 
                  className={`block px-4 py-3 rounded-lg transition-colors ${
                    isActive('/doctor/billing') 
                      ? 'bg-[#164e4e] text-white font-medium' 
                      : 'text-gray-300 hover:bg-[#164e4e]'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  Billing & Reports
                </Link>
                
                <Link 
                  href="/doctor/profile" 
                  className={`block px-4 py-3 rounded-lg transition-colors ${
                    isActive('/doctor/profile') 
                      ? 'bg-[#164e4e] text-white font-medium' 
                      : 'text-gray-300 hover:bg-[#164e4e]'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  Profile & Credentials
                </Link>
                
                <Link 
                  href="/doctor/availability" 
                  className={`block px-4 py-3 rounded-lg transition-colors ${
                    isActive('/doctor/availability') 
                      ? 'bg-[#164e4e] text-white font-medium' 
                      : 'text-gray-300 hover:bg-[#164e4e]'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  Availability
                </Link>

                {/* Bug Reports Section */}
                <div className="mt-4 pt-4 border-t border-[#1a3d3d]">
                  <Link 
                    href="/doctor/bug-reports" 
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                      isActive('/doctor/bug-reports') 
                        ? 'bg-[#164e4e] text-white font-medium' 
                        : 'text-gray-300 hover:bg-[#164e4e]'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Bug className="w-4 h-4" />
                    My Bug Reports
                  </Link>
                  <Link 
                    href="/doctor/admin-bugs" 
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-colors mt-1 ${
                      isActive('/doctor/admin-bugs') 
                        ? 'bg-red-600/30 text-red-400 font-medium' 
                        : 'text-red-400/70 hover:bg-red-600/20 hover:text-red-400'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Bug className="w-4 h-4" />
                    Admin: Bug Reports
                  </Link>
                </div>
              </div>
            </nav>
            
            {/* Footer */}
            <div className="mt-4 border border-[#1a3d3d] rounded-lg p-2">
              <button
                onClick={signOutAndRedirect}
                className="block px-4 py-3 text-gray-300 hover:bg-[#164e4e] w-full text-left rounded-lg border border-[#1a3d3d] transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 w-full lg:ml-64 transition-all duration-300">
          <div className="pt-16 lg:pt-0 p-2 sm:p-4 lg:p-6">
            <div className="max-w-full">
              {children}
            </div>
          </div>
        </main>

        {/* Bug Report Widget - Floating button */}
        <BugReportWidget />

        {/* Live Session Alert - Shows when admin requests a session */}
        <LiveSessionAlert />
      </div>
    </AuthWrapper>
  )
}
