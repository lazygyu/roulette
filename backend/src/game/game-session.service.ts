import { Injectable, NotFoundException } from '@nestjs/common';
import { Roulette } from './roulette';

// Player 인터페이스는 동일하게 유지
interface Player {
  id: string;
  userInfo: {
    nickname: string;
  };
}

// GameRoom 인터페이스 수정: id 타입을 number로 변경하고 interval 제거
export interface GameRoom {
  id: number; // 숫자 ID 사용
  game: Roulette;
  players: Map<string, Player>; // 플레이어 ID는 여전히 string
  isRunning: boolean;
  // interval?: NodeJS.Timeout; // GameEngineService에서 관리하므로 제거
}

@Injectable()
export class GameSessionService { // 클래스 이름 변경
  // 내부 rooms Map의 key 타입을 number로 변경
  private rooms: Map<number, GameRoom> = new Map();

  constructor() {}

  // 방 생성: roomId 타입을 number로 변경
  createRoom(roomId: number): GameRoom {
    if (this.rooms.has(roomId)) {
      // 이미 존재하는 방이면 반환 (혹은 에러 처리)
      // 여기서는 기존 방을 반환하는 것으로 유지
      return this.rooms.get(roomId)!;
    }

    const game = new Roulette();
    const room: GameRoom = {
      id: roomId, // 숫자 ID 사용
      game,
      players: new Map(),
      isRunning: false,
    };

    this.rooms.set(roomId, room);
    return room;
  }

  // 방 가져오기: roomId 타입을 number로 변경
  getRoom(roomId: number): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  // 방에 플레이어 추가: roomId 타입을 number로 변경
  addPlayer(roomId: number, playerId: string, userInfo: { nickname: string }): void {
    let room = this.getRoom(roomId);
    if (!room) {
      // 방이 없으면 새로 생성 (혹은 에러 처리 - 여기서는 생성)
      room = this.createRoom(roomId);
    }

    room.players.set(playerId, {
      id: playerId,
      userInfo: userInfo,
    });
  }

  // 방에서 플레이어 제거: roomId 타입을 number로 변경
  removePlayer(roomId: number, playerId: string): void {
    const room = this.getRoom(roomId);
    if (room) {
      const deleted = room.players.delete(playerId);
      if (deleted && room.players.size === 0) {
        // 플레이어가 없고 성공적으로 삭제되었다면 방 제거
        this.removeRoom(roomId);
      }
    } else {
       // 방이 존재하지 않는 경우 로그 또는 에러 처리
       console.warn(`Attempted to remove player from non-existent room: ${roomId}`);
    }
  }

  // 방 삭제: roomId 타입을 number로 변경
  removeRoom(roomId: number): void {
    const room = this.getRoom(roomId);
    if (room) {
      // GameEngineService에서 루프를 관리하므로 여기서는 interval 제거 로직 불필요
      this.rooms.delete(roomId);
      console.log(`Room ${roomId} removed.`);
    }
  }

  // 게임 시작: roomId 타입을 number로 변경, interval 로직 제거
  startGame(roomId: number): void {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }
    if (room.isRunning) {
       console.warn(`Game in room ${roomId} is already running.`);
       return; // 이미 시작된 게임이면 아무것도 안 함
    }
    room.isRunning = true;
    room.game.start();
    // interval 시작 로직은 GameEngineService로 이동됨
  }

  // 게임 종료 처리: isRunning 상태를 false로 변경
  endGame(roomId: number): void {
    const room = this.getRoom(roomId);
    if (room && room.isRunning) {
      room.isRunning = false;
      // 필요하다면, 게임 종료와 관련된 추가 정리 로직 (예: Roulette 인스턴스 내부 상태 정리)을 여기에 추가할 수 있습니다.
      // room.game.finalize(); // 예시: Roulette 클래스에 finalize 메소드가 있다면
      console.log(`Game in room ${roomId} officially ended in GameSessionService.`);
    } else if (room && !room.isRunning) {
      console.warn(`Attempted to end game in room ${roomId} that was not running.`);
    } else {
      // 방이 없는 경우 NotFoundException을 발생시키거나 경고 로그를 남길 수 있습니다.
      // throw new NotFoundException(`Room with ID ${roomId} not found when trying to end game.`);
      console.warn(`Attempted to end game in non-existent room: ${roomId}`);
    }
  }

  // 게임 설정 (마블): roomId 타입을 number로 변경
  setMarbles(roomId: number, names: string[]): void {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }
    if (room.isRunning) {
       console.warn(`Cannot set marbles while game is running in room ${roomId}.`);
       return; // 게임 중에는 설정 변경 불가 (혹은 다른 정책 적용)
    }
    room.game.setMarbles(names);
  }

  // 우승 순위 설정: roomId 타입을 number로 변경
  setWinningRank(roomId: number, rank: number): void {
    const room = this.getRoom(roomId);
     if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }
     if (room.isRunning) {
       console.warn(`Cannot set winning rank while game is running in room ${roomId}.`);
       return;
    }
    room.game.setWinningRank(rank);
  }

  // 맵 설정: roomId 타입을 number로 변경
  setMap(roomId: number, mapIndex: number): void {
    const room = this.getRoom(roomId);
     if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }
     if (room.isRunning) {
       console.warn(`Cannot set map while game is running in room ${roomId}.`);
       return;
    }
    room.game.setMap(mapIndex);
  }

  // 게임 속도 설정: roomId 타입을 number로 변경
  setSpeed(roomId: number, speed: number): void {
    const room = this.getRoom(roomId);
     if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }
    // 게임 중에도 속도 변경은 가능하도록 허용 (게임 로직에 따라 다를 수 있음)
    room.game.setSpeed(speed);
  }

  // 게임 상태 가져오기: roomId 타입을 number로 변경
  getGameState(roomId: number) {
    const room = this.getRoom(roomId);
    // 방이 없거나 게임 상태가 없으면 null 반환
    return room ? room.game.getGameState() : null;
  }

  // 사용 가능한 맵 목록 가져오기: roomId 타입을 number로 변경
  getMaps(roomId: number) {
    const room = this.getRoom(roomId);
    // 방이 없으면 빈 배열 반환
    return room ? room.game.getMaps() : [];
  }

  // 게임 리셋: roomId 타입을 number로 변경, interval 로직 제거
  resetGame(roomId: number): void {
    const room = this.getRoom(roomId);
     if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }
    // interval 중지 로직은 GameEngineService로 이동됨
    room.isRunning = false;
    room.game.reset();
  }

  // 플레이어 목록 가져오기: roomId 타입을 number로 변경
  getPlayers(roomId: number): Player[] {
    const room = this.getRoom(roomId);
    return room ? Array.from(room.players.values()) : [];
  }
}
