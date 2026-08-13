import { winnerAreaHeight } from './data/constants';
import type { RoundAd } from './types/Ad.type';

export type AdOverlayMode = 'preroll' | 'result';

export interface AdRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AdOverlayState {
  mode: AdOverlayMode;
  ad: RoundAd;
  since: number;
  endingSince?: number;
  clickRect?: AdRect;
  /** 노출 후 일정 시간이 지나야 생긴다. 없으면 아직 닫을 수 없다 */
  closeRect?: AdRect;
}

export interface AdImages {
  /** 프리롤 카드에 들어가는 로고 */
  preroll?: HTMLImageElement;
  /** 결과 화면 광고 소재 */
  result?: HTMLImageElement;
  qr?: HTMLImageElement;
}

const RESULT_GAP = 16;
const RESULT_NAME_RATIO = 0.13;
const RESULT_TAGLINE_RATIO = 0.1;
const RESULT_TAGLINE_GAP_EM = 0.8;
const RESULT_BAND_PADDING = 12;
const RESULT_BAND_COLOR = 'rgba(0, 0, 0, 0.75)';
const RESULT_LABEL_INSET = 12;
const QR_TO_LOGO_RATIO = 0.5;

const FADE_IN_MS = 250;
const FADE_OUT_MS = 200;

/** 결과 광고는 한가운데서 시작해 이만큼 뒤에 위로 비켜준다 */
const RESULT_MOVE_DELAY_MS = 2500;
const RESULT_MOVE_MS = 600;

/** 결과 광고를 이만큼 보여준 뒤에 닫기 버튼을 내준다 */
const CLOSE_DELAY_MS = 5000;
const CLOSE_FADE_MS = 250;
const CLOSE_INSET = 12;
const CLOSE_HIT_PADDING = 8;

const SERIF = `'Nanum Myeongjo', 'Noto Serif KR', AppleMyungjo, Batang, serif`;
const SANS = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;

function ready(img?: HTMLImageElement): img is HTMLImageElement {
  return !!img?.complete && img.naturalWidth > 0;
}

export function drawAdOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: AdOverlayState,
  images: AdImages
): boolean {
  const now = performance.now();
  let alpha = Math.min(1, (now - state.since) / FADE_IN_MS);

  if (state.endingSince !== undefined) {
    const out = 1 - (now - state.endingSince) / FADE_OUT_MS;
    if (out <= 0) return false;
    alpha = Math.min(alpha, out);
  }

  if (alpha <= 0) return true;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (state.mode === 'preroll') {
    drawPreroll(ctx, w, h, state.ad, images);
  } else {
    const rects = drawResult(ctx, w, h, state.ad, images, now - state.since);
    state.clickRect = rects?.click;
    state.closeRect = rects?.close;
  }

  ctx.restore();
  return true;
}

function drawPreroll(ctx: CanvasRenderingContext2D, w: number, h: number, ad: RoundAd, images: AdImages): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, w, h);

  const provideSize = clamp(h * 0.04, 14, 52);
  const sponsorSize = clamp(h * 0.026, 14, 30);
  const logoSize = Math.min(w * 0.3, h * 0.34, 360);
  const labelSize = clamp(h * 0.013, 9, 14);
  const gap = h * 0.022;

  const logo = ready(images.preroll) ? images.preroll : undefined;

  const parts = [provideSize, sponsorSize, logo ? logoSize : 0, labelSize];
  const total = parts.reduce((a, b) => a + b, 0) + gap * (parts.filter((p) => p > 0).length - 1);

  let y = (h - total) / 2;
  const cx = w / 2;

  ctx.font = `700 ${provideSize}px ${SERIF}`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = provideSize * 0.18;
  drawSpaced(ctx, '제공', cx, y + provideSize / 2, provideSize * 0.35);
  y += provideSize + gap;

  ctx.shadowBlur = sponsorSize * 0.3;
  ctx.font = `600 ${sponsorSize}px ${SANS}`;
  ctx.fillText(ad.advertiser, cx, y + sponsorSize / 2);
  y += sponsorSize + gap;

  ctx.shadowBlur = 0;

  if (logo) {
    ctx.drawImage(logo, cx - logoSize / 2, y, logoSize, logoSize);
    y += logoSize + gap;
  }

  ctx.font = `${labelSize}px ${SANS}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('광고', cx, y + labelSize / 2);
}

function drawResult(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ad: RoundAd,
  images: AdImages,
  elapsed: number
): { click?: AdRect; close?: AdRect } | undefined {
  const logo = ready(images.result) ? images.result : undefined;
  const qr = ready(images.qr) ? images.qr : undefined;
  if (!logo && !qr) return undefined;

  const logoSize = winnerAreaHeight;
  const qrSize = winnerAreaHeight * QR_TO_LOGO_RATIO;
  const bandH = logoSize + RESULT_BAND_PADDING * 2;
  const bandY = resultBandY(h, bandH, elapsed);
  const contentY = bandY + RESULT_BAND_PADDING;

  ctx.fillStyle = RESULT_BAND_COLOR;
  ctx.fillRect(0, bandY, w, bandH);

  const logoX = (w - logoSize) / 2;

  if (logo) {
    ctx.drawImage(logo, logoX, contentY, logoSize, logoSize);
  }

  const colX = logoX + logoSize + RESULT_GAP;
  const nameSize = logoSize * RESULT_NAME_RATIO;

  ctx.font = `600 ${nameSize}px ${SANS}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const nameMetrics = ctx.measureText(ad.advertiser);
  const ascent = nameMetrics.actualBoundingBoxAscent || nameSize * 0.8;
  ctx.fillText(ad.advertiser, colX, contentY + ascent);
  let colWidth = nameMetrics.width;

  const qrTop = qr ? contentY + logoSize - qrSize : contentY + logoSize;
  if (ad.tagline) {
    const taglineSize = logoSize * RESULT_TAGLINE_RATIO;
    ctx.font = `${taglineSize}px ${SANS}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.textBaseline = 'top';
    colWidth = Math.max(colWidth, ctx.measureText(ad.tagline).width);
    ctx.fillText(ad.tagline, colX, contentY + nameSize + taglineSize * RESULT_TAGLINE_GAP_EM);
  }

  if (qr) {
    ctx.drawImage(qr, colX, qrTop, qrSize, qrSize);
    colWidth = Math.max(colWidth, qrSize);
  }

  const clickLeft = logo ? logoX : colX;
  const clickRect: AdRect = {
    x: clickLeft,
    y: contentY,
    w: colX + colWidth - clickLeft,
    h: logoSize,
  };

  const labelSize = clamp(h * 0.013, 9, 14);
  ctx.font = `${labelSize}px ${SANS}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('광고', RESULT_LABEL_INSET, bandY + bandH - RESULT_LABEL_INSET);

  return { click: clickRect, close: drawCloseButton(ctx, w, bandY, h, elapsed) };
}

/**
 * 처음엔 화면 한가운데에 세워 눈에 띄게 하고, 잠깐 뒤 화면 위로 미끄러져 비켜준다.
 * 밴드 안의 로고·텍스트·QR·닫기 버튼이 모두 이 값에서 파생되므로 여기만 움직이면 된다.
 */
function resultBandY(h: number, bandH: number, elapsed: number): number {
  const center = (h - bandH) / 2;
  const t = clamp((elapsed - RESULT_MOVE_DELAY_MS) / RESULT_MOVE_MS, 0, 1);
  return center * (1 - easeInOut(t));
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** 밴드 오른쪽 위 구석의 닫기 버튼. 아직 나올 때가 아니면 그리지도, 누를 수도 없다 */
function drawCloseButton(
  ctx: CanvasRenderingContext2D,
  w: number,
  bandY: number,
  h: number,
  elapsed: number
): AdRect | undefined {
  if (elapsed < CLOSE_DELAY_MS) return undefined;

  const size = clamp(h * 0.045, 20, 34);
  const cx = w - CLOSE_INSET - size / 2;
  const cy = bandY + CLOSE_INSET + size / 2;
  const arm = size * 0.22;

  ctx.save();
  ctx.globalAlpha *= Math.min(1, (elapsed - CLOSE_DELAY_MS) / CLOSE_FADE_MS);
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = Math.max(1.5, size * 0.07);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy - arm);
  ctx.lineTo(cx + arm, cy + arm);
  ctx.moveTo(cx + arm, cy - arm);
  ctx.lineTo(cx - arm, cy + arm);
  ctx.stroke();
  ctx.restore();

  return {
    x: cx - size / 2 - CLOSE_HIT_PADDING,
    y: cy - size / 2 - CLOSE_HIT_PADDING,
    w: size + CLOSE_HIT_PADDING * 2,
    h: size + CLOSE_HIT_PADDING * 2,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function drawSpaced(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, spacing: number): void {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);

  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  let x = cx - total / 2;
  chars.forEach((c, i) => {
    ctx.fillText(c, x, cy);
    x += widths[i] + spacing;
  });
  ctx.textAlign = prevAlign;
}
