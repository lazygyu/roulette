import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { User } from '@prisma/client';
import { RoomsService } from '../../rooms/rooms.service';

interface RequestDataWithRoomId {
  roomId: number;
  // 다른 필드가 있을 수 있음
}

@Injectable()
export class ManagerOnlyGuard implements CanActivate {
  private readonly logger = new Logger(ManagerOnlyGuard.name);

  constructor(private readonly roomsService: RoomsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const data = context.switchToWs().getData<RequestDataWithRoomId>();
    const user = client.user as User; // Assume user is attached by a previous auth guard

    if (!user) {
      this.logger.warn(`ManagerOnlyGuard: User not found on socket ${client.id}. Denying access.`);
      throw new WsException('인증되지 않은 사용자입니다.');
    }

    if (!data || typeof data.roomId !== 'number') {
      this.logger.warn(`ManagerOnlyGuard: RoomId not provided or invalid in request data from ${client.id}. Denying access.`);
      throw new WsException('요청 데이터에 roomId가 없거나 유효하지 않습니다.');
    }

    const { roomId } = data;

    try {
      const isManager = await this.roomsService.isManager(roomId, user.id);
      if (!isManager) {
        this.logger.log(`ManagerOnlyGuard: User ${user.nickname} (${user.id}) is not a manager of room ${roomId}. Denying access.`);
        throw new WsException('방의 매니저만 이 작업을 수행할 수 있습니다.');
      }
      this.logger.log(`ManagerOnlyGuard: User ${user.nickname} (${user.id}) is a manager of room ${roomId}. Granting access.`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`ManagerOnlyGuard: Error checking manager status for user ${user.nickname} (${user.id}) in room ${roomId}: ${message}`);
      if (error instanceof WsException) {
        throw error;
      }
      throw new WsException('권한 확인 중 오류가 발생했습니다.');
    }
  }
}
