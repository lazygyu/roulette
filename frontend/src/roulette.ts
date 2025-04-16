import { Marble } from './marble';
import { initialZoom, Skills, zoomThreshold } from './data/constants';
import { ParticleManager } from './particleManager';
import { StageDef } from './types/GameTypes';
import { parseName } from './utils/utils';
import { Camera } from './camera';
import { RouletteRenderer } from './rouletteRenderer';
import { SkillEffect } from './skillEffect';
import { GameObject } from './gameObject';
import options from './options';
import { bound } from './utils/bound.decorator';
import { UIObject } from './UIObject';
import { RankRenderer } from './rankRenderer';
import { Minimap } from './minimap';
import { VideoRecorder } from './utils/videoRecorder';
import { GameSocketService } from './services/GameSocketService';
import { GameState, GameStatus, MarbleState } from './types/GameTypes';

export class Roulette extends EventTarget {
  private _marbles: Marble[] = [];

  private _lastTime: number = 0;
  private _elapsed: number = 0;
  private _noMoveDuration: number = 0;
  private _shakeAvailable: boolean = false;

  private _updateInterval = 10;
  private _timeScale = 1;
  private _speed = 1;

  private _winners: Marble[] = [];
  private _particleManager = new ParticleManager();
  private _stage: StageDef | null = null;

  private _camera: Camera = new Camera();
  private _renderer: RouletteRenderer = new RouletteRenderer();

  private _effects: GameObject[] = [];

  private _winnerRank = 0;
  private _totalMarbleCount = 0;
  private _goalDist: number = Infinity;
  private _isRunning: boolean = false;
  private _winner: Marble | null = null;

  private _uiObjects: UIObject[] = [];

  private _autoRecording: boolean = false;
  private _recorder!: VideoRecorder;

  // 게임 소켓 서비스
  private socketService: GameSocketService;
  // 현재 방 ID
  private roomId: number = 1; // 기본값, 실제로는 방에 입장할 때 설정
  // 게임 상태
  private gameState: GameState | null = null;

  private _isReady: boolean = false;
  get isReady() {
    return this._isReady;
  }

  constructor() {
    super();
    this.socketService = new GameSocketService();
    this._setupSocketListeners();
    
    this._renderer.init().then(() => {
      this._init().then(() => {
        this._isReady = true;
        this._update();
      });
    });
  }

  private _setupSocketListeners() {
    // 게임 상태 업데이트 리스너
    this.socketService.onGameStateUpdated((state) => {
      this.gameState = state;
      this._updateFromGameState(state);
    });

    // 게임 종료 리스너
    this.socketService.onGameFinished((data) => {
      if (data.winner) {
        this.dispatchEvent(
          new CustomEvent('goal', { detail: { winner: data.winner.name } })
        );
        this._isRunning = false;
        this._particleManager.shot(
          this._renderer.width,
          this._renderer.height
        );
        setTimeout(() => {
          this._recorder.stop();
        }, 1000);
      }
    });

    // 에러 리스너
    this.socketService.onError((error) => {
      console.error('Game socket error:', error);
    });
  }

  // 게임 상태에서 필요한 정보를 추출하여 UI를 업데이트
  private _updateFromGameState(state: GameState) {
    if (!state) return;

    // 스테이지 업데이트
    if (state.stage && (!this._stage || this._stage.title !== state.stage.title)) {
      this._stage = state.stage;
    }

    // 마블 업데이트
    this._updateMarbleObjects(state.marbles);
    
    // 승자 업데이트
    this._updateWinners(state.winners);
    
    // 게임 상태 업데이트
    this._isRunning = state.status === GameStatus.RUNNING;
    this._winnerRank = state.winnerRank;
    
    // 승자가 있으면 업데이트
    if (state.winner) {
      const winnerMarble = this._marbles.find(m => m.id === state.winner?.id);
      if (winnerMarble) {
        this._winner = winnerMarble;
      }
    }
  }

  // 마블 객체들 업데이트
  private _updateMarbleObjects(marbleStates: MarbleState[]) {
    // 기존 마블과 새 마블을 ID로 매핑
    const existingMarblesMap = new Map<number, Marble>();
    this._marbles.forEach(m => existingMarblesMap.set(m.id, m));
    
    const newMarbles: Marble[] = [];
    
    marbleStates.forEach(marbleState => {
      // 기존 마블이 있으면 위치만 업데이트
      if (existingMarblesMap.has(marbleState.id)) {
        const marble = existingMarblesMap.get(marbleState.id)!;
        marble.updateFromState(marbleState);
        newMarbles.push(marble);
      } else {
        // 새 마블 생성
        const marble = Marble.fromState(marbleState);
        newMarbles.push(marble);
      }
    });
    
    // 마블 목록 업데이트
    this._marbles = newMarbles;
    
    // 마블 정렬 (y 좌표 기준 내림차순)
    if (this._marbles.length > 1) {
      this._marbles.sort((a, b) => b.y - a.y);
    }
    
    // 총 마블 개수 업데이트
    this._totalMarbleCount = marbleStates.length + (this.gameState?.winners?.length || 0);
  }

  // 승자 목록 업데이트
  private _updateWinners(winnerStates: MarbleState[]) {
    const newWinners: Marble[] = [];
    
    winnerStates.forEach(winnerState => {
      // 마블 객체로 변환
      const marble = Marble.fromState(winnerState);
      newWinners.push(marble);
    });
    
    this._winners = newWinners;
  }

  public getZoom() {
    return initialZoom * this._camera.zoom;
  }

  private addUiObject(obj: UIObject) {
    this._uiObjects.push(obj);
    if (obj.onWheel) {
      this._renderer.canvas.addEventListener('wheel', obj.onWheel);
    }
  }

  @bound
  private _update() {
    if (!this._lastTime) this._lastTime = Date.now();
    const currentTime = Date.now();

    this._elapsed += (currentTime - this._lastTime) * this._speed;
    if (this._elapsed > 100) {
      this._elapsed %= 100;
    }
    this._lastTime = currentTime;

    // UI 객체 업데이트
    while (this._elapsed >= this._updateInterval) {
      this._particleManager.update(this._updateInterval);
      this._updateEffects(this._updateInterval);
      this._elapsed -= this._updateInterval;
      this._uiObjects.forEach((obj) => obj.update(this._updateInterval));
    }

    // 카메라 업데이트
    if (this._stage) {
      this._camera.update({
        marbles: this._marbles,
        stage: this._stage,
        needToZoom: this._goalDist < zoomThreshold,
        targetIndex:
          this._winners.length > 0
            ? this._winnerRank - this._winners.length
            : 0,
      });

      // 흔들기 기능은 백엔드에서 처리하지만, UI 표시용으로 상태 업데이트
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

    // 렌더링
    this._render();
    window.requestAnimationFrame(this._update);
  }

  private _updateEffects(deltaTime: number) {
    this._effects.forEach((effect) => effect.update(deltaTime));
    this._effects = this._effects.filter((effect) => !effect.isDestroy);
  }

  private _render() {
    if (!this._stage) return;
    
    // 마블 상태 업데이트 중 스킬을 사용하는 경우 이펙트 추가
    this._marbles.forEach(marble => {
      if (marble.skill === Skills.Impact) {
        this._effects.push(new SkillEffect(marble.x, marble.y));
      }
    });
    
    // 렌더링 파라미터 설정
    const renderParams = {
      camera: this._camera,
      stage: this._stage,
      entities: this.gameState?.entities || [],
      marbles: this._marbles,
      winners: this._winners,
      particleManager: this._particleManager,
      effects: this._effects,
      winnerRank: this._winnerRank,
      winner: this._winner,
      size: { x: this._renderer.width, y: this._renderer.height },
    };
    
    // 렌더링 실행
    this._renderer.render(renderParams, this._uiObjects);
  }

  private async _init() {
    this._recorder = new VideoRecorder(this._renderer.canvas);

    // 소켓을 통해 게임 초기화
    try {
      // 서버에 연결하여 게임 초기화
      await this.socketService.initializeGame(this.roomId);
      
      // 맵 목록 요청
      await this.socketService.getMaps();
      
      // UI 컴포넌트 초기화
      this.addUiObject(new RankRenderer());
      this.attachEvent();
      
      const minimap = new Minimap();
      minimap.onViewportChange((pos) => {
        if (pos) {
          this._camera.setPosition(pos, false);
          this._camera.lock(true);
        } else {
          this._camera.lock(false);
        }
      });
      this.addUiObject(minimap);
      
      // 게임 상태 요청
      const gameState = await this.socketService.getGameState(this.roomId);
      this.gameState = gameState;
      
      if (gameState.stage) {
        this._stage = gameState.stage;
      }
      
      // 초기 게임 상태를 기반으로 UI 업데이트
      this._updateFromGameState(gameState);
      
    } catch (error) {
      console.error('Failed to initialize game:', error);
    }
  }

  private attachEvent() {
    this._renderer.canvas.addEventListener('mousemove', (e) => {
      const sizeFactor = this._renderer.sizeFactor;
      const pos = { x: e.offsetX * sizeFactor, y: e.offsetY * sizeFactor };
      this._uiObjects.forEach((obj) => {
        if (!obj.onMouseMove) return;
        const bounds = obj.getBoundingBox();
        if (!bounds) {
          obj.onMouseMove({ ...pos });
        } else if (
          bounds &&
          pos.x >= bounds.x &&
          pos.y >= bounds.y &&
          pos.x <= bounds.x + bounds.w &&
          pos.y <= bounds.y + bounds.h
        ) {
          obj.onMouseMove({ x: pos.x - bounds.x, y: pos.y - bounds.y });
        } else {
          obj.onMouseMove(undefined);
        }
      });
    });
  }

  public clearMarbles() {
    // 백엔드에 마블 제거 요청
    this.reset();
  }

  public start() {
    // 백엔드에 게임 시작 요청
    this.socketService.startGame(this.roomId);
    
    // 로컬 상태 업데이트
    this._isRunning = true;
    
    // 녹화 기능 적용
    if (this._autoRecording) {
      this._recorder.start();
    }
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
    // 백엔드에 순위 설정은 현재 구현되어 있지 않으므로 로컬 상태만 업데이트
    this._winnerRank = rank;
  }

  public setAutoRecording(value: boolean) {
    this._autoRecording = value;
  }

  public setMarbles(names: string[]) {
    // 백엔드에 마블 설정 요청
    this.socketService.setMarbles(this.roomId, names);
  }

  public reset() {
    // 백엔드에 게임 리셋 요청
    this.socketService.resetGame(this.roomId);
    
    // 로컬 상태 초기화
    this._winner = null;
    this._winners = [];
    this._marbles = [];
    this._isRunning = false;
    this._goalDist = Infinity;
  }

  public getCount() {
    return this._marbles.length;
  }

  private _changeShakeAvailable(v: boolean) {
    if (this._shakeAvailable !== v) {
      this._shakeAvailable = v;
      this.dispatchEvent(
        new CustomEvent('shakeAvailableChanged', { detail: v }),
      );
    }
  }

  public shake() {
    if (!this._shakeAvailable) return;
    
    // 모든 마블을 흔들어버리기
    this._marbles.forEach(marble => {
      this.socketService.shakeMarble(this.roomId, marble.id);
    });
  }

  public async getMaps() {
    try {
      const maps = await this.socketService.getMaps();
      return maps.map((title, index) => ({ index, title }));
    } catch (error) {
      console.error('Failed to get maps:', error);
      return [];
    }
  }

  public setMap(index: number) {
    // 백엔드에 맵 설정 요청
    this.socketService.setMap(this.roomId, index);
  }
}
