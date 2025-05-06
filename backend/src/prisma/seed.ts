import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create test user
  const testUser = await prisma.user.upsert({
    where: { username: 'test' },
    update: {},
    create: {
      username: 'test',
      nickname: 'Test User',
      password: 'test123', // 실제 프로덕션에서는 해시된 비밀번호를 사용해야 합니다
    },
  });

  // Create test room
  const testRoom = await prisma.room.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Test Room',
      managerId: testUser.id,
    },
  });

  console.log({ testUser, testRoom });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 