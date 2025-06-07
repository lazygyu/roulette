import { io, Socket } from 'socket.io-client';
import { GameState, MapInfo } from '../types/gameTypes';

interface PlayerJoinedData {
  playerId: string;
  userInfo: { nickname: string };
}
interface PlayerLeftData {
  playerId: string;
}
interface GameOverData {
  winner?: { name: string; color: string };
}
interface SpeedChangedData {
  speed: number;
}

interface JoinRoomResponse {
  success: boolean;
  message?: string;
  gameState?: GameState;
  requiresPassword?: boolean;
}

class SocketService {
  private socket: Socket | null = null;
  private currentRoomId: string | null = null;
  private joinedRooms: Set<string> = new Set();
  private isConnecting: boolean = false;
  private latestAvailableMaps: MapInfo[] | null = null;

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
        resolve();
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

      this.isConnecting = true;

      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = location.hostname;
      const port = process.env.NODE_ENV === 'production' ? location.port : '3000';
      const socketUrl = `${protocol}//${host}:${port}/game`;

      console.log(`Connecting to socket server at ${socketUrl} for room ${roomId}...`);
      const token = localStorage.getItem('access_token');
      this.socket = io(socketUrl, {
        auth: {
          token: token,
        },
      });

      this.socket.on('connect', () => {
        console.log(`Socket connected: ${this.socket?.id}`);
        this.currentRoomId = roomId;
        this.setupEventListeners();

        console.log(`Socket connected for room ${roomId}. Ready for explicit joinRoom call.`);
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log(`Socket disconnected: ${reason}`);
        this.currentRoomId = null;
        this.joinedRooms.clear();
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
        this.disconnect();
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

    this.socket.off('game_state').on('game_state', (gameState: GameState) => {
      this.gameStateListeners.forEach((listener) => listener(gameState));
    });

    this.socket.off('available_maps').on('available_maps', (maps: MapInfo[]) => {
      this.latestAvailableMaps = maps;
      this.availableMapsListeners.forEach((listener) => listener(maps));
    });

    this.socket.off('player_joined').on('player_joined', (data: PlayerJoinedData) => {
      this.playerJoinedListeners.forEach((listener) => listener(data));
    });

    this.socket.off('player_left').on('player_left', (data: PlayerLeftData) => {
      this.playerLeftListeners.forEach((listener) => listener(data));
    });

    this.socket.off('game_started').on('game_started', () => {
      this.gameStartedListeners.forEach((listener) => listener());
    });

    this.socket.off('game_reset').on('game_reset', () => {
      this.gameResetListeners.forEach((listener) => listener());
    });

    this.socket.off('game_over').on('game_over', (data: GameOverData) => {
      this.gameOverListeners.forEach((listener) => listener(data));
    });

    this.socket.off('speed_changed').on('speed_changed', (data: SpeedChangedData) => {
      this.speedChangedListeners.forEach((listener) => listener(data));
    });
  }

  public onGameStateUpdate(listener: (gameState: GameState) => void): () => void {
    this.gameStateListeners.push(listener);
    return () => {
      this.gameStateListeners = this.gameStateListeners.filter((l) => l !== listener);
    };
  }

  public onAvailableMapsUpdate(listener: (maps: MapInfo[]) => void): () => void {
    this.availableMapsListeners.push(listener);
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
    skillType: string,
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
    console.log('Socket disconnected by client call.');
  }

  public isConnected(): boolean {
    return !!this.socket?.connected;
  }

  public getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  public getJoinedStatus(roomId: string): boolean {
    return this.joinedRooms.has(roomId);
  }
}

const socketService = new SocketService();
export default socketService;
