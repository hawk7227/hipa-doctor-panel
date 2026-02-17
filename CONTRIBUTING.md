# ⚠️ MANDATORY: READ BEFORE MAKING ANY CHANGES ⚠️

## Medazon Health — Development Rules

This codebase is **self-documenting and self-protecting**. Every file contains build history and fix records. Before modifying ANY file:

### 1. READ THE BUILD MANIFEST FIRST
**Location:** `src/lib/system-manifest/index.ts`

This file contains:
- `FIX_HISTORY` — Every bug fix with symptoms, root cause, and solution
- `SYSTEM_MAP` — Every page, API, panel, and how they connect
- `HEALTH_CHECKS` — Automated checks for system integrity

### 2. CHECK FILE HEADERS
Every file has a `@build-manifest` header pointing to the manifest. Read it.

### 3. CHECK FILE FOOTERS
Critical files have `BUILD_HISTORY` comments at the bottom documenting what was built, fixed, and when.

### 4. BEFORE CHANGING CODE
- [ ] Read `CONTRIBUTING.md` (this file)
- [ ] Read `src/lib/system-manifest/index.ts`
- [ ] Read the target file's header and footer comments
- [ ] Understand what the file connects to (check SYSTEM_MAP)
- [ ] Check if there are known fixes (check FIX_HISTORY)
- [ ] After making changes, UPDATE the file's BUILD_HISTORY footer
- [ ] After fixing a bug, ADD a new entry to FIX_HISTORY in the manifest

### 5. KNOWN CRITICAL RULES
- **NEVER DELETE FILES OR CODE** — Do not remove, rename, or delete any file or code without explicit written permission from the project owner (Marcus). This includes comments, console.logs, imports, unused functions, and "dead code". If you think something should be removed, ASK FIRST and wait for approval.
- **MINIMAL CHANGES** — Fix X = only X. Never remove code/comments/logs.
- **RLS is DISABLED** on all drchrono_* tables — DO NOT re-enable
- **Interface names MUST match DB columns** (created_at not createdAt)
- **All panel APIs** use `/api/panels/{endpoint}` with `usePanelData` hook
- **3-tier fallback**: Live DrChrono → Supabase export → Static JSON
- **draggableHandle** not dragConfig for react-grid-layout
- **Service role key** for all server-side Supabase queries
- **Export uses /api/cron-export** server-side, NOT browser upload

### 6. DATA COUNTS (expected minimums)
- Patients: 6,968+
- Medications: 20,132+
- Allergies: 620+
- Problems: 1,401+
- Appointments: 263+

### 7. KEY FILES
| File | Purpose |
|------|---------|
| `src/lib/system-manifest/index.ts` | Build manifest, fix history, system map |
| `src/lib/system-manifest/page-guides.ts` | How-it-works config per page |
| `src/lib/export-fallback.ts` | 3-tier data fallback system |
| `src/components/workspace/WorkspaceCanvas.tsx` | 28 EHR panel workspace |
| `src/components/appointment/sections/ToolbarButtons.tsx` | EHR toolbar config |
| `src/app/api/cron-export/route.ts` | Daily auto-sync (6AM UTC) |
| `src/app/api/system-health/route.ts` | Health check API |
| `src/lib/system-manifest/create-tables.sql` | SQL for health log tables |
| `CONTRIBUTING.md` | This file — read first |

### 8. FOR AI AGENTS
If you are an AI assistant (Claude, GPT, Copilot, etc):
1. You MUST read `src/lib/system-manifest/index.ts` before making changes
2. You MUST read the target file's BUILD_HISTORY comments
3. You MUST update BUILD_HISTORY after making changes
4. You MUST add new fixes to FIX_HISTORY in the manifest
5. You MUST NOT proceed until you confirm you have read the above
6. You MUST NOT delete, remove, or rename any file or code without explicit permission from Marcus
7. You MUST NOT remove comments, console.logs, imports, or "unused" code — if you think it should go, ASK FIRST
8. If you think changes beyond the request are needed, STOP and ASK before making them
9. When fixing a bug: fix ONLY that bug. Do not "clean up" or "refactor" surrounding code
