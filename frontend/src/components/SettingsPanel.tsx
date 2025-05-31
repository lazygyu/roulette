import React, { useRef, useEffect, useCallback } from 'react';
import { GameStatus, GameInfo } from '../types/gameTypes';
import { useGame } from '../contexts/GameContext';
import options from '../options'; // window.options 대신 직접 임포트

interface SettingsPanelProps {
  isManager: boolean;
  gameDetails: GameInfo | null;
  winnerSelectionType: 'first' | 'last' | 'custom';
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isManager,
  gameDetails,
  winnerSelectionType,
}) => {
  const {
    rouletteInstance,
    availableMaps,
    setWinnerRank,
    updateParticipants,
    startGame,
    setUseSkills,
    setMap,
    setAutoRecording,
    setWinnerSelectionType, // GameContext에서 가져옴
  } = useGame();

  // Refs for DOM elements
  const inNamesRef = useRef<HTMLTextAreaElement>(null);
  const inWinningRankRef = useRef<HTMLInputElement>(null);
  const chkSkillRef = useRef<HTMLInputElement>(null);
  const sltMapRef = useRef<HTMLSelectElement>(null);
  const chkAutoRecordingRef = useRef<HTMLInputElement>(null);
  const btnShuffleRef = useRef<HTMLButtonElement>(null);
  const btnStartRef = useRef<HTMLButtonElement>(null);
  const btnLastWinnerRef = useRef<HTMLButtonElement>(null);
  const btnFirstWinnerRef = useRef<HTMLButtonElement>(null);

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

  // Update UI elements based on gameDetails from context
  useEffect(() => {
    if (gameDetails) {
      if (gameDetails.status === GameStatus.WAITING || gameDetails.status === GameStatus.IN_PROGRESS) {
        if (inNamesRef.current && gameDetails.marbles && gameDetails.marbles.length > 0) {
          inNamesRef.current.value = gameDetails.marbles.join(',');
        }
        if (inWinningRankRef.current && gameDetails.winningRank !== null) {
          inWinningRankRef.current.value = gameDetails.winningRank.toString();
          setWinnerSelectionType(gameDetails.winningRank === 1 ? 'first' : 'custom');
        }
        if (sltMapRef.current && gameDetails.mapIndex !== null) {
          sltMapRef.current.value = gameDetails.mapIndex.toString();
        }
      }
    }
  }, [gameDetails, setWinnerSelectionType]);

  // Update map options when availableMaps changes
  useEffect(() => {
    if (sltMapRef.current) {
      sltMapRef.current.innerHTML = '';
      if (availableMaps.length === 0) {
        sltMapRef.current.innerHTML = '<option value="">Loading maps...</option>';
        sltMapRef.current.disabled = true;
      } else {
        availableMaps.forEach((map) => {
          const option = document.createElement('option');
          option.value = map.index.toString();
          option.innerHTML = map.title;
          sltMapRef.current!.append(option);
        });
        sltMapRef.current.disabled = false;
        const currentMapIdx = gameDetails?.mapIndex;
        if (currentMapIdx !== null && typeof currentMapIdx !== 'undefined') {
          sltMapRef.current.value = currentMapIdx.toString();
        }
      }
    }
  }, [availableMaps, gameDetails?.mapIndex]);

  // Set auto recording checkbox
  useEffect(() => {
    if (chkAutoRecordingRef.current && options && rouletteInstance) {
      chkAutoRecordingRef.current.checked = options.autoRecording;
      rouletteInstance.setAutoRecording(options.autoRecording);
    }
  }, [rouletteInstance]);

  // Load saved names from localStorage (GameContext에서 처리하므로 여기서는 제거)
  useEffect(() => {
    const savedNames = localStorage.getItem('mbr_names');
    if (savedNames && inNamesRef.current) {
      inNamesRef.current.value = savedNames;
    }
  }, []);

  const handleInNamesInput = useCallback(() => {
    if (inNamesRef.current) {
      updateParticipants(inNamesRef.current.value);
    }
  }, [updateParticipants]);

  const handleInNamesBlur = useCallback(() => {
    if (inNamesRef.current) {
      updateParticipants(inNamesRef.current.value);
    }
  }, [updateParticipants]);

  const handleBtnShuffleClick = useCallback(() => {
    if (inNamesRef.current) {
      updateParticipants(inNamesRef.current.value);
    }
  }, [updateParticipants]);

  const handleBtnStartClick = useCallback(() => {
    startGame();
  }, [startGame]);

  const handleChkSkillChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUseSkills(e.target.checked);
  }, [setUseSkills]);

  const handleInWinningRankChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseInt(e.target.value, 10);
      setWinnerRank(isNaN(v) || v < 1 ? 1 : v, 'custom');
    },
    [setWinnerRank],
  );

  const handleBtnLastWinnerClick = useCallback(() => {
    const total = rouletteInstance?.getCount() ?? 1;
    setWinnerRank(total > 0 ? total : 1, 'last');
  }, [setWinnerRank, rouletteInstance]);

  const handleBtnFirstWinnerClick = useCallback(() => {
    setWinnerRank(1, 'first');
  }, [setWinnerRank]);

  const handleMapChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const index = parseInt(e.target.value, 10);
    setMap(index);
  }, [setMap]);

  const handleAutoRecordingChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAutoRecording(e.target.checked);
  }, [setAutoRecording]);

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
          <select id="sltMap" ref={sltMapRef} onChange={handleMapChange} disabled={settingsDisabled}></select>
        </div>
        <div className="row">
          <label htmlFor="chkAutoRecording">
            <i className="icon record"></i>
            <span data-trans>Recording</span>
          </label>
          <input
            type="checkbox"
            id="chkAutoRecording"
            ref={chkAutoRecordingRef}
            onChange={handleAutoRecordingChange}
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
              ref={btnFirstWinnerRef}
              onClick={handleBtnFirstWinnerClick}
              className={`btn-winner btn-first-winner ${winnerSelectionType === 'first' ? 'active' : ''}`}
              data-trans
              disabled={settingsDisabled}
            >
              First
            </button>
            <button
              ref={btnLastWinnerRef}
              onClick={handleBtnLastWinnerClick}
              className={`btn-winner btn-last-winner ${winnerSelectionType === 'last' ? 'active' : ''}`}
              data-trans
              disabled={settingsDisabled}
            >
              Last
            </button>
            <input
              type="number"
              id="in_winningRank"
              defaultValue="1"
              min="1"
              ref={inWinningRankRef}
              onChange={handleInWinningRankChange}
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
            defaultChecked
            ref={chkSkillRef}
            onChange={handleChkSkillChange}
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
          defaultValue="짱구*5, 짱아*10, 봉미선*3"
          ref={inNamesRef}
          onInput={handleInNamesInput}
          onBlur={handleInNamesBlur}
          disabled={gameFinishedOrInProgress}
        ></textarea>
        <div className="actions">
          <button id="btnShuffle" ref={btnShuffleRef} onClick={handleBtnShuffleClick} disabled={gameFinishedOrInProgress}>
            <i className="icon shuffle"></i>
            <span data-trans>Shuffle</span>
          </button>
          <button id="btnStart" ref={btnStartRef} onClick={handleBtnStartClick} disabled={gameFinishedOrInProgress}>
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
