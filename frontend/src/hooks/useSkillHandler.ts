import { useState, useCallback } from 'react';
import socketService from '../services/socketService';
import { Skills, GameState } from '../types/gameTypes';
import { Roulette } from '../roulette';

export const useSkillHandler = (
  rouletteInstance: Roulette | null,
  gameState: GameState | null,
) => {
  const [selectedSkill, setSelectedSkill] = useState<Skills>(Skills.None);

  const handleSkillSelect = useCallback((skill: Skills) => {
    setSelectedSkill(skill);
  }, []);

  const handleCanvasClick = useCallback(
    async (event: React.MouseEvent<HTMLDivElement>) => {
      if (!rouletteInstance || selectedSkill === Skills.None || !gameState?.isRunning) {
        return;
      }

      const canvas = event.currentTarget.querySelector('canvas');
      if (!canvas) {
        console.error('Canvas element not found.');
        return;
      }

      const skillPosition = rouletteInstance.screenToWorld(event.clientX, event.clientY, canvas);
      let extra: any = {};

      switch (selectedSkill) {
        case Skills.Impact:
          extra = { radius: 5 };
          break;
        case Skills.DummyMarble:
          extra = { count: 3 };
          break;
        default:
          break;
      }

      try {
        await socketService.useSkill(selectedSkill, skillPosition, extra);
        setSelectedSkill(Skills.None); // Reset skill after use
      } catch (error) {
        console.error('Failed to use skill:', error);
        alert('Failed to use skill.');
      }
    },
    [rouletteInstance, selectedSkill, gameState?.isRunning],
  );

  return {
    selectedSkill,
    handleSkillSelect,
    handleCanvasClick,
  };
};
