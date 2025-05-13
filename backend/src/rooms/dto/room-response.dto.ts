import { Expose, Type } from 'class-transformer';
// GameDto import는 유지하되, API 분리 전략에 따라 game 필드를 제거할 것이므로 주석 처리 또는 삭제 가능
// import { GameDto } from 'src/game/dto/game.dto'; 
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

  // game 필드는 별도 API(/rooms/:id/game)로 분리되므로 여기서는 제거합니다.
  // @Expose()
  // @Type(() => GameDto)
  // game: GameDto | null; 
}
