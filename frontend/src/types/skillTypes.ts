import {
  SkillType,
  SkillPosition,
  SkillEffectBase,
  ImpactSkillEffect,
  DummyMarbleSkillEffect
} from 'common';

export { SkillType as ServerSkillType };

export { SkillPosition };

export { SkillEffectBase };

export interface ImpactSkillEffectFromServer extends ImpactSkillEffect {
  type: SkillType.Impact;
}

export interface DummyMarbleSkillEffectFromServer extends DummyMarbleSkillEffect {
  type: SkillType.DummyMarble;
}

export type ServerSkillEffect = ImpactSkillEffectFromServer | DummyMarbleSkillEffectFromServer;

export interface FrontendSkillEffectWrapper {
  id: string;
  type: SkillType;
  serverEffectData: ServerSkillEffect;
  startTime: number;
  duration: number;
}
