import {IPhysics} from './IPhysics';
import { StageDef } from './data/maps';
import { BoxState } from './types/BoxState';
import { JumperState } from './types/JumperState';
import { WheelState } from './types/WheelState';
import Box2DFactory from 'box2d-wasm';

export class Box2dPhysics implements IPhysics {
    private Box2D!: typeof Box2D & EmscriptenModule;
    private gravity!: Box2D.b2Vec2;
    private world!: Box2D.b2World;

    private marbleMap: { [id: number]: Box2D.b2Body } = {};
    private walls: Box2D.b2Body[] = [];
    private boxes: ({body: Box2D.b2Body } & BoxState)[] = [];
    private wheels: {body: Box2D.b2Body, size: number}[] = [];
    private jumpers: ({body: Box2D.b2Body} & JumperState)[] = [];

    private deleteCandidates: Box2D.b2Body[] = [];

    async init(): Promise<void> {
        this.Box2D = await Box2DFactory();
        this.gravity = new this.Box2D.b2Vec2(0, 10);
        this.world = new this.Box2D.b2World(this.gravity);
        console.log('box2d ready');
    }

    clear(): void {
        this.clearWalls();
        this.clearWheels();
        this.clearBoxes();
        this.clearJumpers();
    }

    clearMarbles(): void {
        Object.values(this.marbleMap).forEach(body => {
            this.world.DestroyBody(body);
        });
        this.marbleMap = {};
    }

    createStage(stage: StageDef): void {
        this.createWalls(stage.walls);
        this.createWheels(stage.wheels);
        this.createBoxes(stage.boxes);
        this.createJumpers(stage.jumpers);
    }

    createJumpers(jumpers: StageDef['jumpers']) {
        if (!jumpers) return;

        jumpers.forEach((jumperDef) => {
            const [x, y, size, temporary] = jumperDef;
            const bodyDef = new this.Box2D.b2BodyDef();
            bodyDef.set_type(this.Box2D.b2_staticBody);
            const body = this.world.CreateBody(bodyDef);
            const shape = new this.Box2D.b2CircleShape();
            shape.set_m_radius(size);

            const fixtureDef = new this.Box2D.b2FixtureDef();
            fixtureDef.set_density(1);
            fixtureDef.set_restitution(1.5);
            fixtureDef.set_shape(shape);

            body.CreateFixture(fixtureDef);
            body.SetTransform(new this.Box2D.b2Vec2(x, y), 0);
            this.jumpers.push({x, y, radius: size, body, isTemporary: !!temporary});
        });
    }

    clearJumpers() {
        this.jumpers.forEach((jumper) => {
            this.world.DestroyBody(jumper.body);
        });
        this.jumpers = [];
    }

    createWheels(wheels: StageDef['wheels']) {
        wheels.forEach((wheelDef) => {
            const pos = {x: wheelDef[0], y: wheelDef[1]};
            const power = wheelDef[2];
            const center = {x: wheelDef[3] ?? 0, y: wheelDef[4] ?? 0};
            const size = wheelDef[5] ?? 2;

            const bodyDef = new this.Box2D.b2BodyDef();
            bodyDef.set_type(this.Box2D.b2_kinematicBody);
            // bodyDef.set_position(new this.Box2D.b2Vec2(pos.x, pos.y));

            const body = this.world.CreateBody(bodyDef);

            const shape = new this.Box2D.b2PolygonShape();
            shape.SetAsBox(size, 0.1);

            const fixtureDef = new this.Box2D.b2FixtureDef();
            fixtureDef.set_density(1);
            fixtureDef.set_shape(shape);

            body.CreateFixture(fixtureDef);
            body.SetAngularVelocity(power);
            body.SetTransform(new this.Box2D.b2Vec2(pos.x, pos.y), 0);

            this.wheels.push({body, size});
        });
    }

    clearWheels() {
        this.wheels.forEach(wheel => {
            this.world.DestroyBody(wheel.body);
        });
        this.wheels = [];
    }

    createWalls(walls: StageDef['walls']) {
        walls.forEach((positions) => {
            const def = new this.Box2D.b2BodyDef();
            def.set_type(this.Box2D.b2_staticBody);

            const body = this.world.CreateBody(def);

            for (let i = 0; i < positions.length - 1; i++) {
                const p1 = positions[i];
                const p2 = positions[i + 1];
                const v1 = new this.Box2D.b2Vec2(p1[0], p1[1]);
                const v2 = new this.Box2D.b2Vec2(p2[0], p2[1]);
                const edge = new this.Box2D.b2EdgeShape();
                edge.SetTwoSided(v1, v2);
                body.CreateFixture(edge, 1);
            }
            this.walls.push(body);
        });
    }

    clearWalls() {
        this.walls.forEach(wall => {
            this.world.DestroyBody(wall);
        });
        this.walls = [];
    }

    createBoxes(boxes: StageDef['boxes']) {
        boxes.forEach((boxDef) => {
            const pos = {x: boxDef[0], y: boxDef[1]};
            const width = boxDef[3] ?? 0.5;
            const height = boxDef[4] ?? 0.25;
            const rotation = boxDef[2] ?? 0;

            const def = new this.Box2D.b2BodyDef();
            def.set_type(this.Box2D.b2_staticBody);
            const body = this.world.CreateBody(def);

            const shape = new this.Box2D.b2PolygonShape();
            shape.SetAsBox(width, height, 0, rotation);
            body.CreateFixture(shape, 1);
            body.SetTransform(new this.Box2D.b2Vec2(pos.x, pos.y), 0);
            this.boxes.push({body, width: width*2, height: height*2, x: pos.x, y: pos.y, angle: rotation});
        });
    }

    clearBoxes() {
        this.boxes.forEach((box) => {
            this.world.DestroyBody(box.body);
        });
        this.boxes = [];
    }

    createMarble(id: number, x: number, y: number): void {
        const circleShape = new this.Box2D.b2CircleShape();
        circleShape.set_m_radius(0.25);

        const bodyDef = new this.Box2D.b2BodyDef();
        bodyDef.set_type(this.Box2D.b2_dynamicBody);
        bodyDef.set_position(new this.Box2D.b2Vec2(x, y));

        const body = this.world.CreateBody(bodyDef);
        body.CreateFixture(circleShape, 1 + Math.random());
        body.SetAwake(false);
        body.SetEnabled(false);
        this.marbleMap[id] = body;
    }

    shakeMarble(id: number): void {
        const body = this.marbleMap[id];
        if (body) {
            body.ApplyLinearImpulseToCenter(new this.Box2D.b2Vec2(Math.random() * 10 -5, Math.random() * 10 - 5), true);
        }
    }
    removeMarble(id: number): void {
        const marble = this.marbleMap[id];
        if (marble) {
            this.world.DestroyBody(marble);
            delete this.marbleMap[id];
        }
    }
    getMarblePosition(id: number): { x: any; y: any; } {
        const marble = this.marbleMap[id];
        if (marble) {
            return marble.GetPosition();
        } else {
            return {x: 0, y: 0}
        }
    }
    getWheels(): WheelState[] {
        return this.wheels.map((wheel) => {
            const pos = wheel.body.GetPosition();
            return {
                x: pos.x,
                y: pos.y,
                size: wheel.size,
                angle: wheel.body.GetAngle(),
            }
        });
    }

    getBoxes(): BoxState[] {
        return this.boxes;
    }

    getJumpers(): JumperState[] {
        return this.jumpers;
    }
    impact(id: number): void {
        const src = this.marbleMap[id];
        if (!src) return;

        Object.values(this.marbleMap).forEach(body => {
            if (body === src) return;

            const distVector = new this.Box2D.b2Vec2(body.GetPosition().x, body.GetPosition().y);
            distVector.op_sub(src.GetPosition());
            const distSq = distVector.LengthSquared();

            if (distSq < 100) {
                distVector.Normalize();
                const power = (1 - distVector.Length() / 10);
                distVector.op_mul(power * power * 5);
                body.ApplyLinearImpulseToCenter(distVector, true);
            }
        });
    }
    start(): void {
        for (let key in this.marbleMap) {
            const marble = this.marbleMap[key];
            marble.SetAwake(true);
            marble.SetEnabled(true);
        }
    }
    step(deltaSeconds: number): void {
        this.deleteCandidates.forEach((body) => {
            this.world.DestroyBody(body);
        });
        this.deleteCandidates = [];

        this.world.Step(deltaSeconds, 6, 2);

        for (let i = this.jumpers.length - 1; i >= 0; i--) {
            const jumper = this.jumpers[i];
            let edge = jumper.body.GetContactList();
            if (edge.contact && edge.contact.IsTouching()) {
                this.deleteCandidates.push(...this.jumpers.splice(i, 1).map(j => j.body));
            }
        }
    }

}
