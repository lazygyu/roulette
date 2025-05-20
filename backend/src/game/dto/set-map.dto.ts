import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class SetMapDto {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  roomId: number;

  @IsInt()
  @IsNotEmpty()
  @Min(0) // 맵 인덱스는 0 이상
  mapIndex: number;
}
