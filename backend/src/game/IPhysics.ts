import { MapEntityState } from './types/MapEntity.type';
import type { StageDef } from 'common';

export interface IPhysics {
  init(): Promise<void>;

  clear(): void;

  clearMarbles(): void;
  clearEntities(): void; // clearEntities 추가

  createStage(stage: StageDef): void;

  createMarble(id: number, x: number, y: number, isDummy?: boolean, initialVelocity?: { x: number; y: number }): void;

  shakeMarble(id: number): void;

  removeMarble(id: number): void;

  getMarblePosition(id: number): { x: number; y: number; angle: number };

  getEntities(): MapEntityState[];

  applyRadialImpulse(position: { x: number; y: number }, radius: number, force: number): void;

  start(): void;

  step(deltaSeconds: number): void;

  destroy(): void;
}
