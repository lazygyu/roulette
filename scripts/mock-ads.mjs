// 개발용 가짜 광고 서버.
//
// 운영 서버(marblerouletteshop.com)에 걸린 광고 소재를 한 번 받아 .mock-ads/ 에 두고,
// 같은 형식의 /api/ads/active 를 로컬에서 내려준다. 개발 서버를 `?mockAds` 로 열면 이 서버를 쓴다.
//
// 운영 API 를 직접 쓰지 않는 이유: 노출(impression)·클릭이 실제 광고 통계에 잡힌다.
// 그래서 여기서는 노출은 로그만 찍고, 클릭 링크는 로컬 페이지로 바꾼다.
//
//   node scripts/mock-ads.mjs            # 받아둔 소재가 없을 때만 내려받고 서버 시작
//   node scripts/mock-ads.mjs --refresh  # 운영 서버에서 다시 받기
//   MOCK_ADS_PORT=3100 (기본)

import { createServer } from 'node:http';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://marblerouletteshop.com';
const PORT = Number(process.env.MOCK_ADS_PORT || 3100);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.mock-ads');
const FILES = path.join(ROOT, 'files');
const MANIFEST = path.join(ROOT, 'ads.json');

const EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};
const MIME = Object.fromEntries(Object.entries(EXT).map(([mime, ext]) => [ext, mime]));

async function download(url, base) {
  const res = await fetch(new URL(url, SOURCE));
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  const name = base + (EXT[type] || '.bin');
  await writeFile(path.join(FILES, name), Buffer.from(await res.arrayBuffer()));
  return `/files/${name}`;
}

async function refresh() {
  console.log(`[mock-ads] ${SOURCE}/api/ads/active 에서 소재를 받습니다`);
  const res = await fetch(`${SOURCE}/api/ads/active`);
  if (!res.ok) throw new Error(`광고 목록을 못 받았습니다: ${res.status}`);
  const { ads = [] } = await res.json();

  await rm(ROOT, { recursive: true, force: true });
  await mkdir(FILES, { recursive: true });

  const mocked = [];
  for (const [i, ad] of ads.entries()) {
    const key = `ad${i}`;
    const creatives = {};
    for (const [slot, list] of Object.entries(ad.creatives ?? {})) {
      creatives[slot] = [];
      for (const [j, url] of (list ?? []).entries()) {
        creatives[slot].push(await download(url, `${key}-${slot}-${j}`));
      }
    }
    mocked.push({
      id: `mock-${i}`,
      slots: ad.slots,
      creatives,
      advertiser: ad.advertiser,
      tagline: ad.tagline,
      qrImage: ad.qrImage ? await download(ad.qrImage, `${key}-qr`) : undefined,
      linkUrl: ad.linkUrl ? `http://localhost:${PORT}/click/mock-${i}` : undefined,
    });
    console.log(`[mock-ads]  - ${ad.advertiser} (${ad.slots.join(', ')})`);
  }
  await writeFile(MANIFEST, JSON.stringify({ ads: mocked }, null, 2));
  console.log(`[mock-ads] ${mocked.length}건 저장: ${ROOT}`);
}

if (process.argv.includes('--refresh') || !existsSync(MANIFEST)) {
  await refresh();
}

const cors = { 'Access-Control-Allow-Origin': '*' };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'GET, POST' }).end();
    } else if (req.method === 'GET' && url.pathname === '/api/ads/active') {
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(await readFile(MANIFEST));
    } else if (req.method === 'POST' && /^\/api\/ads\/[^/]+\/impression$/.test(url.pathname)) {
      console.log(`[mock-ads] 노출 ${url.pathname.split('/')[3]}`);
      res.writeHead(204, cors).end();
    } else if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
      const name = path.basename(url.pathname);
      res.writeHead(200, { ...cors, 'Content-Type': MIME[path.extname(name)] || 'application/octet-stream' });
      res.end(await readFile(path.join(FILES, name)));
    } else if (req.method === 'GET' && url.pathname.startsWith('/click/')) {
      console.log(`[mock-ads] 클릭 ${path.basename(url.pathname)}`);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<p>가짜 광고 클릭 (mock-ads). 실제 광고주 페이지로 이동하지 않습니다.</p>');
    } else {
      res.writeHead(404, cors).end();
    }
  } catch (e) {
    res.writeHead(500, cors).end(String(e));
  }
}).listen(PORT, () => {
  console.log(`[mock-ads] http://localhost:${PORT} — 개발 서버를 http://localhost:1235/?mockAds 로 여세요`);
});
