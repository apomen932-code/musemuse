const CACHE_NAME = 'archive-cache-v2';
const FILES = ['./', './index.html', './styles.css', './script.js', './manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES)).catch(() => {}));
});
self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(resp => resp || fetch(event.request)));
});
