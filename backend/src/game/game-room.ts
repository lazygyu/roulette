import { Game, GameStatus } from '@prisma/client';
import { Roulette } from './roulette';

export class GameRoom {
  id: number;
  game: Roulette;
  isRunning: boolean;

  constructor(id: number, game: Roulette) {
    this.id = id;
    this.game = game;
    this.isRunning = false;
  }

  public configureFromData(gameData: Game) {
    if (gameData.mapIndex !== null && gameData.mapIndex !== undefined) {
      this.game.setMap(gameData.mapIndex);
    }
    if (gameData.marbles && gameData.marbles.length > 0) {
      this.game.setMarbles(gameData.marbles);
    }
    if (gameData.winningRank !== null && gameData.winningRank !== undefined) {
      this.game.setWinningRank(gameData.winningRank);
    }
    if (gameData.speed !== null && gameData.speed !== undefined) {
      this.game.setSpeed(gameData.speed);
    }

    switch (gameData.status) {
      case GameStatus.IN_PROGRESS:
        this.isRunning = true;
        break;
      case GameStatus.WAITING:
      case GameStatus.FINISHED:
        this.isRunning = false;
        break;
      default:
        this.isRunning = false;
    }
  }

  public destroy() {
    if (this.game && typeof this.game.destroy === 'function') {
      this.game.destroy();
    }
  }
}
