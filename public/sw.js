// ============================================================================
// MEDAZON HEALTH — Push Notification Service Worker
// Deploy to: public/sw.js (REPLACE existing)
// ============================================================================

self.addEventListener('install', (event) => {
  console.log('SW: Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('SW: Activated');
  event.waitUntil(self.clients.claim());
});

// ── Handle incoming push notifications ──
self.addEventListener('push', (event) => {
  console.log('SW: Push received');

  let data = { title: 'Medazon Health', body: 'You have a new notification', icon: '/icon-192.png' };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'medazon-notification',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || '/',
      type: data.type || 'general',
    },
    actions: data.actions || [],
  };

  // Forward to open tabs so they can play sound + show in-app toast
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'PUSH_NOTIFICATION',
            title: data.title,
            body: data.body,
            notifType: data.type || 'general',
            url: data.url || '/',
          });
        });
      }),
    ])
  );
});

// ── Handle notification click ──
self.addEventListener('notificationclick', (event) => {
  console.log('SW: Notification clicked');
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Try to focus an existing tab
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          if (url !== '/') {
            client.navigate(url);
          }
          return;
        }
      }
      // Open new tab
      return self.clients.openWindow(url);
    })
  );
});

