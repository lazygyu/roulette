import * as planck from 'planck';
import {Marble} from './marble';
import {canvasHeight, canvasWidth, initialZoom} from './constants';
import {ParticleRenderer} from './particleRenderer';
import {StageDef, stages} from './wallDefs';
import {createBox, createJumper, createMover} from './utils';

export class Roulette extends EventTarget {
    private _update: () => void;
    private _world!: planck.World;

    private _marbles: Marble[] = [];

    private _lastTime: number = 0;
    private _elapsed: number = 0;

    private _updateInterval = 10;
    private _timeScale = 1;

    private _canvas!: HTMLCanvasElement;
    private _ctx!: CanvasRenderingContext2D;

    private _winners: Marble[] = [];

    private _zoom = initialZoom;

    private _camera: planck.Vec2 = new planck.Vec2();
    private _cameraTarget: planck.Vec2 = new planck.Vec2();

    private _objects: planck.Body[] = [];

    private _isStarted = false;
    private _particles = new ParticleRenderer();

    private _stage: StageDef | null = null;

    constructor() {
        super();
        this._update = this._updateHandler.bind(this);

        this._createElements();

        this._init();
        this._update();
    }

    private _createElements() {
        this._canvas = document.createElement('canvas');
        this._canvas.width = canvasWidth;
        this._canvas.height = canvasHeight;
        this._ctx = this._canvas.getContext('2d') as CanvasRenderingContext2D;
        document.body.appendChild(this._canvas);

        const realSize = this._canvas.getBoundingClientRect();
        this._canvas.width = realSize.width;
        this._canvas.height = realSize.height;
    }

    private _updateHandler() {
        if (!this._lastTime) this._lastTime = Date.now();
        const currentTime = Date.now();

        this._elapsed += currentTime - this._lastTime;
        this._lastTime = currentTime;

        while (this._elapsed >= this._updateInterval) {
            if (this._isStarted) {
                this._world.step((this._updateInterval * this._timeScale) / 1000);
                this._updateMarbles(this._updateInterval);
            }
            this._particles.update(this._updateInterval);
            this._elapsed -= this._updateInterval;
        }

        if (this._marbles.length === 0) {
            this._isStarted = false;
        }
        if (this._marbles.length > 1) {
            this._marbles.sort((a, b) => b.y - a.y);
        }
        this._render();
        window.requestAnimationFrame(this._update);
    }

    private _updateMarbles(deltaTime: number) {
        if (!this._stage) return;

        for (let contact = this._world.getContactList(); contact; contact = contact.getNext()) {
            if (!contact.isTouching()) continue;
            let fixtures = [contact.getFixtureA(), contact.getFixtureB()];
            fixtures.forEach(fixture => {
                const body = fixture.getBody();
                const userData = body.getUserData() as any;
                if (userData) {
                    if (userData instanceof Marble) {
                        userData.impact += 200;
                        if (userData.impact > 500) userData.impact = 500;
                    } else if ('isTemporary' in userData && userData.isTemporary) {
                        this._world.destroyBody(body);
                        this._objects = this._objects.filter(obj => obj !== body);
                    }
                }
            });
        }

        for (let i = 0; i < this._marbles.length; i++) {
            const marble = this._marbles[i];
            marble.update(deltaTime);
            if (marble.y > this._stage.goalY) {
                this._winners.push(marble);
                if (this._winners.length === 1) {
                    this.dispatchEvent(new CustomEvent('goal', {detail: {winner: marble.name}}));
                    this._particles.shot(this._canvas.width, this._canvas.height);
                }
                setTimeout(() => {
                    this._world.destroyBody(marble.body);
                }, 500);
            }
        }

        const topY = this._marbles[0] ? this._marbles[0].y : 0;
        const goalDist = Math.abs(this._stage.zoomY - topY);
        const ratio = 5;
        if (this._winners.length === 0 && goalDist < ratio) {
            if (this._marbles[1] && this._marbles[1].y > this._stage.zoomY - (ratio*1.2)) {
                this._timeScale = Math.max(0.2, (goalDist / ratio));
            } else {
                this._timeScale = 1;
            }
            this._zoom = initialZoom + ((1 - (goalDist / ratio)) * 50);
        } else {
            this._timeScale = 1;
            this._zoom = initialZoom;
        }

        this._marbles = this._marbles.filter(marble => marble.y <= this._stage!.goalY);
    }

    private _render() {

        this._ctx.fillStyle = 'black';
        this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);

        this._ctx.save();

        this._ctx.textAlign = 'left';
        this._ctx.textBaseline = 'top';
        this._ctx.font = '0.4pt sans-serif';

        this._moveCamera();

        this._renderWalls();
        this._renderObjects();
        this._renderMarbles();

        this._ctx.restore();

        this._renderMinimap();

        this._renderRanking();

        this._renderWinner();

        this._particles.render(this._ctx);
    }

    private _moveCamera() {
        this._cameraTarget.x = -(this._marbles[0] ? this._marbles[0].x : 0);
        this._cameraTarget.y = (this._marbles[0] ? -this._marbles[0].y : 0);

        const xDist = (this._cameraTarget.x - this._camera.x);
        const yDist = (this._cameraTarget.y - this._camera.y);
        const xFactor = (xDist / 5);
        const yFactor = (yDist / 5);

        if (Math.abs(xDist * this._zoom) > 3) {
            this._camera.x += xFactor;
        } else {
            this._camera.x = this._cameraTarget.x;
        }

        if (Math.abs(yDist * this._zoom) > 10) {
            this._camera.y += yFactor;
        } else {
            this._camera.y = this._cameraTarget.y;
        }
        this._ctx.translate(this._camera.x * this._zoom + (this._canvas.width / 2), this._camera.y * this._zoom + (this._canvas.height / 2));
        this._ctx.scale(this._zoom, this._zoom);
    }

    private _renderWalls(isMinimap: boolean = false) {
        if (!this._stage) return;
        this._ctx.save();
        this._ctx.strokeStyle = isMinimap ? 'black' : 'white';
        this._ctx.lineWidth = isMinimap ? 0.5 : 5 / this._zoom;
        this._ctx.beginPath();
        this._stage.walls.forEach((wallDef) => {
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

    private _renderObjects(isMinimap: boolean = false) {
        this._ctx.save();
        this._ctx.fillStyle = 'black';
        this._ctx.lineWidth = 3 / this._zoom;
        this._objects.forEach(obj => {
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
                        this._ctx.strokeStyle = '#fb4934';
                        this._ctx.arc(0, 0, shape.m_radius, 0, Math.PI * 2);
                        break;
                    default:
                        this._ctx.strokeStyle = '#94d5ed';
                        const vertices = shape.m_vertices;
                        this._ctx.moveTo(vertices[0].x, vertices[0].y);
                        for (let i = 0; i < vertices.length; i++) {
                            const vert = vertices[(i + 1) % vertices.length];
                            this._ctx.lineTo(vert.x, vert.y);
                        }
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

    private _renderMarbles(isMinimap: boolean = false) {
        this._marbles.forEach(marble => {
            marble.render(this._ctx, this._zoom, isMinimap);
        });
    }

    private _renderMinimap() {
        if (!this._stage) return;
        if (this._canvas.width < this._canvas.height) return;
        this._ctx.save();
        this._ctx.fillStyle = `#333`;
        this._ctx.translate(10, 10);
        this._ctx.scale(4, 4);
        this._ctx.fillRect(0, 0, 26, this._stage.goalY);
        this._renderWalls(true);
        this._renderObjects(true);
        this._renderMarbles(true);
        this._ctx.restore();
    }

    private _init() {
        this._world = new planck.World({
            gravity: new planck.Vec2(0, 10),
        });

        this._loadMap();
    }

    private _renderRanking() {
        this._ctx.save();
        this._ctx.font = 'bold 11pt sans-serif';
        this._ctx.textAlign = 'right';
        this._winners.forEach((marble, rank) => {
            this._ctx.fillStyle = marble.color;
            this._ctx.fillText(`\u2714 ${marble.name} #${rank + 1}`, this._canvas.width - 10, 20 + rank * 16);
        });
        this._ctx.font = '10pt sans-serif';
        this._marbles.forEach((marble, rank) => {
            this._ctx.fillStyle = marble.color;
            this._ctx.fillText(`${marble.name} #${rank + 1 + this._winners.length}`, this._canvas.width - 10, 20 + (rank + this._winners.length) * 16);
        });
        this._ctx.restore();
    }

    private _renderWinner() {
        if (this._winners.length === 0) return;
        this._ctx.save();
        this._ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this._ctx.fillRect(this._canvas.width / 2, this._canvas.height - 168, this._canvas.width / 2, 168);
        this._ctx.fillStyle = 'white';
        this._ctx.font = 'bold 48px sans-serif';
        this._ctx.textAlign = 'right';
        this._ctx.fillText('Winner', this._canvas.width - 10, this._canvas.height - 120);
        this._ctx.font = 'bold 72px sans-serif';
        this._ctx.fillStyle = (Math.floor(this._lastTime / 500) % 2) === 0 ? this._winners[0].color : 'white';
        this._ctx.fillText(this._winners[0].name, this._canvas.width - 10, this._canvas.height - 55);
        this._ctx.restore();
    }

    private _loadMap() {
        this._stage = stages[Math.floor(Math.random() * stages.length)];
        const {walls, boxes, wheels, jumpers} = this._stage;
        walls.forEach((wallDef) => {
            const wall = this._world.createBody({type: 'static'});
            wall.setPosition(new planck.Vec2(0, 0));
            wall.createFixture({
                shape: planck.Chain(wallDef.map(pos => new planck.Vec2(...pos)), false),
            });
        });

        wheels.forEach((wheelDef) => {
           this._objects.push(createMover(this._world, new planck.Vec2(wheelDef[0], wheelDef[1]), wheelDef[2], (wheelDef[3] !== undefined && wheelDef[4] !== undefined) ? new planck.Vec2(wheelDef[3], wheelDef[4]) : undefined, wheelDef[5] ?? undefined));
        });

        boxes.forEach(boxDef => {
            this._objects.push(createBox(this._world, new planck.Vec2(boxDef[0], boxDef[1]), boxDef[2], boxDef[3], boxDef[4]));
        });

        if (jumpers) {
            jumpers.forEach(jumperDef => {
                this._objects.push(createJumper(this._world, new planck.Vec2(jumperDef[0], jumperDef[1]), jumperDef[2], jumperDef[3]));
            });
        }
    }

    public clearMarbles() {
        this._marbles.forEach(marble => {
            this._world.destroyBody(marble.body);
        });
        this._winners = [];
        this._marbles = [];
    }

    public start() {
        this._isStarted = true;
    }

    public setMarbles(names: string[]) {
        this.reset();
        const arr = names.slice();
        if (arr.length > 0) {
            arr.sort(() => Math.random() - 0.5);
        }
        arr.forEach((name, i) => {
            this._marbles.push(new Marble(this._world, i, arr.length, name));
        });
    }

    private _clearMap() {
        for(let body = this._world.getBodyList(); body; body = body.getNext()) {
            this._world.destroyBody(body);
        }
        this._objects = [];
        this._marbles = [];
    }

    public reset() {
        this.clearMarbles();
        this._clearMap();
        this._loadMap();
        this._isStarted = false;
    }
}
