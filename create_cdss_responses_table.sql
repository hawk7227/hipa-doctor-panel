-- Create cdss_responses table for storing CDSS (Clinical Decision Support System) responses
-- This table stores AI-generated clinical analysis and recommendations for appointments

CREATE TABLE IF NOT EXISTS cdss_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  response_data JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cdss_responses_appointment_id ON cdss_responses(appointment_id);
CREATE INDEX IF NOT EXISTS idx_cdss_responses_created_by ON cdss_responses(created_by);
CREATE INDEX IF NOT EXISTS idx_cdss_responses_created_at ON cdss_responses(created_at DESC);

-- Create index on JSONB field for faster queries
CREATE INDEX IF NOT EXISTS idx_cdss_responses_response_data ON cdss_responses USING GIN(response_data);

-- Add comment to document the table
COMMENT ON TABLE cdss_responses IS 'Stores Clinical Decision Support System (CDSS) AI-generated responses for appointments';
COMMENT ON COLUMN cdss_responses.response_data IS 'JSON object containing CDSS analysis including classification, risk assessment, templates, and medication suggestions';
COMMENT ON COLUMN cdss_responses.created_by IS 'User ID (doctor) who generated or triggered the CDSS response';

-- Enable Row Level Security (RLS)
ALTER TABLE cdss_responses ENABLE ROW LEVEL SECURITY;

-- Create policy: Doctors can read CDSS responses for their appointments
CREATE POLICY "Doctors can read CDSS responses for their appointments"
  ON cdss_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM appointments 
      WHERE appointments.id = cdss_responses.appointment_id 
      AND appointments.doctor_id IN (
        SELECT id FROM doctors 
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- Create policy: Doctors can insert CDSS responses for their appointments
CREATE POLICY "Doctors can insert CDSS responses for their appointments"
  ON cdss_responses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM appointments 
      WHERE appointments.id = cdss_responses.appointment_id 
      AND appointments.doctor_id IN (
        SELECT id FROM doctors 
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- Create policy: Doctors can update CDSS responses for their appointments
CREATE POLICY "Doctors can update CDSS responses for their appointments"
  ON cdss_responses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM appointments 
      WHERE appointments.id = cdss_responses.appointment_id 
      AND appointments.doctor_id IN (
        SELECT id FROM doctors 
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cdss_responses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_cdss_responses_updated_at
  BEFORE UPDATE ON cdss_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_cdss_responses_updated_at();

