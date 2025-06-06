import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, Min } from 'class-validator';
import { SetWinningRankRequest } from 'common';

export class SetWinningRankDto implements SetWinningRankRequest {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  roomId: number;

  @IsInt()
  @IsNotEmpty()
  @Min(0) // 우승 순위는 최소 0 이상 - zero-index
  rank: number;
}
