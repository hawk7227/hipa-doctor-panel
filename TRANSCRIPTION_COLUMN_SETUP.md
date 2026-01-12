# Transcription Column Setup

This document explains how to add the `transcription` column to the `appointments` table in Supabase.

## Step 1: Run the SQL Migration

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `add_transcription_column.sql`
4. Click **Run** to execute the migration

Alternatively, you can run this SQL directly:

```sql
-- Add transcription column to appointments table
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS transcription TEXT;

-- Add comment to document the column
COMMENT ON COLUMN appointments.transcription IS 'Stores the transcription text from Zoom meeting recordings';
```

## Step 2: Verify the Column

After running the migration, verify the column was added:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name = 'transcription';
```

## How It Works

Once the column is added:

1. **When fetching recordings**: The API will automatically check if transcription exists
2. **If transcription is empty/null**: The system will:
   - Fetch the transcription file from Zoom using the meeting ID
   - Download the transcription content
   - Save it to the `transcription` column in the database
3. **If transcription already exists**: The system will use the cached version

## Features

- ✅ Automatically fetches transcription when empty
- ✅ Uses meeting ID (`zoom_meeting_id` or `calendly_event_uuid`) to get transcription
- ✅ Saves transcription to database for future use
- ✅ Handles errors gracefully if column doesn't exist yet
- ✅ Logs all steps for debugging

## Notes

- Transcription files are downloaded from Zoom's recording files
- Prefers VTT format, then TXT format
- Full transcription content is logged for debugging (if < 10KB)
- The column uses TEXT type to support long transcriptions

