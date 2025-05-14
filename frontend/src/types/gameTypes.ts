// filepath: c:\Users\TAK\Desktop\2025 4-1\Capstone_Design\project\roulette\roulette-app\src\types\gameTypes.ts
export enum Skills {
  None,
  Impact,
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

export type EntityShapeTypes = 'box' | 'circle' | 'polyline';

export interface EntityShapeBase {
  type: EntityShapeTypes;
}

export interface EntityBoxShape extends EntityShapeBase {
  type: 'box';
  width: number;
  height: number;
  rotation: number; // 맵 정의에 포함된 도형 자체의 회전값
}

export interface EntityCircleShape extends EntityShapeBase {
  type: 'circle';
  radius: number;
}

export interface EntityPolylineShape extends EntityShapeBase {
  type: 'polyline';
  rotation: number; // 맵 정의에 포함된 도형 자체의 회전값
  points: [number, number][];
}

export type EntityShape = EntityBoxShape | EntityCircleShape | EntityPolylineShape;

export interface MapEntityState {
  x: number;
  y: number;
  angle: number; // 물리 엔진에서 계산된 엔티티 몸체의 현재 각도
  shape: EntityShape;
  life: number; // 백엔드에서 life 속성을 보낸다면 추가
}

export interface GameState {
  marbles: MarbleState[];
  winners: MarbleState[];
  winner: MarbleState | null;
  entities: MapEntityState[];
  isRunning: boolean;
  winnerRank: number;
  totalMarbleCount: number;
  shakeAvailable: boolean;
  // currentMapIndex?: number; // 백엔드에서 현재 맵 인덱스를 보내준다면 추가
  // currentMapIndex?: number; // 백엔드에서 현재 맵 인덱스를 보내준다면 추가
  // currentSpeed?: number; // 백엔드에서 현재 속도를 보내준다면 추가
}

// --- 추가된 타입 ---

// 백엔드의 GameStatus Enum과 동일하게 정의
export enum GameStatus {
  WAITING = 'WAITING',
  IN_PROGRESS = 'IN_PROGRESS',
  FINISHED = 'FINISHED',
}

// 백엔드의 GameDto에 대응하는 타입
export interface GameInfo {
  id: number;
  status: GameStatus;
  mapIndex: number | null;
  marbles: string[]; // 마블 이름 목록
  winningRank: number | null;
  speed: number | null;
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
export interface UserPublicInfo {
  id: number;
  nickname: string;
}
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
