import type { AdCreative } from './types/Ad.type';

export type AdOverlayMode = 'preroll' | 'result';

export interface AdOverlayState {
  mode: AdOverlayMode;
  ad: AdCreative;
  since: number;
  endingSince?: number;
}

export interface AdImages {
  square?: HTMLImageElement;
  qr?: HTMLImageElement;
}

const FADE_IN_MS = 250;
const FADE_OUT_MS = 200;

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
    drawResult(ctx, w, h, images);
  }

  ctx.restore();
  return true;
}

function drawPreroll(ctx: CanvasRenderingContext2D, w: number, h: number, ad: AdCreative, images: AdImages): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, w, h);

  const provideSize = clamp(h * 0.08, 28, 104);
  const sponsorSize = clamp(h * 0.026, 14, 30);
  const qrSize = Math.min(h * 0.16, 240);
  const logoBase = Math.min(w * 0.3, h * 0.34, 360);
  const logoSize = Math.min(Math.max(logoBase, qrSize * 1.4), w * 0.72);
  const labelSize = clamp(h * 0.013, 9, 14);
  const gap = h * 0.022;

  const logo = ready(images.square) ? images.square : undefined;
  const qr = ready(images.qr) ? images.qr : undefined;

  const parts = [provideSize, sponsorSize, logo ? logoSize : 0, qr ? qrSize : 0, labelSize];
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

  if (qr) {
    const pad = qrSize * 0.04;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - qrSize / 2 - pad, y - pad, qrSize + pad * 2, qrSize + pad * 2);
    ctx.drawImage(qr, cx - qrSize / 2, y, qrSize, qrSize);
    y += qrSize + gap;
  }

  ctx.font = `${labelSize}px ${SANS}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('광고', cx, y + labelSize / 2);
}

function drawResult(ctx: CanvasRenderingContext2D, w: number, h: number, images: AdImages): void {
  const logo = ready(images.square) ? images.square : undefined;
  const qr = ready(images.qr) ? images.qr : undefined;
  if (!logo && !qr) return;

  const pad = h * 0.018;
  const logoSize = Math.min(h * 0.16, 150);
  const qrSize = Math.min(h * 0.1, 96);
  const gap = h * 0.012;

  const inner = (logo ? logoSize : 0) + (qr ? qrSize : 0) + (logo && qr ? gap : 0);
  const cardW = Math.max(logoSize, qrSize) + pad * 2;
  const cardH = inner + pad * 2;
  const x = w - cardW - h * 0.03;
  const y = h - cardH - h * 0.03;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  fillRounded(ctx, x, y, cardW, cardH, Math.min(12, h * 0.014));

  let cy = y + pad;
  const cx = x + cardW / 2;

  if (logo) {
    ctx.drawImage(logo, cx - logoSize / 2, cy, logoSize, logoSize);
    cy += logoSize + gap;
  }
  if (qr) {
    ctx.drawImage(qr, cx - qrSize / 2, cy, qrSize, qrSize);
  }
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

function fillRounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.fill();
}
