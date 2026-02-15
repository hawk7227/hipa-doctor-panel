import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { drchronoFetch } from '@/lib/drchrono'

export async function GET(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  const patientId = req.nextUrl.searchParams.get('patient_id')

  if (!patientId) {
    return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  }

  const result = await drchronoFetch(`medications?patient=${patientId}`)

  if (!result.ok) {
    return NextResponse.json({ error: result.data?.error || 'Failed to fetch medications' }, { status: result.status })
  }

  return NextResponse.json({ medications: result.data.results || [] })
}
