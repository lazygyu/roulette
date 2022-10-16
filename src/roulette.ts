import * as planck from 'planck';
import {Marble} from './marble';
import {zoomThreshold} from './constants';
import {ParticleManager} from './particleManager';
import {StageDef, stages} from './maps';
import {createBox, createJumper, createMover} from './utils';
import {Camera} from './camera';
import {RouletteRenderer} from './rouletteRenderer';

export class Roulette extends EventTarget {
    private _update: () => void;
    private _world!: planck.World;
    private _marbles: Marble[] = [];

    private _lastTime: number = 0;
    private _elapsed: number = 0;

    private _updateInterval = 10;
    private _timeScale = 1;

    private _winners: Marble[] = [];
    private _objects: planck.Body[] = [];
    private _particleManager = new ParticleManager();
    private _stage: StageDef | null = null;

    private _camera: Camera = new Camera();
    private _renderer: RouletteRenderer = new RouletteRenderer();

    constructor() {
        super();
        this._update = this._updateHandler.bind(this);

        this._renderer.init();

        this._init();
        this._update();
    }


    private _updateHandler() {
        if (!this._lastTime) this._lastTime = Date.now();
        const currentTime = Date.now();

        this._elapsed += currentTime - this._lastTime;
        this._lastTime = currentTime;

        while (this._elapsed >= this._updateInterval) {
            this._world.step((this._updateInterval * this._timeScale) / 1000);
            this._updateMarbles(this._updateInterval);
            this._particleManager.update(this._updateInterval);
            this._elapsed -= this._updateInterval;
        }

        if (this._marbles.length > 1) {
            this._marbles.sort((a, b) => b.y - a.y);
        }

        if (this._stage) {
            this._camera.update({marbles: this._marbles, stage: this._stage, needToZoom: !this._winners.length});
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
                    this._particleManager.shot(this._renderer.width, this._renderer.height);
                }
                setTimeout(() => {
                    this._world.destroyBody(marble.body);
                }, 500);
            }
        }

        const topY = this._marbles[0] ? this._marbles[0].y : 0;
        const goalDist = Math.abs(this._stage.zoomY - topY);
        if (this._winners.length === 0 && goalDist < zoomThreshold) {
            if (this._marbles[1] && this._marbles[1].y > this._stage.zoomY - (zoomThreshold*1.2)) {
                this._timeScale = Math.max(0.2, (goalDist / zoomThreshold));
            } else {
                this._timeScale = 1;
            }
        } else {
            this._timeScale = 1;
        }

        this._marbles = this._marbles.filter(marble => marble.y <= this._stage!.goalY);
    }

    private _render() {
        if (!this._stage) return;
        this._renderer.render({
            camera: this._camera,
            stage: this._stage,
            objects: this._objects,
            marbles: this._marbles,
            winners: this._winners,
            particleManager: this._particleManager,
        });
    }

    private _init() {
        this._world = new planck.World({
            gravity: new planck.Vec2(0, 10),
        });

        this._loadMap();
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
        this._marbles.forEach(marble => marble.body.setActive(true));
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
    }
}
