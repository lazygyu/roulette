import {
  EntityShapeTypes,
  EntityShapeBase,
  EntityBoxShape,
  EntityCircleShape,
  EntityPolylineShape,
  EntityShape,
  MapEntityState,
  GameStatus,
  UserPublicInfo
} from 'common';
import { ServerSkillEffect } from './skillTypes';

export enum Skills {
  None = 'None',
  Impact = 'Impact',
  DummyMarble = 'DummyMarble',
}

export interface MarbleState {
  id: number;
  name: string;
  x: number;
  y: number;
  angle: number;
  color: string;
  isActive: boolean;
  skill: Skills | null;
  radius: number;
}

export {
  EntityShapeTypes,
  EntityShapeBase,
  EntityBoxShape,
  EntityCircleShape,
  EntityPolylineShape,
  EntityShape,
  MapEntityState,
  GameStatus,
  UserPublicInfo
};

export interface GameState {
  marbles: MarbleState[];
  winners: MarbleState[];
  winner: MarbleState | null;
  entities: MapEntityState[];
  isRunning: boolean;
  winnerRank: number;
  totalMarbleCount: number;
  shakeAvailable: boolean;
  skillEffects?: ServerSkillEffect[];
}

export interface GameInfo {
  id: number;
  status: GameStatus;
  mapIndex: number | null;
  marbles: string[];
  winningRank: number | null;
  speed: number | null;
  useSkills: boolean;
  autoRecording: boolean;
  isRunning: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RankingEntry {
  marbleName: string;
  rank: number;
  isWinner: boolean;
}

export interface RoomInfo {
  id: number;
  name: string;
  isPasswordRequired: boolean;
  managerId: number;
  manager: UserPublicInfo;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  game: GameInfo | null;
}

export interface MapInfo {
  index: number;
  title: string;
}
