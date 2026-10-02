// 진행도 지도: 순위 계산용. 맵의 각 위치에서 결승선까지 "벽을 피해 가는" 거리.
//
// y 좌표만으로 순위를 매기면 옆으로 돌아가거나 위로 올라갔다 내려오는 맵에서 순위가 틀어진다.
// 맵을 불러올 때 한 번 격자를 만들어 결승선에서부터 거리를 퍼뜨려 두고,
// 매 프레임에는 구슬 위치 주변 칸 몇 개만 읽어 남은 거리를 구한다.
//
// - 고정된 벽만 막힘으로 본다. 회전하는 장애물은 잠깐 막을 뿐 길을 정하지 않고,
//   부서지는 벽은 부서지면 지나갈 수 있으므로 둘 다 길로 본다.
// - 벽을 구슬 반지름만큼 두껍게 잡아 구슬이 못 지나가는 틈은 막힌 것으로 본다.
// - 중력: 위로 가는 이동은 회전 장애물이 쓸고 지나가는 곳이나 튕겨 내는 장애물 근처("올라가는 구역") 에서만
//   보통 비용이고, 그 밖에서는 UP_PENALTY 배 비용이다. 놓치면 돌아 올라와야 하는 바닥이 실제처럼 멀어진다.
// - 일방통행 선(stage.progress.oneWays): 맵 제작자가 지정한 선. 화살표 반대 방향으로는 넘을 수 없다고 본다.

import type { OneWayLine, StageDef } from './data/maps';
import type { MapEntity } from './types/MapEntity.type';

const CELL = 0.25;
const MARBLE_RADIUS = 0.25;
/** 벽 판정 두께. 칸이 대각선으로 새지 않으려면 CELL * √2 / 2 이상이어야 한다 */
const INFLATE = Math.max(MARBLE_RADIUS, (CELL * Math.SQRT2) / 2 + 0.001);
/** 출발 통로 위쪽은 구슬이 쌓이는 곳까지만 본다. 그보다 위는 맨 윗줄 값에 거리를 더한다 */
const TOP_LIMIT = -30;
const MARGIN = 1;
/** 결승선과 이어지지 않은 곳(갇힌 공간) 의 거리. 이어진 곳보다 항상 뒤로 간다 */
const UNREACHABLE = 1e6;

const BLOCKED = -1;

/** 올라가는 구역 밖에서 위로 가는 이동의 비용 배수 */
const UP_PENALTY = 10;
/** 회전 장애물이 쓸고 지나가는 범위에 더하는 여유 */
const LIFT_MARGIN = MARBLE_RADIUS + 0.5;
/** 튕겨 내는 장애물(탄성 1 초과) 표면에서 이 거리 안은 올라갈 수 있다고 본다 */
const BOUNCE_RANGE = 1.5;

export class ProgressMap {
  readonly cols: number;
  readonly rows: number;
  readonly minX: number;
  readonly minY: number;
  /** 칸마다 결승까지 거리. BLOCKED 는 벽, Infinity 는 결승선과 이어지지 않은 칸 */
  readonly dist: Float32Array;
  readonly maxDist: number;
  /** 올라가는 구역 (1 = 위로 갈 수 있음) */
  readonly lift: Uint8Array;
  /** 일방통행 선 근처 칸 (1 = 이 칸을 드나드는 이동은 일방통행 선과 교차하는지 확인한다) */
  private readonly nearOneWay: Uint8Array | null;
  private readonly oneWays: OneWayLine[];

  private constructor(stage: StageDef) {
    const entities = (stage.entities ?? []).filter(isBlocking);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    for (const e of entities) {
      for (const [x, y] of reachPoints(e)) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
      }
    }
    if (!Number.isFinite(minX)) {
      minX = 0;
      maxX = 26;
      minY = 0;
    }
    this.minX = Math.floor(minX - MARGIN);
    this.minY = Math.floor(Math.max(minY, TOP_LIMIT) - MARGIN);
    const maxY = stage.goalY + MARGIN;
    this.cols = Math.ceil((maxX + MARGIN - this.minX) / CELL) + 1;
    this.rows = Math.ceil((maxY - this.minY) / CELL) + 1;
    this.dist = new Float32Array(this.cols * this.rows).fill(Infinity);

    for (const e of entities) this.rasterize(e);
    this.lift = this.findLiftCells(stage.entities ?? []);
    this.oneWays = (stage.progress?.oneWays ?? []).filter((l) => l.from[0] !== l.to[0] || l.from[1] !== l.to[1]);
    this.nearOneWay = this.oneWays.length ? this.markOneWayCells() : null;
    this.maxDist = this.propagate(stage.goalY);
  }

  private static cache = new WeakMap<StageDef, ProgressMap>();

  /** 같은 맵 객체면 다시 만들지 않는다 */
  static for(stage: StageDef): ProgressMap {
    let map = ProgressMap.cache.get(stage);
    if (!map) {
      map = new ProgressMap(stage);
      ProgressMap.cache.set(stage, map);
    }
    return map;
  }

  private cellX(col: number) {
    return this.minX + col * CELL;
  }

  private cellY(row: number) {
    return this.minY + row * CELL;
  }

  /**
   * 엔티티 표면에서 INFLATE 안쪽 칸을 막는다.
   * 선과 사각형은 선분마다 따로 표시한다 (사각형은 네 변. 안쪽 칸은 벽에 둘러싸여 어차피 닿을 수 없다).
   * 엔티티 전체의 경계 상자로 훑으면 맵을 가로지르는 긴 선에서 칸 수 × 선분 수만큼 계산하게 된다
   */
  private rasterize(e: MapEntity) {
    if (e.shape.type !== 'circle') {
      const pts = reachPoints(e);
      const closed = e.shape.type === 'box';
      for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        this.rasterizeSegment(ax, ay, bx, by);
      }
      return;
    }
    // 원은 크기 상한(반지름 10) 이 작아 경계 상자로 훑는다
    const { x, y } = e.position;
    const reach = e.shape.radius + INFLATE;
    const distanceTo = shapeDistance(e);
    const c0 = Math.max(0, Math.floor((x - reach - this.minX) / CELL));
    const c1 = Math.min(this.cols - 1, Math.ceil((x + reach - this.minX) / CELL));
    const r0 = Math.max(0, Math.floor((y - reach - this.minY) / CELL));
    const r1 = Math.min(this.rows - 1, Math.ceil((y + reach - this.minY) / CELL));
    for (let r = r0; r <= r1; r++) {
      const cy = this.cellY(r);
      for (let c = c0; c <= c1; c++) {
        if (distanceTo(this.cellX(c), cy) < INFLATE) this.dist[r * this.cols + c] = BLOCKED;
      }
    }
  }

  /**
   * 선분에서 INFLATE 안쪽 칸을 막는다. 격자 밖 부분은 잘라 내고, 선분을 따라 반 칸씩 걸으며 주변 칸만 본다.
   * 비용은 격자 안 선분 길이에 비례한다
   */
  private rasterizeSegment(ax: number, ay: number, bx: number, by: number) {
    const minX = this.minX - INFLATE;
    const maxX = this.minX + (this.cols - 1) * CELL + INFLATE;
    const minY = this.minY - INFLATE;
    const maxY = this.minY + (this.rows - 1) * CELL + INFLATE;
    // Liang-Barsky 로 격자 범위에 자른다
    const dx = bx - ax;
    const dy = by - ay;
    let t0 = 0;
    let t1 = 1;
    for (const [p, q] of [
      [-dx, ax - minX],
      [dx, maxX - ax],
      [-dy, ay - minY],
      [dy, maxY - ay],
    ]) {
      if (p === 0) {
        if (q < 0) return;
      } else {
        const t = q / p;
        if (p < 0) t0 = Math.max(t0, t);
        else t1 = Math.min(t1, t);
      }
    }
    if (t0 > t1) return;
    const sx = ax + dx * t0;
    const sy = ay + dy * t0;
    const len = Math.hypot(dx, dy) * (t1 - t0);
    const steps = Math.max(1, Math.ceil(len / (CELL / 2)));
    const span = Math.ceil(INFLATE / CELL) + 1;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const c = Math.round((sx + dx * (t1 - t0) * t - this.minX) / CELL);
      const r = Math.round((sy + dy * (t1 - t0) * t - this.minY) / CELL);
      for (let rr = Math.max(0, r - span); rr <= Math.min(this.rows - 1, r + span); rr++) {
        for (let cc = Math.max(0, c - span); cc <= Math.min(this.cols - 1, c + span); cc++) {
          const i = rr * this.cols + cc;
          if (this.dist[i] === BLOCKED) continue;
          if (segmentDistance(this.cellX(cc), this.cellY(rr), ax, ay, bx, by) < INFLATE) this.dist[i] = BLOCKED;
        }
      }
    }
  }

  /** 회전 장애물이 쓸고 지나가는 원, 튕겨 내는 장애물 주변을 올라가는 구역으로 표시한다 */
  private findLiftCells(all: MapEntity[]): Uint8Array {
    const lift = new Uint8Array(this.cols * this.rows);
    const mark = (x0: number, x1: number, y0: number, y1: number, inside: (x: number, y: number) => boolean) => {
      const c0 = Math.max(0, Math.floor((x0 - this.minX) / CELL));
      const c1 = Math.min(this.cols - 1, Math.ceil((x1 - this.minX) / CELL));
      const r0 = Math.max(0, Math.floor((y0 - this.minY) / CELL));
      const r1 = Math.min(this.rows - 1, Math.ceil((y1 - this.minY) / CELL));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (inside(this.cellX(c), this.cellY(r))) lift[r * this.cols + c] = 1;
        }
      }
    };
    for (const e of all) {
      if (e.type === 'kinematic' && e.props.angularVelocity !== 0) {
        // 물리 몸체는 position 을 중심으로 돈다
        const { x: ox, y: oy } = e.position;
        const reach = Math.max(...reachPoints(e).map(([x, y]) => Math.hypot(x - ox, y - oy))) + LIFT_MARGIN;
        mark(ox - reach, ox + reach, oy - reach, oy + reach, (x, y) => Math.hypot(x - ox, y - oy) <= reach);
      }
      if (e.props.restitution > 1) {
        const pts = reachPoints(e);
        const distanceTo = shapeDistance(e);
        mark(
          Math.min(...pts.map((p) => p[0])) - BOUNCE_RANGE,
          Math.max(...pts.map((p) => p[0])) + BOUNCE_RANGE,
          Math.min(...pts.map((p) => p[1])) - BOUNCE_RANGE,
          Math.max(...pts.map((p) => p[1])) + BOUNCE_RANGE,
          (x, y) => distanceTo(x, y) <= BOUNCE_RANGE
        );
      }
    }
    return lift;
  }

  /** 일방통행 선에서 한 칸 반 안쪽 칸을 표시한다 (그보다 먼 칸끼리의 이동은 선과 만날 수 없다) */
  private markOneWayCells(): Uint8Array {
    const near = new Uint8Array(this.cols * this.rows);
    const range = CELL * 1.5;
    for (const { from, to } of this.oneWays) {
      const c0 = Math.max(0, Math.floor((Math.min(from[0], to[0]) - range - this.minX) / CELL));
      const c1 = Math.min(this.cols - 1, Math.ceil((Math.max(from[0], to[0]) + range - this.minX) / CELL));
      const r0 = Math.max(0, Math.floor((Math.min(from[1], to[1]) - range - this.minY) / CELL));
      const r1 = Math.min(this.rows - 1, Math.ceil((Math.max(from[1], to[1]) + range - this.minY) / CELL));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (segmentDistance(this.cellX(c), this.cellY(r), from[0], from[1], to[0], to[1]) <= range) {
            near[r * this.cols + c] = 1;
          }
        }
      }
    }
    return near;
  }

  /** 칸 j 에서 칸 i 로 가는 이동이 일방통행 선을 거꾸로 넘는지 */
  private crossesOneWayBackward(j: number, i: number): boolean {
    const ax = this.cellX(j % this.cols);
    const ay = this.cellY((j / this.cols) | 0);
    const bx = this.cellX(i % this.cols);
    const by = this.cellY((i / this.cols) | 0);
    for (const { from, to } of this.oneWays) {
      if (!segmentsIntersect(ax, ay, bx, by, from[0], from[1], to[0], to[1])) continue;
      // 통과 방향 = 선 방향을 화면에서 시계 방향으로 90도 돌린 쪽 (y 가 아래로 커지므로 (-dy, dx))
      const nx = -(to[1] - from[1]);
      const ny = to[0] - from[0];
      if ((bx - ax) * nx + (by - ay) * ny < 0) return true;
    }
    return false;
  }

  /** 결승선 아래 칸에서 출발하는 Dijkstra (8방향, 대각선 √2). 가장 먼 거리를 돌려준다 */
  private propagate(goalY: number) {
    const { cols, rows, dist } = this;
    const heap = new MinHeap(cols * rows);
    const goalRow = Math.max(0, Math.min(rows - 1, Math.ceil((goalY - this.minY) / CELL)));
    for (let r = goalRow; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (dist[i] === BLOCKED) continue;
        dist[i] = 0;
        heap.push(i, 0);
      }
    }

    const D = CELL * Math.SQRT2;
    const steps: [number, number, number][] = [
      [-1, 0, CELL],
      [1, 0, CELL],
      [0, -1, CELL],
      [0, 1, CELL],
      [-1, -1, D],
      [1, -1, D],
      [-1, 1, D],
      [1, 1, D],
    ];
    let maxDist = 0;
    while (heap.size > 0) {
      const d = heap.topKey();
      const i = heap.pop();
      if (d > dist[i]) continue;
      maxDist = d;
      const r = (i / cols) | 0;
      const c = i - r * cols;
      for (const [dc, dr, w] of steps) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        const j = nr * cols + nc;
        const cur = dist[j];
        if (cur === BLOCKED) continue;
        // 대각선은 양옆 두 칸이 모두 열려 있어야 지나간다 (벽 모서리를 뚫지 않게)
        if (dc && dr && (dist[r * cols + nc] === BLOCKED || dist[nr * cols + c] === BLOCKED)) continue;
        // 구슬은 j → i 로 움직인다. 일방통행 선을 거꾸로 넘는 이동은 없다
        if (this.nearOneWay && (this.nearOneWay[i] || this.nearOneWay[j]) && this.crossesOneWayBackward(j, i)) continue;
        // i 가 위쪽이면 올라가는 이동
        const up = dr > 0 && !this.lift[i] && !this.lift[j];
        const nd = d + (up ? w * UP_PENALTY : w);
        if (nd < cur) {
          dist[j] = nd;
          heap.push(j, nd);
        }
      }
    }
    return maxDist;
  }

  /**
   * (x, y) 에서 결승까지 남은 거리. 작을수록 앞선다.
   * 주변 3x3 칸에서 "칸의 거리 + 칸 중심까지 직선거리" 의 최솟값이라 칸 안에서도 값이 연속으로 바뀐다
   */
  distanceAt(x: number, y: number): number {
    let extra = 0;
    let qy = y;
    const top = this.minY;
    if (qy < top) {
      extra = top - qy;
      qy = top;
    }
    const col = Math.round((x - this.minX) / CELL);
    const row = Math.round((qy - this.minY) / CELL);
    if (row >= this.rows) return 0;

    let best = Infinity;
    for (let radius = 1; radius <= 3 && best === Infinity; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        const r = row + dr;
        if (r < 0 || r >= this.rows) continue;
        for (let dc = -radius; dc <= radius; dc++) {
          const c = col + dc;
          if (c < 0 || c >= this.cols) continue;
          const d = this.dist[r * this.cols + c];
          if (d < 0 || d === Infinity) continue;
          const cand = d + Math.hypot(x - this.cellX(c), qy - this.cellY(r));
          if (cand < best) best = cand;
        }
      }
    }
    // 이어지지 않은 곳: y 순서는 지키되 이어진 곳보다 뒤
    if (best === Infinity) return UNREACHABLE - y;
    return best + extra;
  }

  /** 진행도 지도 그림 (테스트 플레이에서 순위 계산을 확인할 때). 한 칸 = 한 픽셀, 흰색 = 올라가는 구역 */
  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.cols;
    canvas.height = this.rows;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(this.cols, this.rows);
    for (let i = 0; i < this.dist.length; i++) {
      const d = this.dist[i];
      const o = i * 4;
      if (d === BLOCKED) continue;
      if (d === Infinity) {
        img.data.set([255, 0, 80, 150], o);
        continue;
      }
      // 결승 가까이 = 파랑, 멀수록 빨강. 띠를 그려 등고선처럼 보이게 한다
      const t = this.maxDist > 0 ? d / this.maxDist : 0;
      const band = Math.floor(d / 2) % 2 === 0 ? 1 : 0.75;
      const [r, g, b] = hsl((1 - t) * 240, 0.9, 0.5 * band);
      img.data.set([r, g, b, 110], o);
      if (this.lift[i]) img.data.set([255, 255, 255, 170], o);
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  /** 월드 좌표에 진행도 지도 그림과 일방통행 선(통과 방향 화살표) 을 그린다 */
  drawDebug(ctx: CanvasRenderingContext2D, image: HTMLCanvasElement) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, this.minX - CELL / 2, this.minY - CELL / 2, this.cols * CELL, this.rows * CELL);
    ctx.strokeStyle = '#ff0';
    ctx.fillStyle = '#ff0';
    ctx.lineWidth = 0.1;
    for (const { from, to } of this.oneWays) {
      ctx.beginPath();
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(to[0], to[1]);
      ctx.stroke();
      const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const nx = -(to[1] - from[1]) / len;
      const ny = (to[0] - from[0]) / len;
      const mx = (from[0] + to[0]) / 2;
      const my = (from[1] + to[1]) / 2;
      ctx.beginPath();
      ctx.moveTo(mx + nx * 0.6, my + ny * 0.6);
      ctx.lineTo(mx - ny * 0.25, my + nx * 0.25);
      ctx.lineTo(mx + ny * 0.25, my - nx * 0.25);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

function isBlocking(e: MapEntity): boolean {
  if ((e.props.life ?? -1) > 0) return false;
  if (e.type === 'kinematic' && e.props.angularVelocity !== 0) return false;
  return true;
}

/** 엔티티 모양의 꼭짓점 (원은 외접 사각형) — 경계 상자 계산용 */
function reachPoints(e: MapEntity): [number, number][] {
  const { x, y } = e.position;
  const s = e.shape;
  switch (s.type) {
    case 'polyline':
      return s.points.map(([px, py]) => [x + px, y + py]);
    case 'circle':
      return [
        [x - s.radius, y - s.radius],
        [x + s.radius, y + s.radius],
      ];
    case 'box': {
      const cos = Math.cos(s.rotation);
      const sin = Math.sin(s.rotation);
      return [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([sx, sy]) => {
        const lx = sx * s.width;
        const ly = sy * s.height;
        return [x + lx * cos - ly * sin, y + lx * sin + ly * cos] as [number, number];
      });
    }
  }
}

/** 엔티티 표면까지 거리 함수 (안쪽은 0) */
function shapeDistance(e: MapEntity): (x: number, y: number) => number {
  const { x: ox, y: oy } = e.position;
  const s = e.shape;
  switch (s.type) {
    case 'circle':
      return (x, y) => Math.max(0, Math.hypot(x - ox, y - oy) - s.radius);
    case 'box': {
      // SetAsBox(width, height) 는 반폭/반높이
      const cos = Math.cos(-s.rotation);
      const sin = Math.sin(-s.rotation);
      return (x, y) => {
        const dx = x - ox;
        const dy = y - oy;
        const lx = Math.abs(dx * cos - dy * sin) - s.width;
        const ly = Math.abs(dx * sin + dy * cos) - s.height;
        return Math.hypot(Math.max(lx, 0), Math.max(ly, 0));
      };
    }
    case 'polyline': {
      const pts = s.points.map(([px, py]) => [ox + px, oy + py]);
      return (x, y) => {
        let best = Infinity;
        for (let i = 0; i < pts.length - 1; i++) {
          best = Math.min(best, segmentDistance(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
        }
        return best;
      };
    }
  }
}

/** 두 선분이 만나는지 (끝점이 닿는 경우 포함) */
function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number
): boolean {
  const cross = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = cross(cx, cy, dx, dy, ax, ay);
  const d2 = cross(cx, cy, dx, dy, bx, by);
  const d3 = cross(ax, ay, bx, by, cx, cy);
  const d4 = cross(ax, ay, bx, by, dx, dy);
  return ((d1 <= 0 && d2 >= 0) || (d1 >= 0 && d2 <= 0)) && ((d3 <= 0 && d4 >= 0) || (d3 >= 0 && d4 <= 0));
}

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const vx = bx - ax;
  const vy = by - ay;
  const len = vx * vx + vy * vy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function hsl(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** 칸 번호를 거리 순으로 꺼내는 이진 힙 (중복 push 허용, 꺼낼 때 낡은 값은 버린다) */
class MinHeap {
  private ids: Int32Array;
  private keys: Float32Array;
  size = 0;

  constructor(capacity: number) {
    this.ids = new Int32Array(capacity);
    this.keys = new Float32Array(capacity);
  }

  push(id: number, key: number) {
    if (this.size === this.ids.length) this.grow();
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= key) break;
      this.ids[i] = this.ids[p];
      this.keys[i] = this.keys[p];
      i = p;
    }
    this.ids[i] = id;
    this.keys[i] = key;
  }

  topKey() {
    return this.keys[0];
  }

  pop(): number {
    const top = this.ids[0];
    const lastId = this.ids[--this.size];
    const lastKey = this.keys[this.size];
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      if (l >= this.size) break;
      const r = l + 1;
      const m = r < this.size && this.keys[r] < this.keys[l] ? r : l;
      if (this.keys[m] >= lastKey) break;
      this.ids[i] = this.ids[m];
      this.keys[i] = this.keys[m];
      i = m;
    }
    this.ids[i] = lastId;
    this.keys[i] = lastKey;
    return top;
  }

  private grow() {
    const ids = new Int32Array(this.ids.length * 2);
    const keys = new Float32Array(this.keys.length * 2);
    ids.set(this.ids);
    keys.set(this.keys);
    this.ids = ids;
    this.keys = keys;
  }
}
