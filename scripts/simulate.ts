/**
 * 렌더링 없이 물리만 돌려보는 시뮬레이션. 게임 루프와 같은 10ms 고정 스텝, Marble 과 같은 배치·정지 판정·shake 를 쓴다.
 *
 *   yarn simulate bench [6,16,30,100,300,1000]   맵별·구슬 수별 골인 시각 분포 (timeScale 1)
 *   yarn simulate stuck [6,16,30]                정지 판정 문턱 기존 vs 수정, timeScale 1 과 0.2 에서 shake 비교
 *
 * Math.random 을 시드 고정으로 바꿔서 같은 조건이면 같은 궤적이 나온다.
 */
import * as fs from 'node:fs';
import Box2DFactory from 'box2d-wasm';
import { STUCK_DELAY } from '../src/data/constants';
import { stages } from '../src/data/maps';
import { Box2dPhysics } from '../src/physics-box2d';

const STEP_MS = 10;
const MAX_SIM_SEC = 900;
/** Marble.update 의 정지 판정 문턱. 10ms 에 √1e-5 ≈ 0.00316 이동, 속도로는 약 0.32/s */
const STUCK_LEN_SQ = 0.00001;
const STUCK_SPEED = Math.sqrt(STUCK_LEN_SQ) / (STEP_MS / 1000);

function seedRandom(seed: number) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Node 의 emscripten 로더가 fetch 로 wasm 경로를 열려다 실패하므로 바이너리를 직접 넘긴다
class NodePhysics extends Box2dPhysics {
  async init(): Promise<void> {
    const wasmBinary = fs.readFileSync(new URL('../node_modules/box2d-wasm/dist/umd/Box2D.simd.wasm', import.meta.url));
    const self = this as any;
    self.Box2D = await Box2DFactory({ wasmBinary } as any);
    self.gravity = new self.Box2D.b2Vec2(0, 10);
    self.world = new self.Box2D.b2World(self.gravity);
  }
}

type Options = {
  mapIdx: number;
  n: number;
  timeScale: number;
  /** 정지 판정에 쓸 lenSq 문턱. 기존 코드는 timeScale 과 무관하게 STUCK_LEN_SQ 고정 */
  stuckLenSq: number;
  seed: number;
};

type Result = {
  title: string;
  goals: number[];
  unfinished: number;
  outOfBounds: number;
  shakes: number;
  /** shake 가 발동한 순간 구슬이 STUCK_SPEED 이상으로 움직이고 있던 횟수 = 멈춘 게 아닌데 튕긴 것 */
  shakesWhileMoving: number;
};

async function simulate({ mapIdx, n, timeScale, stuckLenSq, seed }: Options): Promise<Result> {
  seedRandom(seed);
  const stage = stages[mapIdx];
  const p = new NodePhysics();
  await p.init();
  p.createStage(stage);

  // Marble 생성자와 같은 배치
  const maxLine = Math.ceil(n / 10);
  const lineDelta = -Math.max(0, Math.ceil(maxLine - 5));
  for (let order = 0; order < n; order++) {
    const line = Math.floor(order / 10);
    p.createMarble(order, 10.25 + (order % 10) * 0.6, maxLine - line + lineDelta);
  }
  p.start();

  const alive = new Set<number>([...Array(n).keys()]);
  const last = new Map<number, { x: number; y: number }>();
  const stuckMs = new Map<number, number>();
  const pending: { id: number; at: number }[] = [];
  const r: Result = { title: stage.title, goals: [], unfinished: 0, outOfBounds: 0, shakes: 0, shakesWhileMoving: 0 };
  const stepSec = (STEP_MS / 1000) * timeScale;
  let t = 0;
  while (alive.size > 0 && t < MAX_SIM_SEC) {
    p.step(stepSec);
    t += stepSec;
    while (pending.length && pending[0].at <= t) p.removeMarble(pending.shift()!.id);
    for (const id of alive) {
      const pos = p.getMarblePosition(id);
      const prev = last.get(id);
      if (prev) {
        const lenSq = (pos.x - prev.x) ** 2 + (pos.y - prev.y) ** 2;
        // Marble.update 와 같은 정지 판정. 누적은 벽시계(틱당 10ms)
        if (lenSq < stuckLenSq) {
          const acc = (stuckMs.get(id) ?? 0) + STEP_MS;
          if (acc > STUCK_DELAY) {
            p.shakeMarble(id);
            r.shakes++;
            if (Math.sqrt(lenSq) / stepSec >= STUCK_SPEED) r.shakesWhileMoving++;
            stuckMs.set(id, 0);
          } else stuckMs.set(id, acc);
        } else stuckMs.set(id, 0);
      }
      last.set(id, { x: pos.x, y: pos.y });
      if (pos.x < -5 || pos.x > 40) r.outOfBounds++;
      if (pos.y > stage.goalY) {
        r.goals.push(t);
        alive.delete(id);
        pending.push({ id, at: t + 0.5 });
      }
    }
  }
  r.unfinished = alive.size;
  return r;
}

function maxInWindow(ts: number[], win: number) {
  let best = 0;
  for (let i = 0; i < ts.length; i++) {
    let j = i;
    while (j < ts.length && ts[j] - ts[i] <= win) j++;
    best = Math.max(best, j - i);
  }
  return best;
}

async function bench(ns: number[]) {
  console.log('| 맵 | 구슬 | 첫 골인 | 마지막 골인 | 1초 내 최다 | 5초 내 최다 | 골인 간격 중앙값 | shake | 미완주 |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (let m = 0; m < stages.length; m++) {
    for (const n of ns) {
      const r = await simulate({ mapIdx: m, n, timeScale: 1, stuckLenSq: STUCK_LEN_SQ, seed: 1 });
      const ts = r.goals;
      const gaps = ts.slice(1).map((v, i) => v - ts[i]).sort((a, b) => a - b);
      const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
      console.log(
        `| ${r.title} | ${n} | ${ts[0]?.toFixed(1)}s | ${ts.at(-1)?.toFixed(1)}s | ${maxInWindow(ts, 1)} | ${maxInWindow(ts, 5)} | ${median.toFixed(2)}s | ${r.shakes} | ${r.unfinished}${r.outOfBounds ? ` (이탈 ${r.outOfBounds})` : ''} |`
      );
    }
  }
}

// 같은 시드·같은 배치에서 정지 판정 문턱만 바꿔 돌린다.
// timeScale 1 에서는 두 문턱이 같은 값이므로 결과가 완전히 같아야 하고(기존 물리 불변),
// timeScale 0.2 에서는 기존 문턱이 움직이는 구슬을 튕기는 횟수가 드러나야 한다
async function stuck(ns: number[]) {
  console.log(`STUCK_DELAY=${STUCK_DELAY}ms, 정지 속도 기준 ${STUCK_SPEED.toFixed(3)}/s`);
  console.log('| 맵 | 구슬 | timeScale | shake 기존 → 수정 | 움직이는 중 튕김 기존 → 수정 | 마지막 골인 기존 → 수정 | 미완주 기존 → 수정 |');
  console.log('|---|---:|---:|---|---|---|---|');
  for (let m = 0; m < stages.length; m++) {
    for (const n of ns) {
      for (const timeScale of [1, 0.2]) {
        const base = { mapIdx: m, n, timeScale, seed: 1 };
        const old = await simulate({ ...base, stuckLenSq: STUCK_LEN_SQ });
        const fixed = await simulate({ ...base, stuckLenSq: STUCK_LEN_SQ * timeScale * timeScale });
        console.log(
          `| ${old.title} | ${n} | ${timeScale} | ${old.shakes} → ${fixed.shakes} | ${old.shakesWhileMoving} → ${fixed.shakesWhileMoving} | ${old.goals.at(-1)?.toFixed(1)}s → ${fixed.goals.at(-1)?.toFixed(1)}s | ${old.unfinished} → ${fixed.unfinished} |`
        );
      }
    }
  }
}

const [mode = 'bench', arg] = process.argv.slice(2);
if (mode === 'bench') bench((arg ?? '6,16,30,100,300,1000').split(',').map(Number));
else if (mode === 'stuck') stuck((arg ?? '6,16,30').split(',').map(Number));
else console.error('usage: simulate.ts bench [counts] | stuck [counts]');
