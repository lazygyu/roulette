import { Expose } from 'class-transformer';

export class GameRankingEntryDto {
  @Expose()
  marbleName: string;

  @Expose()
  rank: number;

  @Expose()
  isWinner: boolean;
}
