import React from 'react';
import { GameStatus, GameInfo } from '../types/gameTypes';

interface SettingsPanelProps {
  isManager: boolean;
  gameDetails: GameInfo | null;
  winnerSelectionType: 'first' | 'last' | 'custom';
  winningRankDisplay: number | null; // UI에 표시될 1-index 값
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
  winningRankDisplay, // winningRankDisplay 추가
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
  // Ensure boolean values for disabled attributes
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
        <div className="row">
          <label htmlFor="sltMap">
            <i className="icon map"></i>
            <span data-trans>Map</span>
          </label>
          <select id="sltMap" value={mapIndex ?? ''} onChange={onMapChange} disabled={settingsDisabled}>
            {availableMaps.length === 0 ? (
              <option value="">Loading maps...</option>
            ) : (
              availableMaps.map((map) => (
                <option key={map.index} value={map.index.toString()}>
                  {map.title}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="row">
          <label htmlFor="chkAutoRecording">
            <i className="icon record"></i>
            <span data-trans>Recording</span>
          </label>
          <input
            type="checkbox"
            id="chkAutoRecording"
            checked={autoRecording}
            onChange={onAutoRecordingChange}
            disabled={settingsDisabled}
          />
        </div>
        <div className="row">
          <label>
            <i className="icon trophy"></i>
            <span data-trans>The winner is</span>
          </label>
          <div className="btn-group">
            <button
              onClick={onFirstWinnerClick}
              className={`btn-winner btn-first-winner ${winnerSelectionType === 'first' ? 'active' : ''}`}
              data-trans
              disabled={settingsDisabled}
            >
              First
            </button>
            <button
              onClick={onLastWinnerClick}
              className={`btn-winner btn-last-winner ${winnerSelectionType === 'last' ? 'active' : ''}`}
              data-trans
              disabled={settingsDisabled}
            >
              Last
            </button>
            <input
              type="number"
              id="in_winningRank"
              value={winningRankDisplay ?? ''} // defaultValue 대신 value 사용
              min="1"
              onChange={onWinningRankChange}
              className={winnerSelectionType === 'custom' ? 'active' : ''}
              disabled={settingsDisabled}
            />
          </div>
        </div>
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
            disabled={settingsDisabled}
          />
        </div>
      </div>
      <div className="left">
        <h3 data-trans>Enter names below</h3>
        <textarea
          id="in_names"
          placeholder="Input names separated by commas or line feed here"
          data-trans="placeholder"
          value={namesInput}
          onInput={onNamesInput}
          onBlur={onNamesBlur}
          disabled={gameFinishedOrInProgress}
        ></textarea>
        <div className="actions">
          <button id="btnShuffle" onClick={onShuffleClick} disabled={gameFinishedOrInProgress}>
            <i className="icon shuffle"></i>
            <span data-trans>Shuffle</span>
          </button>
          <button id="btnStart" onClick={onStartClick} disabled={gameFinishedOrInProgress}>
            <i className="icon play"></i>
            <span data-trans>
              {gameDetails && gameDetails.status === GameStatus.IN_PROGRESS
                ? 'Game In Progress'
                : gameDetails && gameDetails.status === GameStatus.FINISHED
                  ? 'Game Finished'
                  : 'Start'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
