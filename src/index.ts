import './localization';
import { AdService } from './adService';
import options from './options';
import { registerServiceWorker } from './registerServiceWorker';
import { Roulette } from './roulette';

registerServiceWorker();

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
