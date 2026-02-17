// ============================================================================
// src/app/api/campaigns/patients/route.ts
// Fetches patients from Supabase for the Retention Campaign Engine
// Includes: demographics, last appointment, medications, conditions
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter'); // all | active | inactive-30 | inactive-60 | inactive-90 | has-rx | new
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // ── Base query: patients with their most recent appointment ──
    let query = supabase
      .from('patients')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        date_of_birth,
        created_at,
        appointments (
          id,
          appointment_date,
          status,
          chief_complaint,
          service_type,
          created_at
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // ── Search filter ──
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: patients, error, count } = await query;

    if (error) {
      console.error('Error fetching patients:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ── Process patients: compute derived fields ──
    const now = new Date();
    const processed = (patients || []).map((p: any) => {
      // appointments comes as array — sort to get most recent
      const appts = (p.appointments || []).sort(
        (a: any, b: any) => new Date(b.appointment_date || b.created_at).getTime() - new Date(a.appointment_date || a.created_at).getTime()
      );
      const lastAppt = appts[0] || null;
      const lastVisitDate = lastAppt?.appointment_date || lastAppt?.created_at || null;
      const daysSinceVisit = lastVisitDate
        ? Math.floor((now.getTime() - new Date(lastVisitDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        full_name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        email: p.email,
        phone: p.phone,
        date_of_birth: p.date_of_birth,
        created_at: p.created_at,
        total_appointments: appts.length,
        last_visit_date: lastVisitDate,
        days_since_visit: daysSinceVisit,
        last_condition: lastAppt?.chief_complaint || lastAppt?.service_type || null,
        last_service_type: lastAppt?.service_type || null,
        is_new: appts.length <= 1,
        is_inactive_30: daysSinceVisit !== null && daysSinceVisit >= 30,
        is_inactive_60: daysSinceVisit !== null && daysSinceVisit >= 60,
        is_inactive_90: daysSinceVisit !== null && daysSinceVisit >= 90,
        // Tags for campaign targeting
        tags: [
          ...(appts.length <= 1 ? ['new-patient'] : ['returning']),
          ...(daysSinceVisit !== null && daysSinceVisit >= 30 ? ['inactive-30'] : []),
          ...(daysSinceVisit !== null && daysSinceVisit >= 60 ? ['inactive-60'] : []),
          ...(daysSinceVisit !== null && daysSinceVisit >= 90 ? ['inactive-90'] : []),
          ...(lastAppt?.chief_complaint?.toLowerCase().includes('uti') ? ['uti'] : []),
          ...(lastAppt?.chief_complaint?.toLowerCase().includes('std') || lastAppt?.chief_complaint?.toLowerCase().includes('sti') ? ['std'] : []),
          ...(lastAppt?.chief_complaint?.toLowerCase().includes('adhd') ? ['adhd'] : []),
          ...(lastAppt?.chief_complaint?.toLowerCase().includes('weight') ? ['weight-loss'] : []),
        ],
      };
    });

    // ── Apply post-query filters ──
    let filtered = processed;
    if (filter === 'active') {
      filtered = processed.filter((p: any) => p.days_since_visit === null || p.days_since_visit < 30);
    } else if (filter === 'inactive-30') {
      filtered = processed.filter((p: any) => p.is_inactive_30);
    } else if (filter === 'inactive-60') {
      filtered = processed.filter((p: any) => p.is_inactive_60);
    } else if (filter === 'inactive-90') {
      filtered = processed.filter((p: any) => p.is_inactive_90);
    } else if (filter === 'new') {
      filtered = processed.filter((p: any) => p.is_new);
    }

    // ── Summary stats ──
    const stats = {
      total: processed.length,
      active: processed.filter((p: any) => !p.is_inactive_30).length,
      inactive_30: processed.filter((p: any) => p.is_inactive_30).length,
      inactive_60: processed.filter((p: any) => p.is_inactive_60).length,
      inactive_90: processed.filter((p: any) => p.is_inactive_90).length,
      new_patients: processed.filter((p: any) => p.is_new).length,
      with_email: processed.filter((p: any) => p.email).length,
      with_phone: processed.filter((p: any) => p.phone).length,
    };

    return NextResponse.json({
      success: true,
      patients: filtered,
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Campaign patients API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
