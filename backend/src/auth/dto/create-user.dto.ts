import { IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  username: string;

  @IsString()
  nickname: string;
}
