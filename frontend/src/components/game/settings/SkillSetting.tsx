import React, { FC } from 'react';

interface SkillSettingProps {
  useSkills: boolean;
  onSkillChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
}

const SkillSetting: FC<SkillSettingProps> = ({ useSkills, onSkillChange, disabled }) => {
  return (
    <div className="row">
      <label htmlFor="chkSkill">
        <i className="icon bomb"></i>
        <span data-trans>Using skills</span>
      </label>
      <input
        type="checkbox"
        id="chkSkill"
        checked={useSkills}
        onChange={onSkillChange}
        disabled={disabled}
      />
    </div>
  );
};

export default SkillSetting;
