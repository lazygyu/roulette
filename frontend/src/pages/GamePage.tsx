import React, { useEffect, useRef, useState, useCallback, FC } from 'react'; // FC 추가
import { useParams, useNavigate } from 'react-router-dom';
import '../styles.css';
import { Roulette } from '../roulette';
import socketService from '../services/socketService'; // 경로 변경
import options from '../options'; // 실제 인스턴스 사용
import { getRoomDetails, getRoomGameDetails, getGameRanking } from '../services/api'; // getRoomGameDetails, getGameRanking 임포트 추가
import { useAuth } from '../contexts/AuthContext'; // useAuth 임포트 추가
import { GameStatus, RoomInfo, RankingEntry, GameInfo } from '../types/gameTypes'; // MarbleState 제거 (직접 사용 안 함)
import RankingDisplay from '../components/RankingDisplay';
import PasswordModal from '../components/PasswordModal';
import GameBar from '../components/GameBar';
import SettingsPanel from '../components/SettingsPanel'; // SettingsPanel 컴포넌트 임포트
import { TranslatedLanguages, TranslationKeys, Translations } from '../data/languages';

// GamePage에 필요한 window 속성들을 전역 Window 인터페이스에 선택적으로 추가
declare global {
  interface Window {
    roullete?: Roulette;
    options?: typeof options;
    dataLayer?: any[];
    translateElement?: (element: HTMLElement) => void;
  }
}

const GamePage: FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const inNamesRef = useRef<HTMLTextAreaElement>(null);
  const inWinningRankRef = useRef<HTMLInputElement>(null);
  const chkSkillRef = useRef<HTMLInputElement>(null);
  const sltMapRef = useRef<HTMLSelectElement>(null);
  const chkAutoRecordingRef = useRef<HTMLInputElement>(null);
  const rouletteCanvasContainerRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const btnShuffleRef = useRef<HTMLButtonElement>(null);
  const btnStartRef = useRef<HTMLButtonElement>(null);
  const btnLastWinnerRef = useRef<HTMLButtonElement>(null);
  const btnFirstWinnerRef = useRef<HTMLButtonElement>(null);

  const [winnerSelectionType, setWinnerSelectionType] = useState<'first' | 'last' | 'custom'>('first'); // Explicitly type state
  const [isManager, setIsManager] = useState(false);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [roomDetails, setRoomDetails] = useState<RoomInfo | null>(null);
  const [gameDetails, setGameDetails] = useState<GameInfo | null>(null);
  const gameDetailsRef = useRef(gameDetails);
  const [finalRanking, setFinalRanking] = useState<RankingEntry[] | null>(null);
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const [currentLocale, setCurrentLocale] = useState<TranslatedLanguages>('en');
  const { user } = useAuth();

  const fetchGameDetailsAndInitializeUI = useCallback(async (numericRoomId: number) => {
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
            console.error('GamePage: Failed to fetch game ranking:', rankingError);
          }
        } else if (
          fetchedGameDetails.status === GameStatus.WAITING ||
          fetchedGameDetails.status === GameStatus.IN_PROGRESS
        ) {
          if (inNamesRef.current && fetchedGameDetails.marbles && fetchedGameDetails.marbles.length > 0) {
            inNamesRef.current.value = fetchedGameDetails.marbles.join(',');
          }
          if (inWinningRankRef.current && fetchedGameDetails.winningRank !== null) {
            inWinningRankRef.current.value = fetchedGameDetails.winningRank.toString();
            setWinnerSelectionType(fetchedGameDetails.winningRank === 1 ? 'first' : 'custom');
          }
          if (sltMapRef.current && fetchedGameDetails.mapIndex !== null) {
            sltMapRef.current.value = fetchedGameDetails.mapIndex.toString();
          }
          if (window.options && fetchedGameDetails.speed !== null) {
            window.options.speed = fetchedGameDetails.speed;
          }
        }
      }
    } catch (apiError) {
      console.error('GamePage: Failed to fetch game details after joining:', apiError);
    }
  }, []);

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
        if (response.gameState && window.roullete) {
          window.roullete.updateStateFromServer(response.gameState);
        }
        fetchGameDetailsAndInitializeUI(numericRoomId);
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
  }, [roomId, passwordInput, navigate, fetchGameDetailsAndInitializeUI]);

  useEffect(() => {
    gameDetailsRef.current = gameDetails;
  }, [gameDetails]);

  useEffect(() => {
    setIsManager(!!(user && roomDetails && roomDetails.managerId === user.id));
  }, [user, roomDetails]);

  const getNames = useCallback((): string[] => {
    if (!inNamesRef.current) return [];
    const value = inNamesRef.current.value.trim();
    return value
      .split(/[,\r\n]/g)
      .map((v) => v.trim())
      .filter((v) => !!v);
  }, []);

  const parseName = useCallback((nameStr: string) => {
    const weightRegex = /(\/\d+)/;
    const countRegex = /(\*\d+)/;
    const nameMatch = /^\s*([^\/*]+)?/.exec(nameStr);
    const name = nameMatch ? nameMatch[1] : '';
    const weight = weightRegex.test(nameStr) ? parseInt(weightRegex.exec(nameStr)![1].replace('/', '')) : 1;
    const count = countRegex.test(nameStr) ? parseInt(countRegex.exec(nameStr)![1].replace('*', '')) : 1;
    return { name, weight, count };
  }, []);

  const setWinnerRank = useCallback((rank: number, type: 'first' | 'last' | 'custom') => {
    if (inWinningRankRef.current) inWinningRankRef.current.value = rank.toString();
    if (window.options) window.options.winningRank = rank;
    socketService.setWinningRank(rank - 1);
    setWinnerSelectionType(type);
  }, []);

  const submitParticipantNamesToBackend = useCallback(() => {
    if (gameDetails?.status === GameStatus.FINISHED) return;
    const names = getNames();
    console.log('names:', JSON.stringify(names));
    socketService.setMarbles(names);
    localStorage.setItem('mbr_names', names.join(','));
  }, [gameDetails?.status, getNames]);

  const handleInNamesInput = useCallback(() => {
    submitParticipantNamesToBackend();
  }, [submitParticipantNamesToBackend]);

  const handleInNamesBlur = useCallback(() => {
    if (!inNamesRef.current) return;
    const nameSource = getNames();
    const nameSet = new Set<string>();
    const nameCounts: { [key: string]: number } = {};
    nameSource.forEach((nameSrc) => {
      const item = parseName(nameSrc);
      const key = item.weight > 1 ? `${item.name}/${item.weight}` : item.name || '';
      if (!nameSet.has(key)) nameSet.add(key);
      nameCounts[key] = (nameCounts[key] || 0) + item.count;
    });
    const result = Object.keys(nameCounts).map((key) => (nameCounts[key] > 1 ? `${key}*${nameCounts[key]}` : key));
    const newValue = result.join(',');
    if (inNamesRef.current.value !== newValue) {
      inNamesRef.current.value = newValue;
      submitParticipantNamesToBackend();
    }
  }, [getNames, parseName, submitParticipantNamesToBackend]);

  const handleBtnShuffleClick = useCallback(() => {
    submitParticipantNamesToBackend();
  }, [submitParticipantNamesToBackend]);

  const handleBtnStartClick = useCallback(() => {
    if (gameDetails?.status === GameStatus.FINISHED) {
      alert('이미 종료된 게임입니다. 다시 시작할 수 없습니다.');
      return;
    }
    if ((window.roullete?.getCount() ?? 0) === 0) {
      alert('참여자가 없습니다. 참여자를 추가해주세요.');
      return;
    }
    socketService.startGame();
  }, [gameDetails?.status]);

  const handleChkSkillChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (window.options) window.options.useSkills = e.target.checked;
  }, []);

  const handleInWinningRankChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseInt(e.target.value, 10);
      setWinnerRank(isNaN(v) || v < 1 ? 1 : v, 'custom');
    },
    [setWinnerRank],
  );

  const handleBtnLastWinnerClick = useCallback(() => {
    const total = window.roullete?.getCount() ?? 1;
    setWinnerRank(total > 0 ? total : 1, 'last');
  }, [setWinnerRank]);

  const handleBtnFirstWinnerClick = useCallback(() => {
    setWinnerRank(1, 'first');
  }, [setWinnerRank]);

  const handleMapChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const index = parseInt(e.target.value, 10);
    if (!isNaN(index)) socketService.setMap(index);
  }, []);

  const handleAutoRecordingChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (window.roullete) window.roullete.setAutoRecording(e.target.checked);
  }, []);

  useEffect(() => {
    window.options = options;
    const originalDocumentLang = document.documentElement.lang;
    const defaultLoc: TranslatedLanguages = 'en';
    let pageLocale: TranslatedLanguages | undefined;

    const getBrowserLoc = () => navigator.language.split('-')[0] as TranslatedLanguages;
    const translateElForPage = (element: Element) => {
      if (!(element instanceof HTMLElement) || !pageLocale || !Translations[pageLocale]) return;
      const prop = element.getAttribute('data-trans');
      const targetKey = prop ? (element.getAttribute(prop) || '').trim() : element.innerText.trim();
      if (targetKey && Translations[pageLocale]?.[targetKey as TranslationKeys]) {
        const translation = Translations[pageLocale]![targetKey as TranslationKeys];
        if (prop) element.setAttribute(prop, translation);
        else element.innerText = translation;
      }
    };
    window.translateElement = translateElForPage;
    const translateP = () => document.querySelectorAll('[data-trans]').forEach(translateElForPage);
    const setPageLoc = (newLoc: string) => {
      const newLocTyped = newLoc as TranslatedLanguages;
      if (newLocTyped === pageLocale) return;
      document.documentElement.lang = newLocTyped;
      pageLocale = newLocTyped in Translations ? newLocTyped : defaultLoc;
      setCurrentLocale(pageLocale);
      translateP();
    };
    setPageLoc(getBrowserLoc());
    return () => {
      delete window.translateElement;
      document.documentElement.lang = originalDocumentLang;
    };
  }, []);

  useEffect(() => {
    let rouletteInstance: Roulette | null = null;
    let unsubscribeMaps: (() => void) | undefined;
    let unsubscribeGameState: (() => void) | undefined;

    const setupGame = async () => {
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

      try {
        const room = await getRoomDetails(numericRoomId);
        setRoomDetails(room);
        setRoomName(room.name);

        if (!socketService.isConnected() || socketService.getCurrentRoomId() !== roomId) {
          await socketService.connect(roomId);
        }

        if (room.isPasswordRequired && !socketService.getJoinedStatus(roomId)) {
          // Check if already joined
          setShowPasswordModal(true);
        } else if (!socketService.getJoinedStatus(roomId)) {
          // Not password protected and not joined
          const joinResponse = await socketService.joinRoom(roomId, undefined);
          if (joinResponse.success) {
            if (joinResponse.gameState && rouletteInstance) {
              rouletteInstance.updateStateFromServer(joinResponse.gameState);
            }
            fetchGameDetailsAndInitializeUI(numericRoomId);
          } else {
            alert(joinResponse.message || '방 입장에 실패했습니다. 이전 페이지로 돌아갑니다.');
            navigate(-1);
            return; // Stop further execution if join fails
          }
        } else {
          // Already joined (either no password, or password was handled)
          fetchGameDetailsAndInitializeUI(numericRoomId);
        }

        const savedNames = localStorage.getItem('mbr_names');
        if (savedNames && inNamesRef.current) inNamesRef.current.value = savedNames;

        if (sltMapRef.current) {
          sltMapRef.current.innerHTML = '<option value="">Loading maps...</option>';
          sltMapRef.current.disabled = true;
          unsubscribeMaps = socketService.onAvailableMapsUpdate((maps) => {
            if (!sltMapRef.current) return;
            sltMapRef.current.innerHTML = '';
            maps.forEach((map) => {
              const option = document.createElement('option');
              option.value = map.index.toString();
              option.innerHTML = map.title;
              sltMapRef.current!.append(option);
            });
            sltMapRef.current!.disabled = false;
            const currentMapIdx = gameDetailsRef.current?.mapIndex;
            if (currentMapIdx !== null && typeof currentMapIdx !== 'undefined') {
              sltMapRef.current.value = currentMapIdx.toString();
            }
          });
        }

        if (rouletteInstance) {
          unsubscribeGameState = socketService.onGameStateUpdate(async (gameState) => {
            console.log('gameState:', JSON.stringify(gameState, null, 2));
            if (!gameState || !rouletteInstance) return;
            rouletteInstance.updateStateFromServer(gameState);
            setGameDetails((prev) => {
              const newStatus =
                !gameState.isRunning && gameState.winner
                  ? GameStatus.FINISHED
                  : gameState.isRunning
                    ? GameStatus.IN_PROGRESS
                    : GameStatus.WAITING;
              const marbles = gameState.marbles ? gameState.marbles.map((m) => m.name) : prev?.marbles || [];
              return {
                id: prev?.id || 0,
                status: newStatus,
                mapIndex: prev?.mapIndex ?? null,
                marbles,
                winningRank: gameState.winnerRank ?? prev?.winningRank ?? null,
                speed: prev?.speed ?? null,
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
        }
        if (chkAutoRecordingRef.current && window.options && rouletteInstance) {
          chkAutoRecordingRef.current.checked = window.options.autoRecording;
          rouletteInstance.setAutoRecording(window.options.autoRecording);
        }
      } catch (error: any) {
        alert(error.message || '방 정보를 가져오거나 연결에 실패했습니다. 이전 페이지로 돌아갑니다.');
        navigate(-1);
      }
    };

    const initializeRoulette = async () => {
      if (rouletteCanvasContainerRef.current) {
        rouletteInstance = new Roulette();
        window.roullete = rouletteInstance;
        try {
          await rouletteInstance.initialize(rouletteCanvasContainerRef.current);
          setupGame(); // Call setupGame after roulette is initialized
        } catch (error) {
          console.error('[GamePage] 룰렛 초기화 실패:', error);
          alert('게임 엔진 초기화에 실패했습니다. 페이지를 새로고침 해주세요.');
        }
      } else {
        setTimeout(initializeRoulette, 100); // Retry if canvas not ready
      }
    };

    initializeRoulette();

    return () => {
      if (unsubscribeMaps) unsubscribeMaps();
      if (unsubscribeGameState) unsubscribeGameState();
      socketService.disconnect();
      delete window.roullete;
    };
  }, [roomId, navigate, fetchGameDetailsAndInitializeUI]);

  // const settingsDisabled =
  //   !isManager || gameDetails?.status === GameStatus.FINISHED || gameDetails?.status === GameStatus.IN_PROGRESS;
  // const gameFinishedOrInProgress =
  //   gameDetails?.status === GameStatus.FINISHED || gameDetails?.status === GameStatus.IN_PROGRESS;

  return (
    <>
      <GameBar roomName={roomName} isManager={isManager} />
      <SettingsPanel
        isManager={isManager}
        gameDetails={gameDetails}
        winnerSelectionType={winnerSelectionType}
        sltMapRef={sltMapRef}
        chkAutoRecordingRef={chkAutoRecordingRef}
        inWinningRankRef={inWinningRankRef}
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

export default GamePage;
