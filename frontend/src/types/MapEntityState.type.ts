// Mirrored from backend/src/game/types/MapEntity.type.ts

export type EntityShapeTypes = 'box' | 'circle' | 'polyline';

export interface EntityShapeBase {
  type: EntityShapeTypes;
}

export interface EntityBoxShape extends EntityShapeBase {
  type: 'box';
  width: number;
  height: number;
  rotation: number; // Note: Backend MapEntityState has 'angle', frontend might need to adapt if using 'rotation' elsewhere
}

export interface EntityCircleShape extends EntityShapeBase {
  type: 'circle';
  radius: number;
}

export interface EntityPolylineShape extends EntityShapeBase {
  type: 'polyline';
  rotation: number; // Note: Backend MapEntityState has 'angle'
  points: [number, number][];
}

export type EntityShape = EntityBoxShape | EntityCircleShape | EntityPolylineShape;

// This is the state sent from the backend via gameState.entities
export interface MapEntityState {
  x: number;
  y: number;
  angle: number; // Backend sends 'angle'
  shape: EntityShape;
  life: number; // Assuming 'life' is sent, check backend getEntities() if needed
}
