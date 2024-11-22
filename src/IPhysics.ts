import type { StageDef } from './data/maps';
import type { WheelState } from './types/WheelState';
import type { BoxState } from './types/BoxState';
import type { JumperState } from './types/JumperState';
import { MapEntityState } from './types/MapEntity.type';

export interface IPhysics {
  init(): Promise<void>;

  clear(): void;

  clearMarbles(): void;

  createStage(stage: StageDef): void;

  createMarble(id: number, x: number, y: number): void;

  shakeMarble(id: number): void;

  removeMarble(id: number): void;

  getMarblePosition(id: number): { x: number; y: number };

  getWheels(): WheelState[];

  getBoxes(): BoxState[];

  getJumpers(): JumperState[];

  getEntities(): MapEntityState[];

  impact(id: number): void;

  start(): void;

  step(deltaSeconds: number): void;
}
