import { VectorLike } from './VectorLike';

export type EntityShapeTypes = 'box' | 'circle';

export interface EntityShapeBase {
  type: EntityShapeTypes;
}

export interface EntityBoxShape extends EntityShapeBase {
  type: 'box';
  width: number;
  height: number;
  rotation: number;
}

export interface EntityCircleShape extends EntityShapeBase {
  type: 'circle';
  radius: number;
}

export type EntityShape = EntityBoxShape | EntityCircleShape;

export type EntityPhysicalProps = {
  density: number;
  restitution: number;
  angularVelocity: number;
  life?: number;
};

export interface MapEntity {
  position: VectorLike;
  type: 'static' | 'kinematic';
  shape: EntityShape;
  props: EntityPhysicalProps;
}

export interface MapEntityState {
  x: number;
  y: number;
  angle: number;
  shape: EntityShape;
  life: number;
}
