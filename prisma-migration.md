# Prisma Migration

## 마이그레이션을 생성하고 db를 변경하는 방법
1. prisma 스키마 수정
2. npx prisma migrate dev --create-only
3. npx prisma migrate deploy // 마이그레이션 적용. 적용 안된 마이그레이션까지. 다 적용이 됨
4. npx prisma generate // Prisma 클라이언트 생성

## 참고 링크
- [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate/getting-started)