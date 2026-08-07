import type { AdCreative, AdResponse } from './types/Ad.type';

export class AdService {
  private _ads: AdCreative[] = [];
  private _current: AdCreative | null = null;
  private _cursor = 0;
  private _apiBase: string;

  constructor(apiBase: string) {
    this._apiBase = apiBase.replace(/\/$/, '');
  }

  get current(): AdCreative | null {
    return this._current;
  }

  async fetchAds(): Promise<void> {
    try {
      const res = await fetch(`${this._apiBase}/api/ads/active`);
      if (!res.ok) return;
      const data = (await res.json()) as AdResponse;
      this._ads = Array.isArray(data.ads) ? data.ads : [];
    } catch {
      this._ads = [];
    }
  }

  pickForRound(): AdCreative | null {
    if (this._ads.length === 0) {
      this._current = null;
      return null;
    }
    this._current = this._ads[this._cursor % this._ads.length];
    this._cursor++;
    return this._current;
  }

  trackImpression(): void {
    const ad = this._current;
    if (!ad || ad.house) return;

    const url = `${this._apiBase}/api/ads/${ad.id}/impression`;
    const body = JSON.stringify({ id: ad.id });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}
