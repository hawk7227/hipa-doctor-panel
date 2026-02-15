-- ═══════════════════════════════════════════════════════════════════════════════
-- MEDAZON HEALTH — ENTERPRISE COMPLETE DATABASE MIGRATION
-- All tables for 25+ panels, AI-ready, DrChrono/Epic/athenahealth feature parity
-- Run in Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- SECTION 1: CORE PRACTICE TABLES
-- ═══════════════════════════════════════════════════════════════

-- 1A. Practice Staff (team members)
CREATE TABLE IF NOT EXISTS practice_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'assistant' CHECK (role IN ('doctor','nurse','assistant','admin','billing','front_desk','medical_assistant','lab_tech','pharmacist','scribe')),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  permissions JSONB DEFAULT '[]',
  phone TEXT,
  npi_number TEXT,
  license_number TEXT,
  active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_practice_staff_doctor ON practice_staff(doctor_id, active);
CREATE INDEX IF NOT EXISTS idx_practice_staff_email ON practice_staff(email);

-- 1B. Staff Schedules
CREATE TABLE IF NOT EXISTS staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES practice_staff(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TEXT NOT NULL DEFAULT '09:00',
  end_time TEXT NOT NULL DEFAULT '17:00',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, day_of_week)
);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff ON staff_schedules(staff_id, day_of_week);

-- 1C. Practice Settings / Configuration
CREATE TABLE IF NOT EXISTS practice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE UNIQUE,
  practice_name TEXT,
  practice_phone TEXT,
  practice_fax TEXT,
  practice_email TEXT,
  practice_website TEXT,
  practice_npi TEXT,
  practice_tax_id TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'US',
  timezone TEXT DEFAULT 'America/New_York',
  logo_url TEXT,
  -- Appointment defaults
  default_slot_duration INTEGER DEFAULT 30,
  buffer_between_appointments INTEGER DEFAULT 0,
  max_daily_appointments INTEGER DEFAULT 40,
  allow_online_scheduling BOOLEAN DEFAULT TRUE,
  auto_confirm_appointments BOOLEAN DEFAULT FALSE,
  -- Billing defaults
  default_payment_terms INTEGER DEFAULT 30,
  accept_insurance BOOLEAN DEFAULT TRUE,
  accept_cash_pay BOOLEAN DEFAULT TRUE,
  -- Notification preferences
  email_notifications BOOLEAN DEFAULT TRUE,
  sms_notifications BOOLEAN DEFAULT TRUE,
  reminder_hours_before INTEGER DEFAULT 24,
  -- AI settings
  ai_scribe_enabled BOOLEAN DEFAULT FALSE,
  ai_cdss_enabled BOOLEAN DEFAULT FALSE,
  ai_coding_assist BOOLEAN DEFAULT FALSE,
  ai_model_preference TEXT DEFAULT 'balanced',
  -- HIPAA
  hipaa_baa_signed BOOLEAN DEFAULT FALSE,
  hipaa_baa_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 2: ENHANCED PATIENT TABLES
-- ═══════════════════════════════════════════════════════════════

-- Add enterprise columns to patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS ssn_last4 TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS sex_at_birth TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS pronouns TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS race TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS ethnicity TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'English';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS employment_status TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS employer_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS zip TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_pharmacy TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_pharmacy_phone TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS primary_care_provider TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS referring_provider TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS chart_number TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_flags JSONB DEFAULT '[]';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_tags TEXT[] DEFAULT '{}';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS portal_access BOOLEAN DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS portal_invited_at TIMESTAMPTZ;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_hipaa BOOLEAN DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_hipaa_date TIMESTAMPTZ;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_telehealth BOOLEAN DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS balance_due NUMERIC(10,2) DEFAULT 0;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_visit_date TIMESTAMPTZ;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS next_appointment_date TIMESTAMPTZ;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS risk_score INTEGER;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS care_team JSONB DEFAULT '[]';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_deceased BOOLEAN DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS deceased_date TIMESTAMPTZ;

-- 2A. Patient Insurance
CREATE TABLE IF NOT EXISTS patient_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  insurance_type TEXT NOT NULL CHECK (insurance_type IN ('primary','secondary','tertiary','workers_comp','auto_accident')),
  payer_name TEXT NOT NULL,
  payer_id TEXT,
  plan_name TEXT,
  plan_type TEXT,
  member_id TEXT,
  group_number TEXT,
  subscriber_name TEXT,
  subscriber_dob TEXT,
  subscriber_relationship TEXT DEFAULT 'self',
  copay NUMERIC(10,2),
  deductible NUMERIC(10,2),
  deductible_met NUMERIC(10,2) DEFAULT 0,
  coinsurance_percent INTEGER,
  out_of_pocket_max NUMERIC(10,2),
  out_of_pocket_met NUMERIC(10,2) DEFAULT 0,
  effective_date DATE,
  termination_date DATE,
  prior_auth_required BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  eligibility_status TEXT DEFAULT 'unknown',
  eligibility_checked_at TIMESTAMPTZ,
  front_card_url TEXT,
  back_card_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_insurance_patient ON patient_insurance(patient_id, insurance_type);

-- 2B. Patient Allergies
CREATE TABLE IF NOT EXISTS patient_allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  allergen_name TEXT NOT NULL,
  allergen_type TEXT DEFAULT 'drug' CHECK (allergen_type IN ('drug','food','environment','other')),
  reaction TEXT,
  severity TEXT DEFAULT 'moderate' CHECK (severity IN ('mild','moderate','severe','life_threatening')),
  onset_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','resolved')),
  source TEXT DEFAULT 'patient_reported',
  rxnorm_code TEXT,
  snomed_code TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient ON patient_allergies(patient_id, status);

-- 2C. Patient Problems / Diagnoses (Problem List)
CREATE TABLE IF NOT EXISTS patient_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  icd10_code TEXT,
  snomed_code TEXT,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','resolved','chronic')),
  onset_date DATE,
  resolved_date DATE,
  severity TEXT,
  body_site TEXT,
  clinical_status TEXT DEFAULT 'active',
  verification_status TEXT DEFAULT 'confirmed',
  notes TEXT,
  diagnosed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_problems_patient ON patient_problems(patient_id, status);

-- 2D. Patient Vitals
CREATE TABLE IF NOT EXISTS patient_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  recorded_by TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  -- Core vitals
  height_inches NUMERIC(5,1),
  weight_lbs NUMERIC(6,1),
  bmi NUMERIC(5,1),
  temperature_f NUMERIC(5,1),
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  heart_rate INTEGER,
  respiratory_rate INTEGER,
  oxygen_saturation NUMERIC(5,1),
  -- Extended vitals
  pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
  blood_glucose NUMERIC(6,1),
  waist_circumference NUMERIC(5,1),
  head_circumference NUMERIC(5,1),
  peak_flow NUMERIC(6,1),
  -- Metadata
  measurement_source TEXT DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_vitals_patient ON patient_vitals(patient_id, recorded_at DESC);

-- 2E. Patient Medications (active prescriptions)
CREATE TABLE IF NOT EXISTS patient_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  generic_name TEXT,
  ndc_code TEXT,
  rxnorm_code TEXT,
  dosage TEXT,
  frequency TEXT,
  route TEXT DEFAULT 'oral',
  quantity INTEGER,
  refills INTEGER DEFAULT 0,
  days_supply INTEGER,
  sig TEXT,
  pharmacy_name TEXT,
  pharmacy_phone TEXT,
  pharmacy_npi TEXT,
  prescriber_name TEXT,
  prescriber_npi TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','discontinued','on_hold','cancelled')),
  start_date DATE,
  end_date DATE,
  discontinued_reason TEXT,
  is_controlled BOOLEAN DEFAULT FALSE,
  dea_schedule TEXT,
  is_prn BOOLEAN DEFAULT FALSE,
  dispensed_as_written BOOLEAN DEFAULT FALSE,
  prior_auth_required BOOLEAN DEFAULT FALSE,
  prior_auth_number TEXT,
  erx_status TEXT,
  erx_sent_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_medications_patient ON patient_medications(patient_id, status);

-- 2F. Patient Immunizations
CREATE TABLE IF NOT EXISTS patient_immunizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  cvx_code TEXT,
  lot_number TEXT,
  manufacturer TEXT,
  administered_date DATE NOT NULL,
  expiration_date DATE,
  dose_number INTEGER,
  dose_series TEXT,
  site TEXT,
  route TEXT,
  administered_by TEXT,
  vis_date DATE,
  ndc_code TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed','entered_in_error','not_done')),
  reaction TEXT,
  notes TEXT,
  reported_to_registry BOOLEAN DEFAULT FALSE,
  registry_submission_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_immunizations_patient ON patient_immunizations(patient_id);

-- 2G. Patient Family History
CREATE TABLE IF NOT EXISTS patient_family_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL,
  condition_name TEXT NOT NULL,
  icd10_code TEXT,
  age_at_onset INTEGER,
  is_deceased BOOLEAN DEFAULT FALSE,
  age_at_death INTEGER,
  cause_of_death TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_family_history_patient ON patient_family_history(patient_id);

-- 2H. Patient Social History
CREATE TABLE IF NOT EXISTS patient_social_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  -- Smoking
  smoking_status TEXT DEFAULT 'never' CHECK (smoking_status IN ('never','former','current','every_day','some_days','unknown')),
  smoking_start_date DATE,
  smoking_end_date DATE,
  packs_per_day NUMERIC(3,1),
  -- Alcohol
  alcohol_use TEXT DEFAULT 'none' CHECK (alcohol_use IN ('none','social','moderate','heavy','unknown')),
  drinks_per_week INTEGER,
  -- Substance
  substance_use TEXT DEFAULT 'none',
  substance_details TEXT,
  -- SDOH (Social Determinants of Health - USCDI v3)
  housing_status TEXT,
  food_insecurity BOOLEAN DEFAULT FALSE,
  transportation_access BOOLEAN DEFAULT TRUE,
  education_level TEXT,
  financial_strain TEXT,
  social_isolation BOOLEAN DEFAULT FALSE,
  intimate_partner_violence BOOLEAN DEFAULT FALSE,
  -- Lifestyle
  exercise_frequency TEXT,
  diet_type TEXT,
  occupation TEXT,
  sexual_orientation TEXT,
  gender_identity TEXT,
  -- Other
  advance_directive BOOLEAN DEFAULT FALSE,
  advance_directive_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_social_history_patient ON patient_social_history(patient_id);

-- 2I. Patient Surgical History
CREATE TABLE IF NOT EXISTS patient_surgical_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  procedure_name TEXT NOT NULL,
  cpt_code TEXT,
  icd10_code TEXT,
  surgery_date DATE,
  surgeon_name TEXT,
  facility_name TEXT,
  anesthesia_type TEXT,
  complications TEXT,
  outcome TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_surgical_history_patient ON patient_surgical_history(patient_id);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 3: APPOINTMENTS ENHANCEMENTS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cosigned_by TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cosigned_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS needs_cosign BOOLEAN DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS chart_status TEXT DEFAULT 'draft';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS chart_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS chart_signed_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS chart_signed_by TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS chart_closed_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS chart_closed_by TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS clinical_note_pdf_url TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS exam_room TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS chief_complaint TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_type TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_telehealth BOOLEAN DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS telehealth_url TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS copay_amount NUMERIC(10,2);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS copay_collected BOOLEAN DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS referring_provider TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS prior_auth_number TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS supervising_provider TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS rendering_provider TEXT;


-- ═══════════════════════════════════════════════════════════════
-- SECTION 4: CLINICAL NOTES & DOCUMENTATION
-- ═══════════════════════════════════════════════════════════════

-- 4A. Clinical Notes (full SOAP/H&P/Progress notes)
CREATE TABLE IF NOT EXISTS clinical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  note_type TEXT DEFAULT 'progress' CHECK (note_type IN ('soap','progress','hp','procedure','consult','discharge','phone','telehealth','amendment','addendum')),
  template_id UUID,
  -- SOAP Components
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  -- H&P Components
  chief_complaint TEXT,
  hpi TEXT,
  ros JSONB DEFAULT '{}',
  physical_exam JSONB DEFAULT '{}',
  -- Coding
  icd10_codes TEXT[] DEFAULT '{}',
  cpt_codes TEXT[] DEFAULT '{}',
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','in_progress','pending_review','signed','locked','amended')),
  signed_by TEXT,
  signed_at TIMESTAMPTZ,
  cosigned_by TEXT,
  cosigned_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  -- AI Enhancement
  ai_generated_summary TEXT,
  ai_suggested_codes JSONB DEFAULT '{}',
  ai_scribe_transcript TEXT,
  ai_scribe_confidence NUMERIC(3,2),
  -- Metadata
  word_count INTEGER,
  time_spent_minutes INTEGER,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_patient ON clinical_notes(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_appointment ON clinical_notes(appointment_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_doctor ON clinical_notes(doctor_id, status);

-- 4B. Chart Audit Log
CREATE TABLE IF NOT EXISTS chart_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  performed_by_name TEXT,
  performed_by_role TEXT,
  reason TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chart_audit_appointment ON chart_audit_log(appointment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chart_audit_patient ON chart_audit_log(patient_id, created_at DESC);

-- 4C. Chart Addendums
CREATE TABLE IF NOT EXISTS chart_addendums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  clinical_note_id UUID REFERENCES clinical_notes(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_role TEXT,
  addendum_type TEXT DEFAULT 'addendum' CHECK (addendum_type IN ('addendum','late_entry','correction','amendment')),
  content TEXT NOT NULL,
  reason TEXT,
  original_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chart_addendums_appointment ON chart_addendums(appointment_id, created_at DESC);

-- 4D. Note Templates
CREATE TABLE IF NOT EXISTS note_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  specialty TEXT,
  note_type TEXT DEFAULT 'soap',
  category TEXT DEFAULT 'general',
  template_body JSONB NOT NULL DEFAULT '{}',
  macros JSONB DEFAULT '[]',
  is_default BOOLEAN DEFAULT FALSE,
  is_shared BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_note_templates_doctor ON note_templates(doctor_id);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 5: LAB ORDERS & RESULTS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  order_number TEXT,
  lab_name TEXT,
  lab_account_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft','pending','sent','received','partial','completed','cancelled')),
  priority TEXT DEFAULT 'routine' CHECK (priority IN ('stat','urgent','routine','future')),
  diagnosis_codes TEXT[] DEFAULT '{}',
  clinical_notes TEXT,
  fasting_required BOOLEAN DEFAULT FALSE,
  specimen_type TEXT,
  collection_date TIMESTAMPTZ,
  ordered_by TEXT,
  ordered_at TIMESTAMPTZ DEFAULT NOW(),
  resulted_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  hl7_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_lab_orders_doctor ON lab_orders(doctor_id, status);

CREATE TABLE IF NOT EXISTS lab_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id UUID NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  test_code TEXT,
  loinc_code TEXT,
  cpt_code TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lab_order_items_order ON lab_order_items(lab_order_id);

CREATE TABLE IF NOT EXISTS lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  lab_order_id UUID REFERENCES lab_orders(id) ON DELETE SET NULL,
  lab_order_item_id UUID REFERENCES lab_order_items(id) ON DELETE SET NULL,
  test_name TEXT NOT NULL,
  test_code TEXT,
  loinc_code TEXT,
  value TEXT,
  unit TEXT,
  reference_range TEXT,
  reference_low NUMERIC,
  reference_high NUMERIC,
  flag TEXT CHECK (flag IN ('normal','abnormal','critical_high','critical_low','high','low',NULL)),
  interpretation TEXT,
  specimen_type TEXT,
  collection_date TIMESTAMPTZ,
  resulted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  patient_notified BOOLEAN DEFAULT FALSE,
  patient_notified_at TIMESTAMPTZ,
  notes TEXT,
  -- AI Enhancement
  ai_interpretation TEXT,
  ai_trend_analysis JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lab_results_patient ON lab_results(patient_id, resulted_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_results_order ON lab_results(lab_order_id);

CREATE TABLE IF NOT EXISTS lab_order_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  tests JSONB NOT NULL DEFAULT '[]',
  diagnosis_codes TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 6: PRESCRIPTIONS & E-PRESCRIBING
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  medication_id UUID REFERENCES patient_medications(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  -- Medication
  medication_name TEXT NOT NULL,
  generic_name TEXT,
  ndc_code TEXT,
  rxnorm_code TEXT,
  dosage TEXT,
  frequency TEXT,
  route TEXT DEFAULT 'oral',
  quantity INTEGER,
  refills INTEGER DEFAULT 0,
  days_supply INTEGER,
  sig TEXT,
  dispensed_as_written BOOLEAN DEFAULT FALSE,
  -- Pharmacy
  pharmacy_name TEXT,
  pharmacy_ncpdp TEXT,
  pharmacy_phone TEXT,
  pharmacy_address TEXT,
  -- Control
  is_controlled BOOLEAN DEFAULT FALSE,
  dea_schedule TEXT,
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft','pending','sent','dispensed','partially_filled','denied','cancelled','expired')),
  erx_reference TEXT,
  erx_status TEXT,
  erx_sent_at TIMESTAMPTZ,
  erx_response JSONB,
  -- PDMP
  pdmp_checked BOOLEAN DEFAULT FALSE,
  pdmp_checked_at TIMESTAMPTZ,
  pdmp_result JSONB,
  -- Prior Auth
  prior_auth_required BOOLEAN DEFAULT FALSE,
  prior_auth_number TEXT,
  prior_auth_status TEXT,
  -- Refill tracking
  original_prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  refill_number INTEGER DEFAULT 0,
  last_filled_date DATE,
  -- AI Enhancement
  ai_interaction_check JSONB,
  ai_dosage_verification JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON prescriptions(doctor_id, created_at DESC);

-- Prescription favorites
CREATE TABLE IF NOT EXISTS prescription_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  generic_name TEXT,
  dosage TEXT,
  frequency TEXT,
  route TEXT,
  quantity INTEGER,
  refills INTEGER,
  days_supply INTEGER,
  sig TEXT,
  is_controlled BOOLEAN DEFAULT FALSE,
  dea_schedule TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 7: BILLING & REVENUE CYCLE
-- ═══════════════════════════════════════════════════════════════

-- 7A. Billing Claims (CMS-1500)
CREATE TABLE IF NOT EXISTS billing_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  insurance_id UUID REFERENCES patient_insurance(id) ON DELETE SET NULL,
  -- Claim info
  claim_number TEXT UNIQUE,
  claim_type TEXT DEFAULT 'professional' CHECK (claim_type IN ('professional','institutional','dental')),
  place_of_service TEXT DEFAULT '11',
  -- Dates
  service_date DATE NOT NULL,
  submission_date TIMESTAMPTZ,
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','ready','submitted','accepted','rejected','denied','paid','partial_paid','appealed','void')),
  substatus TEXT,
  -- Providers
  rendering_provider_npi TEXT,
  billing_provider_npi TEXT,
  referring_provider_npi TEXT,
  supervising_provider_npi TEXT,
  -- Diagnosis
  primary_diagnosis TEXT,
  diagnosis_codes TEXT[] DEFAULT '{}',
  -- Financial
  total_charge NUMERIC(10,2) DEFAULT 0,
  allowed_amount NUMERIC(10,2),
  insurance_paid NUMERIC(10,2) DEFAULT 0,
  patient_responsibility NUMERIC(10,2) DEFAULT 0,
  adjustment_amount NUMERIC(10,2) DEFAULT 0,
  write_off_amount NUMERIC(10,2) DEFAULT 0,
  balance_due NUMERIC(10,2) DEFAULT 0,
  -- Clearinghouse
  clearinghouse_id TEXT,
  clearinghouse_status TEXT,
  era_reference TEXT,
  -- Denial
  denial_reason_code TEXT,
  denial_reason TEXT,
  appeal_deadline DATE,
  -- AI Enhancement
  ai_coding_suggestions JSONB,
  ai_denial_prediction NUMERIC(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_claims_patient ON billing_claims(patient_id, service_date DESC);
CREATE INDEX IF NOT EXISTS idx_billing_claims_status ON billing_claims(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_claims_date ON billing_claims(doctor_id, service_date DESC);

-- 7B. Claim Line Items (CPT codes)
CREATE TABLE IF NOT EXISTS billing_claim_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES billing_claims(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  cpt_code TEXT NOT NULL,
  modifier1 TEXT,
  modifier2 TEXT,
  modifier3 TEXT,
  modifier4 TEXT,
  diagnosis_pointer TEXT,
  units NUMERIC(5,2) DEFAULT 1,
  charge_amount NUMERIC(10,2) NOT NULL,
  allowed_amount NUMERIC(10,2),
  paid_amount NUMERIC(10,2) DEFAULT 0,
  adjustment_amount NUMERIC(10,2) DEFAULT 0,
  description TEXT,
  ndc_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_claim_lines ON billing_claim_lines(claim_id);

-- 7C. Payments & Transactions
CREATE TABLE IF NOT EXISTS billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES billing_claims(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  -- Payment info
  payment_type TEXT NOT NULL CHECK (payment_type IN ('insurance_payment','patient_payment','copay','coinsurance','deductible','refund','adjustment','write_off')),
  payment_method TEXT CHECK (payment_method IN ('cash','check','credit_card','debit_card','ach','eft','stripe','other')),
  amount NUMERIC(10,2) NOT NULL,
  -- Reference
  reference_number TEXT,
  check_number TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  -- ERA/EOB
  era_check_number TEXT,
  era_payer_name TEXT,
  era_date DATE,
  -- Status
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','refunded','voided')),
  posted_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_payments_patient ON billing_payments(patient_id, posted_date DESC);
CREATE INDEX IF NOT EXISTS idx_billing_payments_claim ON billing_payments(claim_id);

-- 7D. Fee Schedule
CREATE TABLE IF NOT EXISTS fee_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  cpt_code TEXT NOT NULL,
  description TEXT,
  standard_charge NUMERIC(10,2) NOT NULL,
  medicare_rate NUMERIC(10,2),
  medicaid_rate NUMERIC(10,2),
  cash_rate NUMERIC(10,2),
  effective_date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(doctor_id, cpt_code, effective_date)
);

-- 7E. Superbills / Encounter Forms
CREATE TABLE IF NOT EXISTS superbills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  service_date DATE NOT NULL,
  diagnosis_codes TEXT[] DEFAULT '{}',
  procedure_codes JSONB DEFAULT '[]',
  total_charge NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','finalized','billed','void')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_superbills_patient ON superbills(patient_id, service_date DESC);

-- 7F. Patient Statements & Payment Plans
CREATE TABLE IF NOT EXISTS patient_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  statement_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  total_amount NUMERIC(10,2) NOT NULL,
  amount_paid NUMERIC(10,2) DEFAULT 0,
  balance_due NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','partial_paid','paid','overdue','collections','void')),
  sent_via TEXT,
  sent_at TIMESTAMPTZ,
  pdf_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  total_amount NUMERIC(10,2) NOT NULL,
  monthly_amount NUMERIC(10,2) NOT NULL,
  remaining_balance NUMERIC(10,2) NOT NULL,
  num_installments INTEGER NOT NULL,
  installments_paid INTEGER DEFAULT 0,
  start_date DATE NOT NULL,
  next_payment_date DATE,
  auto_charge BOOLEAN DEFAULT FALSE,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','defaulted','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 8: REFERRALS & CARE COORDINATION
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('outgoing','incoming')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft','pending','sent','accepted','scheduled','completed','cancelled','expired')),
  priority TEXT DEFAULT 'routine' CHECK (priority IN ('stat','urgent','routine','elective')),
  -- Referral parties
  referred_to_name TEXT,
  referred_to_specialty TEXT,
  referred_to_npi TEXT,
  referred_to_phone TEXT,
  referred_to_fax TEXT,
  referred_to_email TEXT,
  referred_to_address TEXT,
  referred_from_name TEXT,
  referred_from_npi TEXT,
  -- Clinical
  reason TEXT NOT NULL,
  diagnosis_codes TEXT[] DEFAULT '{}',
  clinical_notes TEXT,
  clinical_documents JSONB DEFAULT '[]',
  -- Insurance
  insurance_auth_required BOOLEAN DEFAULT FALSE,
  insurance_auth_number TEXT,
  insurance_auth_status TEXT,
  insurance_auth_expiry DATE,
  num_visits_authorized INTEGER,
  num_visits_used INTEGER DEFAULT 0,
  -- Dates
  requested_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  scheduled_date DATE,
  completed_date DATE,
  -- Follow-up
  follow_up_notes TEXT,
  report_received BOOLEAN DEFAULT FALSE,
  report_url TEXT,
  -- Communication
  last_contact_date TIMESTAMPTZ,
  contact_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referrals_patient ON referrals(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_doctor ON referrals(doctor_id, direction, status);

CREATE TABLE IF NOT EXISTS specialist_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  specialty TEXT,
  subspecialty TEXT,
  npi TEXT,
  phone TEXT,
  fax TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  accepts_medicaid BOOLEAN DEFAULT FALSE,
  accepts_medicare BOOLEAN DEFAULT FALSE,
  is_preferred BOOLEAN DEFAULT FALSE,
  avg_wait_days INTEGER,
  rating NUMERIC(3,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_specialist_directory_doctor ON specialist_directory(doctor_id);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 9: DOCUMENTS & FILE MANAGEMENT
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  -- Document info
  document_type TEXT NOT NULL CHECK (document_type IN ('upload','consent','insurance_card','photo_id','lab_report','imaging','referral_letter','fax_received','fax_sent','clinical_note','prescription','correspondence','other')),
  category TEXT DEFAULT 'general',
  title TEXT NOT NULL,
  description TEXT,
  file_name TEXT,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  -- Tags & organization
  tags TEXT[] DEFAULT '{}',
  is_confidential BOOLEAN DEFAULT FALSE,
  -- Review
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending','reviewed','action_required','filed')),
  -- Fax
  fax_number TEXT,
  fax_direction TEXT,
  fax_status TEXT,
  -- OCR & AI
  ocr_text TEXT,
  ai_classification TEXT,
  ai_summary TEXT,
  ai_extracted_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient ON patient_documents(patient_id, document_type);
CREATE INDEX IF NOT EXISTS idx_patient_documents_doctor ON patient_documents(doctor_id, review_status);

-- Consent Forms
CREATE TABLE IF NOT EXISTS consent_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  form_type TEXT NOT NULL CHECK (form_type IN ('hipaa','telehealth','treatment','financial','research','medication','procedure','general')),
  form_name TEXT NOT NULL,
  form_version TEXT DEFAULT '1.0',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','signed','declined','expired','revoked')),
  signed_at TIMESTAMPTZ,
  signed_by TEXT,
  signature_data TEXT,
  witness_name TEXT,
  expiry_date DATE,
  pdf_url TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_consent_forms_patient ON consent_forms(patient_id, form_type);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 10: COMMUNICATION & MESSAGING
-- ═══════════════════════════════════════════════════════════════

-- (appointment_messages, communication_logs may already exist)
CREATE TABLE IF NOT EXISTS patient_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  channel TEXT NOT NULL CHECK (channel IN ('portal','sms','email','phone','fax','chat')),
  subject TEXT,
  body TEXT NOT NULL,
  sender_name TEXT,
  sender_type TEXT CHECK (sender_type IN ('patient','doctor','staff','system')),
  -- Status
  status TEXT DEFAULT 'sent' CHECK (status IN ('draft','sent','delivered','read','failed','archived')),
  is_urgent BOOLEAN DEFAULT FALSE,
  -- Threading
  thread_id UUID,
  parent_message_id UUID REFERENCES patient_messages(id) ON DELETE SET NULL,
  -- Attachments
  attachments JSONB DEFAULT '[]',
  -- Metadata
  twilio_sid TEXT,
  email_message_id TEXT,
  read_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  -- AI Enhancement
  ai_drafted BOOLEAN DEFAULT FALSE,
  ai_sentiment TEXT,
  ai_category TEXT,
  ai_priority TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_messages_patient ON patient_messages(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_messages_thread ON patient_messages(thread_id, created_at);

-- Secure internal messages (already have staff_messages, this is provider-to-provider)
-- Communication templates
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  channel TEXT DEFAULT 'email',
  subject TEXT,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 11: POPULATION HEALTH & QUALITY
-- ═══════════════════════════════════════════════════════════════

-- Quality Measures (HEDIS/MIPS/CQMs)
CREATE TABLE IF NOT EXISTS quality_measures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  measure_id TEXT NOT NULL,
  measure_name TEXT NOT NULL,
  measure_type TEXT CHECK (measure_type IN ('MIPS','HEDIS','CQM','custom')),
  category TEXT,
  description TEXT,
  numerator_criteria JSONB,
  denominator_criteria JSONB,
  exclusion_criteria JSONB,
  target_percent NUMERIC(5,2) DEFAULT 90,
  current_percent NUMERIC(5,2) DEFAULT 0,
  eligible_patients INTEGER DEFAULT 0,
  compliant_patients INTEGER DEFAULT 0,
  reporting_period_start DATE,
  reporting_period_end DATE,
  is_active BOOLEAN DEFAULT TRUE,
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quality_measures_doctor ON quality_measures(doctor_id, is_active);

-- Care Gaps
CREATE TABLE IF NOT EXISTS care_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  measure_id UUID REFERENCES quality_measures(id) ON DELETE SET NULL,
  gap_type TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'routine',
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','closed','excluded')),
  due_date DATE,
  closed_date DATE,
  closed_reason TEXT,
  outreach_attempts INTEGER DEFAULT 0,
  last_outreach_date TIMESTAMPTZ,
  -- AI Enhancement
  ai_risk_score NUMERIC(3,2),
  ai_recommended_action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_care_gaps_patient ON care_gaps(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_care_gaps_doctor ON care_gaps(doctor_id, status);

-- Patient Registries (chronic disease management)
CREATE TABLE IF NOT EXISTS patient_registries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB DEFAULT '{}',
  patient_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_registry_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id UUID NOT NULL REFERENCES patient_registries(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  enrolled_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active',
  risk_level TEXT DEFAULT 'moderate',
  last_assessment_date TIMESTAMPTZ,
  next_assessment_date TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(registry_id, patient_id)
);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 12: REPORTS & ANALYTICS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS report_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  report_name TEXT NOT NULL,
  date_range_start DATE,
  date_range_end DATE,
  data JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_doctor ON report_snapshots(doctor_id, report_type, generated_at DESC);

-- Saved/scheduled reports
CREATE TABLE IF NOT EXISTS saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  schedule TEXT,
  recipients TEXT[] DEFAULT '{}',
  last_run_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 13: CARE PLANS & ORDERS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS care_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft','active','on_hold','completed','cancelled')),
  category TEXT,
  start_date DATE DEFAULT CURRENT_DATE,
  target_date DATE,
  completed_date DATE,
  -- Goals
  goals JSONB DEFAULT '[]',
  interventions JSONB DEFAULT '[]',
  -- Health conditions addressed
  diagnosis_codes TEXT[] DEFAULT '{}',
  -- Team
  care_team JSONB DEFAULT '[]',
  -- AI Enhancement
  ai_generated BOOLEAN DEFAULT FALSE,
  ai_recommendations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_care_plans_patient ON care_plans(patient_id, status);

-- Standing Orders
CREATE TABLE IF NOT EXISTS standing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('lab','imaging','procedure','medication','referral','other')),
  criteria TEXT,
  order_details JSONB NOT NULL DEFAULT '{}',
  diagnosis_codes TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  effective_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 14: IMAGING ORDERS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS imaging_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  order_number TEXT,
  modality TEXT NOT NULL CHECK (modality IN ('xray','ct','mri','ultrasound','pet','mammogram','dexa','fluoroscopy','nuclear','other')),
  body_part TEXT NOT NULL,
  laterality TEXT CHECK (laterality IN ('left','right','bilateral','na')),
  priority TEXT DEFAULT 'routine',
  clinical_indication TEXT,
  diagnosis_codes TEXT[] DEFAULT '{}',
  facility_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft','pending','scheduled','completed','cancelled','results_available')),
  scheduled_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  -- Results
  report_text TEXT,
  report_url TEXT,
  findings_summary TEXT,
  impression TEXT,
  radiologist_name TEXT,
  critical_finding BOOLEAN DEFAULT FALSE,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  -- AI Enhancement
  ai_findings TEXT,
  ai_recommendations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_imaging_orders_patient ON imaging_orders(patient_id, status);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 15: STAFF COMMUNICATION (already created, ensure exists)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS staff_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('direct','group','channel','patient_context')),
  name TEXT,
  description TEXT,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES practice_staff(id) ON DELETE CASCADE,
  is_archived BOOLEAN DEFAULT FALSE,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES staff_conversations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES practice_staff(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin','member')),
  is_muted BOOLEAN DEFAULT FALSE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, staff_id)
);

CREATE TABLE IF NOT EXISTS staff_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES staff_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES practice_staff(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text','system','task_ref','patient_ref','file','call_started','call_ended')),
  reply_to_id UUID REFERENCES staff_messages(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES staff_messages(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES practice_staff(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, staff_id)
);

CREATE TABLE IF NOT EXISTS staff_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
  category TEXT DEFAULT 'general' CHECK (category IN ('general','chart_review','billing','scheduling','patient_followup','lab_review','prescription','referral','documentation','admin','prior_auth','phone_call','fax','callback')),
  assigned_to UUID REFERENCES practice_staff(id) ON DELETE SET NULL,
  assigned_by UUID NOT NULL REFERENCES practice_staff(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES practice_staff(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES staff_tasks(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES practice_staff(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES practice_staff(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message','task_assigned','task_completed','task_due','mention','call_incoming','call_missed','chart_update','schedule_change','system','urgent','lab_result','prescription','referral','billing')),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  reference_type TEXT,
  reference_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL REFERENCES practice_staff(id) ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES practice_staff(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('voice','video')),
  status TEXT DEFAULT 'ringing' CHECK (status IN ('ringing','connected','missed','declined','ended')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  connected_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  daily_room_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 16: PATIENT PORTAL
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS portal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('appointment','refill','message','records','billing','form','other')),
  subject TEXT,
  body TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_review','completed','denied','cancelled')),
  priority TEXT DEFAULT 'normal',
  assigned_to UUID REFERENCES practice_staff(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portal_requests_doctor ON portal_requests(doctor_id, status);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 17: AI / CLINICAL DECISION SUPPORT
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('scribe','cdss','coding_assist','summary','triage','drug_interaction','diagnosis_suggest','care_plan','letter','research','chat','other')),
  model_used TEXT,
  input_text TEXT,
  output_text TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  confidence_score NUMERIC(3,2),
  feedback TEXT CHECK (feedback IN ('helpful','not_helpful','incorrect','dangerous',NULL)),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_doctor ON ai_interactions(doctor_id, interaction_type, created_at DESC);

-- CDSS Alerts
CREATE TABLE IF NOT EXISTS cdss_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('drug_interaction','allergy','duplicate_therapy','dose_check','lab_flag','care_gap','preventive','contraindication','formulary','custom')),
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  title TEXT NOT NULL,
  description TEXT,
  recommendation TEXT,
  source TEXT,
  -- Action tracking
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  action_taken TEXT,
  overridden BOOLEAN DEFAULT FALSE,
  override_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cdss_alerts_patient ON cdss_alerts(patient_id, acknowledged);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 18: AUDIT & COMPLIANCE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_doctor ON audit_logs(doctor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- HIPAA Access Log (who accessed which patient record)
CREATE TABLE IF NOT EXISTS hipaa_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  accessed_by TEXT NOT NULL,
  accessed_by_role TEXT,
  access_type TEXT NOT NULL CHECK (access_type IN ('view','create','update','delete','print','export','fax','share')),
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  reason TEXT,
  is_break_glass BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hipaa_access_patient ON hipaa_access_log(patient_id, created_at DESC);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 19: PRIOR AUTHORIZATION
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS prior_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  insurance_id UUID REFERENCES patient_insurance(id) ON DELETE SET NULL,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('medication','procedure','imaging','referral','dme','inpatient','other')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft','pending','submitted','approved','denied','appealed','expired','cancelled')),
  -- Request details
  service_description TEXT NOT NULL,
  cpt_codes TEXT[] DEFAULT '{}',
  diagnosis_codes TEXT[] DEFAULT '{}',
  clinical_justification TEXT,
  supporting_documents JSONB DEFAULT '[]',
  -- Authorization
  auth_number TEXT,
  payer_reference TEXT,
  approved_units INTEGER,
  approved_from DATE,
  approved_to DATE,
  -- Denial
  denial_reason TEXT,
  denial_code TEXT,
  appeal_deadline DATE,
  -- Tracking
  submitted_at TIMESTAMPTZ,
  submitted_by TEXT,
  decided_at TIMESTAMPTZ,
  turnaround_days INTEGER,
  -- AI Enhancement
  ai_approval_prediction NUMERIC(3,2),
  ai_suggested_justification TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prior_auth_patient ON prior_authorizations(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_prior_auth_doctor ON prior_authorizations(doctor_id, status);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 20: INDEXES FOR EXISTING TABLES
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_staff_messages_conversation ON staff_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_messages_sender ON staff_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_staff_conv_participants ON staff_conversation_participants(staff_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_staff_conv_doctor ON staff_conversations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_assigned ON staff_tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_doctor ON staff_tasks(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_recipient ON staff_notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_call_log_callee ON staff_call_log(callee_id, status);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 21: ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

DO $$ 
DECLARE
  tbl TEXT;
  pol TEXT;
BEGIN
  FOR tbl IN 
    SELECT unnest(ARRAY[
      'practice_staff','staff_schedules','practice_settings',
      'patient_insurance','patient_allergies','patient_problems','patient_vitals',
      'patient_medications','patient_immunizations','patient_family_history',
      'patient_social_history','patient_surgical_history',
      'clinical_notes','chart_audit_log','chart_addendums','note_templates',
      'lab_orders','lab_order_items','lab_results','lab_order_sets',
      'prescriptions','prescription_favorites',
      'billing_claims','billing_claim_lines','billing_payments','fee_schedule',
      'superbills','patient_statements','payment_plans',
      'referrals','specialist_directory',
      'patient_documents','consent_forms',
      'patient_messages','message_templates',
      'quality_measures','care_gaps','patient_registries','patient_registry_members',
      'report_snapshots','saved_reports',
      'care_plans','standing_orders',
      'imaging_orders',
      'staff_conversations','staff_conversation_participants','staff_messages',
      'staff_message_reads','staff_tasks','staff_task_comments',
      'staff_notifications','staff_call_log',
      'portal_requests',
      'ai_interactions','cdss_alerts',
      'audit_logs','hipaa_access_log',
      'prior_authorizations'
    ])
  LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    
    -- Create permissive policy if not exists
    pol := tbl || '_service_all';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = pol AND tablename = tbl) THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (true) WITH CHECK (true)', pol, tbl);
    END IF;
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- SECTION 22: TRIGGERS
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
  trig TEXT;
BEGIN
  FOR tbl IN 
    SELECT unnest(ARRAY[
      'practice_staff','staff_schedules','practice_settings',
      'patient_insurance','patient_allergies','patient_problems',
      'patient_medications','patient_social_history',
      'clinical_notes','staff_conversations','staff_tasks',
      'lab_orders','prescriptions',
      'billing_claims','referrals','patient_documents',
      'quality_measures','care_gaps','care_plans',
      'imaging_orders','prior_authorizations','portal_requests',
      'payment_plans'
    ])
  LOOP
    trig := 'update_' || tbl || '_updated_at';
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = trig) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
        trig, tbl
      );
    END IF;
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- SECTION 23: SUPABASE REALTIME
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE staff_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE staff_notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE staff_call_log;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE patient_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION QUERY — Run after migration
-- ═══════════════════════════════════════════════════════════════
-- SELECT table_name, 
--        (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) as col_count
-- FROM information_schema.tables t
-- WHERE table_schema = 'public'
-- AND table_type = 'BASE TABLE'
-- ORDER BY table_name;
