# Enterprise Panel Rebuild Plan
# ═══════════════════════════════════════════════════════════════

## Overview
- 25 EHR overlay panels totaling 15,711 lines
- ALL query Supabase directly from client (no API routes)
- Most have basic CRUD but lack DrChrono integration
- Need to rebuild from scratch on enterprise foundation

## Enterprise Rules
1. MINIMAL CHANGES per task
2. Interface names MUST match DB columns exactly
3. Error handling: loading → error → empty → success states
4. All data flows through API routes (no direct Supabase from client)
5. DrChrono data integration where available
6. Patient-centric (work by patient_id, not just appointment_id)

---

## PANEL CATALOG

### TIER 1 — Critical Clinical (rebuild first)
These are essential for patient care and used every visit.

| # | Panel | Lines | Data Source | DrChrono? | Priority |
|---|-------|-------|-------------|-----------|----------|
| 1 | AllergiesPanel | 852 | patient_allergies table | ✅ drchrono_allergies | HIGH |
| 2 | MedicationsPanel | 997 | patient_medications table | ✅ drchrono_medications | HIGH |
| 3 | VitalsPanel | 1004 | patient_vitals table | ⚠️ needs endpoint | HIGH |
| 4 | ProblemsPanel | 233 | drchrono_problems table | ✅ drchrono_problems | HIGH |
| 5 | OrdersPanel | 1268 | patient_orders table | ❌ local only | HIGH |
| 6 | PrescriptionHistoryPanel | 1427 | prescription_logs table | ✅ drchrono_medications | HIGH |

### TIER 2 — Clinical Support (rebuild second)
Used frequently but not blocking for basic patient care.

| # | Panel | Lines | Data Source | DrChrono? | Priority |
|---|-------|-------|-------------|-----------|----------|
| 7 | MedicationHistoryPanel | 1130 | drchrono_medications | ✅ synced | MED |
| 8 | ClinicalNotesPanel | 151 | clinical_notes table | ✅ drchrono_clinical_notes | MED |
| 9 | LabResultsPanel | 183 | drchrono_lab_results | ✅ synced | MED |
| 10 | ImmunizationsPanel | 163 | drchrono_vaccines | ✅ synced | MED |
| 11 | DocumentsPanel | 118 | patient_documents table | ⚠️ needs endpoint | MED |
| 12 | DemographicsPanel | 262 | patients + drchrono_patients | ✅ synced | MED |
| 13 | ChartManagementPanel | 281 | chart_status on appointments | ❌ local only | MED |

### TIER 3 — History & Context (rebuild third)
Background patient data, less frequently edited.

| # | Panel | Lines | Data Source | DrChrono? | Priority |
|---|-------|-------|-------------|-----------|----------|
| 14 | HistoryPanels (Family/Social/Surgical) | 245 | patient_history table | ⚠️ needs endpoints | LOW |
| 15 | PharmacyPanel | 200 | patient_pharmacies table | ✅ from patient.default_pharmacy | LOW |
| 16 | CarePlansPanel | 193 | care_plans table | ⚠️ needs endpoint | LOW |
| 17 | AppointmentsOverlayPanel | 1040 | appointments table | ❌ local only | LOW |
| 18 | BillingPanel | 144 | drchrono_line_items | ✅ needs sync | LOW |

### TIER 4 — Communication & Video
Separate systems, not traditional EHR panels.

| # | Panel | Lines | Data Source | DrChrono? | Priority |
|---|-------|-------|-------------|-----------|----------|
| 19 | CommunicationPanel | 557 | Twilio + Supabase | ❌ | SEPARATE |
| 20 | EnhancedSMSPanel | 502 | Twilio | ❌ | SEPARATE |
| 21 | GmailStyleEmailPanel | 568 | Email API | ❌ | SEPARATE |
| 22 | MakeCallFaxPanel | 874 | Twilio | ❌ | SEPARATE |
| 23 | CDSSPanel | 126 | OpenAI API | ❌ | SEPARATE |
| 24 | DailycoMeetingPanel | 1026 | Daily.co | ❌ | SEPARATE |
| 25 | MedazonVideoPanelFreedAI | 2167 | Daily.co + AI | ❌ | SEPARATE |

---

## CURRENT ISSUES (Common across panels)

1. **Direct Supabase from client** — bypasses auth/audit, no API routes
2. **No DrChrono integration** — most panels only read local tables
3. **No error boundaries** — crashes propagate to parent
4. **Inconsistent prop interfaces** — some use patientId, others patient_id
5. **No loading skeletons** — just "Loading..." text
6. **No empty states** — blank when no data
7. **Hardcoded styles** — not using design system
8. **No keyboard navigation** — mouse only
9. **No data validation** — forms submit without validation
10. **No optimistic updates** — slow save feedback

---

## ENTERPRISE REBUILD APPROACH

### Architecture per panel:
```
/api/panels/[panelName]/route.ts  — API route (GET/POST/PUT/DELETE)
/components/panels/[PanelName].tsx — UI component
/hooks/usePanel[Name].ts          — Data hook (fetch + mutations)
```

### Each panel will have:
- API route with proper auth + audit logging
- DrChrono data merge (where available)
- Loading skeleton → Error state → Empty state → Data view
- Keyboard shortcuts (Tab, Enter, Escape)
- Optimistic updates
- Consistent prop interface: { patientId, appointmentId?, onClose }
- Auto-save where appropriate
- Responsive design

### New features per panel:
- **AppointmentsOverlay**: + "New Appointment" button with SMS/email confirmation
- **AllergiesPanel**: + DrChrono sync indicator, severity colors
- **MedicationsPanel**: + Drug interaction warnings, refill tracking
- **VitalsPanel**: + Trend charts, abnormal highlighting
- **OrdersPanel**: + Order templates, status tracking
- **PrescriptionHistory**: + eRx integration status
- **LabResults**: + Normal range visualization, trends

---

## BUILD ORDER

### Phase 1: Foundation + Patient-Only Mode
- [ ] Patient-only workspace mode (no appointment required)
- [ ] "New Appointment" button from patient chart
- [ ] Enterprise panel base component (shared loading/error/empty)

### Phase 2: Tier 1 Panels (6 panels, ~5800 lines to replace)
- [ ] AllergiesPanel v2
- [ ] MedicationsPanel v2
- [ ] VitalsPanel v2
- [ ] ProblemsPanel v2
- [ ] OrdersPanel v2
- [ ] PrescriptionHistoryPanel v2

### Phase 3: Tier 2 Panels (7 panels, ~2288 lines to replace)
- [ ] MedicationHistoryPanel v2
- [ ] ClinicalNotesPanel v2
- [ ] LabResultsPanel v2
- [ ] ImmunizationsPanel v2
- [ ] DocumentsPanel v2
- [ ] DemographicsPanel v2
- [ ] ChartManagementPanel v2

### Phase 4: Tier 3 Panels (5 panels, ~1822 lines to replace)
- [ ] HistoryPanels v2 (Family/Social/Surgical)
- [ ] PharmacyPanel v2
- [ ] CarePlansPanel v2
- [ ] AppointmentsOverlayPanel v2 (+ New Appt button)
- [ ] BillingPanel v2

### Phase 5: Communication & Video (7 panels, ~5820 lines)
- These are separate systems, rebuild independently

---

## CRITICAL FIX: DrChrono Patient ID Resolution (LOCKED IN)

**Problem:** `patients.drchrono_patient_id` is often NULL even when DrChrono data exists.
The cron sync populates `drchrono_patients` but doesn't always backfill the
`patients.drchrono_patient_id` column. Panels showed "No data" despite DrChrono having records.

**Solution:** `src/app/api/panels/_shared.ts` → `getDrchronoPatientId()`
1. Check `patients.drchrono_patient_id` (primary)
2. Fallback: match by `email` in `drchrono_patients` table
3. Returns numeric `drchrono_patient_id` or null

**RULE:** ALL panel API routes that query DrChrono tables MUST use this helper.
Never query DrChrono tables using only `patients.drchrono_patient_id` directly.

**Applied to:** allergies, medications, problems, prescriptions
**Must apply to future panels:** immunizations, lab_results, clinical_notes, billing, etc.
