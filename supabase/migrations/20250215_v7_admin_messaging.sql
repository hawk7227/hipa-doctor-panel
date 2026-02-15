-- ═══════════════════════════════════════════════════════════
-- V7: Admin ↔ Doctor Messaging Tables
-- ═══════════════════════════════════════════════════════════

-- Admin-Doctor Conversations
CREATE TABLE IF NOT EXISTS admin_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  doctor_name TEXT NOT NULL DEFAULT '',
  doctor_specialty TEXT DEFAULT '',
  last_message TEXT DEFAULT '',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  unread_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin-Doctor Messages
CREATE TABLE IF NOT EXISTS admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES admin_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL DEFAULT 'admin', -- 'admin' or 'doctor'
  sender_name TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  message_type TEXT DEFAULT 'text', -- 'text', 'system', 'alert'
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_conversations_doctor ON admin_conversations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_admin_conversations_status ON admin_conversations(status);
CREATE INDEX IF NOT EXISTS idx_admin_conversations_pinned ON admin_conversations(is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_admin_messages_conversation ON admin_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_unread ON admin_messages(conversation_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_admin_messages_created ON admin_messages(created_at DESC);

-- RLS
ALTER TABLE admin_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;

-- Admin can see all, doctors see their own
CREATE POLICY admin_conversations_all ON admin_conversations FOR ALL USING (true);
CREATE POLICY admin_messages_all ON admin_messages FOR ALL USING (true);
