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

// 백엔드의 GetRoomResponseDto 와 유사한 프론트엔드용 타입
interface RoomDetails {
  id: number;
  name: string;
  managerId: number;
  createdAt: string; // Date 타입은 string으로 받을 수 있음
  updatedAt: string;
  // 필요에 따라 다른 필드 추가
}

export const getRoomDetails = async (roomId: number): Promise<RoomDetails> => {
  const response = await apiClient.get<RoomDetails>(`/rooms/${roomId}`);
  return response.data;
};


interface Room {
  id: number; // id 타입을 number로 변경 (백엔드와 일치)
  name: string;
  // 백엔드에서 반환하는 방 객체의 다른 속성들을 여기에 추가할 수 있습니다.
}

export const createRoom = async (name: string, password?: string): Promise<Room> => {
  const response = await apiClient.post<Room>('/rooms', { name, password });
  return response.data;
};
