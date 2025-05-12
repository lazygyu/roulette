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
  SerializeOptions,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { Room } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/user.decorator';
import { User } from '@prisma/client';
import { GetRoomResponseDto } from './dto/room-response.dto';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @SerializeOptions({ type: GetRoomResponseDto })
  async create(@Body() createRoomDto: CreateRoomDto, @CurrentUser() user: User): Promise<GetRoomResponseDto> {
    return this.roomsService.createRoom(createRoomDto, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @SerializeOptions({ type: GetRoomResponseDto })
  async delete(@Param('id', ParseIntPipe) roomId: number, @CurrentUser() user: User): Promise<GetRoomResponseDto> {
    const isManager = await this.roomsService.isManager(roomId, user.id);
    if (!isManager) {
      throw new ForbiddenException('방의 매니저만 삭제할 수 있습니다.');
    }
    return this.roomsService.deleteRoom(roomId);
  }

  @Get(':id')
  @SerializeOptions({ type: GetRoomResponseDto })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<GetRoomResponseDto> {
    return this.roomsService.getRoom(id);
  }
}
