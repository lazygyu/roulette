import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { Room } from '@prisma/client';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async create(createRoomDto: CreateRoomDto): Promise<Room> {
    const room = await this.prisma.room.create({
      data: {
        name: createRoomDto.name,
        password: createRoomDto.password,
        managerId: createRoomDto.managerId,
      },
    });

    return room;
  }

  async delete(id: number): Promise<Room> {
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

  async findAll(): Promise<Room[]> {
    // 삭제되지 않은 방만 조회
    return this.prisma.room.findMany({
      where: { deletedAt: null },
      include: { manager: true },
    });
  }

  async findOne(id: number): Promise<Room> {
    const room = await this.prisma.room.findFirst({
      where: { 
        id,
        deletedAt: null 
      },
      include: { manager: true },
    });

    if (!room) {
      throw new NotFoundException('해당 방을 찾을 수 없습니다.');
    }

    return room;
  }
} 