import {canvasHeight, canvasWidth, DefaultBloomColor, DefaultEntityColor, initialZoom} from './data/constants';
import { Camera } from './camera';
import { StageDef } from './data/maps';
import { Marble } from './marble';
import { ParticleManager } from './particleManager';
import { GameObject } from './gameObject';
import { UIObject } from './UIObject';
import { VectorLike } from './types/VectorLike';
import { MapEntityState } from './types/MapEntity.type';

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
};

export interface BackendRenderParams {
  marbles: any[];
  winners: any[];
  entities: MapEntityState[];
  winner: any | null;
  // 필요한 다른 렌더링 데이터
}

export class RouletteRenderer {
  private _canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  public sizeFactor = 1;

  private _images: { [key: string]: HTMLImageElement } = {};
  private camera: Camera = new Camera();

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

  setCanvas(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this.ctx = this._canvas.getContext('2d', {
      alpha: false,
    }) as CanvasRenderingContext2D;
  }

  async init() {
    await this._load();

    if (!this._canvas) {
      this._canvas = document.createElement('canvas');
      this._canvas.width = canvasWidth;
      this._canvas.height = canvasHeight;
      this.ctx = this._canvas.getContext('2d', {
        alpha: false,
      }) as CanvasRenderingContext2D;

      document.body.appendChild(this._canvas);
    }

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

  // 백엔드에서 받은 게임 상태를 렌더링하는 메서드
  renderFromBackend(params: BackendRenderParams) {
    if (!this.ctx) return;

    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);

    this.ctx.save();
    this.ctx.scale(initialZoom, initialZoom);
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.font = '0.4pt sans-serif';
    this.ctx.lineWidth = 3 / (this.camera.zoom + initialZoom);
    
    this.camera.update({
      marbles: params.marbles,
      stage: { goalY: 111, zoomY: 106.75 }, // 기본 맵 값
      needToZoom: false,
      targetIndex: 0,
    });

    this.camera.renderScene(this.ctx, () => {
      this.renderEntitiesFromBackend(params.entities);
      this.renderMarblesFromBackend(params.marbles);
      this.renderWinnersFromBackend(params.winners);
    });
    this.ctx.restore();

    // 우승자 렌더링
    if (params.winner) {
      this.renderWinnerFromBackend(params.winner);
    }
  }

  private renderEntitiesFromBackend(entities: MapEntityState[]) {
    this.ctx.save();
    entities.forEach((entity) => {
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
            for(let i = 1; i < shape.points.length; i++) {
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

  private renderMarblesFromBackend(marbles: any[]) {
    this.ctx.save();
    marbles.forEach((marble) => {
      this.ctx.save();
      // 마블 본체 그리기
      this.ctx.translate(marble.x, marble.y);
      this.ctx.rotate(marble.angle);
      
      this.ctx.fillStyle = marble.color || 'red';
      this.ctx.shadowColor = marble.color || 'red';
      this.ctx.shadowBlur = initialZoom / 2;
      
      // 마블 본체 그리기
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 0.25, 0, Math.PI * 2);
      this.ctx.fill();
      
      // 마블 이름 그리기
      this.ctx.save();
      this.ctx.translate(0, 0.25);
      this.ctx.scale(1 / initialZoom, 1 / initialZoom);
      this.ctx.font = `12pt sans-serif`;
      this.ctx.strokeStyle = 'black';
      this.ctx.lineWidth = 2;
      this.ctx.fillStyle = marble.color || 'red';
      this.ctx.shadowBlur = 0;
      this.ctx.strokeText(marble.name, 0, 0);
      this.ctx.fillText(marble.name, 0, 0);
      this.ctx.restore();
      
      this.ctx.restore();
    });
    this.ctx.restore();
  }

  private renderWinnersFromBackend(winners: any[]) {
    this.ctx.save();
    winners.forEach((winner) => {
      this.ctx.save();
      // 우승자 마블 그리기
      this.ctx.translate(winner.x, winner.y);
      this.ctx.rotate(winner.angle);
      
      this.ctx.fillStyle = winner.color || 'gold';
      this.ctx.shadowColor = winner.color || 'gold';
      this.ctx.shadowBlur = initialZoom / 2;
      
      // 우승자 마블 본체 그리기
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 0.25, 0, Math.PI * 2);
      this.ctx.fill();
      
      // 우승자 효과 그리기
      this.ctx.strokeStyle = 'white';
      this.ctx.lineWidth = 0.05;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 0.3, 0, Math.PI * 2);
      this.ctx.stroke();
      
      // 우승자 이름 그리기
      this.ctx.save();
      this.ctx.translate(0, 0.25);
      this.ctx.scale(1 / initialZoom, 1 / initialZoom);
      this.ctx.font = `12pt sans-serif`;
      this.ctx.strokeStyle = 'black';
      this.ctx.lineWidth = 2;
      this.ctx.fillStyle = winner.color || 'gold';
      this.ctx.shadowBlur = 0;
      this.ctx.strokeText(winner.name, 0, 0);
      this.ctx.fillText(winner.name, 0, 0);
      this.ctx.restore();
      
      this.ctx.restore();
    });
    this.ctx.restore();
  }

  private renderWinnerFromBackend(winner: any) {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(
      this._canvas.width / 2,
      this._canvas.height - 168,
      this._canvas.width / 2,
      168,
    );
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 48px sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(
      'Winner',
      this._canvas.width - 10,
      this._canvas.height - 120,
    );
    this.ctx.font = 'bold 72px sans-serif';
    this.ctx.fillStyle = winner.color || 'gold';
    this.ctx.fillText(
      winner.name,
      this._canvas.width - 10,
      this._canvas.height - 55,
    );
    this.ctx.restore();
  }

  private renderEntities(entities: MapEntityState[]) {
    this.ctx.save();
    entities.forEach((entity) => {
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
            for(let i = 1; i < shape.points.length; i++) {
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
    effects.forEach((effect) =>
      effect.render(this.ctx, camera.zoom * initialZoom),
    );
  }

  private renderMarbles({
                          marbles,
                          camera,
                          winnerRank,
                          winners,
                        }: RenderParameters) {
    const winnerIndex = winnerRank - winners.length;

    marbles.forEach((marble, i) => {
      marble.render(
        this.ctx,
        camera.zoom * initialZoom,
        i === winnerIndex,
        false,
        this._images[marble.name] || undefined,
      );
    });
  }

  private renderWinner({ winner }: RenderParameters) {
    if (!winner) return;
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(
      this._canvas.width / 2,
      this._canvas.height - 168,
      this._canvas.width / 2,
      168,
    );
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 48px sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(
      'Winner',
      this._canvas.width - 10,
      this._canvas.height - 120,
    );
    this.ctx.font = 'bold 72px sans-serif';
    this.ctx.fillStyle = winner.color;
    this.ctx.fillText(
      winner.name,
      this._canvas.width - 10,
      this._canvas.height - 55,
    );
    this.ctx.restore();
  }
}
