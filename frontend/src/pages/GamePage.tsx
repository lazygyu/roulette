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
    gtag?: (...args: any[]) => void;
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

  // 'ready'와 'winnerType'은 상태로 관리하는 것이 더 React 방식에 맞지만,
  // 기존 코드의 직접적인 포팅을 위해 일단 변수로 유지하고, 필요시 상태로 전환할 수 있습니다.
  // let ready = false; // 이 값은 getReady 함수 내부에서 설정되고 사용됩니다.
  // let winnerType = 'first'; // 이 값은 setWinnerRank 및 버튼 클릭 핸들러에서 사용됩니다.
  // React에서는 이런 변수들을 useState로 관리하는 것이 일반적입니다.
  // 예를 들어:
  const [winnerSelectionType, setWinnerSelectionType] = useState('first');
  const [isManager, setIsManager] = useState(false); // 매니저 상태 추가
  const [roomName, setRoomName] = useState<string | null>(null); // 방 이름 상태 추가
  // roomDetails는 이제 게임 상세 정보를 포함하지 않을 수 있음
  const [roomDetails, setRoomDetails] = useState<RoomInfo | null>(null);
  const [gameDetails, setGameDetails] = useState<GameInfo | null>(null); // 게임 상세 정보 상태 추가
  const gameDetailsRef = useRef(gameDetails); // Ref to hold the latest gameDetails
  const [finalRanking, setFinalRanking] = useState<RankingEntry[] | null>(null); // 최종 랭킹 정보 상태 추가
  const [showRankingModal, setShowRankingModal] = useState(false); // 랭킹 모달 표시 상태

  // 비밀번호 모달 관련 상태
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);


  // For localization
  const [currentLocale, setCurrentLocale] = useState<TranslatedLanguages>('en');
  const { user } = useAuth(); // AuthContext에서 사용자 정보 가져오기

  useEffect(() => {
    gameDetailsRef.current = gameDetails;
  }, [gameDetails]);

  useEffect(() => {
    let rouletteInstance: Roulette | null = null; // Roulette 인스턴스를 저장할 변수
    let originalDocumentLang = document.documentElement.lang;
    let donateButtonCheckTimeoutId: NodeJS.Timeout | undefined;
    // let readyCheckTimeoutId: NodeJS.Timeout | undefined; // polling 방식 제거

    // 구독 해제 함수들을 저장할 변수들
    let unsubscribeMaps: (() => void) | undefined;
    let unsubscribeGameState: (() => void) | undefined;

    // DOM Elements (queried within initializeGamePage, references stored here for cleanup)
    // These will be assigned when setupGameInteractions is called.
    let inNamesEl: HTMLTextAreaElement | null = null;
    let btnShuffleEl: HTMLButtonElement | null = null;
    let btnStartEl: HTMLButtonElement | null = null;
    let chkSkillElFromQuery: HTMLInputElement | null = null;
    let inWinningRankElFromQuery: HTMLInputElement | null = null;
    let btnLastWinnerEl: HTMLButtonElement | null = null;
    let btnFirstWinnerEl: HTMLButtonElement | null = null;
    let btnShakeEl: HTMLButtonElement | null = null;
    let sltMapEl: HTMLSelectElement | null = null;
    let chkAutoRecordingElFromRef: HTMLInputElement | null = null; // from ref
    let closeNoticeButtonEl: HTMLButtonElement | null = null;
    let openNoticeButtonEl: HTMLButtonElement | null = null;
    let noticeElFromQuery: HTMLElement | null = null;

    // Event Handlers
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

    let localWinnerType = 'first'; // Keep this to mirror original logic closely

    const setWinnerRank = (rank: number) => {
      if (inWinningRankRef.current) inWinningRankRef.current.value = rank.toString();
      if (window.options) window.options.winningRank = rank;
      // window.socketService 대신 직접 socketService 사용
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
      // 추가: 게임이 종료된 상태면 아무 작업도 하지 않음
      if (gameDetails?.status === GameStatus.FINISHED) {
        console.log('Game is finished. Cannot set marbles.');
        return;
      }

      const names = getNames();
      // window.socketService 대신 직접 socketService 사용
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
      // roomDetails.game 대신 gameDetails 사용
      if (gameDetails?.status === GameStatus.FINISHED) {
        alert('이미 종료된 게임입니다. 다시 시작할 수 없습니다.');
        return;
      }

      const currentParticipantCount = window.roullete?.getCount() ?? 0;
      const canStartGame = currentParticipantCount > 0;

      if (!canStartGame) {
        console.log('Cannot start game: No participants found in roulette instance.');
        alert('참여자가 없습니다. 참여자를 추가해주세요.');
        return;
      }

      window.gtag?.('event', 'start', { event_category: 'roulette', event_label: 'start', value: 1 });
      // window.socketService 대신 직접 socketService 사용
      socketService.startGame();
      document.querySelector('#settings')?.classList.add('hide');
      document.querySelector('#donate')?.classList.add('hide');
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
    const handleBtnShakeClick = () => {
      window.roullete?.shake();
      window.gtag?.('event', 'shake', { event_category: 'roulette', event_label: 'shake', value: 1 });
    };
    const handleMapChange = (e: Event) => {
      const index = parseInt((e.target as HTMLSelectElement).value, 10);
      if (!isNaN(index)) socketService.setMap(index);
      else console.error('invalid map index for setMap');
    };
    const handleAutoRecordingChange = (e: Event) => {
      if (window.roullete) window.roullete.setAutoRecording((e.target as HTMLInputElement).checked);
    };
    const handleCloseNotice = () => {
      if (noticeElFromQuery) noticeElFromQuery.style.display = 'none';
      localStorage.setItem('lastViewedNotification', '1'); // Assuming currentNotice is 1
    };
    const handleOpenNotice = () => {
      if (noticeElFromQuery) noticeElFromQuery.style.display = 'flex';
    };

    // --- Initialization Function (now split into parts) ---

    // Part 1: One-time setup of window objects and non-DOM related initializations
    // rouletteInstance = new Roulette(); // 인스턴스 생성은 아래 initializeRouletteAndGame 내에서 수행
    // window.roullete = rouletteInstance; // window.roullete 할당도 initializeRouletteAndGame 내에서 수행
    // window.socketService = socketService; // 더 이상 전역에 할당하지 않음
    window.options = options; // options는 유지

    window.dataLayer = window.dataLayer || [];
    function gtagForPage(...args: any[]) {
      window.dataLayer!.push(args);
    } // Renamed to avoid conflict if gtag is already on window
    window.gtag = gtagForPage;
    gtagForPage('js', new Date());
    gtagForPage('config', 'G-5899C1DJM0');

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

    // Part 2: Function to set up DOM interactions and listeners (called after roulette is ready)
    const setupGameInteractions = () => {
      console.log('Roulette is ready, proceeding with GamePage DOM & event setup.');
      // Assign elements from refs and querySelector
      inNamesEl = inNamesRef.current;
      sltMapEl = sltMapRef.current;
      chkAutoRecordingElFromRef = chkAutoRecordingRef.current;
      btnShuffleEl = document.querySelector<HTMLButtonElement>('#btnShuffle');
      btnStartEl = document.querySelector<HTMLButtonElement>('#btnStart');
      chkSkillElFromQuery = document.querySelector<HTMLInputElement>('#chkSkill');
      inWinningRankElFromQuery = document.querySelector<HTMLInputElement>('#in_winningRank');
      btnLastWinnerEl = document.querySelector<HTMLButtonElement>('.btn-last-winner');
      btnFirstWinnerEl = document.querySelector<HTMLButtonElement>('.btn-first-winner');
      btnShakeEl = document.querySelector<HTMLButtonElement>('#btnShake');
      closeNoticeButtonEl = document.querySelector<HTMLButtonElement>('#closeNotice');
      openNoticeButtonEl = document.querySelector<HTMLButtonElement>('#btnNotice');
      noticeElFromQuery = document.querySelector<HTMLElement>('#notice');

      const attemptJoinRoom = (currentRoomId: string, roomPassword?: string) => {
        socketService.connect(currentRoomId)
          .then(() => {
            console.log(`GamePage: Successfully connected to socket for room ${currentRoomId}`);
            socketService.joinRoom(currentRoomId, roomPassword, (response) => {
              if (response.success) {
                setShowPasswordModal(false);
                setPasswordError(null);
                // 방 정보 및 게임 상세 정보 가져오기 (joinRoom 성공 후)
                const numericRoomId = parseInt(currentRoomId, 10);
                getRoomGameDetails(numericRoomId)
                  .then(setGameDetails)
                  .catch(err => console.error("Failed to get game details after join", err));

                // 게임 상태에 따른 UI 초기화 등은 여기서 또는 gameStateUpdate 리스너에서 처리
              } else {
                console.error(`GamePage: Failed to join room ${currentRoomId}: ${response.message}`);
                if (response.message?.includes('비밀번호')) {
                  setPasswordError(response.message);
                  setShowPasswordModal(true); // 비밀번호 오류 시 다시 모달 표시
                } else {
                  alert(response.message || '방 입장에 실패했습니다.');
                  navigate(-1);
                }
              }
            });
          })
          .catch((error: any) => {
            console.error(`GamePage: Failed to connect to socket for room ${currentRoomId}`, error);
            alert(error.message || '소켓 연결에 실패했습니다. 이전 페이지로 돌아갑니다.');
            navigate(-1);
          });
      };


      if (roomId) {
        const numericRoomId = parseInt(roomId, 10);
        if (!isNaN(numericRoomId)) {
          getRoomDetails(numericRoomId)
            .then((fetchedRoomBasicDetails) => {
              setRoomDetails(fetchedRoomBasicDetails);
              setRoomName(fetchedRoomBasicDetails.name);
              const currentUser = user;
              if (currentUser && fetchedRoomBasicDetails.managerId === currentUser.id) {
                setIsManager(true);
              } else {
                setIsManager(false);
              }

              // fetchedRoomBasicDetails.password (실제 비밀번호 해시 또는 값) 유무로 판단
              if (fetchedRoomBasicDetails.password) { 
                setShowPasswordModal(true);
              } else {
                attemptJoinRoom(roomId);
              }
              // 게임 상세 정보는 joinRoom 성공 후 또는 gameStateUpdate 에서 가져오도록 변경
            })
            .catch((apiError) => {
              console.error('GamePage: Failed to fetch room details:', apiError);
              alert('방 정보를 가져오는데 실패했습니다.');
              navigate(-1);
            });
        } else {
          console.error('GamePage: Invalid Room ID format:', roomId);
          setRoomName('Invalid Room ID');
          setIsManager(false);
          alert('잘못된 방 ID입니다.');
          navigate('/');
        }
      } else {
        console.error('GamePage: Room ID is missing.');
        alert('잘못된 접근입니다. 방 ID가 없습니다.');
        navigate('/');
      }


      const savedNames = localStorage.getItem('mbr_names');
      if (savedNames && inNamesEl) inNamesEl.value = savedNames;

      // Add Event Listeners
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
      btnShakeEl?.addEventListener('click', handleBtnShakeClick);

      // window.updateMapSelector 대신 socketService.onAvailableMapsUpdate 사용
      // let unsubscribeMaps: (() => void) | undefined; // useEffect 스코프로 이동
      if (sltMapEl) {
        sltMapEl.innerHTML = '<option value="">Loading maps...</option>';
        sltMapEl.disabled = true;
        unsubscribeMaps = socketService.onAvailableMapsUpdate((maps) => {
          if (!sltMapRef.current) return; // Ref의 current를 직접 확인
          sltMapRef.current.innerHTML = '';
          maps.forEach((map) => {
            const option = document.createElement('option');
            option.value = map.index.toString();
            option.innerHTML = map.title;
            option.setAttribute('data-trans', '');
            if (window.translateElement) window.translateElement(option);
            sltMapRef.current!.append(option); // Non-null assertion
          });
          sltMapRef.current!.disabled = false; // Non-null assertion
        });
        sltMapRef.current!.addEventListener('change', handleMapChange); // Non-null assertion
      }

      // GameState 업데이트 처리
      // let unsubscribeGameState: (() => void) | undefined; // useEffect 스코프로 이동
      if (rouletteInstance) {
        // window.roullete 대신 rouletteInstance 사용
        unsubscribeGameState = socketService.onGameStateUpdate((gameState) => {
          // gameState가 null일 수 있는 경우를 대비 (이론적으로는 서버에서 항상 유효한 객체를 보내야 함)
          if (!gameState) {
            console.warn('GamePage: Received null or undefined gameState from socketService.onGameStateUpdate');
            return;
          }

          if (rouletteInstance) {
            // window.roullete 대신 rouletteInstance 사용
            console.log('GamePage: Updating roulette instance with gameState from onGameStateUpdate:', gameState);
            rouletteInstance.updateStateFromServer(gameState);

            // GamePage의 gameDetails 상태도 업데이트 (중요: UI 반응성을 위해)
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
                mapIndex: prevDetails?.mapIndex ?? null, // gameState에 mapIndex가 없으므로 prevDetails 우선
                marbles: marbleNames,
                winningRank: gameState.winnerRank ?? prevDetails?.winningRank ?? null,
                speed: prevDetails?.speed ?? null, // gameState에 speed가 없으므로 prevDetails 우선
                createdAt: prevDetails?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            });

            const inGameDiv = document.querySelector('#inGame');
            if (inGameDiv) {
              inGameDiv.classList.toggle('hide', !gameState.shakeAvailable);
            }

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
                  console.log(
                    'Game potentially finished (socket event). Fetching authoritative game details and ranking...',
                  );
                  getRoomGameDetails(numericRoomId)
                    .then((authoritativeGameDetails) => {
                      setGameDetails(authoritativeGameDetails);
                      if (authoritativeGameDetails.status === GameStatus.FINISHED) {
                        console.log('Authoritative game status is FINISHED. Fetching ranking.');
                        return getGameRanking(numericRoomId);
                      }
                      console.log('Authoritative game status is NOT FINISHED, or ranking not needed yet.');
                      return null;
                    })
                    .then((rankingData) => {
                      if (rankingData) {
                        setFinalRanking(rankingData.rankings);
                        if (rankingData.rankings && rankingData.rankings.length > 0) {
                          setShowRankingModal(true);
                          console.log('Ranking modal should be shown.');
                        } else {
                          console.log('Ranking data received, but no rankings to display or modal not shown.');
                        }
                      }
                    })
                    .catch((error) => {
                      console.error(
                        'GamePage: Error fetching authoritative game details or ranking on game end (socket event):',
                        error,
                      );
                    });
                }
              }
            }
          }
        });
      }

      if (chkAutoRecordingElFromRef) {
        // chkAutoRecordingElFromRef null 체크
        chkAutoRecordingElFromRef.addEventListener('change', handleAutoRecordingChange);
        if (window.options && rouletteInstance) {
          // window.roullete 대신 rouletteInstance 사용
          chkAutoRecordingElFromRef.checked = window.options.autoRecording;
          rouletteInstance.setAutoRecording(window.options.autoRecording); // window.roullete 대신 rouletteInstance 사용
        }
      }

      const checkDonateButtonLoaded = () => {
        const btn = document.querySelector('span.bmc-btn-text');
        if (!btn) {
          donateButtonCheckTimeoutId = setTimeout(checkDonateButtonLoaded, 100);
        } else {
          btn.setAttribute('data-trans', '');
          if (window.translateElement) window.translateElement(btn as HTMLElement);
        }
      };
      donateButtonCheckTimeoutId = setTimeout(checkDonateButtonLoaded, 100);

      const currentNotice = 1; // Assuming this is constant
      const noticeKey = 'lastViewedNotification';
      const checkNotice = () => {
        const lastViewed = localStorage.getItem(noticeKey);
        if (lastViewed === null || Number(lastViewed) < currentNotice) {
          handleOpenNotice(); // Use the hoisted handler
        }
      };
      closeNoticeButtonEl?.addEventListener('click', handleCloseNotice);
      openNoticeButtonEl?.addEventListener('click', handleOpenNotice);
      checkNotice();

      // btnShuffleEl?.dispatchEvent(new Event('click')); // Initial shuffle - 위쪽 .then() 블록으로 이동
    };

    // Part 3: Initialize Roulette and then setup game interactions
    const initializeRouletteAndGame = async () => {
      if (rouletteCanvasContainerRef.current) {
        console.log('[GamePage] rouletteCanvasContainerRef.current is available. Initializing Roulette...');
        rouletteInstance = new Roulette();
        window.roullete = rouletteInstance; // window.roullete에 할당

        try {
          await rouletteInstance.initialize(rouletteCanvasContainerRef.current);
          console.log('[GamePage] Roulette initialized successfully.');
          setupGameInteractions(); // Roulette 초기화 성공 후 게임 상호작용 설정
        } catch (error) {
          console.error('[GamePage] Roulette initialization failed:', error);
          // 사용자에게 오류 알림 또는 다른 오류 처리 로직
          alert('게임 엔진 초기화에 실패했습니다. 페이지를 새로고침 해주세요.');
        }
      } else {
        console.error('[GamePage] rouletteCanvasContainerRef.current is null. Cannot initialize Roulette.');
        // 이 경우, DOM이 아직 준비되지 않았을 수 있으므로, 재시도 로직 또는 오류 처리가 필요할 수 있습니다.
        // 간단한 재시도를 위해 setTimeout을 사용할 수 있지만, React 생명주기를 고려한 더 나은 방법이 권장됩니다.
        // 여기서는 일단 오류를 기록하고, 실제 프로덕션에서는 더 견고한 처리가 필요합니다.
        setTimeout(initializeRouletteAndGame, 100); // 간단한 재시도
      }
    };

    initializeRouletteAndGame(); // Start the initialization process

    return () => {
      console.log('[GamePage] useEffect cleanup function called.');
      // if (readyCheckTimeoutId) clearTimeout(readyCheckTimeoutId); // polling 방식 제거
      if (donateButtonCheckTimeoutId) clearTimeout(donateButtonCheckTimeoutId);

      // 구독 해제 함수 호출
      if (unsubscribeMaps) {
        unsubscribeMaps();
      }
      if (unsubscribeGameState) {
        unsubscribeGameState();
      }

      // Remove Event Listeners (ensure elements were assigned before trying to remove)
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
      btnShakeEl?.removeEventListener('click', handleBtnShakeClick);
      sltMapEl?.removeEventListener('change', handleMapChange); // Optional chaining
      chkAutoRecordingElFromRef?.removeEventListener('change', handleAutoRecordingChange);
      closeNoticeButtonEl?.removeEventListener('click', handleCloseNotice);
      openNoticeButtonEl?.removeEventListener('click', handleOpenNotice);

      // window.socketService 대신 직접 socketService 사용
      socketService.disconnect();

      delete window.roullete; // Clean up window object
      // delete window.socketService; // 이미 전역에서 제거됨
      delete window.options;
      // delete window.updateMapSelector; // 이미 GamePage 내부 로직으로 대체됨
      delete window.translateElement;
      // gtag and dataLayer are often fine to leave, but clear if strictly necessary
      // delete window.gtag;
      // delete window.dataLayer;

      document.documentElement.lang = originalDocumentLang;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user]); // gameDetails is not added here to avoid re-subscribing on every gameDetails change. gameDetailsRef handles staleness.

  // BuyMeACoffee 스크립트 로딩
  useEffect(() => {
    const scriptId = 'bmc-script';
    const donateContainer = document.getElementById('donate'); // ID 변경

    if (!donateContainer || document.getElementById(scriptId)) return;

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js';
    script.setAttribute('data-name', 'bmc-button');
    script.setAttribute('data-slug', 'lazygyu');
    script.setAttribute('data-color', '#FFDD00');
    script.setAttribute('data-emoji', '');
    script.setAttribute('data-font', 'Comic');
    script.setAttribute('data-text', 'Buy me a coffee');
    script.setAttribute('data-outline-color', '#000000');
    script.setAttribute('data-font-color', '#000000');
    script.setAttribute('data-coffee-color', '#ffffff');
    script.async = true;

    donateContainer.appendChild(script);

    return () => {
      const existingScript = document.getElementById(scriptId);
      if (donateContainer && existingScript) {
        donateContainer.removeChild(existingScript);
      }
    };
  }, []);

  return (
    <>
      <div className="game-top-bar">
        <span className="room-name">{roomName || 'Loading room...'}</span>
        {isManager && (
          <span className="manager-icon" title="Manager">
            👑
          </span>
        )}
        <span className="user-nickname">{user?.nickname || '익명 유저'}</span> {/* 로그인 안했으면 '익명 유저' 표시 */}
      </div>
      {/*
        <head> 내부의 link 태그 및 meta 태그들은 public/index.html에 유지하는 것이 일반적입니다.
        React 컴포넌트는 주로 <body> 내부의 내용을 렌더링합니다.
        <base href="/" /> 또한 public/index.html에 있어야 합니다.
        Google Analytics 스크립트는 public/index.html에 직접 추가하거나,
        React Helmet 같은 라이브러리를 사용하여 동적으로 head를 관리할 수 있습니다.
        여기서는 gtag 초기화는 useEffect에서 처리했습니다.
      */}

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
            <button id="btnNotice">
              <i className="icon megaphone"></i>
            </button>
            <div className="sep"></div>
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

      <div id="donate">{/* BuyMeACoffee 버튼 스크립트가 여기에 동적으로 삽입됩니다. */}</div>
      <div id="inGame" className="settings hide">
        <button id="btnShake" data-trans>
          Shake!
        </button>
      </div>
      <div id="notice" style={{ display: 'none' }}>
        {' '}
        {/* 초기 상태는 none으로 */}
        <h1>Notice</h1>
        <div className="notice-body">
          <p>이 프로그램은 무료이며 사용에 아무런 제한이 없습니다.</p>
          <p>
            이 프로그램의 사용이나 프로그램을 이용한 영상 제작, 방송 등에 원작자는 아무런 제재를 가하거나 이의를
            제기하지 않습니다. 자유롭게 사용하셔도 됩니다.
          </p>
          <p>다만 저작권자를 사칭하는 것은 저작권법을 위반하는 범죄입니다.</p>
          <p>
            저작권자를 사칭하여 권리 침해를 주장하는 경우를 보거나 겪으시는 분은
            <a href="mailto:lazygyu+legal@gmail.com" target="_blank" rel="noopener noreferrer">
              lazygyu+legal@gmail.com
            </a>{' '}
            으로 제보 부탁드립니다.
          </p>
          <p>감사합니다.</p>
        </div>
        <div className="notice-action">
          <button id="closeNotice" data-trans>
            Close
          </button>
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
      {/* 
        Roulette 게임 캔버스는 이제 아래 div#roulette-canvas-container 내부에 생성됩니다.
      */}
      <div
        id="roulette-canvas-container"
        ref={rouletteCanvasContainerRef}
        style={{ width: '100%', height: '100%', position: 'fixed', top: 0, left: 0 }}
      />
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
            zIndex: 2000, // 다른 UI 요소 위에 표시되도록 z-index 설정
          }}
        >
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
            <h3>비밀번호 입력</h3>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="비밀번호"
              style={{ margin: '10px 0', padding: '8px', width: '200px' }}
            />
            {passwordError && <p style={{ color: 'red' }}>{passwordError}</p>}
            <button
              onClick={() => {
                if (roomId) {
                  // attemptJoinRoom(roomId, passwordInput); // setupGameInteractions 내의 attemptJoinRoom 호출
                  // 직접 socketService.joinRoom 호출로 변경
                  socketService.joinRoom(roomId, passwordInput, (response) => {
                    if (response.success) {
                      setShowPasswordModal(false);
                      setPasswordError(null);
                      // 방 정보 및 게임 상세 정보 가져오기 (joinRoom 성공 후)
                      const numericRoomId = parseInt(roomId, 10);
                      getRoomGameDetails(numericRoomId)
                        .then(setGameDetails)
                        .catch(err => console.error("Failed to get game details after join", err));
                    } else {
                      setPasswordError(response.message || '비밀번호가 올바르지 않습니다.');
                    }
                  });
                }
              }}
              style={{ padding: '10px 20px', marginLeft: '10px' }}
            >
              입장
            </button>
            <button
              onClick={() => navigate('/')} // 이전 페이지 또는 홈으로 이동
              style={{ padding: '10px 20px', marginLeft: '10px', backgroundColor: '#ccc' }}
            >
              취소
            </button>
          </div>
        </div>
      )}
      {showRankingModal && finalRanking && (
        <RankingDisplay
          ranking={finalRanking} // 타입은 RankingEntry[] | null
          roomName={roomName}
          onClose={() => setShowRankingModal(false)}
        />
      )}
    </>
  );
};

export default GamePage;
