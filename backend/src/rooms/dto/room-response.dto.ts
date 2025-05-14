import { Expose, Type, Exclude, Transform, TransformationType } from 'class-transformer';
import { UserPublicInfoDto } from 'src/users/dto/user-public-info.dto';

export class GetRoomResponseDto {
  @Expose()
  name: string;

  @Expose()
  id: number;

  @Expose({ name: 'isPasswordRequired' })
  @Transform(({ obj }) => !!obj.password, { toClassOnly: true })
  password: string | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  managerId: number;

  @Expose()
  deletedAt: Date | null;

  @Expose()
  @Type(() => UserPublicInfoDto)
  manager: UserPublicInfoDto;
}
