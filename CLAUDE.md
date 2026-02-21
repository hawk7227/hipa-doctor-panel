<!-- @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file. -->
<!-- @see CONTRIBUTING.md for mandatory development rules. -->
<!-- ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner. -->
<!-- ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports. -->
# CLAUDE.md — Medazon Health Doctor Panel

## Project Overview
Next.js (TypeScript) doctor panel for Medazon Health. Uses Supabase (auth + DB), DrChrono EHR integration, Stripe billing, Twilio voice, and Dexie (IndexedDB) for offline-first caching.

## Quick Start
```bash
npm run dev        # Start dev server (webpack mode)
npm run build      # Production build (4GB heap)
npm run start      # Start production server
```

## Mandatory Development Rules
**Read `CONTRIBUTING.md` and `src/lib/system-manifest/index.ts` BEFORE modifying any file.**

1. **NEVER delete files, code, comments, console.logs, or imports** without explicit permission from Marcus
2. **Minimal changes only** — fix only what is requested, do not refactor surrounding code
3. Every file has a `@build-manifest` header — read it before editing
4. After changes, update the file's `BUILD_HISTORY` footer and add fixes to `FIX_HISTORY` in the manifest
5. **RLS is DISABLED** on all `drchrono_*` tables — do not re-enable
6. Interface names must match DB columns (`created_at` not `createdAt`)
7. All panel APIs use `/api/panels/{endpoint}` with `usePanelData` hook
8. 3-tier data fallback: Live DrChrono -> Supabase export -> Static JSON
9. Use `draggableHandle` (not `dragConfig`) for react-grid-layout
10. Use service role key for all server-side Supabase queries
11. Export uses `/api/cron-export` server-side, NOT browser upload

## Key Files
| File | Purpose |
|------|---------|
| `src/lib/system-manifest/index.ts` | Build manifest, fix history, system map |
| `src/lib/system-manifest/page-guides.ts` | How-it-works config per page |
| `src/lib/export-fallback.ts` | 3-tier data fallback system |
| `src/components/workspace/WorkspaceCanvas.tsx` | 28 EHR panel workspace |
| `src/app/api/cron-export/route.ts` | Daily auto-sync (6AM UTC) |
| `src/app/api/system-health/route.ts` | Health check API |
| `CONTRIBUTING.md` | Full development rules |

## Architecture
- **Auth**: Supabase Auth with `authFetch` wrapper for API calls
- **EHR**: DrChrono API integration with local Supabase mirror
- **Offline**: Dexie/IndexedDB patient cache with 30-min sync interval
- **Layout**: Collapsible sidebar with Ctrl+K patient search, keyboard nav (G+D/A/P/S)
- **Panels**: react-grid-layout workspace with 28 EHR panels
