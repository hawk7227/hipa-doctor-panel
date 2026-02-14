// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — MINI CALENDAR
// Small month grid widget for quick date navigation
// Clickable dates, current date highlight, appointment dot indicators
// ═══════════════════════════════════════════════════════════════

'use client'

import React, { useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PROVIDER_TIMEZONE } from '@/lib/constants'

// ─── TYPES ───────────────────────────────────────────────────
interface MiniCalendarProps {
  /** Currently viewed date in the main calendar */
  currentDate: Date
  /** Called when user clicks a date */
  onDateSelect: (date: Date) => void
  /** Called when user changes month */
  onMonthChange: (date: Date) => void
  /** Set of date strings (YYYY-MM-DD) that have appointments */
  datesWithAppointments: Set<string>
}

// ─── HELPERS ─────────────────────────────────────────────────
function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = []
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Pad start of month with previous month's days
  const startDayOfWeek = firstDay.getDay() // 0=Sun
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i))
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d))
  }

  // Pad end to complete the grid (always 42 cells = 6 rows)
  while (days.length < 42) {
    const nextDay = days.length - startDayOfWeek - lastDay.getDate() + 1
    days.push(new Date(year, month + 1, nextDay))
  }

  return days
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

// ─── COMPONENT ───────────────────────────────────────────────
function MiniCalendarInner({
  currentDate,
  onDateSelect,
  onMonthChange,
  datesWithAppointments,
}: MiniCalendarProps) {
  const today = useMemo(() => new Date(), [])
  const viewMonth = currentDate.getMonth()
  const viewYear = currentDate.getFullYear()

  const days = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth])

  const monthLabel = useMemo(() => {
    return currentDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: PROVIDER_TIMEZONE,
    })
  }, [currentDate])

  const handlePrevMonth = useCallback(() => {
    const prev = new Date(viewYear, viewMonth - 1, 1)
    onMonthChange(prev)
  }, [viewYear, viewMonth, onMonthChange])

  const handleNextMonth = useCallback(() => {
    const next = new Date(viewYear, viewMonth + 1, 1)
    onMonthChange(next)
  }, [viewYear, viewMonth, onMonthChange])

  const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  return (
    <div className="bg-[#0d2626] border border-[#1a3d3d] rounded-xl p-3 select-none" style={{ width: '260px' }}>
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={handlePrevMonth}
          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-white">{monthLabel}</span>
        <button
          onClick={handleNextMonth}
          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day of Week Headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {dayLabels.map((label) => (
          <div key={label} className="text-center text-[10px] font-medium text-gray-500 py-1">
            {label}
          </div>
        ))}
      </div>

      {/* Date Grid */}
      <div className="grid grid-cols-7 gap-0">
        {days.map((day, idx) => {
          const isCurrentMonth = day.getMonth() === viewMonth
          const isToday = isSameDay(day, today)
          const isSelected = isSameDay(day, currentDate)
          const dateKey = formatDateKey(day)
          const hasAppointment = datesWithAppointments.has(dateKey)

          return (
            <button
              key={idx}
              onClick={() => onDateSelect(day)}
              className={`
                relative flex flex-col items-center justify-center
                w-full aspect-square rounded-lg text-xs font-medium
                transition-colors
                ${!isCurrentMonth ? 'text-gray-600' : 'text-gray-300'}
                ${isToday && !isSelected ? 'text-red-400 font-bold' : ''}
                ${isSelected ? 'bg-red-500/30 text-white font-bold' : 'hover:bg-white/10'}
              `}
              aria-label={`${day.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}${hasAppointment ? ', has appointments' : ''}`}
              aria-current={isToday ? 'date' : undefined}
            >
              <span className="leading-none">{day.getDate()}</span>
              {/* Appointment dot indicator */}
              {hasAppointment && (
                <div
                  className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                    isSelected ? 'bg-white' : isToday ? 'bg-red-400' : 'bg-teal-400'
                  }`}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Today button */}
      <div className="mt-2 pt-2 border-t border-[#1a3d3d]">
        <button
          onClick={() => onDateSelect(today)}
          className="w-full text-center text-xs text-teal-400 hover:text-teal-300 font-medium py-1 rounded hover:bg-teal-500/10 transition-colors"
        >
          Today
        </button>
      </div>
    </div>
  )
}

const MiniCalendar = React.memo(MiniCalendarInner)
MiniCalendar.displayName = 'MiniCalendar'
export default MiniCalendar
