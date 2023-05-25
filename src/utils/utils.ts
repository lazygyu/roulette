import * as planck from 'planck';
import {Vec2} from 'planck';

export function createMover(world: planck.World, pos: planck.Vec2, power: number, center?: planck.Vec2, size?: number) {
    const mover = world.createKinematicBody({position: pos });
    mover.createFixture({
        shape: new planck.Box(size ? size : 2, 0.1, center ? center : new planck.Vec2()),
        restitution: 0.7,
    });
    mover.setAngularVelocity(power);
    return mover;
}

export function createJumper(world: planck.World, pos: planck.Vec2, size: number, isTemporary: boolean = false) {
    const jumper = world.createBody({ position: pos });
    jumper.createFixture({
        shape: new planck.Circle(new Vec2(), size),
        restitution: 1.5,
    });
    jumper.setUserData({ isTemporary });
    return jumper;
}

export function createBox(world: planck.World, pos: planck.Vec2, rotation: number, width: number = 0.5, height: number = 0.25) {
    const boxBody = world.createBody({
        type: 'static',
        position: pos,
    });

    boxBody.createFixture({
        shape: new planck.Box(width, height),
    });

    boxBody.setAngle(rotation);
    return boxBody;
}

export function rad(degree: number) {
    return Math.PI * degree / 180;
}

function getRegexValue(regex: RegExp, str: string) {
    const result = regex.exec(str);
    return result ? result[1] : '';
}

export function parseName(nameStr: string) {
    const weightRegex = /(\/\d+)/;
    const countRegex = /(\*\d+)/;
    const hasWeight = weightRegex.test(nameStr);
    const hasCount = countRegex.test(nameStr);
    const name = getRegexValue(/^\s*([^\/*]+)?/, nameStr);
    if (!name) return null;
    const weight = hasWeight ? parseInt(getRegexValue(weightRegex, nameStr).replace('/', '')) : 1;
    const count = hasCount ? parseInt(getRegexValue(countRegex, nameStr).replace('*', '')) : 1;
    return {
        name,
        weight,
        count,
    };
}
