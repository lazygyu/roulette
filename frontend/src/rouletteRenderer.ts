import { canvasHeight, canvasWidth, DefaultBloomColor, DefaultEntityColor, initialZoom } from './data/constants';
import { Camera } from './camera';
import { StageDef } from 'common';
import { MarbleState, MapEntityState } from './types/gameTypes'; // Use types from gameTypes
import { ParticleManager } from './particleManager';
import { UIObject } from './UIObject';
import { VectorLike } from './types/VectorLike';
import { ServerSkillType, FrontendSkillEffectWrapper, ImpactSkillEffectFromServer } from './types/skillTypes'; // 스킬 이펙트 관련 타입 임포트
import { CoordinateManager } from './utils/coordinate-manager';

export type RenderParameters = {
  camera: Camera;
  stage: StageDef;
  entities: MapEntityState[]; // Uses MapEntityState from gameTypes
  marbles: MarbleState[]; // Uses MarbleState from gameTypes
  winners: MarbleState[]; // Uses MarbleState from gameTypes
  particleManager: ParticleManager;
  skillEffects: FrontendSkillEffectWrapper[]; // 스킬 이펙트 추가
  winnerRank: number;
  winner: MarbleState | null; // Uses MarbleState from gameTypes
  size: VectorLike;
};

export class RouletteRenderer {
  private _canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  public sizeFactor = 1;
  public onResize: ((width: number, height: number) => void) | null = null;

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

  async init(container: HTMLElement) {
    if (!container) {
      console.error('RouletteRenderer init: container is null or undefined.');
      throw new Error('Container element is required for RouletteRenderer initialization.');
    }
    await this._load();

    this._canvas = document.createElement('canvas');
    this._canvas.width = canvasWidth;
    this._canvas.height = canvasHeight;
    this.ctx = this._canvas.getContext('2d', {
      alpha: false,
    }) as CanvasRenderingContext2D;

    container.appendChild(this._canvas); // Use the provided container

    const resizing = (entries?: ResizeObserverEntry[]) => {
      const realSize = entries ? entries[0].contentRect : this._canvas.getBoundingClientRect();
      const width = Math.max(realSize.width / 2, 640);
      const height = (width / realSize.width) * realSize.height;
      this._canvas.width = width;
      this._canvas.height = height;
      this.sizeFactor = width / realSize.width;
      if (this.onResize) {
        this.onResize(width, height);
      }
    };

    const resizeObserver = new ResizeObserver(resizing);

    resizeObserver.observe(this._canvas);
    resizing();
  }

  private async _load(): Promise<void> {
    const imageUrl = new URL('../assets/images/chamru.png', import.meta.url);
    this._images['챔루'] = new Image();
    this._images['챔루'].src = imageUrl.toString();
    await new Promise<void>((resolve) => {
      this._images['챔루'].addEventListener('load', () => {
        resolve();
      });
    });
  }

  render(
    renderParameters: RenderParameters,
    uiObjects: UIObject[],
    coordinateManager: CoordinateManager
  ) {
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
      this.renderMarbles(renderParameters);
      this.renderSkillEffects(renderParameters.skillEffects, renderParameters.camera, this.ctx); // 스킬 이펙트 렌더링 추가
    });
    this.ctx.restore();

    uiObjects.forEach((obj) =>
      obj.render(
        this.ctx,
        renderParameters,
        coordinateManager,
        this._canvas.width,
        this._canvas.height
      )
    );
    renderParameters.particleManager.render(this.ctx);
    this.renderWinner(renderParameters);
  }

  private renderEntities(entities: MapEntityState[]) {
    // console.log(`renderEntities called with ${entities.length} entities.`); // Uncommented log
    this.ctx.save();
    entities.forEach((entity) => {
      // console.log(`Rendering entity:`, entity); // Uncommented log
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
          const w = shape.width;
          const h = shape.height;
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

  // 스킬 이펙트 렌더링을 위한 새로운 메서드
  public renderSkillEffects(effects: FrontendSkillEffectWrapper[], camera: Camera, context: CanvasRenderingContext2D) {
    effects.forEach((effectWrapper) => {
      this.renderSingleSkillEffect(effectWrapper, camera, context);
    });
  }

  // 단일 스킬 이펙트 렌더링 (타입별 분기)
  private renderSingleSkillEffect(
    effectWrapper: FrontendSkillEffectWrapper,
    camera: Camera,
    context: CanvasRenderingContext2D,
  ) {
    switch (effectWrapper.type) {
      case ServerSkillType.Impact:
        this.renderImpactEffect(effectWrapper, camera, context);
        break;
      case ServerSkillType.DummyMarble:
        // DummyMarble 이펙트 렌더링 로직 (필요시 구현)
        // 예: 작은 파티클 효과나 텍스트 표시 등
        break;
      default:
        // 알 수 없는 스킬 타입 처리
        break;
    }
  }

  // Impact 스킬 이펙트 렌더링
  private renderImpactEffect(
    effectWrapper: FrontendSkillEffectWrapper,
    camera: Camera,
    context: CanvasRenderingContext2D,
  ) {
    const effectData = effectWrapper.serverEffectData as ImpactSkillEffectFromServer;
    const elapsed = Date.now() - effectWrapper.startTime;
    const progress = Math.min(elapsed / effectWrapper.duration, 1);

    // 시간에 따른 투명도 및 크기 변화
    const opacity = 1 - progress;
    // 월드 반경을 화면 반경으로 변환 (initialZoom은 renderScene에서 이미 적용되므로, camera.zoom만 곱함)
    const currentRadius = effectData.radius * camera.zoom * (0.5 + progress * 0.5);

    if (opacity <= 0 || currentRadius <= 0) {
      return;
    }

    context.save();
    context.globalAlpha = opacity;
    context.strokeStyle = 'rgba(255, 255, 0, 1)'; // 노란색 테두리
    context.lineWidth = 2 / (camera.zoom * initialZoom); // 줌에 따라 선 굵기 조절

    context.beginPath();
    // 월드 좌표를 직접 사용
    context.arc(effectData.position.x, effectData.position.y, currentRadius, 0, Math.PI * 2, false);
    context.stroke();
    context.restore();
  }

  // Updated to render based on MarbleState (Restored full logic + radius fallback)
  private renderMarbles({ marbles, camera, winnerRank, winners }: RenderParameters) {
    const winnerIndex = winnerRank - winners.length;
    // console.log(`renderMarbles called with ${marbles.length} marbles.`);

    marbles.forEach((marbleState, i) => {
      // console.log(`Rendering marble ${i}:`, marbleState);

      // --- Fallback for missing or invalid radius ---
      const radius = marbleState.radius && marbleState.radius > 0 ? marbleState.radius : 0.25;
      if (!marbleState.radius || marbleState.radius <= 0) {
        // console.warn(`Marble ${i} (${marbleState.name}) missing or invalid radius (${marbleState.radius}). Using default: ${radius}`);
      }
      // --- End Fallback ---

      this.ctx.save();
      // Translate to the marble's center position
      this.ctx.translate(marbleState.x, marbleState.y);

      // Basic circle rendering (using potentially fallback radius)
      this.ctx.beginPath();
      this.ctx.arc(0, 0, radius, 0, Math.PI * 2, false);
      this.ctx.fillStyle = marbleState.color;
      this.ctx.fill();

      // Add stroke or effects based on state (e.g., winner highlight)
      if (i === winnerIndex) {
        this.ctx.strokeStyle = 'yellow';
        this.ctx.lineWidth = 0.1;
        this.ctx.stroke();
      }

      // Render name BELOW the circle (using potentially fallback radius for sizing)
      this.ctx.strokeStyle = 'red'; // Red outline as per target image
      this.ctx.lineWidth = 0.02; // Thinner outline
      this.ctx.textAlign = 'center';
      // Adjust textBaseline and y-offset to draw below the circle
      this.ctx.textBaseline = 'top'; // Align text top to the drawing point
      const textYOffset = radius + 0.1; // Position text below the circle (adjust offset as needed)
      const fontSize = Math.max(0.3, radius * 0.5); // Use radius for font size
      this.ctx.font = `${fontSize}pt sans-serif`;
      // Draw outline first, then fill, at the adjusted Y position
      this.ctx.strokeText(marbleState.name, 0, textYOffset);
      this.ctx.fillStyle = marbleState.color;
      this.ctx.fillText(marbleState.name, 0, textYOffset);

      // Render image if available (using potentially fallback radius for sizing) - Draw image AT THE CENTER (0, 0)
      const img = this._images[marbleState.name];
      if (img) {
        try {
          const imgSize = radius * 1.6; // Use radius for image size
          this.ctx.drawImage(img, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
        } catch (e) {
          console.error(`Error drawing image for ${marbleState.name}:`, e);
        }
      }

      this.ctx.restore();
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
