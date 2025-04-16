import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User; // Request 객체에 user 속성 추가
    }
  }
} 