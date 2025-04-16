import { io, Socket } from 'socket.io-client';
import { GameState, Skills } from '../types/GameTypes';

// 백엔드 서버의 주소
const SOCKET_URL = 'http://localhost:3000/game';

export class GameSocketService {
  private socket: Socket;
  private roomId: number | null = null;
  private gameStateListeners: ((state: GameState) => void)[] = [];
  private gameInitializedListeners: ((data: any) => void)[] = [];
  private gameStartedListeners: ((data: any) => void)[] = [];
  private gameFinishedListeners: ((data: any) => void)[] = [];
  private mapChangedListeners: ((data: any) => void)[] = [];
  private errorListeners: ((error: any) => void)[] = [];

  constructor() {
    // 소켓 연결 생성
    this.socket = io(SOCKET_URL);

    // 이벤트 핸들러 설정
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // 게임 상태 업데이트 이벤트 리스너
    this.socket.on('gameStateUpdated', (state: GameState) => {
      this.gameStateListeners.forEach(listener => listener(state));
    });

    // 게임 초기화 완료 이벤트 리스너
    this.socket.on('gameInitialized', (data) => {
      this.gameInitializedListeners.forEach(listener => listener(data));
    });

    // 게임 시작 이벤트 리스너
    this.socket.on('gameStarted', (data) => {
      this.gameStartedListeners.forEach(listener => listener(data));
    });

    // 게임 종료 이벤트 리스너
    this.socket.on('gameFinished', (data) => {
      this.gameFinishedListeners.forEach(listener => listener(data));
    });

    // 맵 변경 이벤트 리스너
    this.socket.on('mapChanged', (data) => {
      this.mapChangedListeners.forEach(listener => listener(data));
    });

    // 에러 이벤트 리스너
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.errorListeners.forEach(listener => listener(error));
    });

    // 연결 이벤트 리스너
    this.socket.on('connect', () => {
      console.log('Connected to game socket server');
    });

    // 연결 해제 이벤트 리스너
    this.socket.on('disconnect', () => {
      console.log('Disconnected from game socket server');
    });
  }

  // 게임 초기화
  public initializeGame(roomId: number): Promise<GameState> {
    return new Promise((resolve, reject) => {
      this.roomId = roomId;
      
      // 일회성 게임 초기화 완료 이벤트 리스너
      const onInitialized = (data: any) => {
        if (data.roomId === roomId) {
          resolve(data.gameState);
          this.socket.off('gameInitialized', onInitialized);
        }
      };
      
      this.socket.on('gameInitialized', onInitialized);
      
      // 에러 핸들링
      const onError = (error: any) => {
        reject(error);
        this.socket.off('error', onError);
      };
      
      this.socket.on('error', onError);
      
      // 초기화 요청 전송
      this.socket.emit('initializeGame', { roomId });
    });
  }

  // 게임 상태 요청
  public getGameState(roomId: number): Promise<GameState> {
    return new Promise((resolve, reject) => {
      // 일회성 게임 상태 응답 리스너
      const onGameState = (state: GameState) => {
        resolve(state);
        this.socket.off('gameState', onGameState);
      };
      
      this.socket.on('gameState', onGameState);
      
      // 에러 핸들링
      const onError = (error: any) => {
        reject(error);
        this.socket.off('error', onError);
      };
      
      this.socket.on('error', onError);
      
      // 게임 상태 요청 전송
      this.socket.emit('getGameState', { roomId });
    });
  }

  // 마블 설정
  public setMarbles(roomId: number, names: string[]): void {
    if (!this.roomId) {
      console.error('Game not initialized');
      return;
    }
    
    this.socket.emit('setMarbles', { roomId, names });
  }

  // 게임 시작
  public startGame(roomId: number): void {
    if (!this.roomId) {
      console.error('Game not initialized');
      return;
    }
    
    this.socket.emit('startGame', { roomId });
  }

  // 맵 설정
  public setMap(roomId: number, mapIndex: number): void {
    if (!this.roomId) {
      console.error('Game not initialized');
      return;
    }
    
    this.socket.emit('setMap', { roomId, mapIndex });
  }

  // 마블 흔들기
  public shakeMarble(roomId: number, marbleId: number): void {
    if (!this.roomId) {
      console.error('Game not initialized');
      return;
    }
    
    this.socket.emit('shakeMarble', { roomId, marbleId });
  }

  // 게임 리셋
  public resetGame(roomId: number): void {
    if (!this.roomId) {
      console.error('Game not initialized');
      return;
    }
    
    this.socket.emit('resetGame', { roomId });
  }

  // 맵 목록 요청
  public getMaps(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      // 일회성 맵 목록 응답 리스너
      const onMapsList = (data: { maps: string[] }) => {
        resolve(data.maps);
        this.socket.off('mapsList', onMapsList);
      };
      
      this.socket.on('mapsList', onMapsList);
      
      // 에러 핸들링
      const onError = (error: any) => {
        reject(error);
        this.socket.off('error', onError);
      };
      
      this.socket.on('error', onError);
      
      // 맵 목록 요청 전송
      this.socket.emit('getMaps');
    });
  }

  // 이벤트 리스너 등록 메서드들
  public onGameStateUpdated(listener: (state: GameState) => void): void {
    this.gameStateListeners.push(listener);
  }

  public onGameInitialized(listener: (data: any) => void): void {
    this.gameInitializedListeners.push(listener);
  }

  public onGameStarted(listener: (data: any) => void): void {
    this.gameStartedListeners.push(listener);
  }

  public onGameFinished(listener: (data: any) => void): void {
    this.gameFinishedListeners.push(listener);
  }

  public onMapChanged(listener: (data: any) => void): void {
    this.mapChangedListeners.push(listener);
  }

  public onError(listener: (error: any) => void): void {
    this.errorListeners.push(listener);
  }

  // 이벤트 리스너 제거 메서드들
  public offGameStateUpdated(listener: (state: GameState) => void): void {
    this.gameStateListeners = this.gameStateListeners.filter(l => l !== listener);
  }

  public offGameInitialized(listener: (data: any) => void): void {
    this.gameInitializedListeners = this.gameInitializedListeners.filter(l => l !== listener);
  }

  public offGameStarted(listener: (data: any) => void): void {
    this.gameStartedListeners = this.gameStartedListeners.filter(l => l !== listener);
  }

  public offGameFinished(listener: (data: any) => void): void {
    this.gameFinishedListeners = this.gameFinishedListeners.filter(l => l !== listener);
  }

  public offMapChanged(listener: (data: any) => void): void {
    this.mapChangedListeners = this.mapChangedListeners.filter(l => l !== listener);
  }

  public offError(listener: (error: any) => void): void {
    this.errorListeners = this.errorListeners.filter(l => l !== listener);
  }

  // 연결 종료
  public disconnect(): void {
    this.socket.disconnect();
  }
} 