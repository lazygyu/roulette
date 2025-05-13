import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { Game, GameRanking, Room, User } from '@prisma/client'; // GameRanking 임포트 추가
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
    // Game 엔티티를 GameDto로 변환 (필요시 class-transformer 사용)
    const gameDto: GameDto = {
      id: game.id,
      status: game.status,
      mapIndex: game.mapIndex,
      marbles: game.marbles,
      winningRank: game.winningRank,
      speed: game.speed,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
    };
    return gameDto;
  }

  async getGameRanking(roomId: number): Promise<GetGameRankingResponseDto> {
    const game = await this.prisma.game.findUnique({
      where: { roomId },
      include: {
        rankings: { // GameRanking 모델을 포함하여 조회
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

    const rankingEntries: GameRankingEntryDto[] = game.rankings.map(r => ({
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
}
