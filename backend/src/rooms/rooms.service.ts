import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { Game, GameRanking, Room, User, GameStatus } from '@prisma/client'; // GameStatus 임포트 추가
import { GameDto } from '../game/dto/game.dto';
import { GetGameRankingResponseDto } from '../game/dto/get-game-ranking-response.dto';
import { GameRankingEntryDto } from '../game/dto/game-ranking-entry.dto';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async createRoom(createRoomDto: CreateRoomDto, managerId: number): Promise<Room & { manager: User }> {
    // game 정보는 별도 API로 제공되므로 include에서 제외
    const newRoom = await this.prisma.room.create({
      data: {
        name: createRoomDto.name,
        password: createRoomDto.password,
        managerId,
      },
      include: {
        manager: true,
      },
    });

    // 프론트엔드 기본값 참조
    const defaultMarbles = ['a', 'b', 'c'];
    const defaultWinningRank = 1;
    const defaultMapIndex = 0; // roulette.ts에서 _stage = stages[0] 확인
    const defaultSpeed = 1.0; // options.ts에서 speed: number = 1 확인

    // 방 생성 후, 해당 방에 대한 기본 게임 정보 생성
    await this.prisma.game.create({
      data: {
        roomId: newRoom.id,
        status: GameStatus.WAITING, // 기본 상태는 WAITING
        marbles: defaultMarbles,
        winningRank: defaultWinningRank,
        mapIndex: defaultMapIndex,
        speed: defaultSpeed,
      },
    });

    return newRoom;
  }

  async deleteRoom(id: number): Promise<Room & { manager: User }> {
    // 방이 존재하는지 확인
    const room = await this.prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      throw new NotFoundException('해당 방을 찾을 수 없습니다.');
    }

    // 소프트 삭제를 위해 deletedAt 필드 업데이트
    // game 정보는 별도 API로 제공되므로 include에서 제외
    return this.prisma.room.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { manager: true },
    });
  }

  async getRoom(id: number): Promise<Room & { manager: User }> {
    // game 정보는 별도 API로 제공되므로 include에서 제외
    const room = await this.prisma.room.findUnique({
      where: {
        id,
        deletedAt: null,
      },
      include: { manager: true },
    });

    if (!room) {
      throw new NotFoundException('해당 방을 찾을 수 없습니다.');
    }

    return room;
  }

  async getRoomGameDetails(roomId: number): Promise<GameDto | null> {
    const game = await this.prisma.game.findUnique({
      where: { roomId },
      // GameDto에 필요한 필드만 선택하거나, GameDto 구조에 맞게 반환
    });

    if (!game) {
      // 게임이 아직 생성되지 않았거나, 방이 없을 수 있음
      // NotFoundException을 던지거나 null을 반환할 수 있음 (요구사항에 따라)
      // 여기서는 null을 반환하여 컨트롤러에서 처리하도록 함
      return null;
    }
    return game;
  }

  async getGameRanking(roomId: number, password?: string): Promise<GetGameRankingResponseDto> {
    const room = await this.getRoom(roomId);
    if (room.password) {
      const isPasswordCorrect = await this.verifyRoomPassword(roomId, password);
      if (!isPasswordCorrect) {
        throw new ForbiddenException('Incorrect password');
      }
    }

    const game = await this.prisma.game.findUnique({
      where: { roomId },
      include: {
        rankings: {
          // GameRanking 모델을 포함하여 조회
          orderBy: {
            rank: 'asc', // 순위 오름차순 정렬
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException(`Game for room ID ${roomId} not found.`);
    }

    if (!game.rankings || game.rankings.length === 0) {
      // 랭킹 정보가 없는 경우 (예: 게임 미종료)
      return { rankings: [] };
    }

    const rankingEntries: GameRankingEntryDto[] = game.rankings.map((r) => ({
      marbleName: r.marbleName,
      rank: r.rank,
      isWinner: r.isWinner,
    }));

    return { rankings: rankingEntries };
  }

  async isManager(roomId: number, userId: number): Promise<boolean> {
    // getRoom은 이제 game 정보를 포함하지 않으므로, managerId만 확인하면 됨
    const room = await this.prisma.room.findUnique({
      where: { id: roomId, deletedAt: null },
    });

    if (!room) {
      throw new NotFoundException('해당 방을 찾을 수 없습니다.');
    }

    return room.managerId === userId;
  }

  async verifyRoomPassword(roomId: number, plainPassword?: string): Promise<boolean> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId, deletedAt: null }, // 삭제되지 않은 방만 고려
      select: { password: true },
    });

    if (!room) {
      // GameGateway에서 이미 방 존재 여부를 확인할 수 있지만, 여기서도 방어적으로 처리
      throw new NotFoundException(`Room with ID ${roomId} not found for password verification.`);
    }

    if (!room.password) {
      // 방에 비밀번호가 설정되어 있지 않으면 항상 통과
      return true;
    }

    if (!plainPassword) {
      // 방에는 비밀번호가 있는데, 클라이언트가 비밀번호를 제공하지 않은 경우
      return false;
    }

    // TODO: 실제 환경에서는 bcrypt.compare 사용 권장
    // const isMatch = await bcrypt.compare(plainPassword, room.password);
    // return isMatch;

    return plainPassword === room.password; // 현재는 단순 문자열 비교로 가정
  }
}
