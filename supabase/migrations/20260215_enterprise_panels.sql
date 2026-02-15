-- ═══════════════════════════════════════════════════════════════════════════════
-- MEDAZON HEALTH — COMPLETE ENTERPRISE EHR MIGRATION
-- 25 Enterprise Panels: Full DrChrono/Epic/athenahealth Feature Parity + AI
-- Run in Supabase Dashboard → SQL Editor
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 1: CORE CLINICAL TABLES                                            │
-- │ Allergies, Problems, Medications, Vitals, Immunizations                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- 1A. ALLERGIES — Enterprise allergy tracking with SNOMED/RxNorm coding
CREATE TABLE IF NOT EXISTS patient_allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  allergen TEXT NOT NULL,
  allergen_type TEXT DEFAULT 'drug' CHECK (allergen_type IN ('drug', 'food', 'environmental', 'biologic', 'other')),
  reaction TEXT,
  severity TEXT DEFAULT 'mild' CHECK (severity IN ('mild', 'moderate', 'severe', 'life_threatening')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'resolved', 'entered_in_error')),
  onset_date DATE,
  resolved_date DATE,
  snomed_code TEXT,
  rxnorm_code TEXT,
  verification_status TEXT DEFAULT 'confirmed' CHECK (verification_status IN ('unconfirmed', 'confirmed', 'refuted', 'entered_in_error')),
  criticality TEXT CHECK (criticality IN ('low', 'high', 'unable_to_assess')),
  notes TEXT,
  reported_by TEXT,
  recorded_by TEXT,
  drchrono_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient ON patient_allergies(patient_id, status);

-- 1B. PROBLEMS/CONDITIONS — ICD-10 coded problem list
CREATE TABLE IF NOT EXISTS patient_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  icd10_code TEXT,
  snomed_code TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'resolved', 'recurrence', 'remission')),
  clinical_status TEXT DEFAULT 'active',
  verification_status TEXT DEFAULT 'confirmed' CHECK (verification_status IN ('provisional', 'differential', 'confirmed', 'refuted', 'entered_in_error')),
  category TEXT DEFAULT 'problem' CHECK (category IN ('problem', 'diagnosis', 'health_concern', 'symptom', 'finding')),
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe')),
  onset_date DATE,
  abatement_date DATE,
  date_diagnosed DATE,
  notes TEXT,
  is_chronic BOOLEAN DEFAULT FALSE,
  is_principal BOOLEAN DEFAULT FALSE,
  recorded_by TEXT,
  drchrono_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_problems_patient ON patient_problems(patient_id, status);

-- 1C. MEDICATIONS — Active medication list with dosage tracking
CREATE TABLE IF NOT EXISTS patient_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  generic_name TEXT,
  ndc_code TEXT,
  rxnorm_code TEXT,
  dosage TEXT,
  dosage_form TEXT,
  route TEXT DEFAULT 'oral' CHECK (route IN ('oral', 'topical', 'injection', 'inhalation', 'sublingual', 'rectal', 'ophthalmic', 'otic', 'nasal', 'transdermal', 'intravenous', 'intramuscular', 'subcutaneous', 'other')),
  frequency TEXT,
  quantity NUMERIC,
  refills INTEGER DEFAULT 0,
  days_supply INTEGER,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'stopped', 'on_hold', 'cancelled', 'entered_in_error')),
  start_date DATE,
  end_date DATE,
  prescribed_by TEXT,
  pharmacy_name TEXT,
  pharmacy_phone TEXT,
  is_prn BOOLEAN DEFAULT FALSE,
  reason TEXT,
  instructions TEXT,
  side_effects_noted TEXT,
  adherence_score INTEGER CHECK (adherence_score >= 0 AND adherence_score <= 100),
  drchrono_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_medications_patient ON patient_medications(patient_id, status);

-- 1D. VITALS — Comprehensive vital signs tracking
CREATE TABLE IF NOT EXISTS patient_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_by TEXT,
  -- Standard vitals
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  heart_rate INTEGER,
  respiratory_rate INTEGER,
  temperature NUMERIC(5,2),
  temperature_unit TEXT DEFAULT 'F' CHECK (temperature_unit IN ('F', 'C')),
  oxygen_saturation NUMERIC(5,2),
  weight NUMERIC(6,2),
  weight_unit TEXT DEFAULT 'lbs' CHECK (weight_unit IN ('lbs', 'kg')),
  height NUMERIC(5,2),
  height_unit TEXT DEFAULT 'in' CHECK (height_unit IN ('in', 'cm')),
  bmi NUMERIC(5,2),
  -- Extended vitals
  pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
  blood_glucose NUMERIC(6,2),
  blood_glucose_unit TEXT DEFAULT 'mg/dL',
  head_circumference NUMERIC(5,2),
  waist_circumference NUMERIC(5,2),
  peak_flow NUMERIC(6,2),
  inhaled_o2_concentration NUMERIC(5,2),
  -- Flags
  is_abnormal BOOLEAN DEFAULT FALSE,
  abnormal_flags JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_vitals_patient ON patient_vitals(patient_id, recorded_at DESC);

-- 1E. IMMUNIZATIONS — Vaccine administration records
CREATE TABLE IF NOT EXISTS patient_immunizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  cvx_code TEXT,
  mvx_code TEXT,
  ndc_code TEXT,
  lot_number TEXT,
  manufacturer TEXT,
  dose_number INTEGER,
  dose_series TEXT,
  administration_date DATE NOT NULL,
  expiration_date DATE,
  site TEXT,
  route TEXT CHECK (route IN ('intramuscular', 'subcutaneous', 'intradermal', 'oral', 'intranasal', 'other')),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'not_administered', 'entered_in_error')),
  reason_not_given TEXT,
  administered_by TEXT,
  ordering_provider TEXT,
  vis_date DATE,
  reaction TEXT,
  notes TEXT,
  registry_reported BOOLEAN DEFAULT FALSE,
  registry_reported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_immunizations_patient ON patient_immunizations(patient_id, administration_date DESC);


-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 2: ORDERS, LABS & PRESCRIPTIONS                                    │
-- │ Lab Orders, Lab Results, Prescriptions, Prior Auth                         │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- 2A. LAB ORDERS — Order tracking with status workflow
CREATE TABLE IF NOT EXISTS patient_lab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  order_number TEXT,
  lab_name TEXT,
  lab_type TEXT DEFAULT 'labcorp' CHECK (lab_type IN ('labcorp', 'quest', 'in_house', 'health_gorilla', 'other')),
  tests JSONB DEFAULT '[]',
  diagnosis_codes JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'sent', 'received', 'in_progress', 'completed', 'cancelled', 'rejected')),
  priority TEXT DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat', 'asap')),
  fasting_required BOOLEAN DEFAULT FALSE,
  special_instructions TEXT,
  ordering_provider TEXT,
  ordered_at TIMESTAMPTZ DEFAULT NOW(),
  collected_at TIMESTAMPTZ,
  resulted_at TIMESTAMPTZ,
  notes TEXT,
  drchrono_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_lab_orders_patient ON patient_lab_orders(patient_id, status, ordered_at DESC);

-- 2B. LAB RESULTS — Individual test results with reference ranges
CREATE TABLE IF NOT EXISTS patient_lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  lab_order_id UUID REFERENCES patient_lab_orders(id) ON DELETE SET NULL,
  test_name TEXT NOT NULL,
  test_code TEXT,
  loinc_code TEXT,
  value TEXT,
  value_numeric NUMERIC,
  unit TEXT,
  reference_range_low NUMERIC,
  reference_range_high NUMERIC,
  reference_range_text TEXT,
  interpretation TEXT CHECK (interpretation IN ('normal', 'abnormal', 'critical', 'high', 'low', 'positive', 'negative', 'inconclusive')),
  is_abnormal BOOLEAN DEFAULT FALSE,
  is_critical BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'final' CHECK (status IN ('registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered_in_error')),
  specimen_type TEXT,
  collected_at TIMESTAMPTZ,
  resulted_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  notified_patient BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMPTZ,
  drchrono_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_lab_results_patient ON patient_lab_results(patient_id, resulted_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_lab_results_order ON patient_lab_results(lab_order_id);

-- 2C. PRESCRIPTIONS — Full ePrescribing with EPCS support
CREATE TABLE IF NOT EXISTS patient_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  medication_name TEXT NOT NULL,
  generic_name TEXT,
  ndc_code TEXT,
  rxnorm_code TEXT,
  dea_schedule TEXT CHECK (dea_schedule IN ('II', 'III', 'IV', 'V', 'none')),
  dosage TEXT NOT NULL,
  dosage_form TEXT,
  route TEXT DEFAULT 'oral',
  frequency TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  quantity_unit TEXT DEFAULT 'tablets',
  days_supply INTEGER,
  refills INTEGER DEFAULT 0,
  dispense_as_written BOOLEAN DEFAULT FALSE,
  sig TEXT,
  instructions TEXT,
  pharmacy_name TEXT,
  pharmacy_npi TEXT,
  pharmacy_phone TEXT,
  pharmacy_fax TEXT,
  pharmacy_address TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'pending', 'sent', 'active', 'completed', 'cancelled', 'denied', 'expired')),
  prescribed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_date DATE,
  end_date DATE,
  prescribed_by TEXT,
  prescriber_npi TEXT,
  erx_reference TEXT,
  is_controlled BOOLEAN DEFAULT FALSE,
  prior_auth_required BOOLEAN DEFAULT FALSE,
  prior_auth_status TEXT CHECK (prior_auth_status IN ('not_required', 'pending', 'approved', 'denied')),
  denial_reason TEXT,
  notes TEXT,
  drchrono_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_prescriptions_patient ON patient_prescriptions(patient_id, status, prescribed_date DESC);

-- 2D. PRIOR AUTHORIZATIONS — Insurance pre-approval tracking
CREATE TABLE IF NOT EXISTS patient_prior_auths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  auth_type TEXT DEFAULT 'medication' CHECK (auth_type IN ('medication', 'procedure', 'imaging', 'referral', 'dme', 'inpatient', 'other')),
  reference_id UUID,
  reference_type TEXT,
  insurance_name TEXT,
  insurance_id TEXT,
  auth_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'submitted', 'pending', 'approved', 'denied', 'expired', 'cancelled', 'peer_review')),
  submitted_date DATE,
  decision_date DATE,
  effective_date DATE,
  expiration_date DATE,
  approved_units INTEGER,
  approved_visits INTEGER,
  used_units INTEGER DEFAULT 0,
  used_visits INTEGER DEFAULT 0,
  denial_reason TEXT,
  appeal_status TEXT CHECK (appeal_status IN ('not_appealed', 'appeal_submitted', 'appeal_approved', 'appeal_denied')),
  appeal_date DATE,
  clinical_justification TEXT,
  supporting_documents JSONB DEFAULT '[]',
  notes TEXT,
  assigned_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_prior_auths_patient ON patient_prior_auths(patient_id, status);


-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 3: CLINICAL DOCUMENTATION                                          │
-- │ Clinical Notes, Care Plans, History, Amendments                            │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- 3A. CLINICAL NOTES — Encounter documentation with templates
CREATE TABLE IF NOT EXISTS patient_clinical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  note_type TEXT DEFAULT 'soap' CHECK (note_type IN ('soap', 'progress', 'hpi', 'procedure', 'consultation', 'discharge', 'telephone', 'addendum', 'custom')),
  template_id UUID,
  -- SOAP sections
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  -- Additional structured sections
  chief_complaint TEXT,
  history_of_present_illness TEXT,
  review_of_systems JSONB DEFAULT '{}',
  physical_exam JSONB DEFAULT '{}',
  medical_decision_making TEXT,
  -- E&M coding support
  em_code TEXT,
  em_level INTEGER CHECK (em_level >= 1 AND em_level <= 5),
  time_spent_minutes INTEGER,
  complexity TEXT CHECK (complexity IN ('straightforward', 'low', 'moderate', 'high')),
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'signed', 'locked', 'amended')),
  signed_by TEXT,
  signed_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  cosigned_by TEXT,
  cosigned_at TIMESTAMPTZ,
  -- AI features
  ai_generated BOOLEAN DEFAULT FALSE,
  ai_model TEXT,
  ai_transcript_id TEXT,
  -- Full text for non-SOAP
  content TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_clinical_notes_patient ON patient_clinical_notes(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_clinical_notes_appointment ON patient_clinical_notes(appointment_id);

-- 3B. CARE PLANS — Treatment/management plans
CREATE TABLE IF NOT EXISTS patient_care_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'treatment' CHECK (category IN ('treatment', 'preventive', 'chronic_management', 'wellness', 'rehabilitation', 'discharge', 'follow_up')),
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'on_hold', 'completed', 'revoked', 'entered_in_error')),
  start_date DATE,
  end_date DATE,
  goals JSONB DEFAULT '[]',
  interventions JSONB DEFAULT '[]',
  outcome_measures JSONB DEFAULT '[]',
  related_conditions JSONB DEFAULT '[]',
  care_team JSONB DEFAULT '[]',
  review_date DATE,
  last_reviewed_at TIMESTAMPTZ,
  last_reviewed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_care_plans_patient ON patient_care_plans(patient_id, status);

-- 3C. MEDICAL HISTORY — Past medical, surgical, family, social
CREATE TABLE IF NOT EXISTS patient_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  history_type TEXT NOT NULL CHECK (history_type IN ('medical', 'surgical', 'family', 'social', 'obstetric', 'psychiatric', 'dental')),
  description TEXT NOT NULL,
  icd10_code TEXT,
  date_recorded DATE,
  onset_date DATE,
  resolution_date DATE,
  status TEXT DEFAULT 'active',
  -- Family history specific
  relationship TEXT,
  age_at_onset INTEGER,
  is_deceased BOOLEAN,
  cause_of_death TEXT,
  -- Social history specific
  category TEXT,
  value TEXT,
  quantity TEXT,
  frequency TEXT,
  duration TEXT,
  -- General
  notes TEXT,
  recorded_by TEXT,
  drchrono_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_history_patient ON patient_history(patient_id, history_type);


-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 4: REFERRALS, ORDERS & DOCUMENTS                                  │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- 4A. REFERRALS — Specialist referral tracking
CREATE TABLE IF NOT EXISTS patient_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  referral_type TEXT DEFAULT 'specialist' CHECK (referral_type IN ('specialist', 'imaging', 'therapy', 'surgery', 'lab', 'mental_health', 'other')),
  specialty TEXT,
  referred_to_name TEXT,
  referred_to_npi TEXT,
  referred_to_phone TEXT,
  referred_to_fax TEXT,
  referred_to_address TEXT,
  referred_to_email TEXT,
  reason TEXT NOT NULL,
  diagnosis_codes JSONB DEFAULT '[]',
  urgency TEXT DEFAULT 'routine' CHECK (urgency IN ('routine', 'urgent', 'emergent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'sent', 'accepted', 'scheduled', 'completed', 'cancelled', 'denied')),
  referral_date DATE DEFAULT CURRENT_DATE,
  expiration_date DATE,
  auth_number TEXT,
  prior_auth_required BOOLEAN DEFAULT FALSE,
  prior_auth_status TEXT,
  -- Communication
  referral_letter TEXT,
  clinical_summary TEXT,
  attachments JSONB DEFAULT '[]',
  -- Follow-up
  specialist_notes TEXT,
  specialist_report_received BOOLEAN DEFAULT FALSE,
  specialist_report_date DATE,
  follow_up_date DATE,
  follow_up_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_referrals_patient ON patient_referrals(patient_id, status);

-- 4B. GENERAL ORDERS — Imaging, procedures, DME, etc.
CREATE TABLE IF NOT EXISTS patient_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('imaging', 'procedure', 'dme', 'home_health', 'occupational_therapy', 'physical_therapy', 'speech_therapy', 'dietary', 'other')),
  order_name TEXT NOT NULL,
  cpt_code TEXT,
  hcpcs_code TEXT,
  diagnosis_codes JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'sent', 'in_progress', 'completed', 'cancelled', 'rejected')),
  priority TEXT DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat', 'asap')),
  ordering_provider TEXT,
  performing_facility TEXT,
  performing_provider TEXT,
  ordered_date DATE DEFAULT CURRENT_DATE,
  scheduled_date DATE,
  completed_date DATE,
  clinical_indication TEXT,
  special_instructions TEXT,
  results TEXT,
  result_documents JSONB DEFAULT '[]',
  prior_auth_required BOOLEAN DEFAULT FALSE,
  prior_auth_id UUID REFERENCES patient_prior_auths(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_orders_patient ON patient_orders(patient_id, status, order_type);

-- 4C. DOCUMENTS — File/document management with categories
CREATE TABLE IF NOT EXISTS patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  document_type TEXT DEFAULT 'other' CHECK (document_type IN (
    'lab_report', 'imaging', 'referral_letter', 'consultation_note', 'discharge_summary',
    'insurance_card', 'id_document', 'consent_form', 'intake_form', 'prior_auth',
    'specialist_report', 'operative_note', 'pathology', 'radiology', 'eob',
    'correspondence', 'legal', 'prescription', 'clinical_photo', 'other'
  )),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  storage_path TEXT,
  -- Metadata
  document_date DATE,
  source TEXT,
  author TEXT,
  category TEXT,
  tags JSONB DEFAULT '[]',
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  is_confidential BOOLEAN DEFAULT FALSE,
  requires_review BOOLEAN DEFAULT FALSE,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  -- OCR / AI
  ocr_text TEXT,
  ai_summary TEXT,
  ai_extracted_data JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient ON patient_documents(patient_id, document_type, status);


-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 5: BILLING & INSURANCE                                             │
-- │ Claims, Payments, Insurance, Superbills                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- 5A. PATIENT INSURANCE — Insurance coverage details
CREATE TABLE IF NOT EXISTS patient_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  insurance_type TEXT DEFAULT 'primary' CHECK (insurance_type IN ('primary', 'secondary', 'tertiary', 'workers_comp', 'auto_accident', 'self_pay')),
  payer_name TEXT NOT NULL,
  payer_id TEXT,
  plan_name TEXT,
  plan_type TEXT CHECK (plan_type IN ('hmo', 'ppo', 'epo', 'pos', 'hdhp', 'medicare', 'medicaid', 'tricare', 'other')),
  member_id TEXT,
  group_number TEXT,
  subscriber_name TEXT,
  subscriber_dob DATE,
  subscriber_relationship TEXT DEFAULT 'self' CHECK (subscriber_relationship IN ('self', 'spouse', 'child', 'other')),
  effective_date DATE,
  termination_date DATE,
  copay NUMERIC(8,2),
  coinsurance_percent NUMERIC(5,2),
  deductible NUMERIC(10,2),
  deductible_met NUMERIC(10,2) DEFAULT 0,
  out_of_pocket_max NUMERIC(10,2),
  out_of_pocket_met NUMERIC(10,2) DEFAULT 0,
  -- Card images
  front_image_url TEXT,
  back_image_url TEXT,
  -- Eligibility
  is_active BOOLEAN DEFAULT TRUE,
  last_eligibility_check TIMESTAMPTZ,
  eligibility_status TEXT CHECK (eligibility_status IN ('active', 'inactive', 'pending', 'unknown')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_insurance_patient ON patient_insurance(patient_id, insurance_type, is_active);

-- 5B. BILLING CLAIMS — Insurance claim submission and tracking
CREATE TABLE IF NOT EXISTS billing_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  insurance_id UUID REFERENCES patient_insurance(id) ON DELETE SET NULL,
  claim_number TEXT,
  claim_type TEXT DEFAULT 'professional' CHECK (claim_type IN ('professional', 'institutional', 'dental')),
  -- Billing codes
  cpt_codes JSONB DEFAULT '[]',
  icd10_codes JSONB DEFAULT '[]',
  modifiers JSONB DEFAULT '[]',
  -- Amounts
  billed_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  allowed_amount NUMERIC(10,2),
  paid_amount NUMERIC(10,2) DEFAULT 0,
  patient_responsibility NUMERIC(10,2) DEFAULT 0,
  adjustment_amount NUMERIC(10,2) DEFAULT 0,
  write_off_amount NUMERIC(10,2) DEFAULT 0,
  -- Status workflow
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'submitted', 'accepted', 'rejected', 'denied', 'paid', 'partial_paid', 'appealed', 'write_off', 'collections')),
  submission_date DATE,
  adjudication_date DATE,
  payment_date DATE,
  -- Denial management
  denial_code TEXT,
  denial_reason TEXT,
  denial_category TEXT,
  remark_codes JSONB DEFAULT '[]',
  -- Filing
  place_of_service TEXT DEFAULT '11',
  rendering_provider TEXT,
  rendering_npi TEXT,
  billing_provider TEXT,
  billing_npi TEXT,
  -- ERA/EOB
  era_reference TEXT,
  eob_document_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_claims_patient ON billing_claims(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_claims_doctor ON billing_claims(doctor_id, status, created_at DESC);

-- 5C. PATIENT PAYMENTS — Payment ledger
CREATE TABLE IF NOT EXISTS patient_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES billing_claims(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  payment_type TEXT DEFAULT 'copay' CHECK (payment_type IN ('copay', 'coinsurance', 'deductible', 'self_pay', 'refund', 'adjustment', 'collection', 'insurance_payment', 'write_off')),
  payment_method TEXT CHECK (payment_method IN ('cash', 'check', 'credit_card', 'debit_card', 'ach', 'insurance', 'stripe', 'other')),
  amount NUMERIC(10,2) NOT NULL,
  stripe_payment_id TEXT,
  stripe_charge_id TEXT,
  check_number TEXT,
  reference_number TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  posted_date DATE,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'voided')),
  description TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_payments_patient ON patient_payments(patient_id, payment_date DESC);

-- 5D. SUPERBILLS — Encounter billing summaries
CREATE TABLE IF NOT EXISTS superbills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Codes
  cpt_codes JSONB DEFAULT '[]',
  icd10_codes JSONB DEFAULT '[]',
  modifiers JSONB DEFAULT '[]',
  -- Amounts
  total_charges NUMERIC(10,2) DEFAULT 0,
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'submitted', 'billed')),
  claim_id UUID REFERENCES billing_claims(id) ON DELETE SET NULL,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_superbills_patient ON superbills(patient_id, service_date DESC);


-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 6: PATIENT DEMOGRAPHICS & PHARMACY                                 │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- 6A. DEMOGRAPHICS (extend patients table)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS suffix TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS ssn_last_four TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS race TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS ethnicity TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'English';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS interpreter_needed BOOLEAN DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS employer_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS employer_phone TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS primary_care_provider TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS referring_provider TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_pharmacy_id UUID;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS advance_directive BOOLEAN DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS advance_directive_type TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS portal_access_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS portal_last_login TIMESTAMPTZ;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS communication_preference TEXT DEFAULT 'email';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS hipaa_consent_signed BOOLEAN DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS hipaa_consent_date DATE;

-- 6B. PATIENT PHARMACIES — Preferred pharmacy list
CREATE TABLE IF NOT EXISTS patient_pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  pharmacy_name TEXT NOT NULL,
  pharmacy_npi TEXT,
  ncpdp_id TEXT,
  phone TEXT,
  fax TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  is_preferred BOOLEAN DEFAULT FALSE,
  is_mail_order BOOLEAN DEFAULT FALSE,
  pharmacy_type TEXT DEFAULT 'retail' CHECK (pharmacy_type IN ('retail', 'mail_order', 'specialty', 'hospital', 'compounding', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_pharmacies_patient ON patient_pharmacies(patient_id, is_preferred);


-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 7: PATIENT TASKS & TRACKING                                        │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- 7A. PATIENT TASKS — Clinical tasks linked to patients
CREATE TABLE IF NOT EXISTS patient_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  task_type TEXT DEFAULT 'general' CHECK (task_type IN (
    'general', 'follow_up', 'referral', 'lab_review', 'prescription_renewal',
    'prior_auth', 'callback', 'document_review', 'billing', 'patient_education',
    'care_coordination', 'quality_measure', 'screening'
  )),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'critical')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'deferred')),
  assigned_to UUID REFERENCES practice_staff(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES practice_staff(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES practice_staff(id) ON DELETE SET NULL,
  recurrence TEXT,
  automation_trigger TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_tasks_patient ON patient_tasks(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_patient_tasks_assigned ON patient_tasks(assigned_to, status, due_date);

-- 7B. MEDICATION HISTORY — Complete medication history timeline
CREATE TABLE IF NOT EXISTS patient_medication_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  generic_name TEXT,
  dosage TEXT,
  frequency TEXT,
  route TEXT,
  start_date DATE,
  end_date DATE,
  discontinuation_reason TEXT,
  prescribed_by TEXT,
  source TEXT DEFAULT 'self_reported' CHECK (source IN ('self_reported', 'ehr_import', 'pharmacy', 'drchrono', 'external_provider', 'pmp')),
  notes TEXT,
  drchrono_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_med_history_patient ON patient_medication_history(patient_id, start_date DESC);


-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 8: AI & AUTOMATION                                                 │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- 8A. AI INTERACTIONS — Track all AI assistant interactions
CREATE TABLE IF NOT EXISTS ai_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'cdss', 'scribe', 'note_generation', 'coding_suggestion', 'drug_interaction',
    'diagnosis_assist', 'patient_summary', 'lab_interpretation', 'referral_letter',
    'prior_auth_letter', 'patient_education', 'chat', 'document_analysis'
  )),
  prompt TEXT,
  response TEXT,
  model TEXT,
  tokens_used INTEGER,
  confidence_score NUMERIC(5,4),
  was_accepted BOOLEAN,
  feedback TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_doctor ON ai_interactions(doctor_id, interaction_type, created_at DESC);

-- 8B. CLINICAL TEMPLATES — Reusable note/form templates
CREATE TABLE IF NOT EXISTS clinical_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT DEFAULT 'soap' CHECK (template_type IN ('soap', 'hpi', 'ros', 'physical_exam', 'procedure', 'custom', 'macro', 'smart_phrase')),
  specialty TEXT,
  content JSONB NOT NULL DEFAULT '{}',
  shortcut_key TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_shared BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinical_templates_doctor ON clinical_templates(doctor_id, template_type);

-- 8C. QUALITY MEASURES — MIPS/MACRA quality tracking
CREATE TABLE IF NOT EXISTS quality_measures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  measure_id TEXT NOT NULL,
  measure_name TEXT NOT NULL,
  measure_type TEXT CHECK (measure_type IN ('quality', 'promoting_interoperability', 'improvement_activities', 'cost')),
  category TEXT,
  reporting_year INTEGER,
  is_eligible BOOLEAN DEFAULT TRUE,
  is_met BOOLEAN DEFAULT FALSE,
  is_excluded BOOLEAN DEFAULT FALSE,
  exclusion_reason TEXT,
  performance_date DATE,
  numerator BOOLEAN DEFAULT FALSE,
  denominator BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quality_measures_doctor ON quality_measures(doctor_id, measure_id, reporting_year);


-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 9: POPULATION HEALTH & ANALYTICS                                   │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- 9A. PATIENT COHORTS — Population health grouping
CREATE TABLE IF NOT EXISTS patient_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB DEFAULT '{}',
  patient_count INTEGER DEFAULT 0,
  is_auto_generated BOOLEAN DEFAULT FALSE,
  last_computed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_cohort_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES patient_cohorts(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cohort_id, patient_id)
);

-- 9B. CLINICAL ALERTS — Rule-based clinical alerts
CREATE TABLE IF NOT EXISTS clinical_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'drug_interaction', 'allergy_alert', 'duplicate_therapy', 'lab_critical',
    'overdue_screening', 'care_gap', 'medication_adherence', 'vitals_abnormal',
    'immunization_due', 'preventive_care', 'quality_measure', 'custom'
  )),
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT,
  source TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  override_reason TEXT,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinical_alerts_patient ON clinical_alerts(patient_id, is_active, alert_type);


-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 10: RLS + TRIGGERS + REALTIME                                      │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Enable RLS on ALL new tables
DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'patient_allergies', 'patient_problems', 'patient_medications', 'patient_vitals',
    'patient_immunizations', 'patient_lab_orders', 'patient_lab_results',
    'patient_prescriptions', 'patient_prior_auths', 'patient_clinical_notes',
    'patient_care_plans', 'patient_history', 'patient_referrals', 'patient_orders',
    'patient_documents', 'patient_insurance', 'billing_claims', 'patient_payments',
    'superbills', 'patient_pharmacies', 'patient_tasks', 'patient_medication_history',
    'ai_interactions', 'clinical_templates', 'quality_measures', 'patient_cohorts',
    'patient_cohort_members', 'clinical_alerts'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    -- Permissive policy (access through service_role API routes)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = tbl || '_service_all' AND tablename = tbl) THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (true) WITH CHECK (true)', tbl || '_service_all', tbl);
    END IF;
  END LOOP;
END $$;

-- Updated_at triggers for tables with updated_at column
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
  trigger_name TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'patient_allergies', 'patient_problems', 'patient_medications',
    'patient_immunizations', 'patient_lab_orders', 'patient_prescriptions',
    'patient_prior_auths', 'patient_clinical_notes', 'patient_care_plans',
    'patient_history', 'patient_referrals', 'patient_orders', 'patient_documents',
    'patient_insurance', 'billing_claims', 'superbills', 'patient_pharmacies',
    'patient_tasks', 'clinical_templates', 'quality_measures', 'patient_cohorts'
  ])
  LOOP
    trigger_name := 'update_' || tbl || '_updated_at';
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = trigger_name) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
        trigger_name, tbl
      );
    END IF;
  END LOOP;
END $$;


-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ VERIFY: Run this to confirm all tables created                             │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND (table_name LIKE 'patient_%' OR table_name LIKE 'billing_%' 
--      OR table_name LIKE 'clinical_%' OR table_name IN ('superbills', 'quality_measures', 'ai_interactions'))
-- ORDER BY table_name;
