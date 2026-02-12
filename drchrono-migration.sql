-- DrChrono OAuth Token Storage
-- Only stores auth tokens, NOT patient data (HIPAA safe)

CREATE TABLE IF NOT EXISTS drchrono_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  token_type TEXT DEFAULT 'Bearer',
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Only service role can access tokens
ALTER TABLE drchrono_tokens ENABLE ROW LEVEL SECURITY;

-- No public access — only server-side via service role key
CREATE POLICY "No public access to drchrono_tokens"
  ON drchrono_tokens FOR ALL
  USING (false);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_drchrono_tokens_updated ON drchrono_tokens(updated_at DESC);
