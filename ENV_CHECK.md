# Environment Variables Check

## Required Environment Variables

### ✅ Core (Required)
These are **REQUIRED** for the application to function:

```bash
# Supabase Configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 🔑 Features (Required for specific features)

#### CDSS (Clinical Decision Support System)
```bash
# OpenAI API Key (REQUIRED for CDSS feature)
OPENAI_API_KEY=sk-...

# OpenAI Prompt ID (OPTIONAL - uses default if not set)
OPENAI_PROMPT_ID=your-prompt-id
```

#### Twilio (SMS/Voice Communication)
```bash
# Twilio Account SID
TWILIO_ACCOUNT_SID=AC...

# Twilio Auth Token
TWILIO_AUTH_TOKEN=your-auth-token

# Twilio Phone Number
TWILIO_PHONE_NUMBER=+1234567890
```

#### Stripe (Payments)
```bash
# Stripe Secret Key
STRIPE_SECRET_KEY=sk_...

# Stripe Publishable Key (for frontend)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...

# Stripe Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### Zoom (Video Calls)
```bash
# Zoom SDK Key
NEXT_PUBLIC_ZOOM_SDK_KEY=your-zoom-sdk-key

# Zoom SDK Secret
ZOOM_SDK_SECRET=your-zoom-sdk-secret
```

#### Email (SMTP)
```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

#### ClickSend (SMS Alternative)
```bash
# ClickSend API Username
CLICKSEND_API_USERNAME=your-username

# ClickSend API Key
CLICKSEND_API_KEY=your-api-key
```

## How to Check Your Environment Variables

### Option 1: Check in Code (Runtime Check)

Create a test file `src/app/api/env-check/route.ts`:

```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  const envVars = {
    // Core
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    
    // CDSS
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    OPENAI_PROMPT_ID: !!process.env.OPENAI_PROMPT_ID,
    
    // Twilio
    TWILIO_ACCOUNT_SID: !!process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: !!process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: !!process.env.TWILIO_PHONE_NUMBER,
    
    // Stripe
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    
    // Zoom
    NEXT_PUBLIC_ZOOM_SDK_KEY: !!process.env.NEXT_PUBLIC_ZOOM_SDK_KEY,
    ZOOM_SDK_SECRET: !!process.env.ZOOM_SDK_SECRET,
    
    // Email
    SMTP_HOST: !!process.env.SMTP_HOST,
    SMTP_USER: !!process.env.SMTP_USER,
  }
  
  const missing = Object.entries(envVars)
    .filter(([_, exists]) => !exists)
    .map(([key]) => key)
  
  return NextResponse.json({
    status: missing.length === 0 ? 'ok' : 'missing_vars',
    envVars,
    missing,
    message: missing.length === 0 
      ? 'All required environment variables are set' 
      : `Missing: ${missing.join(', ')}`
  })
}
```

Then visit: `http://localhost:3000/api/env-check`

### Option 2: Manual Check

1. **Check if `.env.local` exists:**
   ```bash
   # In PowerShell
   Test-Path .env.local
   
   # In Bash
   ls -la .env.local
   ```

2. **Check environment variables (without exposing values):**
   ```bash
   # PowerShell
   Get-Content .env.local | Select-String "NEXT_PUBLIC_SUPABASE_URL"
   
   # Bash
   grep "NEXT_PUBLIC_SUPABASE_URL" .env.local
   ```

## Current Status Check

Based on code analysis:

### ✅ Currently Used in Code:
- `NEXT_PUBLIC_SUPABASE_URL` - Used in: `supabase.ts`, API routes
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Used in: `supabase.ts`, API routes
- `OPENAI_API_KEY` - Used in: `api/cdss/generate/route.ts`
- `OPENAI_PROMPT_ID` - Used in: `api/cdss/generate/route.ts` (optional)

### ⚠️ Check These Files:
- `src/lib/twilio.ts` - Uses Twilio env vars
- `src/lib/stripe.ts` - Uses Stripe env vars
- `src/lib/zoom.ts` - Uses Zoom env vars
- `src/lib/smtp.ts` - Uses SMTP env vars
- `src/lib/clicksend.ts` - Uses ClickSend env vars

## Production Setup

### For Vercel/Netlify:
1. Go to Project Settings → Environment Variables
2. Add all required variables
3. Redeploy

### For Local Development:
1. Create `.env.local` file in root directory
2. Add all required variables
3. Restart dev server

### For Docker:
1. Add to `docker-compose.yml` or `.env` file
2. Rebuild containers

## Quick Test

Run this to test Supabase connection:

```typescript
// In browser console or API route
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
} else {
  console.log('✅ Supabase credentials found')
  console.log('URL:', supabaseUrl.substring(0, 30) + '...')
}
```

## Troubleshooting

### Issue: "NEXT_PUBLIC_SUPABASE_URL is not defined"
**Solution:** 
- Check if `.env.local` exists
- Verify variable name (must start with `NEXT_PUBLIC_` for client-side)
- Restart dev server after adding env vars

### Issue: "OPENAI_API_KEY is not defined"
**Solution:**
- CDSS feature won't work without this
- Add to `.env.local` or deployment platform
- Restart server

### Issue: Environment variables not loading
**Solution:**
- Make sure file is named `.env.local` (not `.env`)
- Restart Next.js dev server
- Check for typos in variable names
- Ensure no spaces around `=` sign

