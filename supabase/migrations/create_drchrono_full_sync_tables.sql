-- ═══════════════════════════════════════════════════════════════
-- DrChrono Full Sync Tables — ALL remaining entities
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── BILLING ───────────────────────────────────────────────────

-- Line Items (CPT codes, charges, insurance billing)
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

-- Insurance Transactions (ERA/EOB payments)
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

-- Patient Payments (copays, self-pay, etc.)
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

-- ── PRACTICE MANAGEMENT ───────────────────────────────────────

-- Offices
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

-- Doctors / Providers
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

-- Users (staff, admin, etc.)
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

-- ── TASKS ─────────────────────────────────────────────────────

-- Tasks
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

-- Task Categories
CREATE TABLE IF NOT EXISTS drchrono_task_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_category_id INTEGER UNIQUE NOT NULL,
  name TEXT,
  since TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── CLINICAL ──────────────────────────────────────────────────

-- Amendments (chart amendments)
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

-- Patient Communications
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

-- Appointment Profiles (visit types)
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

-- Lab Tests (individual test definitions within orders)
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

-- Messages (doctor message center)
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

-- Reminder Profiles (appointment reminders)
CREATE TABLE IF NOT EXISTS drchrono_reminder_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_reminder_profile_id INTEGER UNIQUE NOT NULL,
  name TEXT,
  reminders JSONB,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom Demographics (custom patient fields)
CREATE TABLE IF NOT EXISTS drchrono_custom_demographics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drchrono_field_id INTEGER UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  field_type TEXT,
  allowed_values JSONB,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
