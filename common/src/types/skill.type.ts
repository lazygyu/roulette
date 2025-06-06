export enum SkillType {
  Impact = 'Impact',
  DummyMarble = 'DummyMarble',
}

export interface SkillPosition {
  x: number;
  y: number;
}

interface SkillExtraMapper {
  [SkillType.Impact]: {};
  [SkillType.DummyMarble]: {};
}

export type SkillExtra<T extends SkillType> = SkillExtraMapper[T];
