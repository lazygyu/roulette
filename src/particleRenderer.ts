import {Particle} from './particle';

export class ParticleRenderer {
    private _particles: Particle[] = [];

    update(deltaTime: number, maxY: number) {
        this._particles.forEach(particle => {
            particle.update(deltaTime);
        });
        this._particles = this._particles.filter(particle => particle.position.y < maxY + 20);
    }

    render(ctx: CanvasRenderingContext2D) {
        this._particles.forEach(particle => particle.render(ctx));
    }

    shot(x: number, y: number) {
        for (let i = 0; i < 200; i++) {
            this._particles.push(new Particle(x, y));
        }
        console.log('shot: ', this._particles.length);
    }
}
