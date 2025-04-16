// 스킬 타입
export enum Skills {
  None = 'none',
  Impact = 'impact'
}

// 게임 상태 타입
export enum GameStatus {
  WAITING = 'waiting',
  READY = 'ready',
  RUNNING = 'running',
  FINISHED = 'finished'
}

// 맵 엔티티 타입들
export interface MapEntityProps {
  density: number;
  restitution: number;
  angularVelocity: number;
  life?: number;
}

export interface MapEntityShape {
  type: 'box' | 'circle' | 'polyline';
  width?: number;
  height?: number;
  radius?: number;
  points?: [number, number][];
  rotation?: number;
}

export interface MapEntityPosition {
  x: number;
  y: number;
}

export interface MapEntity {
  type: 'static' | 'kinematic';
  position: MapEntityPosition;
  shape: MapEntityShape;
  props: MapEntityProps;
}

export interface MapEntityState {
  x: number;
  y: number;
  angle: number;
  shape: MapEntityShape;
  life: number;
}

// 스테이지 타입
export interface StageDef {
  title: string;
  entities?: MapEntity[];
  goalY: number;
  zoomY: number;
}

// 마블 상태 타입
export interface MarbleState {
  id: number;
  name: string;
  position: {
    x: number;
    y: number;
    angle: number;
  };
  color: string;
  hue: number;
  isActive: boolean;
  skill: Skills;
  weight: number;
}

// 게임 상태 타입
export interface GameState {
  roomId: number;
  status: GameStatus;
  marbles: MarbleState[];
  winners: MarbleState[];
  entities: MapEntityState[];
  stage: StageDef | null;
  winnerRank: number;
  lastUpdateTime: number;
  winner: MarbleState | null;
  isReady: boolean;
} 