import { io, Socket } from 'socket.io-client';

export interface GameState {
  marbles: any[];
  winners: any[];
  winner: any | null;
  entities: any[];
  isRunning: boolean;
  winnerRank: number;
  totalMarbleCount: number;
  shakeAvailable: boolean;
}

export class GameSocketService {
  private socket: Socket | null = null;
  private _gameState: GameState | null = null;
  private _availableMaps: any[] = [];
  private _listeners: Map<string, Function[]> = new Map();

  constructor() {}

  // 소켓 연결
  connect(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io('http://localhost:3000/game', {
          transports: ['websocket'],
          upgrade: false,
        });

        this.socket.on('connect', () => {
          console.log('소켓 연결 성공', this.socket?.id);
          this.joinRoom(roomId)
            .then(() => resolve())
            .catch(reject);
        });

        this.socket.on('connect_error', (error) => {
          console.error('소켓 연결 오류:', error);
          reject(error);
        });

        // 게임 상태 이벤트 리스너
        this.socket.on('game_state', (state: GameState) => {
          this._gameState = state;
          this._emit('gameStateChanged', state);
        });

        // 게임 시작 이벤트 리스너
        this.socket.on('game_started', () => {
          this._emit('gameStarted');
        });

        // 게임 종료 이벤트 리스너
        this.socket.on('game_over', (data: { winner: any }) => {
          this._emit('gameOver', data.winner);
        });

        // 게임 리셋 이벤트 리스너
        this.socket.on('game_reset', () => {
          this._emit('gameReset');
        });

        // 가용 맵 이벤트 리스너
        this.socket.on('available_maps', (maps: any[]) => {
          this._availableMaps = maps;
          this._emit('availableMapsChanged', maps);
        });

        // 속도 변경 이벤트 리스너
        this.socket.on('speed_changed', (data: { speed: number }) => {
          this._emit('speedChanged', data.speed);
        });

        // 플레이어 참가 이벤트 리스너
        this.socket.on('player_joined', (data: { playerId: string }) => {
          this._emit('playerJoined', data.playerId);
        });

        // 플레이어 퇴장 이벤트 리스너
        this.socket.on('player_left', (data: { playerId: string }) => {
          this._emit('playerLeft', data.playerId);
        });
      } catch (error) {
        console.error('소켓 초기화 오류:', error);
        reject(error);
      }
    });
  }

  // 방 참가
  joinRoom(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('소켓이 연결되지 않았습니다.'));
      }

      this.socket.emit('join_room', { roomId }, (response: any) => {
        if (response.success) {
          console.log('방 참가 성공:', response.message);
          resolve();
        } else {
          console.error('방 참가 실패:', response.message);
          reject(new Error(response.message));
        }
      });
    });
  }

  // 방 퇴장
  leaveRoom(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('소켓이 연결되지 않았습니다.'));
      }

      this.socket.emit('leave_room', { roomId }, (response: any) => {
        if (response.success) {
          console.log('방 퇴장 성공:', response.message);
          resolve();
        } else {
          console.error('방 퇴장 실패:', response.message);
          reject(new Error(response.message));
        }
      });
    });
  }

  // 마블 설정
  setMarbles(roomId: string, names: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('소켓이 연결되지 않았습니다.'));
      }

      this.socket.emit('set_marbles', { roomId, names }, (response: any) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error('마블 설정 실패'));
        }
      });
    });
  }

  // 우승 순위 설정
  setWinningRank(roomId: string, rank: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('소켓이 연결되지 않았습니다.'));
      }

      this.socket.emit('set_winning_rank', { roomId, rank }, (response: any) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error('우승 순위 설정 실패'));
        }
      });
    });
  }

  // 맵 설정
  setMap(roomId: string, mapIndex: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('소켓이 연결되지 않았습니다.'));
      }

      this.socket.emit('set_map', { roomId, mapIndex }, (response: any) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error('맵 설정 실패'));
        }
      });
    });
  }

  // 게임 속도 설정
  setSpeed(roomId: string, speed: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('소켓이 연결되지 않았습니다.'));
      }

      this.socket.emit('set_speed', { roomId, speed }, (response: any) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error('게임 속도 설정 실패'));
        }
      });
    });
  }

  // 게임 시작
  startGame(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('소켓이 연결되지 않았습니다.'));
      }

      this.socket.emit('start_game', { roomId }, (response: any) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error('게임 시작 실패'));
        }
      });
    });
  }

  // 게임 리셋
  resetGame(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('소켓이 연결되지 않았습니다.'));
      }

      this.socket.emit('reset_game', { roomId }, (response: any) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error('게임 리셋 실패'));
        }
      });
    });
  }

  // 게임 상태 요청
  getGameState(roomId: string): Promise<GameState> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('소켓이 연결되지 않았습니다.'));
      }

      this.socket.emit('get_game_state', { roomId }, (response: any) => {
        if (response.success) {
          this._gameState = response.gameState;
          resolve(response.gameState);
        } else {
          reject(new Error('게임 상태 요청 실패'));
        }
      });
    });
  }

  // 맵 목록 요청
  getMaps(roomId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('소켓이 연결되지 않았습니다.'));
      }

      this.socket.emit('get_maps', { roomId }, (response: any) => {
        if (response.success) {
          this._availableMaps = response.maps;
          resolve(response.maps);
        } else {
          reject(new Error('맵 목록 요청 실패'));
        }
      });
    });
  }

  // 현재 게임 상태 조회
  get gameState(): GameState | null {
    return this._gameState;
  }

  // 사용 가능한 맵 목록 조회
  get availableMaps(): any[] {
    return this._availableMaps;
  }

  // 연결 종료
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // 이벤트 리스너 등록
  on(event: string, callback: Function): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event)!.push(callback);
  }

  // 이벤트 리스너 제거
  off(event: string, callback: Function): void {
    if (!this._listeners.has(event)) return;
    
    const listeners = this._listeners.get(event)!;
    const index = listeners.indexOf(callback);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  // 이벤트 발생
  private _emit(event: string, ...args: any[]): void {
    if (!this._listeners.has(event)) return;
    
    const listeners = this._listeners.get(event)!;
    listeners.forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`이벤트 리스너 실행 오류 (${event}):`, error);
      }
    });
  }
}