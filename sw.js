// 電波が無くても画面を開けるようにする。
// 方針：電波があれば必ず新しいものを取りに行き、取れたら保存する。取れないときだけ保存したものを出す。
// （保存を先に出す作りにすると、直した画面が届かなくなるため）
const CACHE = 'kintore-v2';
const FIRST = ['./', 'index.html', 'app.css', 'app.js', 'store.js', 'exercises.json', 'img/body.svg', 'manifest.webmanifest'];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(FIRST)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  // 記録の送受信（POST）と、よそのサイトへの通信には手を出さない
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  ev.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))),
  );
});
