-- ═══════════════════════════════════════════════════════════════
-- ENTERPRISE STAFF COMMUNICATION SYSTEM
-- Tables: staff_messages, staff_conversations, staff_tasks, staff_notifications
-- Supabase Realtime: broadcast + presence for live messaging
-- ═══════════════════════════════════════════════════════════════

-- 1. Staff Conversations (channels/threads)
CREATE TABLE IF NOT EXISTS staff_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('direct', 'group', 'channel', 'patient_context')),
  name TEXT, -- null for direct, name for group/channel
  description TEXT,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL, -- for patient_context type
  created_by UUID NOT NULL REFERENCES doctor_staff(id) ON DELETE CASCADE,
  is_archived BOOLEAN DEFAULT FALSE,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Conversation Participants
CREATE TABLE IF NOT EXISTS staff_conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES staff_conversations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES doctor_staff(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  is_muted BOOLEAN DEFAULT FALSE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, staff_id)
);

-- 3. Staff Messages
CREATE TABLE IF NOT EXISTS staff_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES staff_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES doctor_staff(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'task_ref', 'patient_ref', 'file', 'call_started', 'call_ended')),
  reply_to_id UUID REFERENCES staff_messages(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}', -- for file URLs, call duration, etc.
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Message Read Receipts
CREATE TABLE IF NOT EXISTS staff_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES staff_messages(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES doctor_staff(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, staff_id)
);

-- 5. Staff Tasks (DrChrono-style task center)
CREATE TABLE IF NOT EXISTS staff_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  category TEXT DEFAULT 'general' CHECK (category IN (
    'general', 'chart_review', 'billing', 'scheduling', 'patient_followup',
    'lab_review', 'prescription', 'referral', 'documentation', 'admin'
  )),
  assigned_to UUID REFERENCES doctor_staff(id) ON DELETE SET NULL,
  assigned_by UUID NOT NULL REFERENCES doctor_staff(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES doctor_staff(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Task Comments
CREATE TABLE IF NOT EXISTS staff_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES staff_tasks(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES doctor_staff(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Staff Notifications
CREATE TABLE IF NOT EXISTS staff_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES doctor_staff(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'message', 'task_assigned', 'task_completed', 'task_due',
    'mention', 'call_incoming', 'call_missed', 'chart_update',
    'schedule_change', 'system', 'urgent'
  )),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT, -- URL path to navigate to
  reference_type TEXT, -- 'message', 'task', 'appointment', etc.
  reference_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Staff Call Log (internal staff-to-staff calls)
CREATE TABLE IF NOT EXISTS staff_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL REFERENCES doctor_staff(id) ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES doctor_staff(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('voice', 'video')),
  status TEXT DEFAULT 'ringing' CHECK (status IN ('ringing', 'connected', 'missed', 'declined', 'ended')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  connected_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  daily_room_url TEXT, -- Daily.co room URL for video
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ INDEXES ═══
CREATE INDEX IF NOT EXISTS idx_staff_messages_conversation ON staff_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_messages_sender ON staff_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_staff_conv_participants ON staff_conversation_participants(staff_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_staff_conv_doctor ON staff_conversations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_assigned ON staff_tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_doctor ON staff_tasks(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_recipient ON staff_notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_call_log_callee ON staff_call_log(callee_id, status);

-- ═══ RLS ═══
ALTER TABLE staff_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_call_log ENABLE ROW LEVEL SECURITY;

-- ═══ UPDATED_AT TRIGGERS ═══
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_staff_conversations_updated_at
  BEFORE UPDATE ON staff_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_tasks_updated_at
  BEFORE UPDATE ON staff_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
