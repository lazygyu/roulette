import { Marble } from './marble';
import { Skills, zoomThreshold } from './data/constants';
import { StageDef, stages } from './data/maps';
import { IPhysics } from './IPhysics';
import { Box2dPhysics } from './physics/physics-box2d';
import { MarbleFactory } from './utils/marble-factory';
import { MapEntityState } from './types/MapEntity.type'; // getGameState에서 사용
import { SkillEffect } from './types/skill-effect.type'; // SkillEffect 임포트
import { v4 as uuidv4 } from 'uuid'; // uuidv4 임포트

export class Roulette {
  private _marbles: Marble[] = []; // 일반 마블
  private _dummyMarbles: Marble[] = []; // 더미 마블

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
  private _skillEffects: SkillEffect[] = [];
  private activeTimeouts: NodeJS.Timeout[] = []; // setTimeout ID 저장을 위한 배열

  private physics!: IPhysics; // Box2dPhysics 인스턴스가 할당됨

  // _isReady 플래그는 createInstance 완료 시 항상 true이므로, Box2dPhysics의 상태를 확인하는 방식으로 변경
  get isReady() {
    // Box2dPhysics의 world 객체가 생성되었는지 여부로 판단 (init 완료 시 생성됨)
    return !!(this.physics && (this.physics as any).world && (this.physics as any).initialized);
  }

  // Getter for all marbles (regular and dummy) for physics updates, rendering, etc.
  private get _allMarbles(): Marble[] {
    return [...this._marbles, ...this._dummyMarbles];
  }

  // Getter for current map index
  get currentMapIndex(): number {
    if (!this._stage) return -1; // Or throw an error if stage should always exist
    return stages.findIndex((stage) => stage === this._stage);
  }

  // 생성자를 private으로 변경하여 외부 직접 생성을 막고 createInstance를 통하도록 강제
  private constructor() {
    // 초기화 로직은 _init으로 이동하고, createInstance에서 호출
  }

  public static async createInstance(): Promise<Roulette> {
    const roulette = new Roulette(); // private 생성자 호출
    await roulette._init(); // 비동기 초기화 완료 대기
    return roulette;
  }

  private async _init() {
    this.physics = new Box2dPhysics();
    await this.physics.init(); // 물리 엔진 초기화 대기
    this._stage = stages[0]; // 기본 맵 설정
    this._loadMap(); // 맵 로드 (물리 엔진 초기화 후)
  }

  private _updateMarbles(deltaTime: number) {
    if (!this._stage) return;

    this._allMarbles.forEach((marble) => marble.update(deltaTime));

    this._handleMarbleGoal();
    this._cleanupFinishedMarbles();
    this._updateMarblePositionsAndSort();
    this._updateZoomAndTimescale();
    this._checkForWinner();
  }

  private _handleMarbleGoal() {
    if (!this._stage) return;

    for (let i = this._allMarbles.length - 1; i >= 0; i--) {
      const marble = this._allMarbles[i];
      if (marble.y > this._stage.goalY) {
        if (!marble.isDummy && !this._winners.find((w) => w.id === marble.id)) {
          this._winners.push(marble);
        }
        // 물리 엔진에서 즉시 제거하지 않고, 별도 로직으로 처리
      }
    }
  }

  private _cleanupFinishedMarbles() {
    const goalY = this._stage?.goalY ?? Infinity;
    const marblesToRemove = this._allMarbles.filter((m) => m.y > goalY);

    marblesToRemove.forEach((marble) => {
      const timeoutId = setTimeout(() => {
        this.activeTimeouts = this.activeTimeouts.filter((id) => id !== timeoutId);
        if (this.physics) {
          this.physics.removeMarble(marble.id);
          if (marble.isDummy) {
            this._dummyMarbles = this._dummyMarbles.filter((dm) => dm.id !== marble.id);
          } else {
            // _marbles 배열에서는 이미 _updateMarblePositionsAndSort에서 처리됨
          }
        }
      }, 500);
      this.activeTimeouts.push(timeoutId);
    });
  }

  private _updateMarblePositionsAndSort() {
    // 골인한 일반 마블을 제외한 배열을 새로 만듦
    this._marbles = this._marbles.filter((m) => !this._winners.find((w) => w.id === m.id));

    // 남은 일반 마블 정렬
    if (this._marbles.length > 1) {
      this._marbles.sort((a, b) => b.y - a.y);
    }
  }

  private _updateZoomAndTimescale() {
    if (!this._stage) return;

    const activeMarbles = this._marbles; // 이미 골인한 마블은 제외됨
    if (activeMarbles.length > 0) {
      const targetIndex = Math.max(0, this._winnerRank - this._winners.length);
      const topY = activeMarbles[targetIndex] ? activeMarbles[targetIndex].y : 0;
      this._goalDist = Math.abs(this._stage.zoomY - topY);
      this._timeScale = this._calcTimeScale(activeMarbles);
    } else {
      this._goalDist = 0;
      this._timeScale = 1;
    }
  }

  private _checkForWinner() {
    if (!this._isRunning) return;

    const isLastPlaceWinner = this._winnerRank === this._totalMarbleCount - 1;

    // 1. 일반 순위 승자 결정
    if (!isLastPlaceWinner && this._winners.length === this._winnerRank + 1) {
      this._winner = this._winners[this._winnerRank];
      this._isRunning = false;
      return;
    }

    // 2. 꼴등 승자 결정
    if (isLastPlaceWinner && this._winners.length === this._totalMarbleCount - 1) {
      if (this._marbles.length === 1) {
        this._winner = this._marbles[0]; // 남은 마지막 1명이 승자
        this._isRunning = false;
        return;
      }
    }

    // 3. 모든 일반 마블이 골인한 경우
    if (this._winners.length === this._totalMarbleCount && this._totalMarbleCount > 0) {
      this._isRunning = false;
      if (!this._winner && this._winners[this._winnerRank]) {
        this._winner = this._winners[this._winnerRank];
      }
    }
  }

  private _calcTimeScale(currentMarbles: Marble[]): number {
    // 현재 필드 위의 '일반' 마블들을 받도록 수정
    if (!this._stage) return 1;
    const targetDisplayRank = this._winnerRank + 1;
    if (this._winners.length < targetDisplayRank && currentMarbles.length > 0) {
      const remainingTargetRank = targetDisplayRank - this._winners.length - 1;
      if (remainingTargetRank >= 0 && remainingTargetRank < currentMarbles.length) {
        const targetMarbleForZoom = currentMarbles[remainingTargetRank];
        if (targetMarbleForZoom) {
          const distToZoomY = Math.abs(this._stage.zoomY - targetMarbleForZoom.y);
          if (distToZoomY < zoomThreshold && targetMarbleForZoom.y > this._stage.zoomY - zoomThreshold * 1.2) {
            return Math.max(0.2, distToZoomY / zoomThreshold);
          }
        }
      }
    }
    return 1;
  }

  public update() {
    if (!this.isReady || !this._isRunning) {
      return;
    }
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

    // 쉐이크 가능 여부는 일반 마블 기준으로 판단
    if (this._isRunning && this._marbles.length > 0 && this._noMoveDuration > 3000) {
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
    this.physics.clearMarbles(); // 모든 마블 (물리 객체) 제거
    this._winner = null;
    this._winners = [];
    this._marbles = []; // 일반 마블 배열 초기화
    this._dummyMarbles = []; // 더미 마블 배열 초기화
  }

  public start() {
    this._isRunning = true;
    if (this._winnerRank >= this._marbles.length && this._marbles.length > 0) {
      // 일반 마블 기준으로
      this._winnerRank = this._marbles.length - 1;
    } else if (this._marbles.length === 0) {
      this._winnerRank = 0; // 마블이 없으면 0등
    }
    this.physics.start(); // 물리 엔진 내 모든 마블 활성화 (Box2DPhysics의 start가 알아서 처리)
    this._allMarbles.forEach((marble) => (marble.isActive = true)); // 모든 Marble 객체 활성화
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
    const { marbles, totalMarbleCount } = MarbleFactory.createMarbles(this.physics, names);
    this._marbles = marbles;
    this._totalMarbleCount = totalMarbleCount;
  }

  public applyImpact(position: { x: number; y: number }, radius: number, force: number): void {
    this.physics.applyRadialImpulse(position, radius, force); // 모든 마블에 영향
  }

  public createDummyMarbles(position: { x: number; y: number }, count: number, userNickname: string): void {
    // ID 충돌을 피하기 위해 현재 모든 마블(일반+더미)의 최대 ID를 찾음
    const currentMaxId = this._allMarbles.reduce((maxId, marble) => Math.max(maxId, marble.id), -1);

    for (let i = 0; i < count; i++) {
      const newId = currentMaxId + 1 + i; // 고유 ID 생성
      const dummyName = `${userNickname}-${i + 1}`;
      // 더미 마블 생성 시 isDummy=true, 초기 속도 전달
      const dummyMarble = new Marble(this.physics, newId, 0, dummyName, 1, true); // max는 0 또는 의미 없는 값 전달

      // 스킬 위치 근처에 생성 (약간의 랜덤 오프셋 추가)
      const offsetX = (Math.random() - 0.5) * 1; // 오프셋 범위 약간 증가
      const offsetY = (Math.random() - 0.5) * 1;

      // physics.createMarble 호출 시 isDummy와 초기 속도 전달
      this.physics.createMarble(newId, position.x + offsetX, position.y + offsetY, true, { x: 0, y: 10 }); // y: 10은 아래로 향하는 힘 (조정 가능)
      this._dummyMarbles.push(dummyMarble);
    }
    // this._totalMarbleCount는 더미 마블로 인해 변경되지 않음
  }

  public addSkillEffect(effectData: Omit<SkillEffect, 'id' | 'timestamp'>): void {
    const newEffect: SkillEffect = {
      ...effectData,
      id: uuidv4(), // UUID 생성
      timestamp: Date.now(),
    } as SkillEffect; // 타입 단언
    this._skillEffects.push(newEffect);
  }

  private _clearMap() {
    this.physics.clear(); // 물리 엔진의 모든 객체(맵 요소, 마블) 제거
    this._marbles = []; // 일반 마블 배열 초기화
    this._dummyMarbles = []; // 더미 마블 배열 초기화
  }

  public reset() {
    this.clearMarbles(); // _marbles, _dummyMarbles 비우고 물리 객체도 제거
    // this._clearMap(); // clearMarbles에서 이미 physics.clearMarbles() 호출, 여기서는 맵 요소만 다시 로드
    this.physics.clearEntities(); // 맵 요소만 제거
    this._loadMap(); // 맵 다시 로드
    this._goalDist = Infinity;
    this._isRunning = false; // 게임 상태도 리셋
    this._winner = null;
    this._winners = [];
    // _totalMarbleCount는 setMarbles에서 재설정되므로 여기서는 불필요
  }

  public getCount() {
    return this._marbles.length; // 일반 마블 수만 반환
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
    // 현재 '일반' 마블들의 이름만 가져와서 재설정
    const names = this._marbles.map((marble) => marble.name);
    this._stage = stages[index];
    this.setMarbles(names); // 내부에서 reset 호출됨, 더미 마블도 비워짐
  }

  // 게임 상태 직렬화를 위한 메서드
  public getGameState() {
    const result = {
      // 일반 마블과 더미 마블 모두 클라이언트에 전달 (렌더링 목적)
      marbles: this._allMarbles.map((marble) => marble.toJSON()),
      winners: this._winners.map((marble) => marble.toJSON()), // 일반 마블 중에서만
      winner: this._winner ? this._winner.toJSON() : null, // 일반 마블 중에서만
      entities: this.physics.getEntities(),
      isRunning: this._isRunning,
      winnerRank: this._winnerRank,
      totalMarbleCount: this._totalMarbleCount, // 일반 마블 수
      shakeAvailable: this._shakeAvailable,
      skillEffects: [...this._skillEffects], // 현재 이펙트 목록 복사본 전달
    };
    this._skillEffects = []; // 전달 후 이펙트 목록 초기화
    return result;
  }

  // 게임 종료 후 '일반' 마블의 최종 순위를 반환하는 메서드
  public getFinalRankingForAllMarbles(): Array<{
    name: string;
    finalRank: number | string;
    yPos: number;
    isWinnerGoal: boolean;
  }> {
    const rankedMarbles: Array<{ name: string; finalRank: number | string; yPos: number; isWinnerGoal: boolean }> = [];

    // 1. 골인한 '일반' 마블들 (_winners 배열 사용)
    this._winners.forEach((marble, index) => {
      // isDummy 체크는 불필요 (_winners는 일반 마블만 포함)
      rankedMarbles.push({
        name: marble.name,
        finalRank: index + 1,
        yPos: marble.y,
        isWinnerGoal: this._winner ? this._winner.id === marble.id : index === this._winnerRank,
      });
    });

    // 2. 골인하지 못한 '일반' 마블들 (_marbles 배열 사용)
    const goalCount = this._winners.length;
    this._marbles // 현재 _marbles는 골인 안 한 일반 마블만 있음
      .slice()
      .sort((a, b) => b.y - a.y)
      .forEach((marble, index) => {
        // isDummy 체크는 불필요
        const isThisNonGoaledMarbleTheWinner = this._winner ? this._winner.id === marble.id : false;
        rankedMarbles.push({
          name: marble.name,
          finalRank: goalCount + index + 1,
          yPos: marble.y,
          isWinnerGoal: isThisNonGoaledMarbleTheWinner,
        });
      });

    if (this._winner) {
      const winnerInRankedList = rankedMarbles.find((r) => r.name === this._winner!.name);
      if (winnerInRankedList && !winnerInRankedList.isWinnerGoal) {
        winnerInRankedList.isWinnerGoal = true;
        rankedMarbles.forEach((r) => {
          if (r.name !== this._winner!.name) {
            r.isWinnerGoal = false;
          }
        });
      } else if (!winnerInRankedList && !this._winner.isDummy) {
        // 더미가 아닌 승자인데 목록에 없다면 추가
        let rankForWinner = this._winnerRank + 1;
        if (this._winnerRank === this._totalMarbleCount - 1 && !this._winners.find((w) => w.id === this._winner!.id)) {
          rankForWinner = this._totalMarbleCount;
        }
        rankedMarbles.push({
          name: this._winner.name,
          finalRank: rankForWinner,
          yPos: this._winner.y,
          isWinnerGoal: true,
        });
        rankedMarbles.forEach((r) => {
          if (r.name !== this._winner!.name) {
            r.isWinnerGoal = false;
          }
        });
        rankedMarbles.sort((a, b) => {
          const rankA = typeof a.finalRank === 'number' ? a.finalRank : Infinity;
          const rankB = typeof b.finalRank === 'number' ? b.finalRank : Infinity;
          return rankA - rankB;
        });
      }
    }
    // 더미 마블은 순위 리스트에 포함하지 않음
    return rankedMarbles;
  }

  public destroy(): void {
    // Clear all active timeouts
    this.activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.activeTimeouts = [];

    if (this.physics) {
      this.physics.destroy();
      // @ts-ignore
      this.physics = null;
    }
    this._marbles = [];
    this._dummyMarbles = [];
    this._winners = [];
    // @ts-ignore
    this._winner = null;
    // @ts-ignore
    this._stage = null;
    this._skillEffects = [];
  }
}
