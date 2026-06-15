const CACHE_NAME = 'irish-payroll-app-v2.0.0';
const urlsToCache = [
  '/payroll/',
  '/payroll/index.html',
  '/payroll/payroll.css',
  '/payroll/payroll-base.css',
  '/payroll/payroll-employees.css',
  '/payroll/payroll-run.css',
  '/payroll/payroll-payslip.css',
  '/payroll/payroll-tables.css',
  '/payroll/payroll-print.css',
  '/payroll/payroll.js',
  '/payroll/payroll-context.js',
  '/payroll/payroll-run.js',
  '/payroll/payroll-payslip.js',
  '/payroll/payroll-exports.js',
  '/payroll/payroll-history.js',
  '/payroll/employee-report.js',
  '/payroll/storage.js',
  '/payroll/employees.js',
  '/payroll/utils.js',
  '/payroll/payroll-mode.js',
  '/payroll/revenue-api.js',
  '/payroll/state-machine.js',
  '/payroll/js/calculator-core.js',
  '/js/calculator-core.js',
  '/manifest.json',
  '/icon.svg'
];

function isPayrollRequest(url) {
  return url.pathname === '/payroll' || url.pathname.startsWith('/payroll/');
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
          if (cache.startsWith('irish-payroll') && cache !== CACHE_NAME) {
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
  if (!isPayrollRequest(url)) {
    return;
  }

  if (event.request.url.includes('.html') || event.request.url.endsWith('/payroll/') || url.pathname === '/payroll') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

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