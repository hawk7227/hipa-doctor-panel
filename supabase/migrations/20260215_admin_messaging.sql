-- ═══════════════════════════════════════════════════════════════
-- ADMIN-DOCTOR MESSAGING TABLES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS admin_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  doctor_name TEXT NOT NULL,
  doctor_specialty TEXT DEFAULT '',
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  unread_count INT DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES admin_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'doctor')),
  sender_name TEXT NOT NULL DEFAULT 'Admin',
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_conv_doctor ON admin_conversations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_admin_msg_conv ON admin_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_admin_msg_created ON admin_messages(created_at);
