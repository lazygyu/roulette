import { Expose } from 'class-transformer';
import { UserPublicInfo } from 'common';

export class UserPublicInfoDto implements UserPublicInfo {
  @Expose()
  id: number;

  @Expose()
  nickname: string;
}
