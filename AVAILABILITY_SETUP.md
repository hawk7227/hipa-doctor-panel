# Availability Page Setup Guide

This guide will help you set up the new Calendly-style availability page for doctors.

## Database Setup

### Step 1: Run SQL Script in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase_availability_schema.sql`
4. Click **Run** to execute the script

This will create:
- `doctor_weekly_hours` table - for storing recurring weekly availability
- `doctor_date_specific_hours` table - for storing date-specific availability
- Required indexes for performance
- Row Level Security (RLS) policies
- Automatic timestamp updates

### Step 2: Verify Tables

After running the script, verify the tables exist:
- Go to **Table Editor** in Supabase
- You should see `doctor_weekly_hours` and `doctor_date_specific_hours` tables

## Features

### Weekly Hours
- Set availability for each day of the week (Sunday - Saturday)
- Add multiple time slots per day
- Copy time slots to all days
- Mark days as unavailable
- Save weekly recurring schedule

### Date-Specific Hours
- Select specific dates using calendar picker
- Set custom hours for selected dates
- View and manage all date-specific hours
- Delete date-specific hours

### Timezone Support
- Select timezone (default: Pakistan, Maldives Time)
- All times are stored in 24-hour format in the database
- Displayed in 12-hour format (AM/PM) in the UI

## Usage

1. Navigate to `/doctor/availability` in your application
2. **Set Weekly Hours:**
   - Click the "+" icon next to any day to add availability
   - Enter start and end times (e.g., "9:00am", "5:00pm")
   - Add multiple time slots per day if needed
   - Use the copy icon to copy a time slot to all other days
   - Click "Save Weekly Hours" to persist changes

3. **Set Date-Specific Hours:**
   - Click the "+ Hours" button in the Date-specific hours section
   - Select one or more dates in the calendar
   - Set the available hours
   - Click "Save" to apply

## Time Format

- **Input:** Users can enter times in 12-hour format (e.g., "9:00am", "5:00pm")
- **Storage:** Times are stored in 24-hour format (HH:mm) in the database
- **Display:** Times are displayed in 12-hour format with AM/PM

## Database Schema

### doctor_weekly_hours
- `id` - UUID primary key
- `doctor_id` - Foreign key to doctors table
- `day_of_week` - Integer (0=Sunday, 1=Monday, ..., 6=Saturday)
- `start_time` - TIME
- `end_time` - TIME
- `created_at` - Timestamp
- `updated_at` - Timestamp

### doctor_date_specific_hours
- `id` - UUID primary key
- `doctor_id` - Foreign key to doctors table
- `date` - DATE
- `start_time` - TIME
- `end_time` - TIME
- `created_at` - Timestamp
- `updated_at` - Timestamp

## Troubleshooting

### Tables Not Found Error
If you see "Database table not found" error:
1. Make sure you've run the SQL script in Supabase
2. Check that the tables exist in the Table Editor
3. Verify table names match exactly: `doctor_weekly_hours` and `doctor_date_specific_hours`

### RLS Policy Issues
If you get permission errors:
1. Check that RLS policies were created successfully
2. Verify your authentication is working
3. Ensure the doctor record exists and email matches auth user email

### Time Format Issues
- Times should be entered in 12-hour format with AM/PM
- Examples: "9:00am", "12:30pm", "1:15pm", "5:00pm"
- The system will automatically convert to 24-hour format for storage















