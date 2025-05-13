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

  // Getter for current map index
  get currentMapIndex(): number {
    if (!this._stage) return -1; // Or throw an error if stage should always exist
    return stages.findIndex(stage => stage === this._stage);
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
        // 승자 결정 및 게임 종료 로직 개선
        if (this._isRunning) {
          // 1. 일반적인 순위로 승자 결정 (0-indexed _winnerRank)
          if (this._winnerRank < this._totalMarbleCount - 1 && this._winners.length === this._winnerRank + 1) {
            this._winner = marble; // 현재 골인한 마블이 승자
            this._isRunning = false;
          }
          // 2. 꼴등이 승자이고, 마지막 한 명 빼고 모두 골인한 경우
          else if (this._winnerRank === this._totalMarbleCount - 1 && this._winners.length === this._totalMarbleCount - 1) {
            // 이때 필드에 남아있는 마블이 승자가 되어야 함.
            // _marbles 배열에는 골인하지 않은 마블만 남아있고, 이 시점에서는 단 하나만 있어야 함.
            if (this._marbles.length === 1 && this._marbles[0].id !== marble.id) { // 현재 골인한 마블이 아닌, 필드에 남은 마블
              this._winner = this._marbles[0];
            } else if (this._marbles.length === 0 && i < this._totalMarbleCount -1) { 
              // 이 경우는 모든 마블이 골인했고, 마지막으로 골인한 마블이 꼴등 승자가 아닐 때 발생 가능성 희박
              // 하지만 방어적으로, 만약 _marbles[i+1]이 있었다면 그것이 승자였을 것.
              // 이 시나리오에서는 현재 골인한 marble이 꼴등이 아닐 수 있으므로,
              // _winner는 설정하지 않고, getFinalRankingForAllMarbles에서 처리하도록 유도할 수 있음.
              // 또는, 이전에 _marbles에 남아있던 마지막 마블을 _winner로 지정해야 함.
              // 여기서는 _updateMarbles가 호출되기 직전의 _marbles 상태를 알 수 없으므로,
              // _winner를 명확히 지정하기 어려울 수 있음.
              // 가장 안전한 방법은, 꼴등 승자 조건에서 (N-1)명이 골인하면, 남아있는 1명을 _winner로 지정하는 것.
              // 이 로직은 _winners.push(marble) 이후, _marbles 필터링 전에 수행되어야 함.
              // 아래에서 _marbles 필터링 후, 만약 _isRunning이 여전히 true이고 조건 만족 시 _winner 설정
            }
             // this._isRunning = false; // 게임 종료는 아래에서 일괄 처리
          }
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

    // 골인한 마블을 _marbles 배열에서 제거
    this._marbles = this._marbles.filter((m) => !this._winners.find(w => w.id === m.id));

    // 꼴등 승자 결정 로직 (모든 다른 마블이 골인한 후)
    if (this._isRunning && this._winnerRank === this._totalMarbleCount - 1 && this._winners.length === this._totalMarbleCount - 1) {
      if (this._marbles.length === 1) { // 필드에 정확히 한 명 남았을 때
        this._winner = this._marbles[0]; // 남은 한 명이 승자
        this._isRunning = false;
      } else if (this._marbles.length === 0 && this._winners.length === this._totalMarbleCount) {
        // 모든 마블이 골인했고, 꼴등이 승자인 경우 (이 경우는 일반 순위 승자 결정 로직에서 이미 처리되었을 수 있음)
        // 마지막으로 골인한 마블이 _winnerRank(0-indexed)와 일치하는지 확인
        if (this._winners[this._winnerRank] && this._winnerRank === this._totalMarbleCount -1) {
            this._winner = this._winners[this._winnerRank];
            this._isRunning = false;
        }
      }
    }
    
    // 모든 마블이 골인한 경우 게임 종료 (승자 조건과 관계없이)
    if (this._isRunning && this._winners.length === this._totalMarbleCount) {
        this._isRunning = false;
        // 이때 _winner가 설정 안됐으면, _winnerRank에 해당하는 마블을 승자로.
        if (!this._winner && this._winners[this._winnerRank]) {
            this._winner = this._winners[this._winnerRank];
        }
    }
  }

  private _calcTimeScale(): number {
    if (!this._stage) return 1;
    // _winnerRank가 0-indexed이므로, 실제 비교 대상 순위는 _winnerRank + 1
    const targetDisplayRank = this._winnerRank + 1; 
    if (this._winners.length < targetDisplayRank && this._marbles.length > 0) {
      // 아직 목표 순위의 마블이 골인하지 않았고, 필드에 마블이 남아있을 때
      // _marbles 배열은 y좌표로 정렬되어 있으므로, 0번째 인덱스가 가장 선두.
      // 목표 순위의 마블이 현재 몇 번째 선두인지 계산 (골인한 마블 수 제외)
      const remainingTargetRank = targetDisplayRank - this._winners.length -1;
      if (remainingTargetRank >= 0 && remainingTargetRank < this._marbles.length) {
        const targetMarbleForZoom = this._marbles[remainingTargetRank];
        if (targetMarbleForZoom) {
            const distToZoomY = Math.abs(this._stage.zoomY - targetMarbleForZoom.y);
            if (distToZoomY < zoomThreshold && targetMarbleForZoom.y > this._stage.zoomY - zoomThreshold * 1.2) {
                 // 선두 그룹의 다른 마블도 고려 (옵션)
                return Math.max(0.2, distToZoomY / zoomThreshold);
            }
        }
      }
    }
    return 1;
  }

  public update() {
    if (!this.isReady || !this._isRunning) return; // 준비 안됐거나, 게임 종료 시 업데이트 중단
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
    this.physics.clearMarbles();
    this._winner = null;
    this._winners = [];
    this._marbles = [];
  }

  public start() {
    this._isRunning = true;
    // this._winnerRank = 0;
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
    console.log(this._winnerRank);
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
          this._marbles.push(new Marble(this.physics, order, totalCount, member.name, member.weight));
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
      marbles: this._marbles.map((marble) => marble.toJSON()),
      winners: this._winners.map((marble) => marble.toJSON()),
      winner: this._winner ? this._winner.toJSON() : null,
      entities: this.physics.getEntities(),
      isRunning: this._isRunning,
      winnerRank: this._winnerRank,
      totalMarbleCount: this._totalMarbleCount,
      shakeAvailable: this._shakeAvailable,
    };
  }

  // 게임 종료 후 모든 마블의 최종 순위를 반환하는 메서드
  public getFinalRankingForAllMarbles(): Array<{ name: string; finalRank: number | string; yPos: number; isWinnerGoal: boolean }> {
    const rankedMarbles: Array<{ name: string; finalRank: number | string; yPos: number; isWinnerGoal: boolean }> = [];

    // 1. 골인한 마블들 (winners 배열에 골인 순서대로 저장되어 있음)
    this._winners.forEach((marble, index) => {
      rankedMarbles.push({
        name: marble.name,
        finalRank: index + 1, // 골인 순위 (1-based for display)
        yPos: marble.y, // 실제 y 위치 (참고용)
        // _winner가 설정되어 있으면 그것을 우선으로, 아니면 기존 로직 (0-based index와 0-based _winnerRank 비교)
        isWinnerGoal: this._winner ? this._winner.id === marble.id : index === this._winnerRank,
      });
    });

    // 2. 골인하지 못한 마블들 (marbles 배열에 남아있고, y좌표로 정렬되어 있음)
    const goalCount = this._winners.length;
    this._marbles
      .slice() // 원본 배열 변경 방지를 위해 복사본 사용
      .sort((a, b) => b.y - a.y) // y좌표 내림차순 정렬 (높은 y가 먼저)
      .forEach((marble, index) => {
        // _winner가 설정되어 있고, 그 _winner가 현재 골인 못한 마블 중 하나라면 true
        const isThisNonGoaledMarbleTheWinner = this._winner ? this._winner.id === marble.id : false;
        
        rankedMarbles.push({
          name: marble.name,
          finalRank: goalCount + index + 1, // 골인한 마블 다음 순위부터
          yPos: marble.y,
          isWinnerGoal: isThisNonGoaledMarbleTheWinner,
        });
      });
    
    // 만약 rankedMarbles에 _winner로 지정된 마블이 있는데 isWinnerGoal이 false이면, 여기서 true로 설정
    if (this._winner) {
        const winnerInRankedList = rankedMarbles.find(r => r.name === this._winner!.name);
        if (winnerInRankedList && !winnerInRankedList.isWinnerGoal) {
            winnerInRankedList.isWinnerGoal = true;
            // 다른 마블들은 false로 설정 (단일 승자 원칙)
            rankedMarbles.forEach(r => {
                if (r.name !== this._winner!.name) {
                    r.isWinnerGoal = false;
                }
            });
        } else if (!winnerInRankedList) {
            // _winner가 rankedMarbles에 없는 극히 예외적인 경우 (이론상 발생 안해야함)
            // 이 경우 _winner 정보를 바탕으로 rankedMarbles에 추가하고 isWinnerGoal을 true로 설정.
            // 순위는 _winnerRank (0-인덱스) + 1 또는 상황에 따라 결정.
            // 예: 꼴등 승자인데 골인 안한 경우, 마지막 순위 부여.
            let rankForWinner = this._winnerRank + 1;
            if (this._winnerRank === this._totalMarbleCount -1 && !this._winners.find(w => w.id === this._winner!.id)) {
                rankForWinner = this._totalMarbleCount;
            }
             rankedMarbles.push({
                name: this._winner.name,
                finalRank: rankForWinner,
                yPos: this._winner.y,
                isWinnerGoal: true,
             });
             // 다른 마블들은 false로 설정
             rankedMarbles.forEach(r => {
                if (r.name !== this._winner!.name) {
                    r.isWinnerGoal = false;
                }
            });
             // 순서 재정렬 필요할 수 있음
            rankedMarbles.sort((a,b) => {
                const rankA = typeof a.finalRank === 'number' ? a.finalRank : Infinity;
                const rankB = typeof b.finalRank === 'number' ? b.finalRank : Infinity;
                return rankA - rankB;
            });
        }
    }


    // 최종적으로 rankedMarbles에 있는 모든 마블에 대해,
    // isWinnerGoal이 true인 마블이 정확히 _winnerRank에 해당하는지,
    // 또는 _winner 객체와 일치하는지 확인하고 조정하는 로직이 필요할 수 있음.
    // 특히, _winnerRank가 'last'일 때의 처리를 명확히 해야 함.
    // 현재 _winnerRank는 0-indexed 숫자. (totalMarbleCount - 1)이 꼴등.

    return rankedMarbles;
  }
}
