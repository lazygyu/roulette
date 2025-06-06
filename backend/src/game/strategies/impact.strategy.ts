import { Injectable, Logger } from '@nestjs/common';
import { GameRoom } from '../game-room';
import { SkillStrategy, SkillExtraMap } from './skill.strategy';
import { SkillPosition, SkillType } from '../types/skill.type';
import { ImpactSkillEffect } from '../types/skill-effect.type';

const IMPACT_SKILL_RADIUS = 5;
const IMPACT_SKILL_FORCE = 10;

@Injectable()
export class ImpactSkillStrategy implements SkillStrategy<SkillType.Impact> {
  private readonly logger = new Logger(ImpactSkillStrategy.name);

  execute(room: GameRoom, skillPosition: SkillPosition): void {
    this.logger.log(`Room ${room.id}: Impact skill used at (${skillPosition.x}, ${skillPosition.y}) with radius ${IMPACT_SKILL_RADIUS} and force ${IMPACT_SKILL_FORCE}`);
    room.game.applyImpact(skillPosition, IMPACT_SKILL_RADIUS, IMPACT_SKILL_FORCE);

    room.game.addSkillEffect({
      type: SkillType.Impact,
      position: skillPosition,
      radius: IMPACT_SKILL_RADIUS,
    } as Omit<ImpactSkillEffect, 'id' | 'timestamp'>);
  }
}
