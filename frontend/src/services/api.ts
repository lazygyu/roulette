import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000'; // 백엔드 API 주소

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
  // 백엔드에서는 password를 직접 받지만, 여기서는 명확성을 위해 password_hash로 명명
  // 실제 전송 시에는 { username, password: password_hash } 형태로 전송
  const response = await apiClient.post<LoginResponse>('/auth/login', { username, password: password_hash });
  return response.data; // 응답 데이터에서 access_token과 nickname을 직접 반환
};

export const register = async (username: string, password_hash: string, nickname: string): Promise<LoginResponse> => { // nickname 인자 추가
  const response = await apiClient.post<LoginResponse>('/auth/register', { username, password: password_hash, nickname }); // nickname 전달
  return response.data;
};

// 필요한 다른 API 호출 함수들을 여기에 추가할 수 있습니다.
// 예: 방 생성, 게임 시작 등

import { RoomInfo, GameInfo, RankingEntry } from '../types/gameTypes'; // RoomInfo, GameInfo, RankingEntry 임포트

// 기존 getRoomDetails는 방의 기본 정보만 가져오도록 유지하거나,
// 또는 getRoomBaseInfo 등으로 명칭 변경 고려
export const getRoomDetails = async (roomId: number): Promise<RoomInfo> => {
  const response = await apiClient.get<RoomInfo>(`/rooms/${roomId}`);
  return response.data;
};

// 새로운 함수: 방의 게임 상세 정보 가져오기
export const getRoomGameDetails = async (roomId: number): Promise<GameInfo> => {
  const response = await apiClient.get<GameInfo>(`/rooms/${roomId}/game`);
  return response.data;
};

// 새로운 함수: 게임 랭킹 정보 가져오기
export const getGameRanking = async (roomId: number, password?: string): Promise<{ rankings: RankingEntry[] }> => {
  const response = await apiClient.get<{ rankings: RankingEntry[] }>(`/rooms/${roomId}/ranking`, {
    params: { password },
  });
  return response.data;
};


interface CreateRoomResponse extends Omit<RoomInfo, 'game' | 'manager'> {
  // createRoom 응답은 manager 객체를 포함하지만, game은 포함하지 않음
  // 필요시 manager 타입도 명시적으로 정의
  managerId: number; // manager 객체 대신 managerId만 받을 경우
}


export const createRoom = async (name: string, password?: string): Promise<CreateRoomResponse> => {
  const response = await apiClient.post<CreateRoomResponse>('/rooms', { name, password });
  return response.data;
};
