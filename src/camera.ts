import { initialZoom, zoomThreshold } from './data/constants';
import type { StageDef } from './data/maps';
import type { Marble } from './marble';
import type { VectorLike } from './types/VectorLike';

/** 경쟁 구슬을 같이 잡을 때 화면 가장자리에 남기는 여유 (월드 단위) */
const FRAME_PADDING = 2;
/** 경쟁 구슬을 같이 잡으려고 줌아웃할 수 있는 한계. 이보다 멀리 떨어지면 대상 구슬만 따라간다 */
const MIN_FRAME_ZOOM = 0.6;

export class Camera {
  private _position: VectorLike = { x: 0, y: 0 };
  private _targetPosition: VectorLike = { x: 0, y: 0 };
  private _zoom: number = 1;
  private _targetZoom: number = 1;
  private _locked = false;
  private _shouldFollowMarbles = false;

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
  }

  update({
    marbles,
    stage,
    needToZoom,
    zoomIntensity = null,
    targetIndex,
    viewSize,
  }: {
    marbles: Marble[];
    stage: StageDef;
    needToZoom: boolean;
    /** 연출 구역이 있는 맵의 연출 강도 (0 ~ 1). null 이면 zoomY 와의 거리로 줌을 정한다 */
    zoomIntensity?: number | null;
    targetIndex: number;
    /** 줌 1 일 때 화면에 보이는 월드 크기 */
    viewSize: VectorLike;
  }) {
    // set target position
    if (!this._locked) {
      this._calcTargetPositionAndZoom(marbles, stage, needToZoom, targetIndex, zoomIntensity, viewSize);
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
    needToZoom: boolean,
    targetIndex: number,
    zoomIntensity: number | null,
    viewSize: VectorLike
  ) {
    if (!this._shouldFollowMarbles) {
      return;
    }

    if (marbles.length > 0) {
      const index = marbles[targetIndex] ? targetIndex : 0;
      const targetMarble = marbles[index];
      let zoom: number;
      if (needToZoom && zoomIntensity !== null) {
        zoom = Math.max(1, zoomIntensity * 4);
      } else if (needToZoom) {
        const goalDist = Math.abs(stage.zoomY - this._position.y);
        zoom = Math.max(1, (1 - goalDist / zoomThreshold) * 4);
      } else {
        zoom = 1;
      }

      // 커트라인을 두고 다투는 구슬(바로 뒤, 없으면 바로 앞) 을 같이 화면에 담는다
      const rival = marbles[index + 1] ?? marbles[index - 1];
      const fitZoom = rival
        ? Math.min(
            viewSize.x / 2 / (Math.abs(rival.x - targetMarble.x) / 2 + FRAME_PADDING),
            viewSize.y / 2 / (Math.abs(rival.y - targetMarble.y) / 2 + FRAME_PADDING)
          )
        : 0;
      if (rival && fitZoom >= MIN_FRAME_ZOOM) {
        this.setPosition({ x: (targetMarble.x + rival.x) / 2, y: (targetMarble.y + rival.y) / 2 });
        this.zoom = Math.min(zoom, fitZoom);
      } else {
        this.setPosition(targetMarble.position);
        this.zoom = zoom;
      }
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
