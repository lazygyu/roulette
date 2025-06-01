// 백엔드의 SkillType과 동일하게 정의
export enum ServerSkillType {
  Impact = 'Impact',
  DummyMarble = 'DummyMarble',
}

// 백엔드의 SkillPosition과 동일하게 정의
export interface SkillPosition {
  x: number;
  y: number;
}

// 백엔드의 SkillEffectBase와 동일하게 정의
export interface SkillEffectBase {
  id: string;
  type: ServerSkillType;
  timestamp: number; // 서버에서 생성된 타임스탬프
}

// Impact 스킬 이펙트 (서버에서 오는 데이터)
export interface ImpactSkillEffectFromServer extends SkillEffectBase {
  type: ServerSkillType.Impact;
  position: SkillPosition;
  radius: number;
}

// DummyMarble 스킬 이펙트 (서버에서 오는 데이터)
// 현재 백엔드에서 DummyMarble에 대한 추가 effect 필드를 보내지 않으므로 SkillEffectBase와 동일하게 정의
export interface DummyMarbleSkillEffectFromServer extends SkillEffectBase {
  type: ServerSkillType.DummyMarble;
  // 추가적인 필드가 있다면 여기에 정의
}

// 서버에서 오는 모든 스킬 이펙트 타입의 유니온
export type ServerSkillEffect = ImpactSkillEffectFromServer | DummyMarbleSkillEffectFromServer;

// 프론트엔드 렌더링을 위한 스킬 이펙트 래퍼 타입
export interface FrontendSkillEffectWrapper {
  id: string; // 서버에서 온 ID 동일하게 사용
  type: ServerSkillType;
  serverEffectData: ServerSkillEffect; // 원본 서버 데이터
  startTime: number; // 프론트엔드에서 이펙트가 활성화된 시간 (Date.now())
  duration: number; // 이펙트 지속 시간 (ms)
}
