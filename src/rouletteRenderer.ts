import {canvasHeight, canvasWidth, initialZoom} from './constants';
import {Camera} from './camera';
import {StageDef} from './maps';
import { Body } from 'planck';
import {Marble} from './marble';
import {ParticleManager} from './particleManager';
import {GameObject} from './gameObject';

export type RenderParameters = {
    camera: Camera,
    stage: StageDef,
    objects: Body[],
    marbles: Marble[],
    winners: Marble[],
    particleManager: ParticleManager,
    effects: GameObject[],
    winnerRank: number,
};

export class RouletteRenderer {
    private _canvas!: HTMLCanvasElement;
    private _ctx!: CanvasRenderingContext2D;

    constructor() {
    }

    get width() {
        return this._canvas.width;
    }

    get height() {
        return this._canvas.height;
    }

    init() {
        this._canvas = document.createElement('canvas');
        this._canvas.width = canvasWidth;
        this._canvas.height = canvasHeight;
        this._ctx = this._canvas.getContext('2d', {alpha: false}) as CanvasRenderingContext2D;

        document.body.appendChild(this._canvas);

        const resizing = (entries?: ResizeObserverEntry[]) => {
            const realSize = entries ? entries[0].contentRect : this._canvas.getBoundingClientRect();
            const width = Math.max(realSize.width / 2, 640);
            const height = (width / realSize.width) * realSize.height;
            this._canvas.width = width;
            this._canvas.height = height;
        }

        const resizeObserver = new ResizeObserver(resizing);

        resizeObserver.observe(this._canvas);
        resizing();
    }

    render(renderParameters: RenderParameters) {
        this._ctx.fillStyle = 'black';
        this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);

        this._ctx.save();
        this._ctx.scale(initialZoom, initialZoom);
        this._ctx.textAlign = 'left';
        this._ctx.textBaseline = 'top';
        this._ctx.font = '0.4pt sans-serif';
        renderParameters.camera.renderScene(this._ctx, () => {
            this._renderWalls({...renderParameters, isMinimap: false});
            this._renderObjects({
                ...renderParameters,
                isMinimap: false,
            });
            this._renderEffects(renderParameters);
            this._renderMarbles(renderParameters);
        });
        this._ctx.restore();

        this._renderMinimap(renderParameters);
        renderParameters.particleManager.render(this._ctx);
        this._renderRanking(renderParameters);
        this._renderWinner(renderParameters);
    }

    private _renderWalls({stage, camera, isMinimap = false}: { stage: StageDef, camera: Camera, isMinimap?: boolean }) {
        if (!stage) return;
        this._ctx.save();
        this._ctx.strokeStyle = isMinimap ? 'black' : 'white';
        this._ctx.lineWidth = isMinimap ? 0.5 : 5 / (camera.zoom + initialZoom);
        this._ctx.beginPath();
        stage.walls.forEach((wallDef) => {
            this._ctx.moveTo(wallDef[0][0], wallDef[0][1]);
            for (let i = 1; i < wallDef.length; i++) {
                this._ctx.lineTo(wallDef[i][0], wallDef[i][1]);
            }
        });
        if (!isMinimap) {
            this._ctx.shadowColor = 'cyan';
            this._ctx.shadowBlur = 15;
        }
        this._ctx.stroke();
        this._ctx.closePath();
        this._ctx.restore();
    }

    private _renderObjects({
                               objects,
                               camera,
                               isMinimap = false
                           }: { objects: Body[], camera: Camera, isMinimap?: boolean }) {
        this._ctx.save();
        this._ctx.fillStyle = 'black';
        this._ctx.lineWidth = 3 / (camera.zoom + initialZoom);
        objects.forEach(obj => {
            this._ctx.save();
            const pos = obj.getPosition();
            const ang = obj.getAngle();
            this._ctx.translate(pos.x, pos.y);
            this._ctx.rotate(ang);
            for (let fixture = obj.getFixtureList(); fixture; fixture = fixture.getNext()) {
                const shape = fixture.getShape() as planck.Polygon;
                this._ctx.beginPath();
                switch(shape.getType()) {
                    case 'circle':
                        this._ctx.strokeStyle = 'yellow';
                        this._ctx.arc(0, 0, shape.m_radius, 0, Math.PI * 2);
                        break;
                    default:
                        this._ctx.strokeStyle = '#94d5ed';
                        const vertices = shape.m_vertices;
                        this._ctx.moveTo(vertices[0].x, vertices[0].y);
                        for (let i = 1; i < vertices.length; i++) {
                            const vert = vertices[i];
                            this._ctx.lineTo(vert.x, vert.y);
                        }
                        this._ctx.closePath();
                        break;
                }
                this._ctx.fill();

                if (!isMinimap) {
                    this._ctx.save();
                    this._ctx.shadowBlur = 15;
                    this._ctx.shadowColor = 'cyan';
                    this._ctx.stroke();
                    this._ctx.restore();
                }

                this._ctx.closePath();
            }
            this._ctx.restore();
        });
        this._ctx.restore();
    }

    private _renderEffects({effects, camera}: RenderParameters) {
        effects.forEach(effect => effect.render(this._ctx, camera.zoom * initialZoom));
    }

    private _renderMarbles({isMinimap = false, marbles, camera, winnerRank, winners}: RenderParameters & { isMinimap?: boolean }) {
        const winnerIndex = winnerRank - winners.length;
        marbles.forEach((marble, i) => {
            marble.render(this._ctx, camera.zoom * initialZoom, i === winnerIndex, isMinimap);
        });
    }

    private _renderMinimap(params: RenderParameters) {
        const {stage} = params;
        if (!stage) return;
        if (this._canvas.width < this._canvas.height) return;
        this._ctx.save();
        this._ctx.fillStyle = `#333`;
        this._ctx.translate(10, 10);
        this._ctx.scale(4, 4);
        this._ctx.fillRect(0, 0, 26, stage.goalY);
        this._renderWalls({...params, isMinimap: true});
        this._renderObjects({...params, isMinimap: true});
        this._renderMarbles({...params, isMinimap: true});
        this._ctx.restore();
    }

    private _renderRanking({winners, marbles, winnerRank}: RenderParameters) {
        const lineWidth = 100;
        const totalCount = winners.length + marbles.length;
        const fontHeight = 16;
        const lineHeight = (this._canvas.height - 20);

        const lines = Math.ceil((totalCount * fontHeight) / lineHeight);
        const perLine = Math.ceil((winners.length + marbles.length) / lines);
        const startX = this._canvas.width - 5 - ((lines - 1) * lineWidth);

        this._ctx.save();
        this._ctx.font = 'bold 11pt sans-serif';
        this._ctx.textAlign = 'right';
        winners.forEach((marble, rank) => {
            this._ctx.fillStyle = marble.color;
            const line = Math.floor(rank / perLine);
            const y = (rank % perLine) * fontHeight;

            this._ctx.fillText(`${rank === winnerRank ? '☆':'\u2714'} ${marble.name} #${rank + 1}`, startX + line * lineWidth, 20 + y);
        });
        this._ctx.font = '10pt sans-serif';
        marbles.forEach((marble, rank) => {
            this._ctx.fillStyle = marble.color;
            const y = ((rank + winners.length) % perLine) * fontHeight;
            this._ctx.fillText(`${marble.name} #${rank + 1 + winners.length}`, startX + Math.floor((rank + winners.length) / perLine) * lineWidth, 20 + y);
        });
        this._ctx.restore();
    }

    private _renderWinner({winners, winnerRank}: RenderParameters) {
        if (winners.length <= winnerRank) return;
        this._ctx.save();
        this._ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this._ctx.fillRect(this._canvas.width / 2, this._canvas.height - 168, this._canvas.width / 2, 168);
        this._ctx.fillStyle = 'white';
        this._ctx.font = 'bold 48px sans-serif';
        this._ctx.textAlign = 'right';
        this._ctx.fillText('Winner', this._canvas.width - 10, this._canvas.height - 120);
        this._ctx.font = 'bold 72px sans-serif';
        this._ctx.fillStyle = winners[winnerRank].color;
        this._ctx.fillText(winners[winnerRank].name, this._canvas.width - 10, this._canvas.height - 55);
        this._ctx.restore();
    }
}
