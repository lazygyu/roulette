import { GameRoom } from '../game-room';
import { SkillPosition, SkillExtra, SkillType } from '../types/skill.type';

export interface SkillStrategy<T extends keyof SkillExtraMap> {
  execute(room: GameRoom, skillPosition: SkillPosition, extra: SkillExtraMap[T], userNickname?: string): void;
}

// This map ensures that the 'extra' parameter is correctly typed based on the skill type.
export interface SkillExtraMap {
  [SkillType.Impact]: SkillExtra<SkillType.Impact>;
  [SkillType.DummyMarble]: SkillExtra<SkillType.DummyMarble>;
  // Add other skill types here as they are created
}
