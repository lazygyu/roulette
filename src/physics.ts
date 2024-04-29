import * as planck from 'planck';
import {StageDef} from './data/maps';
import {VectorLike} from './types/VectorLike';
import {Vec2} from 'planck';
import {WheelState} from './types/WheelState';
import {BoxState} from './types/BoxState';
import {JumperState} from './types/JumperState';

export class Physics {
    private world: planck.World;
    private walls: planck.Body[] = [];
    private marbles: Map<number, planck.Body> = new Map();
    private wheels: planck.Body[] = [];
    private boxes: planck.Body[] = [];
    private jumpers: planck.Body[] = [];
    constructor() {
        this.world = new planck.World({
            gravity: planck.Vec2(0, 10),
        });
    }

    init() {

    }

    clear() {
        this.walls.forEach(wall => {
            this.world.destroyBody(wall);
        });
        this.walls = [];
        this.wheels.forEach(wheel => {
            this.world.destroyBody(wheel);
        });
        this.wheels = [];
        this.boxes.forEach(box => {
            this.world.destroyBody(box);
        });
        this.boxes = [];

        this.jumpers.forEach(jumper => {
            this.world.destroyBody(jumper);
        });
        this.jumpers = [];
    }

    clearMarbles() {
        this.marbles.forEach(marble => {
            this.world.destroyBody(marble);
        });
        this.marbles.clear();
    }

    createWalls(walls: StageDef['walls']) {
        walls.forEach(wallDef => {
            const wall = this.world.createBody({type: 'static'});
            wall.setPosition(planck.Vec2(0, 0));
            wall.createFixture({
                shape: planck.Chain(wallDef.map(pos => new planck.Vec2(...pos)), false),
            });
            this.walls.push(wall);
        });
    }

    createWheels(wheels: StageDef['wheels']) {
        wheels.forEach((wheelDef) => {

            const pos = {x: wheelDef[0], y: wheelDef[1]};
            const power = wheelDef[2];
            const center = {x: wheelDef[3] ?? 0, y: wheelDef[4] ?? 0};
            const size = wheelDef[5] ?? 2;
            const mover = this.world.createKinematicBody({position: planck.Vec2(pos.x, pos.y)});
            mover.createFixture({
                shape: new planck.Box(size ? size : 2, 0.1, center ? new planck.Vec2(center.x, center.y) : new planck.Vec2()),
                restitution: 0.7,
            });
            mover.setUserData({size, center});
            mover.setAngularVelocity(power);
            this.wheels.push(mover);
        });
    }

    createBoxes(boxes: StageDef['boxes']) {
        boxes.forEach((boxDef) => {
            const pos = {x: boxDef[0], y: boxDef[1]};
            const width = boxDef[3] ?? 0.5;
            const height = boxDef[4] ?? 0.25;
            const rotation = boxDef[2] ?? 0;
            const body = this.world.createBody({
                type: 'static',
                position: new Vec2(pos.x, pos.y),
            });
            body.createFixture({
                shape: new planck.Box(width, height),
            });

            body.setAngle(rotation);
            body.setUserData({width: width * 2, height: height * 2});
            this.boxes.push(body);
        });
    }

    createJumpers(jumpers: StageDef['jumpers']) {
        if (!jumpers) {
            return;
        }
        jumpers.forEach(jumperDef => {
            const jumper = this.world.createBody({position: new planck.Vec2(jumperDef[0], jumperDef[1]) });
            jumper.createFixture({
                shape: new planck.Circle(new Vec2(), jumperDef[2]),
                restitution: 1.5,
            });
            jumper.setUserData({ isTemporary: jumperDef[3], radius: jumperDef[2] });
            this.jumpers.push(jumper);
        });
    }

    createMarble(id: number, x: number, y: number) {
        const body = this.world.createBody({
            type: 'dynamic',
            allowSleep: false,
            awake: true,
            active: false,
            linearDamping: 0,
            angularDamping: 0.01,
            linearVelocity: new planck.Vec2(0, 0),
        });
        const circle = planck.Circle(new planck.Vec2(0, 0), 0.25);
        body.createFixture({shape: circle, density: Math.random() + 1, restitution: 0.2});
        body.setPosition(new planck.Vec2(x, y));
        this.marbles.set(id, body);
    }

    shakeMarble(id: number) {
        const body = this.marbles.get(id);
        if (body) {
            body.applyLinearImpulse(Vec2(Math.random() * 10 - 5, Math.random() * 10 - 5), body.getPosition(), true);
        }
    }

    removeMarble(id: number) {
        const body = this.marbles.get(id);
        if (body) {
            this.world.destroyBody(body);
            this.marbles.delete(id);
        }
    }

    getMarblePosition(id: number) {
        const marble = this.marbles.get(id);
        if (marble) {
            const pos = marble.getPosition();
            return {x: pos.x, y: pos.y};
        }
    }

    getWheels(): WheelState[] {
        return this.wheels.map((wheel) => {
            const userData = wheel.getUserData() as {size: number, center: VectorLike};
            return {
                ...wheel.getWorldCenter(),
                size: userData.size,
                angle: wheel.getAngle(),
            };
        });
    }

    getBoxes(): BoxState[] {
        return this.boxes.map((box) => {
            const userData = box.getUserData() as {width: number, height: number};
            return {
                ...box.getWorldCenter(),
                width: userData.width,
                height: userData.height,
                angle: box.getAngle(),
            }
        });
    }

    getJumpers(): JumperState[] {
        return this.jumpers.map((jumper) => {
            const userData = jumper.getUserData() as { isTemporary: boolean, radius: number };
            return {
                ...jumper.getWorldCenter(),
                radius: userData.radius,
                isTemporary: userData.isTemporary,
            }
        });
    }

    impact(id: number) {
        const src = this.marbles.get(id);
        if (!src) return;

        this.marbles.forEach(marble => {
            if (marble === src) return;
            const dist = marble.getPosition().clone().sub(src.getPosition());
            if (dist.lengthSquared() < 100) {
                dist.normalize();
                const power = (1 - dist.length() / 10);
                dist.mul(power * power * 5);
                marble.applyLinearImpulse(dist, marble.getPosition());
            }
        });
    }

    start() {
        this.marbles.forEach(marble => {
           marble.setActive(true);
        });
    }

    private delteCandidates: planck.Body[] = [];

    step(deltaSeconds: number) {
        if (this.delteCandidates.length) {
            this.delteCandidates.forEach(cand => {
                this.world.destroyBody(cand);
            });
            this.delteCandidates = [];
        }

        this.world.step(deltaSeconds);
        for (let i = this.jumpers.length - 1; i >= 0; i--) {
            const jumper = this.jumpers[i];
            let contact = jumper.getContactList();
            while(contact) {
                if (contact.contact && contact.contact.isTouching()) {

                    this.delteCandidates.push(...this.jumpers.splice(i, 1));
                    break;
                }
                contact = contact.next || null;
            }
        }
    }
}
