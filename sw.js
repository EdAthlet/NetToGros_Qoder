const CACHE_NAME = 'irish-calculator-v2.0.3';
const urlsToCache = [
  '/',
  '/index.html',
  '/contact.html',
  '/contact-success.html',
  '/batch/',
  '/batch/index.html',
  '/js/calculator-core.js',
  '/manifest.json',
  '/icon.svg'
];

function isCalculatorRequest(url) {
  if (url.pathname === '/payroll' || url.pathname.startsWith('/payroll/')) {
    return false;
  }
  return true;
}

function isHtmlRequest(request, url) {
  if (request.mode === 'navigate') return true;
  if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
    return true;
  }
  return url.pathname.endsWith('.html') || url.pathname.endsWith('/');
}

/** CSS/JS must not be cache-first or soft refresh keeps stale layout after deploys. */
function isStyleOrScript(url) {
  return (
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.mjs')
  );
}

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
      }
      return response;
    })
    .catch(() => caches.match(request));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache.startsWith('irish-calculator') && cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
          if (cache.startsWith('irish-payroll-v1')) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  if (!isCalculatorRequest(url)) {
    return;
  }

  // HTML + CSS + JS: network-first so soft refresh picks up deploys
  if (isHtmlRequest(event.request, url) || isStyleOrScript(url)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Other assets: cache-first (icons, fonts, etc.)
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
