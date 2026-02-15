import { NextRequest, NextResponse } from 'next/server'
import { db } from '../_shared'

export async function GET(req: NextRequest) {
  try {
    const { data: local } = await db.from('patient_cohorts').select('*').order('created_at', { ascending: false }).limit(50)
    return NextResponse.json({ data: local || [] })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data, error } = await db.from('patient_cohorts').insert(body).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}
