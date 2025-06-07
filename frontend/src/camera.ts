import { MarbleState } from './types/gameTypes'; // Use MarbleState type from gameTypes
import { StageDef } from 'common';
import { initialZoom, zoomThreshold } from './data/constants';
import { VectorLike } from './types/VectorLike';
import { CoordinateTransform } from './utils/coordinateTransform';

export class Camera {
  private _position: VectorLike = { x: 0, y: 0 };
  private _targetPosition: VectorLike = { x: 0, y: 0 };
  private _zoom: number = 1;
  private _targetZoom: number = 1;
  private _locked = false;
  public width: number = 0; // 캔버스 너비
  public height: number = 0; // 캔버스 높이
  private _coordinateTransform: CoordinateTransform;

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
    this._coordinateTransform = new CoordinateTransform(initialZoom, width, height);
  }

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this._coordinateTransform = this._coordinateTransform.updateCanvasSize(width, height);
  }

  renderScene(ctx: CanvasRenderingContext2D, callback: (ctx: CanvasRenderingContext2D) => void) {
    const centerOffset = this._coordinateTransform.getCenterOffset(this._zoom);
    ctx.save();
    ctx.translate(-this.x * this._zoom, -this.y * this._zoom);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(centerOffset.x, centerOffset.y);
    callback(ctx);
    ctx.restore();
  }

  // 월드 좌표를 캔버스 화면 좌표로 변환하는 메서드
  public worldToScreen(worldPos: VectorLike): VectorLike {
    // renderScene 콜백 내부에서 사용되는 좌표는 이미 initialZoom이 적용된 상태의 좌표계입니다.
    // 따라서 worldToScreen은 이 좌표계로 변환해야 합니다.

    // 1. 월드 좌표를 카메라 위치 기준으로 변환
    const xRelativeToCamera = worldPos.x - this._position.x;
    const yRelativeToCamera = worldPos.y - this._position.y;

    // 2. 카메라 줌 적용
    const zoomedX = xRelativeToCamera * this._zoom;
    const zoomedY = yRelativeToCamera * this._zoom;

    // 3. 캔버스 중앙 오프셋 적용 (CoordinateTransform 사용)
    const centerOffset = this._coordinateTransform.getCenterOffset(this._zoom);

    // 최종 화면 좌표 (renderScene 콜백 내부에서 사용되는 좌표)
    const screenX = zoomedX + centerOffset.x;
    const screenY = zoomedY + centerOffset.y;

    return {
      x: screenX,
      y: screenY,
    };
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
