// ============================================================================
// USE PUSH NOTIFICATIONS — Client-side hook for registering + managing push
// Place in: /src/lib/usePushNotifications.ts
// ============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';

interface UsePushNotificationsProps {
  userId: string | null;
  userRole: 'provider' | 'admin' | 'assistant';
  userName?: string;
}

export function usePushNotifications({ userId, userRole, userName }: UsePushNotificationsProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);

  // Check browser support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  // Check if already subscribed
  useEffect(() => {
    if (!isSupported) return;

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (err) {
        console.error('Error checking push subscription:', err);
      }
    };
    checkSubscription();
  }, [isSupported]);

  // Register service worker on mount
  useEffect(() => {
    if (!isSupported) return;

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('SW registered:', registration.scope);
    }).catch((err) => {
      console.error('SW registration failed:', err);
    });
  }, [isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!isSupported || !userId) return false;
    setIsLoading(true);

    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        console.log('Push notification permission denied');
        setIsLoading(false);
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ).buffer as ArrayBuffer,
      });

      // Send subscription to server
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          user_id: userId,
          user_role: userRole,
          user_name: userName || 'User',
        }),
      });

      const data = await response.json();
      if (data.success) {
        setIsSubscribed(true);
        console.log('Push subscription registered');
        
        // Show a test notification to confirm it works
        registration.showNotification('🎉 Notifications Enabled!', {
          body: 'You\'ll now receive alerts for bug reports and live sessions.',
          icon: '/icon-192.png',
          tag: 'subscription-confirm',
        });
        
        setIsLoading(false);
        return true;
      }
    } catch (err) {
      console.error('Push subscribe error:', err);
    }

    setIsLoading(false);
    return false;
  }, [isSupported, userId, userRole, userName]);

  // Unsubscribe
  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;
    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        await fetch('/api/notifications/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });

        setIsSubscribed(false);
      }
    } catch (err) {
      console.error('Push unsubscribe error:', err);
    }

    setIsLoading(false);
  }, [isSupported]);

  return {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    subscribe,
    unsubscribe,
  };
}

// Helper: send a push notification via the API
export async function sendPushNotification(params: {
  recipient_id?: string;
  recipient_role?: 'provider' | 'admin';
  title: string;
  body: string;
  url?: string;
  type?: string;
}) {
  try {
    const response = await fetch('/api/notifications/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await response.json();
  } catch (err) {
    console.error('Send push error:', err);
    return { success: false, error: 'Failed to send' };
  }
}

// Convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

