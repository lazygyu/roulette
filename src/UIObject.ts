import { RenderParameters } from './rouletteRenderer';

export interface UIObject {
    update(deltaTime: number): void;
    render(ctx: CanvasRenderingContext2D, params: RenderParameters, width: number, height: number): void;

    onWheel?(e: WheelEvent): void;
}