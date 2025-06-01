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

// 향후 다른 스킬 이펙트 타입이 추가될 수 있습니다.
// export interface AnotherSkillEffect extends SkillEffectBase {
//   type: SkillType.AnotherSkill;
//   // ... 추가 속성
// }

export type SkillEffect = ImpactSkillEffect; // | AnotherSkillEffect;
