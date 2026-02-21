// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════
// GET /api/patients/search?q=<query>
// Smart patient search: Supabase patients table
//
// Input detection:
//   "Marcus"           → name search (first OR last)
//   "Marcus Hawkins"   → first_name + last_name
//   "01/02/1975"       → date_of_birth
//   "hawk7@yahoo.com"  → email (Supabase only)
//   "602-549-8598"     → phone (Supabase only)
// ═══════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── INPUT TYPE DETECTION ─────────────────────────────────────
type SearchType = 'name' | 'name_split' | 'dob' | 'email' | 'phone'

function detectSearchType(query: string): { type: SearchType; parsed: any } {
  const q = query.trim()

  // Email: contains @
  if (q.includes('@')) {
    return { type: 'email', parsed: { email: q } }
  }

  // Phone: mostly digits, dashes, parens, spaces — at least 3 digits
  const digits = q.replace(/\D/g, '')
  if (digits.length >= 3 && /^[\d\s\-().+]+$/.test(q)) {
    return { type: 'phone', parsed: { phone: digits } }
  }

  // DOB: contains / or matches YYYY-MM-DD
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(q)) {
    // Convert MM/DD/YYYY to YYYY-MM-DD
    const parts = q.split('/')
    const month = parts[0].padStart(2, '0')
    const day = parts[1].padStart(2, '0')
    let year = parts[2]
    if (year.length === 2) year = (parseInt(year) > 50 ? '19' : '20') + year
    return { type: 'dob', parsed: { dob: `${year}-${month}-${day}` } }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(q)) {
    return { type: 'dob', parsed: { dob: q } }
  }

  // Name: two words = first + last
  const words = q.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return { type: 'name_split', parsed: { first: words[0], last: words.slice(1).join(' ') } }
  }

  // Single word = search first OR last
  return { type: 'name', parsed: { name: q } }
}

// ─── SUPABASE LOCAL SEARCH ────────────────────────────────────
async function searchLocal(type: SearchType, parsed: any): Promise<any[]> {
  try {
    let query = supabaseAdmin
      .from('patients')
      .select('id, first_name, last_name, email, phone, date_of_birth, location, preferred_pharmacy')
      .limit(20)

    if (type === 'name') {
      query = query.or(`first_name.ilike.%${parsed.name}%,last_name.ilike.%${parsed.name}%`)
    } else if (type === 'name_split') {
      query = query.ilike('first_name', `%${parsed.first}%`).ilike('last_name', `%${parsed.last}%`)
    } else if (type === 'dob') {
      query = query.eq('date_of_birth', parsed.dob)
    } else if (type === 'email') {
      query = query.ilike('email', `%${parsed.email}%`)
    } else if (type === 'phone') {
      query = query.or(`phone.ilike.%${parsed.phone}%,mobile_phone.ilike.%${parsed.phone}%`)
    }

    const { data, error } = await query
    if (error) {
      console.error('[PatientSearch] Supabase error:', error.message)
      return []
    }
    return (data || []).map(p => ({ ...p, source: 'local' }))
  } catch (err) {
    console.error('[PatientSearch] Local search error:', err)
    return []
  }
}

// ─── NORMALIZE RESULTS ────────────────────────────────────────
function normalizeResult(p: any, source: string) {
  return {
    id: p.id || null,
    chart_id: p.chart_id || null,
    first_name: p.first_name || '',
    last_name: p.last_name || '',
    email: p.email || null,
    phone: p.phone || null,
    date_of_birth: p.date_of_birth || null,
    address: p.address || p.location || null,
    city: p.city || null,
    state: p.state || null,
    zip_code: p.zip_code || null,
    pharmacy: p.preferred_pharmacy || null,
    source, // 'local'
  }
}

// ─── HANDLER ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Auth removed — using service role key for non-auth access
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], query: q, error: 'Query must be at least 2 characters' })
  }

  const startTime = performance.now()
  const { type, parsed } = detectSearchType(q)

  // Search local patients
  const localResults = await searchLocal(type, parsed).catch(e => { console.error('[PatientSearch] Local search failed:', e); return [] })

  // Normalize all results
  const allResults: any[] = []
  const seen = new Set<string>()

  // Local patients (dedupe by email if possible)
  for (const p of localResults) {
    const emailKey = p.email ? `email-${p.email.toLowerCase()}` : null
    const idKey = `local-${p.id}`
    if (emailKey && seen.has(emailKey)) continue
    if (seen.has(idKey)) continue
    if (emailKey) seen.add(emailKey)
    seen.add(idKey)
    allResults.push(normalizeResult(p, 'local'))
  }

  const elapsed = Math.round(performance.now() - startTime)

  return NextResponse.json({
    results: allResults.slice(0, 25),
    query: q,
    search_type: type,
    sources: {
      local: localResults.length,
    },
    elapsed_ms: elapsed,
  })
}
