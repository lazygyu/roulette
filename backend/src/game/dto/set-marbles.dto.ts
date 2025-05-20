import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsString, ArrayNotEmpty } from 'class-validator';

export class SetMarblesDto {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  roomId: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true }) // 각 문자열 요소도 비어있지 않아야 함
  names: string[];
}
