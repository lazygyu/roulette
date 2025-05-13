import { Expose, Type } from 'class-transformer';
import { GameRankingEntryDto } from './game-ranking-entry.dto';

export class GetGameRankingResponseDto {
  @Expose()
  @Type(() => GameRankingEntryDto)
  rankings: GameRankingEntryDto[];
}
