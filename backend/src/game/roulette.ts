import { Marble } from './marble';
import { Skills, zoomThreshold } from './data/constants';
import { StageDef, stages } from './data/maps';
import { parseName } from './utils/utils';
import { IPhysics } from './IPhysics';
import { Box2dPhysics } from './physics/physics-box2d';
import { MapEntityState } from './types/MapEntity.type';

export class Roulette {
  private _marbles: Marble[] = [];

  private _lastTime: number = 0;
  private _elapsed: number = 0;
  private _noMoveDuration: number = 0;
  private _shakeAvailable: boolean = false;

  private _updateInterval = 10;
  private _timeScale = 1;
  private _speed = 1;

  private _winners: Marble[] = [];
  private _stage: StageDef | null = null;

  private _winnerRank = 0;
  private _totalMarbleCount = 0;
  private _goalDist: number = Infinity;
  private _isRunning: boolean = false;
  private _winner: Marble | null = null;

  private physics!: IPhysics;

  private _isReady: boolean = false;
  get isReady() {
    return this._isReady;
  }

  constructor() {
    this._init();
  }

  private async _init() {
    this.physics = new Box2dPhysics();
    await this.physics.init();
    this._stage = stages[0];
    this._loadMap();
    this._isReady = true;
  }

  private _updateMarbles(deltaTime: number) {
    if (!this._stage) return;

    for (let i = 0; i < this._marbles.length; i++) {
      const marble = this._marbles[i];
      marble.update(deltaTime);
      if (marble.skill === Skills.Impact) {
        this.physics.impact(marble.id);
      }
      if (marble.y > this._stage.goalY) {
        this._winners.push(marble);
        if (this._isRunning && this._winners.length === this._winnerRank + 1) {
          this._winner = marble;
          this._isRunning = false;
        } else if (
          this._isRunning &&
          this._winnerRank === this._winners.length &&
          this._winnerRank === this._totalMarbleCount - 1
        ) {
          this._winner = this._marbles[i + 1];
          this._isRunning = false;
        }
        setTimeout(() => {
          this.physics.removeMarble(marble.id);
        }, 500);
      }
    }

    const targetIndex = this._winnerRank - this._winners.length;
    const topY = this._marbles[targetIndex] ? this._marbles[targetIndex].y : 0;
    this._goalDist = Math.abs(this._stage.zoomY - topY);
    this._timeScale = this._calcTimeScale();

    this._marbles = this._marbles.filter(
      (marble) => marble.y <= this._stage!.goalY,
    );
  }

  private _calcTimeScale(): number {
    if (!this._stage) return 1;
    const targetIndex = this._winnerRank - this._winners.length;
    if (
      this._winners.length < this._winnerRank + 1 &&
      this._goalDist < zoomThreshold
    ) {
      if (
        this._marbles[targetIndex].y >
        this._stage.zoomY - zoomThreshold * 1.2 &&
        (this._marbles[targetIndex - 1] || this._marbles[targetIndex + 1])
      ) {
        return Math.max(0.2, this._goalDist / zoomThreshold);
      }
    }
    return 1;
  }

  public update() {
    if (!this._lastTime) this._lastTime = Date.now();
    const currentTime = Date.now();

    this._elapsed += (currentTime - this._lastTime) * this._speed;
    if (this._elapsed > 100) {
      this._elapsed %= 100;
    }
    this._lastTime = currentTime;

    const interval = (this._updateInterval / 1000) * this._timeScale;

    while (this._elapsed >= this._updateInterval) {
      this.physics.step(interval);
      this._updateMarbles(this._updateInterval);
      this._elapsed -= this._updateInterval;
    }

    if (this._marbles.length > 1) {
      this._marbles.sort((a, b) => b.y - a.y);
    }

    if (
      this._isRunning &&
      this._marbles.length > 0 &&
      this._noMoveDuration > 3000
    ) {
      this._changeShakeAvailable(true);
    } else {
      this._changeShakeAvailable(false);
    }
  }

  private _loadMap() {
    if (!this._stage) {
      throw new Error('No map has been selected');
    }

    this.physics.createStage(this._stage);
  }

  public clearMarbles() {
    this.physics.clearMarbles();
    this._winner = null;
    this._winners = [];
    this._marbles = [];
  }

  public start() {
    this._isRunning = true;
    this._winnerRank = 0;
    if (this._winnerRank >= this._marbles.length) {
      this._winnerRank = this._marbles.length - 1;
    }
    this.physics.start();
    this._marbles.forEach((marble) => (marble.isActive = true));
  }

  public setSpeed(value: number) {
    if (value <= 0) {
      throw new Error('Speed multiplier must larger than 0');
    }
    this._speed = value;
  }

  public getSpeed() {
    return this._speed;
  }

  public setWinningRank(rank: number) {
    this._winnerRank = rank;
  }

  public setMarbles(names: string[]) {
    this.reset();
    const arr = names.slice();

    let maxWeight = -Infinity;
    let minWeight = Infinity;

    const members = arr
      .map((nameString) => {
        const result = parseName(nameString);
        if (!result) return null;
        const { name, weight, count } = result;
        if (weight > maxWeight) maxWeight = weight;
        if (weight < minWeight) minWeight = weight;
        return { name, weight, count };
      })
      .filter((member) => !!member);

    const gap = maxWeight - minWeight;

    let totalCount = 0;
    members.forEach((member) => {
      if (member) {
        member.weight = 0.1 + (gap ? (member.weight - minWeight) / gap : 0);
        totalCount += member.count;
      }
    });

    const orders = Array(totalCount)
      .fill(0)
      .map((_, i) => i)
      .sort(() => Math.random() - 0.5);
    members.forEach((member) => {
      if (member) {
        for (let j = 0; j < member.count; j++) {
          const order = orders.pop() || 0;
          this._marbles.push(
            new Marble(
              this.physics,
              order,
              totalCount,
              member.name,
              member.weight,
            ),
          );
        }
      }
    });
    this._totalMarbleCount = totalCount;
  }

  private _clearMap() {
    this.physics.clear();
    this._marbles = [];
  }

  public reset() {
    this.clearMarbles();
    this._clearMap();
    this._loadMap();
    this._goalDist = Infinity;
  }

  public getCount() {
    return this._marbles.length;
  }

  private _changeShakeAvailable(v: boolean) {
    this._shakeAvailable = v;
  }

  public shake() {
    if (!this._shakeAvailable) return;
  }

  public getMaps() {
    return stages.map((stage, index) => {
      return {
        index,
        title: stage.title,
      };
    });
  }

  public setMap(index: number) {
    if (index < 0 || index > stages.length - 1) {
      throw new Error('Incorrect map number');
    }
    const names = this._marbles.map((marble) => marble.name);
    this._stage = stages[index];
    this.setMarbles(names);
  }

  // 게임 상태 직렬화를 위한 메서드
  public getGameState() {
    return {
      marbles: this._marbles.map(marble => marble.toJSON()),
      winners: this._winners.map(marble => marble.toJSON()),
      winner: this._winner ? this._winner.toJSON() : null,
      entities: this.physics.getEntities(),
      isRunning: this._isRunning,
      winnerRank: this._winnerRank,
      totalMarbleCount: this._totalMarbleCount,
      shakeAvailable: this._shakeAvailable,
    };
  }
}