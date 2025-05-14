// backend/src/types/socket.d.ts
import { User } from '@prisma/client'; // Prisma User 모델 임포트

declare module 'socket.io' {
  interface Socket {
    user: User | null; // Socket 객체에 선택적 user 속성 추가
  }
}
