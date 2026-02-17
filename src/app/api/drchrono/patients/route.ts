// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { drchronoFetch } from '@/lib/drchrono'

export async function GET(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  const firstName = req.nextUrl.searchParams.get('first_name')
  const lastName = req.nextUrl.searchParams.get('last_name')
  const chartId = req.nextUrl.searchParams.get('chart_id')
  const patientId = req.nextUrl.searchParams.get('patient_id')

  let endpoint = 'patients'
  const params: string[] = []

  if (patientId) {
    endpoint = `patients/${patientId}`
  } else {
    if (firstName) params.push(`first_name=${encodeURIComponent(firstName)}`)
    if (lastName) params.push(`last_name=${encodeURIComponent(lastName)}`)
    if (chartId) params.push(`chart_id=${encodeURIComponent(chartId)}`)
    if (params.length > 0) endpoint += `?${params.join('&')}`
  }

  const result = await drchronoFetch(endpoint)

  if (!result.ok) {
    return NextResponse.json({ error: result.data?.error || 'Failed to fetch patients' }, { status: result.status })
  }

  // Single patient fetch returns object, list returns { results: [] }
  const patients = patientId ? [result.data] : (result.data.results || [])

  return NextResponse.json({ patients })
}
