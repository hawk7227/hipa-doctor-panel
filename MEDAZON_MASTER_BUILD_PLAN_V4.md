# MEDAZON HEALTH — MASTER BUILD PLAN V4.0 (NEW-CHAT-READY)
## Enterprise Workspace Architecture, Chart Management, Roles, Logging & Complete Codebase Reference
### LOCKED — February 14, 2026

---

## ⚠️ BUILD RULES (NON-NEGOTIABLE)

1. **Run `npx next build` after every file you create** — verify it compiles
2. **Fix ALL TypeScript errors, missing imports, and build failures BEFORE giving the file**
3. **Only deliver files that compile clean** — zero errors
4. **MINIMAL CHANGES** — fix X = only X, add Y = only Y. NEVER remove comments/logs/unused code, refactor, rename, or change formatting unless explicitly asked
5. **PRE-DELIVERY** — Re-read file with view tool (don't trust memory), verify imports → handlers → data flow → error states. Fix issues BEFORE saying done
6. **ERROR HANDLING** — Every async op needs: loading state + spinner, error state + UI message + details, success state, empty state, console.log for debug
7. **DATA INTEGRITY** — Interface/type fields MUST match API/DB exactly. Trace: source → type → destructure → access → render. Optional chaining for nullable
8. **SYNTAX CHECK** — Balanced brackets/braces/parens, closed strings/templates, closed JSX tags, complete ternaries
9. **If something else should change beyond the request → ASK FIRST, explain why, wait for approval**
10. **ALL builds must be ENTERPRISE LEVEL** — production-quality, HIPAA-compliant, scalable, no shortcuts
11. **NO SHELLS OR PLACEHOLDERS** — Every component ships fully structured. Every card in a grid must have identical internal structure (icon → title → description → button). Buttons always align to bottom. No mismatched heights, no missing elements, no "we'll fix it later". If a page has real sections, they must have real layout even before data is wired. Every grid row is visually uniform.
12. **COMPONENT STRUCTURE PARITY** — Every item in a repeating group (grid cards, list rows, table rows, tab panels) must have identical DOM structure. Same elements in the same order. If one card has an icon, ALL cards have an icon. No exceptions.
13. **VERTICAL RHYTHM ALIGNMENT** — Use `flex flex-col` + `flex-1` on variable-height content + `mt-auto` on bottom elements. This guarantees titles align with titles, descriptions align with descriptions, and buttons align with buttons across every row, regardless of content length.
14. **CONTENT-AGNOSTIC LAYOUT** — Layout must not break with short text, long text, empty states, or overflow. Always test: what happens with 2 words? What happens with 20 words? Truncate with `line-clamp` or `truncate` where needed. Never rely on content being a specific length.
15. **PRE-PUSH VISUAL AUDIT** — Before pushing any UI change, mentally walk through every repeating group on the affected page. Ask: "Do all items in this group have identical structure? Are all bottom edges aligned? Would a longer title break this?" Fix before push, not after.
16. **NO PATCHING BUGGY CODE** — Never patch, hotfix, or add lines on top of broken infrastructure. If the existing code is buggy, monolithic, uses inline styles, or has structural problems — REBUILD IT PROPERLY from scratch at enterprise level, mobile-first. The old code gets backed up and replaced, not bandaged.
17. **DELIGHTFUL EXTRAS (disabled by default)** — Fun features like confetti, sound effects, particle animations, and colorful welcome popups are welcome BUT must be: (a) disabled by default, (b) toggled via a Settings/Preferences control, (c) built as isolated modules that don't touch core logic, (d) never block or obscure functional UI.

---

## 🏗️ CURRENT ENVIRONMENT (EXACT)

### package.json
```json
{
  "name": "doctor-panel",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --webpack",
    "build": "cross-env NODE_OPTIONS=--max-old-space-size=4096 next build --webpack",
    "start": "next start"
  },
  "dependencies": {
    "@daily-co/daily-js": "^0.85.0",
    "googleapis": "^144.0.0",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toast": "^1.2.15",
    "@stripe/stripe-js": "^8.1.0",
    "pdf-lib": "^1.17.1",
    "@supabase/auth-helpers-nextjs": "^0.10.0",
    "@supabase/ssr": "^0.7.0",
    "@supabase/supabase-js": "^2.75.0",
    "@twilio/voice-sdk": "^2.16.0",
    "@types/nodemailer": "^7.0.2",
    "@zoom/meetingsdk": "^5.0.4",
    "@zoomus/websdk": "^2.18.3",
    "axios": "^1.12.2",
    "exceljs": "^4.4.0",
    "jsonwebtoken": "^9.0.2",
    "lucide-react": "^0.545.0",
    "next": "^16.0.7",
    "nodemailer": "^7.0.9",
    "openai": "^4.104.0",
    "pnpm": "^10.28.0",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "socket.io-client": "^4.8.1",
    "stripe": "^19.1.0",
    "twilio": "^5.10.4",
    "web-push": "^3.6.7"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/web-push": "^3.6.4",
    "cross-env": "^7.0.3",
    "lightningcss": "^1.30.2",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

### NEW DEPENDENCIES TO INSTALL (Phase A)
```bash
npm install react-grid-layout @types/react-grid-layout
```

### Next.js Version: 16.0.7 (App Router, Webpack mode)
### React Version: 19.1.0
### Tailwind CSS: v4 (with @tailwindcss/postcss)
### TypeScript: ^5, strict mode
### Path alias: `@/*` → `./src/*`

### Build command: `cross-env NODE_OPTIONS=--max-old-space-size=4096 next build --webpack`

### Environment Variables (all must exist in .env.local or Vercel):
```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID
OPENAI_API_KEY, OPENAI_PROMPT_ID
DAILY_API_KEY
DRCHRONO_CLIENT_ID, DRCHRONO_CLIENT_SECRET, DRCHRONO_REDIRECT_URI, DRCHRONO_SCOPES
GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI
NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL
NEXT_PUBLIC_ZOOM_SDK_KEY, ZOOM_SDK_SECRET, ZOOM_API_KEY, ZOOM_API_SECRET, ZOOM_ACCOUNT_ID, ZOOM_USER_ID
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE, SMTP_PASSWORD
NEXT_PUBLIC_APP_URL
```

---

## 🎨 DESIGN SYSTEM (EXACT COLORS & PATTERNS)

### Global Theme (from globals.css)
```css
--background: #0a0a0a;
--foreground: #ededed;
--card: #1a1a1a;
--primary: #ef4444;
--secondary: #262626;
--muted: #262626;
--muted-foreground: #a3a3a3;
--border: #404040;
--ring: #ef4444;
```

### Dashboard Theme (from dashboard/page.tsx)
```
Page background: bg-[#0a1f1f]
Card background: bg-[#0d2626]
Card border: border-[#1a3d3d]
Hover card: bg-[#164e4e]
Active/selected: bg-[#164e4e] border-[#1a5a5a]
Welcome gradient: from-teal-600/20 to-teal-500/20
Avatar circle: bg-teal-500 with bg-teal-400 inner
Text primary: text-white
Text secondary: text-gray-400, text-gray-300
Text accent: text-teal-400
```

### Dashboard Button Styles
```
Teal action:    bg-teal-400 hover:bg-teal-500 text-[#0a1f1f] font-bold rounded-lg
Pink action:    bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-lg
Blue action:    bg-blue-400 hover:bg-blue-500 text-[#0a1f1f] font-bold rounded-lg
Blue secondary: bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg
```

### Stats Card Pattern
```
Container: bg-[#0d2626] rounded-lg p-4 sm:p-6 border border-[#1a3d3d]
Icon box: w-10 h-10 sm:w-12 sm:h-12 bg-{color}-500/20 rounded-lg
Icon: w-5 h-5 sm:w-6 sm:h-6 text-{color}-400
Label: text-xs sm:text-sm text-gray-400 mb-1
Value: text-2xl sm:text-3xl font-bold text-white
```

### Sidebar Navigation (from layout.tsx)
```
Sidebar: fixed left-0 top-0 h-screen w-64 bg-[#0d2626] border-r border-[#1a3d3d]
Active link: bg-[#164e4e] text-white font-medium
Inactive link: text-gray-300 hover:bg-[#164e4e]
Main content: lg:ml-64
```

### EHR Toolbar Panel Colors (EXACT from AppointmentDetailModal.tsx)
```javascript
{ id: 'medication-history', label: 'Med Hx',     icon: Pill,           color: '#a855f7', hover: 'hover:bg-purple-700' }
{ id: 'orders',             label: 'Orders',      icon: ClipboardList,  color: '#3b82f6', hover: 'hover:bg-blue-700' }
{ id: 'prescription-history', label: 'Rx Hx',     icon: FileText,       color: '#14b8a6', hover: 'hover:bg-teal-700' }
{ id: 'appointments',       label: 'Appts',       icon: CalendarDays,   color: '#f97316', hover: 'hover:bg-orange-700' }
{ id: 'allergies',          label: 'Allergy',      icon: AlertTriangle,  color: '#ef4444', hover: 'hover:bg-red-700' }
{ id: 'vitals',             label: 'Vitals',       icon: Activity,       color: '#06b6d4', hover: 'hover:bg-cyan-700' }
{ id: 'medications',        label: 'Meds',         icon: Pill,           color: '#10b981', hover: 'hover:bg-emerald-700' }
{ id: 'demographics',       label: 'Demo',         icon: User,           color: '#64748b', hover: 'hover:bg-slate-700' }
{ id: 'problems',           label: 'Problems',     icon: AlertCircle,    color: '#f97316', hover: 'hover:bg-orange-700' }
{ id: 'clinical-notes',     label: 'Notes',        icon: FileText,       color: '#3b82f6', hover: 'hover:bg-blue-700' }
{ id: 'lab-results-panel',  label: 'Labs',         icon: FlaskConical,   color: '#06b6d4', hover: 'hover:bg-cyan-700' }
{ id: 'immunizations',      label: 'Immun',        icon: Syringe,        color: '#10b981', hover: 'hover:bg-emerald-700' }
{ id: 'documents',          label: 'Docs',         icon: FolderOpen,     color: '#f59e0b', hover: 'hover:bg-amber-700' }
{ id: 'family-history',     label: 'Fam Hx',       icon: Users,          color: '#f43f5e', hover: 'hover:bg-rose-700' }
{ id: 'social-history',     label: 'Social',       icon: Wine,           color: '#f59e0b', hover: 'hover:bg-amber-700' }
{ id: 'surgical-history',   label: 'Surg Hx',      icon: Scissors,       color: '#ef4444', hover: 'hover:bg-red-700' }
{ id: 'pharmacy',           label: 'Pharmacy',     icon: Building2,      color: '#14b8a6', hover: 'hover:bg-teal-700' }
{ id: 'care-plans',         label: 'Care Plan',    icon: ClipboardCheck, color: '#a855f7', hover: 'hover:bg-purple-700' }
{ id: 'billing',            label: 'Billing',      icon: DollarSign,     color: '#10b981', hover: 'hover:bg-emerald-700' }
{ id: 'comm-hub',           label: 'Comms',        icon: MessageSquare,  color: '#3b82f6', hover: 'hover:bg-blue-700' }
{ id: 'lab-results-inline', label: 'Lab Orders',   icon: FlaskConical,   color: '#0ea5e9', hover: 'hover:bg-sky-700' }
{ id: 'referrals-followup', label: 'Referrals',    icon: ArrowRight,     color: '#f97316', hover: 'hover:bg-orange-700' }
{ id: 'prior-auth',         label: 'Prior Auth',   icon: ClipboardCheck, color: '#8b5cf6', hover: 'hover:bg-violet-700' }
{ id: 'chart-management',   label: 'Chart',        icon: Shield,         color: '#a855f7', hover: 'hover:bg-purple-700' }
{ id: 'drchrono-erx',       label: 'eRx',          icon: Stethoscope,    color: '#22c55e', hover: 'hover:bg-green-700' }
```

### Toolbar Active Panel Indicators (NEW)
```
Active dot: 6px circle, position absolute top-right of button, background = panel color
Active underline: 2px height bar below button, background = panel color, box-shadow: 0 0 8px {color}50
Both disappear when panel is closed
Implemented via CSS pseudo-elements (::after for underline, span for dot)
```

---

## 📁 FILE STRUCTURE (EXISTING)

### Key Files
```
src/app/doctor/dashboard/page.tsx          — 619 lines, doctor dashboard
src/app/doctor/appointments/page.tsx       — Full-screen week calendar
src/app/doctor/layout.tsx                  — Sidebar navigation layout
src/components/AppointmentDetailModal.tsx   — 7100 lines, appointment workspace
src/components/ChartManagementPanel.tsx     — 281 lines, existing chart panel
src/lib/supabase.ts                        — Client-side Supabase (anon key)
src/lib/supabaseAdmin.ts                   — Server-side Supabase (service role)
src/lib/auth.ts                            — getCurrentUser(), AuthUser interface
src/lib/generateClinicalNotePDF.ts         — PDF generation with pdf-lib
src/lib/drchrono.ts                        — DrChrono OAuth + API wrapper
```

### Existing Panel Components (with line counts)
```
AllergiesPanel.tsx (852), AppointmentsOverlayPanel.tsx (1040), BillingPanel.tsx (144),
CarePlansPanel.tsx (193), ChartFileUpload.tsx (283), ChartManagementPanel.tsx (281),
ClinicalNotesPanel.tsx (151), DemographicsPanel.tsx (262), DocumentsPanel.tsx (118),
HistoryPanels.tsx (245), ImmunizationsPanel.tsx (163), LabResultsPanel.tsx (183),
MedicationHistoryPanel.tsx (1130), MedicationsPanel.tsx (997), OrdersPanel.tsx (1268),
PharmacyPanel.tsx (200), PrescriptionHistoryPanel.tsx (1427), ProblemsPanel.tsx (233),
VitalsPanel.tsx (1004), UnifiedCommHub.tsx (999)
```

### Existing API Routes
```
/api/chart/sign, /api/chart/close, /api/chart/unlock, /api/chart/addendum, /api/chart/pdf
/api/drchrono/auth, /api/drchrono/callback, /api/drchrono/bulk-sync, /api/drchrono/sync-status
/api/drchrono/patients, /api/drchrono/medications, /api/drchrono/allergies, /api/drchrono/problems
/api/communication/twilio-token, /api/communication/sms, /api/communication/call
/api/prescriptions, /api/clinical-notes, /api/appointments/*
```

### Auth Pattern (MUST follow)
```typescript
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// In component:
const authUser = await getCurrentUser()
if (!authUser || !authUser.doctor) { /* redirect or error */ }
const doctor = authUser.doctor // has doctor.id, doctor.email, doctor.first_name, etc.
```

### Supabase Query Pattern (MUST follow)
```typescript
// Client-side (components):
import { supabase } from '@/lib/supabase'
const { data, error } = await supabase.from('table').select('*').eq('doctor_id', doctor.id)

// Server-side (API routes):
import { supabaseAdmin } from '@/lib/supabaseAdmin'
const { data, error } = await supabaseAdmin.from('table').select('*')
```

---

## 🏥 WHAT TO BUILD

### DASHBOARD ADDITIONS (2 new buttons + 2 new action cards)

**In the Action Buttons row** (after "Open Calendar" button), add:
```
Button: "Manage Staff" — bg-amber-500 hover:bg-amber-600 text-white font-bold → navigates to /doctor/settings/staff
Button: "Chart Management" — bg-purple-500 hover:bg-purple-600 text-white font-bold → navigates to /doctor/chart-management
```

**In the Action Cards grid** (add 2 more cards making it a 5-card grid at lg), add:
```
Card: "Staff Management" — description "Add assistants, manage permissions, view activity logs."
  Button: bg-amber-500 hover:bg-amber-600 text-white → Link to /doctor/settings/staff → "Manage ▸"
  Icon: Users (lucide-react) text-amber-400, icon bg: bg-amber-500/20

Card: "Chart Management" — description "Sign notes, close charts, manage addendums, audit trail."  
  Button: bg-purple-500 hover:bg-purple-600 text-white → Link to /doctor/chart-management → "Open ▸"
  Icon: Shield (lucide-react) text-purple-400, icon bg: bg-purple-500/20
```

**Both accessible to provider ONLY — not assistants** (enforce via role check in the page components)

### SIDEBAR ADDITIONS (in layout.tsx)
Add two new links after "Availability":
```
Staff Management → /doctor/settings/staff (provider only — hide for assistants)
Chart Management → /doctor/chart-management (provider only — hide for assistants)
```

---

## 📋 ENTERPRISE CHART LIFECYCLE (5-STATE)

### States: Draft → Preliminary → Final (Signed) → Closed → Amended

| State | Who Can Edit | SOAP | Primary Action | PDF |
|---|---|---|---|---|
| Draft | Provider, Assistant | Editable | Submit for Review (assistant) / Sign (provider) | No |
| Preliminary | Provider only | Provider can edit | Cosign & Finalize | No |
| Final (Signed) | Nobody | Read-only | Close Chart | No |
| Closed | Nobody | Read-only | View PDF / + Addendum | Yes |
| Amended | Addendum only | Read-only + addendums | View PDF / + Addendum | Yes (multi-page) |

### Timeliness
- 24hr warning badge if note not signed
- 48hr non-compliance red flag
- Auto-escalation alert to provider

### Three Amendment Types
- **Late Entry** — omitted info, bears current date, requires total recall
- **Addendum** — new info not available at original time, bears current date + reason
- **Correction** — error in original, must show BOTH original + corrected side-by-side, original never deleted

---

## 👥 ROLE-BASED ACCESS CONTROL

### Roles: Provider | Assistant/Scribe/MA | Admin/Billing

| Action | Provider | Assistant | Admin |
|---|---|---|---|
| Write/edit SOAP (Draft) | ✅ | ✅ | ❌ |
| Submit as Preliminary | N/A | ✅ | ❌ |
| Sign chart → Final | ✅ | ❌ | ❌ |
| Cosign assistant notes | ✅ | ❌ | ❌ |
| Close chart → PDF | ✅ | ❌ | ❌ |
| Unlock chart | ✅ (reason req) | ❌ | ❌ |
| Add addendum | ✅ (self-signed) | ✅ (req cosign) | ❌ |
| Prescribe (eRx) | ✅ | ❌ | ❌ |
| Place orders | ✅ | ❌ | ❌ |
| Pend orders | ✅ | ✅ | ❌ |
| Manage staff | ✅ | ❌ | ❌ |
| View audit trail | ✅ | Own actions only | ❌ |
| Access /doctor/settings/staff | ✅ | ❌ | ❌ |
| Access /doctor/chart-management | ✅ | ❌ | ❌ |

---

## 🗄️ NEW SUPABASE TABLES

### practice_staff
```sql
CREATE TABLE practice_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('assistant', 'scribe', 'ma', 'billing_admin')),
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  permissions JSONB,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### doctor_workspace_layouts
```sql
CREATE TABLE doctor_workspace_layouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  layout_desktop JSONB,
  layout_tablet JSONB,
  layout_mobile JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### audit_logs (IMMUTABLE — INSERT ONLY)
```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  event_category TEXT NOT NULL CHECK (event_category IN ('auth', 'access', 'change', 'admin')),
  event_type TEXT NOT NULL,
  user_id UUID NOT NULL,
  user_role TEXT NOT NULL,
  user_email TEXT NOT NULL,
  patient_id UUID,
  appointment_id UUID,
  resource_type TEXT,
  resource_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('create','read','update','delete','sign','cosign','submit','pend','approve','login','logout')),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IMMUTABLE: No update or delete
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_patient ON audit_logs(patient_id);
CREATE INDEX idx_audit_logs_category ON audit_logs(event_category);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

---

## 📅 CALENDAR ENTERPRISE UPGRADE

### Current State (already built)
- Week view with time slots (5am-8pm, 30-min slots)
- Month view (basic)
- List view toggle
- Appointment chips show: patient name, visit type badge (VIDEO/PHONE/ASYNC), reason (2 words)
- 🔒 Lock icon on chip when `chart_locked === true` (gold, top-right)
- ✓ Checkmark on chip when `status === 'completed' && !chart_locked` (green, top-right)
- Click appointment → opens AppointmentDetailModal (7100 lines, stays as-is)
- Click empty slot → opens CreateAppointmentDialog
- ViewType: `'calendar' | 'list'`
- CalendarViewType: `'week' | 'month' | '3month'`

### What to ADD (enterprise upgrade, matching DrChrono level)

**1. Hover Preview Popup (NEW — does NOT replace click behavior)**
- `onMouseEnter` on appointment chip → shows floating popup after 300ms delay
- `onMouseLeave` → hides popup (with 150ms grace period for moving to popup)
- Popup shows:
  - Patient name (bold, white), gender, DOB
  - Provider: "LaMonica Hodges" (or assigned provider)
  - Time: "09:30 AM for 15 minutes" (calculate from slot duration)
  - Date: "Monday February 09"
  - Visit type badge (colored)
  - Chart status badge: Draft (gray) | Preliminary (amber) | Signed (green) | Closed (blue) | Amended (purple)
  - Chief complaint (first 50 chars)
- Popup position: smart anchor (prefer right of chip, flip left if near edge, flip up if near bottom)
- Style: `bg-[#0d2626] border border-[#1a3d3d] rounded-xl shadow-2xl p-4 min-w-[280px] max-w-[360px] z-50`
- Click still opens AppointmentDetailModal (existing behavior UNCHANGED)

**2. Calendar Chip Status Indicators (UPGRADE existing)**
Map 5-state chart lifecycle to chip visuals:
```
Draft:        No icon (default state)
Preliminary:  ⏳ amber icon top-right (pending cosign)
Final/Signed: ✓ green checkmark top-right (already exists for 'completed')
Closed:       🔒 gold lock top-right (already exists for chart_locked)
Amended:      🔒✎ lock + pencil icon (amended after close)
```
- Add `chart_status` field to appointment query (new column or derive from chart_locked + status)
- Color-code the chip left border by chart status:
  - Draft: `border-l-4 border-gray-500`
  - Preliminary: `border-l-4 border-amber-500`
  - Signed: `border-l-4 border-green-500`
  - Closed: `border-l-4 border-blue-500`
  - Amended: `border-l-4 border-purple-500`

**3. Mini Calendar Widget (NEW)**
- Small month grid in top-left or sidebar area
- Clickable dates → jumps calendar to that date
- Current date highlighted (red/orange like DrChrono)
- Dates with appointments get a dot indicator
- Month/year dropdown pickers
- Arrow buttons for prev/next month
- Style: matches dashboard theme `bg-[#0d2626] border-[#1a3d3d]`

**4. View Toggles (UPGRADE existing)**
- Current: Week | Month | List buttons
- Add: **Daily** view (single day, full time column, all appointments stacked)
- Keep existing Week and Month views
- Add **Provider** filter toggle (for multi-provider/assistant views)
- Button style: matches existing toggle buttons in calendar toolbar

**5. Calendar Toolbar Enhancement**
- Add: + Event button (same as clicking empty slot)
- Add: Today button (already exists, keep)
- Add: Refresh button (re-fetch appointments)
- Add: Print Appts button (already exists, keep)
- Toolbar style: thin bar, matches existing calendar header

### What stays UNCHANGED
- Click appointment → AppointmentDetailModal opens (all 7100 lines, all 25 panels)
- Click empty slot → CreateAppointmentDialog opens
- Week view layout and time slot structure
- Visit type color coding (video=green, phone=amber, async=blue, instant=purple)
- Current time indicator (orange "◀ NOW")
- Sound effects (hover + click sounds)

---

## 🚨 ARCHITECTURE PROBLEMS TO FIX (FOUND IN AUDIT)

### CRITICAL — Security & HIPAA

**1. 37 API routes have NO authentication check**
Routes like `/api/appointments/accept`, `/api/clinical-notes`, `/api/prescriptions-fast`, `/api/drchrono/*`, `/api/twilio/token` can be called by anyone without verifying identity. This is a HIPAA violation — every route that touches PHI must verify the caller.
- FIX (Phase G): Add auth middleware to ALL API routes. Create `src/lib/apiAuth.ts` that wraps every handler with `getCurrentUser()` + role check. No exceptions.

**2. Direct Supabase calls in 20+ client components bypass audit logging**
Components like DrChronoOverlay (10 calls), MedazonScribe (8), CommunicationDialer (8), ChartFileUpload (6) query Supabase directly, bypassing any audit trail.
- FIX (Phase I): Route all data access through API routes that include AuditLogger middleware. Client components should only use `fetch('/api/...')`.

**3. No React Error Boundaries anywhere**
If any panel throws a JavaScript error, the entire workspace crashes. No graceful degradation.
- FIX (Phase F): Add `<ErrorBoundary>` wrapper around each panel, the workspace, and the calendar. Each shows a "Something went wrong" fallback with retry button instead of white screen.

### HIGH — State & Navigation

**4. URL doesn't reflect workspace state (the refresh bug)**
Appointment workspace is a modal — URL stays `/doctor/appointments` regardless of which patient chart is open. Browser refresh, back button, deep-linking all broken.
- FIX (Phase C): Use URL query params or dynamic route `/doctor/appointments/[appointmentId]`. Workspace reads appointment ID from URL on mount. Refresh works. Deep-links work. Back button closes workspace.

**5. 60 useState booleans in one 7,100-line component**
AppointmentDetailModal has 60 useState calls managing 25 panel open/close states, chart status, loading states, form fields — all in a single component. Impossible to maintain, debug, or test.
- FIX (Phase A): Workspace State Manager (React context + useReducer) replaces all 25 panel booleans with `dispatch({ type: 'OPEN_PANEL', id: 'allergies' })`. Chart state managed centrally. Each panel becomes a self-contained component.

**6. No React.memo on ANY of the 40+ components**
Every parent re-render cascades into every child. Opening one panel re-renders all 25 panels.
- FIX (Phase E): `React.memo` on every panel component. Workspace State Manager provides stable references via `useCallback` and `useMemo`.

### MEDIUM — Data & Performance

**7. Prop drilling the same patient data into 25+ panels**
Every panel receives `patientId`, `patientName`, `appointmentId` as props. The patient name is reconstructed with the same template literal 25 times: `` `${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient' ``
- FIX (Phase A): `WorkspaceContext` provides `patient`, `appointment`, `doctor` to all panels. Panels read from context, zero prop drilling.

**8. No abort controllers on 12+ fetch calls**
If user closes a panel or navigates away while a fetch is in flight, the response callback fires on an unmounted component. Causes React state-update-on-unmounted warnings and potential data corruption.
- FIX (Phase D): All fetch calls use `AbortController`. Cleanup in useEffect return. Pattern: `const controller = new AbortController(); fetch(url, { signal: controller.signal }); return () => controller.abort();`

**9. 6 components fetch data without any loading state**
DraggableOverlayWrapper (4 fetches), MedazonScribe (10 fetches), NotificationToast (3 fetches) — user sees nothing while data loads, then content pops in.
- FIX (Phase E): Every panel gets skeleton-first loading. Pattern: `if (loading) return <Skeleton />; if (error) return <ErrorCard />; if (!data.length) return <EmptyState />;`

**10. Memory leaks — timers and subscriptions**
Calendar page has 10 `setTimeout` calls, some without cleanup. AppointmentChat has a Supabase realtime subscription. CommunicationDialer has 12+ event listeners. Not all are cleaned up on unmount.
- FIX (Phase E): Audit every timer/subscription. All must have cleanup in useEffect return. Use refs for interval IDs.

### LOW — Code Quality

**11. 'America/Phoenix' hardcoded 10+ times**
Timezone scattered across calendar page instead of a single constant.
- FIX: Create `src/lib/constants.ts` with `PROVIDER_TIMEZONE = 'America/Phoenix'`, status enums, visit type enums. Import everywhere.

**12. Status strings hardcoded everywhere**
`'pending' | 'accepted' | 'completed' | 'cancelled' | 'rejected'` repeated as raw strings. Same for chart statuses, visit types.
- FIX: Create typed enums/const objects in `constants.ts`. TypeScript catches typos at compile time.

**13. Z-index chaos (10, 40, 50, 60)**
No system for layering. Panels, overlays, modals, and tooltips will collide.
- FIX (Phase A): Z-index scale in constants: `base: 10, panel: 20, activePanel: 30, overlay: 40, modal: 50, toast: 60, critical: 70`.

**14. 12 interactive elements without accessibility**
Clickable divs/spans without `role="button"`, `aria-label`, or keyboard handlers.
- FIX (Phase E): All clickable non-button elements get `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space, and descriptive `aria-label`.

**15. SSR-unsafe window/document access**
AppointmentDetailModal accesses `window.screen`, `window.innerWidth`, `document.removeEventListener` outside useEffect. Will crash during server-side rendering.
- FIX: Wrap all window/document access in `typeof window !== 'undefined'` guards or move into useEffect.

---


### Phase A — Foundation (no visual change)
- Panel Registry (static config for all 25 panels)
- Workspace State Manager (React context + useReducer)
- Layout Persistence Service (doctor_workspace_layouts table + debounced save)
- Panel Shell Component (drag, resize 8 handles, lock, minimize, close)
- Install react-grid-layout (dynamic import, ssr: false)

### Phase B — Calendar Enterprise Upgrade
- Hover Preview Popup component (onMouseEnter/Leave, 300ms delay, smart positioning)
- Chart status indicators on appointment chips (5-state left border + icons)
- Mini Calendar widget (month grid, clickable dates, dot indicators)
- Daily view (single-day column)
- Provider filter toggle
- Toolbar enhancements (+ Event, Refresh buttons)
- NOTE: Click behavior stays EXACTLY the same — hover is additive only

### Phase C — Calendar + Workspace Integration
- Calendar sidebar collapse (desktop) / full-screen transition (mobile)
- Workspace canvas with react-grid-layout
- Default layout: Patient Snapshot + SOAP locked
- Mobile stacked card layout
- Toolbar with all panel buttons + active indicators (dot + underline glow)

### Phase D — Data Layer
- DrChrono background patient sync on workspace open
- POST /api/drchrono/patient-sync endpoint
- Sync status indicator
- All panels read from Supabase
- eRx popup, post-eRx re-sync

### Phase E — Port All Existing Panels
- Wrap each of 25 panels in Panel Shell
- Same functionality, new container
- Patient Snapshot + SOAP tabbed panel

### Phase F — Polish
- 200ms cubic-bezier transitions, 60fps drag/resize
- Mobile gestures (swipe, long-press reorder)
- Skeleton loaders, content isolation during drag
- Snap-to-grid ghost outline

### Phase G — Authentication & Roles
- practice_staff table
- Assistant invitation flow (email + setup link)
- Login routing (provider vs assistant dashboard)
- Role context provider (React context)
- Server-side RBAC middleware on all API routes
- Assistant dashboard: same workspace, role-restricted

### Phase H — Enterprise Chart Management
- 5-state lifecycle (Draft → Preliminary → Final → Closed → Amended)
- Cosign queue panel (provider inbox)
- Timeliness alerts (24hr/48hr)
- Correction side-by-side display
- PDF generation with multi-author attribution
- Full page at /doctor/chart-management (PROVIDER ONLY)
- Panel in workspace toolbar

### Phase I — HIPAA Audit Logging
- audit_logs table (INSERT only, 6yr retention)
- AuditLogger middleware on all API routes
- Per-appointment Audit tab
- Provider Settings > Audit Logs (filterable, exportable)
- Suspicious activity alerts

### Phase J — Staff Management
- /doctor/settings/staff page (PROVIDER ONLY)
- Add/deactivate/reactivate assistants
- Per-assistant activity viewer
- Active session monitoring
- Activity report PDF export

---

## 🔧 PERFORMANCE TARGETS

- 60fps during drag/resize (GPU-accelerated transform: translate3d)
- will-change: transform on drag start only, remove on end
- pointer-events: none on all other panels during drag
- Debounced resize content (200ms)
- React.memo on every panel, zero re-renders on uninvolved panels
- Skeleton-first loading on every panel
- touch-action: none on drag handles, 150ms tap-vs-drag delay
- All transitions: 200ms cubic-bezier(0.25, 0.1, 0.25, 1)
- CSS container queries for panel-responsive content (not viewport-responsive)
- Debounced Supabase layout writes (500ms)

---

## 📱 MOBILE BREAKPOINTS

| Breakpoint | Behavior | Drag/Resize | Storage |
|---|---|---|---|
| <768px | Full-width stacked cards | No drag, long-press reorder, swipe | layout_mobile |
| 768-1024px | 2-column grid | Horizontal drag only | layout_tablet |
| >1024px | Free-form canvas | Free drag + resize all edges | layout_desktop |

---

## 🔗 DATA FLOW

```
DrChrono API → POST /api/drchrono/patient-sync → Supabase Tables ← All Workspace Panels
```

- Background sync fires when workspace opens for a patient
- Panels show cached data immediately, update silently
- Sync indicator in workspace header (spinner → green check)
- eRx = ONLY thing that opens DrChrono directly (EPCS popup)
- DrChrono is NEVER mentioned in the UI

---

## 📝 PANEL CAPABILITY MATRIX

### Always editable (not part of clinical chart lock):
Demographics, Documents, Pharmacy, Billing, Comms, Prior Auth

### Lock with chart (read-only when Signed/Closed):
Meds, Allergies, Problems, Vitals, Orders, Notes, Labs, Immunizations, Fam Hx, Social Hx, Surg Hx, Care Plans, Referrals, Lab Orders

### Panels needing document upload (13):
Orders, Demo, Notes, Labs, Immun, Docs, Surg Hx, Care Plan, Billing, Comms, Lab Orders, Referrals, Prior Auth

### Panels needing inline notes (16):
Med Hx, Orders, Allergy, Meds, Problems, Notes, Labs, Immun, Fam Hx, Surg Hx, Care Plan, Billing, Comms, Lab Orders, Referrals, Prior Auth

### Shared Components (build once):
- DocumentUploader — drag-and-drop, file validation, Supabase Storage, thumbnails
- InlineNoteEditor — expandable textarea per record, debounced auto-save
- ChartLockGuard — disables editing based on chart_status + user role
- AuditLogger — auto-logs every CRUD to audit_logs

---

## ✅ ALREADY BUILT (DO NOT REBUILD)

- 18 drchrono_* tables in Supabase
- DrChrono OAuth connected (doctor ID: 115034)
- 941 patients bulk-synced
- 6 chart API routes (sign, close, unlock, addendum, pdf, audit)
- generateClinicalNotePDF.ts (pdf-lib)
- DraggableOverlayWrapper.tsx (compiled, not deployed)
- All 25 panel components (various completion levels)
- Twilio voice/SMS integration
- Gmail API integration
- Daily.co video integration

---

*This document is the single source of truth. Upload this to a new chat to continue building.*
*Version 4.0 — February 14, 2026 — LOCKED*
