import { IsEnum, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SkillType, SkillPosition, ImpactSkillExtra, DummyMarbleSkillExtra } from '../types/skill.type';

export class UseSkillDto<T> {
  @IsNumber()
  roomId!: number;

  @IsEnum(SkillType)
  skillType!: SkillType;

  @ValidateNested()
  @Type(() => SkillPosition)
  skillPosition!: SkillPosition;

  // extra 필드는 제네릭 타입 T를 따릅니다.
  // 각 스킬 타입에 맞는 DTO를 상속받아 사용할 때 @Type과 @ValidateNested를 적용합니다.
  declare extra: T;
}

// 특정 스킬 타입에 대한 DTO 예시
export class UseImpactSkillDto extends UseSkillDto<ImpactSkillExtra> {
  @ValidateNested()
  @Type(() => ImpactSkillExtra)
  declare extra: ImpactSkillExtra;
}

export class UseDummyMarbleSkillDto extends UseSkillDto<DummyMarbleSkillExtra> {
  @ValidateNested()
  @Type(() => DummyMarbleSkillExtra)
  declare extra: DummyMarbleSkillExtra;
}
