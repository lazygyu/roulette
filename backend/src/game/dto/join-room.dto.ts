import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

class UserInfoDto {
  @IsString()
  @IsNotEmpty()
  nickname: string;
}

export class JoinRoomDto {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  roomId: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserInfoDto)
  userInfo?: UserInfoDto;

  @IsOptional()
  @IsString()
  password?: string;
}
