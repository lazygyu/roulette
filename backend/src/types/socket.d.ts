// backend/src/types/socket.d.ts
import { User } from '@prisma/client'; // Prisma User 모델 임포트

// 익명 사용자를 위한 인터페이스 정의
interface AnonymousUser {
  id: string; // 소켓 ID
  nickname: string;
  isAnonymous: true;
}

declare module 'socket.io' {
  interface Socket {
    user: User | AnonymousUser; // Socket 객체에 선택적 user 속성 추가
  }

  interface RemoteSocket<
    EmitEvents extends DefaultEventsMap,
    ListenEvents extends DefaultEventsMap,
    DataType = any
  > {
    user: User | AnonymousUser; // RemoteSocket 객체에도 user 속성 추가
  }
}
