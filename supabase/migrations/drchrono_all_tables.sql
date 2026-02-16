-- ═══════════════════════════════════════════════════════════════
-- DrChrono ALL Tables — Run this in Supabase SQL Editor
-- Creates ALL 25 sync tables if they don't exist
-- Safe to run multiple times (IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- PATIENT CORE (already exist from v6, but ensure they're there)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS drchrono_patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_patient_id INTEGER UNIQUE NOT NULL,
  first_name TEXT DEFAULT '',
  middle_name TEXT,
  last_name TEXT DEFAULT '',
  nick_name TEXT,
  date_of_birth TEXT,
  gender TEXT,
  social_security_number TEXT,
  race TEXT,
  ethnicity TEXT,
  preferred_language TEXT,
  email TEXT,
  cell_phone TEXT,
  home_phone TEXT,
  office_phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,
  employer TEXT,
  employer_address TEXT,
  employer_city TEXT,
  employer_state TEXT,
  employer_zip_code TEXT,
  default_pharmacy TEXT,
  preferred_pharmacies JSONB,
  doctor INTEGER,
  copay TEXT,
  primary_insurance JSONB,
  secondary_insurance JSONB,
  responsible_party_name TEXT,
  responsible_party_relation TEXT,
  responsible_party_phone TEXT,
  responsible_party_email TEXT,
  chart_id TEXT,
  patient_photo TEXT,
  patient_photo_date TEXT,
  patient_status TEXT,
  date_of_first_appointment TEXT,
  date_of_last_appointment TEXT,
  patient_flags JSONB,
  patient_flags_attached JSONB,
  disable_sms_messages BOOLEAN DEFAULT FALSE,
  referring_doctor TEXT,
  internal_notes TEXT,
  custom_demographics JSONB,
  drchrono_updated_at TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drchrono_patients_email ON drchrono_patients(email);
CREATE INDEX IF NOT EXISTS idx_drchrono_patients_name ON drchrono_patients(last_name, first_name);

CREATE TABLE IF NOT EXISTS drchrono_medications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_medication_id INTEGER UNIQUE NOT NULL,
  drchrono_patient_id INTEGER,
  name TEXT DEFAULT '',
  rxnorm TEXT,
  ndc TEXT,
  dosage_quantity TEXT,
  dosage_unit TEXT,
  route TEXT,
  frequency TEXT,
  sig TEXT,
  quantity TEXT,
  number_refills INTEGER,
  daw BOOLEAN DEFAULT FALSE,
  prn BOOLEAN DEFAULT FALSE,
  order_status TEXT,
  status TEXT DEFAULT 'active',
  date_prescribed TEXT,
  date_started_taking TEXT,
  date_stopped_taking TEXT,
  pharmacy_note TEXT,
  doctor INTEGER,
  appointment INTEGER,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drchrono_medications_patient ON drchrono_medications(drchrono_patient_id);

CREATE TABLE IF NOT EXISTS drchrono_allergies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_allergy_id INTEGER UNIQUE NOT NULL,
  drchrono_patient_id INTEGER,
  reaction TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  notes TEXT,
  snomed_reaction TEXT,
  onset_date TEXT,
  severity TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drchrono_allergies_patient ON drchrono_allergies(drchrono_patient_id);

CREATE TABLE IF NOT EXISTS drchrono_problems (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_problem_id INTEGER UNIQUE NOT NULL,
  drchrono_patient_id INTEGER,
  name TEXT DEFAULT '',
  icd_code TEXT,
  status TEXT DEFAULT 'active',
  date_diagnosis TEXT,
  date_changed TEXT,
  notes TEXT,
  snomed_ct_code TEXT,
  doctor INTEGER,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drchrono_problems_patient ON drchrono_problems(drchrono_patient_id);

CREATE TABLE IF NOT EXISTS drchrono_vaccines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_vaccine_record_id INTEGER UNIQUE NOT NULL,
  drchrono_patient_id INTEGER,
  vaccine_name TEXT DEFAULT '',
  cvx_code TEXT,
  administered_date TEXT,
  administered_by TEXT,
  route TEXT,
  site TEXT,
  dose_quantity TEXT,
  dose_unit TEXT,
  lot_number TEXT,
  manufacturer TEXT,
  expiration_date TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drchrono_vaccines_patient ON drchrono_vaccines(drchrono_patient_id);

CREATE TABLE IF NOT EXISTS drchrono_lab_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_lab_result_id INTEGER UNIQUE NOT NULL,
  drchrono_lab_order_id INTEGER,
  drchrono_patient_id INTEGER,
  test_code TEXT,
  test_name TEXT,
  value TEXT,
  unit TEXT,
  status TEXT,
  abnormal_flag TEXT,
  normal_range TEXT,
  normal_range_high TEXT,
  normal_range_low TEXT,
  specimen_source TEXT,
  specimen_condition TEXT,
  collection_date TEXT,
  result_date TEXT,
  report_notes TEXT,
  stack TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drchrono_lab_results_patient ON drchrono_lab_results(drchrono_patient_id);
CREATE INDEX IF NOT EXISTS idx_drchrono_lab_results_order ON drchrono_lab_results(drchrono_lab_order_id);

CREATE TABLE IF NOT EXISTS drchrono_clinical_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_note_id INTEGER UNIQUE NOT NULL,
  drchrono_appointment_id TEXT,
  drchrono_patient_id INTEGER,
  clinical_note_sections JSONB,
  clinical_note_pdf TEXT,
  locked BOOLEAN DEFAULT FALSE,
  drchrono_created_at TEXT,
  drchrono_updated_at TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drchrono_clinical_notes_patient ON drchrono_clinical_notes(drchrono_patient_id);

-- ══════════════════════════════════════════════════════════════
-- CLINICAL — These are the ones likely MISSING
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS drchrono_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_document_id INTEGER UNIQUE NOT NULL,
  drchrono_patient_id INTEGER,
  description TEXT,
  document_type TEXT,
  document_url TEXT,
  date TEXT,
  metatags JSONB,
  doctor INTEGER,
  drchrono_updated_at TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drchrono_documents_patient ON drchrono_documents(drchrono_patient_id);

CREATE TABLE IF NOT EXISTS drchrono_appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_appointment_id INTEGER UNIQUE NOT NULL,
  drchrono_patient_id INTEGER,
  doctor INTEGER,
  office INTEGER,
  scheduled_time TEXT,
  duration INTEGER,
  exam_room INTEGER,
  status TEXT,
  reason TEXT,
  notes TEXT,
  appt_is_break BOOLEAN DEFAULT FALSE,
  recurring_appointment BOOLEAN DEFAULT FALSE,
  profile INTEGER,
  base_recurring_appointment INTEGER,
  is_walk_in BOOLEAN DEFAULT FALSE,
  drchrono_created_at TEXT,
  drchrono_updated_at TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drchrono_appointments_patient ON drchrono_appointments(drchrono_patient_id);
CREATE INDEX IF NOT EXISTS idx_drchrono_appointments_time ON drchrono_appointments(scheduled_time);

CREATE TABLE IF NOT EXISTS drchrono_lab_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_lab_order_id INTEGER UNIQUE NOT NULL,
  drchrono_patient_id INTEGER,
  doctor INTEGER,
  requisition_id TEXT,
  status TEXT,
  notes TEXT,
  priority TEXT DEFAULT 'normal',
  lab_type TEXT,
  drchrono_created_at TEXT,
  drchrono_updated_at TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drchrono_lab_orders_patient ON drchrono_lab_orders(drchrono_patient_id);

CREATE TABLE IF NOT EXISTS drchrono_lab_tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_lab_test_id INTEGER UNIQUE NOT NULL,
  drchrono_lab_order_id INTEGER,
  drchrono_patient_id INTEGER,
  code TEXT,
  name TEXT,
  status TEXT,
  abn_document TEXT,
  notes TEXT,
  drchrono_created_at TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drchrono_lab_tests_order ON drchrono_lab_tests(drchrono_lab_order_id);

-- ══════════════════════════════════════════════════════════════
-- PRACTICE MANAGEMENT
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS drchrono_offices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_office_id INTEGER UNIQUE NOT NULL,
  name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone_number TEXT,
  fax_number TEXT,
  country TEXT,
  exam_rooms JSONB,
  online_scheduling BOOLEAN DEFAULT FALSE,
  online_timeslots JSONB,
  start_time TEXT,
  end_time TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drchrono_doctors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_doctor_id INTEGER UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  suffix TEXT,
  specialty TEXT,
  email TEXT,
  cell_phone TEXT,
  home_phone TEXT,
  office_phone TEXT,
  job_title TEXT,
  practice_group INTEGER,
  practice_group_name TEXT,
  profile_picture TEXT,
  website TEXT,
  npi_number TEXT,
  is_account_suspended BOOLEAN DEFAULT FALSE,
  timezone TEXT,
  country TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drchrono_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_user_id INTEGER UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  is_doctor BOOLEAN DEFAULT FALSE,
  is_staff BOOLEAN DEFAULT FALSE,
  practice_group INTEGER,
  doctor INTEGER,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drchrono_appointment_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_profile_id INTEGER UNIQUE NOT NULL,
  name TEXT,
  color TEXT,
  duration INTEGER,
  online_scheduling BOOLEAN DEFAULT FALSE,
  reason TEXT,
  sort_order INTEGER,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drchrono_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_task_id INTEGER UNIQUE NOT NULL,
  title TEXT,
  status TEXT,
  category INTEGER,
  assignee_user INTEGER,
  due_date TEXT,
  notes TEXT,
  associated_items JSONB,
  drchrono_created_at TEXT,
  drchrono_updated_at TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drchrono_task_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_category_id INTEGER UNIQUE NOT NULL,
  name TEXT,
  since TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drchrono_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_message_id INTEGER UNIQUE NOT NULL,
  drchrono_patient_id INTEGER,
  doctor INTEGER,
  owner INTEGER,
  type TEXT,
  title TEXT,
  body TEXT,
  read BOOLEAN DEFAULT FALSE,
  starred BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  responsible_user INTEGER,
  drchrono_created_at TEXT,
  drchrono_updated_at TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drchrono_messages_patient ON drchrono_messages(drchrono_patient_id);

CREATE TABLE IF NOT EXISTS drchrono_reminder_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_reminder_profile_id INTEGER UNIQUE NOT NULL,
  name TEXT,
  reminders JSONB,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- COMMUNICATION
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS drchrono_amendments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_amendment_id INTEGER UNIQUE NOT NULL,
  drchrono_patient_id INTEGER,
  drchrono_appointment_id INTEGER,
  notes TEXT,
  status TEXT,
  requested_by TEXT,
  drchrono_created_at TEXT,
  drchrono_updated_at TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drchrono_amendments_patient ON drchrono_amendments(drchrono_patient_id);

CREATE TABLE IF NOT EXISTS drchrono_communications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_communication_id INTEGER UNIQUE NOT NULL,
  drchrono_patient_id INTEGER,
  doctor INTEGER,
  type TEXT,
  message TEXT,
  subject TEXT,
  direction TEXT,
  status TEXT,
  drchrono_created_at TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drchrono_communications_patient ON drchrono_communications(drchrono_patient_id);

-- ══════════════════════════════════════════════════════════════
-- BILLING
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS drchrono_line_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_line_item_id INTEGER UNIQUE NOT NULL,
  drchrono_appointment_id INTEGER,
  drchrono_patient_id INTEGER,
  doctor INTEGER,
  code TEXT,
  procedure_type TEXT,
  description TEXT,
  quantity NUMERIC,
  units TEXT,
  price NUMERIC,
  allowed NUMERIC,
  balance_ins NUMERIC,
  balance_pt NUMERIC,
  balance_total NUMERIC,
  paid_total NUMERIC,
  adjustment NUMERIC,
  ins1_paid NUMERIC,
  ins2_paid NUMERIC,
  ins3_paid NUMERIC,
  pt_paid NUMERIC,
  billing_status TEXT,
  icd10_codes JSONB,
  posted_date TEXT,
  service_date TEXT,
  drchrono_updated_at TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drchrono_line_items_patient ON drchrono_line_items(drchrono_patient_id);
CREATE INDEX IF NOT EXISTS idx_drchrono_line_items_appt ON drchrono_line_items(drchrono_appointment_id);

CREATE TABLE IF NOT EXISTS drchrono_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_transaction_id INTEGER UNIQUE NOT NULL,
  drchrono_line_item_id INTEGER,
  drchrono_appointment_id INTEGER,
  drchrono_patient_id INTEGER,
  doctor INTEGER,
  posted_date TEXT,
  adjustment NUMERIC,
  adjustment_reason TEXT,
  ins_paid NUMERIC,
  ins_name TEXT,
  check_date TEXT,
  check_number TEXT,
  claim_status TEXT,
  trace_number TEXT,
  drchrono_updated_at TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drchrono_transactions_patient ON drchrono_transactions(drchrono_patient_id);
CREATE INDEX IF NOT EXISTS idx_drchrono_transactions_line_item ON drchrono_transactions(drchrono_line_item_id);

CREATE TABLE IF NOT EXISTS drchrono_patient_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_payment_id INTEGER UNIQUE NOT NULL,
  drchrono_patient_id INTEGER,
  drchrono_appointment_id INTEGER,
  doctor INTEGER,
  amount NUMERIC,
  payment_method TEXT,
  payment_transaction_type TEXT,
  notes TEXT,
  posted_date TEXT,
  trace_number TEXT,
  drchrono_created_at TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drchrono_patient_payments_patient ON drchrono_patient_payments(drchrono_patient_id);

-- ══════════════════════════════════════════════════════════════
-- CUSTOM
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS drchrono_custom_demographics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_field_id INTEGER UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  field_type TEXT,
  allowed_values JSONB,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- SYNC LOG (if not exists)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS drchrono_sync_log (
  id SERIAL PRIMARY KEY,
  sync_type TEXT,
  sync_mode TEXT,
  status TEXT DEFAULT 'in_progress',
  doctor_id UUID,
  records_synced INTEGER DEFAULT 0,
  records_errored INTEGER DEFAULT 0,
  metadata JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ══════════════════════════════════════════════════════════════
-- DONE — All 25 tables + sync_log ready
-- ══════════════════════════════════════════════════════════════
