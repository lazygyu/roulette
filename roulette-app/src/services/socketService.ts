// filepath: c:\Users\TAK\Desktop\2025 4-1\Capstone_Design\project\roulette\roulette-app\src\services\socketService.ts
import { io, Socket } from 'socket.io-client';
import { GameState, MapInfo } from '../types/gameTypes'; // 타입 가져오기

class SocketService {
  private socket: Socket | null = null;
  private currentRoomId: string | null = null;

  private gameStateListeners: Array<(gameState: GameState) => void> = [];
  private availableMapsListeners: Array<(maps: MapInfo[]) => void> = [];

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
      this.socket = io(socketUrl);

      this.socket.on('connect', () => {
        console.log(`Socket connected: ${this.socket?.id}`);
        this.currentRoomId = roomId;
        this.setupEventListeners();

        console.log(`Attempting to join room: ${roomId}`);
        this.joinRoom(roomId, (response) => {
          if (response.success) {
            console.log(`socketService: Successfully joined room ${roomId} (ack received).`);
            resolve();
          } else {
            console.error(`socketService: Failed to join room ${roomId}: ${response.message}`);
            this.disconnect();
            reject(new Error(response.message || 'Failed to join room'));
          }
        });
      });

      this.socket.on('disconnect', (reason) => {
        console.log(`Socket disconnected: ${reason}`);
        this.currentRoomId = null;
        this.gameStateListeners = [];
        this.availableMapsListeners = [];
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
    console.log('socketService: Setting up event listeners (game_state, available_maps, etc.).');

    this.socket.off('game_state');
    this.socket.on('game_state', (gameState: GameState) => {
      // 타입 명시
      console.log('socketService: Received game_state:', gameState);
      this.gameStateListeners.forEach((listener) => listener(gameState));
    });

    this.socket.off('available_maps');
    this.socket.on('available_maps', (maps: MapInfo[]) => {
      // 타입 명시
      console.log('socketService: Received available_maps:', maps);
      this.availableMapsListeners.forEach((listener) => listener(maps));
    });
  }

  public onGameStateUpdate(listener: (gameState: GameState) => void): () => void {
    // 타입 명시
    this.gameStateListeners.push(listener);
    return () => {
      this.gameStateListeners = this.gameStateListeners.filter((l) => l !== listener);
    };
  }

  public onAvailableMapsUpdate(listener: (maps: MapInfo[]) => void): () => void {
    // 타입 명시
    this.availableMapsListeners.push(listener);
    return () => {
      this.availableMapsListeners = this.availableMapsListeners.filter((l) => l !== listener);
    };
  }

  private joinRoom(roomId: string, callback: (response: { success: boolean; message?: string }) => void): void {
    if (!this.socket) {
      console.error('socketService: Socket not connected for joinRoom.');
      callback({ success: false, message: 'Socket not connected.' });
      return;
    }
    this.socket.emit('join_room', { roomId }, callback);
  }

  public setMarbles(names: string[]): void {
    if (!this.socket || !this.currentRoomId) return;
    this.socket.emit('set_marbles', { roomId: this.currentRoomId, names });
  }

  public setWinningRank(rank: number): void {
    if (!this.socket || !this.currentRoomId) return;
    this.socket.emit('set_winning_rank', { roomId: this.currentRoomId, rank });
  }

  public setMap(mapIndex: number): void {
    if (!this.socket || !this.currentRoomId) return;
    this.socket.emit('set_map', { roomId: this.currentRoomId, mapIndex });
  }

  public setSpeed(speed: number): void {
    if (!this.socket || !this.currentRoomId) return;
    this.socket.emit('set_speed', { roomId: this.currentRoomId, speed });
  }

  public startGame(): void {
    if (!this.socket || !this.currentRoomId) return;
    this.socket.emit('start_game', { roomId: this.currentRoomId });
  }

  public resetGame(): void {
    if (!this.socket || !this.currentRoomId) return;
    this.socket.emit('reset_game', { roomId: this.currentRoomId });
  }

  public disconnect(): void {
    this.socket?.disconnect();
    this.currentRoomId = null;
    this.gameStateListeners = [];
    this.availableMapsListeners = [];
    console.log('Socket disconnected by client.');
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

const socketService = new SocketService();
export default socketService;
