-- ═══════════════════════════════════════════════════════════════
-- MEDAZON HEALTH — HIPAA AUDIT LOGGING
-- Phase I: Immutable audit trail for all PHI access and modifications
-- ═══════════════════════════════════════════════════════════════

-- Audit log table — append-only, no updates or deletes
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Who
  actor_id uuid REFERENCES auth.users(id),  -- Supabase auth user
  actor_email text,                          -- Denormalized for quick display
  actor_role text DEFAULT 'doctor',          -- 'doctor', 'assistant', 'admin', 'system'
  
  -- What
  action text NOT NULL,                      -- e.g. 'VIEW_PATIENT', 'UPDATE_CHART', 'EXPORT_PDF'
  resource_type text NOT NULL,               -- e.g. 'appointment', 'patient', 'clinical_note', 'chart'
  resource_id text,                          -- ID of the affected record
  
  -- Details
  description text,                          -- Human-readable summary
  metadata jsonb DEFAULT '{}',               -- Additional context (old values, new values, etc.)
  
  -- Where
  ip_address inet,
  user_agent text,
  
  -- When
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON audit_logs(actor_id, created_at DESC);

-- RLS: Doctors can only read their own audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Read policy: users can see their own logs
CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (actor_id = auth.uid());

-- Insert policy: authenticated users can create logs
CREATE POLICY "Authenticated users can create audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- NO update or delete policies — audit logs are immutable
-- This is a HIPAA requirement: audit trails cannot be modified

-- ═══════════════════════════════════════════════════════════════
-- PRACTICE STAFF TABLE (Phase G prep)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS practice_staff (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Link to auth
  user_id uuid REFERENCES auth.users(id),
  email text UNIQUE NOT NULL,
  
  -- Profile
  first_name text NOT NULL,
  last_name text NOT NULL,
  role text NOT NULL DEFAULT 'assistant',    -- 'doctor', 'assistant', 'admin', 'billing'
  
  -- Relationships
  doctor_id uuid REFERENCES doctors(id),     -- Which doctor they work for
  
  -- Permissions (RBAC)
  permissions jsonb DEFAULT '[]',            -- Array of permission strings
  
  -- Status
  active boolean DEFAULT true,
  last_login_at timestamptz,
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  
  -- Meta
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_staff_doctor ON practice_staff(doctor_id);
CREATE INDEX IF NOT EXISTS idx_practice_staff_email ON practice_staff(email);
CREATE INDEX IF NOT EXISTS idx_practice_staff_user ON practice_staff(user_id);

ALTER TABLE practice_staff ENABLE ROW LEVEL SECURITY;

-- Doctors can see their own staff
CREATE POLICY "Doctors can view own staff"
  ON practice_staff FOR SELECT
  USING (doctor_id IN (SELECT id FROM doctors WHERE email = auth.jwt()->>'email'));

-- Doctors can manage their own staff
CREATE POLICY "Doctors can manage own staff"
  ON practice_staff FOR ALL
  USING (doctor_id IN (SELECT id FROM doctors WHERE email = auth.jwt()->>'email'));

COMMENT ON TABLE audit_logs IS 'HIPAA-compliant immutable audit trail for all PHI access';
COMMENT ON TABLE practice_staff IS 'Staff members (assistants, billing) linked to doctors';
