import * as planck from 'planck';
import {rad} from './utils/utils';

const lifetime = 3000;

export class Particle {
    private _elapsed: number = 0;
    position: planck.Vec2 = new planck.Vec2();
    force: planck.Vec2 = new planck.Vec2();
    color: string = '';
    isDestroy: boolean = false;

    constructor(x: number, y: number) {
        this.position = new planck.Vec2(x, y);

        const force = Math.random() * 250;
        const ang = rad((90 * Math.random()) - 180);
        const fx = Math.cos(ang) * force;
        const fy = Math.sin(ang) * force;
        this.color = `hsl(${Math.random() * 360} 50% 50%)`;
        this.force.set(fx, fy);
    }

    update(deltaTime: number) {
        this._elapsed += deltaTime;
        const delta = this.force.clone().mul(deltaTime / 100);
        this.position.add(delta);
        this.force.y += 10 * deltaTime / 100;
        if (this._elapsed > lifetime) {
            this.isDestroy = true;
        }
    }

    render(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalAlpha = 1 - Math.pow(this._elapsed / lifetime, 2);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.position.x, this.position.y, 20, 20);
        ctx.restore();
    }
}
