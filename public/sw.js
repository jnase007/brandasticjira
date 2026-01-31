// Brandastic PM Service Worker
// Version is updated on each build to force cache refresh
const CACHE_VERSION = Date.now();
const CACHE_NAME = `brandastic-${CACHE_VERSION}`;

// Only cache truly static assets that won't change between builds
const STATIC_ASSETS = [
  '/favicon.svg',
  '/manifest.json'
];

// Install event - cache static assets only
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately without waiting
  self.skipWaiting();
});

// Activate event - clean up ALL old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('brandastic-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch event - network first for HTML/JS/CSS, cache for static assets only
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API requests and external resources
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api')) return;
  
  // For JS/CSS/HTML - ALWAYS go to network (these are fingerprinted by Vite)
  // This prevents stale chunk errors after deployments
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Only fallback to cache if network fails (offline)
        return caches.match(event.request);
      })
    );
    return;
  }
  
  // For static assets (favicon, manifest, images) - use cache first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Cache the response for next time
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      });
    }).catch(() => {
      // If all else fails for navigation, return nothing (let browser handle)
      if (event.request.mode === 'navigate') {
        return new Response('', { status: 503, statusText: 'Offline' });
      }
      return new Response('Offline', { status: 503 });
    })
  );
});

// Listen for skip waiting message from the app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    console.log('[SW] Received skipWaiting message');
    self.skipWaiting();
  }
  if (event.data === 'clearCaches') {
    console.log('[SW] Clearing all caches...');
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Brandastic', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'dismiss') return;
  
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
