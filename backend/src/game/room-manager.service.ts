import { Injectable } from '@nestjs/common';
import { Roulette } from './roulette';

interface Player {
  id: string;
  userInfo: {
    nickname: string;
  };
}

export interface GameRoom {
  id: string;
  game: Roulette;
  players: Map<string, Player>;
  isRunning: boolean;
  interval?: NodeJS.Timeout;
}

@Injectable()
export class RoomManagerService {
  private rooms: Map<string, GameRoom> = new Map();

  constructor() {}

  // 방 생성
  createRoom(roomId: string): GameRoom {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const game = new Roulette();
    const room: GameRoom = {
      id: roomId,
      game,
      players: new Map(),
      isRunning: false,
    };

    this.rooms.set(roomId, room);
    return room;
  }

  // 방 가져오기
  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  // 방에 플레이어 추가
  addPlayer(roomId: string, playerId: string, userInfo: { nickname: string }): void {
    let room = this.getRoom(roomId);
    if (!room) {
      room = this.createRoom(roomId);
    }
    
    room.players.set(playerId, {
      id: playerId,
      userInfo: userInfo
    });
  }

  // 방에서 플레이어 제거
  removePlayer(roomId: string, playerId: string): void {
    const room = this.getRoom(roomId);
    if (room) {
      room.players.delete(playerId);
      
      // 방에 플레이어가 없으면 방 제거
      if (room.players.size === 0) {
        this.removeRoom(roomId);
      }
    }
  }

  // 방 삭제
  removeRoom(roomId: string): void {
    const room = this.getRoom(roomId);
    if (room) {
      if (room.interval) {
        clearInterval(room.interval);
      }
      this.rooms.delete(roomId);
    }
  }

  // 게임 시작
  startGame(roomId: string): void {
    const room = this.getRoom(roomId);
    if (room && !room.isRunning) {
      room.isRunning = true;
      room.game.start();
      
      // 게임 업데이트 간격 설정 (30fps)
      room.interval = setInterval(() => {
        room.game.update();
        
        // 게임이 끝났으면 업데이트 중지
        if (!room.game.getGameState().isRunning) {
          room.isRunning = false;
          if (room.interval) {
            clearInterval(room.interval);
            room.interval = undefined;
          }
        }
      }, 1000 / 30);
    }
  }

  // 게임 설정
  setMarbles(roomId: string, names: string[]): void {
    const room = this.getRoom(roomId);
    if (room && !room.isRunning) {
      room.game.setMarbles(names);
    }
  }

  // 우승 순위 설정
  setWinningRank(roomId: string, rank: number): void {
    const room = this.getRoom(roomId);
    if (room && !room.isRunning) {
      room.game.setWinningRank(rank);
    }
  }

  // 맵 설정
  setMap(roomId: string, mapIndex: number): void {
    const room = this.getRoom(roomId);
    if (room && !room.isRunning) {
      room.game.setMap(mapIndex);
    }
  }

  // 게임 속도 설정
  setSpeed(roomId: string, speed: number): void {
    const room = this.getRoom(roomId);
    if (room) {
      room.game.setSpeed(speed);
    }
  }

  // 게임 상태 가져오기
  getGameState(roomId: string) {
    const room = this.getRoom(roomId);
    if (room) {
      return room.game.getGameState();
    }
    return null;
  }

  // 사용 가능한 맵 목록 가져오기
  getMaps(roomId: string) {
    const room = this.getRoom(roomId);
    if (room) {
      return room.game.getMaps();
    }
    return [];
  }

  // 게임 리셋
  resetGame(roomId: string): void {
    const room = this.getRoom(roomId);
    if (room) {
      if (room.interval) {
        clearInterval(room.interval);
        room.interval = undefined;
      }
      room.isRunning = false;
      room.game.reset();
    }
  }

  getPlayers(roomId: string): Player[] {
    const room = this.getRoom(roomId);
    if (!room) return [];
    return Array.from(room.players.values());
  }
}