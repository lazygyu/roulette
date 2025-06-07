import { CoordinateManager } from './utils/coordinate-manager';
import { RenderParameters } from './rouletteRenderer';
import { DefaultEntityColor, initialZoom } from './data/constants';
import { UIObject } from './UIObject';
import { bound } from './utils/bound.decorator';
import { Rect } from './types/rect.type';
import { VectorLike } from './types/VectorLike';
import { MapEntityState, MarbleState } from './types/gameTypes'; // Import types from gameTypes

export class Minimap implements UIObject {
  private ctx!: CanvasRenderingContext2D;
  private lastParams: RenderParameters | null = null;
  private coordinateManager: CoordinateManager | null = null;

  private _onViewportChangeHandler: ((pos?: VectorLike) => void) | null = null;
  private boundingBox: Rect;
  private mousePosition: { x: number; y: number } | null = null;

  constructor() {
    this.boundingBox = {
      x: 10,
      y: 10,
      w: 26 * 4,
      h: 0,
    };
  }

  getBoundingBox(): Rect | null {
    return this.boundingBox;
  }

  onViewportChange(callback: (pos?: VectorLike) => void) {
    this._onViewportChangeHandler = callback;
  }

  update(): void {
    // nothing to do
  }

  @bound
  onMouseMove(e?: { x: number; y: number }) {
    if (!e) {
      this.mousePosition = null;
      if (this._onViewportChangeHandler) {
        this._onViewportChangeHandler();
      }
      return;
    }
    if (!this.lastParams) return;
    this.mousePosition = {
      x: e.x,
      y: e.y,
    };
    if (this._onViewportChangeHandler && this.coordinateManager) {
      this._onViewportChangeHandler(
        this.coordinateManager.minimapToWorld(this.mousePosition as VectorLike)
      );
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    params: RenderParameters,
    coordinateManager: CoordinateManager,
    _width: number,
    _height: number
  ) {
    this.coordinateManager = coordinateManager;
    if (!ctx) return;
    const { stage } = params;
    if (!stage) return;
    this.boundingBox.h = stage.goalY * 4;

    this.lastParams = params;

    this.ctx = ctx;
    ctx.save();
    ctx.fillStyle = '#333';
    ctx.translate(10, 10);
    ctx.scale(4, 4);
    ctx.fillRect(0, 0, 26, stage.goalY);

    this.ctx.lineWidth = 3 / (params.camera.zoom + initialZoom);
    this.drawEntities(params.entities);
    this.drawMarbles(params);
    this.drawViewport(params);

    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      this.boundingBox.x,
      this.boundingBox.y,
      this.boundingBox.w,
      this.boundingBox.h,
    );
    ctx.restore();
  }

  private drawViewport(params: RenderParameters) {
    this.ctx.save();
    const { camera, size } = params;
    const zoom = camera.zoom; // initialZoom is already applied in camera's renderScene
    const w = size.x / (zoom * initialZoom * 2);
    const h = size.y / (zoom * initialZoom * 2);
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 1 / zoom;
    this.ctx.strokeRect(camera.x - w, camera.y - h, w * 2, h * 2);
    this.ctx.restore();
  }

  private drawEntities(entities: MapEntityState[]) {
    this.ctx.save();
    entities.forEach((entity) => {
      this.ctx.save();
      this.ctx.fillStyle = DefaultEntityColor[entity.shape.type];
      this.ctx.strokeStyle = DefaultEntityColor[entity.shape.type];
      this.ctx.translate(entity.x, entity.y);
      this.ctx.rotate(entity.angle);

      this.ctx.save();
      const shape = entity.shape;
      switch (shape.type) {
        case 'box':
          const w = shape.width;
          const h = shape.height;
          this.ctx.rotate(shape.rotation);
          this.ctx.fillRect(-w / 2, -h / 2, w, h);
          break;
        case 'circle':
          this.ctx.beginPath();
          this.ctx.arc(0, 0, shape.radius, 0, Math.PI * 2, false);
          this.ctx.stroke();
          break;
        case 'polyline':
          if (shape.points.length > 0) {
            this.ctx.beginPath();
            this.ctx.moveTo(shape.points[0][0], shape.points[0][1]);
            for(let i = 1; i < shape.points.length; i++) {
              this.ctx.lineTo(shape.points[i][0], shape.points[i][1]);
            }
            this.ctx.stroke();
          }
          break;
      }
      this.ctx.restore();
      this.ctx.restore();
    });
    this.ctx.restore();
  }

  private drawMarbles(params: RenderParameters) {
    const { marbles } = params; // marbles is now MarbleState[]
    this.ctx.save();
    marbles.forEach((marbleState: MarbleState) => { // Use MarbleState type
      // Draw marble based on state for minimap
      this.ctx.beginPath();
      // Use a smaller radius for the minimap representation
      const minimapRadius = Math.max(0.5, marbleState.radius * 0.5); // Adjust multiplier as needed
      this.ctx.arc(marbleState.x, marbleState.y, minimapRadius, 0, Math.PI * 2, false);
      this.ctx.fillStyle = marbleState.color;
      this.ctx.fill();
      // Optionally add a border or different style for minimap
      // this.ctx.strokeStyle = 'white';
      // this.ctx.lineWidth = 0.1;
      // this.ctx.stroke();

      // Original call removed:
      // marble.render(this.ctx, 1, false, true);
    });
    this.ctx.restore();
  }
}
