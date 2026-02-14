// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — WORKSPACE STATE MANAGER
// Centralized state for all panel open/close, positions, sizes
// Replaces 60+ useState booleans in AppointmentDetailModal
// ═══════════════════════════════════════════════════════════════

'use client'

import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react'
import { PanelId, PANEL_ID, ChartStatus, CHART_STATUS, UserRole } from '@/lib/constants'

// ─── PANEL STATE ─────────────────────────────────────────────
export interface PanelState {
  isOpen: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
  isLocked: boolean
  isMinimized: boolean
  zIndex: number
}

// ─── WORKSPACE STATE ─────────────────────────────────────────
export interface WorkspaceState {
  // Panel states keyed by panel ID
  panels: Record<string, PanelState>

  // Global workspace state
  activeAppointmentId: string | null
  activePatientId: string | null
  chartStatus: ChartStatus
  chartLocked: boolean
  chartSignedAt: string | null
  chartSignedBy: string | null
  chartClosedAt: string | null
  chartClosedBy: string | null

  // User context
  userRole: UserRole
  doctorId: string | null
  doctorName: string | null

  // Patient context (shared across all panels)
  patientId: string | null
  patientName: string | null
  patientDOB: string | null

  // UI state
  nextZIndex: number
  isCustomizeMode: boolean
  isMobile: boolean
}

// ─── ACTIONS ─────────────────────────────────────────────────
export type WorkspaceAction =
  | { type: 'OPEN_PANEL'; id: string }
  | { type: 'CLOSE_PANEL'; id: string }
  | { type: 'TOGGLE_PANEL'; id: string }
  | { type: 'MOVE_PANEL'; id: string; position: { x: number; y: number } }
  | { type: 'RESIZE_PANEL'; id: string; size: { width: number; height: number } }
  | { type: 'LOCK_PANEL'; id: string }
  | { type: 'UNLOCK_PANEL'; id: string }
  | { type: 'MINIMIZE_PANEL'; id: string }
  | { type: 'MAXIMIZE_PANEL'; id: string }
  | { type: 'BRING_TO_FRONT'; id: string }
  | { type: 'CLOSE_ALL_PANELS' }
  | { type: 'LOAD_LAYOUT'; panels: Record<string, Partial<PanelState>> }
  | { type: 'RESET_LAYOUT' }
  | { type: 'SET_APPOINTMENT'; appointmentId: string; patientId: string; patientName: string; patientDOB: string | null }
  | { type: 'CLEAR_APPOINTMENT' }
  | { type: 'SET_CHART_STATUS'; status: ChartStatus; signedAt?: string | null; signedBy?: string | null; closedAt?: string | null; closedBy?: string | null }
  | { type: 'SET_CHART_LOCKED'; locked: boolean }
  | { type: 'SET_USER_CONTEXT'; role: UserRole; doctorId: string; doctorName: string }
  | { type: 'SET_CUSTOMIZE_MODE'; enabled: boolean }
  | { type: 'SET_MOBILE'; isMobile: boolean }

// ─── DEFAULT PANEL STATE ─────────────────────────────────────
const DEFAULT_PANEL_STATE: PanelState = {
  isOpen: false,
  position: { x: 100, y: 100 },
  size: { width: 480, height: 600 },
  isLocked: false,
  isMinimized: false,
  zIndex: 20,
}

// ─── INITIAL STATE ───────────────────────────────────────────
export const INITIAL_WORKSPACE_STATE: WorkspaceState = {
  panels: {},
  activeAppointmentId: null,
  activePatientId: null,
  chartStatus: CHART_STATUS.DRAFT,
  chartLocked: false,
  chartSignedAt: null,
  chartSignedBy: null,
  chartClosedAt: null,
  chartClosedBy: null,
  userRole: 'provider' as UserRole,
  doctorId: null,
  doctorName: null,
  patientId: null,
  patientName: null,
  patientDOB: null,
  nextZIndex: 30,
  isCustomizeMode: false,
  isMobile: false,
}

// ─── HELPER: Get or create panel state ───────────────────────
function getPanelState(panels: Record<string, PanelState>, id: string): PanelState {
  return panels[id] || { ...DEFAULT_PANEL_STATE }
}

// ─── REDUCER ─────────────────────────────────────────────────
export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'OPEN_PANEL': {
      const panel = getPanelState(state.panels, action.id)
      return {
        ...state,
        nextZIndex: state.nextZIndex + 1,
        panels: {
          ...state.panels,
          [action.id]: {
            ...panel,
            isOpen: true,
            isMinimized: false,
            zIndex: state.nextZIndex,
          },
        },
      }
    }

    case 'CLOSE_PANEL': {
      const panel = getPanelState(state.panels, action.id)
      return {
        ...state,
        panels: {
          ...state.panels,
          [action.id]: { ...panel, isOpen: false },
        },
      }
    }

    case 'TOGGLE_PANEL': {
      const panel = getPanelState(state.panels, action.id)
      if (panel.isOpen) {
        return workspaceReducer(state, { type: 'CLOSE_PANEL', id: action.id })
      }
      return workspaceReducer(state, { type: 'OPEN_PANEL', id: action.id })
    }

    case 'MOVE_PANEL': {
      const panel = getPanelState(state.panels, action.id)
      if (panel.isLocked) return state
      return {
        ...state,
        panels: {
          ...state.panels,
          [action.id]: { ...panel, position: action.position },
        },
      }
    }

    case 'RESIZE_PANEL': {
      const panel = getPanelState(state.panels, action.id)
      if (panel.isLocked) return state
      return {
        ...state,
        panels: {
          ...state.panels,
          [action.id]: { ...panel, size: action.size },
        },
      }
    }

    case 'LOCK_PANEL': {
      const panel = getPanelState(state.panels, action.id)
      return {
        ...state,
        panels: {
          ...state.panels,
          [action.id]: { ...panel, isLocked: true },
        },
      }
    }

    case 'UNLOCK_PANEL': {
      const panel = getPanelState(state.panels, action.id)
      return {
        ...state,
        panels: {
          ...state.panels,
          [action.id]: { ...panel, isLocked: false },
        },
      }
    }

    case 'MINIMIZE_PANEL': {
      const panel = getPanelState(state.panels, action.id)
      return {
        ...state,
        panels: {
          ...state.panels,
          [action.id]: { ...panel, isMinimized: true },
        },
      }
    }

    case 'MAXIMIZE_PANEL': {
      const panel = getPanelState(state.panels, action.id)
      return {
        ...state,
        nextZIndex: state.nextZIndex + 1,
        panels: {
          ...state.panels,
          [action.id]: { ...panel, isMinimized: false, zIndex: state.nextZIndex },
        },
      }
    }

    case 'BRING_TO_FRONT': {
      const panel = getPanelState(state.panels, action.id)
      return {
        ...state,
        nextZIndex: state.nextZIndex + 1,
        panels: {
          ...state.panels,
          [action.id]: { ...panel, zIndex: state.nextZIndex },
        },
      }
    }

    case 'CLOSE_ALL_PANELS': {
      const closedPanels: Record<string, PanelState> = {}
      for (const [id, panel] of Object.entries(state.panels)) {
        closedPanels[id] = { ...panel, isOpen: false }
      }
      return { ...state, panels: closedPanels }
    }

    case 'LOAD_LAYOUT': {
      const mergedPanels: Record<string, PanelState> = { ...state.panels }
      for (const [id, partial] of Object.entries(action.panels)) {
        const existing = getPanelState(state.panels, id)
        mergedPanels[id] = { ...existing, ...partial }
      }
      return { ...state, panels: mergedPanels }
    }

    case 'RESET_LAYOUT': {
      return { ...state, panels: {}, nextZIndex: 30 }
    }

    case 'SET_APPOINTMENT': {
      return {
        ...state,
        activeAppointmentId: action.appointmentId,
        activePatientId: action.patientId,
        patientId: action.patientId,
        patientName: action.patientName,
        patientDOB: action.patientDOB,
      }
    }

    case 'CLEAR_APPOINTMENT': {
      return {
        ...state,
        activeAppointmentId: null,
        activePatientId: null,
        patientId: null,
        patientName: null,
        patientDOB: null,
        chartStatus: CHART_STATUS.DRAFT,
        chartLocked: false,
        chartSignedAt: null,
        chartSignedBy: null,
        chartClosedAt: null,
        chartClosedBy: null,
        panels: {},
        nextZIndex: 30,
      }
    }

    case 'SET_CHART_STATUS': {
      return {
        ...state,
        chartStatus: action.status,
        chartLocked: action.status === CHART_STATUS.SIGNED || action.status === CHART_STATUS.CLOSED || action.status === CHART_STATUS.AMENDED,
        chartSignedAt: action.signedAt !== undefined ? action.signedAt : state.chartSignedAt,
        chartSignedBy: action.signedBy !== undefined ? action.signedBy : state.chartSignedBy,
        chartClosedAt: action.closedAt !== undefined ? action.closedAt : state.chartClosedAt,
        chartClosedBy: action.closedBy !== undefined ? action.closedBy : state.chartClosedBy,
      }
    }

    case 'SET_CHART_LOCKED': {
      return { ...state, chartLocked: action.locked }
    }

    case 'SET_USER_CONTEXT': {
      return {
        ...state,
        userRole: action.role,
        doctorId: action.doctorId,
        doctorName: action.doctorName,
      }
    }

    case 'SET_CUSTOMIZE_MODE': {
      return { ...state, isCustomizeMode: action.enabled }
    }

    case 'SET_MOBILE': {
      return { ...state, isMobile: action.isMobile }
    }

    default:
      return state
  }
}

// ─── CONTEXT ─────────────────────────────────────────────────
interface WorkspaceContextType {
  state: WorkspaceState
  dispatch: React.Dispatch<WorkspaceAction>

  // Convenience methods (stable references via useCallback)
  openPanel: (id: string) => void
  closePanel: (id: string) => void
  togglePanel: (id: string) => void
  isPanelOpen: (id: string) => boolean
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null)

// ─── PROVIDER ────────────────────────────────────────────────
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, INITIAL_WORKSPACE_STATE)

  const openPanel = useCallback((id: string) => {
    dispatch({ type: 'OPEN_PANEL', id })
  }, [])

  const closePanel = useCallback((id: string) => {
    dispatch({ type: 'CLOSE_PANEL', id })
  }, [])

  const togglePanel = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_PANEL', id })
  }, [])

  const isPanelOpen = useCallback((id: string): boolean => {
    return state.panels[id]?.isOpen ?? false
  }, [state.panels])

  const value = useMemo(() => ({
    state,
    dispatch,
    openPanel,
    closePanel,
    togglePanel,
    isPanelOpen,
  }), [state, dispatch, openPanel, closePanel, togglePanel, isPanelOpen])

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

// ─── HOOK ────────────────────────────────────────────────────
export function useWorkspace(): WorkspaceContextType {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}

// ─── PANEL-SPECIFIC HOOK (for individual panels) ─────────────
// Returns only the state for a specific panel — avoids re-renders
// from other panel changes when used with React.memo
export function usePanelState(panelId: string) {
  const { state, dispatch } = useWorkspace()

  const panelState = state.panels[panelId] || {
    isOpen: false,
    position: { x: 100, y: 100 },
    size: { width: 480, height: 600 },
    isLocked: false,
    isMinimized: false,
    zIndex: 20,
  }

  const open = useCallback(() => dispatch({ type: 'OPEN_PANEL', id: panelId }), [dispatch, panelId])
  const close = useCallback(() => dispatch({ type: 'CLOSE_PANEL', id: panelId }), [dispatch, panelId])
  const toggle = useCallback(() => dispatch({ type: 'TOGGLE_PANEL', id: panelId }), [dispatch, panelId])
  const bringToFront = useCallback(() => dispatch({ type: 'BRING_TO_FRONT', id: panelId }), [dispatch, panelId])
  const minimize = useCallback(() => dispatch({ type: 'MINIMIZE_PANEL', id: panelId }), [dispatch, panelId])
  const maximize = useCallback(() => dispatch({ type: 'MAXIMIZE_PANEL', id: panelId }), [dispatch, panelId])
  const lock = useCallback(() => dispatch({ type: 'LOCK_PANEL', id: panelId }), [dispatch, panelId])
  const unlock = useCallback(() => dispatch({ type: 'UNLOCK_PANEL', id: panelId }), [dispatch, panelId])

  const move = useCallback((position: { x: number; y: number }) => {
    dispatch({ type: 'MOVE_PANEL', id: panelId, position })
  }, [dispatch, panelId])

  const resize = useCallback((size: { width: number; height: number }) => {
    dispatch({ type: 'RESIZE_PANEL', id: panelId, size })
  }, [dispatch, panelId])

  return {
    ...panelState,
    open,
    close,
    toggle,
    bringToFront,
    minimize,
    maximize,
    lock,
    unlock,
    move,
    resize,
    // Shared context
    chartStatus: state.chartStatus,
    chartLocked: state.chartLocked,
    patientId: state.patientId,
    patientName: state.patientName,
    patientDOB: state.patientDOB,
    appointmentId: state.activeAppointmentId,
    userRole: state.userRole,
  }
}
