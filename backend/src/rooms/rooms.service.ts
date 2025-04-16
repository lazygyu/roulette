import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { Room } from '@prisma/client';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async createRoom(createRoomDto: CreateRoomDto): Promise<Room> {
    const room = await this.prisma.room.create({
      data: {
        name: createRoomDto.name,
        password: createRoomDto.password,
        managerId: createRoomDto.managerId,
      },
    });

    return room;
  }

  async deleteRoom(id: number): Promise<Room> {
    // 방이 존재하는지 확인
    const room = await this.prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      throw new NotFoundException('해당 방을 찾을 수 없습니다.');
    }

    // 소프트 삭제를 위해 deletedAt 필드 업데이트
    return this.prisma.room.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getRoom(id: number): Promise<Room> {
    const room = await this.prisma.room.findUnique({
      where: {
        id,
        deletedAt: null,
      },
      include: { manager: true },
    });

    if (!room) {
      throw new NotFoundException('해당 방을 찾을 수 없습니다.');
    }

    return room;
  }

  async isManager(roomId: number, userId: number): Promise<boolean> {
    const room = await this.getRoom(roomId);

    if (!room) {
      throw new NotFoundException('해당 방을 찾을 수 없습니다.');
    }

    return room.managerId === userId;
  }
}
