import { 
  EntityShapeTypes, 
  EntityShapeBase, 
  EntityBoxShape, 
  EntityCircleShape, 
  EntityPolylineShape, 
  EntityShape, 
  MapEntityState,
  GameStatus,
  UserPublicInfo
} from 'common';
import { ServerSkillEffect } from './skillTypes'; // ServerSkillEffect 임포트

export enum Skills {
  None = 'None',
  Impact = 'Impact',
  DummyMarble = 'DummyMarble',
}

export interface MarbleState {
  id: number;
  name: string;
  x: number;
  y: number;
  angle: number; // 백엔드에서 오는 구슬의 각도
  color: string;
  // hue: number; // 필요하다면 추가 (백엔드에서 전송)
  isActive: boolean;
  skill: Skills | null;
  // impact: number; // 필요하다면 추가 (백엔드에서 전송)
  radius: number; // 백엔드의 marble.size에 해당 (예: 0.5)
}

// common에서 import한 타입들을 re-export
export { 
  EntityShapeTypes, 
  EntityShapeBase, 
  EntityBoxShape, 
  EntityCircleShape, 
  EntityPolylineShape, 
  EntityShape,
  MapEntityState,
  GameStatus,
  UserPublicInfo
};

export interface GameState {
  marbles: MarbleState[];
  winners: MarbleState[];
  winner: MarbleState | null;
  entities: MapEntityState[];
  isRunning: boolean;
  winnerRank: number;
  totalMarbleCount: number;
  shakeAvailable: boolean;
  skillEffects?: ServerSkillEffect[]; // 스킬 이펙트 추가
}

// --- 추가된 타입 ---

// 백엔드의 GameDto에 대응하는 타입
export interface GameInfo {
  id: number;
  status: GameStatus;
  mapIndex: number | null;
  marbles: string[]; // 마블 이름 목록
  winningRank: number | null;
  speed: number | null;
  useSkills: boolean; // 추가
  autoRecording: boolean; // 추가
  isRunning: boolean; // 게임 진행 상태 추가
  // ranking: MarbleState[] | null; // 최종 랭킹 -> 별도 API로 분리되므로 제거 또는 RankingEntry[] 타입으로 변경
  createdAt: string; // Date는 string으로 변환될 수 있음
  updatedAt: string;
}

export interface RankingEntry {
  marbleName: string;
  rank: number;
  isWinner: boolean;
  // 필요시 마블 색상 등 추가 정보 포함 가능
}

// GET /rooms/:id 응답 전체를 나타내는 타입 (가칭)
// UserPublicInfoDto 타입 정의 필요 (users/dto/user-public-info.dto.ts 참고)
export interface RoomInfo {
  id: number;
  name: string;
  isPasswordRequired: boolean; // 비밀번호 필요 여부 필드 추가
  managerId: number;
  manager: UserPublicInfo; // UserPublicInfo 타입 사용
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null; // 소프트 삭제 필드
  game: GameInfo | null; // GameInfo는 이제 ranking을 포함하지 않음
}

// --- 기존 타입 ---
export interface MapInfo {
  index: number;
  title: string;
}
