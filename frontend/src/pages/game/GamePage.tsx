import { RouletteRenderer } from '../../rouletteRenderer';
import { GameSocketService, GameState } from '../../services/GameSocketService';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

// 게임 페이지 컴포넌트
export default function GamePage() {
  const { id: roomId } = useParams<{ id: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RouletteRenderer | null>(null);
  const socketServiceRef = useRef<GameSocketService | null>(null);
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [availableMaps, setAvailableMaps] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [marbleName, setMarbleName] = useState('');
  const [marbleNames, setMarbleNames] = useState<string[]>([]);
  const [selectedMapIndex, setSelectedMapIndex] = useState(0);
  const [gameSpeed, setGameSpeed] = useState(1);
  const [winningRank, setWinningRank] = useState(0);

  // 컴포넌트 마운트 시 소켓 연결 및 렌더러 초기화
  useEffect(() => {
    if (!roomId) return;

    // 게임 렌더러 초기화
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new RouletteRenderer();
      rendererRef.current.setCanvas(canvasRef.current);
      rendererRef.current.init();
    }

    // 소켓 서비스 초기화 및 연결
    const socketService = new GameSocketService();
    socketServiceRef.current = socketService;

    // 게임 상태 변경 이벤트 리스너
    socketService.on('gameStateChanged', (state: GameState) => {
      setGameState(state);
      renderGameState(state);
    });

    // 맵 목록 변경 이벤트 리스너
    socketService.on('availableMapsChanged', (maps: any[]) => {
      setAvailableMaps(maps);
    });

    // 게임 속도 변경 이벤트 리스너
    socketService.on('speedChanged', (speed: number) => {
      setGameSpeed(speed);
    });

    // 연결 설정
    socketService.connect(roomId)
      .then(() => {
        setIsConnected(true);
        return socketService.getMaps(roomId);
      })
      .then((maps) => {
        setAvailableMaps(maps);
      })
      .catch(error => {
        console.error('게임 연결 오류:', error);
      });

    // 컴포넌트 언마운트 시 정리
    return () => {
      if (socketServiceRef.current) {
        socketServiceRef.current.disconnect();
        socketServiceRef.current = null;
      }
    };
  }, [roomId]);

  // 게임 상태 렌더링 함수
  const renderGameState = (state: GameState) => {
    if (!rendererRef.current || !state) return;

    // 렌더링 파라미터 생성
    const renderParams = {
      marbles: state.marbles,
      winners: state.winners,
      entities: state.entities,
      winner: state.winner,
      // 다른 필요한 렌더링 데이터 추가
    };

    // 게임 상태 렌더링
    rendererRef.current.renderFromBackend(renderParams);
  };

  // 마블 추가 핸들러
  const handleAddMarble = () => {
    if (!marbleName.trim()) return;
    
    const newMarbleNames = [...marbleNames, marbleName];
    setMarbleNames(newMarbleNames);
    setMarbleName('');
    
    if (socketServiceRef.current && roomId) {
      socketServiceRef.current.setMarbles(roomId, newMarbleNames)
        .catch(error => console.error('마블 설정 오류:', error));
    }
  };

  // 게임 시작 핸들러
  const handleStartGame = () => {
    if (socketServiceRef.current && roomId) {
      socketServiceRef.current.startGame(roomId)
        .catch(error => console.error('게임 시작 오류:', error));
    }
  };

  // 게임 리셋 핸들러
  const handleResetGame = () => {
    if (socketServiceRef.current && roomId) {
      socketServiceRef.current.resetGame(roomId)
        .catch(error => console.error('게임 리셋 오류:', error));
    }
  };

  // 맵 변경 핸들러
  const handleMapChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mapIndex = parseInt(e.target.value);
    setSelectedMapIndex(mapIndex);
    
    if (socketServiceRef.current && roomId) {
      socketServiceRef.current.setMap(roomId, mapIndex)
        .catch(error => console.error('맵 설정 오류:', error));
    }
  };

  // 게임 속도 변경 핸들러
  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const speed = parseFloat(e.target.value);
    setGameSpeed(speed);
    
    if (socketServiceRef.current && roomId) {
      socketServiceRef.current.setSpeed(roomId, speed)
        .catch(error => console.error('속도 설정 오류:', error));
    }
  };

  // 우승 순위 변경 핸들러
  const handleWinningRankChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rank = parseInt(e.target.value);
    setWinningRank(rank);
    
    if (socketServiceRef.current && roomId) {
      socketServiceRef.current.setWinningRank(roomId, rank)
        .catch(error => console.error('우승 순위 설정 오류:', error));
    }
  };

  return (
    <div className="game-page">
      <h1>게임 룸: {roomId}</h1>
      
      <div className="game-controls">
        <div className="control-group">
          <h3>마블 설정</h3>
          <div className="marble-input">
            <input
              type="text"
              value={marbleName}
              onChange={(e) => setMarbleName(e.target.value)}
              placeholder="마블 이름 (예: 이름*개수/무게)"
            />
            <button onClick={handleAddMarble}>추가</button>
          </div>
          
          <div className="marble-list">
            <h4>추가된 마블 ({marbleNames.length})</h4>
            <ul>
              {marbleNames.map((name, index) => (
                <li key={index}>{name}</li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="control-group">
          <h3>게임 설정</h3>
          
          <div className="setting-item">
            <label>맵 선택:</label>
            <select value={selectedMapIndex} onChange={handleMapChange}>
              {availableMaps.map((map, index) => (
                <option key={index} value={index}>
                  {map.title}
                </option>
              ))}
            </select>
          </div>
          
          <div className="setting-item">
            <label>게임 속도: {gameSpeed}x</label>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={gameSpeed}
              onChange={handleSpeedChange}
            />
          </div>
          
          <div className="setting-item">
            <label>우승 순위: {winningRank}</label>
            <input
              type="range"
              min="0"
              max={marbleNames.length > 0 ? marbleNames.length - 1 : 0}
              value={winningRank}
              onChange={handleWinningRankChange}
            />
          </div>
        </div>
        
        <div className="game-actions">
          <button onClick={handleStartGame} disabled={!isConnected || marbleNames.length === 0}>
            게임 시작
          </button>
          <button onClick={handleResetGame} disabled={!isConnected}>
            게임 리셋
          </button>
        </div>
      </div>
      
      <div className="game-canvas-container">
        <canvas ref={canvasRef} width="1600" height="900"></canvas>
      </div>
      
      <div className="game-status">
        {gameState?.winner && (
          <div className="winner-display">
            <h2>🏆 우승자: {gameState.winner.name} 🏆</h2>
          </div>
        )}
      </div>
    </div>
  );
}