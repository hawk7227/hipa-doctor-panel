// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — LAYOUT PERSISTENCE SERVICE
// Saves/loads workspace panel layouts to/from Supabase
// Debounced auto-save on every layout change
// ═══════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase'
import { WORKSPACE_DEFAULTS } from '@/lib/constants'
import type { PanelState } from '@/lib/workspace/WorkspaceState'

// ─── TYPES ───────────────────────────────────────────────────
export interface SavedLayout {
  id?: string
  doctor_id: string
  layout_name: string
  layout_data: Record<string, Partial<PanelState>>
  is_default: boolean
  created_at?: string
  updated_at?: string
}

// ─── DEBOUNCE TIMER ──────────────────────────────────────────
let saveTimeout: ReturnType<typeof setTimeout> | null = null

// ─── SAVE LAYOUT (debounced) ─────────────────────────────────
// Called on every panel move/resize/open/close
// Debounces to avoid hammering Supabase on rapid changes
export async function saveLayout(
  doctorId: string,
  panels: Record<string, PanelState>,
  layoutName: string = 'default'
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (saveTimeout) clearTimeout(saveTimeout)

    saveTimeout = setTimeout(async () => {
      try {
        // Strip transient state — only save position, size, isOpen, isLocked
        const layoutData: Record<string, Partial<PanelState>> = {}
        for (const [id, panel] of Object.entries(panels)) {
          if (panel.isOpen || panel.position.x !== 100 || panel.position.y !== 100) {
            layoutData[id] = {
              isOpen: panel.isOpen,
              position: panel.position,
              size: panel.size,
              isLocked: panel.isLocked,
              isMinimized: panel.isMinimized,
            }
          }
        }

        const { error } = await supabase
          .from('doctor_workspace_layouts')
          .upsert(
            {
              doctor_id: doctorId,
              layout_name: layoutName,
              layout_data: layoutData,
              is_default: layoutName === 'default',
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'doctor_id,layout_name',
            }
          )

        if (error) {
          console.error('Layout save error:', error)
          resolve({ success: false, error: error.message })
        } else {
          console.log('Layout saved:', layoutName)
          resolve({ success: true })
        }
      } catch (err) {
        console.error('Layout save exception:', err)
        resolve({ success: false, error: String(err) })
      }
    }, WORKSPACE_DEFAULTS.LAYOUT_SAVE_DEBOUNCE_MS)
  })
}

// ─── LOAD LAYOUT ─────────────────────────────────────────────
// Returns saved panel positions/sizes for a doctor
export async function loadLayout(
  doctorId: string,
  layoutName: string = 'default'
): Promise<{ data: Record<string, Partial<PanelState>> | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('doctor_workspace_layouts')
      .select('layout_data')
      .eq('doctor_id', doctorId)
      .eq('layout_name', layoutName)
      .single()

    if (error) {
      // No saved layout is fine — return null, not error
      if (error.code === 'PGRST116') {
        console.log('No saved layout found, using defaults')
        return { data: null }
      }
      console.error('Layout load error:', error)
      return { data: null, error: error.message }
    }

    return { data: data?.layout_data || null }
  } catch (err) {
    console.error('Layout load exception:', err)
    return { data: null, error: String(err) }
  }
}

// ─── LIST SAVED LAYOUTS ──────────────────────────────────────
// For future "Switch Layout" feature
export async function listLayouts(
  doctorId: string
): Promise<{ data: SavedLayout[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('doctor_workspace_layouts')
      .select('id, doctor_id, layout_name, is_default, created_at, updated_at')
      .eq('doctor_id', doctorId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Layout list error:', error)
      return { data: [], error: error.message }
    }

    return { data: (data as SavedLayout[]) || [] }
  } catch (err) {
    console.error('Layout list exception:', err)
    return { data: [], error: String(err) }
  }
}

// ─── DELETE LAYOUT ───────────────────────────────────────────
export async function deleteLayout(
  doctorId: string,
  layoutName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('doctor_workspace_layouts')
      .delete()
      .eq('doctor_id', doctorId)
      .eq('layout_name', layoutName)

    if (error) {
      console.error('Layout delete error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('Layout delete exception:', err)
    return { success: false, error: String(err) }
  }
}

// ─── CANCEL PENDING SAVE ─────────────────────────────────────
// Call on unmount to prevent stale saves
export function cancelPendingSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
}
