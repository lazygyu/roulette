import type { ZoomZone } from './data/maps';

/**
 * (x, y) 의 연출 강도. 구역 밖은 0, 가장자리 0 에서 가운데 1 까지 오른다 (사각형 모양으로).
 * 여러 구역에 걸치면 가장 센 값
 */
export function zoomZoneIntensity(zones: ZoomZone[], x: number, y: number): number {
  let best = 0;
  for (const z of zones) {
    const hw = z.w / 2;
    const hh = z.h / 2;
    if (hw <= 0 || hh <= 0) continue;
    const t = 1 - Math.max(Math.abs(x - z.x) / hw, Math.abs(y - z.y) / hh);
    if (t > best) best = t;
  }
  return best;
}

/** 월드 좌표에 연출 구역을 그린다 (디버그) */
export function drawZoomZones(ctx: CanvasRenderingContext2D, zones: ZoomZone[]) {
  ctx.save();
  ctx.lineWidth = 0.08;
  for (const z of zones) {
    ctx.fillStyle = 'rgba(244, 114, 182, 0.15)';
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.9)';
    ctx.fillRect(z.x - z.w / 2, z.y - z.h / 2, z.w, z.h);
    ctx.strokeRect(z.x - z.w / 2, z.y - z.h / 2, z.w, z.h);
  }
  ctx.restore();
}
