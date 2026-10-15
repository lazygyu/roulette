import { initialZoom } from './data/constants';
import type { CameraZone, StageDef } from './data/maps';
import type { Marble } from './marble';
import type { VectorLike } from './types/VectorLike';

/** 경쟁 구슬을 같이 잡을 때 화면 가장자리에 남기는 여유 (월드 단위) */
const FRAME_PADDING = 2;
/** 경쟁 구슬을 같이 잡으려고 줌아웃할 수 있는 한계. 이보다 멀리 떨어지면 대상 구슬만 따라간다 */
const MIN_FRAME_ZOOM = 0.6;
/** 카메라 구역에 들어가거나 나올 때 화면이 넘어가는 데 걸리는 프레임 수 */
const ZONE_BLEND_FRAMES = 60;

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
    this._position.x = this._interpolation(this.x, this._targetPosition.x, 120);
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
      const targetMarble = marbles[index];

      // 커트라인을 두고 다투는 구슬(바로 뒤, 없으면 바로 앞) 을 같이 화면에 담는다
      const rival = marbles[index + 1] ?? marbles[index - 1];
      const fitZoom = rival
        ? Math.min(
            viewSize.x / 2 / (Math.abs(rival.x - targetMarble.x) / 2 + FRAME_PADDING),
            viewSize.y / 2 / (Math.abs(rival.y - targetMarble.y) / 2 + FRAME_PADDING)
          )
        : 0;
      const framed = rival !== undefined && fitZoom >= MIN_FRAME_ZOOM;
      let position: VectorLike = framed
        ? { x: (targetMarble.x + rival.x) / 2, y: (targetMarble.y + rival.y) / 2 }
        : targetMarble.position;
      // 연출이 없으면 둘이 들어오게 줌아웃만 하고, 연출이 세지면 둘이 다 안 들어오더라도 줌인한다
      let zoom = Math.max(framed ? Math.min(1, fitZoom) : 1, intensity * 4);

      // 줌인하느라 둘이 한 화면에 안 들어가면 연출이 걸린 구슬이 화면 안에 남도록 그쪽으로 당긴다.
      // 연출 강도 0.25 까지 서서히 당겨 연출이 시작될 때 화면이 튀지 않게 한다
      const focus = focusOnRival && rival ? rival : targetMarble;
      if (intensity > 0) {
        const hx = Math.max(0, viewSize.x / 2 / zoom - FRAME_PADDING);
        const hy = Math.max(0, viewSize.y / 2 / zoom - FRAME_PADDING);
        const cx = Math.min(focus.x + hx, Math.max(focus.x - hx, position.x));
        const cy = Math.min(focus.y + hy, Math.max(focus.y - hy, position.y));
        const pull = Math.min(1, intensity * 4);
        position = { x: position.x + (cx - position.x) * pull, y: position.y + (cy - position.y) * pull };
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
        const w = this._zoneWeight;
        const t = w * w * (3 - 2 * w) * (1 - intensity);
        position = { x: position.x + (z.x - position.x) * t, y: position.y + (z.y - position.y) * t };
        zoom = zoom + (zoneZoom - zoom) * t;
      } else {
        this._zone = null;
      }

      this.setPosition(position);
      this.zoom = zoom;
    } else {
      this.zoom = 1;
    }
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
