// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { PROVIDER_TIMEZONE } from '@/lib/constants'
import { useState, useCallback } from 'react'

export type PanelId =
  | 'medication-history' | 'orders' | 'prescription-history' | 'appointments'
  | 'allergies' | 'vitals' | 'medications' | 'demographics'
  | 'problems' | 'clinical-notes' | 'lab-results-panel' | 'immunizations'
  | 'documents' | 'family-history' | 'social-history' | 'surgical-history'
  | 'pharmacy' | 'care-plans' | 'billing' | 'comm-hub'
  | 'lab-results-inline' | 'referrals-followup' | 'prior-auth'
  | 'chart-management' | 'video-panel'
  | 'insurance' | 'alerts' | 'ai-interactions' | 'quality-measures' | 'cohorts'

export function usePanelVisibility() {
  const [openPanels, setOpenPanels] = useState<Set<PanelId>>(new Set())

  const isOpen = useCallback((id: PanelId) => openPanels.has(id), [openPanels])

  const toggle = useCallback((id: PanelId) => {
    setOpenPanels(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const open = useCallback((id: PanelId) => {
    setOpenPanels(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const close = useCallback((id: PanelId) => {
    setOpenPanels(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const closeAll = useCallback(() => {
    setOpenPanels(new Set())
  }, [])

  return { isOpen, toggle, open, close, closeAll, openPanels }
}
