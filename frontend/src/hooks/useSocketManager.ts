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
  const [isManager, setIsManager] = useState(false); // 이 부분은 user 정보가 필요하여 GameContext에서 처리해야 할 수 있습니다.

  const handlePasswordJoin = useCallback(async (password: string) => {
    if (!roomId) {
      setJoinError('Room ID is missing.');
      return;
    }
    setJoinError(null);
    const numericRoomId = parseInt(roomId, 10);
    try {
      // 랭킹 조회를 통해 비밀번호 검증 및 랭킹 정보 가져오기
      const rankingData = await getGameRanking(numericRoomId, password);
      setFinalRanking(rankingData.rankings);
      setShowPasswordModal(false); // 비밀번호가 맞았으므로 모달을 닫습니다.

      // 소켓 연결 및 방 입장
      if (!socketService.isConnected() || socketService.getCurrentRoomId() !== roomId) {
        await socketService.connect(roomId);
      }
      if (!socketService.getJoinedStatus(roomId)) {
        await socketService.joinRoom(roomId, password);
      }
    } catch (error: any) {
      // getGameRanking에서 비밀번호가 틀리면 403 Forbidden 에러를 반환합니다.
      if (error.response && error.response.status === 403) {
        setJoinError('Incorrect password.');
      } else {
        console.error('Error joining room with password:', error);
        setJoinError('An error occurred while joining the room.');
      }
    }
  }, [roomId, rouletteInstance]);

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
        // 1. Fetch Room Details
        const room = await getRoomDetails(numericRoomId);
        setRoomDetails(room);

        // 2. Connect Socket
        if (!socketService.isConnected() || socketService.getCurrentRoomId() !== roomId) {
          await socketService.connect(roomId);
        }

        // 3. Fetch initial game details and join room
        const fetchedGameDetails = await getRoomGameDetails(numericRoomId);
        setGameDetails(fetchedGameDetails);

        if (room.isPasswordRequired) {
          if (fetchedGameDetails.status === GameStatus.FINISHED) {
            setShowPasswordModal(true);
          } else if (!socketService.getJoinedStatus(roomId)) {
            setShowPasswordModal(true);
          }
        } else {
          // 비밀번호가 없는 방
          if (fetchedGameDetails.status === GameStatus.FINISHED) {
            const rankingData = await getGameRanking(numericRoomId);
            setFinalRanking(rankingData.rankings);
          }
          // 소켓 연결 및 방 입장
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
      const rankingData = await getGameRanking(numericRoomId); // 비밀번호가 없는 경우
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
    setIsManager, // Temporarily expose setter
  };
};
