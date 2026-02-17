// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — HOVER PREVIEW POPUP
// Shows patient info when hovering over appointment chips
// 300ms delay, smart positioning, does NOT replace click behavior
// ═══════════════════════════════════════════════════════════════

'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Clock, User, Calendar, Stethoscope, FileText } from 'lucide-react'
import { Z_INDEX, CALENDAR_DEFAULTS, CHART_STATUS_CONFIG } from '@/lib/constants'
import type { ChartStatus } from '@/lib/constants'

// ─── TYPES ───────────────────────────────────────────────────
export interface HoverPreviewData {
  patientName: string
  patientGender?: string
  patientDOB?: string
  providerName?: string
  appointmentTime: string
  appointmentDuration?: string
  appointmentDate: string
  visitType: string
  chartStatus: ChartStatus
  chiefComplaint?: string
  appointmentStatus?: string
}

interface HoverPreviewProps {
  data: HoverPreviewData | null
  anchorRect: DOMRect | null
  isVisible: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}

// ─── COMPONENT ───────────────────────────────────────────────
function HoverPreviewInner({ data, anchorRect, isVisible, onMouseEnter, onMouseLeave }: HoverPreviewProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [placement, setPlacement] = useState<'right' | 'left' | 'below'>('right')

  // ─── SMART POSITIONING ───────────────────────────────────
  useEffect(() => {
    if (!anchorRect || !isVisible) return

    const popupW = 320
    const popupH = 260
    const gap = 8
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1920
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 1080

    // Prefer right of the chip
    const rightX = anchorRect.right + gap
    const leftX = anchorRect.left - popupW - gap
    const belowY = anchorRect.bottom + gap

    let finalTop = anchorRect.top
    let finalLeft = rightX
    let finalPlacement: 'right' | 'left' | 'below' = 'right'

    // Check if it fits on the right
    if (rightX + popupW > viewportW) {
      // Try left
      if (leftX > 0) {
        finalLeft = leftX
        finalPlacement = 'left'
      } else {
        // Fall back to below
        finalLeft = Math.max(8, anchorRect.left)
        finalTop = belowY
        finalPlacement = 'below'
      }
    }

    // Prevent going below viewport
    if (finalTop + popupH > viewportH) {
      finalTop = Math.max(8, viewportH - popupH - 8)
    }

    // Prevent going above viewport
    if (finalTop < 8) {
      finalTop = 8
    }

    setPosition({ top: finalTop, left: finalLeft })
    setPlacement(finalPlacement)
  }, [anchorRect, isVisible])

  if (!isVisible || !data || !anchorRect) return null

  const chartConfig = CHART_STATUS_CONFIG[data.chartStatus]
  const truncatedComplaint = data.chiefComplaint
    ? data.chiefComplaint.length > 50
      ? data.chiefComplaint.substring(0, 50) + '...'
      : data.chiefComplaint
    : null

  return (
    <div
      ref={popupRef}
      className="fixed bg-[#0d2626] border border-[#1a3d3d] rounded-xl shadow-2xl overflow-hidden pointer-events-auto"
      style={{
        zIndex: Z_INDEX.HOVER_POPUP,
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: '320px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="tooltip"
      aria-label={`Preview for ${data.patientName}`}
    >
      {/* Header with patient name */}
      <div className="px-4 pt-3 pb-2 border-b border-[#1a3d3d]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-8 h-8 bg-teal-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-teal-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{data.patientName}</p>
              <div className="flex items-center space-x-2 text-[11px] text-gray-400">
                {data.patientGender && <span>{data.patientGender}</span>}
                {data.patientGender && data.patientDOB && <span>·</span>}
                {data.patientDOB && <span>DOB: {data.patientDOB}</span>}
              </div>
            </div>
          </div>
          {/* Chart status badge */}
          <div
            className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${chartConfig.bgColor}`}
            style={{ color: chartConfig.color }}
          >
            {chartConfig.icon && <span className="text-[10px]">{chartConfig.icon}</span>}
            <span>{chartConfig.label}</span>
          </div>
        </div>
      </div>

      {/* Info rows */}
      <div className="px-4 py-2.5 space-y-2">
        {/* Provider */}
        {data.providerName && (
          <div className="flex items-center space-x-2">
            <Stethoscope className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <span className="text-xs text-gray-300">{data.providerName}</span>
          </div>
        )}

        {/* Time + Duration */}
        <div className="flex items-center space-x-2">
          <Clock className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          <span className="text-xs text-gray-300">
            {data.appointmentTime}
            {data.appointmentDuration && <span className="text-gray-500"> · {data.appointmentDuration}</span>}
          </span>
        </div>

        {/* Date */}
        <div className="flex items-center space-x-2">
          <Calendar className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          <span className="text-xs text-gray-300">{data.appointmentDate}</span>
        </div>

        {/* Visit type */}
        <div className="flex items-center space-x-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
            data.visitType === 'video' ? 'bg-blue-500/20 text-blue-400' :
            data.visitType === 'phone' ? 'bg-green-500/20 text-green-400' :
            data.visitType === 'async' ? 'bg-purple-500/20 text-purple-400' :
            data.visitType === 'instant' ? 'bg-amber-500/20 text-amber-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>
            {data.visitType === 'instant' ? '⚡ INSTANT' : data.visitType?.toUpperCase() || 'VISIT'}
          </span>
          {data.appointmentStatus && data.appointmentStatus !== 'completed' && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
              data.appointmentStatus === 'pending' ? 'bg-amber-500/20 text-amber-400' :
              data.appointmentStatus === 'accepted' ? 'bg-green-500/20 text-green-400' :
              data.appointmentStatus === 'cancelled' ? 'bg-red-500/20 text-red-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {data.appointmentStatus.toUpperCase()}
            </span>
          )}
        </div>

        {/* Chief complaint */}
        {truncatedComplaint && (
          <div className="flex items-start space-x-2 pt-1 border-t border-[#1a3d3d]">
            <FileText className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-gray-400 italic">{truncatedComplaint}</span>
          </div>
        )}
      </div>
    </div>
  )
}

const HoverPreview = React.memo(HoverPreviewInner)
HoverPreview.displayName = 'HoverPreview'
export default HoverPreview

// ─── HOOK: useHoverPreview ───────────────────────────────────
// Manages the 300ms delay, anchor tracking, and visibility
export function useHoverPreview() {
  const [data, setData] = useState<HoverPreviewData | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isOverPopup = useRef(false)

  const showPreview = useCallback((previewData: HoverPreviewData, chipElement: HTMLElement) => {
    // Clear any pending hide
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }

    // If already showing for same patient, just update
    if (isVisible && data?.patientName === previewData.patientName) {
      setAnchorRect(chipElement.getBoundingClientRect())
      return
    }

    // Start 300ms delay
    if (enterTimer.current) clearTimeout(enterTimer.current)
    enterTimer.current = setTimeout(() => {
      setData(previewData)
      setAnchorRect(chipElement.getBoundingClientRect())
      setIsVisible(true)
    }, CALENDAR_DEFAULTS.HOVER_POPUP_DELAY_MS)
  }, [isVisible, data])

  const hidePreview = useCallback(() => {
    // Clear pending show
    if (enterTimer.current) {
      clearTimeout(enterTimer.current)
      enterTimer.current = null
    }

    // Grace period — user might be moving to the popup
    leaveTimer.current = setTimeout(() => {
      if (!isOverPopup.current) {
        setIsVisible(false)
        setData(null)
        setAnchorRect(null)
      }
    }, CALENDAR_DEFAULTS.HOVER_POPUP_GRACE_MS)
  }, [])

  const onPopupMouseEnter = useCallback(() => {
    isOverPopup.current = true
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
  }, [])

  const onPopupMouseLeave = useCallback(() => {
    isOverPopup.current = false
    hidePreview()
  }, [hidePreview])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (enterTimer.current) clearTimeout(enterTimer.current)
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
    }
  }, [])

  return {
    data,
    anchorRect,
    isVisible,
    showPreview,
    hidePreview,
    onPopupMouseEnter,
    onPopupMouseLeave,
  }
}
