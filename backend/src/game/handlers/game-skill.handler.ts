import { Injectable, Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { User } from '@prisma/client';
import { prefixGameRoomId } from '../utils/roomId.util';
import { GameSessionService } from '../game-session.service';
import { GameEngineService } from '../game-engine.service';
import { UseSkillDto } from '../dto/use-skill.dto';

@Injectable()
export class GameSkillHandler {
  private readonly logger = new Logger(GameSkillHandler.name);

  constructor(
    private readonly gameSessionService: GameSessionService,
    private readonly gameEngineService: GameEngineService,
  ) {}

  async handleUseSkill(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UseSkillDto<any>,
    user: User,
    server: Server,
  ) {
    const { roomId, skillType, skillPosition, extra } = data;
    this.logger.log('스킬 사용 요청 수신:', {
      roomId,
      skillType,
      skillPosition,
      extra,
      user: `${user.nickname} (${user.id})`,
    });
    const prefixedRoomId = prefixGameRoomId(roomId);

    try {
      // 스킬 사용 권한 확인 (예: 매니저만 사용 가능 또는 특정 조건)
      // 현재는 모든 인증된 사용자가 스킬을 사용할 수 있다고 가정
      // 필요하다면 this.roomsService.isManager(roomId, user.id)와 같은 로직 추가

      this.logger.log(
        `클라이언트 ${user.nickname} (${client.id})가 방 ${prefixedRoomId}(${roomId})에서 스킬 사용 시도: ${skillType}`,
      );

      // gameEngineService에 스킬 발동 로직 위임 (사용자 닉네임 전달)
      await this.gameEngineService.useSkill(roomId, skillType, skillPosition, extra, user.nickname);

      // 스킬 발동 후 게임 상태 업데이트 및 클라이언트에게 전파
      const gameState = this.gameSessionService.getGameState(roomId);
      server.to(prefixedRoomId).emit('game_state', gameState);
      // skill_used 이벤트는 game_state에 포함되므로 별도로 보낼 필요 없음

      this.logger.log(
        `방 ${prefixedRoomId}(${roomId})에서 스킬 ${skillType} 발동 완료 by ${user.nickname} (${client.id})`,
      );
      return { success: true, message: `스킬 ${skillType} 발동 성공` };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new WsException(message || '스킬 발동 중 오류 발생');
    }
  }
}
