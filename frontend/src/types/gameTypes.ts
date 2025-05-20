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
  // currentSpeed?: number; // 백엔드에서 현재 속도를 보내준다면 추가
}

export interface MapInfo {
  index: number;
  title: string;
}
