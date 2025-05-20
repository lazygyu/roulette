import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  nickname: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  login: (userData: { access_token: string; nickname: string }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const nickname = localStorage.getItem('nickname');
    if (token && nickname) {
      setIsLoggedIn(true);
      setUser({ nickname });
    }
  }, []);

  const login = (userData: { access_token: string; nickname: string }) => {
    localStorage.setItem('access_token', userData.access_token);
    localStorage.setItem('nickname', userData.nickname);
    setIsLoggedIn(true);
    setUser({ nickname: userData.nickname });
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('nickname');
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
