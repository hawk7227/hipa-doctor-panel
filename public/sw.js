// ============================================================================
// MEDAZON HEALTH — Service Worker
// Handles: Offline app caching + Push notifications + Background sync
//
// REPLACES the existing sw.js — merges offline caching with push notifications
// ============================================================================

const CACHE_NAME = 'medazon-app-v1'
const STATIC_CACHE = 'medazon-static-v1'
const API_CACHE = 'medazon-api-v1'

// ── Install ──────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  console.log('[SW] Installing with offline support...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return Promise.allSettled([
        cache.add('/manifest.json').catch(() => {}),
      ])
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ───────────────────────────────

self.addEventListener('activate', (event) => {
  console.log('[SW] Activated');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    }).then(() => self.clients.claim())
  );
});

// ── Fetch: offline-first caching ─────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip: non-GET, external, sync API, Supabase realtime
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/sync')) return;

  // API routes → Network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(API_CACHE).then((c) => c.put(event.request, clone));
        }
        return res;
      }).catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return new Response(
            JSON.stringify({ error: 'Offline', offline: true }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        });
      })
    );
    return;
  }

  // Static assets → Cache first, network fallback
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2?|ico|webp)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(event.request, clone));
          }
          return res;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // HTML pages → Network first, cache fallback (SPA)
  event.respondWith(
    fetch(event.request).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
      }
      return res;
    }).catch(() => {
      return caches.match(event.request).then((cached) => {
        if (cached) return cached;
        // SPA fallback: serve cached root
        return caches.match('/').then((root) => {
          if (root) return root;
          // Last resort: offline page
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Offline</title>' +
            '<style>body{font-family:system-ui;background:#0a1214;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}' +
            '.c{text-align:center;max-width:320px}h1{color:#00cba9;font-size:1.5rem}p{color:#9ca3af;font-size:.875rem;line-height:1.5}' +
            'button{margin-top:1rem;padding:.5rem 1.5rem;background:#00cba9;color:#000;border:none;border-radius:8px;cursor:pointer;font-weight:600}</style></head>' +
            '<body><div class="c"><h1>You\'re Offline</h1><p>Your data is safe in the local database. It will sync automatically when you reconnect.</p>' +
            '<button onclick="location.reload()">Try Again</button></div></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html' } }
          );
        });
      });
    })
  );
});

// ── Background Sync ──────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'medazon-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SYNC_REQUESTED' }));
      })
    );
  }
});

// ── Push Notifications (preserved from existing sw.js) ───────

self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

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

// ── Notification Click ───────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          if (url !== '/') client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
