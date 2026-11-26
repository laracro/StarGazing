// Overhead service worker: keeps the app usable offline, out under a dark sky.
// Bump VERSION whenever the shell files change.
const VERSION = "overhead-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-180.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// the page itself: try the network first so updates arrive, but fall back to the cache
// after a few seconds or when offline
async function pageFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), 4000))
    ]);
    if (res.ok) cache.put("./index.html", res.clone());
    return res;
  } catch {
    return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
  }
}

// everything else (icons, Google Fonts): serve from cache, refresh in the background
async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const refresh = fetch(req).then((res) => {
    if (res.ok || res.type === "opaque") cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || refresh;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate") e.respondWith(pageFirst(req));
  else if (url.origin === location.origin || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) e.respondWith(cacheFirst(req));
});
