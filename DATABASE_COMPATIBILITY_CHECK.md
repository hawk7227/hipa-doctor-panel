# Database Compatibility Check - Doctor Panel Pages

## Overview
This document checks all doctor panel pages for compatibility with the normalized database structure.

## Database Migration Summary

### OLD Structure (JSONB/Text Fields):
- `patients.active_problems` (text) → Now: `problems` table
- `patients.current_medications` (jsonb) → Now: `medication_history` table
- `appointments.subjective_notes` (text) → Now: `clinical_notes` table (note_type: 'subjective')
- `appointments.objective_notes` (text) → Now: `clinical_notes` table (note_type: 'objective')
- `appointments.assessment_notes` (text) → Now: `clinical_notes` table (note_type: 'assessment')
- `appointments.plan_notes` (text) → Now: `clinical_notes` table (note_type: 'plan')
- `appointments.chief_complaint` (text) → Now: `clinical_notes` table (note_type: 'chief_complaint')
- `appointments.ros_general` (text) → Now: `clinical_notes` table (note_type: 'ros')
- `appointments.active_medication_orders` (jsonb) → Now: `medication_orders` table (status: 'active')
- `appointments.past_medication_orders` (jsonb) → Now: `medication_orders` table (status: 'completed')
- `appointment_documents` table → Now: `files` table

### NEW Normalized Tables:
1. `problems` - patient_id, problem_name, status
2. `clinical_notes` - patient_id, appointment_id, note_type, content
3. `medication_orders` - patient_id, appointment_id, medication_name, dosage, frequency, status
4. `medication_history` - patient_id, medication_name, start_date, end_date
5. `prescription_logs` - prescription_id, appointment_id, action, action_at
6. `files` - patient_id, appointment_id, file_name, file_url
7. `communication_history` - doctor_id, patient_id, type, direction, message, status
8. `lab_results` - patient_id, order_id, test_name, result_value, status
9. `referrals` - patient_id, appointment_id, specialist_name, specialty, reason, urgency, status
10. `prior_authorizations` - patient_id, appointment_id, medication, insurance, status

## Pages to Check

### ✅ 1. AppointmentDetailModal.tsx
**Status**: ✅ COMPATIBLE (Already Updated)
- Uses normalized tables: `problems`, `clinical_notes`, `medication_orders`, `medication_history`, `prescription_logs`
- Uses `communication_history` for SMS/Call/Email logging
- Uses `lab_results` table
- Uses `referrals` table (gracefully handles if missing)
- Uses `prior_authorizations` table (gracefully handles if missing)

### ⚠️ 2. Patients Page (`/doctor/patients/page.tsx`)
**Status**: ⚠️ NEEDS CHECK
**Potential Issues**:
- May be reading `patients.active_problems` (old)
- May be reading `patients.current_medications` (old)
- May be displaying old JSONB data

**Required Changes**:
- Read from `problems` table instead of `patients.active_problems`
- Read from `medication_history` table instead of `patients.current_medications`
- Update any writes to use normalized tables

### ⚠️ 3. Appointments Page (`/doctor/appointments/page.tsx`)
**Status**: ⚠️ NEEDS CHECK
**Potential Issues**:
- May be reading appointment notes from old fields
- May be displaying old JSONB medication data

**Required Changes**:
- Read from `clinical_notes` table for SOAP notes
- Read from `medication_orders` table for medications
- Update any writes to use normalized tables

### ⚠️ 4. Dashboard Page (`/doctor/dashboard/page.tsx`)
**Status**: ⚠️ NEEDS CHECK
**Potential Issues**:
- May aggregate data from old fields
- May display statistics from old structure

**Required Changes**:
- Query normalized tables for statistics
- Update any data aggregation queries

### ✅ 5. Availability Page (`/doctor/availability/page.tsx`)
**Status**: ✅ LIKELY COMPATIBLE
- Typically only reads/writes `doctor_availability_events` table
- Should not be affected by normalization

### ✅ 6. Profile Page (`/doctor/profile/page.tsx`)
**Status**: ✅ LIKELY COMPATIBLE
- Typically only reads/writes `doctors` table
- Should not be affected by normalization

### ⚠️ 7. Communication Page (`/doctor/communication/page.tsx`)
**Status**: ⚠️ NEEDS CHECK
**Potential Issues**:
- May be reading from old communication structure
- May need to use `communication_history` table

**Required Changes**:
- Read from `communication_history` table
- Ensure all communication types (SMS, Call, Email) are logged correctly

### ⚠️ 8. AI Assistant Page (`/doctor/ai-assistant/page.tsx`)
**Status**: ⚠️ NEEDS CHECK
**Potential Issues**:
- May be reading patient data from old fields
- May need to query normalized tables for context

**Required Changes**:
- Query normalized tables for patient context
- Update any data reads to use new structure

## API Routes to Check

### ⚠️ `/api/appointments/[id]/route.ts`
**Status**: ⚠️ NEEDS CHECK
- May be reading/writing old fields
- Should use normalized tables

### ⚠️ `/api/prescriptions/erx-compose/route.ts`
**Status**: ⚠️ NEEDS CHECK
- Should write to `prescription_logs` table
- Should use `medication_orders` table

### ⚠️ `/api/cdss/generate/route.ts`
**Status**: ⚠️ NEEDS CHECK
- May be reading patient data from old fields
- Should query normalized tables

## Critical Code Patterns to Find and Replace

### Pattern 1: Reading Active Problems (OLD)
```typescript
// OLD - DON'T USE
appointment.active_problems
patient.active_problems

// NEW - USE THIS
const { data: problems } = await supabase
  .from('problems')
  .select('*')
  .eq('patient_id', patientId)
  .eq('status', 'active')
```

### Pattern 2: Reading Medications (OLD)
```typescript
// OLD - DON'T USE
appointment.active_medication_orders
patient.current_medications

// NEW - USE THIS
const { data: medications } = await supabase
  .from('medication_orders')
  .select('*')
  .eq('patient_id', patientId)
  .eq('status', 'active')
```

### Pattern 3: Reading SOAP Notes (OLD)
```typescript
// OLD - DON'T USE
appointment.subjective_notes
appointment.objective_notes
appointment.assessment_notes
appointment.plan_notes

// NEW - USE THIS
const { data: notes } = await supabase
  .from('clinical_notes')
  .select('*')
  .eq('appointment_id', appointmentId)
  .in('note_type', ['subjective', 'objective', 'assessment', 'plan'])
```

### Pattern 4: Writing Problems (OLD)
```typescript
// OLD - DON'T USE
await supabase
  .from('patients')
  .update({ active_problems: 'Problem name' })
  .eq('id', patientId)

// NEW - USE THIS
await supabase
  .from('problems')
  .insert({
    patient_id: patientId,
    problem_name: 'Problem name',
    status: 'active'
  })
```

### Pattern 5: Writing Medications (OLD)
```typescript
// OLD - DON'T USE
await supabase
  .from('appointments')
  .update({ active_medication_orders: [{ medication: '...' }] })
  .eq('id', appointmentId)

// NEW - USE THIS
await supabase
  .from('medication_orders')
  .insert({
    patient_id: patientId,
    appointment_id: appointmentId,
    medication_name: 'Medication name',
    dosage: '...',
    frequency: '...',
    status: 'active'
  })
```

## Next Steps

1. **Check Patients Page** - Verify reads/writes use normalized tables
2. **Check Appointments Page** - Verify reads/writes use normalized tables
3. **Check Dashboard** - Verify statistics queries use normalized tables
4. **Check Communication Page** - Verify uses `communication_history` table
5. **Check AI Assistant** - Verify queries normalized tables for context
6. **Check API Routes** - Verify all API routes use normalized tables

## Testing Checklist

For each page, verify:
- [ ] No reads from old JSONB/text fields
- [ ] All writes go to normalized tables
- [ ] Data displays correctly from normalized tables
- [ ] Error handling for missing tables (graceful degradation)
- [ ] Performance is acceptable (indexes are used)

