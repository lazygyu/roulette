/*
  Warnings:

  - You are about to drop the column `ranking` on the `Game` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Game" DROP COLUMN "ranking";

-- CreateTable
CREATE TABLE "GameRanking" (
    "id" SERIAL NOT NULL,
    "gameId" INTEGER NOT NULL,
    "marbleName" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameRanking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameRanking_gameId_idx" ON "GameRanking"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GameRanking_gameId_rank_key" ON "GameRanking"("gameId", "rank");

-- AddForeignKey
ALTER TABLE "GameRanking" ADD CONSTRAINT "GameRanking_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
