import React, { FC } from 'react';
import { GameInfo, GameStatus } from '../types/gameTypes';
import MapSetting from './game/settings/MapSetting';
import RecordingSetting from './game/settings/RecordingSetting';
import WinnerSetting from './game/settings/WinnerSetting';
import SkillSetting from './game/settings/SkillSetting';
import NamesInput from './game/settings/NamesInput';
import GameActions from './game/settings/GameActions';

interface SettingsPanelProps {
  isManager: boolean;
  gameDetails: GameInfo | null;
  winnerSelectionType: 'first' | 'last' | 'custom';
  winningRankDisplay: number | null;
  mapIndex: number | null;
  availableMaps: { index: number; title: string; }[];
  autoRecording: boolean;
  useSkills: boolean;
  namesInput: string;
  onMapChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onAutoRecordingChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFirstWinnerClick: () => void;
  onLastWinnerClick: () => void;
  onWinningRankChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSkillChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onNamesInput: (event: React.FormEvent<HTMLTextAreaElement>) => void;
  onNamesBlur: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onShuffleClick: () => void;
  onStartClick: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isManager,
  gameDetails,
  winnerSelectionType,
  winningRankDisplay,
  mapIndex,
  availableMaps,
  autoRecording,
  useSkills,
  namesInput,
  onMapChange,
  onAutoRecordingChange,
  onFirstWinnerClick,
  onLastWinnerClick,
  onWinningRankChange,
  onSkillChange,
  onNamesInput,
  onNamesBlur,
  onShuffleClick,
  onStartClick,
}) => {
  const settingsDisabled = !!(
    !isManager ||
    (gameDetails && gameDetails.status === GameStatus.FINISHED) ||
    (gameDetails && gameDetails.status === GameStatus.IN_PROGRESS)
  );
  const gameFinishedOrInProgress = !!(
    (gameDetails && gameDetails.status === GameStatus.FINISHED) ||
    (gameDetails && gameDetails.status === GameStatus.IN_PROGRESS)
  );

  if (!isManager || (gameDetails && gameDetails.status !== GameStatus.WAITING)) {
    return null;
  }

  return (
    <div id="settings" className={`settings`}>
      <div className="right">
        <MapSetting
          mapIndex={mapIndex}
          availableMaps={availableMaps}
          onMapChange={onMapChange}
          disabled={settingsDisabled}
        />
        <RecordingSetting
          autoRecording={autoRecording}
          onAutoRecordingChange={onAutoRecordingChange}
          disabled={settingsDisabled}
        />
        <WinnerSetting
          winnerSelectionType={winnerSelectionType}
          winningRankDisplay={winningRankDisplay}
          onFirstWinnerClick={onFirstWinnerClick}
          onLastWinnerClick={onLastWinnerClick}
          onWinningRankChange={onWinningRankChange}
          disabled={settingsDisabled}
        />
        <SkillSetting
          useSkills={useSkills}
          onSkillChange={onSkillChange}
          disabled={settingsDisabled}
        />
      </div>
      <div className="left">
        <NamesInput
          namesInput={namesInput}
          onNamesInput={onNamesInput}
          onNamesBlur={onNamesBlur}
          disabled={gameFinishedOrInProgress}
        />
        <GameActions
          gameDetails={gameDetails}
          onShuffleClick={onShuffleClick}
          onStartClick={onStartClick}
          disabled={gameFinishedOrInProgress}
        />
      </div>
    </div>
  );
};

export default SettingsPanel;
