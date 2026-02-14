// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — CHART STATUS CHIP INDICATORS
// Renders 5-state visual indicators on appointment calendar chips
// Draft: gray border | Preliminary: amber ⏳ | Signed: green ✓
// Closed: blue 🔒 | Amended: purple 🔒✎
// ═══════════════════════════════════════════════════════════════

import { CHART_STATUS, CHART_STATUS_CONFIG } from '@/lib/constants'
import type { ChartStatus } from '@/lib/constants'

// ─── TYPES ───────────────────────────────────────────────────
interface ChartStatusIndicatorProps {
  chartStatus: ChartStatus
  chartLocked: boolean
  appointmentStatus: string
}

// ─── GET CHART STATUS FROM APPOINTMENT DATA ──────────────────
// Maps the current appointment/chart fields to a ChartStatus
export function deriveChartStatus(appointment: {
  chart_locked?: boolean | null
  chart_status?: string | null
  status?: string
}): ChartStatus {
  // If chart has explicit status, use it
  if (appointment.chart_status) {
    const status = appointment.chart_status as ChartStatus
    if (Object.values(CHART_STATUS).includes(status)) {
      return status
    }
  }

  // Derive from existing fields
  if (appointment.chart_locked) {
    return CHART_STATUS.CLOSED
  }

  if (appointment.status === 'completed') {
    return CHART_STATUS.SIGNED
  }

  return CHART_STATUS.DRAFT
}

// ─── LEFT BORDER STYLE ──────────────────────────────────────
// Returns inline style for the 4px left border color
export function getChipBorderStyle(chartStatus: ChartStatus): React.CSSProperties {
  const config = CHART_STATUS_CONFIG[chartStatus]
  return {
    borderLeft: `4px solid ${config.color}`,
  }
}

// ─── STATUS ICON (top-right corner of chip) ──────────────────
// Returns the icon string + color for the top-right indicator
// Every state gets an icon so the doctor always knows the chart state at a glance
export function getChipStatusIcon(chartStatus: ChartStatus): {
  icon: string
  color: string
  title: string
} {
  switch (chartStatus) {
    case CHART_STATUS.DRAFT:
      return {
        icon: '🔓',
        color: '#6b7280',
        title: 'Draft — Unlocked',
      }

    case CHART_STATUS.PRELIMINARY:
      return {
        icon: '⏳',
        color: '#f59e0b',
        title: 'Preliminary — Pending cosign',
      }

    case CHART_STATUS.SIGNED:
      return {
        icon: '✓',
        color: '#22c55e',
        title: 'Signed — Complete',
      }

    case CHART_STATUS.CLOSED:
      return {
        icon: '🔒',
        color: '#fbbf24',
        title: 'Chart locked',
      }

    case CHART_STATUS.AMENDED:
      return {
        icon: '🔒✎',
        color: '#a855f7',
        title: 'Amended',
      }

    default:
      return {
        icon: '🔓',
        color: '#6b7280',
        title: 'Draft — Unlocked',
      }
  }
}
