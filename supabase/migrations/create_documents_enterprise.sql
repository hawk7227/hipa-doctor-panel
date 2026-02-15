-- ═══════════════════════════════════════════════════════════════
-- Documents Enterprise Schema
-- Tables: patient_documents, document_tags, patient_tasks,
--         patient_referrals, chart_amendments, document_fax_log
-- ═══════════════════════════════════════════════════════════════

-- Patient Documents (local uploads + metadata)
CREATE TABLE IF NOT EXISTS patient_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id),
  appointment_id UUID REFERENCES appointments(id),
  file_name TEXT NOT NULL,
  description TEXT,
  document_type TEXT DEFAULT 'general', -- general, consent, referral, lab, imaging, insurance, billing, clinical
  file_url TEXT,
  file_size INTEGER,
  mime_type TEXT,
  tags TEXT[] DEFAULT '{}',
  uploaded_by TEXT, -- doctor email or 'patient'
  uploaded_by_type TEXT DEFAULT 'doctor', -- doctor, patient, system
  is_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_documents_patient ON patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_type ON patient_documents(document_type);

-- Document Tags (available tags per practice)
CREATE TABLE IF NOT EXISTS document_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID REFERENCES doctors(id),
  tag_name TEXT NOT NULL,
  tag_color TEXT DEFAULT '#64748b',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patient Tasks
CREATE TABLE IF NOT EXISTS patient_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id),
  document_id UUID REFERENCES patient_documents(id),
  appointment_id UUID REFERENCES appointments(id),
  title TEXT NOT NULL,
  description TEXT,
  assignee TEXT, -- staff email or name
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_tasks_patient ON patient_tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_tasks_status ON patient_tasks(status);

-- Patient Referrals (outbound)
CREATE TABLE IF NOT EXISTS patient_referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id),
  document_id UUID REFERENCES patient_documents(id),
  referral_to TEXT NOT NULL, -- provider/facility name
  referral_to_specialty TEXT,
  referral_to_phone TEXT,
  referral_to_fax TEXT,
  referral_to_address TEXT,
  referral_reason TEXT,
  icd10_codes TEXT[], -- associated diagnosis codes
  urgency TEXT DEFAULT 'routine', -- routine, urgent, emergent
  status TEXT DEFAULT 'pending', -- pending, sent, accepted, completed, declined
  notes TEXT,
  sent_at TIMESTAMPTZ,
  sent_via TEXT, -- fax, email, portal
  response_notes TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_referrals_patient ON patient_referrals(patient_id);

-- Chart Amendments
CREATE TABLE IF NOT EXISTS chart_amendments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id),
  appointment_id UUID REFERENCES appointments(id),
  clinical_note_id UUID,
  amendment_type TEXT DEFAULT 'correction', -- correction, addendum, clarification
  original_content TEXT,
  amended_content TEXT,
  amendment_reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, accepted, denied
  requested_by TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chart_amendments_patient ON chart_amendments(patient_id);

-- Document Fax Log
CREATE TABLE IF NOT EXISTS document_fax_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  document_id UUID REFERENCES patient_documents(id),
  fax_number TEXT NOT NULL,
  recipient_name TEXT,
  status TEXT DEFAULT 'queued', -- queued, sent, delivered, failed
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  sent_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_fax_log_patient ON document_fax_log(patient_id);

-- RLS Policies (basic — doctor access)
ALTER TABLE patient_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_fax_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage their patient data
-- (Service role key bypasses RLS, so API routes work as-is)
