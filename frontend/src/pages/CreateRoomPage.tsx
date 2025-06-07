import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createRoom } from '../services/api';

function CreateRoomPage() {
  const [roomName, setRoomName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const handleCreateRoom = async () => {
    if (!isLoggedIn) {
      setError('방을 만들려면 로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    if (!roomName.trim()) {
      setError('방 제목을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const roomData = await createRoom(roomName, password || undefined);
      setIsLoading(false);
      navigate(`/game/${roomData.id}`);
    } catch (err) {
      setIsLoading(false);
      if (err instanceof Error) {
        setError(err.message || '방 생성에 실패했습니다.');
      } else {
        setError('알 수 없는 오류로 방 생성에 실패했습니다.');
      }
      console.error('Error creating room:', err);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
      <h1>방 만들기</h1>
      <div>
        <label htmlFor="roomName" style={{ display: 'block', marginBottom: '5px' }}>방 제목:</label>
        <input
          type="text"
          id="roomName"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="방 제목을 입력하세요"
          style={{ width: '100%', padding: '8px', marginBottom: '10px', boxSizing: 'border-box' }}
        />
      </div>
      <div>
        <label htmlFor="password" style={{ display: 'block', marginBottom: '5px' }}>비밀번호 (선택 사항):</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (입력하지 않으면 공개 방)"
          style={{ width: '100%', padding: '8px', marginBottom: '20px', boxSizing: 'border-box' }}
        />
      </div>
      <button
        onClick={handleCreateRoom}
        disabled={isLoading}
        style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        {isLoading ? '방 만드는 중...' : '방 만들기'}
      </button>
      {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
    </div>
  );
}

export default CreateRoomPage;
