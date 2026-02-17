// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ============================================================================
// PUSH NOTIFICATION HELPER — Send push + in-app notifications from server-side
// Deploy to: src/lib/pushNotify.ts (REPLACE existing)
// ============================================================================

import * as webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Configure VAPID (safe to call multiple times)
let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || 'admin@medazonhealth.com'}`,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    vapidConfigured = true;
  }
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  type?: string;
  tag?: string;
  icon?: string;
  requireInteraction?: boolean;
}

// ── Send push + in-app notification to a specific user ──
export async function pushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  ensureVapid();

  // Save to in_app_notifications table (triggers realtime for toast)
  try {
    await supabase.from('in_app_notifications').insert({
      recipient_id: String(userId),
      recipient_role: 'provider',
      title: payload.title,
      body: payload.body,
      type: payload.type || 'general',
      url: payload.url || '/',
      read: false,
    });
  } catch (err) {
    console.error('[pushNotify] Failed to save in-app notification:', err);
  }

  // Send browser push notification
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', String(userId));

  return sendToSubscriptions(subscriptions || [], payload);
}

// ── Send push + in-app notification to all users with a specific role ──
export async function pushToRole(role: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  ensureVapid();

  // Get all users with this role to save in-app notifs
  const { data: roleUsers } = await supabase
    .from('push_subscriptions')
    .select('user_id')
    .eq('user_role', role);

  // Deduplicate user_ids
  const uniqueUserIds = [...new Set((roleUsers || []).map(u => u.user_id))];

  // Save in-app notification for each user
  if (uniqueUserIds.length > 0) {
    try {
      await supabase.from('in_app_notifications').insert(
        uniqueUserIds.map(uid => ({
          recipient_id: String(uid),
          recipient_role: role,
          title: payload.title,
          body: payload.body,
          type: payload.type || 'general',
          url: payload.url || '/',
          read: false,
        }))
      );
    } catch (err) {
      console.error('[pushNotify] Failed to save in-app notifications:', err);
    }
  }

  // Send browser push notifications
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_role', role);

  return sendToSubscriptions(subscriptions || [], payload);
}

// ── Internal: send to list of push subscriptions ──
async function sendToSubscriptions(
  subscriptions: any[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (subscriptions.length === 0) {
    console.log('[pushNotify] No push subscriptions found');
    return { sent: 0, failed: 0 };
  }

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/icon-192.png',
    badge: '/icon-192.png',
    url: payload.url || '/',
    type: payload.type || 'general',
    tag: payload.tag || `medazon-${Date.now()}`,
    requireInteraction: payload.requireInteraction ?? true,
  });

  let sent = 0;
  let failed = 0;
  const expired: string[] = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message
      );
      sent++;
    } catch (err: any) {
      failed++;
      if (err.statusCode === 404 || err.statusCode === 410) {
        expired.push(sub.id);
      }
    }
  }

  // Cleanup expired subscriptions
  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired);
  }

  console.log(`[pushNotify] sent=${sent}, failed=${failed}, cleaned=${expired.length}`);
  return { sent, failed };
}

