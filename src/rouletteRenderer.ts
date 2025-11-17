import { canvasHeight, canvasWidth, initialZoom, Themes } from './data/constants';
import { Camera } from './camera';
import { StageDef } from './data/maps';
import { Marble } from './marble';
import { ParticleManager } from './particleManager';
import { GameObject } from './gameObject';
import { UIObject } from './UIObject';
import { VectorLike } from './types/VectorLike';
import { MapEntityState } from './types/MapEntity.type';
import { ColorTheme } from './types/ColorTheme';

export type RenderParameters = {
  camera: Camera;
  stage: StageDef;
  entities: MapEntityState[];
  marbles: Marble[];
  winners: Marble[];
  particleManager: ParticleManager;
  effects: GameObject[];
  winnerRank: number;
  winner: Marble | null;
  size: VectorLike;
  theme: ColorTheme;
};

export class RouletteRenderer {
  private _canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  public sizeFactor = 1;

  private _images: { [key: string]: HTMLImageElement } = {};
  private _theme: ColorTheme = Themes.dark;

  constructor() {
  }

  get width() {
    return this._canvas.width;
  }

  get height() {
    return this._canvas.height;
  }

  get canvas() {
    return this._canvas;
  }

  set theme(value: ColorTheme) {
    this._theme = value;
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
      const realSize = entries
        ? entries[0].contentRect
        : this._canvas.getBoundingClientRect();
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

  private async _loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((rs) => {
      const img = new Image();
      img.addEventListener('load', () => {
        rs(img);
      });
      img.src = url;
    });
  }

  private async _load(): Promise<void> {
    const loadPromises =
      [
        { name: '챔루', imgUrl: new URL('../assets/images/chamru.png', import.meta.url) },
        { name: '쿠빈', imgUrl: new URL('../assets/images/kubin.png', import.meta.url) },
        { name: '꽉변', imgUrl: new URL('../assets/images/kkwak.png', import.meta.url) },
        { name: '꽉변호사', imgUrl: new URL('../assets/images/kkwak.png', import.meta.url) },
        { name: '꽉 변호사', imgUrl: new URL('../assets/images/kkwak.png', import.meta.url) },
        { name: '주누피', imgUrl: new URL('../assets/images/junyoop.png', import.meta.url) },
        { name: '왈도쿤', imgUrl: new URL('../assets/images/waldokun.png', import.meta.url) },
      ].map(({ name, imgUrl }) => {
        return (async () => {
          this._images[name] = await this._loadImage(imgUrl.toString());
        })();
      });

    loadPromises.push((async () => {
      await this._loadImage(new URL('../assets/images/ff.svg', import.meta.url).toString());
    })());

    await Promise.all(loadPromises);
  }

  render(renderParameters: RenderParameters, uiObjects: UIObject[]) {
    this._theme = renderParameters.theme;
    this.ctx.fillStyle = this._theme.background;
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

    uiObjects.forEach((obj) =>
      obj.render(
        this.ctx,
        renderParameters,
        this._canvas.width,
        this._canvas.height,
      ),
    );
    renderParameters.particleManager.render(this.ctx);
    this.renderWinner(renderParameters);
  }

  private renderEntities(entities: MapEntityState[]) {
    this.ctx.save();
    entities.forEach((entity) => {
      const transform = this.ctx.getTransform();
      this.ctx.translate(entity.x, entity.y);
      this.ctx.rotate(entity.angle);
      this.ctx.fillStyle = entity.shape.color ?? this._theme.entity[entity.shape.type].fill;
      this.ctx.strokeStyle = entity.shape.color ?? this._theme.entity[entity.shape.type].outline;
      this.ctx.shadowBlur = this._theme.entity[entity.shape.type].bloomRadius;
      this.ctx.shadowColor = entity.shape.bloomColor ?? entity.shape.color ?? this._theme.entity[entity.shape.type].bloom;
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

      this.ctx.setTransform(transform);
    });
    this.ctx.restore();
  }

  private renderEffects({ effects, camera }: RenderParameters) {
    effects.forEach((effect) =>
      effect.render(this.ctx, camera.zoom * initialZoom, this._theme),
    );
  }

  private renderMarbles({
                          marbles,
                          camera,
                          winnerRank,
                          winners,
                          size,
                        }: RenderParameters) {
    const winnerIndex = winnerRank - winners.length;

    const viewPort = { x: camera.x, y: camera.y, w: size.x, h: size.y, zoom: camera.zoom * initialZoom };
    marbles.forEach((marble, i) => {
      marble.render(
        this.ctx,
        camera.zoom * initialZoom,
        i === winnerIndex,
        false,
        this._images[marble.name] || undefined,
        viewPort,
        this._theme,
      );
    });
  }

  private renderWinner({ winner, theme }: RenderParameters) {
    if (!winner) return;
    this.ctx.save();
    this.ctx.fillStyle = theme.winnerBackground;
    this.ctx.fillRect(
      this._canvas.width / 2,
      this._canvas.height - 168,
      this._canvas.width / 2,
      168,
    );
    this.ctx.fillStyle = theme.winnerText;
    this.ctx.strokeStyle = theme.winnerOutline;

    this.ctx.font = 'bold 48px sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.lineWidth = 4;
    if (theme.winnerOutline) {
      this.ctx.strokeText(
        'Winner',
        this._canvas.width - 10,
        this._canvas.height - 120,
      );
    }

    this.ctx.fillText(
      'Winner',
      this._canvas.width - 10,
      this._canvas.height - 120,
    );
    this.ctx.font = 'bold 72px sans-serif';
    this.ctx.fillStyle = `hsl(${winner.hue} 100% ${theme.marbleLightness}`;
    if (theme.winnerOutline) {
      this.ctx.strokeText(
        winner.name,
        this._canvas.width - 10,
        this._canvas.height - 55,
      );
    }
    this.ctx.fillText(
      winner.name,
      this._canvas.width - 10,
      this._canvas.height - 55,
    );
    this.ctx.restore();
  }
}
