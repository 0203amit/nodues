// NoDues service worker — minimal, exists only to satisfy PWA
// installability requirements. Does not cache or intercept.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch so the SW is "active" but doesn't change
// network behavior.
self.addEventListener('fetch', () => {});

// --- Push notification handler ---
self.addEventListener('push', (event) => {
  let title = 'NoDues';
  let body = 'You have overdue items';
  if (event.data) {
    try {
      const payload = event.data.json();
      title = payload.title || title;
      body = payload.body || body;
    } catch {
      body = event.data.text() || body;
    }
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: 'nodues-daily-overdue',
    })
  );
});

// --- Notification click handler ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.focus) {
            return client.focus();
          }
        }
        return self.clients.openWindow('/');
      })
  );
});
