-- ═══════════════════════════════════════════════════════════════
-- DrChrono Sync Tables — documents, appointments, lab_orders
-- Run AFTER create_documents_enterprise.sql
-- ═══════════════════════════════════════════════════════════════

-- DrChrono Documents (synced from DrChrono API)
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

-- DrChrono Appointments (synced from DrChrono API)
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

-- DrChrono Lab Orders (synced from DrChrono API)
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
