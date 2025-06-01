export enum SkillType {
  Impact = 'Impact',
  DummyMarble = 'DummyMarble',
}

import { IsNumber } from 'class-validator';

export class SkillPosition {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

interface SkillExtraMapper {
  [SkillType.Impact]: {};
  [SkillType.DummyMarble]: {};
}

export type SkillExtra<T extends SkillType> = SkillExtraMapper[T];
