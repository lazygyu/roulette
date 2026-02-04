import { KeywordEntry, KeywordsData } from './types/keyword.type';

const KEYWORDS_URL = 'https://marblerouletteshop.com/api/external/keywords.json';
const SPRITE_BASE_URL = 'https://marblerouletteshop.com/api/external/sprites';
const REFRESH_INTERVAL = 60000; // 60 seconds

export class KeywordService {
  private _keywordsData: KeywordsData | null = null;
  private _spriteSheets: Map<number, HTMLImageElement> = new Map();
  private _extractedSprites: Map<string, CanvasImageSource> = new Map();
  private _intervalId: number | null = null;
  private _loadingSprites: Map<number, Promise<HTMLImageElement | null>> = new Map();
  private _lastGeneratedAt: string | null = null;

  async init(): Promise<void> {
    await this.fetchKeywords();
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
        this.fetchKeywords();
      }
    }, REFRESH_INTERVAL);
  }

  async fetchKeywords(): Promise<void> {
    try {
      const response = await fetch(KEYWORDS_URL);
      if (!response.ok) {
        console.warn(`[KeywordService] Failed to fetch keywords: ${response.status}`);
        return;
      }
      const newData: KeywordsData = await response.json();
      console.log(`[KeywordService] Fetched ${Object.keys(newData.keywords ?? {}).length} keywords`);

      // Check if generated_at is newer than last load
      const isNewer =
        this._lastGeneratedAt === null ||
        new Date(newData.generated_at) > new Date(this._lastGeneratedAt);

      if (isNewer) {
        // Clear sprite caches when data is updated
        this._spriteSheets.clear();
        this._extractedSprites.clear();
        this._loadingSprites.clear();
        console.log('[KeywordService] Data updated, clearing sprite caches');
      }

      this._keywordsData = newData;
      this._lastGeneratedAt = newData.generated_at;

      // Preload sprite sheets for all keywords
      const spriteIds = new Set<number>();
      for (const entry of Object.values(this._keywordsData.keywords)) {
        spriteIds.add(entry.sprite);
      }
      await Promise.all([...spriteIds].map((id) => this._loadSpriteSheet(id)));
    } catch (error) {
      console.warn('[KeywordService] Error fetching keywords:', error);
    }
  }

  private async _loadSpriteSheet(spriteId: number): Promise<HTMLImageElement | null> {
    if (this._spriteSheets.has(spriteId)) {
      return this._spriteSheets.get(spriteId)!;
    }

    // Check if already loading
    if (this._loadingSprites.has(spriteId)) {
      return this._loadingSprites.get(spriteId)!;
    }

    const loadPromise = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this._spriteSheets.set(spriteId, img);
        console.log(`[KeywordService] Loaded sprite sheet ${spriteId}`);
        resolve(img);
      };
      img.onerror = () => {
        console.warn(`[KeywordService] Failed to load sprite sheet ${spriteId}`);
        resolve(null);
      };
      img.src = `${SPRITE_BASE_URL}/${spriteId}.png?generated_at=${encodeURIComponent(this._lastGeneratedAt ?? '')}`;
    });

    this._loadingSprites.set(spriteId, loadPromise);
    const result = await loadPromise;
    this._loadingSprites.delete(spriteId);
    return result;
  }

  private _extractSprite(
    spriteSheet: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
  ): CanvasImageSource {
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : document.createElement('canvas');

    if (!(canvas instanceof OffscreenCanvas)) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    if (ctx) {
      ctx.drawImage(spriteSheet, x, y, width, height, 0, 0, width, height);
    }

    return canvas;
  }

  getSprite(marbleName: string): CanvasImageSource | undefined {
    if (!this._keywordsData) {
      return undefined;
    }

    const entry: KeywordEntry | undefined = this._keywordsData.keywords[marbleName];
    if (!entry) {
      return undefined;
    }

    // Check expiration
    if (new Date(entry.expires_at) < new Date()) {
      return undefined;
    }

    // Check cache first
    const cacheKey = `${entry.sprite}_${entry.x}_${entry.y}_${entry.width}_${entry.height}`;
    if (this._extractedSprites.has(cacheKey)) {
      return this._extractedSprites.get(cacheKey);
    }

    // Get sprite sheet
    const spriteSheet = this._spriteSheets.get(entry.sprite);
    if (!spriteSheet) {
      return undefined;
    }

    // Extract and cache the sprite
    const sprite = this._extractSprite(spriteSheet, entry.x, entry.y, entry.width, entry.height);
    this._extractedSprites.set(cacheKey, sprite);

    return sprite;
  }
}
