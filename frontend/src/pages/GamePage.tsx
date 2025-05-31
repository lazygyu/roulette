import React, { useEffect, useRef, useState, useCallback, FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles.css';
import options from '../options';
import { getRoomDetails, getRoomGameDetails, getGameRanking } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { GameStatus, RoomInfo, RankingEntry, GameInfo } from '../types/gameTypes';
import RankingDisplay from '../components/RankingDisplay';
import PasswordModal from '../components/PasswordModal';
import GameBar from '../components/GameBar';
import SettingsPanel from '../components/SettingsPanel';
import { TranslatedLanguages, TranslationKeys, Translations } from '../data/languages';
import { GameProvider, useGame } from '../contexts/GameContext'; // GameContext 임포트
const GamePageContent: FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const {
    roomName,
    roomDetails,
    gameDetails,
    isManager,
    finalRanking,
    showRankingModal,
    setShowRankingModal,
    showPasswordModal,
    passwordInput,
    setPasswordInput,
    joinError,
    winnerSelectionType,
    setWinnerSelectionType,
    winningRankDisplay, // winningRankDisplay 추가
    rouletteInstance,
    availableMaps,
    initializeGame,
    handlePasswordJoin,
    setWinnerRank,
    updateParticipants,
    startGame,
    setUseSkills,
    setMap,
    setAutoRecording,
  } = useGame();

  // Refs for DOM elements
  const inNamesRef = useRef<HTMLTextAreaElement>(null);
  const inWinningRankRef = useRef<HTMLInputElement>(null); // SettingsPanel에서 직접 제어하므로 제거 예정
  const chkSkillRef = useRef<HTMLInputElement>(null);
  const sltMapRef = useRef<HTMLSelectElement>(null);
  const chkAutoRecordingRef = useRef<HTMLInputElement>(null);
  const rouletteCanvasContainerRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const btnShuffleRef = useRef<HTMLButtonElement>(null);
  const btnStartRef = useRef<HTMLButtonElement>(null);
  const btnLastWinnerRef = useRef<HTMLButtonElement>(null);
  const btnFirstWinnerRef = useRef<HTMLButtonElement>(null);

  // Initial load and game setup
  useEffect(() => {
    if (rouletteCanvasContainerRef.current) {
      initializeGame(rouletteCanvasContainerRef.current);
    }
  }, [initializeGame]);

  // Update UI elements based on gameDetails from context
  useEffect(() => {
    if (gameDetails) {
      if (gameDetails.status === GameStatus.WAITING || gameDetails.status === GameStatus.IN_PROGRESS) {
        if (inNamesRef.current && gameDetails.marbles && gameDetails.marbles.length > 0) {
          // GameContext에서 localStorage 로드를 처리하므로, 여기서는 UI만 업데이트
          inNamesRef.current.value = gameDetails.marbles.join(',');
        }
        // inWinningRankRef.current.value 설정 로직 제거 (winningRankDisplay로 대체)
        if (sltMapRef.current && gameDetails.mapIndex !== null) {
          sltMapRef.current.value = gameDetails.mapIndex.toString();
        }
      }
    }
  }, [gameDetails]); // setWinnerSelectionType 의존성 제거

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

  // Load saved names from localStorage (GameContext에서 처리하므로 여기서는 제거)
  useEffect(() => {
    const savedNames = localStorage.getItem('mbr_names');
    if (savedNames && inNamesRef.current) {
      inNamesRef.current.value = savedNames;
    }
  }, []);

  // Set auto recording checkbox
  useEffect(() => {
    if (chkAutoRecordingRef.current && options && rouletteInstance) {
      chkAutoRecordingRef.current.checked = options.autoRecording;
      rouletteInstance.setAutoRecording(options.autoRecording);
    }
  }, [rouletteInstance]);

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

  return (
    <>
      <GameBar roomName={roomName} isManager={isManager} />
      <SettingsPanel
        isManager={isManager}
        gameDetails={gameDetails}
        winnerSelectionType={winnerSelectionType}
        winningRankDisplay={winningRankDisplay} // winningRankDisplay 추가
        sltMapRef={sltMapRef}
        chkAutoRecordingRef={chkAutoRecordingRef}
        chkSkillRef={chkSkillRef}
        inNamesRef={inNamesRef}
        btnShuffleRef={btnShuffleRef}
        btnStartRef={btnStartRef}
        btnFirstWinnerRef={btnFirstWinnerRef}
        btnLastWinnerRef={btnLastWinnerRef}
        onMapChange={handleMapChange}
        onAutoRecordingChange={handleAutoRecordingChange}
        onFirstWinnerClick={handleBtnFirstWinnerClick}
        onLastWinnerClick={handleBtnLastWinnerClick}
        onWinningRankChange={handleInWinningRankChange}
        onSkillChange={handleChkSkillChange}
        onNamesInput={handleInNamesInput}
        onNamesBlur={handleInNamesBlur}
        onShuffleClick={handleBtnShuffleClick}
        onStartClick={handleBtnStartClick}
      />
      <div className="copyright">
        &copy; 2025.{' '}
        <a href="https://lazygyu.net" target="_blank" rel="noopener noreferrer">
          lazygyu
        </a>
        <span data-trans>
          This program is freeware and may be used freely anywhere, including in broadcasts and videos.
        </span>
      </div>
      <div
        id="roulette-canvas-container"
        ref={rouletteCanvasContainerRef}
        style={{ width: '100%', height: '100%', position: 'fixed', top: 0, left: 0 }}
      />
      {showRankingModal && finalRanking && (
        <RankingDisplay ranking={finalRanking} roomName={roomName} onClose={() => setShowRankingModal(false)} />
      )}
      <PasswordModal
        show={showPasswordModal}
        passwordInput={passwordInput}
        onPasswordInputChange={setPasswordInput}
        onJoin={handlePasswordJoin}
        joinError={joinError}
        passwordInputRef={passwordInputRef}
      />
    </>
  );
};

const GamePage: FC = () => {
  return (
    <GameProvider>
      <GamePageContent />
    </GameProvider>
  );
};

export default GamePage;
