// filepath: c:\Users\TAK\Desktop\2025 4-1\Capstone_Design\project\roulette\roulette-app\src\pages\HomePage.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import socketService from '../services/socketService'; // socketService import
import RouletteVisualizer from '../components/RouletteVisualizer'; // RouletteVisualizer import

// GameState 및 MapInfo 타입 정의 (socketService.ts와 동일하게 또는 공유 타입으로)
interface GameState {
  [key: string]: any;
}

interface MapInfo {
  index: number;
  title: string;
}

function HomePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [availableMaps, setAvailableMaps] = useState<MapInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marbleNamesInput, setMarbleNamesInput] = useState(''); // 구슬 이름 입력용

  useEffect(() => {
    if (!roomId) {
      setError('Room ID is missing.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    socketService
      .connect(roomId)
      .then(() => {
        console.log(`Successfully connected and joined room ${roomId}`);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to connect to socket:', err);
        setError(err.message || 'Failed to connect to room.');
        setIsLoading(false);
      });

    // 게임 상태 업데이트 구독
    const unsubscribeGameState = socketService.onGameStateUpdate((newGameState) => {
      setGameState(newGameState);
    });

    // 사용 가능한 맵 목록 업데이트 구독
    const unsubscribeMaps = socketService.onAvailableMapsUpdate((maps) => {
      setAvailableMaps(maps);
    });

    // 컴포넌트 언마운트 시 소켓 연결 해제 및 구독 해제
    return () => {
      console.log('HomePage unmounting, disconnecting socket...');
      socketService.disconnect();
      unsubscribeGameState();
      unsubscribeMaps();
    };
  }, [roomId]); // roomId가 변경될 때마다 재연결

  const handleSetMarbles = () => {
    const names = marbleNamesInput
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name);
    if (names.length > 0) {
      socketService.setMarbles(names);
    }
  };

  const handleStartGame = () => {
    socketService.startGame();
  };

  if (isLoading) {
    return <div>Loading and connecting to room: {roomId}...</div>;
  }

  if (error) {
    return (
      <div>
        Error: {error} <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!socketService.isConnected() && !isLoading) {
    return (
      <div>
        Disconnected.{' '}
        <button onClick={() => socketService.connect(roomId!).catch((e) => setError(e.message))}>Reconnect</button>
      </div>
    );
  }

  return (
    <div>
      <h1>Game Room: {roomId}</h1>
      <p>Socket Connected: {socketService.isConnected().toString()}</p>

      <div>
        <h2>Set Marbles</h2>
        <input
          type="text"
          placeholder="Enter marble names, comma separated"
          value={marbleNamesInput}
          onChange={(e) => setMarbleNamesInput(e.target.value)}
        />
        <button onClick={handleSetMarbles}>Set Marbles</button>
      </div>

      <div>
        <button onClick={handleStartGame}>Start Game</button>
        {/* 다른 게임 컨트롤 버튼들 (reset, set map, set speed 등) 추가 */}
      </div>

      <h2>Game State:</h2>
      <pre>{JSON.stringify(gameState, null, 2)}</pre>

      <h2>Available Maps:</h2>
      <ul>
        {availableMaps.map((map) => (
          <li key={map.index} onClick={() => socketService.setMap(map.index)}>
            {map.title} (Click to select)
          </li>
        ))}
      </ul>

      {/* 여기에 룰렛 시각화 컴포넌트를 추가하고 gameState를 prop으로 전달 */}
      {/* 예: <RouletteVisualizer gameState={gameState} /> */}
    </div>
  );
}

export default HomePage;
