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

export const login = async (username: string, password_hash: string) => {
  // 백엔드에서는 password를 직접 받지만, 여기서는 명확성을 위해 password_hash로 명명
  // 실제 전송 시에는 { username, password: password_hash } 형태로 전송
  return apiClient.post('/auth/login', { username, password: password_hash });
};

export const register = async (username: string, password_hash: string, nickname: string) => { // nickname 인자 추가
  return apiClient.post('/auth/register', { username, password: password_hash, nickname }); // nickname 전달
};

// 필요한 다른 API 호출 함수들을 여기에 추가할 수 있습니다.
// 예: 방 생성, 게임 시작 등
