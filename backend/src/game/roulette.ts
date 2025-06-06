import { Marble } from './marble';
import { IPhysics } from './IPhysics';
import { Box2dPhysics } from './physics/physics-box2d';
import { MapEntityState } from './types/MapEntity.type';
import { SkillEffect } from './types/skill-effect.type';
import { MarbleManager } from './managers/marble.manager';
import { GameStateManager } from './managers/game-state.manager';
import { SkillManager } from './managers/skill.manager';
import { MapManager } from './managers/map.manager';

export class Roulette {
  private _lastTime: number = 0;
  private _elapsed: number = 0;
  private _noMoveDuration: number = 0;
  private _updateInterval = 10;
  private activeTimeouts: NodeJS.Timeout[] = [];

  private physics!: IPhysics;
  private marbleManager!: MarbleManager;
  private gameStateManager!: GameStateManager;
  private skillManager!: SkillManager;
  private mapManager!: MapManager;

  get isReady() {
    return !!(this.physics && (this.physics as any).world && (this.physics as any).initialized);
  }

  get currentMapIndex(): number {
    return this.mapManager.currentMapIndex;
  }

  private constructor() {}

  public static async createInstance(): Promise<Roulette> {
    const roulette = new Roulette();
    await roulette._init();
    return roulette;
  }

  private async _init() {
    this.physics = new Box2dPhysics();
    await this.physics.init();
    this.marbleManager = new MarbleManager(this.physics);
    this.gameStateManager = new GameStateManager(this.marbleManager);
    this.skillManager = new SkillManager();
    this.mapManager = new MapManager(this.physics);
  }

  public update() {
    if (!this.isReady || !this.gameStateManager.isRunning) {
      return;
    }
    if (!this._lastTime) this._lastTime = Date.now();
    const currentTime = Date.now();

    this._elapsed += (currentTime - this._lastTime) * this.gameStateManager.speed;
    if (this._elapsed > 100) {
      this._elapsed %= 100;
    }
    this._lastTime = currentTime;

    const interval = (this._updateInterval / 1000) * this.gameStateManager.timeScale;

    while (this._elapsed >= this._updateInterval) {
      this.physics.step(interval);
      this._updateMarbles(this._updateInterval);
      this._elapsed -= this._updateInterval;
    }

    this.gameStateManager.updateShakeAvailability(this._noMoveDuration);
  }

  private _updateMarbles(deltaTime: number) {
    if (!this.mapManager.stage) return;

    this.marbleManager.allMarbles.forEach((marble) => marble.update(deltaTime));

    this._handleMarbleGoal();
    this._cleanupFinishedMarbles();
    this.marbleManager.updateMarblesForNewFrame();
    this.gameStateManager.updateTimeScale(this.mapManager.stage);
    this.gameStateManager.checkForWinner();
  }

  private _handleMarbleGoal() {
    if (!this.mapManager.stage) return;

    for (const marble of this.marbleManager.allMarbles) {
      if (marble.y > this.mapManager.stage.goalY) {
        this.marbleManager.addWinner(marble);
      }
    }
  }

  private _cleanupFinishedMarbles() {
    const goalY = this.mapManager.stage?.goalY ?? Infinity;
    const marblesToRemove = this.marbleManager.allMarbles.filter((m) => m.y > goalY);

    marblesToRemove.forEach((marble) => {
      const timeoutId = setTimeout(() => {
        this.activeTimeouts = this.activeTimeouts.filter((id) => id !== timeoutId);
        if (this.physics) {
          this.marbleManager.removeMarbleFromPhysics(marble.id);
          if (marble.isDummy) {
            this.marbleManager.removeDummyMarble(marble.id);
          }
        }
      }, 500);
      this.activeTimeouts.push(timeoutId);
    });
  }

  public start() {
    this.gameStateManager.start(this.marbleManager.totalMarbleCount);
    this.physics.start();
    this.marbleManager.allMarbles.forEach((marble) => (marble.isActive = true));
  }

  public setSpeed(value: number) {
    this.gameStateManager.setSpeed(value);
  }

  public getSpeed() {
    return this.gameStateManager.speed;
  }

  public setWinningRank(rank: number) {
    this.gameStateManager.setWinningRank(rank);
  }

  public setMarbles(names: string[]) {
    this.reset();
    this.marbleManager.setMarbles(names);
  }

  public applyImpact(position: { x: number; y: number }, radius: number, force: number): void {
    this.physics.applyRadialImpulse(position, radius, force);
  }

  public createDummyMarbles(position: { x: number; y: number }, count: number, userNickname: string): void {
    this.marbleManager.createDummyMarbles(position, count, userNickname);
  }

  public addSkillEffect(effectData: Omit<SkillEffect, 'id' | 'timestamp'>): void {
    this.skillManager.addSkillEffect(effectData);
  }

  public reset() {
    this.marbleManager.clearAllMarbles();
    this.mapManager.loadMap();
    this.gameStateManager.reset();
    this.skillManager.reset();
  }

  public getCount() {
    return this.marbleManager.marbles.length;
  }

  public shake() {
    if (!this.gameStateManager.shakeAvailable) return;
  }

  public getMaps() {
    return this.mapManager.getMaps();
  }

  public setMap(index: number) {
    const names = this.marbleManager.marbles.map((marble) => marble.name);
    this.mapManager.setMap(index);
    this.setMarbles(names);
  }

  public getGameState() {
    return {
      marbles: this.marbleManager.allMarbles.map((marble) => marble.toJSON()),
      winners: this.marbleManager.winners.map((marble) => marble.toJSON()),
      winner: this.gameStateManager.winner ? this.gameStateManager.winner.toJSON() : null,
      entities: this.physics.getEntities(),
      isRunning: this.gameStateManager.isRunning,
      winnerRank: this.gameStateManager.winnerRank,
      totalMarbleCount: this.marbleManager.totalMarbleCount,
      shakeAvailable: this.gameStateManager.shakeAvailable,
      skillEffects: this.skillManager.clearSkillEffects(),
    };
  }

  public getFinalRankingForAllMarbles() {
    return this.gameStateManager.finalizeWinner();
  }

  public destroy(): void {
    this.activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.activeTimeouts = [];

    if (this.physics) {
      this.physics.destroy();
    }
    this.marbleManager.clearAllMarbles();
    this.skillManager.reset();
  }
}
