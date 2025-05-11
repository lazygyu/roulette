import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // useNavigate 추가
import '../styles.css'; // 전역 스타일 import
import { Roulette } from '../roulette';
import socketService from '../services/socketService'; // 경로 변경
import options from '../options'; // 실제 인스턴스 사용
// GameState 등의 타입은 roulette.ts나 socketService에서 가져오므로 여기서 직접 임포트 불필요할 수 있음
// 필요하다면 import { GameState, MapInfo } from '../types/gameTypes'; 추가
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

  // For localization
  const [currentLocale, setCurrentLocale] = useState<TranslatedLanguages>('en');

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
      if (socketService) socketService.setWinningRank(rank - 1);
      else console.error('socketService not available for setWinnerRank');

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
      const names = getNames();
      // window.socketService 대신 직접 socketService 사용
      if (socketService) socketService.setMarbles(names);
      else console.error('socketService not available for submitParticipantNamesToBackend');

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
      const currentParticipantCount = window.roullete?.getCount() ?? 0;
      const canStartGame = currentParticipantCount > 0;

      if (!canStartGame) {
        console.log('Cannot start game: No participants found in roulette instance.');
        return;
      }

      window.gtag?.('event', 'start', { event_category: 'roulette', event_label: 'start', value: 1 });
      // window.socketService 대신 직접 socketService 사용
      if (socketService) {
        socketService.startGame();
      } else {
        console.error('socketService not available for startGame');
      }
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
      // window.socketService 대신 직접 socketService 사용
      if (socketService && !isNaN(index)) socketService.setMap(index);
      else console.error('socketService not available or invalid map index for setMap');
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

      // roomId가 있을 경우에만 connect 시도
      if (roomId && socketService) {
        socketService
          .connect(roomId)
          .then(() => console.log(`GamePage: Successfully connected to socket for room ${roomId}`))
          .catch((error) => {
            console.error(`GamePage: Failed to connect to socket for room ${roomId}`, error);
            alert(error.message || '방 입장에 실패했습니다. 이전 페이지로 돌아갑니다.');
            navigate(-1); // 이전 페이지로 이동, 또는 navigate('/') 등으로 특정 페이지 지정
          });
      } else if (!roomId) {
        console.error('GamePage: Room ID is missing, cannot connect to socket.');
        alert('잘못된 접근입니다. 방 ID가 없습니다.');
        navigate('/'); // 홈페이지로 리디렉션
      } else {
        console.error('socketService not available during GamePage initialization');
        alert('소켓 서비스 초기화 오류입니다. 잠시 후 다시 시도해주세요.');
        navigate('/'); // 홈페이지로 리디렉션
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
      if (sltMapEl && socketService) {
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
      if (socketService && rouletteInstance) { // window.roullete 대신 rouletteInstance 사용
        unsubscribeGameState = socketService.onGameStateUpdate((gameState) => {
          if (rouletteInstance) { // window.roullete 대신 rouletteInstance 사용
            rouletteInstance.updateStateFromServer(gameState);

            const inGameDiv = document.querySelector('#inGame');
            if (inGameDiv) {
              inGameDiv.classList.toggle('hide', !gameState.shakeAvailable);
            }
          }
        });
      }

      if (chkAutoRecordingElFromRef) {
        // chkAutoRecordingElFromRef null 체크
        chkAutoRecordingElFromRef.addEventListener('change', handleAutoRecordingChange);
        if (window.options && rouletteInstance) { // window.roullete 대신 rouletteInstance 사용
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

      btnShuffleEl?.dispatchEvent(new Event('click')); // Initial shuffle
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
      if (socketService) socketService.disconnect();

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
  }, [roomId]); // roomId가 변경되면 useEffect를 다시 실행 (방 변경 시 소켓 재연결 등)

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
      {/*
        <head> 내부의 link 태그 및 meta 태그들은 public/index.html에 유지하는 것이 일반적입니다.
        React 컴포넌트는 주로 <body> 내부의 내용을 렌더링합니다.
        <base href="/" /> 또한 public/index.html에 있어야 합니다.
        Google Analytics 스크립트는 public/index.html에 직접 추가하거나,
        React Helmet 같은 라이브러리를 사용하여 동적으로 head를 관리할 수 있습니다.
        여기서는 gtag 초기화는 useEffect에서 처리했습니다.
      */}

      <div id="settings" className="settings">
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
      <div id="roulette-canvas-container" ref={rouletteCanvasContainerRef} style={{ width: '100%', height: '100%', position: 'fixed', top: 0, left: 0, zIndex: -1 }} />
    </>
  );
};

export default GamePage;
