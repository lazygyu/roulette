import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsString, ArrayNotEmpty } from 'class-validator';
import { SetMarblesRequest } from 'common';

export class SetMarblesDto implements SetMarblesRequest {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  roomId: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Transform(({ value }: { value: string[] }) => {
    return value.map((name) => name.trim()).filter((name) => !!name);
  })
  @IsNotEmpty({ each: true }) // 각 문자열 요소도 비어있지 않아야 함
  names: string[];
}
