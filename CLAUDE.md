<!-- @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file. -->
<!-- @see CONTRIBUTING.md for mandatory development rules. -->
<!-- ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner. -->
<!-- ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports. -->
# CLAUDE.md — Medazon Health Doctor Panel

## Project Overview
Next.js 16 (TypeScript) doctor panel for Medazon Health. Uses Supabase (auth + DB), Stripe billing, Twilio voice, and Dexie (IndexedDB) for offline-first caching. Enterprise medications system with audit logging.

## Quick Start
```bash
npm run dev        # Start dev server (webpack mode)
npm run build      # Production build (4GB heap)
npm run start      # Start production server
npm run test:e2e   # Run Playwright E2E tests
```

## Mandatory Development Rules
**Read `CONTRIBUTING.md` and `src/lib/system-manifest/index.ts` BEFORE modifying any file.**

1. **NEVER delete files, code, comments, console.logs, or imports** without explicit permission from Marcus
2. **Minimal changes only** — fix only what is requested, do not refactor surrounding code
3. Every file has a `@build-manifest` header — read it before editing
4. After changes, update the file's `BUILD_HISTORY` footer and add fixes to `FIX_HISTORY` in the manifest
5. Interface names must match DB columns (`created_at` not `createdAt`)
6. All panel APIs use `/api/panels/{endpoint}` with `usePanelData` hook
7. Use `draggableHandle` (not `dragConfig`) for react-grid-layout
8. Use service role key for all server-side Supabase queries
9. Export uses `/api/cron-export` server-side, NOT browser upload

## Testing
**E2E tests use Playwright** (`e2e/` directory).

```bash
npm run test:e2e                    # Run all E2E tests
npx playwright test smoke           # Run smoke tests only
npx playwright test --headed        # Run with visible browser
npx playwright show-report          # View last test report
```

### Testing Rules
1. All new pages must be added to `DOCTOR_PAGES` in `e2e/helpers/test-utils.ts`
2. All new sidebar links must be added to `NAV_ITEMS` or `ADMIN_ITEMS` in `test-utils.ts`
3. All new API routes must be added to `API_ROUTES` in `test-utils.ts`
4. E2E tests require `E2E_DOCTOR_EMAIL` and `E2E_DOCTOR_PASSWORD` env vars for auth
5. API health tests verify no route returns HTTP 500

### Test Files
| File | What it tests |
|------|---------------|
| `e2e/smoke.spec.ts` | All 31 doctor pages load without crashing |
| `e2e/navigation.spec.ts` | Every sidebar link + keyboard shortcuts |
| `e2e/patient-search.spec.ts` | Ctrl+K modal, search, action picker |
| `e2e/patients-page.spec.ts` | Stats cards, patient table, pagination |
| `e2e/medications.spec.ts` | Medications API CRUD + UI |
| `e2e/api-health.spec.ts` | 20 API routes don't return 500 |

## Key Files
| File | Purpose |
|------|---------|
| `src/lib/system-manifest/index.ts` | Build manifest, fix history, system map |
| `src/lib/system-manifest/page-guides.ts` | How-it-works config per page |
| `src/lib/export-fallback.ts` | Data fallback system |
| `src/components/workspace/WorkspaceCanvas.tsx` | 28 EHR panel workspace |
| `src/app/api/medications/route.ts` | Enterprise medications API |
| `src/app/api/cron-export/route.ts` | Daily auto-sync (6AM UTC) |
| `src/app/api/system-health/route.ts` | Health check API |
| `src/hooks/useMedications.ts` | Offline-first medications hook |
| `playwright.config.ts` | E2E test configuration |
| `CONTRIBUTING.md` | Full development rules |

## Architecture
- **Auth**: Supabase Auth with `authFetch` wrapper for API calls
- **Medications**: Enterprise API (`/api/medications`) with audit logging, offline-first Dexie cache
- **Offline**: Dexie/IndexedDB patient cache with sync engine
- **Layout**: Collapsible sidebar with Ctrl+K patient search, keyboard nav (G+D/A/P/S)
- **Panels**: react-grid-layout workspace with 28 EHR panels
- **CI**: GitHub Actions runs Playwright E2E tests on push/PR
