self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const isOurCache = (key) => key === 'images' || key === 'static-resources' || key.includes('/roulette/');
      const keys = await caches.keys();
      await Promise.all(keys.filter(isOurCache).map((key) => caches.delete(key)));

      // 열려 있는 탭 목록은 unregister 전에 확보해 둔다.
      const clients = await self.clients.matchAll({ type: 'window' });
      await self.registration.unregister();

      // 이 시점엔 컨트롤러가 없으므로 네트워크에서 최신 index.html을 받는다.
      for (const client of clients) {
        client.navigate(client.url).catch(() => {});
      }
    })(),
  );
});
