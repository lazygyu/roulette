import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Roulette } from '../roulette';
import socketService from '../services/socketService';
import options from '../options';
import { getRoomDetails, getRoomGameDetails, getGameRanking } from '../services/api';
import { useAuth } from './AuthContext';
import { GameStatus, RoomInfo, RankingEntry, GameInfo, GameState } from '../types/gameTypes';
import { TranslatedLanguages, TranslationKeys, Translations } from '../data/languages';
import { parseName } from '../utils/parseName'; // 분리된 parseName 임포트

interface GameContextType {
  roomId: string | undefined;
  roomName: string | null;
  roomDetails: RoomInfo | null;
  gameDetails: GameInfo | null;
  gameState: GameState | null; // GameState 추가
  isManager: boolean;
  finalRanking: RankingEntry[] | null;
  showRankingModal: boolean;
  setShowRankingModal: (show: boolean) => void;
  showPasswordModal: boolean;
  passwordInput: string;
  setPasswordInput: (password: string) => void;
  joinError: string | null;
  winnerSelectionType: 'first' | 'last' | 'custom';
  setWinnerSelectionType: (type: 'first' | 'last' | 'custom') => void;
  winningRankDisplay: number | null; // UI에 표시될 1-index 값
  currentLocale: TranslatedLanguages;
  rouletteInstance: Roulette | null;
  availableMaps: { index: number; title: string }[];
  initializeGame: (canvasContainer: HTMLDivElement) => Promise<void>;
  handlePasswordJoin: () => Promise<void>;
  setWinnerRank: (rank: number, type: 'first' | 'last' | 'custom') => void;
  updateParticipants: (rawNamesInput: string) => void;
  startGame: () => void;
  setUseSkills: (use: boolean) => void;
  setMap: (index: number) => void;
  setAutoRecording: (auto: boolean) => void;
  parseName: (nameStr: string) => { name: string; weight: number; count: number };
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [rouletteInstance, setRouletteInstance] = useState<Roulette | null>(null);
  const [winnerSelectionType, setWinnerSelectionType] = useState<'first' | 'last' | 'custom'>('first');
  const [isManager, setIsManager] = useState(false);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [roomDetails, setRoomDetails] = useState<RoomInfo | null>(null);
  const [gameDetails, setGameDetails] = useState<GameInfo | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null); // gameState 상태 추가
  const gameDetailsRef = useRef(gameDetails); // For use in socket callbacks
  const [finalRanking, setFinalRanking] = useState<RankingEntry[] | null>(null);
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [currentLocale, setCurrentLocale] = useState<TranslatedLanguages>('en');
  const [availableMaps, setAvailableMaps] = useState<{ index: number; title: string }[]>([]);
  const [winningRankDisplay, setWinningRankDisplay] = useState<number | null>(1); // UI에 표시될 1-index 값

  useEffect(() => {
    gameDetailsRef.current = gameDetails;
  }, [gameDetails]);

  useEffect(() => {
    setIsManager(!!(user && roomDetails && roomDetails.managerId === user.id));
  }, [user, roomDetails]);

  // Language/Translation setup
  useEffect(() => {
    const originalDocumentLang = document.documentElement.lang;
    const defaultLoc: TranslatedLanguages = 'en';

    const getBrowserLoc = () => navigator.language.split('-')[0] as TranslatedLanguages;
    const translateElForPage = (element: Element) => {
      if (!(element instanceof HTMLElement) || !currentLocale || !Translations[currentLocale]) return;
      const prop = element.getAttribute('data-trans');
      const targetKey = prop ? (element.getAttribute(prop) || '').trim() : element.innerText.trim();
      if (targetKey && Translations[currentLocale]?.[targetKey as TranslationKeys]) {
        const translation = Translations[currentLocale]![targetKey as TranslationKeys];
        if (prop) element.setAttribute(prop, translation);
        else element.innerText = translation;
      }
    };
    const translateP = () => document.querySelectorAll('[data-trans]').forEach(translateElForPage);
    const setPageLoc = (newLoc: string) => {
      const newLocTyped = newLoc as TranslatedLanguages;
      if (newLocTyped === currentLocale) return; // Use currentLocale state
      document.documentElement.lang = newLocTyped;
      const localeToSet = newLocTyped in Translations ? newLocTyped : defaultLoc;
      setCurrentLocale(localeToSet);
      translateP();
    };
    setPageLoc(getBrowserLoc());

    return () => {
      document.documentElement.lang = originalDocumentLang;
    };
  }, [currentLocale]); // Depend on currentLocale to re-translate if it changes

  const fetchGameDetailsAndInitializeUI = useCallback(
    async (numericRoomId: number) => {
      try {
        const fetchedGameDetails = await getRoomGameDetails(numericRoomId);
        setGameDetails(fetchedGameDetails);

        if (fetchedGameDetails) {
          if (fetchedGameDetails.status === GameStatus.FINISHED) {
            try {
              const rankingData = await getGameRanking(numericRoomId);
              setFinalRanking(rankingData.rankings);
              if (rankingData.rankings && rankingData.rankings.length > 0) setShowRankingModal(true);
            } catch (rankingError) {
              console.error('GameContext: Failed to fetch game ranking:', rankingError);
            }
          } else if (
            fetchedGameDetails.status === GameStatus.WAITING ||
            fetchedGameDetails.status === GameStatus.IN_PROGRESS
          ) {
            // Update roulette instance and options based on fetched details
            if (rouletteInstance && fetchedGameDetails.marbles && fetchedGameDetails.marbles.length > 0) {
              // This part will be handled by GamePage passing ref values
            }
            if (fetchedGameDetails.winningRank !== null) {
              setWinnerSelectionType(fetchedGameDetails.winningRank === 0 ? 'first' : 'custom'); // 0-index to 'first'
              setWinningRankDisplay(fetchedGameDetails.winningRank + 1); // 0-index to 1-index for display
            } else {
              setWinnerSelectionType('first'); // Default to first if null
              setWinningRankDisplay(1);
            }
            if (options && fetchedGameDetails.speed !== null) {
              options.speed = fetchedGameDetails.speed;
            }
          }
        }
      } catch (apiError) {
        console.error('GameContext: Failed to fetch game details after joining:', apiError);
      }
    },
    [rouletteInstance],
  ); // Depend on rouletteInstance

  const handlePasswordJoin = useCallback(async () => {
    if (!roomId) {
      setJoinError('Room ID is missing.');
      return;
    }
    if (!passwordInput) {
      setJoinError('Password is required.');
      return;
    }
    setJoinError(null);

    const numericRoomId = parseInt(roomId, 10);
    if (isNaN(numericRoomId)) {
      setJoinError('Invalid Room ID format.');
      return;
    }

    try {
      const response = await socketService.joinRoom(roomId, passwordInput);
      if (response.success) {
        setShowPasswordModal(false);
        setPasswordInput('');
        if (response.gameState && rouletteInstance) {
          rouletteInstance.updateStateFromServer(response.gameState);
        }
        await fetchGameDetailsAndInitializeUI(numericRoomId);
      } else {
        setJoinError(response.message || 'Failed to join room. Incorrect password?');
        if (!response.requiresPassword) {
          alert(response.message || '방 입장에 실패했습니다. 이전 페이지로 돌아갑니다.');
          navigate(-1);
        }
      }
    } catch (error) {
      console.error('Error joining room with password:', error);
      setJoinError('방 참여 중 오류가 발생했습니다.');
    }
  }, [roomId, passwordInput, navigate, fetchGameDetailsAndInitializeUI, rouletteInstance]);

  const setWinnerRank = useCallback((rank: number, type: 'first' | 'last' | 'custom') => {
    if (options) options.winningRank = rank;
    socketService.setWinningRank(rank - 1); // 1-index to 0-index for backend
    setWinnerSelectionType(type);
    setWinningRankDisplay(rank); // Update display value
  }, []);

  const updateParticipants = useCallback(
    (rawNamesInput: string) => {
      if (gameDetailsRef.current?.status === GameStatus.FINISHED) return;

      // localStorage에는 원본 문자열을 그대로 저장
      localStorage.setItem('mbr_names', rawNamesInput);

      // 백엔드에는 유효한 이름만 필터링하여 전송
      const nameSource = rawNamesInput.split(/[,\r\n]/g).map((v) => v.trim());

      const nameSet = new Set<string>();
      const nameCounts: { [key: string]: number } = {};
      nameSource.forEach((nameSrc) => {
        const item = parseName(nameSrc);
        const key = item.weight > 1 ? `${item.name}/${item.weight}` : item.name || '';
        if (item.name === '') return; // 이름이 빈 문자열이면 처리하지 않음
        if (!nameSet.has(key)) nameSet.add(key);
        nameCounts[key] = (nameCounts[key] || 0) + item.count;
      });
      const namesToSend = Object.keys(nameCounts).map((key) => {
        const count = nameCounts[key];
        // parseName의 결과에서 name과 weight를 다시 추출하여 원래 형식으로 복원
        const match = key.match(/^(.*?)(?:\/(\d+))?$/);
        const namePart = match ? match[1] : key;
        const weightPart = match && match[2] ? `/${match[2]}` : '';
        return count > 1 ? `${namePart}${weightPart}*${count}` : `${namePart}${weightPart}`;
      });

      console.log('names to backend:', JSON.stringify(namesToSend));
      socketService.setMarbles(namesToSend);
    },
    [gameDetailsRef],
  );

  const startGame = useCallback(() => {
    if (gameDetailsRef.current?.status === GameStatus.FINISHED) {
      alert('이미 종료된 게임입니다. 다시 시작할 수 없습니다.');
      return;
    }
    if ((rouletteInstance?.getCount() ?? 0) === 0) {
      alert('참여자가 없습니다. 참여자를 추가해주세요.');
      return;
    }
    socketService.startGame();
  }, [rouletteInstance]);

  const setUseSkills = useCallback((use: boolean) => {
    setGameDetails((prev) => (prev ? { ...prev, useSkills: use } : prev));
    // options.useSkills = use; // options 직접 수정 제거
  }, []);

  const setMap = useCallback((index: number) => {
    if (!isNaN(index)) socketService.setMap(index);
    setGameDetails((prev) => (prev ? { ...prev, mapIndex: index } : prev));
  }, []);

  const setAutoRecording = useCallback(
    (auto: boolean) => {
      if (rouletteInstance) rouletteInstance.setAutoRecording(auto);
      setGameDetails((prev) => (prev ? { ...prev, autoRecording: auto } : prev));
    },
    [rouletteInstance],
  );

  // Main game initialization logic
  const initializeGame = useCallback(
    async (canvasContainer: HTMLDivElement) => {
      if (!roomId) {
        alert('잘못된 접근입니다. 방 ID가 없습니다.');
        navigate('/');
        return;
      }
      const numericRoomId = parseInt(roomId, 10);
      if (isNaN(numericRoomId)) {
        alert('잘못된 방 ID입니다.');
        navigate('/');
        return;
      }

      let currentRouletteInstance = rouletteInstance;
      // 1. Initialize Roulette
      if (!currentRouletteInstance) {
        const newRouletteInstance = new Roulette();
        setRouletteInstance(newRouletteInstance);
        try {
          await newRouletteInstance.initialize(canvasContainer);
          currentRouletteInstance = newRouletteInstance; // Use the newly created instance
        } catch (error) {
          console.error('[GameContext] 룰렛 초기화 실패:', error);
          alert('게임 엔진 초기화에 실패했습니다. 페이지를 새로고침 해주세요.');
          return;
        }
      }

      // 2. Fetch Room Details
      let room: RoomInfo;
      try {
        room = await getRoomDetails(numericRoomId);
        setRoomDetails(room);
        setRoomName(room.name);
      } catch (error: any) {
        alert(error.message || '방 정보를 가져오거나 연결에 실패했습니다. 이전 페이지로 돌아갑니다.');
        navigate(-1);
        return;
      }

      // 3. Connect Socket
      if (!socketService.isConnected() || socketService.getCurrentRoomId() !== roomId) {
        await socketService.connect(roomId);
      }

      // 4. Join Room (handle password)
      if (room.isPasswordRequired && !socketService.getJoinedStatus(roomId)) {
        setShowPasswordModal(true);
        return; // Wait for password modal interaction
      } else if (!socketService.getJoinedStatus(roomId)) {
        const joinResponse = await socketService.joinRoom(roomId, undefined);
        if (joinResponse.success) {
          if (joinResponse.gameState && currentRouletteInstance) {
            currentRouletteInstance.updateStateFromServer(joinResponse.gameState);
          }
        } else {
          alert(joinResponse.message || '방 입장에 실패했습니다. 이전 페이지로 돌아갑니다.');
          navigate(-1);
          return;
        }
      }

      // 5. Fetch Game Details and Initialize UI
      await fetchGameDetailsAndInitializeUI(numericRoomId);

      // 6. Subscribe to Socket Events
      const unsubscribeMaps = socketService.onAvailableMapsUpdate((maps) => {
        setAvailableMaps(maps);
        // Update map selection if current map index is available
        const currentMapIdx = gameDetailsRef.current?.mapIndex;
        if (currentMapIdx !== null && typeof currentMapIdx !== 'undefined') {
          // This will be handled by GamePage passing ref values
        }
      });

      const unsubscribeGameState = socketService.onGameStateUpdate(async (gameState) => {
        if (!gameState || !currentRouletteInstance) return;
        currentRouletteInstance.updateStateFromServer(gameState);
        setGameState(gameState); // gameState 상태 업데이트 추가
        setGameDetails((prev) => {
          const newStatus =
            !gameState.isRunning && gameState.winner
              ? GameStatus.FINISHED
              : gameState.isRunning
                ? GameStatus.IN_PROGRESS
                : GameStatus.WAITING;
          const marbles = gameState.marbles ? gameState.marbles.map((m) => m.name) : prev?.marbles || [];
          if (currentRouletteInstance && gameState.skillEffects) {
            currentRouletteInstance.processServerSkillEffects(gameState.skillEffects);
          }
          return {
            id: prev?.id || 0,
            status: newStatus,
            mapIndex: prev?.mapIndex ?? null,
            marbles,
            winningRank: gameState.winnerRank ?? prev?.winningRank ?? null,
            speed: prev?.speed ?? null,
            useSkills: prev?.useSkills ?? true, // 기본값 설정
            autoRecording: prev?.autoRecording ?? options.autoRecording, // 기본값 설정
            isRunning: gameState.isRunning, // isRunning 추가
            createdAt: prev?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        });

        const gameEndedBySocket =
          !gameState.isRunning &&
          gameState.winners &&
          gameState.winners.length > 0 &&
          gameState.winners.length >= gameState.winnerRank;
        if (gameEndedBySocket && gameDetailsRef.current?.status !== GameStatus.FINISHED) {
          try {
            const authGameDetails = await getRoomGameDetails(numericRoomId);
            setGameDetails(authGameDetails);
            if (authGameDetails.status === GameStatus.FINISHED) {
              const ranking = await getGameRanking(numericRoomId);
              setFinalRanking(ranking.rankings);
              if (ranking.rankings?.length > 0) setShowRankingModal(true);
            }
          } catch (err) {
            console.error('Error fetching game details/ranking on game end:', err);
          }
        }
      });

      // Set auto recording based on options
      if (options && currentRouletteInstance) {
        currentRouletteInstance.setAutoRecording(options.autoRecording);
      }

      // Store unsubscribe functions in a ref or state if needed for cleanup outside this function
      // For now, we'll rely on the useEffect cleanup for socketService.disconnect()
      // The individual socket subscriptions will be managed by socketService itself.
      // The return value of initializeGame should be void as per GameContextType.
    },
    [roomId, navigate, rouletteInstance, fetchGameDetailsAndInitializeUI],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socketService.disconnect();
    };
  }, []);

  const contextValue: GameContextType = {
    roomId,
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
    winningRankDisplay, // 추가
    currentLocale,
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
    parseName,
    gameState, // gameState 추가
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
