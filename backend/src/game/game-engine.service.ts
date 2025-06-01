import { Injectable, Logger, OnModuleDestroy, BadRequestException } from '@nestjs/common';
import { Server } from 'socket.io';
import { GameSessionService } from './game-session.service'; // GameSessionService 임포트
import { prefixRoomId } from './utils/roomId.util'; // prefixRoomId 유틸리티 임포트
import { SkillType, SkillPosition, SkillExtra } from './types/skill.type';
import { ImpactSkillEffect } from './types/skill-effect.type'; // ImpactSkillEffect 임포트

// 스킬 속성 상수 정의
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
        // Impact 스킬 로직
        // const impactExtra = extra as SkillExtra<SkillType.Impact>; // 현재 사용되지 않으므로 주석 처리
        this.logger.log(`Room ${roomId}: Impact skill used at (${skillPosition.x}, ${skillPosition.y}) with radius ${IMPACT_SKILL_RADIUS} and force ${IMPACT_SKILL_FORCE}`);
        room.game.applyImpact(skillPosition, IMPACT_SKILL_RADIUS, IMPACT_SKILL_FORCE);

        // Impact 스킬 이펙트 정보 추가
        room.game.addSkillEffect({
          type: SkillType.Impact,
          position: skillPosition,
          radius: IMPACT_SKILL_RADIUS,
        } as Omit<ImpactSkillEffect, 'id' | 'timestamp'>); // 타입 단언
        break;
      case SkillType.DummyMarble:
        // DummyMarble 스킬 로직
        const dummyMarbleExtra = extra as SkillExtra<SkillType.DummyMarble>; // extra는 현재 비어있음
        const nickname = userNickname || 'UnknownUser'; // 닉네임이 없으면 기본값 사용
        this.logger.log(
          `Room ${roomId}: DummyMarble skill used by ${nickname} at (${skillPosition.x}, ${skillPosition.y}) to create 5 marbles`,
        );
        // createDummyMarbles 호출 시 사용자 닉네임 전달
        room.game.createDummyMarbles(skillPosition, 5, nickname);
        break;
      default:
        throw new BadRequestException(`알 수 없는 스킬 타입: ${skillType}`);
    }
  }

  /**
   * 특정 방의 게임 루프를 시작합니다.
   * @param roomId - 게임 루프를 시작할 방의 숫자 ID
   * @param server - 클라이언트에게 상태를 전송할 Socket.IO 서버 인스턴스
   */
  startGameLoop(roomId: number, server: Server) {
    // roomId 타입을 number로 변경
    if (this.gameLoops.has(roomId)) {
      this.logger.warn(`Game loop for room ${roomId} is already running.`);
      return;
    }

    this.logger.log(`Starting game loop for room ${roomId}`);
    // Socket.IO 통신을 위한 접두사 붙은 ID 생성
    const prefixedRoomId = prefixRoomId(roomId);

    const interval = setInterval(() => {
      try {
        const room = this.gameSessionService.getRoom(roomId); // GameRoom 가져오기
        if (room && room.game) {
          if (room.isRunning) {
            // 게임이 실제로 실행 중일 때만 업데이트
            room.game.update(); // Roulette 인스턴스의 update() 호출
          }

          const gameState = room.game.getGameState(); // 업데이트된 상태 가져오기

          // 게임 상태 업데이트 전송 (접두사 붙은 ID 사용)
          server.to(prefixedRoomId).emit('game_state', gameState);

          // 게임이 종료되었는지 확인 (gameState.isRunning은 room.game.update()에 의해 변경될 수 있음)
          if (!gameState.isRunning && room.isRunning) {
            // room.isRunning은 아직 true일 수 있으므로 gameState.isRunning으로 판단
            this.logger.log(
              `Game in room ${roomId} has ended according to gameState. Stopping loop and notifying GameSessionService.`,
            );
            this.gameSessionService.endGame(roomId); // GameSessionService에 게임 종료 알림
            this.stopGameLoop(roomId); // 숫자 ID로 루프 중지
            // 게임 종료 이벤트 전송 (접두사 붙은 ID 사용)
            server.to(prefixedRoomId).emit('game_over', {
              winner: gameState.winner,
            });
          }
        } else {
          // 게임 상태를 가져올 수 없으면 루프 중지 (예: 방이 사라짐)
          this.logger.warn(`Room or game not found for room ${roomId}. Stopping loop.`);
          this.stopGameLoop(roomId); // 숫자 ID로 루프 중지
        }
      } catch (error: unknown) {
        // unknown 타입의 에러를 안전하게 처리
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(`Error in game loop for room ${roomId}: ${errorMessage}`, errorStack);
        this.stopGameLoop(roomId); // 에러 발생 시 루프 중지 (숫자 ID 사용)
      }
    }, 1000 / 60); // 60fps

    this.gameLoops.set(roomId, interval); // 숫자 ID로 인터벌 저장
  }

  /**
   * 특정 방의 게임 루프를 중지합니다.
   * @param roomId - 게임 루프를 중지할 방의 숫자 ID
   */
  stopGameLoop(roomId: number) {
    // roomId 타입을 number로 변경
    const interval = this.gameLoops.get(roomId);
    if (interval) {
      clearInterval(interval);
      this.gameLoops.delete(roomId);
      this.logger.log(`Stopped game loop for room ${roomId}`);
    } else {
      // 루프가 없을 때 경고 로그는 유지
      // this.logger.warn(`No active game loop found for room ${roomId} to stop.`);
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
