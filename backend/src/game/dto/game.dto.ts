import { GameStatus } from '@prisma/client';

export class GameDto {
  id: number;
  status: GameStatus;
  mapIndex: number | null;
  marbles: string[];
  winningRank: number | null;
  speed: number | null;
  createdAt: Date;
  updatedAt: Date;
}
