import { SkillType, SkillPosition as BaseSkillPosition, SkillExtra } from 'common';
import { IsNumber } from 'class-validator';

// class-validator 데코레이터가 필요한 DTO용 클래스
export class SkillPosition {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

// common에서 타입들을 re-export
export { SkillType, SkillExtra };
