import { NextRequest, NextResponse } from 'next/server'
import { drchronoFetch } from '@/lib/drchrono'

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get('patient_id')

  if (!patientId) {
    return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  }

  const result = await drchronoFetch(`appointments?patient=${patientId}`)

  if (!result.ok) {
    return NextResponse.json({ error: result.data?.error || 'Failed to fetch appointments' }, { status: result.status })
  }

  return NextResponse.json({ appointments: result.data.results || [] })
}
