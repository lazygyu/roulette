import { GameStatus } from './game-status.type';
import { UserPublicInfo } from './user.type';

export interface GameInfo {
  id: number;
  status: GameStatus;
  mapIndex: number | null;
  marbles: string[];
  winningRank: number | null;
  speed: number | null;
  createdAt: string;
  updatedAt: string;
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

export interface RankingEntry {
  marbleName: string;
  rank: number;
  isWinner: boolean;
}

export interface MapInfo {
  index: number;
  title: string;
}
