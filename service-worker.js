const CACHE_NAME = "posture-pwa-v2";  // ★ 이름 바꿈 (v1 → v2 느낌)

const ASSETS = [
  "/",
  "/index.html",
  "/css/main.css",       // 실제 파일 경로에 맞게 추가
  "/js/app.js",
  "/manifest.json",
  "/assets/icon-192.png",   // 새 아이콘 경로/이름
  "/assets/icon-512.png"    // 새 아이콘 경로/이름
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

// ★ 새 캐시만 남기고 예전 캐시는 전부 삭제
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});
