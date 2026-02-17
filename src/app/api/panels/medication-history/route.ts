import { NextRequest, NextResponse } from 'next/server'
import { db, getDrchronoPatientId, authenticateDoctor } from '../_shared'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const { data: local } = await db.from('patient_medications').select('*').eq('patient_id', patient_id).order('start_date', { ascending: false })
    const dcId = await getDrchronoPatientId(patient_id)
    let drchrono: any[] = []
    if (dcId) {
      const { data } = await db.from('drchrono_medications').select('*').eq('drchrono_patient_id', dcId).order('date_prescribed', { ascending: false })
      drchrono = data || []
    }

    // Export fallback: if live DrChrono returned 0, try saved export
    if (drchrono.length === 0) {
      try {
        const { data: exportRow } = await db
          .from('patient_data_exports')
          .select('data')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .single()

        if (exportRow?.data) {
          const patients = exportRow.data as any[]
          let match = dcId ? patients.find((p: any) => p.drchrono_patient_id === dcId) : null
          if (!match) {
            const { data: pt } = await db.from('patients').select('email').eq('id', patient_id).single()
            if (pt?.email) match = patients.find((p: any) => p.email === pt.email.toLowerCase())
          }
          if (match?.medications?.length > 0) {
            drchrono = match.medications.map((m: any, i: number) => ({
              id: `export-${i}`,
              drchrono_patient_id: match.drchrono_patient_id,
              name: m.name,
              dosage_quantity: m.dosage?.split(' ')[0] || '',
              dosage_unit: m.dosage?.split(' ').slice(1).join(' ') || '',
              sig: m.sig || '',
              status: m.status || 'active',
              date_prescribed: m.date_prescribed || '',
              date_stopped_taking: m.date_stopped || null,
              _source: 'export',
            }))
            console.log(`[med-history] Export fallback: ${drchrono.length} meds for patient ${patient_id}`)
          }
        }
      } catch (e) {
        console.log('[med-history] Export fallback failed:', (e as Error).message)
      }
    }

    return NextResponse.json({ data: local || [], drchrono_data: drchrono })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json()
    if (!body.patient_id || !body.medication_name) return NextResponse.json({ error: 'patient_id and medication_name required' }, { status: 400 })
    const { data, error } = await db.from('patient_medications').insert(body).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ error: 'History records are immutable' }, { status: 405 })
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateDoctor(req); if (auth instanceof NextResponse) return auth;
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db.from('patient_medications').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
