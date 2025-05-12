import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty } from 'class-validator';

export class LeaveRoomDto {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  roomId: number;
}
