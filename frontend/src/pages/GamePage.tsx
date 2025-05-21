import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // useNavigate 추가
import '../styles.css'; // 전역 스타일 import
import { Roulette } from '../roulette';
import socketService from '../services/socketService'; // 경로 변경
import options from '../options'; // 실제 인스턴스 사용
import { getRoomDetails, getRoomGameDetails, getGameRanking } from '../services/api'; // getRoomGameDetails, getGameRanking 임포트 추가
import { useAuth } from '../contexts/AuthContext'; // useAuth 임포트 추가
import { GameStatus, RoomInfo, MarbleState, RankingEntry, GameInfo } from '../types/gameTypes'; // RankingEntry, GameInfo 임포트 추가
import RankingDisplay from '../components/RankingDisplay'; // RankingDisplay 컴포넌트 임포트
import { TranslatedLanguages, TranslationKeys, Translations } from '../data/languages'; // localization.ts에서 가져옴

// GamePage에 필요한 window 속성들을 전역 Window 인터페이스에 선택적으로 추가
declare global {
  interface Window {
    roullete?: Roulette;
    // window.socketService 는 더 이상 사용하지 않음
    options?: typeof options;
    // updateMapSelector 는 GamePage 내부에서 socketService.onAvailableMapsUpdate를 통해 처리
    dataLayer?: any[];
    translateElement?: (element: HTMLElement) => void;
      }
}

const GamePage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>(); // roomId 추출
  const navigate = useNavigate(); // useNavigate 훅 사용
  const inNamesRef = useRef<HTMLTextAreaElement>(null);
  const inWinningRankRef = useRef<HTMLInputElement>(null);
  const chkSkillRef = useRef<HTMLInputElement>(null);
  const sltMapRef = useRef<HTMLSelectElement>(null);
  const chkAutoRecordingRef = useRef<HTMLInputElement>(null);
  const rouletteCanvasContainerRef = useRef<HTMLDivElement>(null); // 캔버스 컨테이너 Ref 추가
  const passwordInputRef = useRef<HTMLInputElement>(null); // 비밀번호 입력 필드 Ref 추가

  const [winnerSelectionType, setWinnerSelectionType] = useState('first');
  const [isManager, setIsManager] = useState(false); // 매니저 상태 추가
  const [roomName, setRoomName] = useState<string | null>(null); // 방 이름 상태 추가
  const [roomDetails, setRoomDetails] = useState<RoomInfo | null>(null);
  const [gameDetails, setGameDetails] = useState<GameInfo | null>(null); // 게임 상세 정보 상태 추가
  const gameDetailsRef = useRef(gameDetails); // Ref to hold the latest gameDetails
  const [finalRanking, setFinalRanking] = useState<RankingEntry[] | null>(null); // 최종 랭킹 정보 상태 추가
  const [showRankingModal, setShowRankingModal] = useState(false); // 랭킹 모달 표시 상태
  const [showPasswordModal, setShowPasswordModal] = useState(false); // 비밀번호 입력 모달 표시 상태
  const [passwordInput, setPasswordInput] = useState(''); // 사용자가 입력한 비밀번호
  const [joinError, setJoinError] = useState<string | null>(null); // 방 참여 에러 메시지
  // const [needsPasswordCheck, setNeedsPasswordCheck] = useState(true); // 비밀번호 확인 필요 여부 - 이 상태는 로직 흐름상 불필요해 보임

  // For localization
  const [currentLocale, setCurrentLocale] = useState<TranslatedLanguages>('en');
  const { user } = useAuth(); // AuthContext에서 사용자 정보 가져오기

  // Helper function to fetch game details and initialize UI (moved inside GamePage component)
  const fetchGameDetailsAndInitializeUI = async (
    numericRoomId: number,
    btnStartEl: HTMLButtonElement | null,
    btnShuffleEl: HTMLButtonElement | null,
  ) => {
    try {
      const fetchedGameDetails = await getRoomGameDetails(numericRoomId);
      setGameDetails(fetchedGameDetails); // Update gameDetails state

      if (fetchedGameDetails) {
        if (fetchedGameDetails.status === GameStatus.FINISHED) {
          try {
            const rankingData = await getGameRanking(numericRoomId);
            setFinalRanking(rankingData.rankings);
            if (rankingData.rankings && rankingData.rankings.length > 0) setShowRankingModal(true);
          } catch (rankingError) {
            console.error('GamePage: Failed to fetch game ranking:', rankingError);
          }

          if (btnStartEl) {
            btnStartEl.disabled = true;
            btnStartEl.innerText = 'Game Finished';
          }
          if (btnShuffleEl) btnShuffleEl.disabled = true;
          if (inNamesRef.current) inNamesRef.current.disabled = true;
          if (inWinningRankRef.current) inWinningRankRef.current.disabled = true;
          if (sltMapRef.current) sltMapRef.current.disabled = true;
          if (chkSkillRef.current) chkSkillRef.current.disabled = true;
        } else if (
          fetchedGameDetails.status === GameStatus.WAITING ||
          fetchedGameDetails.status === GameStatus.IN_PROGRESS
        ) {
          if (inNamesRef.current && fetchedGameDetails.marbles && fetchedGameDetails.marbles.length > 0) {
            inNamesRef.current.value = fetchedGameDetails.marbles.join(',');
          }
          if (inWinningRankRef.current && fetchedGameDetails.winningRank !== null) {
            inWinningRankRef.current.value = fetchedGameDetails.winningRank.toString();
            if (fetchedGameDetails.winningRank === 1) {
              setWinnerSelectionType('first');
            } else {
              setWinnerSelectionType('custom');
            }
          }
          if (sltMapRef.current && fetchedGameDetails.mapIndex !== null) {
            sltMapRef.current.value = fetchedGameDetails.mapIndex.toString();
          }
          if (window.options && fetchedGameDetails.speed !== null) {
            window.options.speed = fetchedGameDetails.speed;
          }
          if (fetchedGameDetails.status === GameStatus.IN_PROGRESS && btnStartEl) {
            btnStartEl.disabled = true;
            btnStartEl.innerText = 'Game In Progress';
            if (btnShuffleEl) btnShuffleEl.disabled = true;
            if (inNamesRef.current) inNamesRef.current.disabled = true;
          }
        }
      }
    } catch (apiError) {
      console.error('GamePage: Failed to fetch game details after joining:', apiError);
    }
  };

  const handlePasswordJoin = async () => {
    if (!roomId) {
      setJoinError('Room ID is missing.');
      return;
    }
    if (!passwordInput) {
      setJoinError('Password is required.');
      return;
    }
    setJoinError(null); // Clear previous error

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
        console.log(`Successfully joined room ${roomId} with password.`);
        if (response.gameState && window.roullete) {
          window.roullete.updateStateFromServer(response.gameState);
        }
        const btnStartElement = document.querySelector<HTMLButtonElement>('#btnStart');
        const btnShuffleElement = document.querySelector<HTMLButtonElement>('#btnShuffle');
        fetchGameDetailsAndInitializeUI(numericRoomId, btnStartElement, btnShuffleElement);
      } else {
        console.error(`Failed to join room ${roomId} with password: ${response.message}`);
        setJoinError(response.message || 'Failed to join room. Incorrect password?');
        if (response.requiresPassword) {
          setShowPasswordModal(true);
        } else {
          alert(response.message || '방 입장에 실패했습니다. 이전 페이지로 돌아갑니다.');
          navigate(-1);
        }
      }
    } catch (error) {
      console.error('Error joining room with password:', error);
      setJoinError('방 참여 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    gameDetailsRef.current = gameDetails;
  }, [gameDetails]);

  useEffect(() => {
    if (showPasswordModal && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [showPasswordModal]);

  useEffect(() => {
    let rouletteInstance: Roulette | null = null;
    let originalDocumentLang = document.documentElement.lang;
    let unsubscribeMaps: (() => void) | undefined;
    let unsubscribeGameState: (() => void) | undefined;

    let inNamesEl: HTMLTextAreaElement | null = null;
    let btnShuffleEl: HTMLButtonElement | null = null;
    let btnStartEl: HTMLButtonElement | null = null;
    let chkSkillElFromQuery: HTMLInputElement | null = null;
    let inWinningRankElFromQuery: HTMLInputElement | null = null;
    let btnLastWinnerEl: HTMLButtonElement | null = null;
    let btnFirstWinnerEl: HTMLButtonElement | null = null;
    let sltMapEl: HTMLSelectElement | null = null;
    let chkAutoRecordingElFromRef: HTMLInputElement | null = null;

    const getNames = (): string[] => {
      if (!inNamesEl) return [];
      const value = inNamesEl.value.trim();
      return value
        .split(/[,\r\n]/g)
        .map((v) => v.trim())
        .filter((v) => !!v);
    };

    const parseName = (nameStr: string) => {
      const weightRegex = /(\/\d+)/;
      const countRegex = /(\*\d+)/;
      const hasWeight = weightRegex.test(nameStr);
      const hasCount = countRegex.test(nameStr);
      const nameMatch = /^\s*([^\/*]+)?/.exec(nameStr);
      const name = nameMatch ? nameMatch[1] : '';
      const weight = hasWeight ? parseInt(weightRegex.exec(nameStr)![1].replace('/', '')) : 1;
      const count = hasCount ? parseInt(countRegex.exec(nameStr)![1].replace('*', '')) : 1;
      return { name, weight, count };
    };

    let localWinnerType = 'first';

    const setWinnerRank = (rank: number) => {
      if (inWinningRankRef.current) inWinningRankRef.current.value = rank.toString();
      if (window.options) window.options.winningRank = rank;
      socketService.setWinningRank(rank - 1);

      const btnFirstWinner = document.querySelector('.btn-first-winner');
      const btnLastWinner = document.querySelector('.btn-last-winner');
      const inWinningRankInput = document.querySelector('#in_winningRank');
      if (btnFirstWinner && btnLastWinner && inWinningRankInput) {
        btnFirstWinner.classList.toggle('active', localWinnerType === 'first');
        btnLastWinner.classList.toggle('active', localWinnerType === 'last');
        inWinningRankInput.classList.toggle('active', localWinnerType === 'custom');
      }
    };

    const submitParticipantNamesToBackend = () => {
      if (gameDetails?.status === GameStatus.FINISHED) {
        console.log('Game is finished. Cannot set marbles.');
        return;
      }
      const names = getNames();
      socketService.setMarbles(names);
      localStorage.setItem('mbr_names', names.join(','));
      switch (localWinnerType) {
        case 'first':
          setWinnerRank(1);
          break;
        case 'last':
          const total = window.roullete?.getCount() ?? 0;
          setWinnerRank(total > 0 ? total : 1);
          break;
      }
    };

    const handleInNamesInput = submitParticipantNamesToBackend;
    const handleInNamesBlur = () => {
      if (!inNamesEl) return;
      const nameSource = getNames();
      const nameSet = new Set<string>();
      const nameCounts: { [key: string]: number } = {};
      nameSource.forEach((nameSrc) => {
        const item = parseName(nameSrc);
        const key = item.weight > 1 ? `${item.name}/${item.weight}` : item.name || '';
        if (!nameSet.has(key)) {
          nameSet.add(key);
          nameCounts[key] = 0;
        }
        nameCounts[key] += item.count;
      });
      const result: string[] = [];
      Object.keys(nameCounts).forEach((key) => {
        result.push(nameCounts[key] > 1 ? `${key}*${nameCounts[key]}` : key);
      });
      const oldValue = inNamesEl.value;
      const newValue = result.join(',');
      if (oldValue !== newValue) {
        inNamesEl.value = newValue;
        submitParticipantNamesToBackend();
      }
    };
    const handleBtnShuffleClick = submitParticipantNamesToBackend;
    const handleBtnStartClick = () => {
      if (gameDetails?.status === GameStatus.FINISHED) {
        alert('이미 종료된 게임입니다. 다시 시작할 수 없습니다.');
        return;
      }
      const currentParticipantCount = window.roullete?.getCount() ?? 0;
      const canStartGame = currentParticipantCount > 0;
      if (!canStartGame) {
        alert('참여자가 없습니다. 참여자를 추가해주세요.');
        return;
      }
      socketService.startGame();
      document.querySelector('#settings')?.classList.add('hide');
    };
    const handleChkSkillChange = (e: Event) => {
      if (window.options) window.options.useSkills = (e.target as HTMLInputElement).checked;
    };
    const handleInWinningRankChange = (e: Event) => {
      const v = parseInt((e.target as HTMLInputElement).value, 10);
      const newRank = isNaN(v) || v < 1 ? 1 : v;
      localWinnerType = 'custom';
      setWinnerSelectionType('custom');
      setWinnerRank(newRank);
    };
    const handleBtnLastWinnerClick = () => {
      const currentTotal = window.roullete?.getCount() ?? 1;
      localWinnerType = 'last';
      setWinnerSelectionType('last');
      setWinnerRank(currentTotal > 0 ? currentTotal : 1);
    };
    const handleBtnFirstWinnerClick = () => {
      localWinnerType = 'first';
      setWinnerSelectionType('first');
      setWinnerRank(1);
    };

    const handleMapChange = (e: Event) => {
      const index = parseInt((e.target as HTMLSelectElement).value, 10);
      if (!isNaN(index)) socketService.setMap(index);
    };
    const handleAutoRecordingChange = (e: Event) => {
      if (window.roullete) window.roullete.setAutoRecording((e.target as HTMLInputElement).checked);
    };

    window.options = options;

    const defaultLoc: TranslatedLanguages = 'en';
    let pageLocale: TranslatedLanguages | undefined;
    originalDocumentLang = document.documentElement.lang;
    const getBrowserLoc = () => navigator.language.split('-')[0] as TranslatedLanguages;
    const translateElForPage = (element: Element) => {
      if (!(element instanceof HTMLElement) || !pageLocale || !Translations[pageLocale]) return;
      const prop = element.getAttribute('data-trans');
      const targetKey = prop ? (element.getAttribute(prop) || '').trim() : element.innerText.trim();
      if (targetKey && Translations[pageLocale] && targetKey in Translations[pageLocale]) {
        const translation = Translations[pageLocale][targetKey as TranslationKeys];
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
      translateP();
    };
    setPageLoc(getBrowserLoc());

    const setupGameInteractions = async () => {
      inNamesEl = inNamesRef.current;
      sltMapEl = sltMapRef.current;
      chkAutoRecordingElFromRef = chkAutoRecordingRef.current;
      btnShuffleEl = document.querySelector<HTMLButtonElement>('#btnShuffle');
      btnStartEl = document.querySelector<HTMLButtonElement>('#btnStart');
      chkSkillElFromQuery = document.querySelector<HTMLInputElement>('#chkSkill');
      inWinningRankElFromQuery = document.querySelector<HTMLInputElement>('#in_winningRank');
      btnLastWinnerEl = document.querySelector<HTMLButtonElement>('.btn-last-winner');
      btnFirstWinnerEl = document.querySelector<HTMLButtonElement>('.btn-first-winner');

      if (roomId) {
        const numericRoomId = parseInt(roomId, 10);
        if (isNaN(numericRoomId)) {
          alert('잘못된 방 ID입니다.');
          navigate('/');
          return;
        }

        try {
          const fetchedRoomBasicDetails = await getRoomDetails(numericRoomId);
          setRoomDetails(fetchedRoomBasicDetails);
          setRoomName(fetchedRoomBasicDetails.name);
          const currentUser = user;
          setIsManager(!!(currentUser && fetchedRoomBasicDetails.managerId === currentUser.id));
          await socketService.connect(roomId);
          console.log(`GamePage: Successfully connected to socket for room ${roomId}`);

          if (fetchedRoomBasicDetails.isPasswordRequired) {
            setShowPasswordModal(true);
          } else {
            const joinResponse = await socketService.joinRoom(roomId, undefined);
            if (joinResponse.success) {
              if (joinResponse.gameState && rouletteInstance) {
                rouletteInstance.updateStateFromServer(joinResponse.gameState);
              }
              fetchGameDetailsAndInitializeUI(numericRoomId, btnStartEl, btnShuffleEl);
            } else {
              alert(joinResponse.message || '방 입장에 실패했습니다. 이전 페이지로 돌아갑니다.');
              navigate(-1);
            }
          }
        } catch (error: any) {
          alert(error.message || '방 정보를 가져오거나 연결에 실패했습니다. 이전 페이지로 돌아갑니다.');
          navigate(-1);
        }
      } else {
        alert('잘못된 접근입니다. 방 ID가 없습니다.');
        navigate('/');
      }

      const savedNames = localStorage.getItem('mbr_names');
      if (savedNames && inNamesEl) inNamesEl.value = savedNames;

      if (inNamesEl) {
        inNamesEl.addEventListener('input', handleInNamesInput);
        inNamesEl.addEventListener('blur', handleInNamesBlur);
      }
      btnShuffleEl?.addEventListener('click', handleBtnShuffleClick);
      btnStartEl?.addEventListener('click', handleBtnStartClick);
      chkSkillElFromQuery?.addEventListener('change', handleChkSkillChange);
      inWinningRankElFromQuery?.addEventListener('change', handleInWinningRankChange);
      btnLastWinnerEl?.addEventListener('click', handleBtnLastWinnerClick);
      btnFirstWinnerEl?.addEventListener('click', handleBtnFirstWinnerClick);

      if (sltMapEl) {
        sltMapEl.innerHTML = '<option value="">Loading maps...</option>';
        sltMapEl.disabled = true;
        unsubscribeMaps = socketService.onAvailableMapsUpdate((maps) => {
          if (!sltMapRef.current) return;
          sltMapRef.current.innerHTML = '';
          maps.forEach((map) => {
            const option = document.createElement('option');
            option.value = map.index.toString();
            option.innerHTML = map.title;
            option.setAttribute('data-trans', '');
            if (window.translateElement) window.translateElement(option);
            sltMapRef.current!.append(option);
          });
          sltMapRef.current!.disabled = false;
        });
        sltMapRef.current!.addEventListener('change', handleMapChange);
      }

      if (rouletteInstance) {
        unsubscribeGameState = socketService.onGameStateUpdate(async (gameState) => {
          if (!gameState) {
            console.warn('GamePage: Received null or undefined gameState from socketService.onGameStateUpdate');
            return;
          }
          if (rouletteInstance) {
            rouletteInstance.updateStateFromServer(gameState);
            setGameDetails((prevDetails) => {
              let newStatus: GameStatus;
              if (!gameState.isRunning && gameState.winner) {
                newStatus = GameStatus.FINISHED;
              } else if (gameState.isRunning) {
                newStatus = GameStatus.IN_PROGRESS;
              } else {
                newStatus = GameStatus.WAITING;
              }
              const marbleNames = gameState.marbles ? gameState.marbles.map((m) => m.name) : prevDetails?.marbles || [];
              return {
                id: prevDetails?.id || 0,
                status: newStatus,
                mapIndex: prevDetails?.mapIndex ?? null,
                marbles: marbleNames,
                winningRank: gameState.winnerRank ?? prevDetails?.winningRank ?? null,
                speed: prevDetails?.speed ?? null,
                createdAt: prevDetails?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            });

            const gamePotentiallyOverBySocket =
              !gameState.isRunning && gameState.winners && gameState.winners.length >= gameState.winnerRank;
            if (
              gamePotentiallyOverBySocket &&
              gameDetailsRef.current &&
              gameDetailsRef.current.status !== GameStatus.FINISHED
            ) {
              if (roomId) {
                const numericRoomId = parseInt(roomId, 10);
                if (!isNaN(numericRoomId)) {
                  try {
                    const authoritativeGameDetails = await getRoomGameDetails(numericRoomId);
                    setGameDetails(authoritativeGameDetails);
                    if (authoritativeGameDetails.status === GameStatus.FINISHED) {
                      const rankingData = await getGameRanking(numericRoomId);
                      setFinalRanking(rankingData.rankings);
                      if (rankingData.rankings && rankingData.rankings.length > 0) {
                        setShowRankingModal(true);
                      }
                    }
                  } catch (error) {
                    console.error(
                      'GamePage: Error fetching authoritative game details or ranking on game end (socket event):',
                      error,
                    );
                  }
                }
              }
            }
          }
        });
      }

      if (chkAutoRecordingElFromRef) {
        chkAutoRecordingElFromRef.addEventListener('change', handleAutoRecordingChange);
        if (window.options && rouletteInstance) {
          chkAutoRecordingElFromRef.checked = window.options.autoRecording;
          rouletteInstance.setAutoRecording(window.options.autoRecording);
        }
      }
    };

    const initializeRouletteAndGame = async () => {
      if (rouletteCanvasContainerRef.current) {
        rouletteInstance = new Roulette();
        window.roullete = rouletteInstance;

        try {
          await rouletteInstance.initialize(rouletteCanvasContainerRef.current);
          if (roomId) { // user 객체 유무와 관계없이 roomId만 있으면 상호작용 설정
            setupGameInteractions();
          } else {
            console.log('GamePage: 방 ID를 기다리는 중입니다.'); // 로그 메시지 변경
          }
        } catch (error) {
          console.error('[GamePage] 룰렛 초기화 실패:', error);
          alert('게임 엔진 초기화에 실패했습니다. 페이지를 새로고침 해주세요.');
        }
      } else {
        setTimeout(initializeRouletteAndGame, 100);
      }
    };

    initializeRouletteAndGame();

    return () => {
      if (unsubscribeMaps) unsubscribeMaps();
      if (unsubscribeGameState) unsubscribeGameState();
      if (inNamesEl) {
        inNamesEl.removeEventListener('input', handleInNamesInput);
        inNamesEl.removeEventListener('blur', handleInNamesBlur);
      }
      btnShuffleEl?.removeEventListener('click', handleBtnShuffleClick);
      btnStartEl?.removeEventListener('click', handleBtnStartClick);
      chkSkillElFromQuery?.removeEventListener('change', handleChkSkillChange);
      inWinningRankElFromQuery?.removeEventListener('change', handleInWinningRankChange);
      btnLastWinnerEl?.removeEventListener('click', handleBtnLastWinnerClick);
      btnFirstWinnerEl?.removeEventListener('click', handleBtnFirstWinnerClick);
      sltMapEl?.removeEventListener('change', handleMapChange);
      chkAutoRecordingElFromRef?.removeEventListener('change', handleAutoRecordingChange);
      socketService.disconnect();
      delete window.roullete;
      delete window.options;
      delete window.translateElement;
      document.documentElement.lang = originalDocumentLang;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user]);

  return (
    <>
      <div className="game-top-bar">
        <span className="room-name">{roomName || 'Loading room...'}</span>
        {isManager && (
          <span className="manager-icon" title="Manager">
            👑
          </span>
        )}
        <span className="user-nickname">{user?.nickname || '익명 유저'}</span>
      </div>
      <div
        id="settings"
        className="settings"
        style={!isManager || gameDetails?.status === GameStatus.FINISHED ? { display: 'none' } : {}}
      >
        <div className="right">
          <div className="row">
            <label>
              <i className="icon map"></i>
              <span data-trans>Map</span>
            </label>
            <select id="sltMap" ref={sltMapRef}></select>
          </div>
          <div className="row">
            <label>
              <i className="icon record"></i>
              <span data-trans>Recording</span>
            </label>
            <input type="checkbox" id="chkAutoRecording" ref={chkAutoRecordingRef} />
          </div>
          <div className="row">
            <label>
              <i className="icon trophy"></i>
              <span data-trans>The winner is</span>
            </label>
            <div className="btn-group">
              <button
                className={`btn-winner btn-first-winner ${winnerSelectionType === 'first' ? 'active' : ''}`}
                data-trans
              >
                First
              </button>
              <button
                className={`btn-winner btn-last-winner ${winnerSelectionType === 'last' ? 'active' : ''}`}
                data-trans
              >
                Last
              </button>
              <input
                type="number"
                id="in_winningRank"
                defaultValue="1"
                min="1"
                ref={inWinningRankRef}
                className={winnerSelectionType === 'custom' ? 'active' : ''}
              />
            </div>
          </div>
          <div className="row">
            <label>
              <i className="icon bomb"></i>
              <span data-trans>Using skills</span>
            </label>
            <input type="checkbox" id="chkSkill" defaultChecked ref={chkSkillRef} />
          </div>
        </div>
        <div className="left">
          <h3 data-trans>Enter names below</h3>
          <textarea
            id="in_names"
            placeholder="Input names separated by commas or line feed here"
            data-trans="placeholder"
            defaultValue="짱구*5, 짱아*10, 봉미선*3"
            ref={inNamesRef}
          ></textarea>
          <div className="actions">
            <button id="btnShuffle">
              <i className="icon shuffle"></i>
              <span data-trans>Shuffle</span>
            </button>
            <button id="btnStart">
              <i className="icon play"></i>
              <span data-trans>Start</span>
            </button>
          </div>
        </div>
      </div>

      <div className="copyright">
        &copy; 2025.
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
      {showPasswordModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3>Enter Room Password</h3>
            <input
              ref={passwordInputRef} // Ref 할당
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handlePasswordJoin();
              }}
              style={{ marginRight: '10px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <button
              onClick={handlePasswordJoin}
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: '#007bff',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              Join
            </button>
            {joinError && <p style={{ color: 'red', marginTop: '10px' }}>{joinError}</p>}
          </div>
        </div>
      )}
    </>
  );
};

export default GamePage;
