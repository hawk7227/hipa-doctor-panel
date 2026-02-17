// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ============================================================================
// PUSH NOTIFICATION API — Send push notifications
// Route: /api/notifications/push/route.ts
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireDoctor } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js';
import * as webpush from 'web-push';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Configure VAPID
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL || 'admin@medazonhealth.com'}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// POST — Send a push notification
export async function POST(request: NextRequest) {
  const auth = await requireDoctor(request); if (auth instanceof NextResponse) return auth;
  try {
    const { recipient_id, recipient_role, title, body, url, type, tag } = await request.json();

    if (!title || !body) {
      return NextResponse.json({ success: false, error: 'title and body required' }, { status: 400 });
    }

    // Get push subscriptions for the recipient
    let query = supabase.from('push_subscriptions').select('*');
    
    if (recipient_id) {
      query = query.eq('user_id', recipient_id);
    } else if (recipient_role) {
      query = query.eq('user_role', recipient_role);
    } else {
      return NextResponse.json({ success: false, error: 'recipient_id or recipient_role required' }, { status: 400 });
    }

    const { data: subscriptions, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      return NextResponse.json({ success: false, error: 'Failed to fetch subscriptions' }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No subscriptions found' });
    }

    // Send to all subscriptions
    const payload = JSON.stringify({
      title,
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      url: url || '/',
      type: type || 'general',
      tag: tag || `medazon-${Date.now()}`,
      requireInteraction: true,
    });

    let sent = 0;
    let failed = 0;
    const expiredSubscriptions: string[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );
        sent++;
      } catch (err: any) {
        console.error('Push send error:', err.statusCode, err.body);
        failed++;
        // If subscription is expired/invalid, mark for cleanup
        if (err.statusCode === 404 || err.statusCode === 410) {
          expiredSubscriptions.push(sub.id);
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredSubscriptions.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expiredSubscriptions);
      console.log(`Cleaned up ${expiredSubscriptions.length} expired subscriptions`);
    }

    return NextResponse.json({ success: true, sent, failed });

  } catch (error: any) {
    console.error('Push notification error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

