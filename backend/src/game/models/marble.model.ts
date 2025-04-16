import { Skills } from '../types/marble.type';
import { IPhysics } from '../interfaces/physics.interface';

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
  private lastPosition: { x: number; y: number } = { x: 0, y: 0 };

  private physics: IPhysics;
  private STUCK_DELAY = 3000;  // 3초 동안 움직임이 없으면 멈춘 것으로 판단

  id: number;

  get position() {
    return this.physics.getMarblePosition(this.id);
  }

  get x() {
    return this.position.x;
  }

  get y() {
    return this.position.y;
  }

  get angle() {
    return this.position.angle;
  }

  constructor(
    physics: IPhysics,
    order: number,
    max: number,
    name?: string,
    weight: number = 1,
  ) {
    this.name = name || `M${order}`;
    this.weight = weight;
    this.physics = physics;

    this._maxCoolTime = 1000 + (1 - this.weight) * 4000;
    this._coolTime = this._maxCoolTime * Math.random();
    this._skillRate = 0.2 * this.weight;

    const maxLine = Math.ceil(max / 10);
    const line = Math.floor(order / 10);
    const lineDelta = -Math.max(0, Math.ceil(maxLine - 5));
    this.hue = (360 / max) * order;
    this.color = `hsl(${this.hue} 100% 70%)`;
    this.id = order;

    physics.createMarble(
      order,
      10.25 + (order % 10) * 0.6,
      maxLine - line + lineDelta,
    );
  }

  update(deltaTime: number) {
    if (
      this.isActive &&
      this.distanceSq(this.lastPosition, this.position) < 0.00001
    ) {
      this._stuckTime += deltaTime;

      if (this._stuckTime > this.STUCK_DELAY) {
        this.physics.shakeMarble(this.id);
        this._stuckTime = 0;
      }
    } else {
      this._stuckTime = 0;
    }
    this.lastPosition = { x: this.position.x, y: this.position.y };

    this.skill = Skills.None;
    if (this.impact) {
      this.impact = Math.max(0, this.impact - deltaTime);
    }
    if (!this.isActive) return;
    
    // 스킬 사용 업데이트
    this._updateSkillInformation(deltaTime);
  }

  private _updateSkillInformation(deltaTime: number) {
    if (this._coolTime > 0) {
      this._coolTime -= deltaTime;
    }

    if (this._coolTime <= 0) {
      this.skill =
        Math.random() < this._skillRate ? Skills.Impact : Skills.None;
      this._coolTime = this._maxCoolTime;
    }
  }

  private distanceSq(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return dx * dx + dy * dy;
  }

  // 직렬화를 위한 상태 객체 반환
  getState() {
    return {
      id: this.id,
      name: this.name,
      position: this.position,
      color: this.color,
      hue: this.hue,
      isActive: this.isActive,
      skill: this.skill,
      weight: this.weight,
    };
  }
} 