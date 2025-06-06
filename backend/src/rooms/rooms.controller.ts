import {
  Controller,
  Post,
  Body,
  Delete,
  Param,
  Get,
  ParseIntPipe,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
  SerializeOptions,
  Query,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
// Room 엔티티 직접 사용 대신 DTO 사용
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/user.decorator';
import { User } from '@prisma/client';
import { GetRoomResponseDto } from './dto/room-response.dto';
import { GameDto } from '../game/dto/game.dto';
import { GetGameRankingResponseDto } from '../game/dto/get-game-ranking-response.dto';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @SerializeOptions({ type: GetRoomResponseDto }) // 응답 타입은 방 기본 정보 DTO
  async create(@Body() createRoomDto: CreateRoomDto, @CurrentUser() user: User): Promise<GetRoomResponseDto> {
    // 서비스에서 반환하는 타입이 Room & { manager: User } 이므로, DTO로 변환 필요
    const room = await this.roomsService.createRoom(createRoomDto, user.id);
    // GetRoomResponseDto에 맞게 수동으로 매핑하거나 class-transformer를 활용한 자동 변환 설정 필요
    // 여기서는 주요 필드만 매핑하는 예시 (실제로는 더 정교한 매핑 필요)
    return {
      id: room.id,
      name: room.name,
      password: room.password,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      managerId: room.managerId,
      deletedAt: room.deletedAt,
      manager: { id: room.manager.id, nickname: room.manager.nickname }, // username 제거
    };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @SerializeOptions({ type: GetRoomResponseDto }) // 응답 타입은 방 기본 정보 DTO
  async delete(@Param('id', ParseIntPipe) roomId: number, @CurrentUser() user: User): Promise<GetRoomResponseDto> {
    const isManager = await this.roomsService.isManager(roomId, user.id);
    if (!isManager) {
      throw new ForbiddenException('방의 매니저만 삭제할 수 있습니다.');
    }
    const room = await this.roomsService.deleteRoom(roomId);
    return {
      id: room.id,
      name: room.name,
      password: room.password,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      managerId: room.managerId,
      deletedAt: room.deletedAt,
      manager: { id: room.manager.id, nickname: room.manager.nickname }, // username 제거
      // game: null, // GetRoomResponseDto에서 game 필드 제거됨
    };
  }

  @Get(':id')
  @SerializeOptions({ type: GetRoomResponseDto }) // 응답 타입은 방 기본 정보 DTO
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<GetRoomResponseDto> {
    return await this.roomsService.getRoom(id);
  }

  @Get(':id/game')
  @SerializeOptions({ type: GameDto }) // 응답 타입은 GameDto
  async getGameDetails(@Param('id', ParseIntPipe) roomId: number): Promise<GameDto> {
    const gameDetails = await this.roomsService.getRoomGameDetails(roomId);
    if (!gameDetails) {
      // 게임 정보가 없을 경우 (예: 아직 게임이 시작되지 않음)
      // NotFoundException 또는 적절한 응답 반환
      throw new NotFoundException(`Game details for room ID ${roomId} not found.`);
    }
    return gameDetails;
  }

  @Get(':id/ranking')
  @SerializeOptions({ type: GetGameRankingResponseDto }) // 응답 타입은 GetGameRankingResponseDto
  async getGameRanking(
    @Param('id', ParseIntPipe) roomId: number,
    @Query('password') password?: string,
  ): Promise<GetGameRankingResponseDto> {
    return this.roomsService.getGameRanking(roomId, password);
  }
}
