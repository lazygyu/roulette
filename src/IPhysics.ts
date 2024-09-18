import type {StageDef} from './data/maps';
import type {WheelState} from './types/WheelState';
import type {BoxState} from './types/BoxState';
import type {JumperState} from './types/JumperState';

export interface IPhysics {
    init(): Promise<void>;

    clear(): void;

    clearMarbles(): void;

    createStage(stage: StageDef): void;

    createMarble(id: number, x: number, y: number): void;

    shakeMarble(id: number): void;

    removeMarble(id: number): void;

    getMarblePosition(id: number): { x: any; y: any };

    getWheels(): WheelState[];

    getBoxes(): BoxState[];

    getJumpers(): JumperState[];

    impact(id: number): void;

    start(): void;

    step(deltaSeconds: number): void;
}
