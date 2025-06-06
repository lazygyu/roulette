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

// join_room 응답 타입 정의
interface JoinRoomResponse {
  success: boolean;
  message?: string;
  gameState?: GameState; // 초기 게임 상태 포함 가능
  requiresPassword?: boolean; // 비밀번호 실패 시 true로 설정될 수 있음
}

class SocketService {
  private socket: Socket | null = null;
  private currentRoomId: string | null = null;
  private joinedRooms: Set<string> = new Set();
  private isConnecting: boolean = false; // 연결 시도 중인지 나타내는 상태 추가
  private latestAvailableMaps: MapInfo[] | null = null; // Cache for available maps

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
      if (this.isConnecting) {
        console.log('Socket connection already in progress.');
        resolve(); // 또는 reject('Connection in progress')
        return;
      }

      if (this.socket?.connected && this.currentRoomId === roomId) {
        console.log('Socket already connected to this room.');
        resolve();
        return;
      }

      if (this.socket?.connected) {
        this.disconnect();
      }

      this.isConnecting = true; // 연결 시도 시작

      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = location.hostname;
      const port = process.env.NODE_ENV === 'production' ? location.port : '3000';
      const socketUrl = `${protocol}//${host}:${port}/game`;

      console.log(`Connecting to socket server at ${socketUrl} for room ${roomId}...`);
      const token = localStorage.getItem('access_token'); // 'access_token' 키가 맞는지 확인 필요
      this.socket = io(socketUrl, {
        auth: {
          token: token, // 'Bearer ' 접두사 제거
        },
      });

      this.socket.on('connect', () => {
        console.log(`Socket connected: ${this.socket?.id}`);
        this.currentRoomId = roomId; // roomId 설정은 연결 시 우선 유지
        this.setupEventListeners();

        // GamePage.tsx에서 방 정보 확인 후 joinRoom을 명시적으로 호출하도록 변경합니다.
        // 여기서는 소켓 연결 성공 시 바로 resolve 합니다.
        console.log(`Socket connected for room ${roomId}. Ready for explicit joinRoom call.`);
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log(`Socket disconnected: ${reason}`);
        this.currentRoomId = null;
        this.joinedRooms.clear();
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
      // console.debug('socketService: Received game_state:', gameState);
      this.gameStateListeners.forEach((listener) => listener(gameState));
    });

    this.socket.off('available_maps').on('available_maps', (maps: MapInfo[]) => {
      // console.debug('socketService: Received available_maps:', maps);
      this.latestAvailableMaps = maps; // Cache the maps
      this.availableMapsListeners.forEach((listener) => listener(maps));
    });

    this.socket.off('player_joined').on('player_joined', (data: PlayerJoinedData) => {
      // console.debug('socketService: Received player_joined:', data);
      this.playerJoinedListeners.forEach((listener) => listener(data));
    });

    this.socket.off('player_left').on('player_left', (data: PlayerLeftData) => {
      // console.debug('socketService: Received player_left:', data);
      this.playerLeftListeners.forEach((listener) => listener(data));
    });

    this.socket.off('game_started').on('game_started', () => {
      // console.debug('socketService: Received game_started');
      this.gameStartedListeners.forEach((listener) => listener());
    });

    this.socket.off('game_reset').on('game_reset', () => {
      // console.debug('socketService: Received game_reset');
      this.gameResetListeners.forEach((listener) => listener());
    });

    this.socket.off('game_over').on('game_over', (data: GameOverData) => {
      // console.debug('socketService: Received game_over:', data);
      this.gameOverListeners.forEach((listener) => listener(data));
    });

    this.socket.off('speed_changed').on('speed_changed', (data: SpeedChangedData) => {
      // console.debug('socketService: Received speed_changed:', data);
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
    // If maps are already available, call the listener immediately
    if (this.latestAvailableMaps) {
      listener(this.latestAvailableMaps);
    }
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
  // joinRoom 메서드를 public으로 변경하고 password 인자 추가
  public async joinRoom(roomId: string, password?: string): Promise<JoinRoomResponse> {
    if (!this.socket) {
      console.error('socketService: Socket not connected for joinRoom.');
      return { success: false, message: 'Socket not connected.' };
    }
    const response: JoinRoomResponse = await this.socket.emitWithAck('join_room', { roomId, password });
    if (response.success) {
      this.currentRoomId = roomId;
      this.joinedRooms.add(roomId);
    }
    return response;
  }

  public async setMarbles(names: string[]): Promise<{ success: boolean; message?: string }> {
    if (!this.socket || !this.currentRoomId) {
      console.warn('socketService: Cannot set marbles, socket not connected or not in a room.');
      return { success: false, message: 'Socket not connected or not in a room.' };
    }
    return await this.socket.emitWithAck('set_marbles', { roomId: this.currentRoomId, names });
  }

  public async setWinningRank(rank: number): Promise<{ success: boolean; message?: string }> {
    if (!this.socket || !this.currentRoomId) {
      console.warn('socketService: Cannot set winning rank, socket not connected or not in a room.');
      return { success: false, message: 'Socket not connected or not in a room.' };
    }
    return await this.socket.emitWithAck('set_winning_rank', { roomId: this.currentRoomId, rank });
  }

  public async setMap(mapIndex: number): Promise<{ success: boolean; message?: string }> {
    if (!this.socket || !this.currentRoomId) {
      console.warn('socketService: Cannot set map, socket not connected or not in a room.');
      return { success: false, message: 'Socket not connected or not in a room.' };
    }
    return await this.socket.emitWithAck('set_map', { roomId: this.currentRoomId, mapIndex });
  }

  public async setSpeed(speed: number): Promise<{ success: boolean; message?: string }> {
    if (!this.socket || !this.currentRoomId) {
      console.warn('socketService: Cannot set speed, socket not connected or not in a room.');
      return { success: false, message: 'Socket not connected or not in a room.' };
    }
    return await this.socket.emitWithAck('set_speed', { roomId: this.currentRoomId, speed });
  }

  public async startGame(): Promise<{ success: boolean; message?: string }> {
    if (!this.socket || !this.currentRoomId) {
      console.warn('socketService: Cannot start game, socket not connected or not in a room.');
      return { success: false, message: 'Socket not connected or not in a room.' };
    }
    return await this.socket.emitWithAck('start_game', { roomId: this.currentRoomId });
  }

  public async resetGame(): Promise<{ success: boolean; message?: string }> {
    if (!this.socket || !this.currentRoomId) {
      console.warn('socketService: Cannot reset game, socket not connected or not in a room.');
      return { success: false, message: 'Socket not connected or not in a room.' };
    }
    return await this.socket.emitWithAck('reset_game', { roomId: this.currentRoomId });
  }

  public async useSkill(
    skillType: string, // Skills enum 대신 string으로 받음 (백엔드와 통일)
    skillPosition: { x: number; y: number },
    extra: any,
  ): Promise<{ success: boolean; message?: string }> {
    if (!this.socket || !this.currentRoomId) {
      console.warn('socketService: Cannot use skill, socket not connected or not in a room.');
      return { success: false, message: 'Socket not connected or not in a room.' };
    }
    return await this.socket.emitWithAck('use_skill', {
      roomId: this.currentRoomId,
      skillType,
      skillPosition,
      extra,
    });
  }

  public disconnect(): void {
    this.socket?.disconnect();
    // currentRoomId 등은 disconnect 이벤트 핸들러에서 이미 초기화됨
    console.log('Socket disconnected by client call.');
  }

  public isConnected(): boolean {
    return !!this.socket?.connected;
  }

  public getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  // Method to check if the client has successfully joined a specific room
  public getJoinedStatus(roomId: string): boolean {
    return this.joinedRooms.has(roomId);
  }
}

const socketService = new SocketService();
export default socketService;
