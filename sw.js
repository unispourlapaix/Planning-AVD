const CACHE_NAME = "planning-avd-app-v20260615-github-update";
const APP_SCOPE_PATH = new URL("./", self.location.href).pathname;
const APP_SHELL_URL = new URL("./", self.location.href).href;
const PRECACHE_URLS = [
  "./",
  "./index.html",
].map(path => new URL(path, self.location.href).href);
const offlineResponse = () => new Response("Planning-AVD est indisponible hors connexion.", {
  headers: { "Content-Type": "text/plain; charset=utf-8" },
  status: 503,
});

const isPlanningAvdRequest = url =>
  url.origin === self.location.origin
  && (url.pathname === APP_SCOPE_PATH || url.pathname.startsWith(APP_SCOPE_PATH));

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .catch(() => {}),
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("planning-avd-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !isPlanningAvdRequest(url)) return;
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(APP_SHELL_URL, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(APP_SHELL_URL).then(response => response || offlineResponse())),
  );
});
