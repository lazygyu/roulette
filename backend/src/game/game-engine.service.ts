import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Server } from 'socket.io';
import { GameSessionService } from './game-session.service'; // GameSessionService 임포트
import { prefixRoomId } from './utils/roomId.util'; // prefixRoomId 유틸리티 임포트

@Injectable()
export class GameEngineService implements OnModuleDestroy { // OnModuleDestroy 인터페이스 구현 명시
  private readonly logger = new Logger(GameEngineService.name);
  // gameLoops Map의 key 타입을 number로 변경
  private gameLoops: Map<number, NodeJS.Timeout> = new Map();

  // GameSessionService 주입
  constructor(private readonly gameSessionService: GameSessionService) {}

  /**
   * 특정 방의 게임 루프를 시작합니다.
   * @param roomId - 게임 루프를 시작할 방의 숫자 ID
   * @param server - 클라이언트에게 상태를 전송할 Socket.IO 서버 인스턴스
   */
  startGameLoop(roomId: number, server: Server) { // roomId 타입을 number로 변경
    if (this.gameLoops.has(roomId)) {
      this.logger.warn(`Game loop for room ${roomId} is already running.`);
      return;
    }

    this.logger.log(`Starting game loop for room ${roomId}`);
    // Socket.IO 통신을 위한 접두사 붙은 ID 생성
    const prefixedRoomId = prefixRoomId(roomId);

    const interval = setInterval(() => {
      try {
        // GameSessionService에서 숫자 ID로 게임 상태 가져오기
        const gameState = this.gameSessionService.getGameState(roomId);
        if (gameState) {
          // 게임 상태 업데이트 전송 (접두사 붙은 ID 사용)
          server.to(prefixedRoomId).emit('game_state', gameState);

          // 게임이 종료되었는지 확인
          if (!gameState.isRunning) {
            this.logger.log(`Game in room ${roomId} has ended. Stopping loop.`);
            this.stopGameLoop(roomId); // 숫자 ID로 루프 중지
            // 게임 종료 이벤트 전송 (접두사 붙은 ID 사용)
            server.to(prefixedRoomId).emit('game_over', {
              winner: gameState.winner, // winner 정보가 gameState에 있다고 가정
            });
          }
        } else {
          // 게임 상태를 가져올 수 없으면 루프 중지 (예: 방이 사라짐)
          this.logger.warn(`Could not get game state for room ${roomId}. Stopping loop.`);
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
  stopGameLoop(roomId: number) { // roomId 타입을 number로 변경
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
  isLoopRunning(roomId: number): boolean { // roomId 타입을 number로 변경
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
