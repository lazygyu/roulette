import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Link 임포트 추가
import { login as loginApi } from '../services/api'; // loginApi로 이름 변경하여 충돌 방지
import { useAuth } from '../contexts/AuthContext'; // useAuth import

function LoginPage() {
  const { login: authLogin } = useAuth(); // AuthContext의 login 함수 사용
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
      // API 호출 시 loginApi 사용
      const userData = await loginApi(username, password);
      // AuthContext의 login 함수 호출하여 상태 업데이트 및 로컬 스토리지 저장
      authLogin(userData);
      navigate('/'); // 홈페이지로 리디렉션 (예시)
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
      <p>계정이 없으신가요? <Link to="/register">회원가입</Link></p>
    </div>
  );
}

export default LoginPage;
