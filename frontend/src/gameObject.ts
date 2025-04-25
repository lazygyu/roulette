export interface GameObject {
  isDestroy: boolean;
  update(deltaTime: number): void;
  render(ctx: CanvasRenderingContext2D, zoom: number): void;
}
