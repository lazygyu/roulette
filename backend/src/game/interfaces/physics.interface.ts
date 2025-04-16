import { StageDef } from '../types/stage.type';
import { MapEntityState } from '../types/map-entity.type';

export interface IPhysics {
  init(): Promise<void>;

  clear(): void;

  clearMarbles(): void;

  createStage(stage: StageDef): void;

  createMarble(id: number, x: number, y: number): void;

  shakeMarble(id: number): void;

  removeMarble(id: number): void;

  getMarblePosition(id: number): { x: number; y: number; angle: number; };

  getEntities(): MapEntityState[];

  impact(id: number): void;

  start(): void;

  step(deltaSeconds: number): void;
} 