import React, { FC } from 'react';
import { GameInfo, GameStatus } from '../../../types/gameTypes';

interface GameActionsProps {
  gameDetails: GameInfo | null;
  onShuffleClick: () => void;
  onStartClick: () => void;
  disabled: boolean;
}

const GameActions: FC<GameActionsProps> = ({ gameDetails, onShuffleClick, onStartClick, disabled }) => {
  return (
    <div className="actions">
      <button id="btnShuffle" onClick={onShuffleClick} disabled={disabled}>
        <i className="icon shuffle"></i>
        <span data-trans>Shuffle</span>
      </button>
      <button id="btnStart" onClick={onStartClick} disabled={disabled}>
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
  );
};

export default GameActions;
