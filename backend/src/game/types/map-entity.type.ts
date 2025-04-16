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