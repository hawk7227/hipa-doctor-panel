# Database Migrations Guide

This document contains SQL migrations needed for the doctor panel application.

## Migration Files

1. **add_transcription_column.sql** - Adds transcription column to appointments table
2. **create_cdss_responses_table.sql** - Creates the cdss_responses table for storing CDSS analysis

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Open your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of the migration file
4. Click **Run** to execute the migration

### Option 2: Supabase CLI

If you have Supabase CLI installed:

```bash
supabase db push
```

## Migration Details

### 1. Transcription Column (`add_transcription_column.sql`)

**Purpose**: Adds a column to store meeting transcription text from Zoom recordings.

**Changes**:
- Adds `transcription TEXT` column to `appointments` table
- Column is nullable (can be null if no transcription available)

**Run this migration first** before using transcription features.

### 2. CDSS Responses Table (`create_cdss_responses_table.sql`)

**Purpose**: Creates a table to store Clinical Decision Support System (CDSS) AI-generated responses.

**Changes**:
- Creates `cdss_responses` table with:
  - `id` (UUID, primary key)
  - `appointment_id` (UUID, foreign key to appointments)
  - `response_data` (JSONB, stores the full CDSS response)
  - `created_by` (UUID, references auth.users)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)
- Creates indexes for performance
- Sets up Row Level Security (RLS) policies
- Creates trigger for auto-updating `updated_at`

**Run this migration** before using CDSS generation features.

## Migration Order

Run migrations in this order:
1. `add_transcription_column.sql`
2. `create_cdss_responses_table.sql`

## Verification

After running migrations, verify they were successful:

```sql
-- Check transcription column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name = 'transcription';

-- Check cdss_responses table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'cdss_responses';

-- Check cdss_responses columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cdss_responses';
```

## Troubleshooting

If you encounter errors:

1. **Table already exists**: The migrations use `IF NOT EXISTS` so they're safe to run multiple times
2. **Column already exists**: The transcription migration uses `IF NOT EXISTS` 
3. **Permission errors**: Make sure you're running as a database admin/superuser
4. **RLS errors**: The policies are set up for doctors - adjust if needed for your auth setup

