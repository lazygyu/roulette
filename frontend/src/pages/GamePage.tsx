import React, { useEffect, useRef, useState, useCallback, FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles.css';
import { Roulette } from '../roulette';
import socketService from '../services/socketService';
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
// GamePage에 필요한 window 속성들을 전역 Window 인터페이스에 선택적으로 추가
declare global {
  interface Window {
    roullete?: Roulette;
    options?: typeof options;
    dataLayer?: any[];
    translateElement?: (element: HTMLElement) => void;
  }
}

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
  const rouletteCanvasContainerRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Initial load and game setup
  useEffect(() => {
    if (rouletteCanvasContainerRef.current) {
      initializeGame(rouletteCanvasContainerRef.current);
    }
  }, [initializeGame]);

  return (
    <>
      <GameBar roomName={roomName} isManager={isManager} />
      <SettingsPanel
        isManager={isManager}
        gameDetails={gameDetails}
        winnerSelectionType={winnerSelectionType}
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
