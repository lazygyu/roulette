import React, { FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles.css';
import RankingDisplay from '../components/RankingDisplay';
import PasswordModal from '../components/PasswordModal';
import GameBar from '../components/GameBar';
import SettingsPanel from '../components/SettingsPanel';
import { GameProvider } from '../contexts/GameContext'; // GameContext 임포트
import { useGamePageLogic } from '../hooks/useGamePageLogic'; // 커스텀 훅 임포트
import RouletteCanvas from '../components/game/RouletteCanvas'; // 새 컴포넌트 임포트
import GameFooter from '../components/game/GameFooter'; // 새 컴포넌트 임포트

const GamePageContent: FC = () => {
  const {
    roomName,
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
    winningRankDisplay,
    availableMaps,
    initializeGame,
    handlePasswordJoin,
    namesInput,
    autoRecording,
    useSkills,
    mapIndex,
    onNamesInput,
    onNamesBlur,
    onShuffleClick,
    onStartClick,
    onSkillChange,
    onWinningRankChange,
    onFirstWinnerClick,
    onLastWinnerClick,
    onMapChange,
    onAutoRecordingChange,
    passwordInputRef,
  } = useGamePageLogic();

  return (
    <>
      <GameBar roomName={roomName} isManager={isManager} />
      <SettingsPanel
        isManager={isManager}
        gameDetails={gameDetails}
        winnerSelectionType={winnerSelectionType}
        winningRankDisplay={winningRankDisplay}
        mapIndex={mapIndex}
        availableMaps={availableMaps}
        autoRecording={autoRecording}
        useSkills={useSkills}
        namesInput={namesInput}
        onMapChange={onMapChange}
        onAutoRecordingChange={onAutoRecordingChange}
        onFirstWinnerClick={onFirstWinnerClick}
        onLastWinnerClick={onLastWinnerClick}
        onWinningRankChange={onWinningRankChange}
        onSkillChange={onSkillChange}
        onNamesInput={onNamesInput}
        onNamesBlur={onNamesBlur}
        onShuffleClick={onShuffleClick}
        onStartClick={onStartClick}
      />
      <GameFooter />
      <RouletteCanvas initializeGame={initializeGame} />
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
