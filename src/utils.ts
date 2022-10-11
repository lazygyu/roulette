import * as planck from 'planck';

export function createMover(world: planck.World, pos: planck.Vec2, power: number) {
    const mover = world.createKinematicBody({position: pos});
    mover.createFixture({
        shape: new planck.Box(2, 0.1),
        restitution: 0.7,
    });
    mover.setAngularVelocity(power);
    return mover;
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
