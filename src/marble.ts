import * as planck from 'planck';
import {Skills} from './constants';
import {rad} from './utils';
import options from './options';

export class Marble {
    type: 'marble' = 'marble';
    name: string = '';
    size: number = 0.5;
    color: string = 'red';
    hue: number = 0;
    impact: number = 0;
    skill: Skills = Skills.None;

    private _skillRate = 0.0005;
    private _coolTime = 5000;
    private _maxCoolTime = 5000;

    get position() {
        return this.body.getPosition();
    }

    get x() {
        return this.position.x;
    }

    set x(v: number) {
        this.position.x = v;
    }

    get y() {
        return this.position.y;
    }

    set y(v: number) {
        this.position.y = v;
    }

    body: planck.Body;

    constructor(world: planck.World, order: number, max: number, name?: string) {
        this.name = name || `M${order}`;
        this.body = world.createBody({
            type: 'dynamic',
            allowSleep: false,
            awake: true,
            active: false,
            linearDamping: 0,
            angularDamping: 0.01,
			linearVelocity: new planck.Vec2(0, 0.0),
        });

        const maxLine = Math.ceil(max / 10);
        const line = Math.floor(order / 10);
        this.hue = 360 / max * order;
        this.color = `hsl(${this.hue} 100% 70%)`;

        const circle = planck.Circle(new planck.Vec2(0, 0), this.size / 2);
        this.body.createFixture({shape: circle, density: Math.random() + 1, restitution: 0.2});
        this.body.setPosition(new planck.Vec2(10.25 + ((order % 10) * 0.6), (maxLine * 1.1) - (line * 1.1)));
        this.body.setUserData(this);
    }

    update(deltaTime: number) {
        this.skill = Skills.None;
        if (this.impact) {
            this.impact = Math.max(0, this.impact - deltaTime);
        }
        if (!this.body.isActive()) return;
        if (options.useSkills) {
            this._updateSkillInformation(deltaTime);
        }
    }

    private _updateSkillInformation(deltaTime: number) {
        if (this._coolTime > 0) {
            this._coolTime -= deltaTime;
        }

        if (this._coolTime <= 0 && Math.random() < this._skillRate) {
            this.skill = Skills.Impact;
            this._coolTime = this._maxCoolTime;
        }
    }

    render(ctx: CanvasRenderingContext2D, zoom: number, isMinimap: boolean = false) {
        ctx.save();

        if (!isMinimap) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = zoom / 2;
            ctx.fillStyle = `hsl(${this.hue} 100% ${70 + (25 * Math.min(1, this.impact / 500))}%`;
        } else {
            ctx.fillStyle = this.color;
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, isMinimap ? this.size : this.size / 2, 0, Math.PI * 2);
        ctx.fill();

        if (!isMinimap) {
            ctx.save();
            ctx.translate(this.x, this.y+0.25);
            ctx.scale(1/zoom, 1/zoom);
            ctx.font = `12pt sans-serif`;
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 0;
            ctx.strokeText(this.name, 0, 0);
            ctx.fillText(this.name, 0, 0);
            ctx.restore();

            if (options.useSkills) {
                this._renderCooltime(ctx, zoom);
            }
        }
        ctx.restore();
    }

    private _renderCooltime(ctx: CanvasRenderingContext2D, zoom: number) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2 + (2 / zoom), rad(270), rad(270 + 360 * this._coolTime / this._maxCoolTime));
        ctx.stroke();
    }
}
