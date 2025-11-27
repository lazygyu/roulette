export function transformGuard(ctx: CanvasRenderingContext2D, func: (ctx: CanvasRenderingContext2D) => void): void {
  const originalTransform = ctx.getTransform();
  func(ctx);
  ctx.setTransform(originalTransform);
}
