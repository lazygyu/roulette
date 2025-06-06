import { Injectable, Logger } from '@nestjs/common';
import { GameRoom } from '../game-room';
import { SkillStrategy } from './skill.strategy';
import { SkillPosition, SkillType } from '../types/skill.type';

@Injectable()
export class DummyMarbleSkillStrategy implements SkillStrategy<SkillType.DummyMarble> {
  private readonly logger = new Logger(DummyMarbleSkillStrategy.name);

  execute(room: GameRoom, skillPosition: SkillPosition, extra: any, userNickname?: string): void {
    const nickname = userNickname || 'UnknownUser';
    this.logger.log(
      `Room ${room.id}: DummyMarble skill used by ${nickname} at (${skillPosition.x}, ${skillPosition.y}) to create 5 marbles`,
    );
    room.game.createDummyMarbles(skillPosition, 5, nickname);
  }
}
