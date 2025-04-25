import { RenderParameters } from './rouletteRenderer';
import { UIObject } from './UIObject';
import { bound } from './utils/bound.decorator';
import { Rect } from './types/rect.type';

export class RankRenderer implements UIObject {
  private _currentY = 0;
  private _targetY = 0;
  private fontHeight = 16;
  private _userMoved = 0;
  private _currentWinner = -1;
  private maxY = 0;
  constructor() {}

  @bound
  onWheel(e: WheelEvent) {
    this._targetY += e.deltaY;
    if (this._targetY > this.maxY) {
      this._targetY = this.maxY;
    }
    this._userMoved = 2000;
  }

  render(
    ctx: CanvasRenderingContext2D,
    { winners, marbles, winnerRank }: RenderParameters,
    width: number,
    height: number
  ) {
    const startX = width - 5;
    const startY = Math.max(0, this._currentY - height / 2);
    this.maxY = Math.max(
      0,
      (marbles.length + winners.length) * this.fontHeight
    );
    this._currentWinner = winners.length;

    ctx.save();
    ctx.translate(0, -startY);
    ctx.font = 'bold 11pt sans-serif';
    ctx.textAlign = 'right';
    winners.forEach((marble: { color: string; name: string }, rank: number) => {
      const y = rank * this.fontHeight;
      if (y >= startY && y <= startY + ctx.canvas.height) {
        ctx.fillStyle = marble.color;
        ctx.fillText(
          `${rank === winnerRank ? '☆' : '\u2714'} ${marble.name} #${rank + 1}`,
          startX,
          20 + y
        );
      }
    });
    ctx.font = '10pt sans-serif';
    marbles.forEach((marble: { color: string; name: string }, rank: number) => {
      const y = (rank + winners.length) * this.fontHeight;
      if (y >= startY && y <= startY + ctx.canvas.height) {
        ctx.fillStyle = marble.color;
        ctx.fillText(
          `${marble.name} #${rank + 1 + winners.length}`,
          startX,
          20 + y
        );
      }
    });
    ctx.restore();
  }

  update(deltaTime: number) {
    if (this._currentWinner === -1) {
      return;
    }
    if (this._userMoved > 0) {
      this._userMoved -= deltaTime;
    } else {
      this._targetY = this._currentWinner * this.fontHeight;
    }
    if (this._currentY !== this._targetY) {
      this._currentY += (this._targetY - this._currentY) * (deltaTime / 250);
    }
    if (Math.abs(this._currentY - this._targetY) < 1) {
      this._currentY = this._targetY;
    }
  }

  getBoundingBox(): Rect | null {
    return null;
  }
}
