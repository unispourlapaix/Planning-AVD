self.addEventListener("install", event => {
  self.skipWaiting();
});

const APP_SCOPE_PATH = new URL("./", self.location.href).pathname;

const isPlanningAvdRequest = url =>
  url.origin === self.location.origin
  && (url.pathname === APP_SCOPE_PATH || url.pathname.startsWith(APP_SCOPE_PATH));

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("planning-avd-")).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !isPlanningAvdRequest(url)) return;
  event.respondWith(fetch(event.request));
});
