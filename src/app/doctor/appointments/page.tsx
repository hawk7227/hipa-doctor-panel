'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { supabase, Appointment } from '@/lib/supabase'
import AppointmentDetailModal from '@/components/AppointmentDetailModal'
import CreateAppointmentDialog from '@/components/CreateAppointmentDialog'

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

type ViewType = 'calendar' | 'list'
type CalendarViewType = 'week' | 'month' | '3month'

// ============================================
// MAIN COMPONENT
// ============================================
// ============================================
// STYLES
// ============================================
const styles = `
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Inter', -apple-system, sans-serif;
  background: linear-gradient(-45deg, #0a0a1a, #1a0a2e, #0a1a2e, #0a0a1a);
  background-size: 400% 400%;
  color: #fff;
  min-height: 100vh;
  overflow-x: hidden;
}

@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.particles-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.particle {
  position: absolute;
  border-radius: 50%;
  animation: float 20s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0) translateX(0) scale(1); opacity: 0.6; }
  25% { transform: translateY(-30px) translateX(20px) scale(1.1); opacity: 0.8; }
  50% { transform: translateY(-10px) translateX(-20px) scale(0.9); opacity: 0.5; }
  75% { transform: translateY(-40px) translateX(10px) scale(1.05); opacity: 0.7; }
}

.confetti-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10000;
  overflow: hidden;
  display: none;
}

.confetti-container.active {
  display: block;
}

.confetti-piece {
  position: absolute;
  top: -20px;
  animation: confettiFall 3s ease-out forwards;
}

@keyframes confettiFall {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}

.header {
  background: linear-gradient(135deg, rgba(20, 184, 166, 0.2), rgba(236, 72, 153, 0.2), rgba(59, 130, 246, 0.2));
  backdrop-filter: blur(20px);
  border-bottom: 2px solid;
  border-image: linear-gradient(90deg, #14b8a6, #ec4899, #3b82f6) 1;
  padding: 16px 24px;
  position: sticky;
  top: 0;
  z-index: 100;
  animation: headerGlow 3s ease-in-out infinite alternate;
}

@keyframes headerGlow {
  0% { box-shadow: 0 0 20px rgba(20, 184, 166, 0.3); }
  50% { box-shadow: 0 0 40px rgba(236, 72, 153, 0.3); }
  100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-orb {
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #00f5ff, #ff00ff);
  border-radius: 50%;
  animation: orbPulse 2s ease-in-out infinite;
  box-shadow: 0 0 20px #00f5ff, 0 0 40px rgba(255, 0, 255, 0.5);
}

@keyframes orbPulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 20px #00f5ff, 0 0 40px rgba(255, 0, 255, 0.5); }
  50% { transform: scale(1.2); box-shadow: 0 0 30px #00f5ff, 0 0 60px rgba(255, 0, 255, 0.8); }
}

.logo-text {
  font-size: 20px;
  font-weight: 800;
  background: linear-gradient(90deg, #00f5ff, #ff00ff, #14b8a6);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.date-pill {
  background: linear-gradient(135deg, rgba(0, 245, 255, 0.2), rgba(255, 0, 255, 0.1));
  border: 1px solid rgba(0, 245, 255, 0.5);
  color: #00f5ff;
  text-shadow: 0 0 10px rgba(0, 245, 255, 0.5);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.date-pill:hover {
  background: linear-gradient(135deg, rgba(0, 245, 255, 0.4), rgba(255, 0, 255, 0.2));
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(0, 245, 255, 0.4);
}

.header-spacer { flex: 1; }

.back-btn {
  background: transparent;
  border: 1px solid rgba(0, 245, 255, 0.3);
  color: #00f5ff;
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.back-btn:hover {
  background: rgba(0, 245, 255, 0.15);
  border-color: #00f5ff;
  box-shadow: 0 0 20px rgba(0, 245, 255, 0.3);
  transform: translateY(-2px);
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  position: relative;
  z-index: 1;
}

.toolbar {
  background: rgba(15, 15, 35, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  transition: all 0.4s ease;
}

.toolbar:hover {
  border-color: rgba(20, 184, 166, 0.5);
  box-shadow: 0 10px 40px rgba(20, 184, 166, 0.2);
}

.btn {
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  position: relative;
  overflow: hidden;
}

.btn::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.btn:active::after {
  width: 300px;
  height: 300px;
}

.btn-primary {
  background: linear-gradient(135deg, #14b8a6, #0d9488);
  color: #000;
}

.btn-primary:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 10px 30px rgba(20, 184, 166, 0.5), 0 0 20px rgba(20, 184, 166, 0.3);
}

.btn-ghost {
  background: transparent;
  color: #00f5ff;
  border: 1px solid rgba(0, 245, 255, 0.3);
}

.btn-ghost:hover {
  background: rgba(0, 245, 255, 0.15);
  border-color: #00f5ff;
  box-shadow: 0 0 20px rgba(0, 245, 255, 0.3);
  transform: translateY(-2px);
}

.nav-arrow {
  font-size: 20px;
  min-width: 44px;
}

.nav-arrow:hover {
  transform: scale(1.3);
  text-shadow: 0 0 20px #00f5ff;
}

.toolbar-spacer { flex: 1; }

.legend {
  background: rgba(15, 15, 35, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #ccc;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  animation: dotPulse 2s ease-in-out infinite;
}

@keyframes dotPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.8; }
}

.legend-dot.available {
  background: linear-gradient(135deg, #00ff00, #00cc00);
  box-shadow: 0 0 15px #00ff00;
}

.legend-dot.booked {
  background: linear-gradient(135deg, #E53935, #C62828);
  box-shadow: 0 0 15px #E53935;
}

.legend-dot.video {
  background: linear-gradient(135deg, #00e6ff, #00b8d4);
  box-shadow: 0 0 15px #00e6ff;
}

.legend-dot.async {
  background: linear-gradient(135deg, #b07aff, #9c27b0);
  box-shadow: 0 0 15px #b07aff;
}

.legend-dot.phone {
  background: linear-gradient(135deg, #00c26e, #00a651);
  box-shadow: 0 0 15px #00c26e;
}

.calendar-card {
  background: rgba(15, 15, 35, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.4s ease;
  position: relative;
}

.calendar-card:hover {
  border-color: rgba(20, 184, 166, 0.5);
  box-shadow: 0 10px 40px rgba(20, 184, 166, 0.2);
}

.calendar-grid {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  overflow: auto;
  max-height: 600px;
}

.calendar-header-cell {
  background: linear-gradient(180deg, rgba(20, 184, 166, 0.2), transparent);
  padding: 16px 8px;
  text-align: center;
  font-weight: 700;
  font-size: 13px;
  color: #00f5ff;
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 2px solid rgba(0, 245, 255, 0.3);
  position: sticky;
  top: 0;
  z-index: 10;
}

.calendar-header-cell:first-child {
  background: linear-gradient(135deg, rgba(20, 184, 166, 0.3), rgba(0, 0, 0, 0.5));
}

.time-cell {
  padding: 12px 8px;
  text-align: right;
  font-weight: 600;
  font-size: 12px;
  color: #ec4899;
  text-shadow: 0 0 10px rgba(236, 72, 153, 0.3);
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.calendar-cell {
  padding: 8px;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  min-height: 80px;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
}

.calendar-cell:hover {
  background: rgba(20, 184, 166, 0.1);
  transform: scale(1.02);
}

.slot {
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 12px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.slot::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transform: rotate(45deg);
  animation: shimmer 3s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%) rotate(45deg); }
  100% { transform: translateX(100%) rotate(45deg); }
}

.slot.available {
  background: linear-gradient(135deg, rgba(0, 255, 0, 0.2), rgba(20, 184, 166, 0.3));
  border: 1px solid rgba(0, 255, 0, 0.4);
  animation: availablePulse 3s ease-in-out infinite;
}

@keyframes availablePulse {
  0%, 100% { box-shadow: 0 0 10px rgba(0, 255, 0, 0.3); }
  50% { box-shadow: 0 0 25px rgba(0, 255, 0, 0.5), 0 0 50px rgba(20, 184, 166, 0.3); }
}

.slot.available:hover {
  transform: scale(1.05);
  box-shadow: 0 0 30px rgba(0, 255, 0, 0.5);
}

.slot.booked {
  position: relative;
  z-index: 1;
  cursor: pointer;
}

.slot.booked:hover {
  transform: scale(1.05);
  z-index: 100;
}

.slot-hover-popup {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-5px);
  background: linear-gradient(135deg, rgba(15, 15, 35, 0.98), rgba(25, 25, 50, 0.98));
  border: 2px solid rgba(0, 245, 255, 0.5);
  border-radius: 16px;
  padding: 16px 20px;
  min-width: 280px;
  max-width: 320px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 245, 255, 0.2);
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  pointer-events: none;
  z-index: 1000;
}

.slot.booked:hover .slot-hover-popup {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(-10px);
}

.slot-hover-popup::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 10px solid transparent;
  border-top-color: rgba(0, 245, 255, 0.5);
}

.popup-header {
  font-size: 16px;
  font-weight: 700;
  color: #00f5ff;
  margin-bottom: 12px;
  text-shadow: 0 0 10px rgba(0, 245, 255, 0.5);
}

.popup-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #ccc;
}

.popup-reason {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
  color: #888;
}

.popup-reason strong {
  color: #ff00ff;
}

.popup-hint {
  margin-top: 10px;
  font-size: 11px;
  color: #14b8a6;
  text-align: center;
  opacity: 0.8;
}

.slot.video {
  background: linear-gradient(135deg, rgba(0, 230, 255, 0.25), rgba(0, 180, 255, 0.15));
  border: 1px solid rgba(0, 230, 255, 0.5);
  box-shadow: 0 0 20px rgba(0, 230, 255, 0.2);
}

.slot.phone {
  background: linear-gradient(135deg, rgba(0, 194, 110, 0.25), rgba(0, 150, 80, 0.15));
  border: 1px solid rgba(0, 194, 110, 0.5);
  box-shadow: 0 0 20px rgba(0, 194, 110, 0.2);
}

.slot.async {
  background: linear-gradient(135deg, rgba(176, 122, 255, 0.25), rgba(140, 90, 220, 0.15));
  border: 1px solid rgba(176, 122, 255, 0.5);
  box-shadow: 0 0 20px rgba(176, 122, 255, 0.2);
}

.slot-title {
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 4px;
  color: #fff;
}

.slot-time {
  font-size: 11px;
  opacity: 0.8;
}

.slot-patient {
  font-weight: 700;
  font-size: 12px;
  color: #fff;
  margin-bottom: 4px;
}

.slot-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  animation: badgeGlow 2s ease-in-out infinite alternate;
}

@keyframes badgeGlow {
  0% { filter: brightness(1); }
  100% { filter: brightness(1.3); }
}

.slot-badge.video {
  background: rgba(0, 230, 255, 0.3);
  color: #00f5ff;
  text-shadow: 0 0 10px #00f5ff;
}

.slot-badge.phone {
  background: rgba(0, 194, 110, 0.3);
  color: #00ff88;
  text-shadow: 0 0 10px #00ff88;
}

.slot-badge.async {
  background: rgba(176, 122, 255, 0.3);
  color: #d4a5ff;
  text-shadow: 0 0 10px #d4a5ff;
}

.slot-reason {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 4px;
}

.hint {
  padding: 16px 20px;
  text-align: center;
  color: rgba(20, 184, 166, 0.8);
  font-size: 14px;
  text-shadow: 0 0 10px rgba(20, 184, 166, 0.3);
  animation: hintPulse 3s ease-in-out infinite;
}

@keyframes hintPulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  max-width: 450px;
  border-radius: 16px;
  padding: 20px;
  z-index: 9999;
  animation: notificationSlideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1), notificationGlow 2s ease-in-out infinite;
  backdrop-filter: blur(20px);
  display: none;
}

.notification.active {
  display: flex;
}

.notification.success {
  background: linear-gradient(135deg, rgba(0, 50, 30, 0.95), rgba(0, 80, 50, 0.9));
  border: 2px solid rgba(0, 255, 136, 0.5);
  box-shadow: 0 0 30px rgba(0, 255, 136, 0.4), 0 20px 60px rgba(0, 0, 0, 0.3);
  color: #00ff88;
}

.notification.error {
  background: linear-gradient(135deg, rgba(50, 20, 25, 0.95), rgba(80, 30, 35, 0.9));
  border: 2px solid rgba(255, 68, 68, 0.5);
  box-shadow: 0 0 30px rgba(255, 68, 68, 0.4), 0 20px 60px rgba(0, 0, 0, 0.3);
  color: #ff6b6b;
}

@keyframes notificationSlideIn {
  0% { transform: translateX(100%) scale(0.8); opacity: 0; }
  100% { transform: translateX(0) scale(1); opacity: 1; }
}

@keyframes notificationGlow {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.1); }
}

.notification-content {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.notification-icon {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  animation: iconPulse 1s ease-in-out infinite;
  flex-shrink: 0;
}

.notification.success .notification-icon {
  background: linear-gradient(135deg, #00ff88, #00cc66);
  box-shadow: 0 0 20px #00ff88;
}

.notification.error .notification-icon {
  background: linear-gradient(135deg, #ff6b6b, #ff4444);
  box-shadow: 0 0 20px #ff6b6b;
}

@keyframes iconPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.notification-text {
  flex: 1;
}

.notification-title {
  font-size: 16px;
  font-weight: 700;
  text-shadow: 0 0 10px currentColor;
  margin-bottom: 4px;
}

.notification-message {
  font-size: 14px;
  opacity: 0.9;
}

.notification-close {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  padding: 8px;
  color: inherit;
  transition: all 0.2s ease;
  font-size: 18px;
}

.notification-close:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.stats-wrapper {
  position: relative;
  margin-bottom: 20px;
  border-radius: 20px;
  overflow: hidden;
}

.stats-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  background: rgba(15, 15, 35, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 20px;
  text-align: center;
  transition: all 0.4s ease;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent);
  transition: left 0.5s ease;
}

.stat-card:hover::before {
  left: 100%;
}

.stat-card:hover {
  transform: translateY(-5px);
  border-color: rgba(20, 184, 166, 0.5);
  box-shadow: 0 15px 40px rgba(20, 184, 166, 0.3);
}

.stat-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 36px;
  font-weight: 900;
  background: linear-gradient(135deg, #00f5ff, #ff00ff);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
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
  width: 64px;
  height: 64px;
  border: 4px solid transparent;
  border-top: 4px solid #00f5ff;
  border-right: 4px solid #ff00ff;
  border-bottom: 4px solid #14b8a6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  box-shadow: 0 0 30px rgba(0, 245, 255, 0.5), inset 0 0 30px rgba(255, 0, 255, 0.3);
}

@keyframes spin {
  0% { transform: rotate(0deg); filter: drop-shadow(0 0 10px #14b8a6); }
  50% { filter: drop-shadow(0 0 25px #ec4899); }
  100% { transform: rotate(360deg); filter: drop-shadow(0 0 10px #14b8a6); }
}

.loading-text {
  margin-top: 20px;
  color: #00f5ff;
  font-size: 18px;
  font-weight: 600;
  text-shadow: 0 0 20px rgba(0, 245, 255, 0.5);
  animation: hintPulse 2s ease-in-out infinite;
}

/* Month View */
.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: rgba(255, 255, 255, 0.05);
}

.month-header {
  background: linear-gradient(180deg, rgba(20, 184, 166, 0.2), transparent);
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
  transition: all 0.3s ease;
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
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 6px;
  margin-bottom: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.month-appointment:hover {
  transform: scale(1.05);
}

.month-appointment.video {
  background: rgba(0, 230, 255, 0.2);
  color: #00f5ff;
  border: 1px solid rgba(0, 230, 255, 0.3);
}

.month-appointment.phone {
  background: rgba(0, 194, 110, 0.2);
  color: #00ff88;
  border: 1px solid rgba(0, 194, 110, 0.3);
}

.month-appointment.async {
  background: rgba(176, 122, 255, 0.2);
  color: #d4a5ff;
  border: 1px solid rgba(176, 122, 255, 0.3);
}

.month-more {
  font-size: 10px;
  color: #888;
  padding: 2px 8px;
}

/* List View */
.list-view {
  overflow: auto;
  max-height: 600px;
}

.list-table {
  width: 100%;
  border-collapse: collapse;
}

.list-table th {
  padding: 12px 16px;
  text-align: left;
  background: linear-gradient(180deg, rgba(20, 184, 166, 0.2), transparent);
  color: #00f5ff;
  font-size: 12px;
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
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.list-badge.video {
  background: rgba(0, 230, 255, 0.15);
  color: #00f5ff;
}

.list-badge.phone {
  background: rgba(0, 194, 110, 0.15);
  color: #00ff88;
}

.list-badge.async {
  background: rgba(176, 122, 255, 0.15);
  color: #d4a5ff;
}

.list-table .reason {
  color: #888;
  font-size: 13px;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-table .contact {
  color: #888;
  font-size: 13px;
}

.list-table .contact .phone {
  font-size: 11px;
  opacity: 0.7;
}

.list-table .empty-state {
  text-align: center;
  color: #888;
  padding: 40px;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .calendar-grid {
    font-size: 11px;
  }
  
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #14b8a6, #ec4899);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #0d9488, #db2777);
}
`


export default function DoctorAppointments() {
  // State
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', title: string, message: string } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
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

  const audioContextRef = useRef<AudioContext | null>(null)
  const particlesRef = useRef<HTMLDivElement | null>(null)

  // Provider timezone is ALWAYS America/Phoenix
  const DOCTOR_TIMEZONE = 'America/Phoenix'

  // ============================================
  // TIME SLOTS
  // ============================================
  const timeSlots = useMemo(() => {
    const slots: Date[] = []
    for (let hour = 5; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = new Date()
        time.setHours(hour, minute, 0, 0)
        slots.push(time)
      }
    }
    return slots
  }, [])

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  // ============================================
  // CALENDAR UTILITIES
  // ============================================
  const getWeekDates = (date: Date) => {
    const start = new Date(date)
    const day = start.getDay()
    const diff = start.getDate() - day + (day === 0 ? -6 : 1)
    start.setDate(diff)
    
    const dates: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      dates.push(d)
    }
    return dates
  }

  const getMonthDates = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const lastDay = new Date(year, month + 1, 0)
    
    const dates: Date[] = []
    for (let day = 1; day <= lastDay.getDate(); day++) {
      dates.push(new Date(year, month, day))
    }
    return dates
  }

  const visibleDates = useMemo(() => {
    return calendarViewType === 'week' ? getWeekDates(currentDate) : getMonthDates(currentDate)
  }, [currentDate, calendarViewType])

  const navigateCalendar = (direction: 'prev' | 'next') => {
    playSound('whoosh')
    const newDate = new Date(currentDate)
    if (calendarViewType === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  // ============================================
  // APPOINTMENT HELPERS
  // ============================================
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
    
    const phoenixYear = dateInPhoenix.getUTCFullYear()
    const phoenixMonth = dateInPhoenix.getUTCMonth()
    const phoenixDay = dateInPhoenix.getUTCDate()
    const phoenixHour = time.getHours()
    const phoenixMinute = time.getMinutes()
    
    const timeSlotAsPhoenix = new Date(Date.UTC(phoenixYear, phoenixMonth, phoenixDay, phoenixHour, phoenixMinute, 0))
    const hour = timeSlotAsPhoenix.getUTCHours()
    const minute = timeSlotAsPhoenix.getUTCMinutes()
    
    const key = `${slotDateStr}_${hour}_${minute}`
    return appointmentMap.get(key) || null
  }, [appointmentMap])

  // ============================================
  // AUDIO SYSTEM
  // ============================================
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioContextRef.current
  }

  const playSound = (type: string) => {
    try {
      const ctx = getAudioContext()
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      switch (type) {
        case 'success':
          oscillator.frequency.setValueAtTime(523.25, ctx.currentTime)
          oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1)
          oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2)
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
          oscillator.start(ctx.currentTime)
          oscillator.stop(ctx.currentTime + 0.4)
          break
          
        case 'error':
          oscillator.type = 'sawtooth'
          oscillator.frequency.setValueAtTime(400, ctx.currentTime)
          oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3)
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
          oscillator.start(ctx.currentTime)
          oscillator.stop(ctx.currentTime + 0.3)
          break
          
        case 'click':
          oscillator.frequency.setValueAtTime(800, ctx.currentTime)
          gainNode.gain.setValueAtTime(0.15, ctx.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05)
          oscillator.start(ctx.currentTime)
          oscillator.stop(ctx.currentTime + 0.05)
          break
          
        case 'notification':
          oscillator.type = 'sine'
          oscillator.frequency.setValueAtTime(880, ctx.currentTime)
          oscillator.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.15)
          gainNode.gain.setValueAtTime(0.25, ctx.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
          oscillator.start(ctx.currentTime)
          oscillator.stop(ctx.currentTime + 0.5)
          break
          
        case 'hover':
          oscillator.frequency.setValueAtTime(1200, ctx.currentTime)
          gainNode.gain.setValueAtTime(0.03, ctx.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.02)
          oscillator.start(ctx.currentTime)
          oscillator.stop(ctx.currentTime + 0.02)
          break
          
        case 'whoosh':
          const noise = ctx.createOscillator()
          noise.type = 'sawtooth'
          noise.frequency.setValueAtTime(100, ctx.currentTime)
          noise.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.15)
          const noiseGain = ctx.createGain()
          noise.connect(noiseGain)
          noiseGain.connect(ctx.destination)
          noiseGain.gain.setValueAtTime(0.1, ctx.currentTime)
          noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
          noise.start(ctx.currentTime)
          noise.stop(ctx.currentTime + 0.15)
          break
      }
    } catch (e) {
      console.log('Audio not supported')
    }
  }

  // ============================================
  // NOTIFICATION SYSTEM
  // ============================================
  const showNotification = (type: 'success' | 'error', title: string, message: string) => {
    setNotification({ type, title, message })
    playSound(type === 'success' ? 'notification' : 'error')
    
    if (type === 'success') {
      triggerConfetti()
    }
    
    setTimeout(() => setNotification(null), 5000)
  }

  const triggerConfetti = () => {
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 4000)
  }

  // ============================================
  // PARTICLES
  // ============================================
  const createParticles = () => {
    if (!particlesRef.current) return
    const container = particlesRef.current
    container.innerHTML = ''
    
    const colors = [
      'rgba(0,245,255,0.15)',
      'rgba(255,0,255,0.1)',
      'rgba(20,184,166,0.15)',
      'rgba(236,72,153,0.1)'
    ]
    
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div')
      particle.className = 'particle'
      particle.style.left = Math.random() * 100 + '%'
      particle.style.top = Math.random() * 100 + '%'
      const size = 20 + Math.random() * 60
      particle.style.width = size + 'px'
      particle.style.height = size + 'px'
      particle.style.background = `radial-gradient(circle, ${colors[Math.floor(Math.random() * colors.length)]}, transparent)`
      particle.style.animationDuration = (10 + Math.random() * 20) + 's'
      particle.style.animationDelay = (Math.random() * 10) + 's'
      container.appendChild(particle)
    }
  }

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
        fetchAppointments(doctor.id)
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
      
      // Show welcome notification on first load
      if (!skipLoading && data && data.length >= 0) {
        setTimeout(() => {
          const todayAppointments = (data || []).filter((apt: any) => {
            if (!apt.requested_date_time) return false
            const aptDate = new Date(apt.requested_date_time)
            const today = new Date()
            return aptDate.toDateString() === today.toDateString()
          }).length
          showNotification('success', '👋 WELCOME!', `Your appointment calendar is ready. You have ${todayAppointments} appointments today!`)
        }, 500)
      }
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      if (!skipLoading) {
        setLoading(false)
      }
    }
  }, [])

  // ============================================
  // APPOINTMENT ACTIONS
  // ============================================
  const handleAppointmentAction = async (appointmentId: string, action: 'accept' | 'reject' | 'complete') => {
    try {
      playSound('click')
      
      if (action === 'complete') {
        const { error } = await supabase
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', appointmentId)

        if (error) {
          showNotification('error', '❌ ERROR', 'Failed to mark appointment as complete')
          return
        }

        showNotification('success', '🎉 COMPLETED!', 'Appointment marked as complete')
        if (currentDoctorId) fetchAppointments(currentDoctorId)
        return
      }

      const endpoint = action === 'accept' ? '/api/appointments/accept' : '/api/appointments/reject'
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          reason: action === 'reject' ? 'Doctor unavailable at this time' : undefined
        })
      })

      const result = await response.json()

      if (!response.ok) {
        showNotification('error', '❌ ERROR', result.error || `Failed to ${action} appointment`)
        return
      }

      let successMessage = `Appointment ${action}ed successfully`
      
      if (action === 'accept') {
        if (result.data.paymentCaptured) successMessage += ' • Payment captured'
        if (result.data.zoomMeeting) successMessage += ' • Zoom meeting created'
      } else if (action === 'reject') {
        if (result.data.paymentRefunded) {
          successMessage += ` • Payment refunded ($${(result.data.refundAmount / 100).toFixed(2)})`
        }
      }

      showNotification('success', action === 'accept' ? '✨ ACCEPTED!' : '❌ REJECTED', successMessage)
      if (currentDoctorId) fetchAppointments(currentDoctorId)
    } catch (error) {
      console.error('Error updating appointment:', error)
      showNotification('error', '❌ ERROR', 'An unexpected error occurred')
    }
  }

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    fetchCurrentDoctor()
    createParticles()
  }, [])

  // ============================================
  // COMPUTED VALUES
  // ============================================
  const dateRange = useMemo(() => {
    if (visibleDates.length === 0) return { toolbar: '', header: '' }
    
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    const optionsYear: Intl.DateTimeFormatOptions = { ...options, year: 'numeric' }
    
    if (calendarViewType === 'week') {
      return {
        toolbar: `Week of ${visibleDates[0].toLocaleDateString('en-US', options)}`,
        header: `${visibleDates[0].toLocaleDateString('en-US', options)} - ${visibleDates[visibleDates.length - 1].toLocaleDateString('en-US', optionsYear)}`
      }
    } else {
      return {
        toolbar: currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        header: currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      }
    }
  }, [visibleDates, calendarViewType, currentDate])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const confettiColors = ['#00f5ff', '#ff00ff', '#ffff00', '#00ff00', '#ff6b35', '#14b8a6', '#ec4899']

  // Stats
  const stats = useMemo(() => {
    const total = appointments.length
    const completed = appointments.filter(a => a.status === 'completed').length
    const pending = appointments.filter(a => a.status === 'accepted').length
    const revenue = appointments.filter(a => a.status === 'completed').length * 59 // $59 per appointment
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

      {/* Floating Particles Background */}
      <div className="particles-container" ref={particlesRef}></div>
      
      {/* Confetti Container */}
      <div className={`confetti-container ${showConfetti ? 'active' : ''}`}>
        {showConfetti && Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="confetti-piece"
            style={{
              left: `${Math.random() * 100}%`,
              width: `${8 + Math.random() * 8}px`,
              height: `${8 + Math.random() * 8}px`,
              background: confettiColors[Math.floor(Math.random() * confettiColors.length)],
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              animationDelay: `${Math.random() * 0.5}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
              boxShadow: `0 0 10px ${confettiColors[Math.floor(Math.random() * confettiColors.length)]}`
            }}
          />
        ))}
      </div>

      {/* Notification */}
      {notification && (
        <div className={`notification active ${notification.type}`}>
          <div className="notification-content">
            <div className="notification-icon">{notification.type === 'success' ? '✓' : '✗'}</div>
            <div className="notification-text">
              <div className="notification-title">{notification.title}</div>
              <div className="notification-message">{notification.message}</div>
            </div>
            <button className="notification-close" onClick={() => setNotification(null)}>×</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <div className="logo-orb"></div>
            <span className="logo-text">Doctor Appointments Calendar</span>
          </div>
          <div className="date-pill">{dateRange.header}</div>
          <div className="header-spacer"></div>
          <a href="/doctor/dashboard" className="back-btn" onClick={() => playSound('click')}>← Back to Dashboard</a>
        </div>
      </header>

      {/* Main Container */}
      <div className="container">
        {/* Stats Cards */}
        <div className="stats-wrapper">
          <div className="stats-grid">
            <div className="stat-card" onMouseEnter={() => playSound('hover')}>
              <div className="stat-icon">📅</div>
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">THIS WEEK</div>
            </div>
            <div className="stat-card" onMouseEnter={() => playSound('hover')}>
              <div className="stat-icon">✅</div>
              <div className="stat-value">{stats.completed}</div>
              <div className="stat-label">COMPLETED</div>
            </div>
            <div className="stat-card" onMouseEnter={() => playSound('hover')}>
              <div className="stat-icon">⏳</div>
              <div className="stat-value">{stats.pending}</div>
              <div className="stat-label">PENDING</div>
            </div>
            <div className="stat-card" onMouseEnter={() => playSound('hover')}>
              <div className="stat-icon">💰</div>
              <div className="stat-value">${stats.revenue}</div>
              <div className="stat-label">REVENUE</div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <button 
            className={`btn ${calendarViewType === 'month' && viewType === 'calendar' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => { playSound('click'); setViewType('calendar'); setCalendarViewType('month'); }} 
            onMouseEnter={() => playSound('hover')}
          >
            📅 MONTH
          </button>
          <button 
            className={`btn ${calendarViewType === 'week' && viewType === 'calendar' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => { playSound('click'); setViewType('calendar'); setCalendarViewType('week'); }} 
            onMouseEnter={() => playSound('hover')}
          >
            📆 WEEK
          </button>
          <button 
            className={`btn ${viewType === 'list' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => { playSound('click'); setViewType('list'); }} 
            onMouseEnter={() => playSound('hover')}
          >
            📋 LIST
          </button>
          <button className="btn btn-ghost nav-arrow" onClick={() => navigateCalendar('prev')} onMouseEnter={() => playSound('hover')}>⬅️</button>
          <div className="date-pill">{dateRange.toolbar}</div>
          <button className="btn btn-ghost nav-arrow" onClick={() => navigateCalendar('next')} onMouseEnter={() => playSound('hover')}>➡️</button>
          <div className="toolbar-spacer"></div>
          <button className="btn btn-ghost" onClick={() => { playSound('click'); window.print(); }} onMouseEnter={() => playSound('hover')}>🖨️ PRINT</button>
        </div>

        {/* Legend */}
        <div className="legend">
          <div className="legend-item"><span className="legend-dot available"></span> ✅ Available</div>
          <div className="legend-item"><span className="legend-dot booked"></span> 🔴 Booked</div>
          <div className="legend-item"><span className="legend-dot video"></span> 📹 Video</div>
          <div className="legend-item"><span className="legend-dot async"></span> 📝 Async</div>
          <div className="legend-item"><span className="legend-dot phone"></span> 📞 Phone</div>
        </div>

        {/* Calendar / List View */}
        {viewType === 'calendar' ? (
          <div className="calendar-card">
            {calendarViewType === 'week' ? (
              <>
                <div className="calendar-grid">
                  {/* Header Row */}
                  <div className="calendar-header-cell">⏰ TIME</div>
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
                          onMouseEnter={() => playSound('hover')}
                          onClick={() => {
                            if (isAvailable) {
                              playSound('click')
                              setSelectedSlotDate(date)
                              setSelectedSlotTime(time)
                              setShowCreateDialog(true)
                            } else {
                              playSound('click')
                              setSelectedAppointmentId(apt.id)
                            }
                          }}
                        >
                          {apt ? (
                            <div className={`slot booked ${apt.visit_type || 'video'}`}>
                              <div className="slot-patient">{apt.patients?.first_name} {apt.patients?.last_name}</div>
                              <span className={`slot-badge ${apt.visit_type || 'video'}`}>
                                {apt.visit_type === 'video' ? '📹 VIDEO' : apt.visit_type === 'phone' ? '📞 PHONE' : apt.visit_type === 'async' ? '📝 ASYNC' : '🏥 VISIT'}
                              </span>
                              <div className="slot-reason">
                                {(() => {
                                  const reason = getAppointmentReason(apt)
                                  if (!reason) return null
                                  const words = reason.trim().split(/\s+/)
                                  return words.slice(0, 2).join(' ')
                                })()}
                              </div>
                              
                              {/* Hover Popup */}
                              <div className="slot-hover-popup">
                                <div className="popup-header">📋 {apt.patients?.first_name} {apt.patients?.last_name}</div>
                                <div className="popup-detail">
                                  <span>🏥</span>
                                  <span>{(apt.visit_type || 'video').charAt(0).toUpperCase() + (apt.visit_type || 'video').slice(1)} Visit</span>
                                </div>
                                <div className="popup-detail">
                                  <span>📅</span>
                                  <span>{date.toLocaleDateString('en-US', { weekday: 'long' })} at {formatTime(time)}</span>
                                </div>
                                <div className="popup-detail">
                                  <span>📧</span>
                                  <span>{apt.patients?.email || 'No email'}</span>
                                </div>
                                <div className="popup-detail">
                                  <span>📱</span>
                                  <span>{apt.patients?.phone || 'No phone'}</span>
                                </div>
                                <div className="popup-reason">
                                  <strong>Reason:</strong> {getAppointmentReason(apt) || 'Not specified'}
                                </div>
                                <div className="popup-hint">🖱️ Click to open appointment details</div>
                              </div>
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
                <div className="hint">💡 Tip: Click a slot to schedule or view appointment details.</div>
              </>
            ) : (
              /* Month View */
              <>
                <div className="month-grid">
                  {/* Day headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="month-header">{day}</div>
                  ))}
                  
                  {/* Empty cells for days before first of month */}
                  {Array.from({ length: visibleDates[0]?.getDay() || 0 }).map((_, i) => (
                    <div key={`empty-${i}`} className="month-cell empty"></div>
                  ))}
                  
                  {/* Day cells */}
                  {visibleDates.map((date, index) => {
                    const dayAppointments = appointments.filter(apt => {
                      if (!apt.requested_date_time) return false
                      const aptDate = convertToTimezone(apt.requested_date_time, DOCTOR_TIMEZONE)
                      const aptDateStr = getDateString(aptDate, DOCTOR_TIMEZONE)
                      const calendarDateStr = getDateString(convertToTimezone(date.toISOString(), DOCTOR_TIMEZONE), DOCTOR_TIMEZONE)
                      return aptDateStr === calendarDateStr
                    })
                    
                    return (
                      <div key={index} className="month-cell" onMouseEnter={() => playSound('hover')}>
                        <div className="month-day">{date.getDate()}</div>
                        {dayAppointments.slice(0, 3).map((apt) => (
                          <div 
                            key={apt.id} 
                            className={`month-appointment ${apt.visit_type || 'video'}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              playSound('click')
                              setSelectedAppointmentId(apt.id)
                            }}
                          >
                            {apt.patients?.first_name} {apt.patients?.last_name?.charAt(0)}.
                          </div>
                        ))}
                        {dayAppointments.length > 3 && (
                          <div className="month-more">+{dayAppointments.length - 3} more</div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="hint">💡 Tip: Click an appointment to view details.</div>
              </>
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
                          onClick={() => { playSound('click'); setSelectedAppointmentId(apt.id); }}
                          onMouseEnter={() => playSound('hover')}
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
                              {apt.visit_type === 'video' ? 'Video' :
                               apt.visit_type === 'phone' ? 'Phone' :
                               apt.visit_type === 'async' ? 'Async' : 'Visit'}
                            </span>
                          </td>
                          <td className="reason">{getAppointmentReason(apt) || '—'}</td>
                          <td className="contact">
                            <div>{apt.patients?.email || '—'}</div>
                            <div className="phone">{apt.patients?.phone || ''}</div>
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
      </div>

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
          showNotification('success', '📱 SMS SENT', message)
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
          onSuccess={() => {
            if (currentDoctorId) {
              fetchAppointments(currentDoctorId)
            }
            setFollowUpPatientData(null)
            showNotification('success', '✨ BOOKED!', 'New appointment created successfully')
          }}
          doctorId={currentDoctorId}
          selectedDate={selectedSlotDate}
          selectedTime={selectedSlotTime}
          patientData={followUpPatientData}
        />
      )}
    </>
  )
}
