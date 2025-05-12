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

// --- 추가된 API 함수들 ---

// 사용자 정보 인터페이스 (필요한 속성만 정의)
export interface UserInfo { // export 추가
  id: number; // 사용자 ID
  username: string;
  nickname: string;
  // 기타 필요한 사용자 정보
}

// 방 정보 인터페이스 (GetRoomResponseDto와 유사하게 정의)
export interface RoomInfo { // export 추가
  id: number;
  name: string;
  password?: string | null;
  createdAt: string; // 날짜는 string으로 받을 수 있음
  updatedAt: string;
  managerId: number; // 관리자 ID
  deletedAt?: string | null;
  manager: { // 관리자 상세 정보 (필요시)
    id: number;
    nickname: string;
  };
}


/**
 * 현재 로그인된 사용자 정보를 가져옵니다.
 * @returns 사용자 정보 Promise
 */
export const getCurrentUser = async (): Promise<UserInfo> => {
  try {
    const response = await apiClient.get<UserInfo>('/auth/me'); // '/auth/me' 엔드포인트 가정
    return response.data;
  } catch (error) {
    console.error("Error fetching current user:", error);
    // 에러 처리: 예를 들어 로그인 페이지로 리디렉션하거나 기본 사용자 객체 반환
    throw error; // 또는 에러를 다시 던져 호출 측에서 처리하도록 함
  }
};

/**
 * 특정 방의 정보를 가져옵니다.
 * @param roomId 방 ID
 * @returns 방 정보 Promise
 */
export const getRoomInfo = async (roomId: number | string): Promise<RoomInfo> => {
  try {
    const response = await apiClient.get<RoomInfo>(`/rooms/${roomId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching room info for room ${roomId}:`, error);
    throw error;
  }
};


// --- 기존 함수들 ---

interface Room { // 기존 Room 인터페이스 유지 (createRoom 응답용)
  id: number; // ID 타입을 number로 수정 (백엔드와 일치)
  name: string;
  managerId: number; // managerId 추가 (createRoom 응답에도 포함될 수 있음)
  // 백엔드에서 반환하는 방 객체의 다른 속성들을 여기에 추가할 수 있습니다.
}

export const createRoom = async (name: string, password?: string): Promise<Room> => {
  const response = await apiClient.post<Room>('/rooms', { name, password });
  return response.data;
};
