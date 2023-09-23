import * as planck from 'planck';
import {Marble} from './marble';
import {initialZoom, Skills, zoomThreshold} from './data/constants';
import {ParticleManager} from './particleManager';
import {StageDef, stages} from './data/maps';
import { createBox, createJumper, createMover, parseName } from './utils/utils';
import {Camera} from './camera';
import {RouletteRenderer} from './rouletteRenderer';
import {SkillEffect} from './skillEffect';
import {GameObject} from './gameObject';
import options from './options';
import { bound } from './utils/bound.decorator';
import {Vec2} from 'planck';
import { UIObject } from './UIObject';
import { RankRenderer } from './rankRenderer';
import {Minimap} from './minimap';

export class Roulette extends EventTarget {
    private _world!: planck.World;
    private _marbles: Marble[] = [];

    private _lastTime: number = 0;
    private _elapsed: number = 0;
    private _noMoveDuration: number = 0;
    private _shakeAvailable: boolean = false;

    private _updateInterval = 10;
    private _timeScale = 1;
    private _speed = 1;

    private _winners: Marble[] = [];
    private _objects: planck.Body[] = [];
    private _stageObjects: planck.Body[] = [];
    private _particleManager = new ParticleManager();
    private _stage: StageDef | null = null;

    private _camera: Camera = new Camera();
    private _renderer: RouletteRenderer = new RouletteRenderer();

    private _effects: GameObject[] = [];

    private _winnerRank = 0;
    private _totalMarbleCount = 0;
    private _goalDist: number = Infinity;
    private _isRunning: boolean = false;
    private _winner: Marble | null = null;

    private _uiObjects: UIObject[] = [];

    constructor() {
        super();
        this._renderer.init();
        this._init();
        this._update();
    }

    public getZoom() {
        return initialZoom * this._camera.zoom;
    }

    private addUiObject(obj: UIObject) {
        this._uiObjects.push(obj);
        if (obj.onWheel) {
            this._renderer.canvas.addEventListener('wheel', obj.onWheel);
        }
    }

    @bound
    private _update() {
        if (!this._lastTime) this._lastTime = Date.now();
        const currentTime = Date.now();

        this._elapsed += (currentTime - this._lastTime) * this._speed;
        if (this._elapsed > 100) {
            this._elapsed %= 100;
        }
        this._lastTime = currentTime;

        const interval = this._updateInterval / 1000 * this._timeScale;

        while (this._elapsed >= this._updateInterval) {
            this._world.step(interval);
            this._updateMarbles(this._updateInterval);
            this._particleManager.update(this._updateInterval);
            this._updateEffects(this._updateInterval);
            this._elapsed -= this._updateInterval;
            this._uiObjects.forEach(obj => obj.update(this._updateInterval));
        }

        if (this._marbles.length > 1) {
            this._marbles.sort((a, b) => b.y - a.y);
        }


        if (this._stage) {
            this._camera.update({
                marbles: this._marbles,
                stage: this._stage,
                needToZoom: this._goalDist < zoomThreshold,
                targetIndex: this._winners.length > 0 ? this._winnerRank - this._winners.length : 0,
            });

            if (this._isRunning && this._marbles.length > 0 && this._noMoveDuration > 3000) {
                this._changeShakeAvailable(true);
            } else {
                this._changeShakeAvailable(false);
            }
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
            if (marble.skill === Skills.Impact) {
                this._effects.push(new SkillEffect(marble.x, marble.y));
                this._marbles
                    .filter(target => target !== marble && target.position.clone().sub(marble.position).lengthSquared() < 100)
                    .forEach(target => {
                        const v = target.position.clone().sub(marble.position);
                        const norm = v.clone(); norm.normalize();
                        const power = (1-(v.length()/10));
                        norm.mul(power * power * 5);
                        target.body.applyLinearImpulse(norm, marble.position);
                    });
            }
            if (marble.y > this._stage.goalY) {
                this._winners.push(marble);
                if (this._isRunning && this._winners.length === this._winnerRank + 1) {
                    this.dispatchEvent(new CustomEvent('goal', {detail: {winner: marble.name}}));
                    this._winner = marble;
                    this._isRunning = false;
                    this._particleManager.shot(this._renderer.width, this._renderer.height);
                } else if (this._isRunning && this._winnerRank === this._winners.length && this._winnerRank === this._totalMarbleCount - 1) {
                    this.dispatchEvent(new CustomEvent('goal', {detail: {winner: this._marbles[i + 1].name}}));
                    this._winner = this._marbles[i+1];
                    this._isRunning = false;
                    this._particleManager.shot(this._renderer.width, this._renderer.height);
                }
                setTimeout(() => {
                    this._world.destroyBody(marble.body);
                }, 500);
            }
        }

        const targetIndex = this._winnerRank - this._winners.length;
        const topY = this._marbles[targetIndex] ? this._marbles[targetIndex].y : 0;
        this._goalDist = Math.abs(this._stage.zoomY - topY);
        this._timeScale = this._calcTimeScale();

        this._marbles = this._marbles.filter(marble => marble.y <= this._stage!.goalY);
        const maximumForce = this._marbles.reduce((p, c) => Math.max(p, c.body.getLinearVelocity().length()), 0);
        if (maximumForce < 0.1) {
            this._noMoveDuration += deltaTime;
        } else {
            this._noMoveDuration = 0;
        }
    }

    private _calcTimeScale(): number {
        if (!this._stage) return 1;
        const targetIndex = this._winnerRank - this._winners.length;
        if (this._winners.length < this._winnerRank + 1 && this._goalDist < zoomThreshold) {
            if ( this._marbles[targetIndex].y > this._stage.zoomY - (zoomThreshold*1.2) &&
                (this._marbles[targetIndex - 1] || this._marbles[targetIndex + 1])
            ) {
                return Math.max(0.2, (this._goalDist / zoomThreshold));
            }
        }
        return 1;
    }

    private _updateEffects(deltaTime: number) {
        this._effects.forEach(effect => effect.update(deltaTime));
        this._effects = this._effects.filter(effect => !effect.isDestroy)
    }

    private _render() {
        if (!this._stage) return;
        const renderParams = {
            camera: this._camera,
            stage: this._stage,
            objects: this._objects,
            marbles: this._marbles,
            winners: this._winners,
            particleManager: this._particleManager,
            effects: this._effects,
            winnerRank: this._winnerRank,
            winner: this._winner,
            size: Vec2(this._renderer.width, this._renderer.height),
        };
        this._renderer.render(renderParams, this._uiObjects);
    }

    private _init() {
        this._world = new planck.World({
            gravity: new planck.Vec2(0, 10),
        });

        this.addUiObject(new RankRenderer());
        this.attachEvent();
        const minimap = new Minimap();
        minimap.onViewportChange((pos) => {
            if (pos) {
                this._camera.setPosition(pos, false);
                this._camera.lock(true);
            } else {
                this._camera.lock(false);
            }
        });
        this.addUiObject(minimap);
        this._loadMap();
    }

    private attachEvent() {
        this._renderer.canvas.addEventListener('mousemove', (e) => {
            const sizeFactor = this._renderer.sizeFactor;
            const pos = {x: e.offsetX * sizeFactor , y: e.offsetY * sizeFactor};
            this._uiObjects.forEach((obj) => {
                if (!obj.onMouseMove) return;
                const bounds = obj.getBoundingBox();
                if (!bounds) {
                    obj.onMouseMove({...pos});
                } else if (bounds && pos.x >= bounds.x && pos.y >= bounds.y && pos.x <= bounds.x + bounds.w && pos.y <= bounds.y + bounds.h) {
                    obj.onMouseMove({x: pos.x - bounds.x, y: pos.y - bounds.y});
                } else {
                    obj.onMouseMove(undefined);
                }
            });
        });
    }

    private _loadMap() {
        this._stage = stages[Math.floor(Math.random() * stages.length)];
        this._stageObjects = [];
        const {walls, boxes, wheels, jumpers} = this._stage;
        walls.forEach((wallDef) => {
            const wall = this._world.createBody({type: 'static'});
            wall.setPosition(new planck.Vec2(0, 0));
            wall.createFixture({
                shape: planck.Chain(wallDef.map(pos => new planck.Vec2(...pos)), false),
            });
            this._stageObjects.push(wall);
        });

        wheels.forEach((wheelDef) => {
            const item = createMover(this._world, new planck.Vec2(wheelDef[0], wheelDef[1]), wheelDef[2], (wheelDef[3] !== undefined && wheelDef[4] !== undefined) ? new planck.Vec2(wheelDef[3], wheelDef[4]) : undefined, wheelDef[5] ?? undefined);
            this._objects.push(item);
            this._stageObjects.push(item);
        });

        boxes.forEach(boxDef => {
            const item = createBox(this._world, new planck.Vec2(boxDef[0], boxDef[1]), boxDef[2], boxDef[3], boxDef[4]);
            this._objects.push(item);
            this._stageObjects.push(item);
        });

        if (jumpers) {
            jumpers.forEach(jumperDef => {
                const item = createJumper(this._world, new planck.Vec2(jumperDef[0], jumperDef[1]), jumperDef[2], jumperDef[3]);
                this._objects.push(item);
                this._stageObjects.push(item);
            });
        }
    }

    public clearMarbles() {
        this._marbles.forEach(marble => {
            this._world.destroyBody(marble.body);
        });
        this._winner = null;
        this._winners = [];
        this._marbles = [];
    }

    public start() {
        this._isRunning = true;
        this._winnerRank = options.winningRank;
        if (this._winnerRank >= this._marbles.length) {
            this._winnerRank = this._marbles.length - 1;
        }
        this._marbles.forEach(marble => marble.body.setActive(true));
    }

    public setSpeed(value: number) {
        if (value <= 0) {
            throw new Error('Speed multiplier must larger than 0');
        }
        this._speed = value;
    }

    public getSpeed() {
        return this._speed;
    }

    public setWinningRank(rank: number) {
        this._winnerRank = rank;
    }

    public setMarbles(names: string[]) {
        this.reset();
        const arr = names.slice();


        let maxWeight = -Infinity;
        let minWeight = Infinity;

        const members = arr.map(nameString => {
            const result =  parseName(nameString);
            if (!result) return null;
            const { name, weight, count } = result;
            if (weight > maxWeight) maxWeight = weight;
            if (weight < minWeight) minWeight = weight;
            return {name, weight, count};
        }).filter(member => !!member);

        const gap = maxWeight - minWeight;

        let totalCount = 0;
        members.forEach(member => {
            if (member) {
                member.weight = 0.1 + (gap ? (member.weight - minWeight) / gap : 0);
                totalCount += member.count;
            }
        });

        const orders = Array(totalCount).fill(0).map((_, i) => i).sort(() => Math.random() - 0.5);
        members.forEach((member) => {
            if (member) {
                for (let j = 0; j < member.count; j++) {
                    const order = orders.pop() || 0;
                    this._marbles.push(new Marble(this._world, order, totalCount, member.name, member.weight));
                }
            }
        });
        this._totalMarbleCount = totalCount;
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
        this._goalDist = Infinity;
    }

    public getCount() {
        return this._marbles.length;
    }

    private _changeShakeAvailable(v: boolean) {
        if (this._shakeAvailable !== v) {
            this._shakeAvailable = v;
            this.dispatchEvent(new CustomEvent('shakeAvailableChanged', {detail: v}));
        }
    }

    public shake() {
        if (!this._shakeAvailable) return;
        const xPower = (Math.random() - 0.5) * 4;
        const yPower = (Math.random() - 0.5) * 4;
        const power = new Vec2(xPower, yPower);
        this._stageObjects.forEach(obj => {
            let contact = obj.getContactList();
            while(contact) {
                if (contact.other) {
                    contact.other.applyLinearImpulse(power, contact.other.getPosition());
                }
                contact = contact.next || null;
            }
        });
        this._camera.setPosition(this._camera.position.add(power));
    }
}
