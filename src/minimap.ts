import { RenderParameters } from './rouletteRenderer';
import { DefaultEntityColor, initialZoom } from './data/constants';
import { UIObject } from './UIObject';
import { bound } from './utils/bound.decorator';
import { Rect } from './types/rect.type';
import { VectorLike } from './types/VectorLike';
import { MapEntityState } from './types/MapEntity.type';

export class Minimap implements UIObject {
  private ctx!: CanvasRenderingContext2D;
  private lastParams: RenderParameters | null = null;

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
    if (this._onViewportChangeHandler) {
      this._onViewportChangeHandler({
        x: this.mousePosition.x / 4,
        y: this.mousePosition.y / 4,
      });
    }
  }

  render(ctx: CanvasRenderingContext2D, params: RenderParameters) {
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
    this.drawWalls(params);
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
    const zoom = camera.zoom * initialZoom;
    const w = size.x / zoom;
    const h = size.y / zoom;
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 1 / zoom;
    this.ctx.strokeRect(camera.x - w / 2, camera.y - h / 2, w, h);
    this.ctx.restore();
  }

  private drawWalls(params: RenderParameters) {
    if (!params.stage) return;
    this.ctx.save();
    this.ctx.strokeStyle = 'black';
    this.ctx.lineWidth = 0.5;
    this.ctx.beginPath();
    params.stage.walls.forEach((wallDef) => {
      this.ctx.moveTo(wallDef[0][0], wallDef[0][1]);
      for (let i = 1; i < wallDef.length; i++) {
        this.ctx.lineTo(wallDef[i][0], wallDef[i][1]);
      }
    });
    this.ctx.stroke();
    this.ctx.closePath();
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
          const w = shape.width * 2;
          const h = shape.height * 2;
          this.ctx.rotate(shape.rotation);
          this.ctx.fillRect(-w / 2, -h / 2, w, h);
          break;
        case 'circle':
          this.ctx.beginPath();
          this.ctx.arc(0, 0, shape.radius, 0, Math.PI * 2, false);
          this.ctx.stroke();
          break;
      }
      this.ctx.restore();
      this.ctx.restore();
    });
    this.ctx.restore();
  }

  private drawMarbles(params: RenderParameters) {
    const { marbles } = params;
    marbles.forEach((marble) => {
      marble.render(this.ctx, 1, false, true);
    });
  }
}
