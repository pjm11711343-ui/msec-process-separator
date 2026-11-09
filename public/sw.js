/* 공정분리 앱 서비스워커
 * - 화면(HTML)은 항상 최신 버전을 먼저 받아오고, 인터넷이 끊겼을 때만 저장된 화면 사용
 * - 빌드 파일(/assets/…, 해시 포함)과 아이콘은 한 번 받으면 재사용
 * - API·Firebase 요청은 건드리지 않음 (데이터는 항상 실시간)
 */
const CACHE = 'msec-ps-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/favicon.ico'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // Firebase 등 외부 요청 제외
  if (url.pathname.startsWith('/api/')) return;          // 서버 API 제외
  if (url.pathname.startsWith('/download/')) return;     // 배포 파일은 항상 최신

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then(r => r || Response.error()))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }))
    );
  }
});
