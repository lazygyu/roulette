import { RenderParameters } from './rouletteRenderer';
import { Rect } from './types/rect.type';
import { MouseEventArgs, UIObject } from './UIObject';

export class FastForwader implements UIObject {
  private bound: Rect = {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  };
  private icon: HTMLImageElement;

  constructor() {
    this.icon = new Image();
    this.icon.src = new URL('../assets/images/ff.svg', import.meta.url).toString();

  }

  private isEnabled: boolean = false;

  public get speed(): number {
    return this.isEnabled ? 2 : 1;
  }

  update(deltaTime: number): void {
  }

  render(ctx: CanvasRenderingContext2D, params: RenderParameters, width: number, height: number): void {
    this.bound.w = width / 2;
    this.bound.h = height / 2;
    this.bound.x = this.bound.w / 2;
    this.bound.y = this.bound.h / 2;

    const centerX = this.bound.x + this.bound.w / 2;
    const centerY = this.bound.y + this.bound.h / 2;

    if (this.isEnabled) {
      ctx.save();
      ctx.strokeStyle = 'white';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(this.icon, centerX - 100, centerY - 100, 200, 200);
      ctx.restore();
    }

  }

  getBoundingBox(): Rect | null {
    return this.bound;
  }

  onMouseDown?(e?: MouseEventArgs): void {
    this.isEnabled = true;
  }

  onMouseUp?(e?: MouseEventArgs): void {
    this.isEnabled = false;
  }
}
