import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '../services/api';
import { Link } from 'react-router-dom';

function RegisterPage() {
  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);

    try {
      // api.ts의 register 함수는 password_hash를 받지만, 여기서는 password를 직접 전달합니다.
      // 실제 해싱은 백엔드에서 이루어지거나, 프론트엔드에서 해싱 후 전달할 수도 있습니다.
      // 현재 백엔드 User DTO는 password를 직접 받으므로, 그대로 전달합니다.
      const response = await register(username, password, nickname);

      // 백엔드에서 회원가입 성공 시 바로 로그인 처리하고 토큰과 닉네임을 반환한다고 가정
      if (response.data && response.data.access_token && response.data.nickname) {
        localStorage.setItem('access_token', response.data.access_token);
        localStorage.setItem('user_nickname', response.data.nickname);
        alert('회원가입 및 로그인이 완료되었습니다.');
        navigate('/'); // 홈페이지로 리디렉션
      } else {
        // 백엔드 응답 구조가 다를 경우 이 부분 조정 필요
        setError(response.data.message || '회원가입에 실패했습니다. 응답 형식을 확인해주세요.');
      }
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('회원가입 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.');
      }
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>회원가입</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username">사용자 ID:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={4} // 예시: 최소 길이 제한
          />
        </div>
        <div>
          <label htmlFor="nickname">닉네임:</label>
          <input
            type="text"
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            minLength={2} // 예시: 최소 길이 제한
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
            minLength={6} // DTO의 MinLength(6)과 일치
          />
        </div>
        <div>
          <label htmlFor="passwordConfirm">비밀번호 확인:</label>
          <input
            type="password"
            id="passwordConfirm"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            minLength={6}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? '가입 처리 중...' : '회원가입'}
        </button>
      </form>
      <p>
        이미 계정이 있으신가요? <Link to="/login">로그인</Link>
      </p>
    </div>
  );
}

export default RegisterPage;
