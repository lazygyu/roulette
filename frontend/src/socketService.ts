import { io, Socket } from 'socket.io-client';
import { GameState } from './types/GameState.type'; // Import GameState type

class SocketService {
  private socket: Socket | null = null;
  private roomId: string | null = null;

  constructor() {
    this.extractRoomId();
  }

  private extractRoomId(): void {
    const pathSegments = window.location.pathname.split('/');
    // Expecting path like /game/{roomId}
    if (pathSegments.length >= 3 && pathSegments[1] === 'game') {
      this.roomId = pathSegments[2];
      console.log(`Room ID extracted: ${this.roomId}`);
    } else {
      console.error('Could not extract Room ID from URL path:', window.location.pathname);
      // Handle error or default behavior if roomId is not found
      // For now, let's try to connect without a specific room or use a default
      // This part might need adjustment based on how non-room paths are handled
    }
  }

  public connect(): void {
    if (this.socket?.connected) {
      console.log('Socket already connected.');
      return;
    }

    // 현재 호스트 기반으로 백엔드 URL 동적 생성
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = process.env.NODE_ENV === 'production' ? window.location.port : '3000';
    const socketUrl = `${protocol}//${host}:${port}/game`;
    
    console.log(`Connecting to socket server at ${socketUrl}...`);

    this.socket = io(socketUrl, {
      // 필요한 경우 옵션 추가
      // transports: ['websocket']
    });

    this.socket.on('connect', () => {
      console.log(`Socket connected: ${this.socket?.id}`);
      if (this.roomId) {
        this.joinRoom(this.roomId);
      } else {
        console.warn('No Room ID found, cannot join room automatically.');
      }
      // TODO: Add other event listeners (game_state, etc.)
      this.setupEventListeners();
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${reason}`);
      // Handle disconnection logic if needed
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      // Handle connection errors
    });
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('game_state', (gameState: GameState) => { // Use GameState type
      // console.log('Received game_state:', gameState); // Keep for debugging if needed
      if (window.roullete) {
        // Pass the received state to the Roulette instance for processing/rendering
        window.roullete.updateStateFromServer(gameState);

        // Update shake button visibility based on server state
        const inGameDiv = document.querySelector('#inGame');
        if (inGameDiv) {
          inGameDiv.classList.toggle('hide', !gameState.shakeAvailable);
        }
      } else {
        console.error('window.roullete instance not found.');
      }
    });

    this.socket.on('available_maps', (maps: { index: number; title: string }[]) => { // Add type for maps
      console.log('Received available_maps:', maps);
      // Call the globally exposed function from index.html to update the UI
      if (window.updateMapSelector) {
        window.updateMapSelector(maps);
      } else {
        console.error('window.updateMapSelector function not found.');
      }
    });

    this.socket.on('player_joined', (data) => {
      console.log('새로운 플레이어 참여:', {
        playerId: data.playerId,
        nickname: data.userInfo.nickname,
        timestamp: new Date().toLocaleTimeString()
      });
      // Optional: Update UI to show connected players
    });

    this.socket.on('player_left', (data) => {
      console.log('플레이어 퇴장:', {
        playerId: data.playerId,
        timestamp: new Date().toLocaleTimeString()
      });
      // Optional: Update UI
    });

    this.socket.on('game_started', () => {
      console.log('Game started event received');
      // TODO: Update UI state (e.g., hide settings)
    });

    this.socket.on('game_reset', () => {
      console.log('Game reset event received');
      // TODO: Update UI state
    });

    this.socket.on('game_over', (data) => {
      console.log('Game over event received:', data);
      // TODO: Show winner, update UI state (e.g., show settings)
    });

    this.socket.on('speed_changed', (data) => {
      console.log('Speed changed event received:', data);
      // Optional: Update UI if speed display exists
    });

    // Add listeners for any other relevant events from the backend
  }

  private joinRoom(roomId: string): void {
    if (!this.socket) {
      console.error('Socket not connected.');
      return;
    }
    console.log(`Joining room: ${roomId}`);
    
    // Get user info from localStorage or create default
    const userInfo = {
      nickname: localStorage.getItem('user_nickname') || `User_${Math.floor(Math.random() * 1000)}`,
      // Add any other user info you want to track
    };

    this.socket.emit('join_room', { 
      roomId,
      userInfo 
    }, (response: { success: boolean; message?: string }) => {
      if (response.success) {
        console.log(`Successfully joined room ${roomId}`);
        // Store user info in localStorage for persistence
        localStorage.setItem('user_nickname', userInfo.nickname);
      } else {
        console.error(`Failed to join room ${roomId}: ${response.message}`);
      }
    });
  }

  // --- Event Emitters ---

  public setMarbles(names: string[]): void {
    if (!this.socket || !this.roomId) return;
    console.log(`Emitting set_marbles with ${names.length} names`);
    this.socket.emit('set_marbles', { roomId: this.roomId, names });
  }

  public setWinningRank(rank: number): void {
    if (!this.socket || !this.roomId) return;
    console.log(`Emitting set_winning_rank with rank ${rank}`);
    this.socket.emit('set_winning_rank', { roomId: this.roomId, rank });
  }

  public setMap(mapIndex: number): void {
    if (!this.socket || !this.roomId) return;
    console.log(`Emitting set_map with index ${mapIndex}`);
    this.socket.emit('set_map', { roomId: this.roomId, mapIndex });
  }

  public setSpeed(speed: number): void {
    if (!this.socket || !this.roomId) return;
    console.log(`Emitting set_speed with speed ${speed}`);
    this.socket.emit('set_speed', { roomId: this.roomId, speed });
  }

  public startGame(): void {
    if (!this.socket || !this.roomId) return;
    console.log('Emitting start_game');
    this.socket.emit('start_game', { roomId: this.roomId });
  }

  public resetGame(): void {
    if (!this.socket || !this.roomId) return;
    console.log('Emitting reset_game');
    this.socket.emit('reset_game', { roomId: this.roomId });
  }

  // Add other necessary methods like leaveRoom, disconnect, etc.
  public disconnect(): void {
    this.socket?.disconnect();
  }
}

// Create a singleton instance
const socketService = new SocketService();
export default socketService;
