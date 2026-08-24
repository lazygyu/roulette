// dist/service-worker.js 를 생성한다.
//
// 예전에는 workbox precache를 만들었다. 그런데 index.html이 통째로 캐시되는 구조라
// 서비스워커가 한 번 갱신에 실패한 클라이언트는 그 안에 박힌 번들 해시까지 함께
// 고착돼, 몇 달 전 버전을 계속 쓰는 유저가 생겼다.
//
// 오프라인 지원은 요구사항이 아니다. globPatterns에 wasm이 빠져 있어서 Box2D를
// 캐시하지 않았고, 따라서 precache가 있던 시절에도 오프라인 동작은 안 됐다.
// 번들에는 content hash가 붙으므로 캐싱은 HTTP 캐시만으로 충분하다.
//
// 그래서 지금 이 파일이 만드는 것은 캐시가 아니라, 이미 등록된 옛 서비스워커를
// 회수하는 kill switch다. 옛 클라이언트에 도달하는 경로는 "옛 SW가 새 SW를
// install 성공시키는 것" 하나뿐인데, precache가 0바이트면 install이 실패할 수 없다.
//
// 이 파일은 최소 1년(2027-08까지) 유지해야 한다. 404가 되면 회수 경로가 끊긴다.

const assert = require('node:assert');
const { readFileSync, writeFileSync } = require('node:fs');

// 캐시 이름을 필터링하는 이유: github.io는 origin을 다른 프로젝트 페이지와
// 공유한다. caches.keys()를 전부 지우면 남의 프로젝트 캐시까지 지운다.
// 'images'와 'static-resources'는 옛 runtimeCaching의 cacheName이고,
// precache는 'workbox-precache-v2-https://lazygyu.github.io/roulette/' 형태다.
const isOurCache = (key) => key === 'images' || key === 'static-resources' || key.includes('/roulette/');

// 이 필터가 이 스크립트에서 가장 미묘한 부분이라 빌드할 때마다 점검한다.
// 아래 killSwitch에는 이 함수를 toString()으로 그대로 심으므로,
// 여기서 통과한 것과 실제로 배포되는 것이 항상 같다.
assert(isOurCache('workbox-precache-v2-https://lazygyu.github.io/roulette/'), 'precache를 지워야 한다');
assert(isOurCache('images'), '옛 runtimeCaching 캐시를 지워야 한다');
assert(isOurCache('static-resources'), '옛 runtimeCaching 캐시를 지워야 한다');
assert(!isOurCache('workbox-precache-v2-https://lazygyu.github.io/other-project/'), '남의 캐시는 두어야 한다');
assert(!isOurCache('some-unrelated-cache'), '남의 캐시는 두어야 한다');

const killSwitch = `self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const isOurCache = ${isOurCache.toString()};
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
`;

writeFileSync('dist/service-worker.js', killSwitch);

// src/index.ts가 번들 파일명의 content hash를 버전으로 읽는다. 파일명 규칙이나
// script 태그 구조가 바뀌면 조용히 'dev'로 떨어지므로 산출물로 확인한다.
const html = readFileSync('dist/index.html', 'utf-8');
const bundleSrc = html.match(/<script type=module src=([^\s>]+)/)?.[1] ?? '';
assert(/\.[0-9a-f]{6,}\.js/.test(bundleSrc), `버전 추출 실패: module script src가 "${bundleSrc}"`);
