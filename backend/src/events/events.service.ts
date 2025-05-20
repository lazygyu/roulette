import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RoomsService } from '../rooms/rooms.service';

export interface ErrorType {
  message: string;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private roomsService: RoomsService) {}

  async verifyRoomExists(roomId: number) {
    return this.roomsService.getRoom(roomId);
  }

  async handleJoinRoom(client: Socket, server: Server, roomId: number, username?: string): Promise<void> {
    try {
      // 방이 존재하는지 확인
      const room = await this.roomsService.getRoom(roomId);
      const roomChannel = `room_${roomId}`;
      
      // 이미 다른 방에 있다면 먼저 퇴장
      if (client.data.roomId && client.data.roomId !== roomId) {
        await this.handleLeaveRoom(client, server, client.data.roomId);
      }
      
      // 유저 정보 저장 (세션 데이터로)
      client.data.username = username || `게스트_${client.id.substring(0, 4)}`;
      client.data.roomId = roomId;
      client.data.roomName = room.name;
      
      // Socket.IO 룸에 클라이언트 추가
      await client.join(roomChannel);
      
      // 방 참여 확인 메시지 전송
      client.emit('joinedRoom', { 
        roomId, 
        roomName: room.name
      });
      
      this.logger.log(`Client ${client.id} (${client.data.username}) joined room ${roomId}`);
    } catch (error) {
      client.emit('error', { message: '방 입장 중 오류가 발생했습니다.' });
      this.logger.error(`Error joining room: ${(error as ErrorType).message}`);
    }
  }

  async handleLeaveRoom(client: Socket, server: Server, roomId: number): Promise<void> {
    if (!roomId) return;
    
    const roomChannel = `room_${roomId}`;
    await client.leave(roomChannel);
    
    this.logger.log(`Client ${client.id} (${client.data.username || '익명'}) left room ${roomId}`);
  }

  handleSendMessage(client: Socket, server: Server, roomId: number, message: string): void {
    try {
      // 사용자가 해당 방에 있는지 확인
      if (client.data.roomId !== roomId) {
        client.emit('error', { message: '해당 방에 입장한 상태가 아닙니다.' });
        return;
      }
      
      const roomChannel = `room_${roomId}`;
      
      // 해당 방의 모든 사용자에게 메시지 전달
      server.to(roomChannel).emit('newMessage', {
        senderId: client.id,
        sender: client.data.username || '익명',
        message,
        timestamp: new Date().toISOString()
      });
      
      this.logger.log(`Message in room ${roomId} from ${client.data.username || '익명'}: ${message}`);
    } catch (error) {
      client.emit('error', { message: '메시지 전송 중 오류가 발생했습니다.' });
      this.logger.error(`Error sending message: ${(error as ErrorType).message}`);
    }
  }

  async handleDisconnect(client: Socket, server: Server): Promise<void> {
    // 현재 사용자가 속한 방에 퇴장 처리
    if (client.data.roomId) {
      const roomId = client.data.roomId;
      await this.handleLeaveRoom(client, server, roomId);
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }
} 