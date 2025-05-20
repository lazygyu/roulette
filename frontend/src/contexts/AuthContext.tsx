import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';

interface DecodedJwtPayload { // Renamed for clarity, this is what's in the token
  sub: number; // Standard JWT subject claim, used as user ID
  username: string; // Added username as it's in the payload
  nickname: string; // Now included in the payload
  iat?: number; // Issued at (standard claim)
  exp?: number; // Expiration time (standard claim)
}

interface User { // This is the user object shape used in the context
  id: number; 
  username: string;
  nickname: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  login: (userData: { access_token: string; nickname?: string }) => void; // API still returns nickname separately, though it's also in token
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
        // Handle invalid token, e.g., by logging out the user
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
      // Note: userData.nickname from API response could be used as a fallback or for initial display
      // if token decoding is delayed, but with nickname in token, it should be consistent.
    } catch (error) {
      console.error("Failed to decode token during login:", error);
      // Handle invalid token, e.g., by not logging in
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
