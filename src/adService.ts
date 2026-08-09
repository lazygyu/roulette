import type { AdCreative, AdResponse, RoundAd } from './types/Ad.type';

const REFRESH_INTERVAL = 60000; // 60 seconds

const randomStart = () => Math.floor(Math.random() * 1000000);

export class AdService {
  private _ads: AdCreative[] = [];
  private _current: RoundAd | null = null;
  private _cursor = randomStart();
  private _creativeCursors = new Map<string, number>();
  private _apiBase: string;
  private _intervalId: number | null = null;

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
      this._ads = ads.map((ad) => ({
        ...ad,
        wide: (ad.wide ?? []).map((p) => this.resolve(p)),
        square: (ad.square ?? []).map((p) => this.resolve(p)),
        qrImage: ad.qrImage ? this.resolve(ad.qrImage) : undefined,
      }));
    } catch {
      this._ads = [];
    }
  }

  private resolve(path: string): string {
    return path.startsWith('/') ? `${this._apiBase}${path}` : path;
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

    const pick = (list: string[]) => (list.length > 0 ? list[creativeCursor % list.length] : undefined);

    this._current = {
      id: ad.id,
      slots: ad.slots,
      advertiser: ad.advertiser,
      tagline: ad.tagline,
      qrImage: ad.qrImage,
      linkUrl: ad.linkUrl,
      house: ad.house,
      wide: pick(ad.wide),
      square: pick(ad.square),
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
