import { RenderParameters } from './rouletteRenderer';
import { Rect } from './types/rect.type';

export type MouseEventArgs = { x: number; y: number; button: number };

export interface UIObject {
  update(deltaTime: number): void;

  render(
    ctx: CanvasRenderingContext2D,
    params: RenderParameters,
    width: number,
    height: number,
  ): void;

  getBoundingBox(): Rect | null;

  onWheel?(e: WheelEvent): void;

  onMouseMove?(e?: MouseEventArgs): void;

  onMouseDown?(e?: MouseEventArgs): void;

  onMouseUp?(e?: MouseEventArgs): void;

  onDblClick?(e?: MouseEventArgs): void;

  onMessage?(func: (msg: string) => void): void;
}
