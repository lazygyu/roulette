import {RenderParameters} from './rouletteRenderer';
import {initialZoom} from './data/constants';
import {UIObject} from './UIObject';
import {bound} from './utils/bound.decorator';
import { Rect } from './types/rect.type';
import {WheelState} from './types/WheelState';
import {BoxState} from './types/BoxState';
import {JumperState} from './types/JumperState';
import {VectorLike} from './types/VectorLike';

export class Minimap implements UIObject {
    private ctx!: CanvasRenderingContext2D;
    private lastParams: RenderParameters | null = null;

    private _onViewportChangeHandler: ((pos?: VectorLike) => void) | null = null;
    private boundingBox: Rect;
    private mousePosition: {x: number, y: number} | null = null;

    constructor() {
        this.boundingBox = {
            x: 10,
            y: 10,
            w: 26 * 4,
            h: 0,
        };
    }

    getBoundingBox(): Rect | null {
        return this.boundingBox;
    }

    onViewportChange(callback: (pos?: VectorLike) => void) {
        this._onViewportChangeHandler = callback;
    }

    update(deltaTime: number): void {
        // nothing to do
    }

    @bound
    onMouseMove(e?: { x: number; y: number; }) {
        if (!e) {
            this.mousePosition = null;
            if (this._onViewportChangeHandler) {
                this._onViewportChangeHandler();
            }
            return;
        }
        if (!this.lastParams) return;
        this.mousePosition = {
            x: e.x,
            y: e.y,
        };
        if (this._onViewportChangeHandler) {
            this._onViewportChangeHandler({ x: this.mousePosition.x / 4, y: this.mousePosition.y / 4});
        }
    }

    render(ctx: CanvasRenderingContext2D, params: RenderParameters) {
        if (!ctx) return;
        const {stage} = params;
        if (!stage) return;
        this.boundingBox.h = stage.goalY * 4;

        this.lastParams = params;

        this.ctx = ctx;
        ctx.save();
        ctx.fillStyle = '#333';
        ctx.translate(10, 10);
        ctx.scale(4, 4);
        ctx.fillRect(0, 0, 26, stage.goalY);

        this.ctx.lineWidth = 3 / (params.camera.zoom + initialZoom);
        this.drawWalls(params);
        this.drawWheels(params.wheels);
        this.drawBoxes(params.boxes);
        this.drawJumpers(params.jumpers);
        this.drawMarbles(params);
        this.drawViewport(params);

        ctx.restore();
        ctx.save();
        ctx.strokeStyle = 'green';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.boundingBox.x, this.boundingBox.y, this.boundingBox.w, this.boundingBox.h);
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

    private drawWheels(wheels: WheelState[]) {
        this.ctx.save();
        this.ctx.fillStyle = '#94d5ed';
        wheels.forEach((wheel) => {
            this.ctx.save();
            this.ctx.translate(wheel.x, wheel.y);
            this.ctx.rotate(wheel.angle);
            this.ctx.fillRect(-wheel.size, -0.05, wheel.size * 2, 0.1);
            this.ctx.restore();
        });
        this.ctx.restore();
    }

    private drawBoxes(boxes: BoxState[]) {
        this.ctx.save();
        this.ctx.fillStyle = '#94d5ed';
        this.ctx.strokeStyle = '#94d5ed';

        boxes.forEach((box) => {
            this.ctx.save();
            this.ctx.translate(box.x, box.y);
            this.ctx.rotate(box.angle);
            this.ctx.fillRect(-box.width / 2, -box.height / 2, box.width, box.height);
            this.ctx.strokeRect(-box.width / 2, -box.height / 2, box.width, box.height);
            this.ctx.restore();
        });
        this.ctx.restore();
    }

    private drawJumpers(jumpers: JumperState[]) {
        this.ctx.save();
        this.ctx.fillStyle = 'yellow';
        this.ctx.strokeStyle = 'yellow';
        jumpers.forEach((jumper) => {
            this.ctx.save();
            this.ctx.translate(jumper.x, jumper.y);
            this.ctx.beginPath();
            this.ctx.arc(0, 0, jumper.radius, 0, Math.PI * 2, false);
            this.ctx.stroke();
            this.ctx.restore();
        });
        this.ctx.restore();
    }

    private drawMarbles(params: RenderParameters) {
        const {marbles} = params;
        marbles.forEach((marble) => {
            marble.render(this.ctx, 1, false, true);
        });
    }
}
