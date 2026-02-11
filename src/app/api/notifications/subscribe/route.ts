// ============================================================================
// PUSH SUBSCRIPTION API — Register/unregister push subscriptions
// Route: /api/notifications/subscribe/route.ts
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// POST — Register a push subscription
export async function POST(request: NextRequest) {
  try {
    const { subscription, user_id, user_role, user_name } = await request.json();

    if (!subscription || !subscription.endpoint || !user_id) {
      return NextResponse.json(
        { success: false, error: 'subscription and user_id required' },
        { status: 400 }
      );
    }

    const keys = subscription.keys || {};

    // Upsert — update if same endpoint exists
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id,
          user_role: user_role || 'provider',
          user_name: user_name || 'Unknown',
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh || '',
          auth: keys.auth || '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      )
      .select()
      .single();

    if (error) {
      console.error('Subscription save error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Subscription error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE — Unregister a push subscription
export async function DELETE(request: NextRequest) {
  try {
    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ success: false, error: 'endpoint required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);

    if (error) {
      console.error('Unsubscribe error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
