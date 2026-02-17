// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { google, gmail_v1 } from 'googleapis'

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || ''
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || ''
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || ''

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
]

// ═══════════════════════════════════════════════════════════════
// OAUTH CLIENT
// ═══════════════════════════════════════════════════════════════

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI,
  )
}

export function getAuthUrl(state: string): string {
  const client = getOAuth2Client()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  })
}

export async function exchangeCode(code: string) {
  const client = getOAuth2Client()
  const { tokens } = await client.getToken(code)
  return tokens
}

// ═══════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT (Supabase)
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  )
}

export interface GmailTokenRecord {
  id: string
  doctor_id: string
  access_token: string
  refresh_token: string
  token_expiry: string | null
  gmail_address: string | null
  history_id: string | null
  watch_expiry: string | null
}

export async function getStoredTokens(doctorId: string): Promise<GmailTokenRecord | null> {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('doctor_gmail_tokens')
    .select('*')
    .eq('doctor_id', doctorId)
    .single()
  if (error || !data) return null
  return data as GmailTokenRecord
}

export async function upsertTokens(
  doctorId: string,
  accessToken: string,
  refreshToken: string,
  expiryDate: Date | null,
  gmailAddress: string | null,
) {
  const sb = getServiceClient()
  await sb.from('doctor_gmail_tokens').upsert(
    {
      doctor_id: doctorId,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expiry: expiryDate ? expiryDate.toISOString() : null,
      gmail_address: gmailAddress,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'doctor_id' },
  )
}

export async function deleteTokens(doctorId: string) {
  const sb = getServiceClient()
  await sb.from('doctor_gmail_tokens').delete().eq('doctor_id', doctorId)
}

// ═══════════════════════════════════════════════════════════════
// AUTHENTICATED GMAIL CLIENT
// ═══════════════════════════════════════════════════════════════

export async function getGmailClient(doctorId: string): Promise<gmail_v1.Gmail | null> {
  const record = await getStoredTokens(doctorId)
  if (!record) return null

  const client = getOAuth2Client()
  client.setCredentials({
    access_token: record.access_token,
    refresh_token: record.refresh_token,
    expiry_date: record.token_expiry ? new Date(record.token_expiry).getTime() : undefined,
  })

  // Auto-refresh if expired
  const tokenInfo = client.credentials
  if (tokenInfo.expiry_date && tokenInfo.expiry_date < Date.now() + 60000) {
    try {
      const { credentials } = await client.refreshAccessToken()
      await upsertTokens(
        doctorId,
        credentials.access_token || record.access_token,
        credentials.refresh_token || record.refresh_token,
        credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        record.gmail_address,
      )
      client.setCredentials(credentials)
    } catch (err) {
      console.error('Failed to refresh Gmail token:', err)
      return null
    }
  }

  return google.gmail({ version: 'v1', auth: client })
}

// ═══════════════════════════════════════════════════════════════
// GMAIL OPERATIONS
// ═══════════════════════════════════════════════════════════════

export interface GmailMessage {
  id: string
  threadId: string
  snippet: string
  subject: string
  from: string
  to: string
  date: string
  body: string
  labelIds: string[]
  isRead: boolean
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  try {
    return Buffer.from(base64, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  if (!headers) return ''
  const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase())
  return header?.value || ''
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return ''

  // Simple body
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }

  // Multipart — prefer text/html, fallback to text/plain
  if (payload.parts) {
    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html')
    if (htmlPart?.body?.data) return decodeBase64Url(htmlPart.body.data)

    const textPart = payload.parts.find(p => p.mimeType === 'text/plain')
    if (textPart?.body?.data) return decodeBase64Url(textPart.body.data)

    // Nested multipart
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractBody(part)
        if (nested) return nested
      }
    }
  }

  return ''
}

function parseMessage(msg: gmail_v1.Schema$Message): GmailMessage {
  const headers = msg.payload?.headers
  return {
    id: msg.id || '',
    threadId: msg.threadId || '',
    snippet: msg.snippet || '',
    subject: getHeader(headers, 'Subject'),
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    date: getHeader(headers, 'Date'),
    body: extractBody(msg.payload),
    labelIds: msg.labelIds || [],
    isRead: !(msg.labelIds || []).includes('UNREAD'),
  }
}

// ─── Inbox ───

export async function getInbox(
  doctorId: string,
  options: { maxResults?: number; pageToken?: string; query?: string } = {},
): Promise<{ messages: GmailMessage[]; nextPageToken: string | null; resultSizeEstimate: number }> {
  const gmail = await getGmailClient(doctorId)
  if (!gmail) throw new Error('Gmail not connected')

  const { maxResults = 20, pageToken, query } = options

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    pageToken: pageToken || undefined,
    q: query || undefined,
  })

  const messageIds = listRes.data.messages || []
  const messages: GmailMessage[] = []

  // Batch fetch message details (max 10 concurrent)
  const batchSize = 10
  for (let i = 0; i < messageIds.length; i += batchSize) {
    const batch = messageIds.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map(m =>
        gmail.users.messages.get({
          userId: 'me',
          id: m.id!,
          format: 'full',
        }),
      ),
    )
    results.forEach(r => {
      if (r.data) messages.push(parseMessage(r.data))
    })
  }

  return {
    messages,
    nextPageToken: listRes.data.nextPageToken || null,
    resultSizeEstimate: listRes.data.resultSizeEstimate || 0,
  }
}

// ─── Read thread ───

export async function getThread(
  doctorId: string,
  threadId: string,
): Promise<GmailMessage[]> {
  const gmail = await getGmailClient(doctorId)
  if (!gmail) throw new Error('Gmail not connected')

  const res = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  })

  return (res.data.messages || []).map(parseMessage)
}

// ─── Send email ───

export async function sendEmail(
  doctorId: string,
  to: string,
  subject: string,
  body: string,
  replyToMessageId?: string,
  threadId?: string,
): Promise<{ id: string; threadId: string }> {
  const gmail = await getGmailClient(doctorId)
  if (!gmail) throw new Error('Gmail not connected')

  // Get sender address
  const record = await getStoredTokens(doctorId)
  const from = record?.gmail_address || 'me'

  // Build raw RFC 2822 message
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
  ]

  if (replyToMessageId) {
    headers.push(`In-Reply-To: ${replyToMessageId}`)
    headers.push(`References: ${replyToMessageId}`)
  }

  const rawMessage = headers.join('\r\n') + '\r\n\r\n' + body
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const sendParams: any = {
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId: threadId || undefined,
    },
  }

  const res = await gmail.users.messages.send(sendParams)

  return {
    id: res.data.id || '',
    threadId: res.data.threadId || '',
  }
}

// ─── Mark as read ───

export async function markAsRead(doctorId: string, messageId: string): Promise<void> {
  const gmail = await getGmailClient(doctorId)
  if (!gmail) return

  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      removeLabelIds: ['UNREAD'],
    },
  })
}

// ─── Get profile ───

export async function getGmailProfile(doctorId: string): Promise<{ email: string; messagesTotal: number } | null> {
  const gmail = await getGmailClient(doctorId)
  if (!gmail) return null

  const res = await gmail.users.getProfile({ userId: 'me' })
  return {
    email: res.data.emailAddress || '',
    messagesTotal: res.data.messagesTotal || 0,
  }
}
