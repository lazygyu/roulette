import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api'; // 수정된 API 서비스 import

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await login(username, password);
      if (response.data && response.data.access_token) {
        localStorage.setItem('access_token', response.data.access_token);
        // 로그인 성공 후 사용자를 홈페이지 또는 다른 적절한 페이지로 리디렉션합니다.
        // 예: navigate('/'); 또는 navigate('/create-room');
        navigate('/'); // 홈페이지로 리디렉션 (예시)
      } else {
        setError('로그인에 실패했습니다. 응답 형식을 확인해주세요.');
      }
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('로그인 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.');
      }
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>로그인</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username">사용자명:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">비밀번호:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
      {/* (선택 사항) 회원가입 페이지로 이동하는 링크 */}
      {/* <p>계정이 없으신가요? <Link to="/register">회원가입</Link></p> */}
    </div>
  );
}

export default LoginPage;
