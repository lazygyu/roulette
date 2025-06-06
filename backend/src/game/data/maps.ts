import { stages as originalStages, StageDef, MapEntity } from 'common';
import { cloneDeep } from 'lodash';

export type { StageDef };

function scaleEntity(entity: MapEntity, factor: number): MapEntity {
  const newEntity = cloneDeep(entity);
  if (newEntity.shape.type === 'box') {
    newEntity.shape.width *= factor;
    newEntity.shape.height *= factor;
  } else if (newEntity.shape.type === 'circle') {
    newEntity.shape.radius *= factor;
  }
  return newEntity;
}

export const stages: StageDef[] = originalStages.map((stage) => ({
  ...stage,
  entities: stage.entities?.map((entity) => scaleEntity(entity, 2)),
}));
