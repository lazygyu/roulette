import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import GamePage from './pages/game/GamePage';
import './localization';
import options from './options';

// 임시 홈 페이지 컴포넌트
const Home = () => (
  <div>
    <h1>룰렛 게임 홈</h1>
    <p>게임 방에 입장하려면 '/game/방ID' 형식으로 접속하세요.</p>
  </div>
);

// 메인 앱 컴포넌트
const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:id" element={<GamePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

// React 앱 렌더링
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 레거시 코드와의 호환성을 위한 전역 객체
// eslint-disable-next-line
(window as any).options = options;