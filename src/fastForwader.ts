import type { RenderParameters } from './rouletteRenderer';
import type { Rect } from './types/rect.type';
import type { MouseEventArgs, UIObject } from './UIObject';

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

  update(_deltaTime: number): void {}

  render(ctx: CanvasRenderingContext2D, _params: RenderParameters, width: number, height: number): void {
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

  // 캔버스 어디를 눌러도 2배속이 된다 (영역 밖에서 누르면 mouseHandler 가 undefined 를 넘기지만 그때도 켠다).
  // 누른 채로 미니맵 위로 움직이며 화면을 옮길 수 있도록 일부러 가운데 영역으로 제한하지 않는다
  onMouseDown?(_e?: MouseEventArgs): void {
    this.isEnabled = true;
  }

  onMouseUp?(_e?: MouseEventArgs): void {
    this.isEnabled = false;
  }
}
