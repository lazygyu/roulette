import { MapEntity } from './map-entity.type';

export interface StageDef {
  title: string;
  entities?: MapEntity[];
  goalY: number;
  zoomY: number;
} 