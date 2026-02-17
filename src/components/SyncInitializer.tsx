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
