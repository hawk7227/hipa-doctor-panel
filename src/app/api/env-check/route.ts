// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextResponse } from 'next/server'

export async function GET() {
  // Check all environment variables
  const envVars = {
    // Core (Required)
    core: {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    
    // CDSS (Required for CDSS feature)
    cdss: {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      OPENAI_PROMPT_ID: !!process.env.OPENAI_PROMPT_ID,
    },
    
    // Twilio (Required for SMS/Voice)
    twilio: {
      TWILIO_ACCOUNT_SID: !!process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: !!process.env.TWILIO_AUTH_TOKEN,
      TWILIO_PHONE_NUMBER: !!process.env.TWILIO_PHONE_NUMBER,
    },
    
    // Stripe (Required for payments)
    stripe: {
      STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
    },
    
    // Zoom (Required for video calls)
    zoom: {
      NEXT_PUBLIC_ZOOM_SDK_KEY: !!process.env.NEXT_PUBLIC_ZOOM_SDK_KEY,
      ZOOM_SDK_SECRET: !!process.env.ZOOM_SDK_SECRET,
    },
    
    // Email (Required for email sending)
    email: {
      SMTP_HOST: !!process.env.SMTP_HOST,
      SMTP_PORT: !!process.env.SMTP_PORT,
      SMTP_USER: !!process.env.SMTP_USER,
      SMTP_PASSWORD: !!process.env.SMTP_PASSWORD,
      SMTP_FROM: !!process.env.SMTP_FROM,
    },
    
    // ClickSend (Alternative SMS)
    clicksend: {
      CLICKSEND_API_USERNAME: !!process.env.CLICKSEND_API_USERNAME,
      CLICKSEND_API_KEY: !!process.env.CLICKSEND_API_KEY,
    },
  }
  
  // Find missing required variables
  const missingCore = Object.entries(envVars.core)
    .filter(([_, exists]) => !exists)
    .map(([key]) => key)
  
  const missingCDSS = Object.entries(envVars.cdss)
    .filter(([_, exists]) => !exists)
    .map(([key]) => key)
  
  // Check Supabase URL format
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const isValidSupabaseUrl = supabaseUrl?.startsWith('https://') && supabaseUrl?.includes('.supabase.co')
  
  // Summary
  const summary = {
    status: missingCore.length === 0 ? 'ok' : 'missing_required',
    coreReady: missingCore.length === 0,
    cdssReady: missingCDSS.length === 0,
    supabaseUrlValid: isValidSupabaseUrl,
    message: missingCore.length === 0 
      ? '✅ All core environment variables are set' 
      : `❌ Missing core variables: ${missingCore.join(', ')}`,
    warnings: [] as string[],
  }
  
  // Add warnings
  if (!summary.cdssReady) {
    summary.warnings.push('CDSS feature will not work without OPENAI_API_KEY')
  }
  
  if (supabaseUrl && !isValidSupabaseUrl) {
    summary.warnings.push('Supabase URL format may be invalid (should start with https:// and contain .supabase.co)')
  }
  
  return NextResponse.json({
    ...summary,
    envVars,
    missing: {
      core: missingCore,
      cdss: missingCDSS,
    },
    recommendations: [
      missingCore.length > 0 && 'Add missing core variables to .env.local or deployment platform',
      missingCDSS.length > 0 && 'Add OPENAI_API_KEY to enable CDSS feature',
      !isValidSupabaseUrl && supabaseUrl && 'Check Supabase URL format',
    ].filter(Boolean),
  })
}

