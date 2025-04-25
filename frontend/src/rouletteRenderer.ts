import { canvasHeight, canvasWidth, DefaultBloomColor, DefaultEntityColor, initialZoom } from './data/constants';
import { Camera } from './camera';
import { StageDef } from './data/maps';
// import { Marble } from './marble'; // No longer using Marble class instance
import { MarbleState } from './types/MarbleState.type'; // Use MarbleState instead
import { ParticleManager } from './particleManager';
import { GameObject } from './gameObject';
import { UIObject } from './UIObject';
import { VectorLike } from './types/VectorLike';
import { MapEntityState } from './types/MapEntity.type';

export type RenderParameters = {
  camera: Camera;
  stage: StageDef;
  entities: MapEntityState[];
  marbles: MarbleState[]; // Changed type
  winners: MarbleState[]; // Changed type
  particleManager: ParticleManager;
  effects: GameObject[];
  winnerRank: number;
  winner: MarbleState | null; // Changed type
  size: VectorLike;
};

export class RouletteRenderer {
  private _canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  public sizeFactor = 1;

  private _images: { [key: string]: HTMLImageElement } = {};

  constructor() {}

  get width() {
    return this._canvas.width;
  }

  get height() {
    return this._canvas.height;
  }

  get canvas() {
    return this._canvas;
  }

  async init() {
    await this._load();

    this._canvas = document.createElement('canvas');
    this._canvas.width = canvasWidth;
    this._canvas.height = canvasHeight;
    this.ctx = this._canvas.getContext('2d', {
      alpha: false,
    }) as CanvasRenderingContext2D;

    document.body.appendChild(this._canvas);

    const resizing = (entries?: ResizeObserverEntry[]) => {
      const realSize = entries ? entries[0].contentRect : this._canvas.getBoundingClientRect();
      const width = Math.max(realSize.width / 2, 640);
      const height = (width / realSize.width) * realSize.height;
      this._canvas.width = width;
      this._canvas.height = height;
      this.sizeFactor = width / realSize.width;
    };

    const resizeObserver = new ResizeObserver(resizing);

    resizeObserver.observe(this._canvas);
    resizing();
  }

  private async _load(): Promise<void> {
    return new Promise((rs) => {
      const imageUrl = new URL('../assets/images/chamru.png', import.meta.url);
      this._images['챔루'] = new Image();
      this._images['챔루'].src = imageUrl.toString();
      this._images['챔루'].addEventListener('load', () => {
        rs();
      });
    });
  }

  render(renderParameters: RenderParameters, uiObjects: UIObject[]) {
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);

    this.ctx.save();
    this.ctx.scale(initialZoom, initialZoom);
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.font = '0.4pt sans-serif';
    this.ctx.lineWidth = 3 / (renderParameters.camera.zoom + initialZoom);
    renderParameters.camera.renderScene(this.ctx, () => {
      this.renderEntities(renderParameters.entities);
      this.renderEffects(renderParameters);
      this.renderMarbles(renderParameters);
    });
    this.ctx.restore();

    uiObjects.forEach((obj) => obj.render(this.ctx, renderParameters, this._canvas.width, this._canvas.height));
    renderParameters.particleManager.render(this.ctx);
    this.renderWinner(renderParameters);
  }

  private renderEntities(entities: MapEntityState[]) {
    console.log(`renderEntities called with ${entities.length} entities.`); // Uncommented log
    this.ctx.save();
    entities.forEach((entity) => {
      console.log(`Rendering entity:`, entity); // Uncommented log
      this.ctx.save();
      this.ctx.translate(entity.x, entity.y);
      this.ctx.rotate(entity.angle);
      this.ctx.fillStyle = DefaultEntityColor[entity.shape.type];
      this.ctx.strokeStyle = DefaultEntityColor[entity.shape.type];
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = DefaultBloomColor[entity.shape.type];
      const shape = entity.shape;
      switch (shape.type) {
        case 'polyline':
          if (shape.points.length > 0) {
            this.ctx.beginPath();
            this.ctx.moveTo(shape.points[0][0], shape.points[0][1]);
            for (let i = 1; i < shape.points.length; i++) {
              this.ctx.lineTo(shape.points[i][0], shape.points[i][1]);
            }
            this.ctx.stroke();
          }
          break;
        case 'box':
          const w = shape.width * 2;
          const h = shape.height * 2;
          this.ctx.rotate(shape.rotation);
          this.ctx.fillRect(-w / 2, -h / 2, w, h);
          this.ctx.strokeRect(-w / 2, -h / 2, w, h);
          break;
        case 'circle':
          this.ctx.beginPath();
          this.ctx.arc(0, 0, shape.radius, 0, Math.PI * 2, false);
          this.ctx.stroke();
          break;
      }

      this.ctx.restore();
    });
    this.ctx.restore();
  }

  private renderEffects({ effects, camera }: RenderParameters) {
    effects.forEach((effect) => effect.render(this.ctx, camera.zoom * initialZoom));
  }

  // Updated to render based on MarbleState
  private renderMarbles({ marbles, camera, winnerRank, winners }: RenderParameters) {
    const winnerIndex = winnerRank - winners.length; // This index might not be reliable if marbles array is filtered differently on server/client
    console.log(`renderMarbles called with ${marbles.length} marbles.`); // Uncommented log

    marbles.forEach((marbleState, i) => {
      console.log(`Rendering marble ${i}:`, marbleState); // Uncommented log
      // Draw marble based on state
      this.ctx.save();
      this.ctx.translate(marbleState.x, marbleState.y);
      // TODO: Add rotation if available in MarbleState and needed
      // this.ctx.rotate(marbleState.angle || 0);

      // Basic circle rendering
      this.ctx.beginPath();
      this.ctx.arc(0, 0, marbleState.radius, 0, Math.PI * 2, false);
      this.ctx.fillStyle = marbleState.color;
      this.ctx.fill();

      // Add stroke or effects based on state (e.g., winner highlight)
      if (i === winnerIndex) {
        // Highlight potential winner? Check if this logic is still valid
        this.ctx.strokeStyle = 'yellow'; // Example highlight
        this.ctx.lineWidth = 0.1; // Adjust line width based on zoom?
        this.ctx.stroke();
      }

      // Render name (simplified)
      this.ctx.fillStyle = 'white';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const fontSize = Math.max(0.3, marbleState.radius * 0.5); // Adjust font size based on radius
      this.ctx.font = `${fontSize}pt sans-serif`;
      this.ctx.fillText(marbleState.name, 0, 0);

      // Render image if available (using name as key)
      const img = this._images[marbleState.name];
      if (img) {
        try {
          const imgSize = marbleState.radius * 1.6; // Adjust image size relative to radius
          this.ctx.drawImage(img, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
        } catch (e) {
          console.error(`Error drawing image for ${marbleState.name}:`, e);
          // Fallback or do nothing if image fails to draw
        }
      }

      this.ctx.restore();

      // Original call (removed):
      // marble.render(
      //   this.ctx,
      //   camera.zoom * initialZoom,
      //   i === winnerIndex,
      //   false,
      //   this._images[marble.name] || undefined,
      // );
    });
  }

  // Updated to render based on MarbleState
  private renderWinner({ winner }: RenderParameters) {
    if (!winner) return; // Winner is now MarbleState | null
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(this._canvas.width / 2, this._canvas.height - 168, this._canvas.width / 2, 168);
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 48px sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.fillText('Winner', this._canvas.width - 10, this._canvas.height - 120);
    this.ctx.font = 'bold 72px sans-serif';
    this.ctx.fillStyle = winner.color;
    this.ctx.fillText(winner.name, this._canvas.width - 10, this._canvas.height - 55);
    this.ctx.restore();
  }
}
