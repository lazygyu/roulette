import { Injectable, Logger } from '@nestjs/common';
import { Marble } from './models/marble.model';
import { MatterPhysics } from './models/matter-physics.model';
import { stages } from './data/maps';
import { Skills } from './types/marble.type';
import { GameState, GameStatus } from './types/game-state.type';
import { IPhysics } from './interfaces/physics.interface';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  
  // 각 방별로 게임 상태 관리
  private gameStates = new Map<number, GameState>();
  private physics = new Map<number, IPhysics>();
  private updateIntervals = new Map<number, NodeJS.Timeout>();
  
  // 게임 상태 업데이트 주기 (밀리초)
  private readonly UPDATE_INTERVAL = 16; // 약 60fps
  
  constructor() {}
  
  // 방에 대한 게임 세션 초기화
  async initializeGame(roomId: number): Promise<GameState> {
    if (this.gameStates.has(roomId)) {
      return this.gameStates.get(roomId)!;
    }
    
    const physicsEngine = new MatterPhysics();
    await physicsEngine.init();
    this.physics.set(roomId, physicsEngine);
    
    const initialState: GameState = {
      roomId,
      status: GameStatus.WAITING,
      marbles: [],
      winners: [],
      entities: [],
      stage: null,
      winnerRank: 0,
      lastUpdateTime: Date.now(),
      winner: null,
      isReady: false,
    };
    
    this.gameStates.set(roomId, initialState);
    
    // 첫 번째 맵 로드
    this.setMap(roomId, 0);
    
    return initialState;
  }
  
  // 방 게임 정리
  cleanupGame(roomId: number): void {
    if (this.updateIntervals.has(roomId)) {
      clearInterval(this.updateIntervals.get(roomId)!);
      this.updateIntervals.delete(roomId);
    }
    
    if (this.physics.has(roomId)) {
      const physicsEngine = this.physics.get(roomId)!;
      physicsEngine.clear();
      this.physics.delete(roomId);
    }
    
    this.gameStates.delete(roomId);
  }
  
  // 게임 상태 가져오기
  getGameState(roomId: number): GameState | null {
    const gameState = this.gameStates.get(roomId) || null;
    if (!gameState) return null;
    
    // 직렬화가 가능한 깔끔한 상태 객체 반환
    return {
      roomId: gameState.roomId,
      status: gameState.status,
      marbles: gameState.marbles.map(marble => ({...marble})), // 깊은 복사로 참조 끊기
      winners: gameState.winners.map(winner => ({...winner})), // 깊은 복사로 참조 끊기
      entities: gameState.entities.map(entity => ({...entity})), // 깊은 복사로 참조 끊기
      stage: gameState.stage ? {...gameState.stage} : null, // 깊은 복사로 참조 끊기
      winnerRank: gameState.winnerRank,
      lastUpdateTime: gameState.lastUpdateTime,
      winner: gameState.winner ? {...gameState.winner} : null, // 깊은 복사로 참조 끊기
      isReady: gameState.isReady
    };
  }
  
  // 맵 설정
  setMap(roomId: number, mapIndex: number): void {
    if (!this.gameStates.has(roomId) || !this.physics.has(roomId)) {
      this.logger.error(`Game not initialized for room ${roomId}`);
      return;
    }
    
    const gameState = this.gameStates.get(roomId)!;
    const physicsEngine = this.physics.get(roomId)!;
    
    // 기존 맵 정리
    physicsEngine.clear();
    
    // 새 맵 설정
    const stage = stages[mapIndex % stages.length];
    gameState.stage = stage;
    
    // 맵 생성
    physicsEngine.createStage(stage);
    
    // 엔티티 업데이트
    gameState.entities = physicsEngine.getEntities();
    
    // 상태 업데이트
    this.gameStates.set(roomId, gameState);
  }
  
  // 마블 설정
  setMarbles(roomId: number, names: string[]): void {
    if (!this.gameStates.has(roomId) || !this.physics.has(roomId)) {
      this.logger.error(`Game not initialized for room ${roomId}`);
      return;
    }
    
    const gameState = this.gameStates.get(roomId)!;
    const physicsEngine = this.physics.get(roomId)!;
    
    // 이전 마블 제거
    physicsEngine.clearMarbles();
    gameState.marbles = [];
    gameState.winners = [];
    gameState.winner = null;
    
    // 새 마블 생성
    const marbles = names.map((name, i) => {
      return new Marble(physicsEngine, i, names.length, name);
    });
    
    // 우승자 순위 설정
    gameState.winnerRank = Math.floor(marbles.length / 2);
    
    // 마블 상태 업데이트
    gameState.marbles = marbles.map(marble => marble.getState());
    
    // 게임 상태 업데이트
    gameState.status = GameStatus.READY;
    gameState.isReady = true;
    
    this.gameStates.set(roomId, gameState);
  }
  
  // 게임 시작
  startGame(roomId: number): void {
    if (!this.gameStates.has(roomId) || !this.physics.has(roomId)) {
      this.logger.error(`Game not initialized for room ${roomId}`);
      return;
    }
    
    const gameState = this.gameStates.get(roomId)!;
    const physicsEngine = this.physics.get(roomId)!;
    
    if (gameState.status !== GameStatus.READY) {
      this.logger.warn(`Game in room ${roomId} is not ready to start`);
      return;
    }
    
    // 물리 엔진 시작
    physicsEngine.start();
    
    // 마블 활성화
    gameState.marbles.forEach(marble => {
      marble.isActive = true;
    });
    
    // 게임 상태 업데이트
    gameState.status = GameStatus.RUNNING;
    gameState.lastUpdateTime = Date.now();
    
    // 업데이트 간격 설정
    if (this.updateIntervals.has(roomId)) {
      clearInterval(this.updateIntervals.get(roomId)!);
    }
    
    const intervalId = setInterval(() => {
      this.updateGame(roomId);
    }, this.UPDATE_INTERVAL);
    
    this.updateIntervals.set(roomId, intervalId);
  }
  
  // 게임 상태 업데이트
  private updateGame(roomId: number): void {
    if (!this.gameStates.has(roomId) || !this.physics.has(roomId)) {
      return;
    }
    
    const gameState = this.gameStates.get(roomId)!;
    const physicsEngine = this.physics.get(roomId)!;
    
    if (gameState.status !== GameStatus.RUNNING) {
      return;
    }
    
    // 현재 시간
    const currentTime = Date.now();
    const deltaTime = currentTime - gameState.lastUpdateTime;
    gameState.lastUpdateTime = currentTime;
    
    // 물리 시뮬레이션 업데이트
    const deltaSeconds = deltaTime / 1000;
    physicsEngine.step(deltaSeconds);
    
    // 마블 업데이트
    this.updateMarbles(roomId, deltaTime);
    
    // 엔티티 상태 업데이트
    gameState.entities = physicsEngine.getEntities();
  }
  
  // 마블 업데이트
  private updateMarbles(roomId: number, deltaTime: number): void {
    const gameState = this.gameStates.get(roomId)!;
    const physicsEngine = this.physics.get(roomId)!;
    const stage = gameState.stage;
    
    if (!stage) return;
    
    // 마블을 y좌표 기준으로 정렬 (내림차순)
    gameState.marbles.sort((a, b) => b.position.y - a.position.y);
    
    for (let i = 0; i < gameState.marbles.length; i++) {
      const marble = gameState.marbles[i];
      
      // 실제 위치 업데이트
      const position = physicsEngine.getMarblePosition(marble.id);
      marble.position = position;
      
      // 마블이 골에 도달했는지 확인
      if (marble.position.y > stage.goalY) {
        gameState.winners.push({ ...marble });
        
        // 우승자 결정
        if (gameState.status === GameStatus.RUNNING && 
            gameState.winners.length === gameState.winnerRank + 1) {
          
          gameState.winner = { ...marble };
          gameState.status = GameStatus.FINISHED;
          
          // 게임 종료 정리
          if (this.updateIntervals.has(roomId)) {
            setTimeout(() => {
              if (this.updateIntervals.has(roomId)) {
                clearInterval(this.updateIntervals.get(roomId)!);
                this.updateIntervals.delete(roomId);
              }
            }, 1000);
          }
        }
        
        // 물리 엔진에서 마블 제거
        setTimeout(() => {
          physicsEngine.removeMarble(marble.id);
        }, 500);
      }
      
      // 스킬 사용
      if (marble.skill === Skills.Impact) {
        physicsEngine.impact(marble.id);
        marble.skill = Skills.None;
      }
    }
    
    // 골에 도달한 마블 제거
    gameState.marbles = gameState.marbles.filter(
      (marble) => marble.position.y <= stage.goalY
    );
  }
  
  // 마블 흔들기
  shakeMarble(roomId: number, marbleId: number): void {
    if (!this.gameStates.has(roomId) || !this.physics.has(roomId)) {
      return;
    }
    
    const physicsEngine = this.physics.get(roomId)!;
    physicsEngine.shakeMarble(marbleId);
  }
  
  // 게임 리셋
  resetGame(roomId: number): void {
    if (!this.gameStates.has(roomId)) {
      return;
    }
    
    // 업데이트 중지
    if (this.updateIntervals.has(roomId)) {
      clearInterval(this.updateIntervals.get(roomId)!);
      this.updateIntervals.delete(roomId);
    }
    
    const gameState = this.gameStates.get(roomId)!;
    const physicsEngine = this.physics.get(roomId)!;
    
    // 물리 엔진 초기화
    physicsEngine.clear();
    
    // 맵 다시 로드
    const currentStage = gameState.stage;
    if (currentStage) {
      physicsEngine.createStage(currentStage);
    }
    
    // 마블 초기화
    physicsEngine.clearMarbles();
    
    // 상태 초기화
    gameState.marbles = [];
    gameState.winners = [];
    gameState.status = GameStatus.WAITING;
    gameState.winner = null;
    
    this.gameStates.set(roomId, gameState);
  }
  
  // 사용 가능한 맵 목록 가져오기
  getMaps(): string[] {
    return stages.map(stage => stage.title);
  }
} 