-- Create doctor_weekly_hours table for storing weekly recurring availability
CREATE TABLE IF NOT EXISTS doctor_weekly_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  -- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(doctor_id, day_of_week, start_time, end_time)
);

-- Create doctor_date_specific_hours table for storing date-specific availability
CREATE TABLE IF NOT EXISTS doctor_date_specific_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(doctor_id, date, start_time, end_time)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_doctor_weekly_hours_doctor_id ON doctor_weekly_hours(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_weekly_hours_day ON doctor_weekly_hours(day_of_week);

CREATE INDEX IF NOT EXISTS idx_doctor_date_specific_hours_doctor_id ON doctor_date_specific_hours(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_date_specific_hours_date ON doctor_date_specific_hours(date);

-- Enable Row Level Security (RLS)
ALTER TABLE doctor_weekly_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_date_specific_hours ENABLE ROW LEVEL SECURITY;

-- Create policies for doctor_weekly_hours
-- Allow doctors to read their own weekly hours
CREATE POLICY "Doctors can read their own weekly hours"
  ON doctor_weekly_hours
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM doctors 
      WHERE doctors.id = doctor_weekly_hours.doctor_id 
      AND doctors.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Allow doctors to insert their own weekly hours
CREATE POLICY "Doctors can insert their own weekly hours"
  ON doctor_weekly_hours
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM doctors 
      WHERE doctors.id = doctor_weekly_hours.doctor_id 
      AND doctors.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Allow doctors to update their own weekly hours
CREATE POLICY "Doctors can update their own weekly hours"
  ON doctor_weekly_hours
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM doctors 
      WHERE doctors.id = doctor_weekly_hours.doctor_id 
      AND doctors.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Allow doctors to delete their own weekly hours
CREATE POLICY "Doctors can delete their own weekly hours"
  ON doctor_weekly_hours
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM doctors 
      WHERE doctors.id = doctor_weekly_hours.doctor_id 
      AND doctors.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Create policies for doctor_date_specific_hours
-- Allow doctors to read their own date-specific hours
CREATE POLICY "Doctors can read their own date-specific hours"
  ON doctor_date_specific_hours
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM doctors 
      WHERE doctors.id = doctor_date_specific_hours.doctor_id 
      AND doctors.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Allow doctors to insert their own date-specific hours
CREATE POLICY "Doctors can insert their own date-specific hours"
  ON doctor_date_specific_hours
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM doctors 
      WHERE doctors.id = doctor_date_specific_hours.doctor_id 
      AND doctors.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Allow doctors to update their own date-specific hours
CREATE POLICY "Doctors can update their own date-specific hours"
  ON doctor_date_specific_hours
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM doctors 
      WHERE doctors.id = doctor_date_specific_hours.doctor_id 
      AND doctors.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Allow doctors to delete their own date-specific hours
CREATE POLICY "Doctors can delete their own date-specific hours"
  ON doctor_date_specific_hours
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM doctors 
      WHERE doctors.id = doctor_date_specific_hours.doctor_id 
      AND doctors.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_doctor_weekly_hours_updated_at
  BEFORE UPDATE ON doctor_weekly_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctor_date_specific_hours_updated_at
  BEFORE UPDATE ON doctor_date_specific_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

