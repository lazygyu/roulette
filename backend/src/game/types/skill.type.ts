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

// Impact 스킬의 extra 필드 타입 (예시: 반경)
export class ImpactSkillExtra {
  @IsNumber()
  radius!: number;
}

// DummyMarble 스킬의 extra 필드 타입 (예시: 생성할 더미 마블 수)
export class DummyMarbleSkillExtra {
  @IsNumber()
  count!: number;
}
