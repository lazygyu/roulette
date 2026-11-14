import type { RenderResolution } from './rouletteRenderer';

export type WinnerRange = { start: number; end: number };

const RESOLUTION_STORAGE_KEY = 'roulette.resolution';
const RESOLUTIONS: readonly string[] = ['default', 'high', 'ultra'] satisfies RenderResolution[];

export function isRenderResolution(value: unknown): value is RenderResolution {
  return typeof value === 'string' && RESOLUTIONS.includes(value);
}

function loadResolution(): RenderResolution {
  try {
    const saved = localStorage.getItem(RESOLUTION_STORAGE_KEY);
    if (isRenderResolution(saved)) return saved;
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등)은 기본값
  }
  return 'default';
}

export function saveResolution(value: RenderResolution) {
  try {
    localStorage.setItem(RESOLUTION_STORAGE_KEY, value);
  } catch {
    // 저장에 실패하면 이번 방문에만 적용된다
  }
}

class Options {
  useSkills: boolean = true;
  /** 0-based, 양끝 포함. 1명 추첨은 start === end */
  winnerRange: WinnerRange = { start: 0, end: 0 };
  autoRecording: boolean = true;
  /** 렌더링 해상도. 물리 시뮬레이션과는 무관하다 */
  resolution: RenderResolution = loadResolution();
}

const options = new Options();
export default options;
