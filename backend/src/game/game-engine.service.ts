import { Injectable, Logger, OnModuleDestroy, BadRequestException } from '@nestjs/common';
import { Server } from 'socket.io';
import { GameRoom, GameSessionService } from './game-session.service'; // GameSessionService 임포트
import { prefixGameRoomId } from './utils/roomId.util'; // prefixRoomId 유틸리티 임포트
import { SkillType, SkillPosition, SkillExtra } from './types/skill.type';
import { ImpactSkillEffect } from './types/skill-effect.type'; // ImpactSkillEffect 임포트

// 스킬 속성 상수 정의 (TODO: 별도 설정 파일로 분리 고려)
const IMPACT_SKILL_RADIUS = 5; // Impact 스킬의 반경
const IMPACT_SKILL_FORCE = 10; // Impact 스킬의 힘

@Injectable()
export class GameEngineService implements OnModuleDestroy {
  // OnModuleDestroy 인터페이스 구현 명시
  private readonly logger = new Logger(GameEngineService.name);
  // gameLoops Map의 key 타입을 number로 변경
  private gameLoops: Map<number, NodeJS.Timeout> = new Map();

  // GameSessionService 주입
  constructor(private readonly gameSessionService: GameSessionService) {}

  /**
   * 스킬 사용 로직을 처리합니다.
   * @param roomId - 스킬을 사용할 방의 ID
   * @param skillType - 사용할 스킬의 타입
   * @param skillPosition - 스킬이 발동될 위치 (x, y 좌표)
   * @param extra - 스킬 타입에 따라 달라지는 추가 데이터
   */
  async useSkill<T extends SkillType>(
    roomId: number,
    skillType: T,
    skillPosition: SkillPosition,
    extra: SkillExtra<T>,
    userNickname?: string, // 스킬 사용자의 닉네임 추가
  ): Promise<void> {
    const room = this.gameSessionService.getRoom(roomId);
    if (!room || !room.game) {
      throw new BadRequestException(`방 ${roomId}를 찾을 수 없거나 게임이 시작되지 않았습니다.`);
    }

    // 스킬 타입에 따라 다른 로직을 수행
    switch (skillType) {
      case SkillType.Impact:
        this._applyImpactSkill(room, skillPosition);
        break;
      case SkillType.DummyMarble:
        this._createDummyMarblesSkill(room, skillPosition, userNickname);
        break;
      default:
        throw new BadRequestException(`알 수 없는 스킬 타입: ${skillType}`);
    }
  }

  private _applyImpactSkill(room: GameRoom, skillPosition: SkillPosition) {
    this.logger.log(`Room ${room.id}: Impact skill used at (${skillPosition.x}, ${skillPosition.y}) with radius ${IMPACT_SKILL_RADIUS} and force ${IMPACT_SKILL_FORCE}`);
    room.game.applyImpact(skillPosition, IMPACT_SKILL_RADIUS, IMPACT_SKILL_FORCE);

    room.game.addSkillEffect({
      type: SkillType.Impact,
      position: skillPosition,
      radius: IMPACT_SKILL_RADIUS,
    } as Omit<ImpactSkillEffect, 'id' | 'timestamp'>);
  }

  private _createDummyMarblesSkill(room: GameRoom, skillPosition: SkillPosition, userNickname?: string) {
    const nickname = userNickname || 'UnknownUser';
    this.logger.log(
      `Room ${room.id}: DummyMarble skill used by ${nickname} at (${skillPosition.x}, ${skillPosition.y}) to create 5 marbles`,
    );
    room.game.createDummyMarbles(skillPosition, 5, nickname);
  }

  /**
   * 특정 방의 게임 루프를 시작합니다.
   * @param roomId - 게임 루프를 시작할 방의 숫자 ID
   * @param server - 클라이언트에게 상태를 전송할 Socket.IO 서버 인스턴스
   */
  startGameLoop(roomId: number, server: Server) {
    if (this.gameLoops.has(roomId)) {
      this.logger.warn(`Game loop for room ${roomId} is already running.`);
      return;
    }

    this.logger.log(`Starting game loop for room ${roomId}`);
    const prefixedRoomId = prefixGameRoomId(roomId);

    const interval = setInterval(() => this._gameLoopTick(roomId, server, prefixedRoomId), 1000 / 60);

    this.gameLoops.set(roomId, interval);
  }

  /**
   * 게임 루프의 단일 틱을 처리합니다.
   * @param roomId - 게임 루프가 실행 중인 방의 ID
   * @param server - 클라이언트에게 상태를 전송할 Socket.IO 서버 인스턴스
   * @param prefixedRoomId - 접두사가 붙은 방 ID (소켓 룸 이름)
   */
  private async _gameLoopTick(roomId: number, server: Server, prefixedRoomId: string) {
    try {
      const room = this.gameSessionService.getRoom(roomId);
      if (!room || !room.game) {
        this.logger.warn(`Room or game not found for room ${roomId}. Stopping loop.`);
        this.stopGameLoop(roomId, server);
        return;
      }

      this._updateAndBroadcastState(room, prefixedRoomId, server);
      await this._checkAndHandleGameEnd(room, prefixedRoomId, server);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error in game loop for room ${roomId}: ${errorMessage}`, errorStack);
      this.stopGameLoop(roomId, server);
    }
  }

  private _updateAndBroadcastState(room: GameRoom, prefixedRoomId: string, server: Server) {
    if (room.isRunning) {
      room.game.update();
    }
    const gameState = room.game.getGameState();
    server.to(prefixedRoomId).emit('game_state', gameState);
  }

  private async _checkAndHandleGameEnd(room: GameRoom, prefixedRoomId: string, server: Server) {
    const gameState = room.game.getGameState();
    if (!gameState.isRunning && room.isRunning) {
      this.logger.log(
        `Game in room ${room.id} has ended. Notifying GameSessionService and cleaning up.`,
      );
      await this.gameSessionService.endGame(room.id);
      server.to(prefixedRoomId).emit('game_over', {
        winner: gameState.winner,
      });
      this.stopGameLoop(room.id, server);
    }
  }

  /**
   * 특정 방의 게임 루프를 중지하고 관련 리소스를 정리합니다.
   * @param roomId - 게임 루프를 중지할 방의 숫자 ID
   * @param server - Socket.IO 서버 인스턴스 (선택 사항, 소켓 정리 시 사용)
   */
  stopGameLoop(roomId: number, server?: Server) {
    const interval = this.gameLoops.get(roomId);
    if (interval) {
      clearInterval(interval);
      this.gameLoops.delete(roomId);
      this.logger.log(`Stopped game loop for room ${roomId}`);

      // 게임 종료 시 소켓 룸에서 모든 클라이언트 leave 처리 및 메모리에서 방 제거
      if (server) {
        const prefixedRoomId = prefixGameRoomId(roomId);
        server.socketsLeave(prefixedRoomId); // 모든 소켓을 해당 룸에서 leave
        this.logger.log(`Room ${roomId}: All sockets left from room ${prefixedRoomId}.`);
        this.gameSessionService.removeRoom(roomId); // 메모리에서 방 제거
        this.logger.log(`Room ${roomId}: Game session removed from memory.`);
      }
    } else {
      // 루프가 활성화되어 있지 않음
    }
  }

  /**
   * 특정 방의 게임 루프가 실행 중인지 확인합니다.
   * @param roomId - 확인할 방의 숫자 ID
   * @returns 루프 실행 중 여부
   */
  isLoopRunning(roomId: number): boolean {
    // roomId 타입을 number로 변경
    return this.gameLoops.has(roomId);
  }

  /**
   * 서버 종료 또는 모듈 파괴 시 모든 활성 게임 루프를 정리합니다.
   */
  onModuleDestroy() {
    this.logger.log('Clearing all active game loops...');
    this.gameLoops.forEach((interval, roomId) => {
      clearInterval(interval);
      this.logger.log(`Cleared game loop for room ${roomId}`);
    });
    this.gameLoops.clear();
  }
}
