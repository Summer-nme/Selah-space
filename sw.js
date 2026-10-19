var V = "selah-v1";
var FILES = ["./", "index.html", "style.css", "script.js", "config.js", "manifest.json", "icon-192.png", "icon-512.png"];
self.addEventListener("install", function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(FILES); })); self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (n) { return n !== V; }).map(function (n) { return caches.delete(n); })); }));
  self.clients.claim();
});
// Network first so new commits show up; cached copy is the offline fallback.
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function (r) { var c = r.clone(); caches.open(V).then(function (x) { x.put(e.request, c); }); return r; }).catch(function () { return caches.match(e.request); }));
});
self.addEventListener("notificationclick", function (e) { e.notification.close(); e.waitUntil(clients.openWindow("./")); });
