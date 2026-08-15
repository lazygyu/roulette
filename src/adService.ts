import type { AdCreative, AdCreativeMap, AdResponse, AdSlotKey, RoundAd } from './types/Ad.type';

const REFRESH_INTERVAL = 60000; // 60 seconds

const randomStart = () => Math.floor(Math.random() * 1000000);

export class AdService {
  private _ads: AdCreative[] = [];
  private _current: RoundAd | null = null;
  private _cursor = randomStart();
  private _creativeCursors = new Map<string, number>();
  private _apiBase: string;
  private _intervalId: number | null = null;

  /** 목록이 새로 들어올 때마다 불린다. 소재를 미리 받아두는 데 쓴다 */
  onUpdate?: () => void;

  constructor(apiBase: string) {
    this._apiBase = apiBase.replace(/\/$/, '');
  }

  get current(): RoundAd | null {
    return this._current;
  }

  async init(): Promise<void> {
    await this.fetchAds();
    this._startPeriodicRefresh();
  }

  destroy(): void {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  private _startPeriodicRefresh(): void {
    this._intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.fetchAds();
      }
    }, REFRESH_INTERVAL);
  }

  async fetchAds(): Promise<void> {
    try {
      const res = await fetch(`${this._apiBase}/api/ads/active`);
      if (!res.ok) return;
      const data = (await res.json()) as AdResponse;
      const ads = Array.isArray(data.ads) ? data.ads : [];
      this._ads = ads.map((ad) => {
        // 소재를 슬롯별로 나누기 전의 서버는 정사각 한 장을 프리롤과 결과가 함께 썼다
        const raw = ad.creatives ?? { goal: ad.wide, preroll: ad.square, result: ad.square };
        const creatives: AdCreativeMap<string[]> = {};
        for (const [slot, list] of Object.entries(raw)) {
          if (list?.length) creatives[slot as AdSlotKey] = list.map((p) => this.resolve(p));
        }
        return {
          ...ad,
          creatives,
          qrImage: ad.qrImage ? this.resolve(ad.qrImage) : undefined,
        };
      });
    } catch {
      this._ads = [];
    }
    this.onUpdate?.();
  }

  private resolve(path: string): string {
    return path.startsWith('/') ? `${this._apiBase}${path}` : path;
  }

  /**
   * 다음 `pickForRound()`가 고를 광고의 소재 URL 전부. 커서는 건드리지 않는다.
   * 어느 장이 뽑힐지는 슬롯별 커서에 달려 있어, 그 광고 것은 다 받아둔다.
   */
  nextUrls(): string[] {
    if (this._ads.length === 0) return [];
    const ad = this._ads[this._cursor % this._ads.length];
    const urls: string[] = [];
    for (const list of Object.values(ad.creatives)) {
      if (list) urls.push(...list);
    }
    if (ad.qrImage) urls.push(ad.qrImage);
    return urls;
  }

  pickForRound(): RoundAd | null {
    if (this._ads.length === 0) {
      this._current = null;
      return null;
    }

    const ad = this._ads[this._cursor % this._ads.length];
    this._cursor++;

    const creativeCursor = this._creativeCursors.get(ad.id) ?? randomStart();
    this._creativeCursors.set(ad.id, creativeCursor + 1);

    // 슬롯마다 장수가 달라 같은 커서라도 각자의 주기로 돈다 (프리롤은 1장이라 늘 같다)
    const creatives: AdCreativeMap<string> = {};
    for (const [slot, list] of Object.entries(ad.creatives)) {
      if (list?.length) creatives[slot as AdSlotKey] = list[creativeCursor % list.length];
    }

    this._current = {
      id: ad.id,
      slots: ad.slots,
      advertiser: ad.advertiser,
      tagline: ad.tagline,
      qrImage: ad.qrImage,
      linkUrl: ad.linkUrl,
      house: ad.house,
      creatives,
    };
    return this._current;
  }

  trackImpression(): void {
    const ad = this._current;
    if (!ad || ad.house) return;

    fetch(`${this._apiBase}/api/ads/${ad.id}/impression`, {
      method: 'POST',
      credentials: 'omit',
      keepalive: true,
    }).catch(() => {});
  }
}
