import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import UserInfoDisplay from './components/UserInfoDisplay';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CreateRoomPage from './pages/CreateRoomPage';
import GamePage from './pages/GamePage';
import './App.css';

const AppContent: React.FC = () => {
  const location = useLocation();
  const isGamePage = /^\/game\/.+/.test(location.pathname);

  return (
    <div>
      {!isGamePage && <UserInfoDisplay />}
      {!isGamePage && (
        <nav>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/login">Login</Link>
            </li>
            <li>
              <Link to="/register">Register</Link>
            </li>
            <li>
              <Link to="/create-room">Create Room</Link>
            </li>
          </ul>
        </nav>
      )}

      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/create-room" element={<CreateRoomPage />} />
        <Route path="/game/:roomId" element={<GamePage />} />
        <Route path="/" element={<div>Navigate to /create-room or /game/:roomId</div>} />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
