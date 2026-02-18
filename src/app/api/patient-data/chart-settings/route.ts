import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET — Load chart settings for a doctor
export async function GET(req: NextRequest) {
  const doctorId = req.nextUrl.searchParams.get('doctor_id')
  if (!doctorId) return NextResponse.json({ error: 'doctor_id required' }, { status: 400 })

  try {
    const { data, error } = await db
      .from('chart_settings')
      .select('*')
      .eq('doctor_id', doctorId)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT — Save/update chart settings
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { doctor_id, ...settings } = body

    if (!doctor_id) return NextResponse.json({ error: 'doctor_id required' }, { status: 400 })

    // Upsert — insert or update
    const { data, error } = await db
      .from('chart_settings')
      .upsert({
        doctor_id,
        ...settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'doctor_id' })
      .select()
      .single()

    if (error) {
      console.error('[chart-settings] save error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[chart-settings] Saved for doctor=${doctor_id}`)
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
