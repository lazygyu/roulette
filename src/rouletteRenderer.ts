import {
  type AdOverlayMode,
  type AdOverlayState,
  type AdRect,
  closeButtonSize,
  drawAdOverlay,
  drawCloseCircle,
} from './adRenderer';
import type { Camera } from './camera';
import { canvasHeight, canvasWidth, initialZoom, Themes, winnerAreaHeight } from './data/constants';
import type { StageDef } from './data/maps';
import type { GameObject } from './gameObject';
import { KeywordService } from './keywordService';
import type { Marble } from './marble';
import { MINIMAP_INSET, MINIMAP_WIDTH } from './minimap';
import type { WinnerRange } from './options';
import type { ParticleManager } from './particleManager';
import type { RoundAd } from './types/Ad.type';
import type { ColorTheme } from './types/ColorTheme';
import type { MapEntityState } from './types/MapEntity.type';
import type { VectorLike } from './types/VectorLike';
import type { UIObject } from './UIObject';

export type RenderParameters = {
  camera: Camera;
  stage: StageDef;
  entities: MapEntityState[];
  marbles: Marble[];
  winners: Marble[];
  particleManager: ParticleManager;
  effects: GameObject[];
  winnerRange: WinnerRange;
  /** 진행 중에는 null, 당첨자가 모두 확정되면 당첨자 배열 */
  result: Marble[] | null;
  size: VectorLike;
  theme: ColorTheme;
};

/** 기본 해상도에서 표시 캔버스 폭 상한 */
const MAX_DISPLAY_WIDTH = 1920;
/** High 해상도에서 캔버스 긴 변 상한 (물리 픽셀) */
const HIGH_MAX_LONG_SIDE = 1920;

/**
 * - default: 화면 절반 크기 씬 캔버스에 그린 뒤 표시 캔버스(폭 최대 1920)로 늘려 복사
 * - high: 캔버스 하나를 화면 픽셀 크기로 두고 바로 그린다. 긴 변 최대 1920
 * - ultra: high 와 같지만 상한 없이 창 크기 × devicePixelRatio
 *
 * 세 모드 모두 논리 좌표계(width/height)는 같다. 구도·UI 크기·입력 좌표는 그대로이고 선명도만 다르다
 */
export type RenderResolution = 'default' | 'high' | 'ultra';
const WINNER_TEXT_OFFSET = 30;
const RESULT_PANEL_MAX_WIDTH_RATIO = 0.9;
const RESULT_PANEL_MAX_HEIGHT_RATIO = 0.8;
const RESULT_COLUMN_MAX_WIDTH = 280;
const PROGRESS_MAX_WIDTH_RATIO = 0.3;
const PROGRESS_ACCENT = 'rgba(255, 215, 0, 0.8)';

export type AdHit = { type: 'close' } | { type: 'link'; url: string };

/** canvas.width 는 정수로 잘리므로 잘린 값끼리 비교한다 */
function setCanvasSize(canvas: HTMLCanvasElement, width: number, height: number) {
  const w = Math.floor(width);
  const h = Math.floor(height);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
}

function inRect(rect: AdRect | undefined, x: number, y: number): boolean {
  return !!rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export class RouletteRenderer {
  protected _canvas!: HTMLCanvasElement;
  protected _sceneCanvas!: HTMLCanvasElement;
  protected ctx!: CanvasRenderingContext2D;
  private _displayCtx!: CanvasRenderingContext2D;
  private _sceneCtx!: CanvasRenderingContext2D;
  public sizeFactor = 1;

  private _resolution: RenderResolution = 'default';
  /** 논리 좌표계 크기. 모든 그리기·카메라 계산의 기준 */
  private _viewWidth = canvasWidth;
  private _viewHeight = canvasHeight;
  /** high/ultra 에서 논리 1 = 물리 픽셀 몇 개. default 에서는 씬 캔버스에 1:1 로 그리므로 1 */
  protected _pixelScale = 1;
  /** 광고 오버레이 shadowBlur 배율. default 에서 보이던 번짐 크기에 맞춘다 */
  private _adBlurScale = 1;

  protected _images: { [key: string]: HTMLImageElement } = {};
  protected _theme: ColorTheme = Themes.dark;
  private _ad: RoundAd | null = null;
  private _adImageCache: Map<string, HTMLImageElement> = new Map();
  private _adOverlay: AdOverlayState | null = null;
  private _resultCloseRect: AdRect | null = null;
  private _resultPopupClosed = false;
  private _lastResult: Marble[] | null = null;
  protected _keywordService: KeywordService;

  constructor() {
    this._keywordService = this.createKeywordService();
  }

  protected createKeywordService(): KeywordService {
    return new KeywordService();
  }

  get width() {
    return this._viewWidth;
  }

  get height() {
    return this._viewHeight;
  }

  get resolution(): RenderResolution {
    return this._resolution;
  }

  set resolution(value: RenderResolution) {
    if (this._resolution === value) return;
    this._resolution = value;
    if (this._canvas) this.refreshSize();
  }

  private get _isDirect() {
    return this._resolution !== 'default';
  }

  get canvas() {
    return this._canvas;
  }

  set theme(value: ColorTheme) {
    this._theme = value;
  }

  async init() {
    await Promise.all([this._load(), this._keywordService.init()]);

    this._canvas = document.createElement('canvas');
    this._canvas.width = canvasWidth;
    this._canvas.height = canvasHeight;
    this._displayCtx = this._canvas.getContext('2d', {
      alpha: false,
    }) as CanvasRenderingContext2D;

    this._sceneCanvas = document.createElement('canvas');
    this._sceneCanvas.width = canvasWidth;
    this._sceneCanvas.height = canvasHeight;
    this._sceneCtx = this._sceneCanvas.getContext('2d', {
      alpha: false,
    }) as CanvasRenderingContext2D;
    this.ctx = this._sceneCtx;

    document.body.appendChild(this._canvas);

    const resizeObserver = new ResizeObserver(() => this.refreshSize());
    resizeObserver.observe(this._canvas);
    // 모니터를 옮겨 devicePixelRatio 만 바뀌는 경우는 ResizeObserver 가 잡지 못한다
    window.addEventListener('resize', () => this.refreshSize());
    this.refreshSize();
  }

  /** 화면 크기·dpr·해상도 모드가 바뀐 뒤 캔버스 크기를 다시 맞춘다 */
  refreshSize() {
    const rect = this._canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    // 논리 크기는 모드와 무관하게 원래 계산 그대로
    const width = Math.max(rect.width / 2, 640);
    const height = (width / rect.width) * rect.height;
    this._viewWidth = width;
    this._viewHeight = height;
    this.sizeFactor = width / rect.width;

    const defaultDisplayWidth = Math.min(rect.width, MAX_DISPLAY_WIDTH);

    if (!this._isDirect) {
      // 같은 값을 다시 넣어도 캔버스가 지워지므로 바뀔 때만 넣는다 (resize·ResizeObserver 가 같이 불린다)
      setCanvasSize(this._sceneCanvas, width, height);
      setCanvasSize(this._canvas, defaultDisplayWidth, (defaultDisplayWidth / rect.width) * rect.height);
      this._pixelScale = 1;
      this._adBlurScale = 1;
      this.ctx = this._sceneCtx;
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    let scale = (rect.width * dpr) / width;
    if (this._resolution === 'high') {
      scale = Math.min(scale, HIGH_MAX_LONG_SIDE / Math.max(width, height));
    }
    // 작은 창에서도 기본 해상도보다 흐려지지는 않게
    scale = Math.max(1, scale);

    const physW = Math.max(1, Math.round(width * scale));
    const physH = Math.max(1, Math.round(height * scale));
    setCanvasSize(this._canvas, physW, physH);
    this._pixelScale = physW / width;
    // default 에서 오버레이 번짐은 표시 캔버스 픽셀 단위였다. 같은 화면 크기로 보이도록 환산
    this._adBlurScale = physW / defaultDisplayWidth;

    // 씬 캔버스는 쓰지 않으므로 메모리만 돌려준다
    setCanvasSize(this._sceneCanvas, 1, 1);
    this.ctx = this._displayCtx;
  }

  private async _loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((rs) => {
      const img = new Image();
      img.addEventListener('load', () => {
        rs(img);
      });
      img.src = url;
    });
  }

  private async _load(): Promise<void> {
    const loadPromises = [
      { name: '챔루', imgUrl: new URL('../assets/images/chamru.png', import.meta.url) },
      { name: '쿠빈', imgUrl: new URL('../assets/images/kubin.png', import.meta.url) },
      { name: '꽉변', imgUrl: new URL('../assets/images/kkwak.png', import.meta.url) },
      { name: '꽉변호사', imgUrl: new URL('../assets/images/kkwak.png', import.meta.url) },
      { name: '꽉 변호사', imgUrl: new URL('../assets/images/kkwak.png', import.meta.url) },
      { name: '주누피', imgUrl: new URL('../assets/images/junyoop.png', import.meta.url) },
      { name: '왈도쿤', imgUrl: new URL('../assets/images/waldokun.png', import.meta.url) },
    ].map(({ name, imgUrl }) => {
      return (async () => {
        this._images[name] = await this._loadImage(imgUrl.toString());
      })();
    });

    loadPromises.push(
      (async () => {
        await this._loadImage(new URL('../assets/images/ff.svg', import.meta.url).toString());
      })()
    );

    await Promise.all(loadPromises);
  }

  private getMarbleImage(name: string): CanvasImageSource | undefined {
    // Priority 1: Hardcoded images
    if (this._images[name]) {
      return this._images[name];
    }
    // Priority 2: Keyword sprites from API
    return this._keywordService.getSprite(name);
  }

  protected onBeforeEntities(): void {}
  /** 장애물 아래에 월드 좌표로 덧그리는 그림 (테스트 플레이의 진행도 지도) */
  public debugDraw: ((ctx: CanvasRenderingContext2D) => void) | null = null;
  protected onAfterScene(): void {}

  setAd(ad: RoundAd | null): void {
    this._ad = ad;
    if (!ad) return;
    this.preloadAdImages([...Object.values(ad.creatives), ad.qrImage]);
  }

  /** 소재를 미리 받아둔다. 여기서 만든 엘리먼트를 나중에 그대로 그리므로 캐시 헤더와 무관하게 즉시 뜬다 */
  preloadAdImages(srcs: (string | undefined)[]): void {
    for (const src of srcs) {
      if (src) this.cacheAdImage(src);
    }
  }

  private adImage(src?: string): HTMLImageElement | undefined {
    return src ? this._adImageCache.get(src) : undefined;
  }

  private cacheAdImage(src: string): HTMLImageElement {
    const cached = this._adImageCache.get(src);
    if (cached) return cached;
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.src = src;
    this._adImageCache.set(src, el);
    return el;
  }

  showAdOverlay(mode: AdOverlayMode): void {
    if (!this._ad || !this._ad.slots?.includes(mode)) return;
    this._adOverlay = { mode, ad: this._ad, since: performance.now(), endingSince: undefined };
  }

  getAdHitAt(x: number, y: number): AdHit | null {
    const overlay = this._adOverlay;
    if (!overlay || overlay.endingSince !== undefined) return null;

    if (inRect(overlay.closeRect, x, y)) return { type: 'close' };

    const link = overlay.ad.linkUrl;
    if (link && inRect(overlay.clickRect, x, y)) return { type: 'link', url: link };

    return null;
  }

  hideAdOverlay(): void {
    if (this._adOverlay && this._adOverlay.endingSince === undefined) {
      this._adOverlay.endingSince = performance.now();
    }
  }

  private renderAdOverlay(renderParameters: RenderParameters): void {
    const overlay = this._adOverlay;
    if (!overlay) return;

    if (overlay.mode === 'result' && !renderParameters.result) {
      this.hideAdOverlay();
    }

    try {
      this._displayCtx.save();
      if (this._isDirect) {
        // 프레임 시작 때 건 논리 → 물리 배율이 이미 걸려 있다
        this._displayCtx.setTransform(this._pixelScale, 0, 0, this._pixelScale, 0, 0);
      } else {
        const scale = this._canvas.width / this.width;
        this._displayCtx.setTransform(scale, 0, 0, scale, 0, 0);
      }
      const alive = drawAdOverlay(
        this._displayCtx,
        this.width,
        this.height,
        overlay,
        {
          preroll: this.adImage(overlay.ad.creatives.preroll),
          result: this.adImage(overlay.ad.creatives.result),
          qr: this.adImage(overlay.ad.qrImage),
        },
        this._adBlurScale
      );
      this._displayCtx.restore();
      if (!alive) this._adOverlay = null;
    } catch (e) {
      this._displayCtx.restore();
      console.error('[ads] 오버레이 렌더링 실패, 이번 노출은 건너뜁니다', e);
      this._adOverlay = null;
    }
  }

  private renderAdBoards(stage: StageDef): void {
    const ad = this._ad;
    if (!ad || !ad.slots?.includes('goal') || !stage.adBoards?.length) return;

    const img = this.adImage(ad.creatives.goal);
    if (!img?.complete || img.naturalWidth === 0) return;

    try {
      this.ctx.save();
      for (const board of stage.adBoards) {
        const w = board.w ?? 4;
        const h = board.h ?? 1;
        const x = board.x - w / 2;
        const y = board.y - h / 2;
        this.ctx.drawImage(img, x, y, w, h);
      }
    } catch (e) {
      console.error('[ads] 광고판 렌더링 실패, 이번 게재는 건너뜁니다', e);
      this._ad = null;
    } finally {
      this.ctx.restore();
    }
  }

  render(renderParameters: RenderParameters, uiObjects: UIObject[]) {
    this._theme = renderParameters.theme;
    // 이후 모든 그리기는 논리 좌표 기준 (default 에서는 배율 1)
    this.ctx.setTransform(this._pixelScale, 0, 0, this._pixelScale, 0, 0);
    this.ctx.fillStyle = this._theme.background;
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.save();
    this.ctx.scale(initialZoom, initialZoom);
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.font = '0.4pt sans-serif';
    this.ctx.lineWidth = 3 / (renderParameters.camera.zoom + initialZoom);
    renderParameters.camera.renderScene(this.ctx, { x: this.width, y: this.height }, () => {
      this.renderAdBoards(renderParameters.stage);
      this.onBeforeEntities();
      this.debugDraw?.(this.ctx);
      this.renderEntities(renderParameters.entities);
      this.renderEffects(renderParameters);
      this.renderMarbles(renderParameters);
    });
    this.ctx.restore();
    this.onAfterScene();

    uiObjects.forEach((obj) => obj.render(this.ctx, renderParameters, this.width, this.height));
    renderParameters.particleManager.render(this.ctx);
    this.renderWinnerProgress(renderParameters);
    this.renderResult(renderParameters);

    if (!this._isDirect) {
      this._displayCtx.drawImage(this._sceneCanvas, 0, 0, this._canvas.width, this._canvas.height);
    }
    this.renderAdOverlay(renderParameters);
  }

  private renderEntities(entities: MapEntityState[]) {
    this.ctx.save();
    entities.forEach((entity) => {
      const transform = this.ctx.getTransform();
      this.ctx.translate(entity.x, entity.y);
      this.ctx.rotate(entity.angle);
      this.ctx.fillStyle = entity.shape.color ?? this._theme.entity[entity.shape.type].fill;
      this.ctx.strokeStyle = entity.shape.color ?? this._theme.entity[entity.shape.type].outline;
      // shadowBlur 는 변환 행렬을 따르지 않는 물리 픽셀 값이라 배율을 직접 곱한다
      this.ctx.shadowBlur = this._theme.entity[entity.shape.type].bloomRadius * this._pixelScale;
      this.ctx.shadowColor =
        entity.shape.bloomColor ?? entity.shape.color ?? this._theme.entity[entity.shape.type].bloom;
      const shape = entity.shape;
      switch (shape.type) {
        case 'polyline':
          if (shape.points.length > 0) {
            this.ctx.beginPath();
            this.ctx.moveTo(shape.points[0][0], shape.points[0][1]);
            for (let i = 1; i < shape.points.length; i++) {
              this.ctx.lineTo(shape.points[i][0], shape.points[i][1]);
            }
            this.ctx.stroke();
          }
          break;
        case 'box': {
          const w = shape.width * 2;
          const h = shape.height * 2;
          this.ctx.rotate(shape.rotation);
          this.ctx.fillRect(-w / 2, -h / 2, w, h);
          this.ctx.strokeRect(-w / 2, -h / 2, w, h);
          break;
        }
        case 'circle':
          this.ctx.beginPath();
          this.ctx.arc(0, 0, shape.radius, 0, Math.PI * 2, false);
          this.ctx.stroke();
          break;
      }

      this.ctx.setTransform(transform);
    });
    this.ctx.restore();
  }

  private renderEffects({ effects, camera }: RenderParameters) {
    effects.forEach((effect) => effect.render(this.ctx, camera.zoom * initialZoom, this._theme));
  }

  private renderMarbles({ marbles, camera, winnerRange, winners, size }: RenderParameters) {
    const firstIndex = winnerRange.start - winners.length;
    const lastIndex = winnerRange.end - winners.length;

    const viewPort = { x: camera.x, y: camera.y, w: size.x, h: size.y, zoom: camera.zoom * initialZoom };
    marbles.forEach((marble, i) => {
      marble.render(
        this.ctx,
        camera.zoom * initialZoom,
        i >= firstIndex && i <= lastIndex,
        false,
        this.getMarbleImage(marble.name),
        viewPort,
        this._theme
      );
    });
  }

  private renderResult(params: RenderParameters) {
    const result = params.result;
    // 새 결과가 나오면(또는 리셋되면) 닫힘 상태를 푼다. _result는 확정될 때마다 새 배열이다
    if (result !== this._lastResult) {
      this._lastResult = result;
      this._resultPopupClosed = false;
    }
    this._resultCloseRect = null;
    if (!result) return;
    // 1명이면 기존 하단 Winner 표시, 여러명이면 화면 중앙 당첨자 목록 팝업
    if (result.length === 1) {
      this.renderWinner(result[0], params.theme);
    } else if (!this._resultPopupClosed) {
      this.renderWinnerList(result, params);
    }
  }

  /** 결과 팝업 닫기 버튼을 눌렀는지 */
  getResultCloseHitAt(x: number, y: number): boolean {
    return inRect(this._resultCloseRect ?? undefined, x, y);
  }

  closeResultPopup(): void {
    this._resultPopupClosed = true;
  }

  /**
   * 여러명 모드에서 확정된 당첨자를 좌측 상단에 상시 표시한다.
   * 우측은 랭킹 리스트가 구슬 수만큼 내려오므로 겹친다. 좌측은 미니맵이 세로로 긴
   * 스트립이라 그 오른쪽에 붙인다.
   */
  private renderWinnerProgress({ winners, winnerRange, result, theme }: RenderParameters) {
    const { start, end } = winnerRange;
    if (end <= start) return; // 1명 추첨은 기존 하단 Winner 표시를 쓴다

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const lineHeight = Math.min(24, Math.max(14, h * 0.042));
    const pad = lineHeight * 0.6;
    const rankWidth = lineHeight * 1.9;
    const headerFont = `bold ${lineHeight * 0.7}px sans-serif`;
    const rankFont = `${lineHeight * 0.6}px sans-serif`;
    const nameFont = `bold ${lineHeight * 0.72}px sans-serif`;

    // 확정 전에는 골인한 당첨자만, 확정 후에는 최종 명단(조기 확정분 포함)을 쓴다
    const confirmed = result ?? winners.slice(start, end + 1);
    const header = `Winners ${confirmed.length} / ${end - start + 1}`;

    // 화면을 넘기면 오래된 쪽을 접는다. 전체 명단은 어차피 중앙 팝업에서 보여준다
    const maxRows = Math.max(1, Math.floor((h * 0.55) / lineHeight) - 2);
    const hidden = Math.max(0, confirmed.length - maxRows);
    const shown = confirmed.slice(hidden);
    const foldLabel = `+${hidden} more`;

    ctx.save();

    ctx.font = headerFont;
    let contentW = ctx.measureText(header).width;
    ctx.font = nameFont;
    for (const marble of shown) {
      contentW = Math.max(contentW, rankWidth + ctx.measureText(marble.name).width);
    }
    if (hidden > 0) {
      ctx.font = rankFont;
      contentW = Math.max(contentW, ctx.measureText(foldLabel).width);
    }

    const panelW = Math.min(contentW + pad * 2, w * PROGRESS_MAX_WIDTH_RATIO);
    const rows = shown.length + (hidden > 0 ? 1 : 0);
    // 헤더와 목록 사이 간격은 목록이 있을 때만 준다. 항상 주면 당첨자가 없을 때
    // 아래쪽에만 빈 공간이 남아 위아래 여백이 어긋난다
    const headerGap = rows > 0 ? lineHeight * 0.35 : 0;
    const panelH = pad * 2 + lineHeight + headerGap + rows * lineHeight;
    const panelX = MINIMAP_INSET + MINIMAP_WIDTH + pad;
    const panelY = MINIMAP_INSET; // 미니맵 상단과 맞춘다

    ctx.fillStyle = theme.winnerBackground;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = PROGRESS_ACCENT;
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = headerFont;
    ctx.fillStyle = theme.winnerText;
    ctx.fillText(header, panelX + pad, panelY + pad + lineHeight / 2);

    let y = panelY + pad + lineHeight + headerGap + lineHeight / 2;
    if (hidden > 0) {
      ctx.font = rankFont;
      ctx.fillStyle = theme.winnerText;
      ctx.fillText(foldLabel, panelX + pad, y);
      y += lineHeight;
    }

    shown.forEach((marble, i) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(panelX, y - lineHeight / 2, panelW, lineHeight);
      ctx.clip();

      ctx.font = rankFont;
      ctx.fillStyle = theme.winnerText;
      ctx.fillText(`#${start + hidden + i + 1}`, panelX + pad, y);

      ctx.font = nameFont;
      ctx.fillStyle = `hsl(${marble.hue} 100% ${theme.marbleLightness}%)`;
      ctx.fillText(marble.name, panelX + pad + rankWidth, y);
      ctx.restore();
      y += lineHeight;
    });

    ctx.restore();
  }

  /** 당첨자가 여러명일 때 화면 중앙에 목록 팝업을 그린다 */
  private renderWinnerList(winners: Marble[], { theme, winnerRange }: RenderParameters) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const lineHeight = Math.min(32, Math.max(16, h * 0.05));
    const padding = lineHeight;
    const titleHeight = lineHeight * 2;

    // 세로로 다 안 들어가면 열을 늘린다
    const maxRows = Math.max(
      1,
      Math.floor((h * RESULT_PANEL_MAX_HEIGHT_RATIO - titleHeight - padding * 2) / lineHeight)
    );
    const cols = Math.max(1, Math.ceil(winners.length / maxRows));
    const rows = Math.ceil(winners.length / cols);

    const colWidth = Math.min(RESULT_COLUMN_MAX_WIDTH, (w * RESULT_PANEL_MAX_WIDTH_RATIO - padding * 2) / cols);
    const panelW = colWidth * cols + padding * 2;
    const panelH = titleHeight + rows * lineHeight + padding;
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    ctx.save();

    ctx.fillStyle = theme.winnerBackground;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = theme.background;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = theme.winnerText;
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = theme.winnerText;
    ctx.font = `bold ${lineHeight * 1.1}px sans-serif`;
    ctx.fillText(`Winners (${winners.length})`, w / 2, panelY + titleHeight / 2);

    // 버튼 중심을 팝업 우상단 꼭지점에 맞춰 걸쳐놓는다. 뒤가 비치지 않게 불투명하게 채우되,
    // 검정으로 채우면 다크 테마에서 배경과 같아져 버튼으로 안 보이므로 대비되는 색을 쓴다
    this._resultCloseRect = drawCloseCircle(ctx, panelX + panelW, panelY, closeButtonSize(h), '#222');

    const rankWidth = lineHeight * 1.8;
    winners.forEach((marble, i) => {
      const col = Math.floor(i / rows);
      const row = i % rows;
      const x = panelX + padding + col * colWidth;
      const y = panelY + titleHeight + row * lineHeight + lineHeight / 2;

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y - lineHeight / 2, colWidth, lineHeight);
      ctx.clip();

      ctx.textAlign = 'right';
      ctx.fillStyle = theme.winnerText;
      ctx.font = `${lineHeight * 0.6}px sans-serif`;
      ctx.fillText(`#${winnerRange.start + i + 1}`, x + rankWidth * 0.8, y);

      ctx.textAlign = 'left';
      ctx.fillStyle = `hsl(${marble.hue} 100% ${theme.marbleLightness}%)`;
      ctx.font = `bold ${lineHeight * 0.75}px sans-serif`;
      ctx.fillText(marble.name, x + rankWidth, y);
      ctx.restore();
    });

    ctx.restore();
  }

  private renderWinner(winner: Marble, theme: ColorTheme) {
    this.ctx.save();
    this.ctx.fillStyle = theme.winnerBackground;
    this.ctx.fillRect(this.width / 2, this.height - winnerAreaHeight, this.width / 2, winnerAreaHeight);

    // Draw marble image or colored circle
    const marbleSize = 100;
    const marbleCenterX = this.width - marbleSize / 2 - 20;
    const marbleCenterY = this.height - winnerAreaHeight / 2;
    const marbleImage = this.getMarbleImage(winner.name);

    if (marbleImage) {
      this.ctx.drawImage(
        marbleImage,
        marbleCenterX - marbleSize / 2,
        marbleCenterY - marbleSize / 2,
        marbleSize,
        marbleSize
      );
    } else {
      this.ctx.beginPath();
      this.ctx.arc(marbleCenterX, marbleCenterY, marbleSize / 2, 0, Math.PI * 2);
      this.ctx.fillStyle = `hsl(${winner.hue} 100% ${theme.marbleLightness})`;
      this.ctx.fill();
    }

    this.ctx.fillStyle = theme.winnerText;
    this.ctx.strokeStyle = theme.winnerOutline;

    this.ctx.font = 'bold 48px sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.lineWidth = 4;
    const textRightX = marbleCenterX - marbleSize / 2 - 20;
    if (theme.winnerOutline) {
      this.ctx.strokeText('Winner', textRightX, this.height - 120 + WINNER_TEXT_OFFSET);
    }

    this.ctx.fillText('Winner', textRightX, this.height - 120 + WINNER_TEXT_OFFSET);
    this.ctx.font = 'bold 72px sans-serif';
    this.ctx.fillStyle = `hsl(${winner.hue} 100% ${theme.marbleLightness})`;
    if (theme.winnerOutline) {
      this.ctx.strokeText(winner.name, textRightX, this.height - 55 + WINNER_TEXT_OFFSET);
    }
    this.ctx.fillText(winner.name, textRightX, this.height - 55 + WINNER_TEXT_OFFSET);
    this.ctx.restore();
  }
}
