import { MarbleState } from './types/gameTypes'; // Use MarbleState type from gameTypes
import { StageDef } from 'common';
import { initialZoom, zoomThreshold } from './data/constants';
import { VectorLike } from './types/VectorLike';

export class Camera {
  private _position: VectorLike = { x: 0, y: 0 };
  private _targetPosition: VectorLike = { x: 0, y: 0 };
  private _zoom: number = 1;
  private _targetZoom: number = 1;
  private _locked = false;
  public width: number = 0; // 캔버스 너비
  public height: number = 0; // 캔버스 높이

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

  update({
    marbles,
    stage,
    needToZoom,
    targetIndex,
  }: {
    marbles: MarbleState[]; // Changed type to MarbleState[]
    stage: StageDef;
    needToZoom: boolean; // This logic might be removed or changed in roulette.ts
    targetIndex: number;
  }) {
    // set target position
    if (!this._locked) {
      this._calcTargetPositionAndZoom(marbles, stage, needToZoom, targetIndex);
    }

    // interpolate position
    this._position.x = this._interpolation(this.x, this._targetPosition.x);
    this._position.y = this._interpolation(this.y, this._targetPosition.y);

    // interpolate zoom
    this._zoom = this._interpolation(this._zoom, this._targetZoom);
  }

  private _calcTargetPositionAndZoom(
    marbles: MarbleState[], // Changed type to MarbleState[]
    stage: StageDef,
    needToZoom: boolean, // This logic might be removed or changed in roulette.ts
    targetIndex: number,
  ) {
    if (marbles.length > 0) {
      const targetMarble = marbles[targetIndex] ? marbles[targetIndex] : marbles[0];
      // Access x, y directly from MarbleState
      this.setPosition({ x: targetMarble.x, y: targetMarble.y });
      if (needToZoom) {
        const goalDist = Math.abs(stage.zoomY - this._position.y); // _position is internal camera state
        this.zoom = Math.max(1, (1 - goalDist / zoomThreshold) * 4);
      } else {
        this.zoom = 1;
      }
    } else {
      this.setPosition({ x: 0, y: 0 });
      this.zoom = 1;
    }
  }

  private _interpolation(current: number, target: number) {
    const d = target - current;
    if (Math.abs(d) < 1 / initialZoom) {
      return target;
    }

    return current + d / 10;
  }

  constructor(width: number = 0, height: number = 0) {
    this.width = width;
    this.height = height;
  }

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  renderScene(ctx: CanvasRenderingContext2D, callback: (ctx: CanvasRenderingContext2D) => void) {
    const centerOffsetDivisor = 2;
    const zoomFactor = initialZoom * centerOffsetDivisor * this._zoom;
    const centerOffsetX = this.width / zoomFactor;
    const centerOffsetY = this.height / zoomFactor;

    ctx.save();
    ctx.translate(-this.x * this._zoom, -this.y * this._zoom);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(centerOffsetX, centerOffsetY);
    callback(ctx);
    ctx.restore();
  }

  // 월드 좌표계 변환을 위한 유틸리티 메서드들
  public getWorldBounds(): { left: number; right: number; top: number; bottom: number } {
    const halfWidth = this.width / (2 * this._zoom);
    const halfHeight = this.height / (2 * this._zoom);

    return {
      left: this._position.x - halfWidth,
      right: this._position.x + halfWidth,
      top: this._position.y - halfHeight,
      bottom: this._position.y + halfHeight,
    };
  }

  public getViewportInfo() {
    return {
      position: { ...this._position },
      zoom: this._zoom,
      size: { width: this.width, height: this.height },
      worldBounds: this.getWorldBounds(),
    };
  }
}
