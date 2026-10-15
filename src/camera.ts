import { initialZoom } from './data/constants';
import type { CameraZone, StageDef } from './data/maps';
import type { Marble } from './marble';
import type { VectorLike } from './types/VectorLike';

/** 경쟁 구슬을 같이 잡을 때 화면 가장자리에 남기는 여유 (월드 단위) */
const FRAME_PADDING = 2;
/** 경쟁 구슬을 같이 잡으려고 줌아웃할 수 있는 한계 */
const MIN_FRAME_ZOOM = 0.6;
/**
 * 두 구슬을 다 담는 데 이 배율이 필요할 만큼 멀어지면 대상 구슬만 따라간다.
 * MIN_FRAME_ZOOM 과 이 값 사이에서는 멀어질수록 대상 구슬 쪽으로 서서히 넘어간다
 */
const FRAME_RELEASE_ZOOM = 0.35;
/** 연출이 경쟁 구슬 때문에 걸리거나 풀릴 때 화면의 주인공이 넘어가는 데 걸리는 프레임 수 */
const FOCUS_BLEND_FRAMES = 40;
/** 카메라 구역에 들어가거나 나올 때 화면이 넘어가는 데 걸리는 프레임 수 */
const ZONE_BLEND_FRAMES = 60;
/** 순위가 바뀌어 담을 구슬이 바뀌어도 새 구슬이 이 프레임 수만큼 자리를 지켜야 카메라를 바꾼다 */
const SWITCH_DELAY_FRAMES = 20;
/** 담을 구슬이 바뀔 때 화면이 넘어가는 데 걸리는 프레임 수 */
const SWITCH_BLEND_FRAMES = 36;

type MarblePair = { target: Marble; rival: Marble | undefined };

export class Camera {
  private _position: VectorLike = { x: 0, y: 0 };
  private _targetPosition: VectorLike = { x: 0, y: 0 };
  private _zoom: number = 1;
  private _targetZoom: number = 1;
  private _locked = false;
  private _shouldFollowMarbles = false;
  /** 카메라 구역 화면이 섞이는 정도 (0 ~ 1). 구역을 드나들 때 서서히 바뀐다 */
  private _zoneWeight = 0;
  /** 마지막으로 들어갔던 카메라 구역. 나온 뒤에도 _zoneWeight 가 0 이 될 때까지 쓴다 */
  private _zone: CameraZone | null = null;
  /** 카메라가 담고 있는 대상 구슬과 경쟁 구슬. 순위가 바뀌어도 SWITCH_DELAY_FRAMES 동안은 그대로 둔다 */
  private _shown: MarblePair | null = null;
  /** 순위로는 바뀌었지만 아직 카메라가 따라가지 않은 짝과, 그 짝이 유지된 프레임 수 */
  private _pending: MarblePair | null = null;
  private _pendingFrames = 0;
  /** 담을 구슬이 바뀐 순간의 화면. _switchProgress 가 1 이 될 때까지 여기서 새 화면으로 넘어간다 */
  private _switchFrom: { position: VectorLike; zoom: number } | null = null;
  private _switchProgress = 1;
  /** 화면의 주인공이 경쟁 구슬인 정도 (0 ~ 1) */
  private _focusWeight = 0;

  get zoom() {
    return this._zoom;
  }

  set zoom(v: number) {
    this._targetZoom = v;
  }

  get x() {
    return this._position.x;
  }

  set x(v: number) {
    this._targetPosition.x = v;
  }

  get y() {
    return this._position.y;
  }

  set y(v: number) {
    this._targetPosition.y = v;
  }

  get position() {
    return this._position;
  }

  setPosition(v: VectorLike, force: boolean = false) {
    if (force) {
      return (this._position = { x: v.x, y: v.y });
    }
    return (this._targetPosition = { x: v.x, y: v.y });
  }

  lock(v: boolean) {
    this._locked = v;
  }

  startFollowingMarbles() {
    this._shouldFollowMarbles = true;
  }

  initializePosition(center?: VectorLike, zoom?: number) {
    const x = center?.x ?? 12.95;
    const y = center?.y ?? 2;
    const z = zoom ?? 1;

    this._position = { x, y };
    this._targetPosition = { x, y };
    this._zoom = z;
    this._targetZoom = z;
    this._shouldFollowMarbles = false;
    this._zoneWeight = 0;
    this._zone = null;
    this._focusWeight = 0;
    this._shown = null;
    this._pending = null;
    this._pendingFrames = 0;
    this._switchFrom = null;
    this._switchProgress = 1;
  }

  update({
    marbles,
    stage,
    intensity,
    targetIndex,
    focusOnRival,
    viewSize,
  }: {
    marbles: Marble[];
    stage: StageDef;
    /** 줌인 연출 강도 (0 ~ 1). 0 이면 줌인하지 않는다 */
    intensity: number;
    targetIndex: number;
    /** 연출이 대상 구슬이 아니라 다투는 구슬 때문에 걸렸으면 true. 둘이 한 화면에 안 들어가면 그 구슬을 놓치지 않는다 */
    focusOnRival: boolean;
    /** 줌 1 일 때 화면에 보이는 월드 크기 */
    viewSize: VectorLike;
  }) {
    // set target position
    if (!this._locked) {
      this._calcTargetPositionAndZoom(marbles, stage, intensity, targetIndex, focusOnRival, viewSize);
    }

    // interpolate position
    this._position.x = this._interpolation(this.x, this._targetPosition.x);
    this._position.y = this._interpolation(this.y, this._targetPosition.y);

    // interpolate zoom
    this._zoom = this._interpolation(this._zoom, this._targetZoom);
  }

  private _calcTargetPositionAndZoom(
    marbles: Marble[],
    stage: StageDef,
    intensity: number,
    targetIndex: number,
    focusOnRival: boolean,
    viewSize: VectorLike
  ) {
    if (!this._shouldFollowMarbles) {
      return;
    }

    if (marbles.length > 0) {
      const index = marbles[targetIndex] ? targetIndex : 0;
      // 커트라인을 두고 다투는 구슬(바로 뒤, 없으면 바로 앞) 을 같이 화면에 담는다
      const current: MarblePair = { target: marbles[index], rival: marbles[index + 1] ?? marbles[index - 1] };
      const { target: targetMarble, rival } = this._pickPair(current, marbles);
      // focusOnRival 은 지금 순위의 짝 기준이라 카메라가 아직 옛 짝을 담고 있으면 쓰지 않는다
      const isCurrent = targetMarble === current.target && rival === current.rival;
      const fitZoom = rival
        ? Math.min(
            viewSize.x / 2 / (Math.abs(rival.x - targetMarble.x) / 2 + FRAME_PADDING),
            viewSize.y / 2 / (Math.abs(rival.y - targetMarble.y) / 2 + FRAME_PADDING)
          )
        : 0;
      // 연출이 경쟁 구슬 때문에 걸리면 화면의 주인공을 경쟁 구슬로 서서히 바꾼다.
      // 둘이 가까우면 어느 쪽이 주인공이든 화면이 거의 같고, 멀면 FOCUS_BLEND_FRAMES 에 걸쳐 넘어간다
      const focusStep = 1 / FOCUS_BLEND_FRAMES;
      this._focusWeight =
        focusOnRival && isCurrent && rival
          ? Math.min(1, this._focusWeight + focusStep)
          : Math.max(0, this._focusWeight - focusStep);
      let { position, zoom } = this._frameView(targetMarble, rival, fitZoom, intensity, viewSize);
      if (rival && this._focusWeight > 0) {
        const w = smoothstep(this._focusWeight);
        const view = this._frameView(rival, targetMarble, fitZoom, intensity, viewSize);
        position = {
          x: position.x + (view.position.x - position.x) * w,
          y: position.y + (view.position.y - position.y) * w,
        };
        zoom = zoom + (view.zoom - zoom) * w;
      }

      // 카메라 구역: 구역 전체를 보여 준다. 줌인 연출과 겹치면 연출 강도만큼 구슬 쪽 화면으로 넘어간다.
      // 드나들 때는 ZONE_BLEND_FRAMES 에 걸쳐 서서히 넘어간다
      const zone = stage.cameraZones?.find(
        (z) => Math.abs(targetMarble.x - z.x) <= z.w / 2 && Math.abs(targetMarble.y - z.y) <= z.h / 2
      );
      if (zone) this._zone = zone;
      const step = 1 / ZONE_BLEND_FRAMES;
      this._zoneWeight = zone ? Math.min(1, this._zoneWeight + step) : Math.max(0, this._zoneWeight - step);
      if (this._zone && this._zoneWeight > 0) {
        const z = this._zone;
        const zoneZoom = Math.min(viewSize.x / z.w, viewSize.y / z.h);
        const t = smoothstep(this._zoneWeight) * (1 - intensity);
        position = { x: position.x + (z.x - position.x) * t, y: position.y + (z.y - position.y) * t };
        zoom = zoom + (zoneZoom - zoom) * t;
      } else {
        this._zone = null;
      }

      // 담을 구슬이 바뀐 직후면 그 순간의 화면에서 서서히 넘어간다
      if (this._switchFrom && this._switchProgress < 1) {
        this._switchProgress = Math.min(1, this._switchProgress + 1 / SWITCH_BLEND_FRAMES);
        const from = this._switchFrom;
        const w = smoothstep(this._switchProgress);
        position = {
          x: from.position.x + (position.x - from.position.x) * w,
          y: from.position.y + (position.y - from.position.y) * w,
        };
        zoom = from.zoom + (zoom - from.zoom) * w;
      }

      this.setPosition(position);
      this.zoom = zoom;
    } else {
      this.zoom = 1;
    }
  }

  /**
   * 카메라가 담을 짝을 정한다. 순위로 정해진 짝(current) 이 SWITCH_DELAY_FRAMES 동안 유지돼야 바꾼다.
   * 잠깐 뒤집혔다 돌아오는 순위에는 반응하지 않는다. 담던 구슬이 골인해서 빠졌으면 바로 바꾼다
   */
  private _pickPair(current: MarblePair, marbles: Marble[]): MarblePair {
    const shown = this._shown;
    if (shown && shown.target === current.target && shown.rival === current.rival) {
      this._pending = null;
      return shown;
    }
    if (this._pending && this._pending.target === current.target && this._pending.rival === current.rival) {
      this._pendingFrames++;
    } else {
      this._pending = current;
      this._pendingFrames = 1;
    }
    const gone =
      !shown || !marbles.includes(shown.target) || (shown.rival !== undefined && !marbles.includes(shown.rival));
    if (gone || this._pendingFrames >= SWITCH_DELAY_FRAMES) {
      if (shown) {
        this._switchFrom = { position: { ...this._targetPosition }, zoom: this._targetZoom };
        this._switchProgress = 0;
      }
      this._shown = current;
      this._pending = null;
      return current;
    }
    return shown;
  }

  /**
   * subject 를 주인공으로 other 와 함께 담는 화면.
   * 두 구슬을 같이 담는 정도는 줌아웃 한계를 넘어 멀어질수록 줄어 subject 만 따라가는 쪽으로 넘어간다
   */
  private _frameView(
    subject: Marble,
    other: Marble | undefined,
    fitZoom: number,
    intensity: number,
    viewSize: VectorLike
  ): { position: VectorLike; zoom: number } {
    let position: VectorLike = subject.position;
    let zoom = 1;
    if (other) {
      const frame = smoothstep((fitZoom - FRAME_RELEASE_ZOOM) / (MIN_FRAME_ZOOM - FRAME_RELEASE_ZOOM));
      position = {
        x: subject.x + ((other.x - subject.x) / 2) * frame,
        y: subject.y + ((other.y - subject.y) / 2) * frame,
      };
      zoom = 1 + (Math.max(MIN_FRAME_ZOOM, Math.min(1, fitZoom)) - 1) * frame;
    }
    // 연출이 없으면 둘이 들어오게 줌아웃만 하고, 연출이 세지면 둘이 다 안 들어오더라도 줌인한다
    zoom = Math.max(zoom, intensity * 4);

    // 줌인하느라 둘이 한 화면에 안 들어가면 subject 가 화면 안에 남도록 그쪽으로 당긴다.
    // 연출 강도 0.25 까지 서서히 당겨 연출이 시작될 때 화면이 튀지 않게 한다
    if (intensity > 0) {
      const hx = Math.max(0, viewSize.x / 2 / zoom - FRAME_PADDING);
      const hy = Math.max(0, viewSize.y / 2 / zoom - FRAME_PADDING);
      const cx = Math.min(subject.x + hx, Math.max(subject.x - hx, position.x));
      const cy = Math.min(subject.y + hy, Math.max(subject.y - hy, position.y));
      const pull = Math.min(1, intensity * 4);
      position = { x: position.x + (cx - position.x) * pull, y: position.y + (cy - position.y) * pull };
    }
    return { position, zoom };
  }

  private _interpolation(current: number, target: number, delta: number = 10) {
    const d = target - current;
    if (Math.abs(d) < 1 / initialZoom) {
      return target;
    }

    return current + d / delta;
  }

  renderScene(ctx: CanvasRenderingContext2D, callback: (ctx: CanvasRenderingContext2D) => void) {
    const zoomFactor = initialZoom * 2 * this._zoom;
    ctx.save();
    ctx.translate(-this.x * this._zoom, -this.y * this._zoom);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(ctx.canvas.width / zoomFactor, ctx.canvas.height / zoomFactor);
    callback(ctx);
    ctx.restore();
  }
}

/** 0 ~ 1 로 자른 뒤 시작과 끝이 완만한 곡선으로 바꾼다 */
function smoothstep(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
