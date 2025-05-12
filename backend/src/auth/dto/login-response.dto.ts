import { Expose } from 'class-transformer';

export class LoginResponseDto {
  @Expose()
  access_token: string;

  @Expose()
  nickname: string;
}
