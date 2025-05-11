// filepath: c:\Users\TAK\Desktop\2025 4-1\Capstone_Design\project\roulette\roulette-app\src\services\socketService.ts
import { io, Socket } from 'socket.io-client';
import { GameState, MapInfo } from '../types/gameTypes'; // 타입 가져오기

// 추가될 이벤트들에 대한 타입 정의 (필요시 gameTypes.ts 등으로 이동 가능)
interface PlayerJoinedData {
  playerId: string;
  userInfo: { nickname: string };
}
interface PlayerLeftData {
  playerId: string;
}
interface GameOverData {
  winner?: { name: string; color: string }; // 예시, 실제 데이터 구조에 맞게 조정
  // 기타 게임 종료 정보
}
interface SpeedChangedData {
  speed: number;
}


class SocketService {
  private socket: Socket | null = null;
  private currentRoomId: string | null = null;

  private gameStateListeners: Array<(gameState: GameState) => void> = [];
  private availableMapsListeners: Array<(maps: MapInfo[]) => void> = [];
  private playerJoinedListeners: Array<(data: PlayerJoinedData) => void> = [];
  private playerLeftListeners: Array<(data: PlayerLeftData) => void> = [];
  private gameStartedListeners: Array<() => void> = [];
  private gameResetListeners: Array<() => void> = [];
  private gameOverListeners: Array<(data: GameOverData) => void> = [];
  private speedChangedListeners: Array<(data: SpeedChangedData) => void> = [];


  public connect(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected && this.currentRoomId === roomId) {
        console.log('Socket already connected to this room.');
        resolve();
        return;
      }

      if (this.socket?.connected) {
        this.disconnect();
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const port = process.env.NODE_ENV === 'production' ? window.location.port : '3000';
      const socketUrl = `${protocol}//${host}:${port}/game`;

      console.log(`Connecting to socket server at ${socketUrl} for room ${roomId}...`);
      const token = localStorage.getItem('access_token');
      this.socket = io(socketUrl, {
        auth: {
          token: token ? `Bearer ${token}` : undefined,
        },
      });

      this.socket.on('connect', () => {
        console.log(`Socket connected: ${this.socket?.id}`);
        this.currentRoomId = roomId; // roomId 설정은 joinRoom 성공 후 또는 여기서 유지
        this.setupEventListeners();

        console.log(`Attempting to join room: ${roomId}`);
        // connect 성공 시 바로 joinRoom 호출
        this.joinRoom(roomId, (response) => {
          if (response.success) {
            console.log(`socketService: Successfully joined room ${roomId} (ack received).`);
            // this.currentRoomId = roomId; // joinRoom 성공 시 roomId 설정 (선택적 위치)
            resolve();
          } else {
            console.error(`socketService: Failed to join room ${roomId}: ${response.message}`);
            this.disconnect(); // 연결 실패 시 정리
            reject(new Error(response.message || 'Failed to join room'));
          }
        });
      });

      this.socket.on('disconnect', (reason) => {
        console.log(`Socket disconnected: ${reason}`);
        this.currentRoomId = null;
        // 모든 리스너 배열 초기화
        this.gameStateListeners = [];
        this.availableMapsListeners = [];
        this.playerJoinedListeners = [];
        this.playerLeftListeners = [];
        this.gameStartedListeners = [];
        this.gameResetListeners = [];
        this.gameOverListeners = [];
        this.speedChangedListeners = [];
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        this.disconnect(); // 연결 실패 시 정리
        reject(error);
      });
    });
  }

  private setupEventListeners(): void {
    if (!this.socket) {
      console.warn('socketService: Socket not available for setupEventListeners.');
      return;
    }
    console.log('socketService: Setting up event listeners.');

    // 기존 리스너 제거 후 새로 등록 (중복 방지)
    this.socket.off('game_state').on('game_state', (gameState: GameState) => {
      console.log('socketService: Received game_state:', gameState);
      this.gameStateListeners.forEach((listener) => listener(gameState));
    });

    this.socket.off('available_maps').on('available_maps', (maps: MapInfo[]) => {
      console.log('socketService: Received available_maps:', maps);
      this.availableMapsListeners.forEach((listener) => listener(maps));
    });

    this.socket.off('player_joined').on('player_joined', (data: PlayerJoinedData) => {
      console.log('socketService: Received player_joined:', data);
      this.playerJoinedListeners.forEach((listener) => listener(data));
    });

    this.socket.off('player_left').on('player_left', (data: PlayerLeftData) => {
      console.log('socketService: Received player_left:', data);
      this.playerLeftListeners.forEach((listener) => listener(data));
    });

    this.socket.off('game_started').on('game_started', () => {
      console.log('socketService: Received game_started');
      this.gameStartedListeners.forEach((listener) => listener());
    });

    this.socket.off('game_reset').on('game_reset', () => {
      console.log('socketService: Received game_reset');
      this.gameResetListeners.forEach((listener) => listener());
    });

    this.socket.off('game_over').on('game_over', (data: GameOverData) => {
      console.log('socketService: Received game_over:', data);
      this.gameOverListeners.forEach((listener) => listener(data));
    });

    this.socket.off('speed_changed').on('speed_changed', (data: SpeedChangedData) => {
      console.log('socketService: Received speed_changed:', data);
      this.speedChangedListeners.forEach((listener) => listener(data));
    });
  }

  // --- Listener Registration Methods ---
  public onGameStateUpdate(listener: (gameState: GameState) => void): () => void {
    this.gameStateListeners.push(listener);
    return () => {
      this.gameStateListeners = this.gameStateListeners.filter((l) => l !== listener);
    };
  }

  public onAvailableMapsUpdate(listener: (maps: MapInfo[]) => void): () => void {
    this.availableMapsListeners.push(listener);
    return () => {
      this.availableMapsListeners = this.availableMapsListeners.filter((l) => l !== listener);
    };
  }

  public onPlayerJoined(listener: (data: PlayerJoinedData) => void): () => void {
    this.playerJoinedListeners.push(listener);
    return () => {
      this.playerJoinedListeners = this.playerJoinedListeners.filter((l) => l !== listener);
    };
  }

  public onPlayerLeft(listener: (data: PlayerLeftData) => void): () => void {
    this.playerLeftListeners.push(listener);
    return () => {
      this.playerLeftListeners = this.playerLeftListeners.filter((l) => l !== listener);
    };
  }

  public onGameStarted(listener: () => void): () => void {
    this.gameStartedListeners.push(listener);
    return () => {
      this.gameStartedListeners = this.gameStartedListeners.filter((l) => l !== listener);
    };
  }

  public onGameReset(listener: () => void): () => void {
    this.gameResetListeners.push(listener);
    return () => {
      this.gameResetListeners = this.gameResetListeners.filter((l) => l !== listener);
    };
  }

  public onGameOver(listener: (data: GameOverData) => void): () => void {
    this.gameOverListeners.push(listener);
    return () => {
      this.gameOverListeners = this.gameOverListeners.filter((l) => l !== listener);
    };
  }

  public onSpeedChanged(listener: (data: SpeedChangedData) => void): () => void {
    this.speedChangedListeners.push(listener);
    return () => {
      this.speedChangedListeners = this.speedChangedListeners.filter((l) => l !== listener);
    };
  }

  // --- Room and Game Actions ---
  private joinRoom(roomId: string, callback: (response: { success: boolean; message?: string }) => void): void {
    if (!this.socket) {
      console.error('socketService: Socket not connected for joinRoom.');
      callback({ success: false, message: 'Socket not connected.' });
      return;
    }
    const userInfo = {
      nickname: localStorage.getItem('user_nickname') || `User_${Math.floor(Math.random() * 1000)}`,
    };
    this.socket.emit('join_room', { roomId, userInfo }, (response: { success: boolean; message?: string }) => {
      if (response.success) {
        localStorage.setItem('user_nickname', userInfo.nickname);
        this.currentRoomId = roomId; // 방 참여 성공 시 currentRoomId 설정
      }
      callback(response);
    });
  }

  public setMarbles(names: string[]): void {
    if (!this.socket || !this.currentRoomId) {
      console.warn('socketService: Cannot set marbles, socket not connected or not in a room.');
      return;
    }
    this.socket.emit('set_marbles', { roomId: this.currentRoomId, names });
  }

  public setWinningRank(rank: number): void {
    if (!this.socket || !this.currentRoomId) {
      console.warn('socketService: Cannot set winning rank, socket not connected or not in a room.');
      return;
    }
    this.socket.emit('set_winning_rank', { roomId: this.currentRoomId, rank });
  }

  public setMap(mapIndex: number): void {
    if (!this.socket || !this.currentRoomId) {
      console.warn('socketService: Cannot set map, socket not connected or not in a room.');
      return;
    }
    this.socket.emit('set_map', { roomId: this.currentRoomId, mapIndex });
  }

  public setSpeed(speed: number): void {
    if (!this.socket || !this.currentRoomId) {
      console.warn('socketService: Cannot set speed, socket not connected or not in a room.');
      return;
    }
    this.socket.emit('set_speed', { roomId: this.currentRoomId, speed });
  }

  public startGame(): void {
    if (!this.socket || !this.currentRoomId) {
      console.warn('socketService: Cannot start game, socket not connected or not in a room.');
      return;
    }
    this.socket.emit('start_game', { roomId: this.currentRoomId });
  }

  public resetGame(): void {
    if (!this.socket || !this.currentRoomId) {
      console.warn('socketService: Cannot reset game, socket not connected or not in a room.');
      return;
    }
    this.socket.emit('reset_game', { roomId: this.currentRoomId });
  }

  public disconnect(): void {
    this.socket?.disconnect();
    // currentRoomId 등은 disconnect 이벤트 핸들러에서 이미 초기화됨
    console.log('Socket disconnected by client call.');
  }

  public isConnected(): boolean {
    return !!this.socket?.connected;
  }
}

const socketService = new SocketService();
export default socketService;
