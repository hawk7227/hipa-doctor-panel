# DrChrono Integration — Setup Guide

## What This Does
- Adds a **DrChrono** button to the AppointmentDetailModal toolbar (alongside Med Hx, Orders, Rx Hx, etc.)
- When clicked, opens a slide-in overlay panel that:
  - Searches DrChrono patients (auto-populates with current appointment's patient name)
  - Shows demographics, medications, appointments, problems, allergies
  - Lets doctor **Send eRx** via DrChrono's certified EPCS popup
  - Export any tab to XLSX
- All data is live from DrChrono API — **nothing stored in Supabase except OAuth tokens**

## File Placement (14 files)

| Source File | Copy To |
|---|---|
| `AppointmentDetailModal.tsx` | `src/components/AppointmentDetailModal.tsx` (REPLACE existing) |
| `components/DrChronoOverlay.tsx` | `src/components/DrChronoOverlay.tsx` (NEW) |
| `lib/drchrono.ts` | `src/lib/drchrono.ts` (NEW) |
| `api/drchrono/auth/route.ts` | `src/app/api/drchrono/auth/route.ts` (NEW) |
| `api/drchrono/callback/route.ts` | `src/app/api/drchrono/callback/route.ts` (NEW) |
| `api/drchrono/test/route.ts` | `src/app/api/drchrono/test/route.ts` (NEW) |
| `api/drchrono/patients/route.ts` | `src/app/api/drchrono/patients/route.ts` (NEW) |
| `api/drchrono/medications/route.ts` | `src/app/api/drchrono/medications/route.ts` (NEW) |
| `api/drchrono/appointments/route.ts` | `src/app/api/drchrono/appointments/route.ts` (NEW) |
| `api/drchrono/problems/route.ts` | `src/app/api/drchrono/problems/route.ts` (NEW) |
| `api/drchrono/allergies/route.ts` | `src/app/api/drchrono/allergies/route.ts` (NEW) |
| `api/drchrono/export/route.ts` | `src/app/api/drchrono/export/route.ts` (NEW) |
| `sql/drchrono-migration.sql` | Run in Supabase SQL Editor (NEW) |

## Step 1: Install ExcelJS
```bash
npm install exceljs
```

## Step 2: Environment Variables (Vercel)
Add to Vercel → Settings → Environment Variables:
```
DRCHRONO_CLIENT_ID=sHdA5PTHZfxzXjNLU01Pk8245RlNRxomxjtDc7fJ
DRCHRONO_CLIENT_SECRET=ibTnnNGWRBhsER6cOPB0zl1iAsUqUGQmDrFZuzZl26Em4l96TTzum18Ky289ouuCUrAwZrB4TQUXu58yOxkSOY9kHgnIDAvFmHnp1X4iyUlaTfXG2OlKMLTr0fywtwpH
DRCHRONO_REDIRECT_URI=https://doctor.medazonhealth.com/api/drchrono/callback
DRCHRONO_SCOPES=user:read user:write calendar:read calendar:write patients:read patients:write patients:summary:read patients:summary:write billing:read billing:write clinical:read clinical:write labs:read labs:write
```

## Step 3: Run Database Migration
In Supabase SQL Editor, run `sql/drchrono-migration.sql`

## Step 4: Update DrChrono Redirect URI
In DrChrono API Management console:
1. Remove old redirect URIs
2. Add: `https://doctor.medazonhealth.com/api/drchrono/callback`

## Step 5: Deploy & Connect
1. Push all files to GitHub
2. Let Vercel build
3. Visit: `https://doctor.medazonhealth.com/api/drchrono/auth`
4. Authorize with DrChrono credentials
5. Open any appointment → click **DrChrono** button in toolbar → overlay opens

## What Changed in AppointmentDetailModal.tsx
Only 5 minimal additions (no removals, no refactoring):
1. Added `Stethoscope` to lucide-react imports
2. Added `import DrChronoOverlay from './DrChronoOverlay'`
3. Added `{ id: 'drchrono', label: 'DrChrono', icon: Stethoscope, ... }` to EHR_PANELS array
4. Added `const [showDrChronoOverlay, setShowDrChronoOverlay] = useState(false)` state
5. Added `case 'drchrono': setShowDrChronoOverlay(v => !v); break` to handler
6. Added `<DrChronoOverlay ... />` rendering at the bottom

## Data Flow
```
Doctor clicks DrChrono → Overlay opens → Auto-searches patient name
                                          ↓
DrChrono API ──HTTPS──→ Next.js API Routes ──JSON──→ Overlay tabs
                                                       ↓
                                            Send eRx → DrChrono popup (EPCS certified)
                                            Export   → XLSX download
```
