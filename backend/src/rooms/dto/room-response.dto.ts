import { Game } from '@prisma/client';
import { Expose, Type } from 'class-transformer';
import { GameDto } from 'src/game/dto/game.dto';
import { UserPublicInfoDto } from 'src/users/dto/user-public-info.dto';

export class GetRoomResponseDto {
  @Expose()
  name: string;

  @Expose()
  id: number;

  @Expose()
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

  @Expose()
  @Type(() => GameDto)
  game: GameDto | null;
}
