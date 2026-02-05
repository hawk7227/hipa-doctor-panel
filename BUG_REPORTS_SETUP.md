# Bug Reports System - Supabase Setup

## Overview
This document contains the SQL migrations and Supabase Storage configuration needed for the bug reports system.

---

## Step 1: Create the `bug_reports` table

Run this SQL in your Supabase SQL Editor:

```sql
-- Bug Reports Table
CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  
  -- Report content
  description TEXT NOT NULL,
  page_url TEXT NOT NULL,
  github_file_path TEXT,
  github_file_url TEXT,
  browser_info TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'fixed', 'wont_fix')),
  admin_notes TEXT,
  admin_read BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- AI processing
  transcript TEXT,
  ai_summary TEXT,
  
  -- Attachments (videos, screenshots, annotations)
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Legacy single file fields (kept for backward compatibility)
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  
  -- Admin response
  admin_response_video_url TEXT,
  admin_response_video_name TEXT,
  
  -- Live session
  live_session_status TEXT CHECK (live_session_status IN ('requested', 'active', 'completed')),
  live_session_room_url TEXT,
  live_session_requested_by TEXT CHECK (live_session_requested_by IN ('admin', 'doctor')),
  live_session_requested_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_bug_reports_doctor_id ON bug_reports(doctor_id);
CREATE INDEX idx_bug_reports_status ON bug_reports(status);
CREATE INDEX idx_bug_reports_admin_read ON bug_reports(admin_read);
CREATE INDEX idx_bug_reports_created_at ON bug_reports(created_at DESC);
CREATE INDEX idx_bug_reports_live_session_status ON bug_reports(live_session_status) WHERE live_session_status IS NOT NULL;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_bug_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bug_reports_updated_at
  BEFORE UPDATE ON bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_bug_reports_updated_at();
```

---

## Step 2: Set up Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Doctors can view their own bug reports
CREATE POLICY "Doctors can view own bug reports"
  ON bug_reports
  FOR SELECT
  USING (
    doctor_id IN (
      SELECT id FROM doctors WHERE email = auth.jwt() ->> 'email'
    )
  );

-- Policy: Doctors can create bug reports
CREATE POLICY "Doctors can create bug reports"
  ON bug_reports
  FOR INSERT
  WITH CHECK (
    doctor_id IN (
      SELECT id FROM doctors WHERE email = auth.jwt() ->> 'email'
    )
  );

-- Policy: Allow all operations for service role (admin API routes)
-- Note: Service role bypasses RLS by default, but this is explicit
CREATE POLICY "Service role full access"
  ON bug_reports
  FOR ALL
  USING (auth.role() = 'service_role');

-- Alternative: If you need admin access via anon key with password check,
-- you can create an admin_users table or use a different approach.
-- For now, admin routes will use service role or bypass RLS via API.
```

---

## Step 3: Create Supabase Storage Bucket

1. Go to your Supabase Dashboard → Storage
2. Click "New bucket"
3. Create a bucket named: `bug-reports`
4. Settings:
   - Public bucket: **Yes** (so admin can view videos/images)
   - File size limit: **50MB** (enough for screen recordings)
   - Allowed MIME types: (leave empty to allow all, or specify):
     ```
     video/webm
     video/mp4
     video/quicktime
     image/png
     image/jpeg
     image/gif
     image/webp
     ```

### Storage Policies

Run this SQL to set up storage policies:

```sql
-- Allow authenticated users to upload to bug-reports bucket
CREATE POLICY "Authenticated users can upload bug report files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'bug-reports' 
    AND auth.role() = 'authenticated'
  );

-- Allow public read access (so admin can view without auth issues)
CREATE POLICY "Public read access for bug report files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'bug-reports');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Users can delete own bug report files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'bug-reports'
    AND auth.role() = 'authenticated'
  );
```

---

## Step 4: Environment Variables

Make sure these are set in your `.env.local` and Vercel:

```env
# Already should exist:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# For email notifications (should already exist):
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM=noreply@medazonhealth.com
ADMIN_EMAIL=providerid@medazonhealth.com

# For AI transcription/summary:
OPENAI_API_KEY=your_openai_key

# GitHub repo for source file links:
GITHUB_REPO_URL=https://github.com/hawk7227/hipa-doctor-panel/blob/master
```

---

## Step 5: Verify Setup

After running the SQL, verify:

1. **Table exists**: Go to Table Editor → `bug_reports` should appear
2. **Storage bucket exists**: Go to Storage → `bug-reports` bucket should appear
3. **RLS enabled**: Table should show RLS badge
4. **Indexes created**: Go to Database → Indexes → verify bug_reports indexes

---

## Attachments JSONB Structure

The `attachments` column stores an array of attachment objects:

```typescript
interface Attachment {
  id: string;                    // unique ID for this attachment
  type: 'video' | 'screenshot' | 'markers' | 'file';
  url: string;                   // Supabase Storage URL
  name: string;                  // original filename
  size?: number;                 // file size in bytes
  mime_type?: string;            // e.g., "video/webm"
  
  // Video-specific
  duration_seconds?: number;
  transcript?: string;
  
  // Screenshot/annotation-specific  
  annotations?: Array<{
    type: 'arrow' | 'circle' | 'rectangle' | 'text' | 'freehand';
    color: string;
    // Arrow
    from?: [number, number];
    to?: [number, number];
    // Circle
    center?: [number, number];
    radius?: number;
    // Rectangle
    position?: [number, number];
    width?: number;
    height?: number;
    // Text
    content?: string;
    fontSize?: number;
    // Freehand
    points?: Array<[number, number]>;
  }>;
  
  // Markers-specific
  markers?: Array<{
    number: number;
    position: [number, number];
    note: string;
  }>;
  
  created_at: string;            // ISO timestamp
}
```

---

## Troubleshooting

### "permission denied for table bug_reports"
- Check RLS policies are created correctly
- Verify the user is authenticated
- For admin routes, ensure service role key is used

### "bucket not found: bug-reports"
- Create the bucket in Supabase Dashboard → Storage
- Bucket name is case-sensitive: `bug-reports`

### Files not uploading
- Check file size (max 50MB)
- Verify storage policies are created
- Check browser console for CORS errors

### Transcription not working
- Verify OPENAI_API_KEY is set
- Check API quota/billing on OpenAI dashboard
