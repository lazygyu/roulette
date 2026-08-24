import './localization';
import { AdService } from './adService';
import options from './options';
import { Roulette } from './roulette';

// 어떤 버전이 실제로 돌고 있는지 관측한다. 옛 서비스워커에 고착된 클라이언트는
// 이 코드가 없는 번들을 쓰므로 이벤트를 보내지 않는다. 즉 전체 pageview 대비
// 이 이벤트의 비율이 곧 회수율이다.
//
// 번들 파일명의 content hash를 그대로 버전으로 쓴다. 빌드 시 주입이 필요 없고,
// 실제로 내용이 달라졌을 때만 값이 바뀌므로 커밋 해시보다 정확하다.
// import.meta.url은 못 쓴다. Parcel이 번들 URL이 아니라 소스 경로 리터럴로 치환한다.
// dev 서버는 파일명에 해시가 없어 'dev'로 떨어진다.
const bundleSrc = document.querySelector<HTMLScriptElement>('script[type="module"]')?.src ?? '';
const version = bundleSrc.match(/\.([0-9a-f]{6,})\.js/)?.[1] ?? 'dev';

// umami는 defer로 로드되므로 load 시점이면 이미 준비돼 있다.
window.addEventListener('load', () => {
  (window as any).umami?.track('version', { v: version });
});

const roulette = new Roulette();

const isLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);
const adService = new AdService(isLocalhost ? 'http://localhost:3000' : 'https://marblerouletteshop.com');

// 소재를 시작 버튼 누른 뒤에 받으면 프리롤이 로고 없이 떴다가 늦게 채워진다. 미리 받아둔다
const preloadNextAd = () => roulette.preloadAdImages(adService.nextUrls());
adService.onUpdate = preloadNextAd;
adService.init();

(window as any).roulette = roulette;
(window as any).options = options;
const PREROLL_MS = 1500;

function once(fn: () => void): () => void {
  let called = false;
  return () => {
    if (called) return;
    called = true;
    fn();
  };
}

(window as any).ads = {
  beginRound(onStart: () => void) {
    const start = once(onStart);

    let ad = null;
    try {
      ad = adService.pickForRound();
      roulette.setAd(ad);
      if (ad) adService.trackImpression();
      preloadNextAd();
    } catch (e) {
      console.error('[ads] 광고 준비 실패, 광고 없이 진행합니다', e);
      ad = null;
    }

    roulette.startRecording().then(() => {
      if (!ad) {
        start();
        return;
      }

      try {
        roulette.showAdOverlay('preroll');
      } catch (e) {
        console.error('[ads] 프리롤 표시 실패, 바로 시작합니다', e);
        start();
        return;
      }

      window.setTimeout(() => {
        roulette.hideAdOverlay();
        start();
      }, PREROLL_MS);
    });
  },
  showResult() {
    try {
      roulette.showAdOverlay('result');
    } catch (e) {
      console.error('[ads] 결과 화면 광고 표시 실패', e);
    }
  },
};
