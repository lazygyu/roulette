import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import { getRoomDetails, getRoomGameDetails, getGameRanking } from '../services/api';
import { GameState, RoomInfo, GameInfo, RankingEntry, GameStatus, MapInfo } from '../types/gameTypes';
import { Roulette } from '../roulette';

export const useSocketManager = (roomId: string | undefined, rouletteInstance: Roulette | null) => {
  const navigate = useNavigate();
  const [roomDetails, setRoomDetails] = useState<RoomInfo | null>(null);
  const [gameDetails, setGameDetails] = useState<GameInfo | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [finalRanking, setFinalRanking] = useState<RankingEntry[] | null>(null);
  const [availableMaps, setAvailableMaps] = useState<MapInfo[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);

  const handlePasswordJoin = useCallback(async (password: string) => {
    if (!roomId || !rouletteInstance) {
      setJoinError('Room ID or game instance is missing.');
      return;
    }
    setJoinError(null);
    const numericRoomId = parseInt(roomId, 10);
    try {
      const rankingData = await getGameRanking(numericRoomId, password);
      setFinalRanking(rankingData.rankings);
      setShowPasswordModal(false);

      if (!socketService.isConnected() || socketService.getCurrentRoomId() !== roomId) {
        await socketService.connect(roomId);
      }
      if (!socketService.getJoinedStatus(roomId)) {
        const joinResponse = await socketService.joinRoom(roomId, password);
        if (!joinResponse.success) {
          alert(joinResponse.message || 'Failed to join room.');
          navigate(-1);
          return;
        }
        if (joinResponse.gameState) {
          rouletteInstance.updateStateFromServer(joinResponse.gameState);
        }
      }

      const fetchedGameDetails = await getRoomGameDetails(numericRoomId);
      setGameDetails(fetchedGameDetails);
    } catch (error: any) {
      if (error.response && error.response.status === 403) {
        setJoinError('Incorrect password.');
      } else {
        console.error('Error joining room with password:', error);
        setJoinError('An error occurred while joining the room.');
      }
    }
  }, [roomId, rouletteInstance, navigate]);

  useEffect(() => {
    if (!roomId || !rouletteInstance) return;

    const numericRoomId = parseInt(roomId, 10);
    if (isNaN(numericRoomId)) {
      alert('Invalid Room ID.');
      navigate('/');
      return;
    }

    const connectAndJoin = async () => {
      try {
        const room = await getRoomDetails(numericRoomId);
        setRoomDetails(room);

        if (!socketService.isConnected() || socketService.getCurrentRoomId() !== roomId) {
          await socketService.connect(roomId);
        }

        const fetchedGameDetails = await getRoomGameDetails(numericRoomId);
        setGameDetails(fetchedGameDetails);

        if (room.isPasswordRequired) {
          if (fetchedGameDetails.status === GameStatus.FINISHED) {
            setShowPasswordModal(true);
          } else if (!socketService.getJoinedStatus(roomId)) {
            setShowPasswordModal(true);
          }
        } else {
          if (fetchedGameDetails.status === GameStatus.FINISHED) {
            const rankingData = await getGameRanking(numericRoomId);
            setFinalRanking(rankingData.rankings);
          }
          if (!socketService.isConnected() || socketService.getCurrentRoomId() !== roomId) {
            await socketService.connect(roomId);
          }
          if (!socketService.getJoinedStatus(roomId)) {
            const joinResponse = await socketService.joinRoom(roomId);
            if (!joinResponse.success) {
              alert(joinResponse.message || 'Failed to join room.');
              navigate(-1);
              return;
            }
            if (joinResponse.gameState) {
              rouletteInstance.updateStateFromServer(joinResponse.gameState);
            }
          }
        }

      } catch (error: any) {
        alert(error.message || 'Failed to connect to the room.');
        navigate(-1);
      }
    };

    connectAndJoin();

    const unsubscribeGameState = socketService.onGameStateUpdate((newState) => {
      setGameState(newState);
      rouletteInstance.updateStateFromServer(newState);
      if (newState.skillEffects) {
        rouletteInstance.processServerSkillEffects(newState.skillEffects);
      }
      if (newState.isRunning) {
        setGameDetails((prevDetails) => {
          if (prevDetails && prevDetails.status !== GameStatus.IN_PROGRESS) {
            return { ...prevDetails, status: GameStatus.IN_PROGRESS };
          }
          return prevDetails;
        });
      }
    });

    const unsubscribeMaps = socketService.onAvailableMapsUpdate(setAvailableMaps);

    const unsubscribeGameOver = socketService.onGameOver(async () => {
      const rankingData = await getGameRanking(numericRoomId);
      setFinalRanking(rankingData.rankings);
      setGameDetails((prevDetails) => {
        if (prevDetails && prevDetails.status !== GameStatus.FINISHED) {
          return { ...prevDetails, status: GameStatus.FINISHED };
        }
        return prevDetails;
      });
    });

    return () => {
      unsubscribeGameState();
      unsubscribeMaps();
      unsubscribeGameOver();
      socketService.disconnect();
    };
  }, [roomId, rouletteInstance, navigate]);

  return {
    roomDetails,
    gameDetails,
    gameState,
    finalRanking,
    availableMaps,
    showPasswordModal,
    setShowPasswordModal,
    joinError,
    handlePasswordJoin,
    isManager,
    setIsManager,
  };
};
