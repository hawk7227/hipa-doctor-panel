import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { supabase, Appointment } from '@/lib/supabase'
import { sendAppointmentStatusEmail } from '@/lib/email'
import AppointmentDetailModal from '@/components/AppointmentDetailModal'
import CreateAppointmentDialog from '@/components/CreateAppointmentDialog'
import InstantVisitQueueModal from '@/components/InstantVisitQueueModal'

// ============================================
// TIMEZONE UTILITIES
// ============================================
function convertToTimezone(dateString: string, timezone: string): Date {
  const date = new Date(dateString)
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }
  const formatter = new Intl.DateTimeFormat('en-US', options)
  const parts = formatter.formatToParts(date)
  
  const getValue = (type: string) => parts.find(part => part.type === type)?.value || '0'
  
  const year = parseInt(getValue('year'))
  const month = parseInt(getValue('month')) - 1
  const day = parseInt(getValue('day'))
  const hour = parseInt(getValue('hour'))
  const minute = parseInt(getValue('minute'))
  const second = parseInt(getValue('second'))
  
  return new Date(Date.UTC(year, month, day, hour, minute, second))
}

function getDateString(date: Date, timezone?: string): string {
  if (timezone) {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper function to create a time slot explicitly as Phoenix time
// This ensures time slots represent Phoenix time regardless of browser timezone
function createPhoenixTimeSlot(hour: number, minute: number): Date {
  const today = new Date()
  const phoenixFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  
  const parts = phoenixFormatter.formatToParts(today)
  const getValue = (type: string) => parts.find(part => part.type === type)?.value || '0'
  
  const year = parseInt(getValue('year'))
  const month = parseInt(getValue('month')) - 1
  const day = parseInt(getValue('day'))
  
  return new Date(Date.UTC(year, month, day, hour, minute, 0))
}

// Get today's date at midnight local time (no timezone drift)
function getTodayLocal(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

// ============================================
// TYPE DEFINITIONS
// ============================================
interface ClinicalNote {
  id: string
  note_type: string
  content: string | null
}

interface CalendarAppointment extends Omit<Appointment, 'patients' | 'requested_date_time' | 'visit_type'> {
  requested_date_time: string | null
  visit_type: string | null
  patients?: {
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    phone?: string | null
    chief_complaint?: string | null
  } | null
  doctors?: {
    timezone: string
  }
  clinical_notes?: ClinicalNote[] | null
  subjective_notes?: string | null
  chief_complaint?: string | null
  reason?: string | null
}

interface SearchPatient {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
}

type ViewType = 'calendar' | 'list'
type CalendarViewType = 'week' | 'month' | '3month'

// ============================================
// STYLES
// ============================================
const styles = `
/* Hide sidebar on this page */
aside, [class*="sidebar"], [class*="Sidebar"], nav:not(.header *) {
  display: none !important;
}

/* Make main content full width */
main, [class*="main"] {
  margin-left: 0 !important;
  padding-left: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Inter', -apple-system, sans-serif;
  background: linear-gradient(-45deg, #0a0a1a, #1a0a2e, #0a1a2e, #0a0a1a);
  background-size: 400% 400%;
  color: #fff;
  min-height: 100vh;
  overflow-x: hidden;
}

.header {
  background: linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(236, 72, 153, 0.1), rgba(59, 130, 246, 0.1));
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px 24px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-text {
  font-size: 22px;
  font-weight: 800;
  color: #fff;
  white-space: nowrap;
}

.view-tabs {
  display: flex;
  gap: 4px;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px;
  border-radius: 10px;
}

.view-tab {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: transparent;
  color: #888;
  transition: all 0.2s ease;
}

.view-tab:hover {
  color: #fff;
}

.view-tab.active {
  background: linear-gradient(135deg, #14b8a6, #0d9488);
  color: #000;
}

.search-container {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-input {
  width: 100%;
  padding: 10px 16px 10px 40px;
  border-radius: 25px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
}

.search-input::placeholder {
  color: #666;
}

.search-input:focus {
  border-color: rgba(20, 184, 166, 0.5);
  box-shadow: 0 0 20px rgba(20, 184, 166, 0.2);
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #666;
  font-size: 14px;
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: rgba(15, 15, 35, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  margin-top: 8px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.search-result-item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
}

.search-result-item:hover {
  background: rgba(20, 184, 166, 0.1);
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-name {
  font-weight: 600;
  color: #fff;
  margin-bottom: 2px;
}

.search-result-email {
  font-size: 12px;
  color: #888;
}

.search-no-results {
  padding: 16px;
  text-align: center;
  color: #666;
}

.header-spacer { flex: 1; }

.back-btn {
  background: transparent;
  border: 1px solid rgba(20, 184, 166, 0.5);
  color: #14b8a6;
  padding: 10px 20px;
  border-radius: 25px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.back-btn:hover {
  background: rgba(20, 184, 166, 0.15);
  box-shadow: 0 0 20px rgba(20, 184, 166, 0.3);
}

.container {
  max-width: 1600px;
  margin: 0 auto;
  padding: 20px 24px;
  position: relative;
  z-index: 1;
}

.calendar-card {
  background: rgba(15, 15, 35, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 20px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  overflow: auto;
  max-height: calc(100vh - 380px);
  min-height: 400px;
}

.calendar-header-cell {
  background: rgba(15, 15, 35, 0.9);
  padding: 14px 8px;
  text-align: center;
  font-weight: 700;
  font-size: 13px;
  color: #00f5ff;
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 10;
}

.calendar-header-cell:first-child {
  color: #ec4899;
}

.time-cell {
  padding: 12px 8px;
  text-align: right;
  font-weight: 600;
  font-size: 12px;
  color: #ec4899;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(15, 15, 35, 0.5);
}

.calendar-cell {
  padding: 6px;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  min-height: 70px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.calendar-cell:hover {
  background: rgba(20, 184, 166, 0.1);
}

.slot {
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 11px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: all 0.2s ease;
}

.slot.available {
  background: linear-gradient(135deg, rgba(0, 200, 100, 0.2), rgba(20, 184, 166, 0.25));
  border: 1px solid rgba(0, 200, 100, 0.4);
}

.slot.available:hover {
  transform: scale(1.02);
  box-shadow: 0 0 15px rgba(0, 200, 100, 0.3);
}

.slot.booked {
  cursor: pointer;
}

.slot.booked:hover {
  transform: scale(1.02);
}

.slot.video {
  background: linear-gradient(135deg, rgba(0, 180, 220, 0.25), rgba(0, 150, 200, 0.2));
  border: 1px solid rgba(0, 180, 220, 0.5);
}

.slot.phone {
  background: linear-gradient(135deg, rgba(0, 180, 100, 0.25), rgba(0, 150, 80, 0.2));
  border: 1px solid rgba(0, 180, 100, 0.5);
}

.slot.async {
  background: linear-gradient(135deg, rgba(150, 100, 220, 0.25), rgba(130, 80, 200, 0.2));
  border: 1px solid rgba(150, 100, 220, 0.5);
}

.slot.instant {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(220, 140, 10, 0.2));
  border: 1px solid rgba(245, 158, 11, 0.5);
}

.slot-title {
  font-weight: 600;
  font-size: 11px;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 4px;
}

.slot-time {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 2px;
}

.slot-patient {
  font-weight: 700;
  font-size: 12px;
  color: #fff;
  margin-bottom: 4px;
}

.slot-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
}

.slot-badge.video {
  background: rgba(0, 180, 220, 0.3);
  color: #00d4ff;
}

.slot-badge.phone {
  background: rgba(0, 180, 100, 0.3);
  color: #00ff88;
}

.slot-badge.async {
  background: rgba(150, 100, 220, 0.3);
  color: #c4a5ff;
}

.slot-badge.instant {
  background: rgba(245, 158, 11, 0.3);
  color: #f59e0b;
}

.slot-reason {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar {
  background: rgba(15, 15, 35, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-primary {
  background: linear-gradient(135deg, #14b8a6, #0d9488);
  color: #000;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(20, 184, 166, 0.4);
}

.btn-ghost {
  background: transparent;
  color: #00f5ff;
  border: 1px solid rgba(0, 245, 255, 0.3);
}

.btn-ghost:hover {
  background: rgba(0, 245, 255, 0.1);
  border-color: #00f5ff;
}

.nav-arrow {
  font-size: 16px;
  min-width: 36px;
  padding: 8px;
}

.date-pill {
  background: linear-gradient(135deg, rgba(0, 245, 255, 0.2), rgba(20, 184, 166, 0.2));
  border: 1px solid rgba(0, 245, 255, 0.4);
  color: #00f5ff;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}

.toolbar-spacer { flex: 1; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: rgba(15, 15, 35, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-3px);
  border-color: rgba(20, 184, 166, 0.4);
  box-shadow: 0 10px 30px rgba(20, 184, 166, 0.2);
}

.stat-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 32px;
  font-weight: 900;
  background: linear-gradient(135deg, #00f5ff, #ff00ff);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.legend {
  background: rgba(15, 15, 35, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #ccc;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-dot.available {
  background: linear-gradient(135deg, #00ff00, #00cc00);
  box-shadow: 0 0 8px #00ff00;
}

.legend-dot.booked {
  background: linear-gradient(135deg, #ff4444, #cc0000);
  box-shadow: 0 0 8px #ff4444;
}

.legend-dot.video {
  background: linear-gradient(135deg, #00d4ff, #00a8cc);
  box-shadow: 0 0 8px #00d4ff;
}

.legend-dot.async {
  background: linear-gradient(135deg, #c4a5ff, #9966ff);
  box-shadow: 0 0 8px #c4a5ff;
}

.legend-dot.phone {
  background: linear-gradient(135deg, #00ff88, #00cc66);
  box-shadow: 0 0 8px #00ff88;
}

.legend-dot.instant {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  box-shadow: 0 0 8px #f59e0b;
}

/* Month View */
.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: rgba(255, 255, 255, 0.05);
}

.month-header {
  background: rgba(15, 15, 35, 0.9);
  padding: 12px;
  text-align: center;
  font-weight: 700;
  font-size: 12px;
  color: #00f5ff;
  text-transform: uppercase;
}

.month-cell {
  background: rgba(15, 15, 35, 0.5);
  min-height: 100px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.month-cell:hover {
  background: rgba(20, 184, 166, 0.1);
}

.month-cell.empty {
  background: rgba(0, 0, 0, 0.2);
  cursor: default;
}

.month-day {
  font-size: 14px;
  font-weight: 700;
  color: #00f5ff;
  margin-bottom: 8px;
}

.month-appointment {
  font-size: 10px;
  padding: 4px 6px;
  border-radius: 4px;
  margin-bottom: 3px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.month-appointment.video {
  background: rgba(0, 180, 220, 0.2);
  color: #00d4ff;
}

.month-appointment.phone {
  background: rgba(0, 180, 100, 0.2);
  color: #00ff88;
}

.month-appointment.async {
  background: rgba(150, 100, 220, 0.2);
  color: #c4a5ff;
}

.month-appointment.instant {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.month-more {
  font-size: 10px;
  color: #888;
}

/* List View */
.list-view {
  overflow: auto;
  max-height: calc(100vh - 380px);
}

.list-table {
  width: 100%;
  border-collapse: collapse;
}

.list-table th {
  padding: 12px 16px;
  text-align: left;
  background: rgba(15, 15, 35, 0.9);
  color: #00f5ff;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.list-table td {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.list-table tr {
  cursor: pointer;
  transition: all 0.2s ease;
}

.list-table tr:hover {
  background: rgba(20, 184, 166, 0.1);
}

.list-table .patient-name {
  font-weight: 700;
  color: #fff;
}

.list-table .date-time {
  color: #888;
  font-size: 13px;
}

.list-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.list-badge.video {
  background: rgba(0, 180, 220, 0.15);
  color: #00d4ff;
}

.list-badge.phone {
  background: rgba(0, 180, 100, 0.15);
  color: #00ff88;
}

.list-badge.async {
  background: rgba(150, 100, 220, 0.15);
  color: #c4a5ff;
}

.list-badge.instant {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.list-table .reason {
  color: #888;
  font-size: 12px;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-table .contact {
  color: #888;
  font-size: 12px;
}

.list-table .empty-state {
  text-align: center;
  color: #888;
  padding: 40px;
}

/* Notification */
.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  max-width: 400px;
  border-radius: 12px;
  padding: 16px;
  z-index: 9999;
  box-shadow: 0 12px 60px rgba(0,0,0,.45);
  display: flex;
  align-items: start;
  gap: 12px;
}

.notification.success {
  background: #0e2a1c;
  border: 1px solid #1e5a3a;
  color: #cde7da;
}

.notification.error {
  background: #2a1417;
  border: 1px solid #5a2a32;
  color: #f0d7dc;
}

.notification-close {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: inherit;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.notification-close:hover {
  opacity: 1;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(10, 10, 26, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 3px solid transparent;
  border-top: 3px solid #00f5ff;
  border-right: 3px solid #ff00ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 16px;
  color: #00f5ff;
  font-size: 16px;
  font-weight: 600;
}

.hint {
  padding: 12px 16px;
  text-align: center;
  color: rgba(20, 184, 166, 0.7);
  font-size: 13px;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .header-content {
    flex-wrap: wrap;
  }
  
  .search-container {
    order: 10;
    max-width: 100%;
    width: 100%;
    margin-top: 10px;
  }
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #14b8a6, #ec4899);
  border-radius: 4px;
}
`

// ============================================
// MAIN COMPONENT
// ============================================
export default function DoctorAppointments() {
  // State - Initialize currentDate to TODAY at midnight local time
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState<Date>(getTodayLocal())
  const [viewType, setViewType] = useState<ViewType>('calendar')
  const [calendarViewType, setCalendarViewType] = useState<CalendarViewType>('week')
  const [currentDoctorId, setCurrentDoctorId] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedSlotDate, setSelectedSlotDate] = useState<Date | null>(null)
  const [selectedSlotTime, setSelectedSlotTime] = useState<Date | null>(null)
  const [followUpPatientData, setFollowUpPatientData] = useState<{
    id: string
    first_name: string
    last_name: string
    email: string
    mobile_phone: string
  } | null>(null)
  
  // Instant visit queue state
  const [instantVisitQueue, setInstantVisitQueue] = useState<CalendarAppointment[]>([])
  const [activeInstantVisit, setActiveInstantVisit] = useState<CalendarAppointment | null>(null)
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchPatient[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  const calendarGridRef = useRef<HTMLDivElement | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Provider timezone is ALWAYS America/Phoenix
  const DOCTOR_TIMEZONE = 'America/Phoenix'

  // ============================================
  // TIME SLOTS - Using Phoenix time explicitly
  // ============================================
  const timeSlots = useMemo(() => {
    const slots: Date[] = []
    for (let hour = 5; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = createPhoenixTimeSlot(hour, minute)
        slots.push(time)
      }
    }
    return slots
  }, [])

  // Format time using UTC methods (since Phoenix time is stored in UTC values)
  const formatTime = (date: Date) => {
    const hours = date.getUTCHours()
    const minutes = date.getUTCMinutes()
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')
    return `${displayHours}:${displayMinutes} ${period}`
  }

  // Get the actual appointment time
  const getAppointmentActualTime = (appointment: CalendarAppointment): string => {
    if (!appointment.requested_date_time) return ''
    
    const appointmentDate = convertToTimezone(appointment.requested_date_time, DOCTOR_TIMEZONE)
    const hours = appointmentDate.getUTCHours()
    const minutes = appointmentDate.getUTCMinutes()
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')
    
    return `${displayHours}:${displayMinutes} ${period}`
  }

  // ============================================
  // CALENDAR UTILITIES - Today on far left
  // ============================================
  const getWeekDates = useCallback((date: Date) => {
    const dates: Date[] = []
    const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      dates.push(d)
    }
    return dates
  }, [])

  const getMonthDates = useCallback((date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const lastDay = new Date(year, month + 1, 0)
    
    const dates: Date[] = []
    for (let day = 1; day <= lastDay.getDate(); day++) {
      dates.push(new Date(year, month, day))
    }
    return dates
  }, [])

  const getThreeMonthDates = useCallback((date: Date) => {
    const dates: Date[] = []
    const startMonth = date.getMonth()
    const year = date.getFullYear()
    
    for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
      const lastDay = new Date(year, startMonth + monthOffset + 1, 0)
      
      for (let day = 1; day <= lastDay.getDate(); day++) {
        dates.push(new Date(year, startMonth + monthOffset, day))
      }
    }
    return dates
  }, [])

  const visibleDates = useMemo(() => {
    if (calendarViewType === 'week') {
      return getWeekDates(currentDate)
    } else if (calendarViewType === 'month') {
      return getMonthDates(currentDate)
    } else {
      return getThreeMonthDates(currentDate)
    }
  }, [currentDate, calendarViewType, getWeekDates, getMonthDates, getThreeMonthDates])

  const navigateCalendar = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (calendarViewType === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else if (calendarViewType === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    } else if (calendarViewType === '3month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 3 : -3))
    }
    setCurrentDate(newDate)
  }

  // ============================================
  // SMART SEARCH - Search patients in database
  // ============================================
  const searchPatients = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    setSearchLoading(true)
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name, email, phone')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(10)

      if (error) {
        console.error('Search error:', error)
        return
      }

      setSearchResults(data || [])
      setShowSearchResults(true)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchPatients(query)
    }, 300)
  }

  const handlePatientSelect = (patient: SearchPatient) => {
    const patientAppointments = appointments.filter(
      apt => apt.patients?.email === patient.email
    )
    
    if (patientAppointments.length > 0) {
      setSelectedAppointmentId(patientAppointments[0].id)
    }
    
    setSearchQuery('')
    setShowSearchResults(false)
  }

  // ============================================
  // APPOINTMENT HELPERS
  // ============================================
  const getAppointmentReason = (appointment: CalendarAppointment): string => {
    if (appointment.clinical_notes && appointment.clinical_notes.length > 0) {
      const reasonNote = appointment.clinical_notes.find(
        note => note.note_type === 'chief_complaint' || note.note_type === 'subjective'
      )
      if (reasonNote?.content) {
        return reasonNote.content
      }
    }
    
    return appointment.chief_complaint || 
           appointment.patients?.chief_complaint || 
           appointment.reason || 
           ''
  }

  const roundToNearestSlot = (appointmentDate: Date): Date => {
    const rounded = new Date(appointmentDate)
    const minutes = appointmentDate.getUTCMinutes()
    const hours = appointmentDate.getUTCHours()
    
    if (minutes < 15) {
      rounded.setUTCMinutes(0, 0, 0)
      rounded.setUTCHours(hours)
    } else if (minutes < 45) {
      rounded.setUTCMinutes(30, 0, 0)
      rounded.setUTCHours(hours)
    } else {
      rounded.setUTCMinutes(0, 0, 0)
      rounded.setUTCHours(hours + 1)
    }
    
    return rounded
  }

  // Appointment lookup map for O(1) access
  const appointmentMap = useMemo(() => {
    const map = new Map<string, CalendarAppointment>()
    
    appointments.forEach(appointment => {
      if (!appointment.requested_date_time) return
      
      const appointmentDate = convertToTimezone(appointment.requested_date_time, DOCTOR_TIMEZONE)
      const dateStr = getDateString(appointmentDate, DOCTOR_TIMEZONE)
      const roundedSlot = roundToNearestSlot(appointmentDate)
      
      const hour = roundedSlot.getUTCHours()
      const minute = roundedSlot.getUTCMinutes()
      const key = `${dateStr}_${hour}_${minute}`
      
      map.set(key, appointment)
    })
    
    return map
  }, [appointments])

  const getAppointmentForSlot = useCallback((date: Date, time: Date) => {
    const dateInPhoenix = convertToTimezone(date.toISOString(), DOCTOR_TIMEZONE)
    const slotDateStr = getDateString(dateInPhoenix, DOCTOR_TIMEZONE)
    
    const hour = time.getUTCHours()
    const minute = time.getUTCMinutes()
    
    const key = `${slotDateStr}_${hour}_${minute}`
    return appointmentMap.get(key) || null
  }, [appointmentMap])

  // ============================================
  // DATA FETCHING
  // ============================================
  const fetchCurrentDoctor = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        console.error('No authenticated user found')
        setLoading(false)
        return
      }

      const { data: doctor, error } = await supabase
        .from('doctors')
        .select('id')
        .eq('email', user.email)
        .single()

      if (error) {
        console.error('Error fetching doctor:', error)
        setLoading(false)
        return
      }

      if (doctor) {
        setCurrentDoctorId(doctor.id)
        await fetchAppointments(doctor.id)
      }
    } catch (error) {
      console.error('Error fetching current doctor:', error)
      setLoading(false)
    }
  }

  const fetchAppointments = useCallback(async (doctorId: string, skipLoading = false) => {
    try {
      if (!skipLoading) {
        setLoading(true)
      }
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          doctors!appointments_doctor_id_fkey(timezone),
          patients!appointments_patient_id_fkey(first_name, last_name, email, phone, chief_complaint),
          clinical_notes(id, note_type, content)
        `)
        .eq('doctor_id', doctorId)
        .neq('status', 'cancelled')
        .order('requested_date_time', { ascending: true })

      if (error) {
        console.error('Error fetching appointments:', error)
        return
      }

      setAppointments((data || []) as any)
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      if (!skipLoading) {
        setLoading(false)
      }
    }
  }, [])

  // ============================================
  // INSTANT VISIT HANDLERS
  // ============================================
  const handleStartCall = async (appointmentId: string) => {
    const appointment = appointments.find(apt => apt.id === appointmentId)
    if (appointment?.zoom_meeting_url) {
      window.open(appointment.zoom_meeting_url, '_blank')
    } else {
      setNotification({
        type: 'error',
        message: 'No Zoom meeting link available for this appointment'
      })
      setTimeout(() => setNotification(null), 5000)
    }
  }

  const handleCompleteInstantVisit = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', appointmentId)

      if (error) throw error

      setNotification({
        type: 'success',
        message: 'Instant visit completed'
      })
      setTimeout(() => setNotification(null), 5000)

      setIsQueueModalOpen(false)
      setActiveInstantVisit(null)
      if (currentDoctorId) fetchAppointments(currentDoctorId)
    } catch (error) {
      console.error('Error completing visit:', error)
      setNotification({
        type: 'error',
        message: 'Failed to complete visit'
      })
      setTimeout(() => setNotification(null), 5000)
    }
  }

  const handleCancelInstantVisit = async (appointmentId: string) => {
    if (!confirm('Remove this patient from the instant visit queue?')) return

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId)

      if (error) throw error

      setNotification({
        type: 'success',
        message: 'Patient removed from queue'
      })
      setTimeout(() => setNotification(null), 5000)

      setIsQueueModalOpen(false)
      setActiveInstantVisit(null)
      if (currentDoctorId) fetchAppointments(currentDoctorId)
    } catch (error) {
      console.error('Error cancelling visit:', error)
      setNotification({
        type: 'error',
        message: 'Failed to remove patient'
      })
      setTimeout(() => setNotification(null), 5000)
    }
  }

  const handleAppointmentAction = async (appointmentId: string, action: 'accept' | 'reject' | 'complete') => {
    try {
      if (action === 'complete') {
        const { error } = await supabase
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', appointmentId)

        if (error) {
          console.error('Error updating appointment:', error)
          setNotification({
            type: 'error',
            message: 'Failed to mark appointment as complete'
          })
          setTimeout(() => setNotification(null), 5000)
          return
        }

        setNotification({
          type: 'success',
          message: 'Appointment marked as complete'
        })
        setTimeout(() => setNotification(null), 5000)
        if (currentDoctorId) fetchAppointments(currentDoctorId)
        return
      }

      const endpoint = action === 'accept' ? '/api/appointments/accept' : '/api/appointments/reject'
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appointmentId,
          reason: action === 'reject' ? 'Doctor unavailable at this time' : undefined
        })
      })

      const result = await response.json()

      if (!response.ok) {
        setNotification({
          type: 'error',
          message: result.error || `Failed to ${action} appointment`
        })
        setTimeout(() => setNotification(null), 5000)
        return
      }

      let successMessage = `Appointment ${action}ed successfully`
      
      if (action === 'accept') {
        if (result.data.paymentCaptured) {
          successMessage += ' • Payment captured'
        }
        if (result.data.zoomMeeting) {
          successMessage += ' • Zoom meeting created'
        }
      } else if (action === 'reject') {
        if (result.data.paymentRefunded) {
          successMessage += ` • Payment refunded ($${(result.data.refundAmount / 100).toFixed(2)})`
        }
      }

      setNotification({
        type: 'success',
        message: successMessage
      })
      setTimeout(() => setNotification(null), 5000)

      if (currentDoctorId) fetchAppointments(currentDoctorId)
    } catch (error) {
      console.error('Error updating appointment:', error)
      setNotification({
        type: 'error',
        message: 'An unexpected error occurred'
      })
      setTimeout(() => setNotification(null), 5000)
    }
  }

  // ============================================
  // AUTO-SCROLL TO CURRENT TIME
  // ============================================
  const scrollToCurrentTime = useCallback(() => {
    if (calendarGridRef.current && calendarViewType === 'week') {
      const now = new Date()
      const currentHour = now.getHours()
      const rowHeight = 70
      const scrollPosition = Math.max(0, (currentHour - 5) * 2 * rowHeight)
      
      calendarGridRef.current.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      })
    }
  }, [calendarViewType])

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    fetchCurrentDoctor()
  }, [])

  // Auto-scroll AFTER loading completes
  useEffect(() => {
    if (!loading && calendarViewType === 'week') {
      const timer = setTimeout(() => {
        scrollToCurrentTime()
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [loading, calendarViewType, scrollToCurrentTime])

  // Detect instant visits and manage queue
  useEffect(() => {
    if (!currentDoctorId) return

    const instantVisits = appointments.filter(apt => 
      apt.visit_type === 'instant' && 
      apt.status !== 'completed' && 
      apt.status !== 'cancelled'
    )

    setInstantVisitQueue(instantVisits)

    if (instantVisits.length > 0 && !activeInstantVisit) {
      setActiveInstantVisit(instantVisits[0])
      setIsQueueModalOpen(true)
    }
  }, [appointments, currentDoctorId, activeInstantVisit])

  // Real-time subscription for instant visits
  useEffect(() => {
    if (!currentDoctorId) return

    const channel = supabase
      .channel('instant-visits-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `doctor_id=eq.${currentDoctorId}`
        },
        (payload) => {
          const newAppointment = payload.new as CalendarAppointment
          
          if (newAppointment.visit_type === 'instant' && 
              newAppointment.status !== 'completed' && 
              newAppointment.status !== 'cancelled') {
            
            if (currentDoctorId) {
              fetchAppointments(currentDoctorId, true)
            }
            
            setNotification({
              type: 'success',
              message: `⚡ New instant visit: ${newAppointment.patients?.first_name || 'Patient'} ${newAppointment.patients?.last_name || ''}`
            })
            setTimeout(() => setNotification(null), 5000)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `doctor_id=eq.${currentDoctorId}`
        },
        (payload) => {
          const updatedAppointment = payload.new as CalendarAppointment
          
          if (updatedAppointment.visit_type === 'instant' && 
              (updatedAppointment.status === 'completed' || updatedAppointment.status === 'cancelled')) {
            if (currentDoctorId) {
              fetchAppointments(currentDoctorId, true)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentDoctorId, fetchAppointments])

  // ============================================
  // COMPUTED VALUES
  // ============================================
  const dateRange = useMemo(() => {
    if (visibleDates.length === 0) return { toolbar: '', header: '' }
    
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    
    if (calendarViewType === 'week') {
      return {
        toolbar: `Week of ${visibleDates[0].toLocaleDateString('en-US', options)}`,
        header: `${visibleDates[0].toLocaleDateString('en-US', options)} - ${visibleDates[6].toLocaleDateString('en-US', { ...options, year: 'numeric' })}`
      }
    } else {
      return {
        toolbar: currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        header: currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      }
    }
  }, [visibleDates, calendarViewType, currentDate])

  // Stats
  const stats = useMemo(() => {
    const total = appointments.length
    const completed = appointments.filter(a => a.status === 'completed').length
    const pending = appointments.filter(a => a.status === 'accepted').length
    const revenue = completed * 59
    return { total, completed, pending, revenue }
  }, [appointments])

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return (
      <>
        <style>{styles}</style>
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p className="loading-text">Loading appointments...</p>
        </div>
      </>
    )
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <>
      <style>{styles}</style>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <span className="logo-text">Your Appointments</span>
          
          {/* View Tabs in Header */}
          <div className="view-tabs">
            <button 
              className={`view-tab ${calendarViewType === 'week' && viewType === 'calendar' ? 'active' : ''}`}
              onClick={() => { setViewType('calendar'); setCalendarViewType('week'); }}
            >
              Week
            </button>
            <button 
              className={`view-tab ${calendarViewType === 'month' && viewType === 'calendar' ? 'active' : ''}`}
              onClick={() => { setViewType('calendar'); setCalendarViewType('month'); }}
            >
              Month
            </button>
            <button 
              className={`view-tab ${viewType === 'list' ? 'active' : ''}`}
              onClick={() => setViewType('list')}
            >
              List
            </button>
          </div>

          {/* Smart Search */}
          <div className="search-container">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
              onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
            />
            {showSearchResults && (
              <div className="search-results">
                {searchLoading ? (
                  <div className="search-no-results">Searching...</div>
                ) : searchResults.length > 0 ? (
                  searchResults.map(patient => (
                    <div
                      key={patient.id}
                      className="search-result-item"
                      onClick={() => handlePatientSelect(patient)}
                    >
                      <div className="search-result-name">
                        {patient.first_name} {patient.last_name}
                      </div>
                      <div className="search-result-email">
                        {patient.email || patient.phone || 'No contact info'}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="search-no-results">No patients found</div>
                )}
              </div>
            )}
          </div>

          <div className="header-spacer"></div>
          <a href="/doctor/dashboard" className="back-btn">← Back to Dashboard</a>
        </div>
      </header>

      {/* Main Container */}
      <div className="container">
        {/* Calendar / List View */}
        {viewType === 'calendar' ? (
          <div className="calendar-card">
            {calendarViewType === 'week' ? (
              <>
                <div className="calendar-grid" ref={calendarGridRef}>
                  {/* Header Row */}
                  <div className="calendar-header-cell">🕐 TIME</div>
                  {visibleDates.map((date, idx) => (
                    <div key={`header-${idx}`} className="calendar-header-cell">
                      {date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()} {date.getDate()}
                    </div>
                  ))}
                  
                  {/* Calendar Rows */}
                  {timeSlots.map((time, timeIndex) => [
                    <div key={`time-${timeIndex}`} className="time-cell">{formatTime(time)}</div>,
                    ...visibleDates.map((date, dayIndex) => {
                      const apt = getAppointmentForSlot(date, time)
                      const isAvailable = !apt
                      
                      return (
                        <div 
                          key={`cell-${timeIndex}-${dayIndex}`} 
                          className="calendar-cell"
                          onClick={() => {
                            if (isAvailable) {
                              setSelectedSlotDate(date)
                              setSelectedSlotTime(time)
                              setShowCreateDialog(true)
                            } else {
                              setSelectedAppointmentId(apt.id)
                            }
                          }}
                        >
                          {apt ? (
                            <div className={`slot booked ${apt.visit_type || 'video'}`}>
                              <div className="slot-patient">{apt.patients?.first_name} {apt.patients?.last_name}</div>
                              <span className={`slot-badge ${apt.visit_type || 'video'}`}>
                                {apt.visit_type === 'instant' ? '⚡ INSTANT' :
                                 apt.visit_type === 'video' ? '📹 VIDEO' : 
                                 apt.visit_type === 'phone' ? '📞 PHONE' : 
                                 apt.visit_type === 'async' ? '📝 ASYNC' : '🏥 VISIT'}
                              </span>
                              {(() => {
                                const reason = getAppointmentReason(apt)
                                if (!reason) return null
                                const words = reason.trim().split(/\s+/)
                                const shortReason = words.slice(0, 2).join(' ')
                                return <div className="slot-reason">{shortReason}</div>
                              })()}
                            </div>
                          ) : (
                            <div className="slot available">
                              <div className="slot-title">✨ Available</div>
                              <div className="slot-time">{formatTime(time)}</div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  ])}
                </div>
                <div className="hint">💡 Click a slot to schedule or view appointment details</div>
              </>
            ) : calendarViewType === 'month' ? (
              /* Month View */
              <>
                <div className="month-grid">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="month-header">{day}</div>
                  ))}
                  
                  {Array.from({ length: visibleDates[0]?.getDay() || 0 }).map((_, i) => (
                    <div key={`empty-${i}`} className="month-cell empty"></div>
                  ))}
                  
                  {visibleDates.map((date, index) => {
                    const dayAppointments = appointments.filter(apt => {
                      if (!apt.requested_date_time) return false
                      const aptDate = convertToTimezone(apt.requested_date_time, DOCTOR_TIMEZONE)
                      const aptDateStr = getDateString(aptDate, DOCTOR_TIMEZONE)
                      const calendarDateStr = getDateString(convertToTimezone(date.toISOString(), DOCTOR_TIMEZONE), DOCTOR_TIMEZONE)
                      return aptDateStr === calendarDateStr
                    })
                    
                    return (
                      <div key={index} className="month-cell">
                        <div className="month-day">{date.getDate()}</div>
                        {dayAppointments.slice(0, 3).map((apt) => (
                          <div 
                            key={apt.id} 
                            className={`month-appointment ${apt.visit_type || 'video'}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedAppointmentId(apt.id)
                            }}
                            title={`${apt.patients?.first_name} ${apt.patients?.last_name} - ${getAppointmentActualTime(apt)}`}
                          >
                            {apt.patients?.first_name} {apt.patients?.last_name?.charAt(0)}. • {apt.visit_type === 'instant' ? '⚡' : apt.visit_type || 'Visit'}
                          </div>
                        ))}
                        {dayAppointments.length > 3 && (
                          <div className="month-more">+{dayAppointments.length - 3} more</div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="hint">💡 Click an appointment to view details</div>
              </>
            ) : (
              <div className="hint">3-Month view (to be implemented)</div>
            )}
          </div>
        ) : (
          /* List View */
          <div className="calendar-card">
            <div className="list-view">
              <table className="list-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Reason</th>
                    <th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.length > 0 ? (
                    appointments.map((apt) => {
                      const aptDate = apt.requested_date_time 
                        ? convertToTimezone(apt.requested_date_time, DOCTOR_TIMEZONE)
                        : null
                      
                      return (
                        <tr
                          key={apt.id}
                          onClick={() => setSelectedAppointmentId(apt.id)}
                        >
                          <td className="patient-name">
                            {apt.patients?.first_name || ''} {apt.patients?.last_name || ''}
                          </td>
                          <td className="date-time">
                            {aptDate ? (
                              <>
                                {aptDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                {' • '}
                                {aptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </>
                            ) : '—'}
                          </td>
                          <td>
                            <span className={`list-badge ${apt.visit_type || 'video'}`}>
                              {apt.visit_type === 'instant' ? '⚡ Instant' :
                               apt.visit_type === 'video' ? 'Video' :
                               apt.visit_type === 'phone' ? 'Phone' :
                               apt.visit_type === 'async' ? 'Async' : 'Visit'}
                            </span>
                          </td>
                          <td className="reason">{getAppointmentReason(apt) || '—'}</td>
                          <td className="contact">
                            <div>{apt.patients?.email || '—'}</div>
                            <div style={{ fontSize: '11px' }}>{apt.patients?.phone || ''}</div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="empty-state">No appointments found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="toolbar">
          <button 
            className={`btn ${calendarViewType === 'month' && viewType === 'calendar' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setViewType('calendar'); setCalendarViewType('month'); }}
          >
            📅 MONTH
          </button>
          <button 
            className={`btn ${calendarViewType === 'week' && viewType === 'calendar' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setViewType('calendar'); setCalendarViewType('week'); }}
          >
            📆 WEEK
          </button>
          <button 
            className={`btn ${viewType === 'list' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewType('list')}
          >
            📋 LIST
          </button>
          <button className="btn btn-ghost nav-arrow" onClick={() => navigateCalendar('prev')}>⬅️</button>
          <div className="date-pill">{dateRange.toolbar}</div>
          <button className="btn btn-ghost nav-arrow" onClick={() => navigateCalendar('next')}>➡️</button>
          <div className="toolbar-spacer"></div>
          <button className="btn btn-ghost" onClick={() => window.print()}>🖨️ PRINT</button>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value">{stats.completed}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-value">${stats.revenue}</div>
            <div className="stat-label">Revenue</div>
          </div>
        </div>

        {/* Legend */}
        <div className="legend">
          <div className="legend-item"><span className="legend-dot available"></span> ✅ Available</div>
          <div className="legend-item"><span className="legend-dot booked"></span> 🔴 Booked</div>
          <div className="legend-item"><span className="legend-dot video"></span> 📹 Video</div>
          <div className="legend-item"><span className="legend-dot async"></span> 📝 Async</div>
          <div className="legend-item"><span className="legend-dot phone"></span> 📞 Phone</div>
          <div className="legend-item"><span className="legend-dot instant"></span> ⚡ Instant</div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          <div>
            {notification.type === 'success' ? (
              <svg style={{ width: '20px', height: '20px', color: '#19d67f' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg style={{ width: '20px', height: '20px', color: '#E53935' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: '600' }}>{notification.message}</p>
          </div>
          <button
            className="notification-close"
            onClick={() => setNotification(null)}
          >
            <svg style={{ width: '16px', height: '16px' }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Appointment Detail Modal */}
      <AppointmentDetailModal 
        appointmentId={selectedAppointmentId}
        isOpen={!!selectedAppointmentId}
        appointments={appointments.map(apt => ({ ...apt, requested_date_time: apt.requested_date_time ?? null })) as any}
        currentDate={currentDate}
        onClose={() => setSelectedAppointmentId(null)}
        onStatusChange={() => {
          if (currentDoctorId) {
            fetchAppointments(currentDoctorId, true)
          }
        }}
        onAppointmentSwitch={(appointmentId) => {
          setSelectedAppointmentId(appointmentId)
        }}
        onFollowUp={(patientData, date, time) => {
          setFollowUpPatientData(patientData)
          setSelectedSlotDate(date)
          setSelectedSlotTime(time)
          setShowCreateDialog(true)
          setSelectedAppointmentId(null)
        }}
        onSmsSent={(message) => {
          setNotification({
            type: 'success',
            message: message
          })
          setTimeout(() => setNotification(null), 5000)
        }}
      />

      {/* Create Appointment Dialog */}
      {currentDoctorId && selectedSlotDate && selectedSlotTime && (
        <CreateAppointmentDialog
          isOpen={showCreateDialog}
          appointments={appointments.map(apt => ({ ...apt, requested_date_time: apt.requested_date_time ?? null })) as any}
          onClose={() => {
            setShowCreateDialog(false)
            setSelectedSlotDate(null)
            setSelectedSlotTime(null)
            setFollowUpPatientData(null)
          }}
          onSuccess={async () => {
            if (currentDoctorId) {
              await fetchAppointments(currentDoctorId)
            }
            setFollowUpPatientData(null)
          }}
          doctorId={currentDoctorId}
          selectedDate={selectedSlotDate}
          selectedTime={selectedSlotTime}
          patientData={followUpPatientData}
        />
      )}

      {/* Instant Visit Queue Modal */}
      {activeInstantVisit && (
        <InstantVisitQueueModal
          isOpen={isQueueModalOpen}
          patient={{
            id: activeInstantVisit.patient_id || '',
            appointmentId: activeInstantVisit.id,
            name: `${activeInstantVisit.patients?.first_name || ''} ${activeInstantVisit.patients?.last_name || ''}`.trim() || 'Unknown Patient',
            email: activeInstantVisit.patients?.email || '',
            phone: activeInstantVisit.patients?.phone || '',
            reason: getAppointmentReason(activeInstantVisit),
            visitType: (activeInstantVisit.visit_type === 'video' ? 'video' : 'phone') as 'video' | 'phone',
            position: instantVisitQueue.findIndex(apt => apt.id === activeInstantVisit.id) + 1,
            totalInQueue: instantVisitQueue.length,
            estimatedWait: (instantVisitQueue.findIndex(apt => apt.id === activeInstantVisit.id) + 1) * 5,
            paidAt: activeInstantVisit.created_at ? new Date(activeInstantVisit.created_at) : new Date()
          }}
          onClose={() => setIsQueueModalOpen(false)}
          onStartCall={handleStartCall}
          onComplete={handleCompleteInstantVisit}
          onCancel={handleCancelInstantVisit}
        />
      )}
    </>
  )
}












