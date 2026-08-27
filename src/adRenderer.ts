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
/** 좌상단으로 붙었을 때 '광고' 라벨이 로고와 겹치지 않게 비워두는 왼쪽 여백 */
const RESULT_LABEL_GUTTER = 34;
const QR_TO_LOGO_RATIO = 0.5;

const FADE_IN_MS = 250;
const FADE_OUT_MS = 200;

/** 결과 광고는 한가운데 전체 폭으로 시작해, 이만큼 뒤에 좌상단으로 오므라든다 */
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
  const nameSize = logoSize * RESULT_NAME_RATIO;
  const taglineSize = logoSize * RESULT_TAGLINE_RATIO;
  const bandH = logoSize + RESULT_BAND_PADDING * 2;

  // 오므라든 폭을 알아야 밴드를 먼저 깔 수 있어서, 글자 폭은 그리기 전에 재둔다
  ctx.font = `600 ${nameSize}px ${SANS}`;
  const nameMetrics = ctx.measureText(ad.advertiser);
  let colWidth = nameMetrics.width;
  if (ad.tagline) {
    ctx.font = `${taglineSize}px ${SANS}`;
    colWidth = Math.max(colWidth, ctx.measureText(ad.tagline).width);
  }
  if (qr) colWidth = Math.max(colWidth, qrSize);

  const t = easeInOut(clamp((elapsed - RESULT_MOVE_DELAY_MS) / RESULT_MOVE_MS, 0, 1));
  // 오므라들면 오른쪽 위 구석이 광고주명 자리가 되므로, 닫기 버튼 자리를 따로 비워둔다
  const dockedW =
    RESULT_LABEL_GUTTER + logoSize + RESULT_GAP + colWidth + RESULT_BAND_PADDING * 2 + closeButtonSize(h) + CLOSE_INSET;

  const bandY = lerp((h - bandH) / 2, 0, t);
  const bandW = lerp(w, Math.min(dockedW, w), t);
  const contentY = bandY + RESULT_BAND_PADDING;
  const logoX = lerp((w - logoSize) / 2, RESULT_BAND_PADDING + RESULT_LABEL_GUTTER, t);
  const colX = logoX + logoSize + RESULT_GAP;

  ctx.fillStyle = RESULT_BAND_COLOR;
  ctx.fillRect(0, bandY, bandW, bandH);

  if (logo) {
    ctx.drawImage(logo, logoX, contentY, logoSize, logoSize);
  }

  ctx.font = `600 ${nameSize}px ${SANS}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const ascent = nameMetrics.actualBoundingBoxAscent || nameSize * 0.8;
  ctx.fillText(ad.advertiser, colX, contentY + ascent);

  if (ad.tagline) {
    ctx.font = `${taglineSize}px ${SANS}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.textBaseline = 'top';
    ctx.fillText(ad.tagline, colX, contentY + nameSize + taglineSize * RESULT_TAGLINE_GAP_EM);
  }

  if (qr) {
    ctx.drawImage(qr, colX, contentY + logoSize - qrSize, qrSize, qrSize);
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

  return { click: clickRect, close: drawCloseButton(ctx, bandW, bandY, h, elapsed) };
}

export function closeButtonSize(h: number): number {
  return clamp(h * 0.045, 20, 34);
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * 원형 닫기 버튼(동그라미 + X)을 중심 좌표에 그리고 히트 영역을 돌려준다.
 * 기본 채움은 반투명이다. 광고 밴드 위에서는 밴드와 섞이는 편이 자연스럽지만,
 * 무언가에 걸쳐놓을 때는 뒤가 비치므로 불투명한 색을 넘겨야 한다.
 */
export function drawCloseCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  fill: string = 'rgba(0, 0, 0, 0.5)'
): AdRect {
  const arm = size * 0.22;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = fill;
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

/** 밴드 오른쪽 위 구석의 닫기 버튼. 아직 나올 때가 아니면 그리지도, 누를 수도 없다 */
function drawCloseButton(
  ctx: CanvasRenderingContext2D,
  w: number,
  bandY: number,
  h: number,
  elapsed: number
): AdRect | undefined {
  if (elapsed < CLOSE_DELAY_MS) return undefined;

  const size = closeButtonSize(h);
  ctx.save();
  ctx.globalAlpha *= Math.min(1, (elapsed - CLOSE_DELAY_MS) / CLOSE_FADE_MS);
  const rect = drawCloseCircle(ctx, w - CLOSE_INSET - size / 2, bandY + CLOSE_INSET + size / 2, size);
  ctx.restore();
  return rect;
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
