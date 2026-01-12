-- Add transcription column to appointments table
-- This column will store the meeting transcription text

ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS transcription TEXT;

-- Add comment to document the column
COMMENT ON COLUMN appointments.transcription IS 'Stores the transcription text from Zoom meeting recordings';

