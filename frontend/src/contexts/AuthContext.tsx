import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';

interface DecodedJwtPayload {
  sub: number;
  username: string;
  nickname: string;
  iat?: number;
  exp?: number;
}

interface User {
  id: number;
  username: string;
  nickname: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  login: (userData: { access_token: string; nickname?: string }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        const decodedPayload = jwtDecode<DecodedJwtPayload>(token);
        setIsLoggedIn(true);
        setUser({
          id: decodedPayload.sub,
          username: decodedPayload.username,
          nickname: decodedPayload.nickname
        });
      } catch (error) {
        console.error("Failed to decode token:", error);
        localStorage.removeItem('access_token');
        setIsLoggedIn(false);
        setUser(null);
      }
    }
  }, []);

  const login = (userData: { access_token: string; nickname?: string }) => {
    localStorage.setItem('access_token', userData.access_token);
    try {
      const decodedPayload = jwtDecode<DecodedJwtPayload>(userData.access_token);
      setIsLoggedIn(true);
      setUser({
        id: decodedPayload.sub,
        username: decodedPayload.username,
        nickname: decodedPayload.nickname
      });
    } catch (error) {
      console.error("Failed to decode token during login:", error);
      localStorage.removeItem('access_token');
      setIsLoggedIn(false);
      setUser(null);
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    setIsLoggedIn(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
