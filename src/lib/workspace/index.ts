// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — WORKSPACE EXPORTS
// ═══════════════════════════════════════════════════════════════

export {
  WorkspaceProvider,
  useWorkspace,
  usePanelState,
  workspaceReducer,
  INITIAL_WORKSPACE_STATE,
} from './WorkspaceState'

export type {
  WorkspaceState,
  WorkspaceAction,
  PanelState,
} from './WorkspaceState'

export {
  PANEL_REGISTRY,
  getPanelConfig,
  getPanelsByCategory,
  getDefaultOpenPanels,
  getToolbarPanels,
} from './PanelRegistry'

export type { PanelConfig } from './PanelRegistry'

export {
  saveLayout,
  loadLayout,
  listLayouts,
  deleteLayout,
  cancelPendingSave,
} from './LayoutPersistence'

export type { SavedLayout } from './LayoutPersistence'
