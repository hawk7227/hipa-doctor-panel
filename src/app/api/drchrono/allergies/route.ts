import { requireAuth } from '@/lib/api-auth'
import { NextRequest, NextResponse } from 'next/server'
import { drchronoFetch } from '@/lib/drchrono'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth && auth.error) return auth.error
  const patientId = req.nextUrl.searchParams.get('patient_id')

  if (!patientId) {
    return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  }

  const result = await drchronoFetch(`allergies?patient=${patientId}`)

  if (!result.ok) {
    return NextResponse.json({ error: result.data?.error || 'Failed to fetch allergies' }, { status: result.status })
  }

  return NextResponse.json({ allergies: result.data.results || [] })
}
