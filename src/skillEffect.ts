import { GameObject } from './gameObject';
import { VectorLike } from './types/VectorLike';

const lifetime = 500;

export class SkillEffect implements GameObject {
  private _size: number = 0;
  position: VectorLike;
  private _elapsed: number = 0;
  isDestroy: boolean = false;

  constructor(x: number, y: number) {
    this.position = { x, y };
  }

  update(deltaTime: number) {
    this._elapsed += deltaTime;
    this._size = (this._elapsed / lifetime) * 10;
    if (this._elapsed > lifetime) {
      this.isDestroy = true;
    }
  }

  render(ctx: CanvasRenderingContext2D, zoom: number) {
    ctx.save();
    const rate = this._elapsed / lifetime;
    ctx.globalAlpha = 1 - rate * rate;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this._size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
