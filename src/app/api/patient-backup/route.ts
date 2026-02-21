// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const ALGORITHM = 'aes-256-gcm'

function encrypt(data: string, password: string): { encrypted: string; iv: string; tag: string; salt: string } {
  const salt = crypto.randomBytes(32)
  const key = crypto.scryptSync(password, salt, 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(data, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const tag = cipher.getAuthTag()
  return {
    encrypted,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    salt: salt.toString('base64'),
  }
}

function decrypt(encryptedData: string, password: string, ivB64: string, tagB64: string, saltB64: string): string {
  const salt = Buffer.from(saltB64, 'base64')
  const key = crypto.scryptSync(password, salt, 32)
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// ═══════════════════════════════════════════════════════════════
// GET /api/patient-backup
// Returns cache status and available backup info
// ═══════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;

  // Get current record counts from local tables
  const tables = ['patients', 'patient_medications', 'patient_allergies', 'patient_problems', 'appointments', 'patient_documents']
  const counts: Record<string, number> = {}
  for (const t of tables) {
    const { count } = await supabaseAdmin.from(t).select('*', { count: 'exact', head: true })
    counts[t] = count || 0
  }

  return NextResponse.json({
    last_backup: null,
    last_backup_records: 0,
    current_counts: counts,
    total_records: Object.values(counts).reduce((s, n) => s + n, 0),
  })
}

// ═══════════════════════════════════════════════════════════════
// POST /api/patient-backup
// Generates encrypted backup of all patient data
// Body: { action: 'generate' | 'download', password?: string }
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  const doctorEmail = (auth as any)?.email || 'unknown'

  const body = await req.json()
  const { action, password } = body

  if (action === 'generate') {
    // Generate a new encrypted backup
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const start = Date.now()
    let totalRecords = 0

    try {
      // Fetch all patient data from local tables
      const [patients, medications, allergies, problems, appointments, documents] = await Promise.all([
        supabaseAdmin.from('patients').select('*'),
        supabaseAdmin.from('patient_medications').select('*'),
        supabaseAdmin.from('patient_allergies').select('*'),
        supabaseAdmin.from('patient_problems').select('*'),
        supabaseAdmin.from('appointments').select('*'),
        supabaseAdmin.from('patient_documents').select('*'),
      ])

      const backupData = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        generated_by: doctorEmail,
        data: {
          patients: patients.data || [],
          medications: medications.data || [],
          allergies: allergies.data || [],
          problems: problems.data || [],
          appointments: appointments.data || [],
          documents: documents.data || [],
        },
        counts: {
          patients: patients.data?.length || 0,
          medications: medications.data?.length || 0,
          allergies: allergies.data?.length || 0,
          problems: problems.data?.length || 0,
          appointments: appointments.data?.length || 0,
          documents: documents.data?.length || 0,
        },
      }

      totalRecords = Object.values(backupData.counts).reduce((s, n) => s + n, 0)

      // Encrypt the backup
      const jsonStr = JSON.stringify(backupData)
      const { encrypted, iv, tag, salt } = encrypt(jsonStr, password)

      // Log backup completion
      console.log(`[patient-backup] Encrypted backup generated: ${totalRecords} records, ${encrypted.length} bytes`)

      return NextResponse.json({
        success: true,
        records: totalRecords,
        counts: backupData.counts,
        elapsed_ms: Date.now() - start,
        backup: { encrypted, iv, tag, salt },
        size_bytes: encrypted.length,
      })
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  if (action === 'decrypt') {
    // Decrypt a backup (for verification)
    const { encrypted: enc, iv, tag: t, salt: s } = body
    if (!password || !enc || !iv || !t || !s) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    try {
      const decrypted = decrypt(enc, password, iv, t, s)
      const parsed = JSON.parse(decrypted)
      return NextResponse.json({
        success: true,
        version: parsed.version,
        generated_at: parsed.generated_at,
        counts: parsed.counts,
      })
    } catch (err: any) {
      return NextResponse.json({ error: 'Decryption failed — wrong password or corrupted data', detail: err.message }, { status: 400 })
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
