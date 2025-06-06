import { SkillType, SkillPosition } from './skill.type';

export interface SkillEffectBase {
  id: string;
  type: SkillType;
  timestamp: number;
}

export interface ImpactSkillEffect extends SkillEffectBase {
  type: SkillType.Impact;
  position: SkillPosition;
  radius: number;
}

export interface DummyMarbleSkillEffect extends SkillEffectBase {
  type: SkillType.DummyMarble;
  // 추가적인 필드가 있다면 여기에 정의
}

export type SkillEffect = ImpactSkillEffect | DummyMarbleSkillEffect;
