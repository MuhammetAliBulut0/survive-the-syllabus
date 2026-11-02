// Survive the Syllabus — çevrimdışı destek
// Site dosyaları her zaman önce internetten alınır (güncellemeler hemen görünür),
// internet yoksa son kaydedilen kopya açılır. Giriş ve kayıt istekleri hiç önbelleğe alınmaz.
const CACHE = "sts-v2";
const CORE = ["/", "/platform.js", "/config.js", "/manifest.webmanifest", "/icon-192.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co")) return;                       // hesap ve kayıt: her zaman canlı
  const isLib = url.hostname === "cdn.jsdelivr.net" || url.hostname.endsWith("gstatic.com") || url.hostname === "fonts.googleapis.com";
  if (isLib) {                                                             // sürümü sabit kütüphane ve yazı tipleri: önbellekten
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok || res.type === "opaque") { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return res; })));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(req).then(res => {                                   // site dosyaları: önce internet
    if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req.mode === "navigate" ? "/" : req, cp)); }
    return res;
  }).catch(() => caches.match(req.mode === "navigate" ? "/" : req).then(hit => hit || caches.match("/"))));
});
