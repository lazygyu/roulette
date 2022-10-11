import * as planck from 'planck';

function rad(degree: number) {
	return Math.PI * degree / 180;
}

export class Particle {
    position: planck.Vec2 = new planck.Vec2();
    force: planck.Vec2 = new planck.Vec2();
    color: string = '';

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
        const delta = this.force.clone().mul(deltaTime / 100);
        this.position.add(delta);
        this.force.y += 10 * deltaTime / 100;
    }

    render(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.fillRect(this.position.x, this.position.y, 20, 20);
        ctx.restore();
    }
}
