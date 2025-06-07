import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface GameBarProps {
  roomName: string | null;
  isManager: boolean;
}

const GameBar: React.FC<GameBarProps> = ({ roomName, isManager }) => {
  const { user } = useAuth();

  return (
    <div className="game-top-bar">
      <span className="room-name">{roomName || 'Loading room...'}</span>
      {isManager && (
        <span className="manager-icon" title="Manager">
          👑
        </span>
      )}
      <span className="user-nickname">{user?.nickname || '익명 유저'}</span>
    </div>
  );
};

export default GameBar;
