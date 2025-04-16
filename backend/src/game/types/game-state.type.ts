import { MarbleState } from './marble.type';
import { MapEntityState } from './map-entity.type';
import { StageDef } from './stage.type';

export enum GameStatus {
  WAITING = 'waiting',
  READY = 'ready',
  RUNNING = 'running',
  FINISHED = 'finished'
}

export interface GameState {
  roomId: number;
  status: GameStatus;
  marbles: MarbleState[];
  winners: MarbleState[];
  entities: MapEntityState[];
  stage: StageDef | null;
  winnerRank: number;
  lastUpdateTime: number;
  winner: MarbleState | null;
  isReady: boolean;
} 