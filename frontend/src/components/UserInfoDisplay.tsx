import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const UserInfoDisplay: React.FC = () => {
  const { isLoggedIn, user, logout } = useAuth();

  return (
    <div style={{ padding: '10px', borderBottom: '1px solid #ccc', marginBottom: '20px', textAlign: 'right' }}>
      {isLoggedIn && user ? (
        <div>
          <span>환영합니다, {user.nickname}님!</span>
          <button onClick={logout} style={{ marginLeft: '10px' }}>
            로그아웃
          </button>
        </div>
      ) : (
        <Link to="/login">
          <button>로그인</button>
        </Link>
      )}
    </div>
  );
};

export default UserInfoDisplay;
