import {canvasHeight, canvasWidth, initialZoom} from './data/constants';
import {Camera} from './camera';
import {StageDef} from './data/maps';
import {Marble} from './marble';
import {ParticleManager} from './particleManager';
import {GameObject} from './gameObject';
import {UIObject} from './UIObject';
import {WheelState} from './types/WheelState';
import {BoxState} from './types/BoxState';
import {JumperState} from './types/JumperState';
import {VectorLike} from './types/VectorLike';

export type RenderParameters = {
    camera: Camera,
    stage: StageDef,
    wheels: WheelState[],
    boxes: BoxState[],
    jumpers: JumperState[],
    marbles: Marble[],
    winners: Marble[],
    particleManager: ParticleManager,
    effects: GameObject[],
    winnerRank: number,
    winner: Marble | null,
    size: VectorLike,
};

export class RouletteRenderer {
    private _canvas!: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;
    public sizeFactor = 1;

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

    init() {
        this._canvas = document.createElement('canvas');
        this._canvas.width = canvasWidth;
        this._canvas.height = canvasHeight;
        this.ctx = this._canvas.getContext('2d', {alpha: false}) as CanvasRenderingContext2D;


        document.body.appendChild(this._canvas);

        const resizing = (entries?: ResizeObserverEntry[]) => {
            const realSize = entries ? entries[0].contentRect : this._canvas.getBoundingClientRect();
            const width = Math.max(realSize.width / 2, 640);
            const height = (width / realSize.width) * realSize.height;
            this._canvas.width = width;
            this._canvas.height = height;
            this.sizeFactor = (width / realSize.width);
        }

        const resizeObserver = new ResizeObserver(resizing);

        resizeObserver.observe(this._canvas);
        resizing();
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
            this._renderWalls({...renderParameters});
            this.renderBoxes(renderParameters.boxes);
            this.renderWheels(renderParameters.wheels);
            this.renderJumpers(renderParameters.jumpers);
            this.renderEffects(renderParameters);
            this.renderMarbles(renderParameters);
        });
        this.ctx.restore();

        uiObjects.forEach(obj => obj.render(this.ctx, renderParameters, this._canvas.width, this._canvas.height));
        renderParameters.particleManager.render(this.ctx);
        this.renderWinner(renderParameters);
    }

    private _renderWalls({stage, camera}: { stage: StageDef, camera: Camera}) {
        if (!stage) return;
        this.ctx.save();
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 5 / (camera.zoom + initialZoom);
        this.ctx.beginPath();
        stage.walls.forEach((wallDef) => {
            this.ctx.moveTo(wallDef[0][0], wallDef[0][1]);
            for (let i = 1; i < wallDef.length; i++) {
                this.ctx.lineTo(wallDef[i][0], wallDef[i][1]);
            }
        });
        this.ctx.shadowColor = 'cyan';
        this.ctx.shadowBlur = 15;
        this.ctx.stroke();
        this.ctx.closePath();
        this.ctx.restore();
    }

    private renderWheels(wheels: WheelState[]) {
        this.ctx.save();
        this.ctx.fillStyle = '#94d5ed';
        this.ctx.strokeStyle = '#94d5ed';
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = 'cyan';
        wheels.forEach((wheel) => {
            this.ctx.save();
            this.ctx.translate(wheel.x, wheel.y);
            this.ctx.rotate(wheel.angle);
            this.ctx.fillRect(-wheel.size, -0.05, wheel.size * 2, 0.1);
            this.ctx.strokeRect(-wheel.size, -0.05, wheel.size * 2, 0.1);
            this.ctx.restore();
        });
        this.ctx.restore();
    }

    private renderBoxes(boxes: BoxState[]) {
        this.ctx.save();
        this.ctx.fillStyle = '#94d5ed';
        this.ctx.strokeStyle = '#94d5ed';

        boxes.forEach((box) => {
            this.ctx.save();
            this.ctx.translate(box.x, box.y);
            this.ctx.rotate(box.angle);
            this.ctx.fillRect(-box.width / 2, -box.height / 2, box.width, box.height);
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = 'cyan';
            this.ctx.strokeRect(-box.width / 2, -box.height / 2, box.width, box.height);
            this.ctx.restore();
        });
        this.ctx.restore();
    }

    private renderJumpers(jumpers: JumperState[]) {
        this.ctx.save();
        this.ctx.fillStyle = 'yellow';
        this.ctx.strokeStyle = 'yellow';
        jumpers.forEach((jumper) => {
            this.ctx.save();
            this.ctx.translate(jumper.x, jumper.y);
            this.ctx.beginPath();
            this.ctx.arc(0, 0, jumper.radius, 0, Math.PI * 2, false);
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = 'yellow';
            this.ctx.stroke();
            this.ctx.restore();
        });
        this.ctx.restore();
    }

    private renderEffects({effects, camera}: RenderParameters) {
        effects.forEach(effect => effect.render(this.ctx, camera.zoom * initialZoom));
    }

    private renderMarbles({marbles, camera, winnerRank, winners}: RenderParameters) {
        const winnerIndex = winnerRank - winners.length;
        marbles.forEach((marble, i) => {
            marble.render(this.ctx, camera.zoom * initialZoom, i === winnerIndex, false);
        });
    }

    private renderWinner({winner}: RenderParameters) {
        if (!winner) return;
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
