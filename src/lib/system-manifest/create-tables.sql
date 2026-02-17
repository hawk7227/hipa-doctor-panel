-- System Health Log — stores results of every health check run
CREATE TABLE IF NOT EXISTS system_health_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  status text NOT NULL, -- 'healthy', 'degraded', 'unhealthy'
  passing int DEFAULT 0,
  failing int DEFAULT 0,
  warning int DEFAULT 0,
  total_checks int DEFAULT 0,
  results jsonb,
  duration_ms int,
  checked_at timestamptz DEFAULT now()
);

-- System Fix Log — stores every auto-fix attempt
CREATE TABLE IF NOT EXISTS system_fix_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fixes_attempted int DEFAULT 0,
  fixes_applied int DEFAULT 0,
  results jsonb,
  triggered_by text, -- 'auto-fix-all', 'manual-FIX-001', 'cron', etc.
  created_at timestamptz DEFAULT now()
);

-- Disable RLS so service role can write freely
ALTER TABLE system_health_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_fix_log DISABLE ROW LEVEL SECURITY;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_health_log_checked_at ON system_health_log(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_fix_log_created_at ON system_fix_log(created_at DESC);
