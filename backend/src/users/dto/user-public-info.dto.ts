import { Expose } from 'class-transformer';

export class UserPublicInfoDto {
  @Expose()
  id: number;

  @Expose()
  nickname: string;
}
