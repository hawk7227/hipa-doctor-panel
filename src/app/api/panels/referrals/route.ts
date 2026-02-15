import { NextRequest, NextResponse } from 'next/server'
import { db } from '../_shared'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const patient_id = req.nextUrl.searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  try {
    const { data, error } = await db.from('patient_referrals').select('*').eq('patient_id', patient_id).order('created_at', { ascending: false }).limit(50)
    if (error) throw error
    return NextResponse.json({ data: data || [] })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { patient_id, doctor_id, referral_to, referral_to_specialty, referral_to_phone, referral_to_fax, referral_to_address, referral_reason, icd10_codes, urgency, notes } = body
    if (!patient_id || !referral_to) return NextResponse.json({ error: 'patient_id and referral_to required' }, { status: 400 })

    const { data, error } = await db.from('patient_referrals').insert({
      patient_id, doctor_id, referral_to, referral_to_specialty, referral_to_phone, referral_to_fax, referral_to_address, referral_reason, icd10_codes: icd10_codes || [], urgency: urgency || 'routine', notes, status: 'pending',
    }).select().single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, response_notes, notes } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const update: any = { updated_at: new Date().toISOString() }
    if (status) update.status = status
    if (status === 'sent') update.sent_at = new Date().toISOString()
    if (status === 'completed' || status === 'declined') update.responded_at = new Date().toISOString()
    if (response_notes) update.response_notes = response_notes
    if (notes) update.notes = notes

    const { data, error } = await db.from('patient_referrals').update(update).eq('id', id).select().single()
    if (error) throw error
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}
