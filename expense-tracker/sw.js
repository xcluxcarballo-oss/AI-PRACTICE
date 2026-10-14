// Service worker: caches the app so it opens instantly and works offline.
// Serves from the cache, then refreshes the cache in the background, so a new
// version appears the next time the app is opened. Bump VERSION when the file
// list changes.

const VERSION = 'saveit-v1';

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './js/app.js',
  './js/db.js',
  './js/store.js',
  './js/pwa.js',
  './js/money.js',
  './js/dates.js',
  './js/stats.js',
  './js/export.js',
  './js/defaults.js',
  './js/ui/amount.js',
  './js/ui/charts.js',
  './js/ui/dom.js',
  './js/ui/icons.js',
  './js/ui/sheet.js',
  './js/ui/swipe.js',
  './js/ui/toast.js',
  './js/screens/activity.js',
  './js/screens/budgets.js',
  './js/screens/categories.js',
  './js/screens/common.js',
  './js/screens/edit.js',
  './js/screens/home.js',
  './js/screens/settings.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Navigations (including ?action=add) all get the app shell.
  const key = request.mode === 'navigate' ? './index.html' : request;

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(key, { ignoreSearch: request.mode === 'navigate' });
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(key, response.clone());
          return response;
        })
        .catch(() => cached);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return network;
    }),
  );
});
