import { Skills, STUCK_DELAY } from './data/constants';
import { rad } from './utils/utils';
import options from './options';
import { VectorLike } from './types/VectorLike';
import { Vector } from './utils/Vector';
import { MarbleState } from './types/GameTypes';

export class Marble {
  type = 'marble' as const;
  name: string = '';
  size: number = 0.5;
  color: string = 'red';
  hue: number = 0;
  impact: number = 0;
  weight: number = 1;
  skill: Skills = Skills.None;
  isActive: boolean = false;

  private _skillRate = 0.0005;
  private _coolTime = 5000;
  private _maxCoolTime = 5000;
  private _stuckTime = 0;
  private lastPosition: VectorLike = { x: 0, y: 0 };

  id: number;

  // 마블의 위치 정보
  private _position: { x: number; y: number; angle: number } = { x: 0, y: 0, angle: 0 };

  get position() {
    return this._position;
  }

  set position(pos: { x: number; y: number; angle: number }) {
    this._position = pos;
  }

  get x() {
    return this._position.x;
  }

  set x(v: number) {
    this._position.x = v;
  }

  get y() {
    return this._position.y;
  }

  set y(v: number) {
    this._position.y = v;
  }

  get angle() {
    return this._position.angle;
  }

  // 서버 상태로부터 마블 객체 생성
  static fromState(state: MarbleState): Marble {
    const marble = new Marble(state.id, state.name, state.weight, state.hue);
    marble.position = state.position;
    marble.isActive = state.isActive;
    marble.skill = state.skill;
    marble.color = state.color;
    return marble;
  }

  // 서버 상태를 기반으로 마블 상태 업데이트
  updateFromState(state: MarbleState): void {
    this.position = state.position;
    this.isActive = state.isActive;
    this.skill = state.skill;
  }

  constructor(idOrState: number | MarbleState, name: string = '', weight: number = 1, hue: number = 0) {
    if (typeof idOrState === 'number') {
      // 기본 생성자 방식
      this.id = idOrState;
      this.name = name || `M${idOrState}`;
      this.weight = weight;
      this._maxCoolTime = 1000 + (1 - this.weight) * 4000;
      this._coolTime = this._maxCoolTime * Math.random();
      this._skillRate = 0.2 * this.weight;
      this.hue = hue;
      this.color = `hsl(${this.hue} 100% 70%)`;
    } else {
      // MarbleState로부터 생성
      this.id = idOrState.id;
      this.name = idOrState.name;
      this.weight = idOrState.weight;
      this.hue = idOrState.hue;
      this.color = idOrState.color;
      this._position = idOrState.position;
      this.isActive = idOrState.isActive;
      this.skill = idOrState.skill;
      this._maxCoolTime = 1000 + (1 - this.weight) * 4000;
      this._coolTime = this._maxCoolTime * Math.random();
      this._skillRate = 0.2 * this.weight;
    }
  }

  // 움직임 감지 및 멈춤 판정 업데이트
  update(deltaTime: number) {
    // 이전 위치와 현재 위치 간의 차이로 멈춤 여부 판단
    if (this.isActive && Vector.lenSq(Vector.sub(this.lastPosition, this.position)) < 0.00001) {
      this._stuckTime += deltaTime;
    } else {
      this._stuckTime = 0;
    }

    this.lastPosition = { x: this.position.x, y: this.position.y };

    // 이펙트 시간 감소
    if (this.impact) {
      this.impact = Math.max(0, this.impact - deltaTime);
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    zoom: number,
    outline: boolean,
    isMinimap: boolean = false,
    skin?: CanvasImageSource,
  ) {
    ctx.save();
    if (isMinimap) {
      this._renderMinimap(ctx);
    } else {
      this._renderNormal(ctx, zoom, outline, skin);
    }
    ctx.restore();
  }

  private _renderMinimap(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    this._drawMarbleBody(ctx, true);
  }

  private _drawMarbleBody(ctx: CanvasRenderingContext2D, isMinimap: boolean) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, isMinimap ? this.size : this.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private _renderNormal(ctx: CanvasRenderingContext2D, zoom: number, outline: boolean, skin?: CanvasImageSource) {
    ctx.fillStyle = `hsl(${this.hue} 100% ${70 + 25 * Math.min(1, this.impact / 500)}%`;
    if (this._stuckTime > 0) {
      ctx.fillStyle = `hsl(${this.hue} 100% ${70 + 25 * Math.min(1, this._stuckTime / STUCK_DELAY)}%`;
    }

    ctx.shadowColor = this.color;
    ctx.shadowBlur = zoom / 2;
    if (skin) {
      const hs = this.size / 2;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.drawImage(skin, -hs, -hs, hs * 2, hs * 2);
      ctx.restore();
    } else {
      this._drawMarbleBody(ctx, false);
    }

    ctx.shadowColor = '';
    ctx.shadowBlur = 0;
    this._drawName(ctx, zoom);

    if (outline) {
      this._drawOutline(ctx, 2 / zoom);
    }

    if (options.useSkills) {
      this._renderCooltime(ctx, zoom);
    }
    // this._renderStuck(ctx, zoom); // for debug
  }

  private _drawName(ctx: CanvasRenderingContext2D, zoom: number) {
    ctx.save();
    ctx.translate(this.x, this.y + 0.25);
    ctx.scale(1 / zoom, 1 / zoom);
    ctx.font = `12pt sans-serif`;
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 0;
    ctx.strokeText(this.name, 0, 0);
    ctx.fillText(this.name, 0, 0);
    ctx.restore();
  }

  private _drawOutline(ctx: CanvasRenderingContext2D, lineWidth: number) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = lineWidth;
    ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private _renderCooltime(ctx: CanvasRenderingContext2D, zoom: number) {
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size / 2 + 2 / zoom, rad(270), rad(270 + (360 * this._coolTime) / this._maxCoolTime));
    ctx.stroke();
  }

  private _renderStuck(ctx: CanvasRenderingContext2D, zoom: number) {
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size / 2 + 3 / zoom, rad(270), rad(270 + 360 * (1 - this._stuckTime / STUCK_DELAY)));
    ctx.stroke();
  }
}
