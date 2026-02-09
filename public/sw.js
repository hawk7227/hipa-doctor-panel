// ============================================================================
// MEDAZON HEALTH — Push Notification Service Worker
// Place in: /public/sw.js
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
    vibrate: [200, 100, 200, 100, 200], // Fun vibration pattern
    data: {
      url: data.url || '/',
      type: data.type || 'general',
    },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Handle notification click ──
self.addEventListener('notificationclick', (event) => {
  console.log('SW: Notification clicked');
  event.notification.close();

  const url = event.notification.data?.url || '/';

  // Focus existing tab or open new one
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Try to focus an existing tab
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Open new tab
      return self.clients.openWindow(url);
    })
  );
});
