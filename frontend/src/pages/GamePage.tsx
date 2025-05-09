import React, { useEffect, useRef, useState } from 'react';
import '../styles.css'; // 전역 스타일 import
import { Roulette } from '../roulette'; // Roulette 타입 import
import socketServiceInstance from '../socketService'; // socketService 인스턴스 import (타입 추론용)
import optionsInstance from '../options'; // options 인스턴스 import (타입 추론용)

// 필요한 경우 타입 정의 (index1.ts나 다른 곳에서 전역으로 선언되었을 수 있음)
declare global {
  interface Window {
    roullete: Roulette; // Roulette 타입으로 변경
    socketService: typeof socketServiceInstance; // 실제 인스턴스 타입으로 변경
    options: typeof optionsInstance; // 실제 인스턴스 타입으로 변경
    updateMapSelector: (maps: { index: number; title: string }[]) => void;
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    translateElement: (element: HTMLElement) => void;
  }
}

const GamePage: React.FC = () => {
  const inNamesRef = useRef<HTMLTextAreaElement>(null);
  const inWinningRankRef = useRef<HTMLInputElement>(null);
  const chkSkillRef = useRef<HTMLInputElement>(null);
  const sltMapRef = useRef<HTMLSelectElement>(null);
  const chkAutoRecordingRef = useRef<HTMLInputElement>(null);

  // 'ready'와 'winnerType'은 상태로 관리하는 것이 더 React 방식에 맞지만,
  // 기존 코드의 직접적인 포팅을 위해 일단 변수로 유지하고, 필요시 상태로 전환할 수 있습니다.
  // let ready = false; // 이 값은 getReady 함수 내부에서 설정되고 사용됩니다.
  // let winnerType = 'first'; // 이 값은 setWinnerRank 및 버튼 클릭 핸들러에서 사용됩니다.
  // React에서는 이런 변수들을 useState로 관리하는 것이 일반적입니다.
  // 예를 들어:
  const [isGameReady, setIsGameReady] = useState(false);
  const [winnerSelectionType, setWinnerSelectionType] = useState('first');


  useEffect(() => {
    // gtag 초기화
    window.dataLayer = window.dataLayer || [];
    function gtag(...args: any[]) {
      window.dataLayer!.push(args);
    }
    window.gtag = gtag; // window.gtag에 할당
    gtag('js', new Date());
    gtag('config', 'G-5899C1DJM0');

    let localReady = false;
    let localWinnerType = 'first';

    const getNames = () => {
      if (!inNamesRef.current) return [];
      const value = inNamesRef.current.value.trim();
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
      return {
        name,
        weight,
        count,
      };
    };

    const setWinnerRank = (rank: number) => {
      if (inWinningRankRef.current) {
        inWinningRankRef.current.value = rank.toString();
      }
      if (window.options) {
        window.options.winningRank = rank; // Store 1-based rank
      }

      if (window.socketService) {
        window.socketService.setWinningRank(rank - 1); // Send 0-based rank to server
      } else {
        console.error('socketService not available');
      }

      const btnFirstWinner = document.querySelector('.btn-first-winner');
      const btnLastWinner = document.querySelector('.btn-last-winner');
      const inWinningRankEl = document.querySelector('#in_winningRank');

      if (btnFirstWinner && btnLastWinner && inWinningRankEl) {
        if (localWinnerType === 'first') {
          btnFirstWinner.classList.toggle('active', true);
          btnLastWinner.classList.toggle('active', false);
          inWinningRankEl.classList.toggle('active', false);
        } else if (localWinnerType === 'last') {
          btnFirstWinner.classList.toggle('active', false);
          btnLastWinner.classList.toggle('active', true);
          inWinningRankEl.classList.toggle('active', false);
        } else if (localWinnerType === 'custom') {
          btnFirstWinner.classList.toggle('active', false);
          btnLastWinner.classList.toggle('active', false);
          inWinningRankEl.classList.toggle('active', true);
        }
      }
    };

    const getReady = () => {
      const names = getNames();
      if (window.socketService) {
        window.socketService.setMarbles(names);
      } else {
        console.error('socketService not available');
      }
      localReady = names.length > 0;
      setIsGameReady(localReady); // Update React state
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


    const initialize = () => {
      if (!window.roullete || !window.roullete.isReady) {
        console.log('roulette does not loaded yet');
        setTimeout(initialize, 100);
        return;
      }
      console.log('initializing start');

      if (window.socketService) {
        window.socketService.connect();
      } else {
        console.error('socketService not available during initialization');
        setTimeout(() => {
          if (window.socketService) {
            console.log('Retrying socket connection...');
            window.socketService.connect();
          } else {
            console.error('socketService still not available.');
          }
        }, 500);
      }

      const savedNames = localStorage.getItem('mbr_names');
      if (savedNames && inNamesRef.current) {
        inNamesRef.current.value = savedNames;
      }

      // Event Listeners
      const inNamesEl = inNamesRef.current;
      if (inNamesEl) {
        inNamesEl.addEventListener('input', getReady);
        inNamesEl.addEventListener('blur', () => {
          const nameSource = getNames();
          const nameSet = new Set<string>();
          const nameCounts: { [key: string]: number } = {};
          nameSource.forEach((nameSrc) => {
            const name = parseName(nameSrc);
            const key = name.weight > 1 ? `${name.name}/${name.weight}` : (name.name || '');
            if (!nameSet.has(key)) {
              nameSet.add(key);
              nameCounts[key] = 0;
            }
            nameCounts[key] += name.count;
          });
          const result: string[] = [];
          Object.keys(nameCounts).forEach((key) => {
            if (nameCounts[key] > 1) {
              result.push(`${key}*${nameCounts[key]}`);
            } else {
              result.push(key);
            }
          });

          const oldValue = inNamesEl.value;
          const newValue = result.join(',');

          if (oldValue !== newValue) {
            inNamesEl.value = newValue;
            getReady();
          }
        });
      }

      document.querySelector('#btnShuffle')?.addEventListener('click', getReady);

      document.querySelector('#btnStart')?.addEventListener('click', () => {
        if (!localReady) return;
        window.gtag?.('event', 'start', {
          event_category: 'roulette',
          event_label: 'start',
          value: 1,
        });
        if (window.socketService) {
          window.socketService.startGame();
        } else {
          console.error('socketService not available');
        }
        document.querySelector('#settings')?.classList.add('hide');
        document.querySelector('#donate')?.classList.add('hide');
      });

      const chkSkillEl = chkSkillRef.current;
      if (chkSkillEl) {
        chkSkillEl.addEventListener('change', (e) => {
          if (window.options) {
            window.options.useSkills = (e.target as HTMLInputElement).checked;
          }
          // window.roullete.setWinningRank(window.options.winningRank); // This might be handled by server now
        });
      }

      const inWinningRankEl = inWinningRankRef.current;
      if (inWinningRankEl) {
        inWinningRankEl.addEventListener('change', (e) => {
          const v = parseInt((e.target as HTMLInputElement).value, 10);
          const newRank = isNaN(v) || v < 1 ? 1 : v;
          localWinnerType = 'custom';
          setWinnerSelectionType('custom'); // Update React state
          setWinnerRank(newRank);
        });
      }

      document.querySelector('.btn-last-winner')?.addEventListener('click', () => {
        console.warn("Setting winner to 'last' requires total count from server state.");
        const currentTotal = window.roullete?.getCount() ?? 1;
        localWinnerType = 'last';
        setWinnerSelectionType('last'); // Update React state
        setWinnerRank(currentTotal > 0 ? currentTotal : 1);
      });

      document.querySelector('.btn-first-winner')?.addEventListener('click', () => {
        localWinnerType = 'first';
        setWinnerSelectionType('first'); // Update React state
        setWinnerRank(1);
      });

      document.querySelector('#btnShake')?.addEventListener('click', () => {
        window.roullete?.shake();
        window.gtag?.('event', 'shake', {
          event_category: 'roulette',
          event_label: 'shake',
          value: 1,
        });
      });

      document.querySelector('#btnShuffle')?.dispatchEvent(new Event('click'));


      const mapSelector = sltMapRef.current;
      if (mapSelector) {
        mapSelector.innerHTML = '<option value="">Loading maps...</option>';
        mapSelector.disabled = true;

        window.updateMapSelector = (maps) => {
          mapSelector.innerHTML = '';
          maps.forEach((map) => {
            const option = document.createElement('option');
            option.value = map.index.toString();
            option.innerHTML = map.title;
            option.setAttribute('data-trans', '');
            window.translateElement?.(option);
            mapSelector.append(option);
          });
          mapSelector.disabled = false;
        };

        mapSelector.addEventListener('change', (e) => {
          const index = parseInt((e.target as HTMLSelectElement).value, 10);
          if (window.socketService && !isNaN(index)) {
            window.socketService.setMap(index);
          } else {
            console.error('socketService not available or invalid map index');
          }
        });
      }
      
      const chkAutoRecordingEl = chkAutoRecordingRef.current;
      if (chkAutoRecordingEl && window.roullete) {
        chkAutoRecordingEl.addEventListener('change', (e) => {
            window.roullete.setAutoRecording((e.target as HTMLInputElement).checked);
        });
        // Set initial state from options if available
        if (window.options) {
            chkAutoRecordingEl.checked = window.options.autoRecording;
            window.roullete.setAutoRecording(window.options.autoRecording);
        }
      }


      const checkDonateButtonLoaded = () => {
        const btn = document.querySelector('span.bmc-btn-text');
        if (!btn) {
          setTimeout(checkDonateButtonLoaded, 100);
        } else {
          console.log('donation button has been loaded');
          btn.setAttribute('data-trans', '');
          window.translateElement?.(btn as HTMLElement);
        }
      };
      setTimeout(checkDonateButtonLoaded, 100);

      const currentNotice = 1;
      const noticeKey = 'lastViewedNotification';

      const noticeEl = document.querySelector('#notice') as HTMLElement | null;

      const closeNotice = () => {
        if (noticeEl) noticeEl.style.display = 'none';
        localStorage.setItem(noticeKey, currentNotice.toString());
      };

      const openNotice = () => {
        console.log('openNotice');
        if (noticeEl) noticeEl.style.display = 'flex';
      };

      document.querySelector('#closeNotice')?.addEventListener('click', closeNotice);
      document.querySelector('#btnNotice')?.addEventListener('click', openNotice);

      const checkNotice = () => {
        const lastViewed = localStorage.getItem(noticeKey);
        console.log('lastViewed', lastViewed);
        if (lastViewed === null || Number(lastViewed) < currentNotice) {
          openNotice();
        }
      };

      checkNotice();
    };

    initialize();

    // Cleanup function
    return () => {
        // Remove all event listeners added in initialize
        const inNamesElCleanup = inNamesRef.current;
        if (inNamesElCleanup) {
            inNamesElCleanup.removeEventListener('input', getReady);
            // blur 이벤트 리스너는 익명 함수이므로 직접 제거가 어렵습니다.
            // 컴포넌트 언마운트 시 자동으로 정리되거나, named function으로 변경 필요.
        }
        document.querySelector('#btnShuffle')?.removeEventListener('click', getReady);
        // 기타 이벤트 리스너들도 동일하게 제거 필요
        // 예: document.querySelector('#btnStart')?.removeEventListener('click', ...);
        // 익명 함수로 등록된 이벤트 리스너는 이렇게 직접 제거하기 어렵습니다.
        // 실제 프로덕션 코드에서는 named function을 사용하거나,
        // useEffect의 cleanup 함수에서 AbortController 등을 활용하는 것이 좋습니다.
        // 이 예제에서는 단순화를 위해 일부만 표기합니다.
        if (window.socketService) {
            // socketService.disconnect(); // 페이지 이동 시 소켓 연결 해제
        }
    };

  }, []); // 빈 의존성 배열로 마운트 시 1회 실행

  // BuyMeACoffee 스크립트 로딩
  useEffect(() => {
    const scriptId = 'bmc-script';
    const donateContainer = document.getElementById('donate'); // ID 변경

    if (!donateContainer || document.getElementById(scriptId)) return;

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = "https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js";
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
              <button className={`btn-winner btn-first-winner ${winnerSelectionType === 'first' ? 'active' : ''}`} data-trans>First</button>
              <button className={`btn-winner btn-last-winner ${winnerSelectionType === 'last' ? 'active' : ''}`} data-trans>Last</button>
              <input type="number" id="in_winningRank" defaultValue="1" min="1" ref={inWinningRankRef} className={winnerSelectionType === 'custom' ? 'active' : ''} />
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

      <div id="donate">
        {/* BuyMeACoffee 버튼 스크립트가 여기에 동적으로 삽입됩니다. */}
      </div>

      <div id="inGame" className="settings hide">
        <button id="btnShake" data-trans>Shake!</button>
      </div>

      <div id="notice" style={{display: 'none'}}> {/* 초기 상태는 none으로 */}
        <h1>Notice</h1>
        <div className="notice-body">
          <p>이 프로그램은 무료이며 사용에 아무런 제한이 없습니다.</p>
          <p>
            이 프로그램의 사용이나 프로그램을 이용한 영상 제작, 방송 등에 원작자는 아무런 제재를 가하거나 이의를 제기하지
            않습니다. 자유롭게 사용하셔도 됩니다.
          </p>
          <p>다만 저작권자를 사칭하는 것은 저작권법을 위반하는 범죄입니다.</p>
          <p>
            저작권자를 사칭하여 권리 침해를 주장하는 경우를 보거나 겪으시는 분은
            <a href="mailto:lazygyu+legal@gmail.com" target="_blank" rel="noopener noreferrer">lazygyu+legal@gmail.com</a> 으로 제보 부탁드립니다.
          </p>
          <p>감사합니다.</p>
        </div>
        <div className="notice-action">
          <button id="closeNotice" data-trans>Close</button>
        </div>
      </div>

      <div className="copyright">
        &copy; 2025.<a href="https://lazygyu.net" target="_blank" rel="noopener noreferrer">lazygyu</a>
        <span data-trans>
          This program is freeware and may be used freely anywhere, including in broadcasts and videos.
        </span>
      </div>
      {/* 
        Roulette 게임 캔버스는 rouletteRenderer.ts에서 document.body에 직접 추가됩니다.
        이 부분은 React 컴포넌트 외부에서 관리되므로, GamePage.tsx에서 직접 렌더링하지 않습니다.
        만약 캔버스를 React 컴포넌트 내에서 관리하려면, RouletteRenderer의 초기화 로직 수정이 필요합니다.
      */}
    </>
  );
};

export default GamePage;
