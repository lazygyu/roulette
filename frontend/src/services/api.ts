import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default apiClient;

interface LoginResponse {
  access_token: string;
  nickname: string;
}

export const login = async (username: string, password_hash: string): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>('/auth/login', { username, password: password_hash });
  return response.data;
};

export const register = async (username: string, password_hash: string, nickname: string): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>('/auth/register', { username, password: password_hash, nickname });
  return response.data;
};

import { RoomInfo, GameInfo, RankingEntry } from '../types/gameTypes';

export const getRoomDetails = async (roomId: number): Promise<RoomInfo> => {
  const response = await apiClient.get<RoomInfo>(`/rooms/${roomId}`);
  return response.data;
};

export const getRoomGameDetails = async (roomId: number): Promise<GameInfo> => {
  const response = await apiClient.get<GameInfo>(`/rooms/${roomId}/game`);
  return response.data;
};

export const getGameRanking = async (roomId: number, password?: string): Promise<{ rankings: RankingEntry[] }> => {
  const response = await apiClient.get<{ rankings: RankingEntry[] }>(`/rooms/${roomId}/ranking`, {
    params: { password },
  });
  return response.data;
};


interface CreateRoomResponse extends Omit<RoomInfo, 'game' | 'manager'> {
  managerId: number;
}


export const createRoom = async (name: string, password?: string): Promise<CreateRoomResponse> => {
  const response = await apiClient.post<CreateRoomResponse>('/rooms', { name, password });
  return response.data;
};
