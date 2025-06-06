import { Marble } from '../marble';
import { MarbleManager } from './marble.manager';
import { StageDef } from '../data/maps';
import { zoomThreshold } from '../data/constants';

export class GameStateManager {
  private _isRunning = false;
  private _winner: Marble | null = null;
  private _winnerRank = 0;
  private _speed = 1;
  private _timeScale = 1;
  private _goalDist = Infinity;
  private _shakeAvailable = false;
  private _noMoveDuration = 0;

  constructor(private marbleManager: MarbleManager) {}

  get isRunning(): boolean {
    return this._isRunning;
  }

  get winner(): Marble | null {
    return this._winner;
  }

  get winnerRank(): number {
    return this._winnerRank;
  }

  get speed(): number {
    return this._speed;
  }

  get timeScale(): number {
    return this._timeScale;
  }

  get goalDist(): number {
    return this._goalDist;
  }

  get shakeAvailable(): boolean {
    return this._shakeAvailable;
  }

  public start(totalMarbleCount: number) {
    this._isRunning = true;
    if (this._winnerRank >= totalMarbleCount && totalMarbleCount > 0) {
      this._winnerRank = totalMarbleCount - 1;
    } else if (totalMarbleCount === 0) {
      this._winnerRank = 0;
    }
  }

  public stop() {
    this._isRunning = false;
  }

  public setSpeed(value: number) {
    if (value <= 0) {
      throw new Error('Speed multiplier must larger than 0');
    }
    this._speed = value;
  }

  public setWinningRank(rank: number) {
    this._winnerRank = rank;
  }

  public reset() {
    this._isRunning = false;
    this._winner = null;
    this._goalDist = Infinity;
    this._shakeAvailable = false;
    this._noMoveDuration = 0;
  }

  public checkForWinner() {
    if (!this._isRunning) return;

    const winners = this.marbleManager.winners;
    const marbles = this.marbleManager.marbles;
    const totalMarbleCount = this.marbleManager.totalMarbleCount;

    const isLastPlaceWinner = this._winnerRank === totalMarbleCount - 1;

    if (!isLastPlaceWinner && winners.length === this._winnerRank + 1) {
      this._winner = winners[this._winnerRank];
      this.stop();
      return;
    }

    if (isLastPlaceWinner && winners.length === totalMarbleCount - 1) {
      if (marbles.length === 1) {
        this._winner = marbles[0];
        this.stop();
        return;
      }
    }

    if (winners.length === totalMarbleCount && totalMarbleCount > 0) {
      this.stop();
      if (!this._winner && winners[this._winnerRank]) {
        this._winner = winners[this._winnerRank];
      }
    }
  }

  public updateTimeScale(stage: StageDef) {
    const activeMarbles = this.marbleManager.marbles;
    if (activeMarbles.length > 0) {
      const targetIndex = Math.max(0, this._winnerRank - this.marbleManager.winners.length);
      const topY = activeMarbles[targetIndex] ? activeMarbles[targetIndex].y : 0;
      this._goalDist = Math.abs(stage.zoomY - topY);
      this._timeScale = this.calculateTimeScale(stage);
    } else {
      this._goalDist = 0;
      this._timeScale = 1;
    }
  }

  private calculateTimeScale(stage: StageDef): number {
    const currentMarbles = this.marbleManager.marbles;
    const targetDisplayRank = this._winnerRank + 1;
    if (this.marbleManager.winners.length < targetDisplayRank && currentMarbles.length > 0) {
      const remainingTargetRank = targetDisplayRank - this.marbleManager.winners.length - 1;
      if (remainingTargetRank >= 0 && remainingTargetRank < currentMarbles.length) {
        const targetMarbleForZoom = currentMarbles[remainingTargetRank];
        if (targetMarbleForZoom) {
          const distToZoomY = Math.abs(stage.zoomY - targetMarbleForZoom.y);
          if (distToZoomY < zoomThreshold && targetMarbleForZoom.y > stage.zoomY - zoomThreshold * 1.2) {
            return Math.max(0.2, distToZoomY / zoomThreshold);
          }
        }
      }
    }
    return 1;
  }

  public updateShakeAvailability(noMoveDuration: number) {
    this._noMoveDuration = noMoveDuration;
    if (this._isRunning && this.marbleManager.marbles.length > 0 && this._noMoveDuration > 3000) {
      this._shakeAvailable = true;
    } else {
      this._shakeAvailable = false;
    }
  }

  public finalizeWinner() {
    if (this._winner) {
        let rankedMarbles = this.marbleManager.getFinalRanking();
        let winnerInRankedList = rankedMarbles.find((r) => r.id === this._winner!.id);

        if (!winnerInRankedList && !this._winner.isDummy) {
            let rankForWinner = this._winnerRank + 1;
            if (this._winnerRank === this.marbleManager.totalMarbleCount - 1 && !this.marbleManager.winners.find((w) => w.id === this._winner!.id)) {
                rankForWinner = this.marbleManager.totalMarbleCount;
            }
            const newWinnerEntry = {
                id: this._winner.id,
                name: this._winner.name,
                finalRank: rankForWinner,
                yPos: this._winner.y,
                isWinnerGoal: true,
            };
            rankedMarbles.push(newWinnerEntry);
        }

        rankedMarbles.forEach((r) => {
            r.isWinnerGoal = r.id === this._winner!.id;
        });

        rankedMarbles.sort((a, b) => {
            const rankA = typeof a.finalRank === 'number' ? a.finalRank : Infinity;
            const rankB = typeof b.finalRank === 'number' ? b.finalRank : Infinity;
            return rankA - rankB;
        });
        return rankedMarbles;
    }
    return this.marbleManager.getFinalRanking();
  }
}
