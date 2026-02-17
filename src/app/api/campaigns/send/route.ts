// ============================================================================
// src/app/api/campaigns/send/route.ts
// CAMPAIGN SEND API — Retention Engine
//
// SMS/MMS: ClickSend (primary) → Twilio (fallback)
// Email:   Mailgun (primary) → SendGrid (fallback)
// Logs:    communication_history table in Supabase
//
// Matches existing messaging-service.ts patterns from communication2 page
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── ENV VARS (same ones already in Vercel) ──
const CLICKSEND_USERNAME = process.env.CLICKSEND_USERNAME;
const CLICKSEND_API_KEY = process.env.CLICKSEND_API_KEY;
const CLICKSEND_FROM = process.env.CLICKSEND_FROM || 'MedazonHealth';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const MAILGUN_FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL || `noreply@${MAILGUN_DOMAIN}`;
const MAILGUN_FROM_NAME = process.env.MAILGUN_FROM_NAME || 'Medazon Health';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'care@medazonhealth.com';

// ── HELPERS ──
function formatPhoneNumber(phone: string): string {
  let formatted = phone.replace(/\D/g, '');
  if (!formatted.startsWith('1') && formatted.length === 10) formatted = '1' + formatted;
  if (!formatted.startsWith('+')) formatted = '+' + formatted;
  return formatted;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════
// SMS — CLICKSEND (PRIMARY)
// ═══════════════════════════════════════════════════════════════
async function sendSMSClickSend(to: string, body: string): Promise<{ success: boolean; messageId?: string; cost?: number; error?: string }> {
  if (!CLICKSEND_USERNAME || !CLICKSEND_API_KEY) {
    return { success: false, error: 'ClickSend not configured' };
  }

  try {
    const response = await fetch('https://rest.clicksend.com/v3/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${CLICKSEND_USERNAME}:${CLICKSEND_API_KEY}`).toString('base64')}`,
      },
      body: JSON.stringify({
        messages: [{
          source: 'sdk',
          from: CLICKSEND_FROM,
          to: formatPhoneNumber(to),
          body: body,
        }],
      }),
    });

    const data = await response.json();

    if (data.response_code !== 'SUCCESS') {
      throw new Error(data.response_msg || 'ClickSend API error');
    }

    const msg = data.data?.messages?.[0];
    return {
      success: msg?.status === 'SUCCESS',
      messageId: msg?.message_id,
      cost: parseFloat(msg?.message_price || '0'),
    };
  } catch (error: any) {
    console.error('[ClickSend] SMS error:', error);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// SMS — TWILIO (FALLBACK)
// ═══════════════════════════════════════════════════════════════
async function sendSMSTwilio(to: string, body: string): Promise<{ success: boolean; messageId?: string; cost?: number; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const params = new URLSearchParams();
    params.append('To', formatPhoneNumber(to));
    params.append('Body', body);

    if (TWILIO_MESSAGING_SERVICE_SID) {
      params.append('MessagingServiceSid', TWILIO_MESSAGING_SERVICE_SID);
    } else if (TWILIO_PHONE_NUMBER) {
      params.append('From', TWILIO_PHONE_NUMBER);
    } else {
      return { success: false, error: 'Twilio phone number not configured' };
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        },
        body: params.toString(),
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Twilio API error');

    return {
      success: true,
      messageId: data.sid,
      cost: parseFloat(data.price || '0'),
    };
  } catch (error: any) {
    console.error('[Twilio] SMS error:', error);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// SMS — UNIFIED (ClickSend → Twilio fallback)
// ═══════════════════════════════════════════════════════════════
async function sendSMS(to: string, body: string): Promise<{ success: boolean; messageId?: string; provider?: string; cost?: number; error?: string }> {
  // Try ClickSend first
  if (CLICKSEND_USERNAME && CLICKSEND_API_KEY) {
    const result = await sendSMSClickSend(to, body);
    if (result.success) return { ...result, provider: 'clicksend' };
    console.log('[SMS] ClickSend failed, trying Twilio fallback:', result.error);
  }

  // Fallback to Twilio
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    const result = await sendSMSTwilio(to, body);
    return { ...result, provider: 'twilio' };
  }

  return { success: false, error: 'No SMS provider configured. Add ClickSend or Twilio credentials.' };
}

// ═══════════════════════════════════════════════════════════════
// MMS — CLICKSEND (PRIMARY)
// ═══════════════════════════════════════════════════════════════
async function sendMMSClickSend(to: string, body: string, mediaUrl: string): Promise<{ success: boolean; messageId?: string; cost?: number; error?: string }> {
  if (!CLICKSEND_USERNAME || !CLICKSEND_API_KEY) {
    return { success: false, error: 'ClickSend not configured' };
  }

  try {
    const response = await fetch('https://rest.clicksend.com/v3/mms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${CLICKSEND_USERNAME}:${CLICKSEND_API_KEY}`).toString('base64')}`,
      },
      body: JSON.stringify({
        media_file: mediaUrl,
        messages: [{
          source: 'sdk',
          from: CLICKSEND_FROM,
          to: formatPhoneNumber(to),
          body: body,
          subject: 'MMS',
        }],
      }),
    });

    const data = await response.json();
    if (data.response_code !== 'SUCCESS') throw new Error(data.response_msg || 'ClickSend MMS error');

    const msg = data.data?.messages?.[0];
    return {
      success: msg?.status === 'SUCCESS',
      messageId: msg?.message_id,
      cost: parseFloat(msg?.message_price || '0'),
    };
  } catch (error: any) {
    console.error('[ClickSend] MMS error:', error);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// MMS — TWILIO (FALLBACK)
// ═══════════════════════════════════════════════════════════════
async function sendMMSTwilio(to: string, body: string, mediaUrl: string): Promise<{ success: boolean; messageId?: string; cost?: number; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const params = new URLSearchParams();
    params.append('To', formatPhoneNumber(to));
    params.append('Body', body);
    params.append('MediaUrl', mediaUrl);

    if (TWILIO_MESSAGING_SERVICE_SID) {
      params.append('MessagingServiceSid', TWILIO_MESSAGING_SERVICE_SID);
    } else if (TWILIO_PHONE_NUMBER) {
      params.append('From', TWILIO_PHONE_NUMBER);
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        },
        body: params.toString(),
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Twilio MMS error');

    return { success: true, messageId: data.sid, cost: parseFloat(data.price || '0') };
  } catch (error: any) {
    console.error('[Twilio] MMS error:', error);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// MMS — UNIFIED (ClickSend → Twilio fallback)
// ═══════════════════════════════════════════════════════════════
async function sendMMS(to: string, body: string, mediaUrl: string): Promise<{ success: boolean; messageId?: string; provider?: string; cost?: number; error?: string }> {
  if (CLICKSEND_USERNAME && CLICKSEND_API_KEY) {
    const result = await sendMMSClickSend(to, body, mediaUrl);
    if (result.success) return { ...result, provider: 'clicksend' };
    console.log('[MMS] ClickSend failed, trying Twilio fallback:', result.error);
  }

  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    const result = await sendMMSTwilio(to, body, mediaUrl);
    return { ...result, provider: 'twilio' };
  }

  return { success: false, error: 'No MMS provider configured.' };
}

// ═══════════════════════════════════════════════════════════════
// EMAIL — MAILGUN (PRIMARY)
// ═══════════════════════════════════════════════════════════════
async function sendEmailMailgun(to: string, subject: string, html: string): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    return { success: false, error: 'Mailgun not configured' };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('from', `${MAILGUN_FROM_NAME} <${MAILGUN_FROM_EMAIL}>`);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('html', html);

    const response = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Mailgun error');
    return { success: true, id: data.id };
  } catch (error: any) {
    console.error('[Mailgun] Email error:', error);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// EMAIL — SENDGRID (FALLBACK)
// ═══════════════════════════════════════════════════════════════
async function sendEmailSendGrid(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  if (!SENDGRID_API_KEY) {
    console.log('[Email] No email provider configured. Would send to:', to);
    return { success: true }; // Mock for dev
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL, name: 'Medazon Health' },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });

    return { success: response.ok, error: response.ok ? undefined : 'SendGrid error' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// EMAIL — UNIFIED (Mailgun → SendGrid fallback)
// ═══════════════════════════════════════════════════════════════
async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; id?: string; provider?: string; error?: string }> {
  if (MAILGUN_API_KEY && MAILGUN_DOMAIN) {
    const result = await sendEmailMailgun(to, subject, html);
    if (result.success) return { ...result, provider: 'mailgun' };
    console.log('[Email] Mailgun failed, trying SendGrid fallback:', result.error);
  }

  if (SENDGRID_API_KEY) {
    const result = await sendEmailSendGrid(to, subject, html);
    return { ...result, provider: 'sendgrid' };
  }

  return { success: false, error: 'No email provider configured. Add Mailgun or SendGrid credentials.' };
}

// ═══════════════════════════════════════════════════════════════
// LOG TO COMMUNICATION_HISTORY
// ═══════════════════════════════════════════════════════════════
async function logCommunication(entry: {
  type: string;
  direction?: string;
  to_number?: string;
  to_email?: string;
  from_number?: string;
  from_email?: string;
  content?: string;
  subject?: string;
  status: string;
  patient_id?: string;
  campaign_flow?: string;
  campaign_step?: string;
  provider?: string;
  external_id?: string;
  cost?: number;
}) {
  try {
    const { error } = await supabase.from('communication_history').insert({
      ...entry,
      direction: entry.direction || 'outbound',
      created_at: new Date().toISOString(),
    });
    if (error) console.error('Failed to log communication:', error);
  } catch (e) {
    console.error('Log exception:', e);
  }
}

// ═══════════════════════════════════════════════════════════════
// CONVERT PLAIN TEXT → STYLED HTML EMAIL
// ═══════════════════════════════════════════════════════════════
function textToHtml(text: string, patientName: string): string {
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/\[(.*?)→\]/g, `<a href="https://patient.medazonhealth.com/book" style="display:inline-block;padding:12px 24px;background:#2dd4bf;color:#000;text-decoration:none;border-radius:8px;font-weight:600;margin:8px 0;">$1→</a>`)
    .replace(/\[([^\]]+)\]/g, `<a href="https://patient.medazonhealth.com/book" style="color:#2dd4bf;text-decoration:underline;">$1</a>`);

  return `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1c1e;line-height:1.6;">
    <div style="background:linear-gradient(135deg,#2dd4bf,#0d9488);padding:20px 24px;border-radius:12px 12px 0 0;">
      <div style="color:#fff;font-size:20px;font-weight:700;">Medazon Health</div>
      <div style="color:rgba(255,255,255,0.8);font-size:12px;margin-top:4px;">Private Telehealth Care</div>
    </div>
    <div style="background:#ffffff;padding:24px;border:1px solid #e5e5ea;border-top:none;">${escaped}</div>
    <div style="background:#f2f2f7;padding:16px 24px;border-radius:0 0 12px 12px;border:1px solid #e5e5ea;border-top:none;font-size:12px;color:#8e8e93;text-align:center;">
      <p>Medazon Health • Private Telehealth • medazonhealth.com</p>
      <p style="margin-top:4px;">Sent to ${patientName}</p>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// PERSONALIZE TEMPLATE VARIABLES
// ═══════════════════════════════════════════════════════════════
function personalize(text: string, patient: any): string {
  return text
    .replace(/\{\{first_name\}\}/g, patient.first_name || 'there')
    .replace(/\{\{last_name\}\}/g, patient.last_name || '')
    .replace(/\{\{full_name\}\}/g, `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'there')
    .replace(/\{\{email\}\}/g, patient.email || '')
    .replace(/\{\{phone\}\}/g, patient.phone || '')
    .replace(/\{\{last_condition\}\}/g, patient.last_condition || 'your concern')
    .replace(/\{\{last_service_type\}\}/g, patient.last_service_type || 'consultation')
    .replace(/\{\{booking_link\}\}/g, 'patient.medazonhealth.com/book')
    .replace(/\{\{referral_code\}\}/g, (patient.first_name || 'REF').toUpperCase().slice(0, 6) + '15')
    .replace(/\{\{appointment_date\}\}/g, patient.appointment_date || 'TBD')
    .replace(/\{\{appointment_time\}\}/g, patient.appointment_time || 'TBD');
}

// ════════════════════════════════════════════════════════════════
// POST /api/campaigns/send
// ════════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,       // 'send-sms' | 'send-mms' | 'send-email' | 'bulk-sms' | 'bulk-mms' | 'bulk-email'
      patient_id,   // single patient ID
      to,           // phone or email
      message,      // SMS/MMS body text
      subject,      // email subject
      html,         // email HTML (optional — auto-generates from message)
      media_url,    // MMS image URL
      flow_id,      // campaign flow ID (for logging)
      step_index,   // step index (for logging)
      patients,     // array of patient objects for bulk sends
    } = body;

    // ─── Single SMS ───
    if (action === 'send-sms') {
      if (!to || !message) return NextResponse.json({ error: 'Missing "to" or "message"' }, { status: 400 });

      const result = await sendSMS(to, message);
      await logCommunication({
        type: 'sms', to_number: to, from_number: TWILIO_PHONE_NUMBER || CLICKSEND_FROM,
        content: message, status: result.success ? 'sent' : 'failed',
        patient_id, campaign_flow: flow_id, campaign_step: step_index?.toString(),
        provider: result.provider, external_id: result.messageId, cost: result.cost,
      });

      return NextResponse.json({ success: result.success, messageId: result.messageId, provider: result.provider, error: result.error });
    }

    // ─── Single MMS ───
    if (action === 'send-mms') {
      if (!to || !message || !media_url) return NextResponse.json({ error: 'Missing "to", "message", or "media_url"' }, { status: 400 });

      const result = await sendMMS(to, message, media_url);
      await logCommunication({
        type: 'mms', to_number: to, from_number: TWILIO_PHONE_NUMBER || CLICKSEND_FROM,
        content: message, status: result.success ? 'sent' : 'failed',
        patient_id, campaign_flow: flow_id, campaign_step: step_index?.toString(),
        provider: result.provider, external_id: result.messageId, cost: result.cost,
      });

      return NextResponse.json({ success: result.success, messageId: result.messageId, provider: result.provider, error: result.error });
    }

    // ─── Single Email ───
    if (action === 'send-email') {
      if (!to || !message) return NextResponse.json({ error: 'Missing "to" or "message"' }, { status: 400 });

      const emailSubject = subject || 'Message from Medazon Health';
      const emailHtml = html || textToHtml(message, 'Patient');

      const result = await sendEmail(to, emailSubject, emailHtml);
      await logCommunication({
        type: 'email', to_email: to, from_email: MAILGUN_FROM_EMAIL || FROM_EMAIL,
        content: message, subject: emailSubject, status: result.success ? 'sent' : 'failed',
        patient_id, campaign_flow: flow_id, campaign_step: step_index?.toString(),
        provider: result.provider, external_id: result.id,
      });

      return NextResponse.json({ success: result.success, provider: result.provider, error: result.error });
    }

    // ─── Bulk SMS ───
    if (action === 'bulk-sms') {
      if (!patients?.length || !message) return NextResponse.json({ error: 'Missing "patients" or "message"' }, { status: 400 });

      let sent = 0, failed = 0;
      const results: any[] = [];

      for (const p of patients) {
        if (!p.phone) { failed++; results.push({ id: p.id, success: false, error: 'No phone' }); continue; }

        const msg = personalize(message, p);
        const result = await sendSMS(p.phone, msg);

        await logCommunication({
          type: 'sms', to_number: p.phone, from_number: TWILIO_PHONE_NUMBER || CLICKSEND_FROM,
          content: msg, status: result.success ? 'sent' : 'failed',
          patient_id: p.id, campaign_flow: flow_id, campaign_step: step_index?.toString(),
          provider: result.provider, external_id: result.messageId, cost: result.cost,
        });

        results.push({ id: p.id, success: result.success, provider: result.provider, error: result.error });
        result.success ? sent++ : failed++;
        await sleep(100); // Rate limit
      }

      return NextResponse.json({ success: true, sent, failed, total: patients.length, results });
    }

    // ─── Bulk MMS ───
    if (action === 'bulk-mms') {
      if (!patients?.length || !message || !media_url) return NextResponse.json({ error: 'Missing "patients", "message", or "media_url"' }, { status: 400 });

      let sent = 0, failed = 0;
      const results: any[] = [];

      for (const p of patients) {
        if (!p.phone) { failed++; results.push({ id: p.id, success: false, error: 'No phone' }); continue; }

        const msg = personalize(message, p);
        const result = await sendMMS(p.phone, msg, media_url);

        await logCommunication({
          type: 'mms', to_number: p.phone, from_number: TWILIO_PHONE_NUMBER || CLICKSEND_FROM,
          content: msg, status: result.success ? 'sent' : 'failed',
          patient_id: p.id, campaign_flow: flow_id, campaign_step: step_index?.toString(),
          provider: result.provider, external_id: result.messageId, cost: result.cost,
        });

        results.push({ id: p.id, success: result.success, provider: result.provider, error: result.error });
        result.success ? sent++ : failed++;
        await sleep(500); // MMS rate limit (slower)
      }

      return NextResponse.json({ success: true, sent, failed, total: patients.length, results });
    }

    // ─── Bulk Email ───
    if (action === 'bulk-email') {
      if (!patients?.length || !message) return NextResponse.json({ error: 'Missing "patients" or "message"' }, { status: 400 });

      const emailSubject = subject || 'Message from Medazon Health';
      let sent = 0, failed = 0;
      const results: any[] = [];

      for (const p of patients) {
        if (!p.email) { failed++; results.push({ id: p.id, success: false, error: 'No email' }); continue; }

        const msg = personalize(message, p);
        const subj = personalize(emailSubject, p);
        const emailHtml = html ? personalize(html, p) : textToHtml(msg, p.first_name || 'Patient');

        const result = await sendEmail(p.email, subj, emailHtml);

        await logCommunication({
          type: 'email', to_email: p.email, from_email: MAILGUN_FROM_EMAIL || FROM_EMAIL,
          content: msg, subject: subj, status: result.success ? 'sent' : 'failed',
          patient_id: p.id, campaign_flow: flow_id, campaign_step: step_index?.toString(),
          provider: result.provider, external_id: result.id,
        });

        results.push({ id: p.id, success: result.success, provider: result.provider, error: result.error });
        result.success ? sent++ : failed++;
        await sleep(200); // Mailgun rate limit
      }

      return NextResponse.json({ success: true, sent, failed, total: patients.length, results });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Campaign send API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
