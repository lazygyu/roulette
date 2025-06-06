import React, { FC } from 'react';
import '../styles.css';
import RankingDisplay from '../components/RankingDisplay';
import PasswordModal from '../components/PasswordModal';
import GameBar from '../components/GameBar';
import SettingsPanel from '../components/SettingsPanel';
import { GameProvider } from '../contexts/GameContext';
import { useGamePageLogic } from '../hooks/useGamePageLogic';
import RouletteCanvas from '../components/game/RouletteCanvas';
import GameFooter from '../components/game/GameFooter';
import { Skills } from '../types/gameTypes';

const GamePageContent: FC = () => {
  const {
    roomName,
    isManager,
    finalRanking,
    showRankingModal,
    setShowRankingModal,
    showPasswordModal,
    passwordInput,
    setPasswordInput,
    joinError,
    initializeGame,
    handlePasswordJoin,
    selectedSkill,
    handleSkillSelect,
    handleCanvasClick,
    gameState,
    useSkills,
    passwordInputRef,
  } = useGamePageLogic();

  return (
    <>
      <GameBar roomName={roomName || ''} isManager={isManager} />
      {!gameState?.isRunning && <SettingsPanel />}
      <GameFooter />
      {gameState?.isRunning && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 1000,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '10px',
            borderRadius: '5px',
          }}
        >
          <label htmlFor="skill-select" style={{ marginRight: '10px' }}>
            스킬 선택:
          </label>
          <select
            id="skill-select"
            value={selectedSkill}
            onChange={(e) => handleSkillSelect(e.target.value as Skills)}
            style={{
              padding: '5px',
              borderRadius: '3px',
              border: '1px solid #ccc',
              backgroundColor: '#333',
              color: 'white',
            }}
          >
            <option value={Skills.None}>없음</option>
            <option value={Skills.Impact}>Impact</option>
            <option value={Skills.DummyMarble}>DummyMarble</option>
          </select>
        </div>
      )}
      <div onClick={handleCanvasClick} style={{ cursor: selectedSkill !== Skills.None ? 'crosshair' : 'default' }}>
        <RouletteCanvas initializeGame={initializeGame} />
      </div>
      {showRankingModal && finalRanking && (
        <RankingDisplay ranking={finalRanking} roomName={roomName || ''} onClose={() => setShowRankingModal(false)} />
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
