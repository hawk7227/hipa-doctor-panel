import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { supabase, Appointment } from '@/lib/supabase'
import { sendAppointmentStatusEmail } from '@/lib/email'
import AppointmentDetailModal from '@/components/AppointmentDetailModal'
import CreateAppointmentDialog from '@/components/CreateAppointmentDialog'
import InstantVisitQueueModal from '@/components/InstantVisitQueueModal'

// ============================================
// TIMEZONE UTILITIES
@@ -49,6 +51,37 @@ function getDateString(date: Date, timezone?: string): string {
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
@@ -77,12 +110,17 @@ interface CalendarAppointment extends Omit<Appointment, 'patients' | 'requested_
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
// MAIN COMPONENT
// ============================================
// ============================================
// STYLES
// ============================================
@@ -93,7 +131,7 @@ aside, [class*="sidebar"], [class*="Sidebar"], nav:not(.header *) {
}

/* Make main content full width */
main, [class*="main"], .container {
main, [class*="main"] {
  margin-left: 0 !important;
  padding-left: 0 !important;
  width: 100% !important;
@@ -111,313 +149,173 @@ body {
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
  background: linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(236, 72, 153, 0.1), rgba(59, 130, 246, 0.1));
  backdrop-filter: blur(20px);
  border-bottom: 2px solid;
  border-image: linear-gradient(90deg, #14b8a6, #ec4899, #3b82f6) 1;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px 24px;
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
  max-width: 1600px;
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
  gap: 16px;
}

.logo-text {
  font-size: 20px;
  font-size: 22px;
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
  color: #fff;
  white-space: nowrap;
}

.date-pill:hover {
  background: linear-gradient(135deg, rgba(0, 245, 255, 0.4), rgba(255, 0, 255, 0.2));
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(0, 245, 255, 0.4);
.view-tabs {
  display: flex;
  gap: 4px;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px;
  border-radius: 10px;
}

.header-spacer { flex: 1; }

.back-btn {
  background: transparent;
  border: 1px solid rgba(0, 245, 255, 0.3);
  color: #00f5ff;
  padding: 10px 20px;
  border-radius: 12px;
.view-tab {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  color: #888;
  transition: all 0.2s ease;
}

.back-btn:hover {
  background: rgba(0, 245, 255, 0.15);
  border-color: #00f5ff;
  box-shadow: 0 0 20px rgba(0, 245, 255, 0.3);
  transform: translateY(-2px);
.view-tab:hover {
  color: #fff;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
.view-tab.active {
  background: linear-gradient(135deg, #14b8a6, #0d9488);
  color: #000;
}

.search-container {
  position: relative;
  z-index: 1;
  flex: 1;
  max-width: 400px;
}

.toolbar {
  background: rgba(15, 15, 35, 0.7);
  backdrop-filter: blur(20px);
.search-input {
  width: 100%;
  padding: 10px 16px 10px 40px;
  border-radius: 25px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  transition: all 0.4s ease;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
}

.toolbar:hover {
  border-color: rgba(20, 184, 166, 0.5);
  box-shadow: 0 10px 40px rgba(20, 184, 166, 0.2);
.search-input::placeholder {
  color: #666;
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
.search-input:focus {
  border-color: rgba(20, 184, 166, 0.5);
  box-shadow: 0 0 20px rgba(20, 184, 166, 0.2);
}

.btn::after {
  content: '';
.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
  transform: translateY(-50%);
  color: #666;
  font-size: 14px;
}

.btn:active::after {
  width: 300px;
  height: 300px;
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

.btn-primary {
  background: linear-gradient(135deg, #14b8a6, #0d9488);
  color: #000;
.search-result-item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 10px 30px rgba(20, 184, 166, 0.5), 0 0 20px rgba(20, 184, 166, 0.3);
.search-result-item:hover {
  background: rgba(20, 184, 166, 0.1);
}

.btn-ghost {
  background: transparent;
  color: #00f5ff;
  border: 1px solid rgba(0, 245, 255, 0.3);
.search-result-item:last-child {
  border-bottom: none;
}

.btn-ghost:hover {
  background: rgba(0, 245, 255, 0.15);
  border-color: #00f5ff;
  box-shadow: 0 0 20px rgba(0, 245, 255, 0.3);
  transform: translateY(-2px);
.search-result-name {
  font-weight: 600;
  color: #fff;
  margin-bottom: 2px;
}

.nav-arrow {
  font-size: 20px;
  min-width: 44px;
.search-result-email {
  font-size: 12px;
  color: #888;
}

.nav-arrow:hover {
  transform: scale(1.3);
  text-shadow: 0 0 20px #00f5ff;
.search-no-results {
  padding: 16px;
  text-align: center;
  color: #666;
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
.header-spacer { flex: 1; }

.legend-item {
  display: flex;
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
  white-space: nowrap;
}

.legend-dot.async {
  background: linear-gradient(135deg, #b07aff, #9c27b0);
  box-shadow: 0 0 15px #b07aff;
.back-btn:hover {
  background: rgba(20, 184, 166, 0.15);
  box-shadow: 0 0 20px rgba(20, 184, 166, 0.3);
}

.legend-dot.phone {
  background: linear-gradient(135deg, #00c26e, #00a651);
  box-shadow: 0 0 15px #00c26e;
.container {
  max-width: 1600px;
  margin: 0 auto;
  padding: 20px 24px;
  position: relative;
  z-index: 1;
}

.calendar-card {
@@ -426,39 +324,34 @@ body {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.4s ease;
  position: relative;
}

.calendar-card:hover {
  border-color: rgba(20, 184, 166, 0.5);
  box-shadow: 0 10px 40px rgba(20, 184, 166, 0.2);
  margin-bottom: 20px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  overflow: auto;
  max-height: 600px;
  max-height: calc(100vh - 380px);
  min-height: 400px;
}

.calendar-header-cell {
  background: linear-gradient(180deg, rgba(20, 184, 166, 0.2), transparent);
  padding: 16px 8px;
  background: rgba(15, 15, 35, 0.9);
  padding: 14px 8px;
  text-align: center;
  font-weight: 700;
  font-size: 13px;
  color: #00f5ff;
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 2px solid rgba(0, 245, 255, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 10;
}

.calendar-header-cell:first-child {
  background: linear-gradient(135deg, rgba(20, 184, 166, 0.3), rgba(0, 0, 0, 0.5));
  color: #ec4899;
}

.time-cell {
@@ -467,183 +360,86 @@ body {
  font-weight: 600;
  font-size: 12px;
  color: #ec4899;
  text-shadow: 0 0 10px rgba(236, 72, 153, 0.3);
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(15, 15, 35, 0.5);
}

.calendar-cell {
  padding: 8px;
  padding: 6px;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  min-height: 80px;
  transition: all 0.3s ease;
  min-height: 70px;
  transition: all 0.2s ease;
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
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 11px;
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
  transition: all 0.2s ease;
}

.slot.available {
  background: linear-gradient(135deg, rgba(0, 255, 0, 0.2), rgba(20, 184, 166, 0.3));
  border: 1px solid rgba(0, 255, 0, 0.4);
  animation: availablePulse 3s ease-in-out infinite;
}

@keyframes availablePulse {
  0%, 100% { box-shadow: 0 0 10px rgba(0, 255, 0, 0.3); }
  50% { box-shadow: 0 0 25px rgba(0, 255, 0, 0.5), 0 0 50px rgba(20, 184, 166, 0.3); }
  background: linear-gradient(135deg, rgba(0, 200, 100, 0.2), rgba(20, 184, 166, 0.25));
  border: 1px solid rgba(0, 200, 100, 0.4);
}

.slot.available:hover {
  transform: scale(1.05);
  box-shadow: 0 0 30px rgba(0, 255, 0, 0.5);
  transform: scale(1.02);
  box-shadow: 0 0 15px rgba(0, 200, 100, 0.3);
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
  transform: scale(1.02);
}

.slot.video {
  background: linear-gradient(135deg, rgba(0, 230, 255, 0.25), rgba(0, 180, 255, 0.15));
  border: 1px solid rgba(0, 230, 255, 0.5);
  box-shadow: 0 0 20px rgba(0, 230, 255, 0.2);
  background: linear-gradient(135deg, rgba(0, 180, 220, 0.25), rgba(0, 150, 200, 0.2));
  border: 1px solid rgba(0, 180, 220, 0.5);
}

.slot.phone {
  background: linear-gradient(135deg, rgba(0, 194, 110, 0.25), rgba(0, 150, 80, 0.15));
  border: 1px solid rgba(0, 194, 110, 0.5);
  box-shadow: 0 0 20px rgba(0, 194, 110, 0.2);
  background: linear-gradient(135deg, rgba(0, 180, 100, 0.25), rgba(0, 150, 80, 0.2));
  border: 1px solid rgba(0, 180, 100, 0.5);
}

.slot.async {
  background: linear-gradient(135deg, rgba(176, 122, 255, 0.25), rgba(140, 90, 220, 0.15));
  border: 1px solid rgba(176, 122, 255, 0.5);
  box-shadow: 0 0 20px rgba(176, 122, 255, 0.2);
  background: linear-gradient(135deg, rgba(150, 100, 220, 0.25), rgba(130, 80, 200, 0.2));
  border: 1px solid rgba(150, 100, 220, 0.5);
}

.slot.instant {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(220, 140, 10, 0.2));
  border: 1px solid rgba(245, 158, 11, 0.5);
}

.slot-title {
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 4px;
  font-weight: 600;
  font-size: 11px;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 4px;
}

.slot-time {
  font-size: 11px;
  opacity: 0.8;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 2px;
}

.slot-patient {
@@ -654,221 +450,139 @@ body {
}

.slot-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 9px;
  font-weight: 700;
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
  background: rgba(0, 180, 220, 0.3);
  color: #00d4ff;
}

.slot-badge.phone {
  background: rgba(0, 194, 110, 0.3);
  background: rgba(0, 180, 100, 0.3);
  color: #00ff88;
  text-shadow: 0 0 10px #00ff88;
}

.slot-badge.async {
  background: rgba(176, 122, 255, 0.3);
  color: #d4a5ff;
  text-shadow: 0 0 10px #d4a5ff;
  background: rgba(150, 100, 220, 0.3);
  color: #c4a5ff;
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
.slot-badge.instant {
  background: rgba(245, 158, 11, 0.3);
  color: #f59e0b;
}

@keyframes hintPulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
.slot-reason {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
.toolbar {
  background: rgba(15, 15, 35, 0.7);
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
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 12px 16px;
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
  gap: 10px;
  margin-bottom: 20px;
}

.notification.error .notification-icon {
  background: linear-gradient(135deg, #ff6b6b, #ff4444);
  box-shadow: 0 0 20px #ff6b6b;
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

@keyframes iconPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
.btn-primary {
  background: linear-gradient(135deg, #14b8a6, #0d9488);
  color: #000;
}

.notification-text {
  flex: 1;
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(20, 184, 166, 0.4);
}

.notification-title {
  font-size: 16px;
  font-weight: 700;
  text-shadow: 0 0 10px currentColor;
  margin-bottom: 4px;
.btn-ghost {
  background: transparent;
  color: #00f5ff;
  border: 1px solid rgba(0, 245, 255, 0.3);
}

.notification-message {
  font-size: 14px;
  opacity: 0.9;
.btn-ghost:hover {
  background: rgba(0, 245, 255, 0.1);
  border-color: #00f5ff;
}

.notification-close {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
.nav-arrow {
  font-size: 16px;
  min-width: 36px;
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
.date-pill {
  background: linear-gradient(135deg, rgba(0, 245, 255, 0.2), rgba(20, 184, 166, 0.2));
  border: 1px solid rgba(0, 245, 255, 0.4);
  color: #00f5ff;
  padding: 8px 16px;
  border-radius: 20px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
}

.toolbar-spacer { flex: 1; }

.stats-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: rgba(15, 15, 35, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 20px;
  border-radius: 12px;
  padding: 16px;
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
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-5px);
  border-color: rgba(20, 184, 166, 0.5);
  box-shadow: 0 15px 40px rgba(20, 184, 166, 0.3);
  transform: translateY(-3px);
  border-color: rgba(20, 184, 166, 0.4);
  box-shadow: 0 10px 30px rgba(20, 184, 166, 0.2);
}

.stat-icon {
  font-size: 32px;
  font-size: 28px;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 36px;
  font-size: 32px;
  font-weight: 900;
  background: linear-gradient(135deg, #00f5ff, #ff00ff);
  background-clip: text;
@@ -878,51 +592,67 @@ body {
}

.stat-label {
  font-size: 12px;
  font-size: 11px;
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
.legend {
  background: rgba(15, 15, 35, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  gap: 20px;
  flex-wrap: wrap;
}

.spinner {
  width: 64px;
  height: 64px;
  border: 4px solid transparent;
  border-top: 4px solid #00f5ff;
  border-right: 4px solid #ff00ff;
  border-bottom: 4px solid #14b8a6;
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
  animation: spin 1s linear infinite;
  box-shadow: 0 0 30px rgba(0, 245, 255, 0.5), inset 0 0 30px rgba(255, 0, 255, 0.3);
}

@keyframes spin {
  0% { transform: rotate(0deg); filter: drop-shadow(0 0 10px #14b8a6); }
  50% { filter: drop-shadow(0 0 25px #ec4899); }
  100% { transform: rotate(360deg); filter: drop-shadow(0 0 10px #14b8a6); }
.legend-dot.available {
  background: linear-gradient(135deg, #00ff00, #00cc00);
  box-shadow: 0 0 8px #00ff00;
}

.loading-text {
  margin-top: 20px;
  color: #00f5ff;
  font-size: 18px;
  font-weight: 600;
  text-shadow: 0 0 20px rgba(0, 245, 255, 0.5);
  animation: hintPulse 2s ease-in-out infinite;
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
@@ -934,7 +664,7 @@ body {
}

.month-header {
  background: linear-gradient(180deg, rgba(20, 184, 166, 0.2), transparent);
  background: rgba(15, 15, 35, 0.9);
  padding: 12px;
  text-align: center;
  font-weight: 700;
@@ -948,7 +678,7 @@ body {
  min-height: 100px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  transition: all 0.2s ease;
}

.month-cell:hover {
@@ -968,49 +698,45 @@ body {
}

.month-appointment {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 10px;
  padding: 4px 6px;
  border-radius: 4px;
  margin-bottom: 3px;
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
  background: rgba(0, 180, 220, 0.2);
  color: #00d4ff;
}

.month-appointment.phone {
  background: rgba(0, 194, 110, 0.2);
  background: rgba(0, 180, 100, 0.2);
  color: #00ff88;
  border: 1px solid rgba(0, 194, 110, 0.3);
}

.month-appointment.async {
  background: rgba(176, 122, 255, 0.2);
  color: #d4a5ff;
  border: 1px solid rgba(176, 122, 255, 0.3);
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
  padding: 2px 8px;
}

/* List View */
.list-view {
  overflow: auto;
  max-height: 600px;
  max-height: calc(100vh - 380px);
}

.list-table {
@@ -1021,9 +747,9 @@ body {
.list-table th {
  padding: 12px 16px;
  text-align: left;
  background: linear-gradient(180deg, rgba(20, 184, 166, 0.2), transparent);
  background: rgba(15, 15, 35, 0.9);
  color: #00f5ff;
  font-size: 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
@@ -1059,30 +785,35 @@ body {
.list-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 11px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.list-badge.video {
  background: rgba(0, 230, 255, 0.15);
  color: #00f5ff;
  background: rgba(0, 180, 220, 0.15);
  color: #00d4ff;
}

.list-badge.phone {
  background: rgba(0, 194, 110, 0.15);
  background: rgba(0, 180, 100, 0.15);
  color: #00ff88;
}

.list-badge.async {
  background: rgba(176, 122, 255, 0.15);
  color: #d4a5ff;
  background: rgba(150, 100, 220, 0.15);
  color: #c4a5ff;
}

.list-badge.instant {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.list-table .reason {
  color: #888;
  font-size: 13px;
  font-size: 12px;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
@@ -1091,12 +822,7 @@ body {

.list-table .contact {
  color: #888;
  font-size: 13px;
}

.list-table .contact .phone {
  font-size: 11px;
  opacity: 0.7;
  font-size: 12px;
}

.list-table .empty-state {
@@ -1105,50 +831,131 @@ body {
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
  
  .calendar-grid {
    font-size: 11px;
  .header-content {
    flex-wrap: wrap;
  }
  
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  .search-container {
    order: 10;
    max-width: 100%;
    width: 100%;
    margin-top: 10px;
  }
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
  width: 8px;
  height: 8px;
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
  border-radius: 4px;
}
`


// ============================================
// MAIN COMPONENT
// ============================================
export default function DoctorAppointments() {
  // State
  // State - Initialize currentDate to TODAY at midnight local time
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', title: string, message: string } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentDate, setCurrentDate] = useState<Date>(getTodayLocal())
  const [viewType, setViewType] = useState<ViewType>('calendar')
  const [calendarViewType, setCalendarViewType] = useState<CalendarViewType>('week')
  const [currentDoctorId, setCurrentDoctorId] = useState<string | null>(null)
@@ -1162,88 +969,186 @@ export default function DoctorAppointments() {
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

  const audioContextRef = useRef<AudioContext | null>(null)
  const particlesRef = useRef<HTMLDivElement | null>(null)
  const calendarGridRef = useRef<HTMLDivElement | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Provider timezone is ALWAYS America/Phoenix
  const DOCTOR_TIMEZONE = 'America/Phoenix'

  // ============================================
  // TIME SLOTS - Keep ALL slots (5 AM - 8 PM)
  // TIME SLOTS - Using Phoenix time explicitly
  // ============================================
  const timeSlots = useMemo(() => {
    const slots: Date[] = []
    for (let hour = 5; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = new Date()
        time.setHours(hour, minute, 0, 0)
        const time = createPhoenixTimeSlot(hour, minute)
        slots.push(time)
      }
    }
    return slots
  }, [])

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
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
  // CALENDAR UTILITIES
  // CALENDAR UTILITIES - Today on far left
  // ============================================
  // UPDATED: Current date on far left + next 6 days
  const getWeekDates = (date: Date) => {
  const getWeekDates = useCallback((date: Date) => {
    const dates: Date[] = []
    const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    for (let i = 0; i < 7; i++) {
      const d = new Date(date)
      d.setDate(date.getDate() + i)
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      dates.push(d)
    }
    return dates
  }
  }, [])

  const getMonthDates = (date: Date) => {
  const getMonthDates = useCallback((date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const lastDay = new Date(year, month + 1, 0)

    const dates: Date[] = []
    for (let day = 1; day <= lastDay.getDate(); day++) {
      dates.push(new Date(year, month, day))
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
  }
  }, [])

  const visibleDates = useMemo(() => {
    return calendarViewType === 'week' ? getWeekDates(currentDate) : getMonthDates(currentDate)
  }, [currentDate, calendarViewType])
    if (calendarViewType === 'week') {
      return getWeekDates(currentDate)
    } else if (calendarViewType === 'month') {
      return getMonthDates(currentDate)
    } else {
      return getThreeMonthDates(currentDate)
    }
  }, [currentDate, calendarViewType, getWeekDates, getMonthDates, getThreeMonthDates])

  const navigateCalendar = (direction: 'prev' | 'next') => {
    playSound('whoosh')
    const newDate = new Date(currentDate)
    if (calendarViewType === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else {
    } else if (calendarViewType === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    } else if (calendarViewType === '3month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 3 : -3))
    }
    setCurrentDate(newDate)
  }

  // ============================================
  // APPOINTMENT HELPERS
  // SMART SEARCH - Search patients in database
  // ============================================
  const getAppointmentActualTime = (appointment: CalendarAppointment): string => {
    if (!appointment.requested_date_time) return ''
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

    const appointmentDate = convertToTimezone(appointment.requested_date_time, DOCTOR_TIMEZONE)
    const hours = appointmentDate.getUTCHours()
    const minutes = appointmentDate.getUTCMinutes()
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')
    if (patientAppointments.length > 0) {
      setSelectedAppointmentId(patientAppointments[0].id)
    }

    return `${displayHours}:${displayMinutes} ${period}`
    setSearchQuery('')
    setShowSearchResults(false)
  }

  // ============================================
  // APPOINTMENT HELPERS
  // ============================================
  const getAppointmentReason = (appointment: CalendarAppointment): string => {
    if (appointment.clinical_notes && appointment.clinical_notes.length > 0) {
      const reasonNote = appointment.clinical_notes.find(
@@ -1304,154 +1209,13 @@ export default function DoctorAppointments() {
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
    const hour = time.getUTCHours()
    const minute = time.getUTCMinutes()

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
@@ -1479,7 +1243,7 @@ export default function DoctorAppointments() {

      if (doctor) {
        setCurrentDoctorId(doctor.id)
        fetchAppointments(doctor.id)
        await fetchAppointments(doctor.id)
      }
    } catch (error) {
      console.error('Error fetching current doctor:', error)
@@ -1521,24 +1285,102 @@ export default function DoctorAppointments() {
  }, [])

  // ============================================
  // APPOINTMENT ACTIONS
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
      playSound('click')
      
      if (action === 'complete') {
        const { error } = await supabase
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', appointmentId)

        if (error) {
          showNotification('error', '❌ ERROR', 'Failed to mark appointment as complete')
          console.error('Error updating appointment:', error)
          setNotification({
            type: 'error',
            message: 'Failed to mark appointment as complete'
          })
          setTimeout(() => setNotification(null), 5000)
          return
        }

        showNotification('success', '🎉 COMPLETED!', 'Appointment marked as complete')
        setNotification({
          type: 'success',
          message: 'Appointment marked as complete'
        })
        setTimeout(() => setNotification(null), 5000)
        if (currentDoctorId) fetchAppointments(currentDoctorId)
        return
      }
@@ -1547,7 +1389,9 @@ export default function DoctorAppointments() {

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appointmentId,
          reason: action === 'reject' ? 'Doctor unavailable at this time' : undefined
@@ -1557,66 +1401,169 @@ export default function DoctorAppointments() {
      const result = await response.json()

      if (!response.ok) {
        showNotification('error', '❌ ERROR', result.error || `Failed to ${action} appointment`)
        setNotification({
          type: 'error',
          message: result.error || `Failed to ${action} appointment`
        })
        setTimeout(() => setNotification(null), 5000)
        return
      }

      let successMessage = `Appointment ${action}ed successfully`

      if (action === 'accept') {
        if (result.data.paymentCaptured) successMessage += ' • Payment captured'
        if (result.data.zoomMeeting) successMessage += ' • Zoom meeting created'
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

      showNotification('success', action === 'accept' ? '✨ ACCEPTED!' : '❌ REJECTED', successMessage)
      setNotification({
        type: 'success',
        message: successMessage
      })
      setTimeout(() => setNotification(null), 5000)

      if (currentDoctorId) fetchAppointments(currentDoctorId)
    } catch (error) {
      console.error('Error updating appointment:', error)
      showNotification('error', '❌ ERROR', 'An unexpected error occurred')
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
    createParticles()
    
    // Auto-scroll to current time row
    setTimeout(() => {
      if (calendarGridRef.current) {
        const now = new Date()
        const currentHour = now.getHours()
        const rowHeight = 80 // matches min-height of calendar-cell
        const headerHeight = 50 // approximate header height
        // Calculate scroll position: (hours since 5 AM) * 2 slots per hour * row height
        const scrollPosition = Math.max(0, (currentHour - 5) * 2 * rowHeight)
        calendarGridRef.current.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        })
      }
    }, 100)
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
    const optionsYear: Intl.DateTimeFormatOptions = { ...options, year: 'numeric' }

    if (calendarViewType === 'week') {
      return {
        toolbar: `Week of ${visibleDates[0].toLocaleDateString('en-US', options)}`,
        header: `${visibleDates[0].toLocaleDateString('en-US', options)} - ${visibleDates[visibleDates.length - 1].toLocaleDateString('en-US', optionsYear)}`
        header: `${visibleDates[0].toLocaleDateString('en-US', options)} - ${visibleDates[6].toLocaleDateString('en-US', { ...options, year: 'numeric' })}`
      }
    } else {
      return {
@@ -1626,22 +1573,12 @@ export default function DoctorAppointments() {
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
    const revenue = completed * 59
    return { total, completed, pending, revenue }
  }, [appointments])

@@ -1666,137 +1603,91 @@ export default function DoctorAppointments() {
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
            <span className="logo-text">Your Appointments</span>
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
          <div className="date-pill">{dateRange.header}</div>

          <div className="header-spacer"></div>
          <a href="/doctor/dashboard" className="back-btn" onClick={() => playSound('click')}>← Back to Dashboard</a>
          <a href="/doctor/dashboard" className="back-btn">← Back to Dashboard</a>
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
              <div className="stat-label">Total</div>
            </div>
            <div className="stat-card" onMouseEnter={() => playSound('hover')}>
              <div className="stat-icon">✅</div>
              <div className="stat-value">{stats.completed}</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="stat-card" onMouseEnter={() => playSound('hover')}>
              <div className="stat-icon">⏳</div>
              <div className="stat-value">{stats.pending}</div>
              <div className="stat-label">Pending</div>
            </div>
            <div className="stat-card" onMouseEnter={() => playSound('hover')}>
              <div className="stat-icon">💰</div>
              <div className="stat-value">${stats.revenue}</div>
              <div className="stat-label">Revenue</div>
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
            📅 Month
          </button>
          <button 
            className={`btn ${calendarViewType === 'week' && viewType === 'calendar' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => { playSound('click'); setViewType('calendar'); setCalendarViewType('week'); }} 
            onMouseEnter={() => playSound('hover')}
          >
            📆 Week
          </button>
          <button 
            className={`btn ${viewType === 'list' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => { playSound('click'); setViewType('list'); }} 
            onMouseEnter={() => playSound('hover')}
          >
            📋 List
          </button>
          <button className="btn btn-ghost nav-arrow" onClick={() => navigateCalendar('prev')} onMouseEnter={() => playSound('hover')}>⬅️</button>
          <div className="date-pill">{dateRange.toolbar}</div>
          <button className="btn btn-ghost nav-arrow" onClick={() => navigateCalendar('next')} onMouseEnter={() => playSound('hover')}>➡️</button>
          <div className="toolbar-spacer"></div>
          <button className="btn btn-ghost" onClick={() => { playSound('click'); window.print(); }} onMouseEnter={() => playSound('hover')}>🖨️ Print</button>
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
                <div className="calendar-grid" ref={calendarGridRef}>
                  {/* Header Row */}
                  <div className="calendar-header-cell">⏰ Time</div>
                  <div className="calendar-header-cell">🕐 TIME</div>
                  {visibleDates.map((date, idx) => (
                    <div key={`header-${idx}`} className="calendar-header-cell">
                      {date.toLocaleDateString('en-US', { weekday: 'short' })} {date.getDate()}
                      {date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()} {date.getDate()}
                    </div>
                  ))}

@@ -1810,16 +1701,13 @@ export default function DoctorAppointments() {
                      return (
                        <div 
                          key={`cell-${timeIndex}-${dayIndex}`} 
                          className="calendar-cell" 
                          onMouseEnter={() => playSound('hover')}
                          className="calendar-cell"
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
@@ -1828,41 +1716,18 @@ export default function DoctorAppointments() {
                            <div className={`slot booked ${apt.visit_type || 'video'}`}>
                              <div className="slot-patient">{apt.patients?.first_name} {apt.patients?.last_name}</div>
                              <span className={`slot-badge ${apt.visit_type || 'video'}`}>
                                {apt.visit_type === 'video' ? '📹 VIDEO' : apt.visit_type === 'phone' ? '📞 PHONE' : apt.visit_type === 'async' ? '📝 ASYNC' : '🏥 VISIT'}
                                {apt.visit_type === 'instant' ? '⚡ INSTANT' :
                                 apt.visit_type === 'video' ? '📹 VIDEO' : 
                                 apt.visit_type === 'phone' ? '📞 PHONE' : 
                                 apt.visit_type === 'async' ? '📝 ASYNC' : '🏥 VISIT'}
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
@@ -1875,23 +1740,20 @@ export default function DoctorAppointments() {
                    })
                  ])}
                </div>
                <div className="hint">💡 Tip: Click a slot to schedule or view appointment details.</div>
                <div className="hint">💡 Click a slot to schedule or view appointment details</div>
              </>
            ) : (
            ) : calendarViewType === 'month' ? (
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
@@ -1902,19 +1764,19 @@ export default function DoctorAppointments() {
                    })

                    return (
                      <div key={index} className="month-cell" onMouseEnter={() => playSound('hover')}>
                      <div key={index} className="month-cell">
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
                            title={`${apt.patients?.first_name} ${apt.patients?.last_name} - ${getAppointmentActualTime(apt)}`}
                          >
                            {apt.patients?.first_name} {apt.patients?.last_name?.charAt(0)}.
                            {apt.patients?.first_name} {apt.patients?.last_name?.charAt(0)}. • {apt.visit_type === 'instant' ? '⚡' : apt.visit_type || 'Visit'}
                          </div>
                        ))}
                        {dayAppointments.length > 3 && (
@@ -1924,8 +1786,10 @@ export default function DoctorAppointments() {
                    )
                  })}
                </div>
                <div className="hint">💡 Tip: Click an appointment to view details.</div>
                <div className="hint">💡 Click an appointment to view details</div>
              </>
            ) : (
              <div className="hint">3-Month view (to be implemented)</div>
            )}
          </div>
        ) : (
@@ -1952,8 +1816,7 @@ export default function DoctorAppointments() {
                      return (
                        <tr
                          key={apt.id}
                          onClick={() => { playSound('click'); setSelectedAppointmentId(apt.id); }}
                          onMouseEnter={() => playSound('hover')}
                          onClick={() => setSelectedAppointmentId(apt.id)}
                        >
                          <td className="patient-name">
                            {apt.patients?.first_name || ''} {apt.patients?.last_name || ''}
@@ -1969,15 +1832,16 @@ export default function DoctorAppointments() {
                          </td>
                          <td>
                            <span className={`list-badge ${apt.visit_type || 'video'}`}>
                              {apt.visit_type === 'video' ? 'Video' :
                              {apt.visit_type === 'instant' ? '⚡ Instant' :
                               apt.visit_type === 'video' ? 'Video' :
                               apt.visit_type === 'phone' ? 'Phone' :
                               apt.visit_type === 'async' ? 'Async' : 'Visit'}
                            </span>
                          </td>
                          <td className="reason">{getAppointmentReason(apt) || '—'}</td>
                          <td className="contact">
                            <div>{apt.patients?.email || '—'}</div>
                            <div className="phone">{apt.patients?.phone || ''}</div>
                            <div style={{ fontSize: '11px' }}>{apt.patients?.phone || ''}</div>
                          </td>
                        </tr>
                      )
@@ -1992,8 +1856,97 @@ export default function DoctorAppointments() {
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
@@ -2017,7 +1970,11 @@ export default function DoctorAppointments() {
          setSelectedAppointmentId(null)
        }}
        onSmsSent={(message) => {
          showNotification('success', '📱 SMS SENT', message)
          setNotification({
            type: 'success',
            message: message
          })
          setTimeout(() => setNotification(null), 5000)
        }}
      />

@@ -2032,19 +1989,42 @@ export default function DoctorAppointments() {
            setSelectedSlotTime(null)
            setFollowUpPatientData(null)
          }}
          onSuccess={() => {
          onSuccess={async () => {
            if (currentDoctorId) {
              fetchAppointments(currentDoctorId)
              await fetchAppointments(currentDoctorId)
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







