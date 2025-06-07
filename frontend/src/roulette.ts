import { initialZoom } from './data/constants';
import { ParticleManager } from './particleManager';
import { StageDef, stages } from 'common';
import { Camera } from './camera';
import { RouletteRenderer } from './rouletteRenderer';
import { bound } from './utils/bound.decorator';
import { UIObject } from './UIObject';
import { RankRenderer } from './rankRenderer';
import { Minimap } from './minimap';
import { VideoRecorder } from './utils/videoRecorder';
import { GameState, MarbleState, MapEntityState } from './types/gameTypes'; // Import types from gameTypes
import {
  ServerSkillType,
  ServerSkillEffect,
  FrontendSkillEffectWrapper,
  ImpactSkillEffectFromServer,
} from './types/skillTypes'; // 스킬 이펙트 관련 타입 임포트
import { CoordinateManager } from './utils/coordinate-manager';

export class Roulette extends EventTarget {
  // Store state received from server
  private _marbles: MarbleState[] = []; // Now stores state data, not Marble instances
  private _winners: MarbleState[] = []; // Now stores state data
  private _winner: MarbleState | null = null; // Now stores state data
  private _mapEntitiesState: MapEntityState[] = []; // Store map entities state from server
  private _isRunning: boolean = false;
  private _winnerRank = 0;
  private _totalMarbleCount = 0;
  private _shakeAvailable: boolean = false;

  // Keep rendering related state and objects
  private _lastTime: number = 0; // Still needed for animation frame timing? Maybe not if rendering is purely state-driven. Keep for now.
  private _elapsed: number = 0; // Keep for timing particle/effect updates
  // private _noMoveDuration: number = 0; // No longer calculated locally
  // private _shakeAvailable: boolean = false; // State comes from server

  private _updateInterval = 10; // Keep for potential timing use? Or remove? Remove for now.
  private _timeScale = 1; // No longer calculated locally

  // private _winners: Marble[] = []; // Replaced by MarbleState version
  private _particleManager = new ParticleManager();
  private _stage: StageDef | null = null; // Keep local stage definition

  private _camera: Camera;
  private _renderer: RouletteRenderer = new RouletteRenderer();
  private _coordinateManager: CoordinateManager;

  private _activeSkillEffects: FrontendSkillEffectWrapper[] = []; // 활성 스킬 이펙트 목록

  // private _winnerRank = 0; // State comes from server
  // private _totalMarbleCount = 0; // State comes from server
  private _goalDist: number = Infinity; // Keep as local rendering helper state? Or remove? Remove for now, camera logic needs review.

  private _uiObjects: UIObject[] = []; // Keep UI objects

  private _autoRecording: boolean = false; // Keep local options for now
  private _recorder!: VideoRecorder; // Keep recorder

  private _isReady: boolean = false; // Keep ready flag, might indicate renderer readiness
  get isReady() {
    return this._isReady;
  }

  // --- New method to update state from server ---
  public updateStateFromServer(gameState: GameState): void {
    this._marbles = gameState.marbles;
    this._winners = gameState.winners;
    this._winner = gameState.winner;
    this._mapEntitiesState = gameState.entities;
    this._isRunning = gameState.isRunning;
    this._winnerRank = gameState.winnerRank;
    this._totalMarbleCount = gameState.totalMarbleCount;
    this._shakeAvailable = gameState.shakeAvailable; // Already handled in socketService listener? Redundant? Keep for direct access if needed.
  }

  // 서버로부터 받은 스킬 이펙트를 처리하여 활성 이펙트 목록에 추가
  public processServerSkillEffects(serverEffects: ServerSkillEffect[]): void {
    if (!Array.isArray(serverEffects) || serverEffects.length === 0) {
      return;
    }
    const now = Date.now();
    serverEffects.forEach((serverEffect) => {
      // 이미 존재하는 이펙트인지 확인 (id 기준)
      if (!this._activeSkillEffects.some((e) => e.id === serverEffect.id)) {
        let duration = 0;
        switch (serverEffect.type) {
          case ServerSkillType.Impact:
            duration = 500; // Impact 스킬 이펙트 지속 시간 (ms)
            break;
          case ServerSkillType.DummyMarble:
            duration = 1000; // DummyMarble 스킬 이펙트 지속 시간 (ms)
            break;
          default:
            duration = 500; // 기본 지속 시간
        }

        this._activeSkillEffects.push({
          id: serverEffect.id,
          type: serverEffect.type,
          serverEffectData: serverEffect,
          startTime: now,
          duration: duration,
        });
      }
    });

    // Trigger UI updates based on state changes if not handled by specific events
    // e.g., update winner display, marble counts etc.
    // The renderer will pick up these state changes in the next frame.

    // Handle game over state change specifically if needed (e.g., showing settings)
    // if (!this._isRunning && this._winner) { // GamePage.tsx will handle UI changes based on its state
    // Check if game just ended
    // Use timeout to allow final render/animation?
    // setTimeout(() => {
    //   const settingsDiv = document.querySelector('#settings');
    //   const donateDiv = document.querySelector('#donate');
    //   if (settingsDiv) settingsDiv.classList.remove('hide');
    //   if (donateDiv) donateDiv.classList.remove('hide');
    // }, 1500); // Delay showing settings after game over
    // }
  }

  constructor(coordinateManager: CoordinateManager) {
    super();
    this._camera = new Camera(); // 인자 없이 생성
    this._coordinateManager = coordinateManager;
  }

  public async initialize(container: HTMLElement): Promise<void> {
    if (!container) {
      console.error('Roulette initialize: container is null or undefined.');
      throw new Error('Container element is required for Roulette initialization.');
    }
    await this._renderer.init(container);
    this._renderer.onResize = (width, height) => {
      this._camera.setSize(width, height);
    };
    this._camera.setSize(this._renderer.width, this._renderer.height); // 초기 크기 설정
    await this._init(); // _init no longer initializes physics
    this._isReady = true; // Indicates renderer and roulette logic are ready
    this._update(); // Start the render loop
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

    this._elapsed += currentTime - this._lastTime;
    if (this._elapsed > 100) {
      this._elapsed %= 100;
    }
    this._lastTime = currentTime;

    // const interval = (this._updateInterval / 1000) * this._timeScale; // No longer needed for local physics step

    // Remove local physics step and state update loop
    // while (this._elapsed >= this._updateInterval) {
    // this._updateMarbles(this._updateInterval); // REMOVED - State comes from server
    // Keep particle/effect updates if they are purely visual and driven by time
    this._particleManager.update(currentTime - this._lastTime); // Update based on actual elapsed time
    this._updateEffects(currentTime - this._lastTime); // Update based on actual elapsed time
    // this._elapsed -= this._updateInterval; // No longer needed
    // }
    this._uiObjects.forEach((obj) => obj.update(currentTime - this._lastTime)); // Update UI objects

    // Sorting might still be useful for rendering order if renderer relies on it
    if (this._marbles.length > 1) {
      // Ensure sorting works with MarbleState (assuming 'y' property exists)
      this._marbles.sort((a, b) => b.y - a.y);
    }
    // Remove duplicate update call for _uiObjects
    // this._uiObjects.forEach((obj) => obj.update(this._updateInterval));

    // Remove duplicate sorting block
    // if (this._marbles.length > 1) {
    //   this._marbles.sort((a, b) => b.y - a.y);
    // }

    if (this._stage) {
      // Review Camera update logic
      // Assuming Camera.update can handle MarbleState[]
      // Setting needToZoom to false as _goalDist is no longer calculated locally
      this._camera.update({
        marbles: this._marbles, // Pass MarbleState[]
        stage: this._stage,
        targetIndex: this._winnerRank - this._winners.length, // Use server state for target index
        deltaTime: currentTime - this._lastTime,
      });

      // Shake available logic is driven by server state (_shakeAvailable property)
      // UI update for shake button is handled in socketService listener
      // if (
      //   this._isRunning &&
      //   this._marbles.length > 0 &&
      //   this._noMoveDuration > 3000 // _noMoveDuration is no longer calculated
      // ) {
      //   this._changeShakeAvailable(true);
      // } else {
      //   this._changeShakeAvailable(false);
      // }
    }

    const minimap = this._uiObjects.find(obj => obj instanceof Minimap) as Minimap;
    this._coordinateManager.update(this._camera, this._renderer.canvas, minimap);

    this._render();
    window.requestAnimationFrame(this._update);
  }

  // private _updateMarbles(deltaTime: number) { ... } // REMOVED - State comes from server

  // private _calcTimeScale(): number { ... } // REMOVED - Time scale logic was tied to local simulation

  // 스킬 이펙트 업데이트 및 만료된 이펙트 제거
  private _updateEffects(deltaTime: number) {
    const now = Date.now();
    // 스킬 이펙트 업데이트 및 만료된 이펙트 제거
    this._activeSkillEffects = this._activeSkillEffects.filter((effect) => {
      return now - effect.startTime < effect.duration;
    });
  }

  private _render() {
    if (!this._stage) return; // Keep stage check

    // Pass server state to renderer
    const renderParams = {
      camera: this._camera,
      stage: this._stage, // Local stage definition
      entities: this._mapEntitiesState, // Use entities state from server
      marbles: this._marbles, // Use marble state from server
      winners: this._winners, // Use winner state from server
      particleManager: this._particleManager,
      skillEffects: this._activeSkillEffects, // 새로운 스킬 이펙트
      winnerRank: this._winnerRank,
      winner: this._winner, // Use winner state from server
      size: { x: this._renderer.width, y: this._renderer.height },
    };
    if (this._marbles.length > 0 || this._mapEntitiesState.length > 0 || this._activeSkillEffects.length > 0) {
      // Log only when there's something to render
      // console.log(`Rendering state: ${this._marbles.length} marbles, ${this._mapEntitiesState.length} entities, ${this._activeSkillEffects.length} skill effects`); // Uncommented log
    }

    // Assuming RouletteRenderer is updated to handle MarbleState[] and MapEntityState[]
    this._renderer.render(renderParams, this._uiObjects, this._coordinateManager);
  }

  private async _init() {
    // Make _init synchronous as physics init is removed
    this._recorder = new VideoRecorder(this._renderer.canvas);

    // Keep UI object initialization
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
    this._stage = stages[0]; // Keep local stage definition loading
    this._loadMap(); // Keep call, but _loadMap needs modification
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

  private _loadMap() {
    if (!this._stage) {
      throw new Error('No map has been selected');
    }
    // Maybe load map visual assets if needed by renderer? Assume renderer handles this based on stage def.
  }

  // --- Public methods now mostly act as interfaces for index.html, actual logic is server-driven ---

  public start() {
    // Don't change local state, just request server via socketService (handled in index.html)
    console.log('Start requested (handled by socketService)');
    // Local recording logic might still be triggered here if desired
    if (this._autoRecording) {
      this._recorder.start(); // Start recording locally
    }
    // Note: UI changes like hiding settings should be triggered by server events ('game_started')
  }

  public setWinningRank(rank: number) {
    // Don't change local state, request server via socketService (handled in index.html)
    console.log(`Set winning rank requested: ${rank} (handled by socketService)`);
    // this._winnerRank = rank; // State updated by server
  }

  public setAutoRecording(value: boolean) {
    // Keep as local setting
    this._autoRecording = value;
  }

  public setMarbles(names: string[]) {
    // This method is called by index.html's getReady() which now calls socketService.setMarbles
    // The local logic for creating Marble instances is no longer needed here.
    console.log('Local setMarbles called, but state is managed by server.');
    // this.reset(); // Reset might trigger socket emit, avoid calling directly?
    // Clear local representation immediately? Or wait for server state? Wait for server.
    // The parsing logic is duplicated in index.html blur handler, maybe centralize? Keep as is for now.
  }

  public reset() {
    // Request server reset via socketService (handled in index.html)
    console.log('Reset requested (handled by socketService)');
    // Clear local state immediately? Or wait for server? Wait for server.
    // this.clearMarbles();
    // this._clearMap();
    // this._loadMap(); // Reload local stage definition? Yes.
    this._goalDist = Infinity; // Reset local rendering helper state
    this._stage = stages[0]; // Reset to default map locally? Or get from server? Reset locally for now.
    this._loadMap();
  }

  public getCount() {
    // Return count from server state
    return this._totalMarbleCount;
  }

  public shake() {
    this._camera.shake(500);
  }

  public getMaps() {
    // Return static map list, server sends available maps via socket event now.
    return stages.map((stage, index) => {
      return {
        index,
        title: stage.title,
      };
    });
  }

  public setMap(index: number) {
    // Request server map change via socketService (handled in index.html)
    console.log(`Set map requested: ${index} (handled by socketService)`);
    // Update local stage definition for renderer immediately? Yes.
    if (index >= 0 && index < stages.length) {
      this._stage = stages[index];
      this._loadMap(); // Reload local stage visuals
      // Clear local state representation? Wait for server update.
      this._marbles = [];
      this._winners = [];
      this._winner = null;
      this._mapEntitiesState = [];
    } else {
      console.error('Invalid map index for local stage update:', index);
    }
  }

  public getCoordinateManager(): CoordinateManager {
    return this._coordinateManager;
  }
}
