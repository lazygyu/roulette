// 기본적인 방 관련 인터페이스들
export interface RoomIdRequest {
  roomId: number;
}

export interface SetMarblesRequest extends RoomIdRequest {
  names: string[];
}

export interface SetWinningRankRequest extends RoomIdRequest {
  rank: number;
}

export interface SetMapRequest extends RoomIdRequest {
  mapIndex: number;
}

export interface SetSpeedRequest extends RoomIdRequest {
  speed: number;
}

export interface JoinRoomRequest extends RoomIdRequest {
  password?: string;
}

export interface CreateRoomRequest {
  name: string;
  password?: string;
}
