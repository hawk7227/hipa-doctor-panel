-- ═══════════════════════════════════════════════════════════════
-- MEDAZON HEALTH — WORKSPACE LAYOUTS TABLE
-- Stores panel positions, sizes, open/close state per doctor
-- Phase A: Foundation
-- ═══════════════════════════════════════════════════════════════

-- Create the table
CREATE TABLE IF NOT EXISTS doctor_workspace_layouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  layout_name TEXT NOT NULL DEFAULT 'default',
  layout_data JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Each doctor can only have one layout with a given name
  CONSTRAINT doctor_workspace_layouts_doctor_id_layout_name_key 
    UNIQUE (doctor_id, layout_name)
);

-- Index for fast lookup by doctor
CREATE INDEX IF NOT EXISTS idx_doctor_workspace_layouts_doctor_id 
  ON doctor_workspace_layouts(doctor_id);

-- Enable RLS
ALTER TABLE doctor_workspace_layouts ENABLE ROW LEVEL SECURITY;

-- RLS policies: doctors can only see/edit their own layouts
CREATE POLICY "Doctors can view own layouts"
  ON doctor_workspace_layouts
  FOR SELECT
  USING (doctor_id = auth.uid());

CREATE POLICY "Doctors can insert own layouts"
  ON doctor_workspace_layouts
  FOR INSERT
  WITH CHECK (doctor_id = auth.uid());

CREATE POLICY "Doctors can update own layouts"
  ON doctor_workspace_layouts
  FOR UPDATE
  USING (doctor_id = auth.uid())
  WITH CHECK (doctor_id = auth.uid());

CREATE POLICY "Doctors can delete own layouts"
  ON doctor_workspace_layouts
  FOR DELETE
  USING (doctor_id = auth.uid());

-- Service role bypass for API routes
CREATE POLICY "Service role full access"
  ON doctor_workspace_layouts
  FOR ALL
  USING (auth.role() = 'service_role');

-- Comment for documentation
COMMENT ON TABLE doctor_workspace_layouts IS 'Stores workspace panel layout configurations per doctor. Each doctor can have multiple named layouts with one default.';
COMMENT ON COLUMN doctor_workspace_layouts.layout_data IS 'JSONB map of panel_id -> { isOpen, position: {x,y}, size: {w,h}, isLocked, isMinimized }';
