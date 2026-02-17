// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState } from 'react'
import './mobile-first.css'

// ============================================
// TYPES
// ============================================
interface DaySchedule {
  day: string
  enabled: boolean
  startTime: string
  endTime: string
}

interface Override {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  type: 'blocked' | 'personal' | 'available'
}

// ============================================
// MOBILE-FIRST AVAILABILITY PAGE
// ============================================
export default function MobileAvailability() {
  const [activeTab, setActiveTab] = useState<'week' | 'month' | 'settings'>('week')
  const [activeNav, setActiveNav] = useState('calendar')

  // Weekly schedule
  const [weeklyHours, setWeeklyHours] = useState<DaySchedule[]>([
    { day: 'Monday', enabled: true, startTime: '9:00 AM', endTime: '5:00 PM' },
    { day: 'Tuesday', enabled: true, startTime: '9:00 AM', endTime: '5:00 PM' },
    { day: 'Wednesday', enabled: true, startTime: '9:00 AM', endTime: '5:00 PM' },
    { day: 'Thursday', enabled: true, startTime: '9:00 AM', endTime: '5:00 PM' },
    { day: 'Friday', enabled: true, startTime: '9:00 AM', endTime: '3:00 PM' },
    { day: 'Saturday', enabled: false, startTime: '', endTime: '' },
    { day: 'Sunday', enabled: false, startTime: '', endTime: '' },
  ])

  // Upcoming overrides
  const overrides: Override[] = [
    { id: '1', title: "Doctor's Appointment", date: 'Jan 25, 2025', startTime: '2:00 PM', endTime: '4:00 PM', type: 'blocked' },
    { id: '2', title: 'Conference Call', date: 'Jan 28, 2025', startTime: '10:00 AM', endTime: '11:00 AM', type: 'personal' },
    { id: '3', title: 'Extended Hours', date: 'Jan 30, 2025', startTime: '5:00 PM', endTime: '7:00 PM', type: 'available' },
  ]

  const toggleDay = (index: number) => {
    const updated = [...weeklyHours]
    updated[index].enabled = !updated[index].enabled
    setWeeklyHours(updated)
  }

  const getOverrideColor = (type: string) => {
    switch (type) {
      case 'blocked': return { bg: 'rgba(239, 68, 68, 0.1)', border: 'var(--danger-red)', text: 'var(--danger-red)' }
      case 'personal': return { bg: 'rgba(139, 92, 246, 0.1)', border: 'var(--purple)', text: 'var(--purple)' }
      case 'available': return { bg: 'rgba(34, 197, 94, 0.1)', border: 'var(--success-green)', text: 'var(--success-green)' }
      default: return { bg: 'var(--bg-gray-100)', border: 'var(--border-light)', text: 'var(--text-secondary)' }
    }
  }

  return (
    <div className="mobile-page">
      {/* Header */}
      <div style={{
        padding: '16px',
        paddingTop: 'calc(16px + env(safe-area-inset-top))',
        background: 'var(--bg-white)',
        borderBottom: '1px solid var(--border-light)'
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Availability
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Manage your schedule
        </p>
      </div>

      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '16px',
        background: 'var(--bg-white)',
        borderBottom: '1px solid var(--border-light)'
      }}>
        {(['week', 'month', 'settings'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === tab ? 'var(--primary-teal)' : 'var(--bg-gray-100)',
              color: activeTab === tab ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        padding: '16px',
        background: 'var(--bg-white)',
        borderBottom: '1px solid var(--border-light)'
      }}>
        <button style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '20px 16px',
          background: 'rgba(20, 184, 166, 0.1)',
          border: '1px solid rgba(20, 184, 166, 0.3)',
          borderRadius: '12px',
          cursor: 'pointer'
        }}>
          <span style={{ fontSize: '24px' }}>✓</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary-teal)' }}>
            Add Available
          </span>
        </button>
        <button style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '20px 16px',
          background: 'var(--bg-gray-100)',
          border: '1px solid var(--border-light)',
          borderRadius: '12px',
          cursor: 'pointer'
        }}>
          <span style={{ fontSize: '24px' }}>✕</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--danger-red)' }}>
            Block Time
          </span>
        </button>
      </div>

      {/* Weekly Hours Section */}
      <div style={{ padding: '16px 16px 8px' }}>
        <h2 style={{ 
          fontSize: '16px', 
          fontWeight: 700, 
          color: 'var(--text-primary)'
        }}>
          Weekly Hours
        </h2>
      </div>

      <div style={{
        background: 'var(--bg-white)',
        margin: '0 16px 16px',
        borderRadius: '12px',
        border: '1px solid var(--border-light)',
        overflow: 'hidden'
      }}>
        {weeklyHours.map((schedule, index) => (
          <div 
            key={schedule.day}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: index < weeklyHours.length - 1 ? '1px solid var(--border-light)' : 'none'
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontSize: '15px', 
                fontWeight: 600, 
                color: 'var(--text-primary)' 
              }}>
                {schedule.day}
              </div>
              {schedule.enabled && (
                <div style={{ 
                  fontSize: '13px', 
                  color: 'var(--primary-teal)',
                  marginTop: '2px'
                }}>
                  {schedule.startTime} - {schedule.endTime}
                </div>
              )}
              {!schedule.enabled && (
                <div style={{ 
                  fontSize: '13px', 
                  color: 'var(--text-muted)',
                  marginTop: '2px'
                }}>
                  Off
                </div>
              )}
            </div>
            
            {/* Toggle Switch */}
            <button
              onClick={() => toggleDay(index)}
              style={{
                width: '50px',
                height: '28px',
                borderRadius: '14px',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                background: schedule.enabled ? 'var(--primary-teal)' : 'var(--bg-gray-200)',
                transition: 'background 0.2s'
              }}
            >
              <span style={{
                position: 'absolute',
                top: '2px',
                left: schedule.enabled ? '24px' : '2px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transition: 'left 0.2s'
              }} />
            </button>
          </div>
        ))}
      </div>

      {/* Upcoming Overrides Section */}
      <div style={{ padding: '16px 16px 8px' }}>
        <h2 style={{ 
          fontSize: '16px', 
          fontWeight: 700, 
          color: 'var(--text-primary)'
        }}>
          Upcoming Overrides
        </h2>
      </div>

      <div style={{
        background: 'var(--bg-white)',
        margin: '0 16px 100px',
        borderRadius: '12px',
        border: '1px solid var(--border-light)',
        overflow: 'hidden'
      }}>
        {overrides.map((override, index) => {
          const colors = getOverrideColor(override.type)
          return (
            <div 
              key={override.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                borderBottom: index < overrides.length - 1 ? '1px solid var(--border-light)' : 'none'
              }}
            >
              {/* Color indicator */}
              <div style={{
                width: '4px',
                height: '40px',
                borderRadius: '2px',
                background: colors.border
              }} />
              
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: '15px', 
                  fontWeight: 600, 
                  color: 'var(--text-primary)' 
                }}>
                  {override.title}
                </div>
                <div style={{ 
                  fontSize: '13px', 
                  color: 'var(--text-muted)',
                  marginTop: '2px'
                }}>
                  {override.date} • {override.startTime} - {override.endTime}
                </div>
              </div>
              
              {/* Type badge */}
              <span style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                background: colors.bg,
                color: colors.text
              }}>
                {override.type}
              </span>
            </div>
          )
        })}
      </div>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <div className="nav-item" onClick={() => setActiveNav('home')}>
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Home</span>
        </div>
        <div className={`nav-item ${activeNav === 'calendar' ? 'active' : ''}`} onClick={() => setActiveNav('calendar')}>
          <span className="nav-icon">📅</span>
          <span className="nav-label">Calendar</span>
        </div>
        <div className="nav-item" onClick={() => setActiveNav('patients')}>
          <span className="nav-icon">👥</span>
          <span className="nav-label">Patients</span>
        </div>
        <div className="nav-item" onClick={() => setActiveNav('messages')}>
          <span className="nav-icon">💬</span>
          <span className="nav-label">Messages</span>
        </div>
        <div className="nav-item" onClick={() => setActiveNav('profile')}>
          <span className="nav-icon">👤</span>
          <span className="nav-label">Profile</span>
        </div>
      </nav>
    </div>
  )
}
