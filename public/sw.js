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
