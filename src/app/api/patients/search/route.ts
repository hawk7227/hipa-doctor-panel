// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { drchronoFetch } from '@/lib/drchrono'

// ═══════════════════════════════════════════════════════════════
// GET /api/patients/search?q=<query>
// Smart patient search: DrChrono first, Supabase fallback
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

// ─── DRCHRONO PATIENT SEARCH ──────────────────────────────────
async function searchDrChrono(type: SearchType, parsed: any): Promise<any[]> {
  try {
    let results: any[] = []

    if (type === 'name') {
      // Search first_name and last_name separately, merge
      const [byFirst, byLast] = await Promise.all([
        drchronoFetch(`patients?first_name=${encodeURIComponent(parsed.name)}`),
        drchronoFetch(`patients?last_name=${encodeURIComponent(parsed.name)}`),
      ])
      const firstResults = byFirst.ok ? (byFirst.data.results || []) : []
      const lastResults = byLast.ok ? (byLast.data.results || []) : []
      // Deduplicate by id
      const seen = new Set<number>()
      for (const p of [...firstResults, ...lastResults]) {
        if (!seen.has(p.id)) {
          seen.add(p.id)
          results.push(p)
        }
      }
    } else if (type === 'name_split') {
      const res = await drchronoFetch(
        `patients?first_name=${encodeURIComponent(parsed.first)}&last_name=${encodeURIComponent(parsed.last)}`
      )
      results = res.ok ? (res.data.results || []) : []
    } else if (type === 'dob') {
      const res = await drchronoFetch(`patients?date_of_birth=${parsed.dob}`)
      results = res.ok ? (res.data.results || []) : []
    }
    // email and phone: DrChrono doesn't support — return empty
    return results
  } catch (err) {
    console.error('[PatientSearch] DrChrono error:', err)
    return []
  }
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

// ─── ALSO SEARCH drchrono_patients TABLE ──────────────────────
async function searchDrChronoLocal(type: SearchType, parsed: any): Promise<any[]> {
  try {
    let query = supabaseAdmin
      .from('drchrono_patients')
      .select('drchrono_patient_id, first_name, last_name, email, cell_phone, home_phone, date_of_birth, address, city, state, zip_code, default_pharmacy, chart_id')
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
      query = query.or(`cell_phone.ilike.%${parsed.phone}%,home_phone.ilike.%${parsed.phone}%`)
    }

    const { data, error } = await query
    if (error) {
      console.error('[PatientSearch] drchrono_patients error:', error.message)
      return []
    }
    return (data || []).map(p => ({ ...p, source: 'drchrono_local' }))
  } catch (err) {
    return []
  }
}

// ─── NORMALIZE RESULTS ────────────────────────────────────────
function normalizeResult(p: any, source: string) {
  return {
    id: p.id || null,
    drchrono_id: p.drchrono_patient_id || p.id || null,
    chart_id: p.chart_id || null,
    first_name: p.first_name || '',
    last_name: p.last_name || '',
    email: p.email || null,
    phone: p.cell_phone || p.phone || p.home_phone || null,
    date_of_birth: p.date_of_birth || null,
    address: p.address || p.location || null,
    city: p.city || null,
    state: p.state || null,
    zip_code: p.zip_code || null,
    pharmacy: p.default_pharmacy || p.preferred_pharmacy || null,
    source, // 'drchrono_api' | 'drchrono_local' | 'local'
  }
}

// ─── HANDLER ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], query: q, error: 'Query must be at least 2 characters' })
  }

  const startTime = performance.now()
  const { type, parsed } = detectSearchType(q)

  // Search all sources in parallel — DrChrono API first until full sync complete
  const [drchronoResults, localResults, drchronoLocalResults] = await Promise.all([
    searchDrChrono(type, parsed).catch(e => { console.error('[PatientSearch] DrChrono API failed:', e); return [] }),
    searchLocal(type, parsed).catch(e => { console.error('[PatientSearch] Local search failed:', e); return [] }),
    searchDrChronoLocal(type, parsed).catch(e => { console.error('[PatientSearch] DrChrono local failed:', e); return [] }),
  ])

  // Normalize all results
  const allResults: any[] = []
  const seen = new Set<string>()

  // DrChrono API results first (source of truth)
  for (const p of drchronoResults) {
    const key = `dc-${p.id}`
    if (!seen.has(key)) {
      seen.add(key)
      allResults.push(normalizeResult(p, 'drchrono_api'))
    }
  }

  // DrChrono local (already synced)
  for (const p of drchronoLocalResults) {
    const key = `dc-${p.drchrono_patient_id}`
    if (!seen.has(key)) {
      seen.add(key)
      allResults.push(normalizeResult(p, 'drchrono_local'))
    }
  }

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
      drchrono_api: drchronoResults.length,
      drchrono_local: drchronoLocalResults.length,
      local: localResults.length,
    },
    elapsed_ms: elapsed,
  })
}
