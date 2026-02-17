// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ============================================================================
// NOTIFICATION TOAST SYSTEM — In-app real-time notification toasts
// Deploy to: src/components/NotificationToast.tsx
//
// Features:
// - Custom notification sound (Web Audio API - no external files needed)
// - Animated toast popups with Medazon dark teal theme
// - Real-time Supabase listener for instant notifications
// - Missed notifications popup on login
// - Auto-dismiss with progress bar
// - Click to navigate to relevant page
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Bell, BellRing, Bug, Phone, Calendar, MessageSquare, AlertTriangle, CheckCircle, DollarSign, UserPlus, FileText } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// ── Types ──
interface InAppNotification {
  id: string;
  recipient_id: string;
  recipient_role: string;
  title: string;
  body: string;
  type: string;
  url: string;
  read: boolean;
  created_at: string;
}

interface ToastNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  url: string;
  timestamp: number;
  dismissing?: boolean;
}

interface NotificationToastProps {
  userId: string | null;
  userRole: 'provider' | 'admin' | 'assistant';
}

// ── Supabase client ──
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Notification Sound Generator (no external files needed) ──
function playNotificationSound(type: string = 'default') {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();

    if (type === 'urgent' || type === 'live_session') {
      // Urgent: 3 quick ascending tones
      [800, 1000, 1200].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.12);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.12);
      });
    } else if (type === 'bug_report' || type === 'bug_note' || type === 'bug_status') {
      // Bug: playful double-boop
      [600, 900].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'triangle';
        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.15);
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.15);
      });
    } else if (type === 'payment') {
      // Payment: cheerful cha-ching
      [523, 659, 784, 1047].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.15);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 0.15);
      });
    } else {
      // Default: pleasant two-tone chime
      [880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.2);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.2);
      });
    }

    // Auto-close context after sounds finish
    setTimeout(() => ctx.close(), 2000);
  } catch (e) {
    console.log('Audio not supported');
  }
}

// ── Get icon for notification type ──
function getNotifIcon(type: string) {
  switch (type) {
    case 'bug_report':
    case 'bug_note':
    case 'bug_status':
      return <Bug className="w-5 h-5" />;
    case 'live_session':
      return <Phone className="w-5 h-5" />;
    case 'new_appointment':
    case 'new_booking':
    case 'appointment_status':
      return <Calendar className="w-5 h-5" />;
    case 'admin_message':
    case 'admin_note':
      return <MessageSquare className="w-5 h-5" />;
    case 'payment':
      return <DollarSign className="w-5 h-5" />;
    case 'new_patient':
      return <UserPlus className="w-5 h-5" />;
    default:
      return <Bell className="w-5 h-5" />;
  }
}

// ── Get accent color for notification type ──
function getNotifColor(type: string) {
  switch (type) {
    case 'bug_report':
    case 'bug_note':
    case 'bug_status':
      return { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', icon: '#f59e0b', progress: '#f59e0b' };
    case 'live_session':
      return { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', icon: '#ef4444', progress: '#ef4444' };
    case 'payment':
      return { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.4)', icon: '#22c55e', progress: '#22c55e' };
    case 'new_appointment':
    case 'new_booking':
    case 'appointment_status':
      return { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', icon: '#3b82f6', progress: '#3b82f6' };
    case 'new_patient':
      return { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.4)', icon: '#a855f7', progress: '#a855f7' };
    default:
      return { bg: 'rgba(20, 184, 166, 0.15)', border: 'rgba(20, 184, 166, 0.4)', icon: '#14b8a6', progress: '#14b8a6' };
  }
}

// ── Time ago helper ──
function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════

export default function NotificationToast({ userId, userRole }: NotificationToastProps) {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [missedNotifs, setMissedNotifs] = useState<InAppNotification[]>([]);
  const [showMissedPanel, setShowMissedPanel] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const toastTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // ── Fetch missed (unread) notifications on login ──
  useEffect(() => {
    if (!userId) return;

    const fetchMissed = async () => {
      const { data, error } = await supabase
        .from('in_app_notifications')
        .select('*')
        .eq('recipient_id', String(userId))
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data && data.length > 0) {
        setMissedNotifs(data);
        setUnreadCount(data.length);
        setShowMissedPanel(true);
      }
    };

    fetchMissed();
  }, [userId]);

  // ── Listen for real-time notifications via Supabase ──
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'in_app_notifications',
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        const notif = payload.new as InAppNotification;
        console.log('[NotifToast] New notification:', notif);

        // Play sound
        playNotificationSound(notif.type);

        // Add toast
        const toast: ToastNotification = {
          id: notif.id,
          title: notif.title,
          body: notif.body,
          type: notif.type,
          url: notif.url || '/',
          timestamp: Date.now(),
        };
        setToasts(prev => [toast, ...prev].slice(0, 5));
        setUnreadCount(prev => prev + 1);

        // Auto-dismiss after 8 seconds
        const timeout = setTimeout(() => dismissToast(toast.id), 8000);
        toastTimeouts.current.set(toast.id, timeout);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      toastTimeouts.current.forEach(t => clearTimeout(t));
    };
  }, [userId]);

  // ── Also listen for push messages forwarded from service worker ──
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_NOTIFICATION') {
        const { title, body, notifType, url } = event.data;
        playNotificationSound(notifType || 'default');

        const toast: ToastNotification = {
          id: `push-${Date.now()}`,
          title,
          body,
          type: notifType || 'general',
          url: url || '/',
          timestamp: Date.now(),
        };
        setToasts(prev => [toast, ...prev].slice(0, 5));
        setUnreadCount(prev => prev + 1);

        const timeout = setTimeout(() => dismissToast(toast.id), 8000);
        toastTimeouts.current.set(toast.id, timeout);
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
  }, []);

  // ── Dismiss toast with animation ──
  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, dismissing: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
    const timeout = toastTimeouts.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      toastTimeouts.current.delete(id);
    }
  }, []);

  // ── Click toast → navigate ──
  const handleToastClick = useCallback((toast: ToastNotification) => {
    dismissToast(toast.id);
    if (toast.url && toast.url !== '/') {
      window.location.href = toast.url;
    }
  }, [dismissToast]);

  // ── Mark all missed as read ──
  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const ids = missedNotifs.map(n => n.id);
    if (ids.length > 0) {
      await supabase
        .from('in_app_notifications')
        .update({ read: true })
        .in('id', ids);
    }
    setMissedNotifs([]);
    setUnreadCount(0);
    setShowMissedPanel(false);
  }, [userId, missedNotifs]);

  // ── Mark single as read ──
  const markRead = useCallback(async (notif: InAppNotification) => {
    await supabase
      .from('in_app_notifications')
      .update({ read: true })
      .eq('id', notif.id);

    setMissedNotifs(prev => prev.filter(n => n.id !== notif.id));
    setUnreadCount(prev => Math.max(0, prev - 1));

    if (notif.url) {
      window.location.href = notif.url;
    }
  }, []);

  return (
    <>
      {/* ════════ TOAST STACK (top-right) ════════ */}
      <div
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '400px',
          width: '100%',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast, index) => {
          const colors = getNotifColor(toast.type);
          return (
            <div
              key={toast.id}
              onClick={() => handleToastClick(toast)}
              style={{
                pointerEvents: 'auto',
                background: '#0a1a1a',
                border: `1px solid ${colors.border}`,
                borderRadius: '12px',
                padding: '14px 16px',
                cursor: 'pointer',
                boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${colors.bg}`,
                transform: toast.dismissing ? 'translateX(120%)' : 'translateX(0)',
                opacity: toast.dismissing ? 0 : 1,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                animation: 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Progress bar */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '3px',
                  background: colors.progress,
                  borderRadius: '0 0 12px 12px',
                  animation: 'progressShrink 8s linear forwards',
                  width: '100%',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                {/* Icon */}
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: colors.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: colors.icon,
                    flexShrink: 0,
                  }}
                >
                  {getNotifIcon(toast.type)}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', lineHeight: 1.3 }}>
                    {toast.title}
                  </div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {toast.body}
                  </div>
                </div>

                {/* Close button */}
                <button
                  onClick={(e) => { e.stopPropagation(); dismissToast(toast.id); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '2px',
                    flexShrink: 0,
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ════════ MISSED NOTIFICATIONS PANEL ════════ */}
      {showMissedPanel && missedNotifs.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9998,
            width: '420px',
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: '70vh',
            background: '#0a1a1a',
            border: '1px solid rgba(20, 184, 166, 0.3)',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(20,184,166,0.1)',
            overflow: 'hidden',
            animation: 'fadeScaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(20,184,166,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(20,184,166,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(20,184,166,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BellRing className="w-5 h-5" style={{ color: '#14b8a6' }} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>
                  Missed Notifications
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {missedNotifs.length} unread
                </div>
              </div>
            </div>
            <button
              onClick={markAllRead}
              style={{
                background: 'rgba(20,184,166,0.1)',
                border: '1px solid rgba(20,184,166,0.3)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#14b8a6',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Mark all read
            </button>
          </div>

          {/* Notification list */}
          <div style={{ overflowY: 'auto', maxHeight: 'calc(70vh - 80px)', padding: '8px' }}>
            {missedNotifs.map((notif) => {
              const colors = getNotifColor(notif.type);
              return (
                <div
                  key={notif.id}
                  onClick={() => markRead(notif)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    borderLeft: `3px solid ${colors.icon}`,
                    marginBottom: '4px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: colors.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: colors.icon,
                      flexShrink: 0,
                    }}
                  >
                    {getNotifIcon(notif.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                      {notif.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                      {notif.body}
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                      {timeAgo(notif.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════ BACKDROP for missed panel ════════ */}
      {showMissedPanel && missedNotifs.length > 0 && (
        <div
          onClick={markAllRead}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9997,
            background: 'rgba(0,0,0,0.5)',
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* ════════ CSS ANIMATIONS ════════ */}
      <style jsx global>{`
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes progressShrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes fadeScaleIn {
          from { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
          to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}
