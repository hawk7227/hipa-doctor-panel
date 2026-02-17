// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// SYNC INITIALIZER — Drop into your root layout to start sync
//
// Usage in layout.tsx:
//   import SyncInitializer from '@/components/SyncInitializer'
//   <body>
//     <SyncInitializer />
//     {children}
//   </body>
// ═══════════════════════════════════════════════════════════════

'use client'

import { useInitSync } from '@/lib/offline-store'

export default function SyncInitializer() {
  useInitSync()
  return null // Invisible — just runs the sync engine
}
