import { GameStatus } from '@prisma/client';
import { Expose } from 'class-transformer';

export class GameDto {
  @Expose()
  id: number;

  @Expose()
  status: GameStatus;

  @Expose()
  mapIndex: number | null;

  @Expose()
  marbles: string[];

  @Expose()
  winningRank: number | null;

  @Expose()
  speed: number | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
