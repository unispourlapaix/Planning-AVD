// Retirement worker: no fetch handler and no offline cache.
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const scope = self.registration.scope;
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith("planning-avd-")
      || (name.startsWith("workbox-") && name.includes(scope))).map(name => caches.delete(name)));
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
