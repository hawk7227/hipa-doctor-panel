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
