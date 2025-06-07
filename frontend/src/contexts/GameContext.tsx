import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Roulette } from '../roulette';
import { CoordinateManager } from '../utils/coordinate-manager';
import { useAuth } from './AuthContext';
import { useSocketManager } from '../hooks/useSocketManager';
import { GameState, RoomInfo, RankingEntry, GameInfo, MapInfo } from '../types/gameTypes';

interface GameContextType {
  roomId: string | undefined;
  roomDetails: RoomInfo | null;
  gameDetails: GameInfo | null;
  gameState: GameState | null;
  isManager: boolean;
  finalRanking: RankingEntry[] | null;
  showPasswordModal: boolean;
  setShowPasswordModal: (show: boolean) => void;
  joinError: string | null;
  rouletteInstance: Roulette | null;
  availableMaps: MapInfo[];
  handlePasswordJoin: (password: string) => Promise<void>;
  initializeGame: (container: HTMLDivElement) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const [rouletteInstance, setRouletteInstance] = useState<Roulette | null>(null);
  const [isManager, setIsManager] = useState(false);

  const {
    roomDetails,
    gameDetails,
    gameState,
    finalRanking,
    availableMaps,
    showPasswordModal,
    setShowPasswordModal,
    joinError,
    handlePasswordJoin,
    setIsManager: setSocketManagerIsManager,
  } = useSocketManager(roomId, rouletteInstance);

  useEffect(() => {
    const newIsManager = !!(user && roomDetails && roomDetails.managerId === user.id);
    setIsManager(newIsManager);
    setSocketManagerIsManager(newIsManager);
  }, [user, roomDetails, setSocketManagerIsManager]);

  const initializeGame = useCallback(async (container: HTMLDivElement) => {
    if (!rouletteInstance) {
      const coordinateManager = new CoordinateManager();
      const newRoulette = new Roulette(coordinateManager);
      await newRoulette.initialize(container);
      setRouletteInstance(newRoulette);
    }
  }, [rouletteInstance]);

  const contextValue: GameContextType = {
    roomId,
    roomDetails,
    gameDetails,
    gameState,
    isManager,
    finalRanking,
    showPasswordModal,
    setShowPasswordModal,
    joinError,
    rouletteInstance,
    availableMaps,
    handlePasswordJoin,
    initializeGame,
  };

  return <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
