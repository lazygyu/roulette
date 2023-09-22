import {RenderParameters} from './rouletteRenderer';
import {initialZoom} from './data/constants';

export class Minimap {
    private ctx!: CanvasRenderingContext2D;
    constructor() {
    }

    render(ctx: CanvasRenderingContext2D, params: RenderParameters) {
        if (!ctx) return;
        const {stage} = params;
        if (!stage) return;

        this.ctx = ctx;
        ctx.save();
        ctx.fillStyle = '#333';
        ctx.translate(10, 10);
        ctx.scale(4, 4);
        ctx.fillRect(0, 0, 26, stage.goalY);

        this.drawWalls(params);
        this.drawObjects(params);
        this.drawMarbles(params);
        this.drawViewport(params);

        ctx.restore();
    }

    private drawViewport(params: RenderParameters) {
        this.ctx.save();
        const {camera, size} = params;
        const zoom = (camera.zoom * initialZoom);
        const w = size.x / zoom;
        const h = size.y / zoom;
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 1 / zoom;
        this.ctx.strokeRect(camera.x - w/2, camera.y - h/2,  w,  h);
        this.ctx.restore();
    }

    private drawWalls(params: RenderParameters) {
        if (!params.stage) return;
        this.ctx.save();
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 0.5;
        this.ctx.beginPath();
        params.stage.walls.forEach((wallDef) => {
            this.ctx.moveTo(wallDef[0][0], wallDef[0][1]);
            for (let i = 1; i < wallDef.length; i++) {
                this.ctx.lineTo(wallDef[i][0], wallDef[i][1]);
            }
        });
        this.ctx.stroke();
        this.ctx.closePath();
        this.ctx.restore();
    }

    private drawObjects(params: RenderParameters) {
        const {objects} = params;
        if (!objects) return;
        this.ctx.save();
        this.ctx.fillStyle = 'black';
        this.ctx.lineWidth = 1;
        objects.forEach(obj => {
            this.ctx.save();
            const pos = obj.getPosition();
            const ang = obj.getAngle();
            this.ctx.translate(pos.x, pos.y);
            this.ctx.rotate(ang);
            for(let fixture = obj.getFixtureList(); fixture; fixture = fixture.getNext()) {
                const shape = fixture.getShape() as planck.Polygon;
                this.ctx.beginPath();
                if (shape.getType() === 'circle') {
                    this.ctx.strokeStyle = 'yellow';
                    this.ctx.arc(0, 0, shape.m_radius, 0, Math.PI * 2);
                } else {
                    this.ctx.strokeStyle = '#94d5ed';
                    const vertices = shape.m_vertices;
                    this.ctx.moveTo(vertices[0].x, vertices[0].y);
                    for (let i = 1; i < vertices.length; i++) {
                        const vertex = vertices[i];
                        this.ctx.lineTo(vertex.x, vertex.y);
                    }
                    this.ctx.closePath();
                }
                this.ctx.fill();
                this.ctx.closePath();
            }
            this.ctx.restore();
        });
        this.ctx.restore();
    }

    private drawMarbles(params: RenderParameters) {
        const {marbles, winners, winnerRank} = params;
        const winnerIndex = winnerRank - winners.length;
        marbles.forEach((marble, i) => {
            marble.render(this.ctx, 1, i === winnerIndex, true);
        });
    }
}
