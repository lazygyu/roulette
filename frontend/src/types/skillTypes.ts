import { 
  SkillType, 
  SkillPosition, 
  SkillEffectBase, 
  ImpactSkillEffect, 
  DummyMarbleSkillEffect 
} from 'common';

// 백엔드의 SkillType과 동일하게 정의 (common에서 import)
export { SkillType as ServerSkillType };

// 백엔드의 SkillPosition과 동일하게 정의 (common에서 import)
export { SkillPosition };

// 백엔드의 SkillEffectBase와 동일하게 정의 (common에서 import)
export { SkillEffectBase };

// Impact 스킬 이펙트 (서버에서 오는 데이터)
export interface ImpactSkillEffectFromServer extends ImpactSkillEffect {
  type: SkillType.Impact;
}

// DummyMarble 스킬 이펙트 (서버에서 오는 데이터)
export interface DummyMarbleSkillEffectFromServer extends DummyMarbleSkillEffect {
  type: SkillType.DummyMarble;
}

// 서버에서 오는 모든 스킬 이펙트 타입의 유니온
export type ServerSkillEffect = ImpactSkillEffectFromServer | DummyMarbleSkillEffectFromServer;

// 프론트엔드 렌더링을 위한 스킬 이펙트 래퍼 타입
export interface FrontendSkillEffectWrapper {
  id: string; // 서버에서 온 ID 동일하게 사용
  type: SkillType;
  serverEffectData: ServerSkillEffect; // 원본 서버 데이터
  startTime: number; // 프론트엔드에서 이펙트가 활성화된 시간 (Date.now())
  duration: number; // 이펙트 지속 시간 (ms)
}
