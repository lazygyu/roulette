import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GameStatus, Prisma } from '@prisma/client';

@Injectable()
export class GamePersistenceService {
  private readonly logger = new Logger(GamePersistenceService.name);

  constructor(private prisma: PrismaService) {}

  async loadGameData(roomId: number) {
    this.logger.log(`DB에서 방 ${roomId}의 게임 데이터 로드 시도.`);
    return this.prisma.game.findUnique({
      where: { roomId },
    });
  }

  async upsertGame(
    roomId: number,
    data: {
      status: GameStatus;
      mapIndex?: number | null;
      marbles?: string[];
      winningRank?: number;
      speed?: number;
    },
  ) {
    this.logger.log(`DB에 방 ${roomId}의 게임 데이터 upsert 시도.`);
    return this.prisma.game.upsert({
      where: { roomId },
      update: data,
      create: { roomId, ...data },
    });
  }

  async updateGameStatus(roomId: number, status: GameStatus) {
    this.logger.log(`DB에서 방 ${roomId}의 게임 상태를 ${status}로 업데이트 시도.`);
    return this.prisma.game.update({
      where: { roomId },
      data: { status },
    });
  }

  async saveGameRankings(gameId: number, rankingCreateData: Prisma.GameRankingCreateManyInput[]) {
    this.logger.log(`DB에 게임 ${gameId}의 랭킹 데이터 저장 시도.`);
    return this.prisma.gameRanking.createMany({
      data: rankingCreateData,
      skipDuplicates: true,
    });
  }

  async deleteGameRankings(gameId: number) {
    this.logger.log(`DB에서 게임 ${gameId}의 랭킹 데이터 삭제 시도.`);
    return this.prisma.gameRanking.deleteMany({
      where: { gameId },
    });
  }

  async deleteGameData(roomId: number) {
    this.logger.log(`DB에서 방 ${roomId}의 게임 데이터 삭제 시도.`);
    return this.prisma.game.delete({
      where: { roomId },
    });
  }
}
