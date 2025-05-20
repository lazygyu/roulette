import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class SetSpeedDto {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  roomId: number;

  @IsNumber() // 속도는 정수 또는 실수일 수 있음
  @IsNotEmpty()
  @Min(0) // 속도는 0 이상 (0이면 정지 의미 가능)
  speed: number;
}
