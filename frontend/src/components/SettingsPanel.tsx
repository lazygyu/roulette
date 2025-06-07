import React from 'react';
import { useGame } from '../contexts/GameContext';
import { useParticipantManager } from '../hooks/useParticipantManager';
import { useGameSettings } from '../hooks/useGameSettings';
import { GameStatus } from '../types/gameTypes';
import MapSetting from './game/settings/MapSetting';
import RecordingSetting from './game/settings/RecordingSetting';
import WinnerSetting from './game/settings/WinnerSetting';
import SkillSetting from './game/settings/SkillSetting';
import NamesInput from './game/settings/NamesInput';
import GameActions from './game/settings/GameActions';

const SettingsPanel: React.FC = () => {
  const { isManager, gameDetails, rouletteInstance, availableMaps, gameState } = useGame();
  const { namesInput, handleNamesChange, shuffleNames } = useParticipantManager(
    gameDetails?.marbles?.join(',') || '',
  );
  const marbleCount = gameState?.totalMarbleCount || 0;
  const {
    mapIndex,
    useSkills,
    autoRecording,
    winnerSelectionType,
    winningRank,
    handleMapChange,
    handleSkillChange,
    handleAutoRecordingChange,
    handleWinningRankChange,
    selectFirstWinner,
    selectLastWinner,
    startGame,
  } = useGameSettings(gameDetails, rouletteInstance, marbleCount);

  const settingsDisabled = !!(
    !isManager ||
    (gameDetails && gameDetails.status === GameStatus.FINISHED) ||
    (gameDetails && gameDetails.status === GameStatus.IN_PROGRESS)
  );
  const gameFinishedOrInProgress = !!(
    (gameDetails && gameDetails.status === GameStatus.FINISHED) ||
    (gameDetails && gameDetails.status === GameStatus.IN_PROGRESS)
  );

  return (
    <div id="settings" className={`settings`}>
      <div className="right">
        <MapSetting
          mapIndex={mapIndex}
          availableMaps={availableMaps}
          onMapChange={(e) => handleMapChange(parseInt(e.target.value, 10))}
          disabled={settingsDisabled}
        />
        <RecordingSetting
          autoRecording={autoRecording}
          onAutoRecordingChange={(e) => handleAutoRecordingChange(e.target.checked)}
          disabled={settingsDisabled}
        />
        <WinnerSetting
          winnerSelectionType={winnerSelectionType}
          winningRankDisplay={winningRank}
          onFirstWinnerClick={selectFirstWinner}
          onLastWinnerClick={selectLastWinner}
          onWinningRankChange={(e) => handleWinningRankChange(parseInt(e.target.value, 10))}
          disabled={settingsDisabled}
        />
        <SkillSetting
          useSkills={useSkills}
          onSkillChange={(e) => handleSkillChange(e.target.checked)}
          disabled={settingsDisabled}
        />
      </div>
      <div className="left">
        <NamesInput
          namesInput={namesInput}
          onNamesInput={(e) => handleNamesChange(e.currentTarget.value)}
          disabled={gameFinishedOrInProgress}
        />
        <GameActions
          gameDetails={gameDetails}
          onShuffleClick={shuffleNames}
          onStartClick={startGame}
          disabled={gameFinishedOrInProgress}
        />
      </div>
    </div>
  );
};

export default SettingsPanel;
