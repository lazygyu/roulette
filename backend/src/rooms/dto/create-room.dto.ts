import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  password?: string;
}
