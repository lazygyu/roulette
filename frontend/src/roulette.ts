import { Marble } from './marble';
import { initialZoom, Skills, zoomThreshold } from './data/constants';
import { ParticleManager } from './particleManager';
import { StageDef, stages } from './data/maps';
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
import { GameState, MarbleState, MapEntityState } from './types/gameTypes'; // Import types from gameTypes

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
  private _speed = 1; // Keep for local particle/effect speed? Or controlled by server? Assume local for now.

  // private _winners: Marble[] = []; // Replaced by MarbleState version
  private _particleManager = new ParticleManager();
  private _stage: StageDef | null = null; // Keep local stage definition

  private _camera: Camera;
  private _renderer: RouletteRenderer = new RouletteRenderer();

  private _effects: GameObject[] = []; // Keep local visual effects

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

  constructor() {
    super();
    this._camera = new Camera(); // 인자 없이 생성
  }

  public async initialize(container: HTMLElement): Promise<void> {
    if (!container) {
      console.error('Roulette initialize: container is null or undefined.');
      throw new Error('Container element is required for Roulette initialization.');
    }
    await this._renderer.init(container);
    this._camera.setSize(this._renderer.width, this._renderer.height); // 렌더러 초기화 후 카메라 크기 설정
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

    this._elapsed += (currentTime - this._lastTime) * this._speed;
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
        needToZoom: false, // Set explicitly to false
        targetIndex: this._winnerRank - this._winners.length, // Use server state for target index
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

    this._render();
    window.requestAnimationFrame(this._update);
  }

  // private _updateMarbles(deltaTime: number) { ... } // REMOVED - State comes from server

  // private _calcTimeScale(): number { ... } // REMOVED - Time scale logic was tied to local simulation

  // Keep effect updates if they are purely visual
  private _updateEffects(deltaTime: number) {
    this._effects.forEach((effect) => effect.update(deltaTime));
    this._effects = this._effects.filter((effect) => !effect.isDestroy);
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
      effects: this._effects,
      winnerRank: this._winnerRank,
      winner: this._winner, // Use winner state from server
      size: { x: this._renderer.width, y: this._renderer.height },
    };
    // Log the parameters being sent to the renderer for debugging
    // console.log('Render Params:', JSON.stringify(renderParams)); // Use stringify for deep logging, might be too verbose
    if (this._marbles.length > 0 || this._mapEntitiesState.length > 0) {
      // Log only when there's something to render
      // console.log(`Rendering state: ${this._marbles.length} marbles, ${this._mapEntitiesState.length} entities`); // Uncommented log
    }

    // Assuming RouletteRenderer is updated to handle MarbleState[] and MapEntityState[]
    this._renderer.render(renderParams, this._uiObjects);
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

  // This method is likely no longer needed as state is overwritten by server
  // public clearMarbles() {
  //   this._winner = null;
  //   this._winners = [];
  //   this._marbles = [];
  // }

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

  public setSpeed(value: number) {
    // Don't change local state, request server via socketService (handled in index.html)
    console.log(`Set speed requested: ${value} (handled by socketService)`);
    // Keep local _speed if needed for local animations/effects? Or remove? Remove for now.
    // this._speed = value;
  }

  public getSpeed() {
    // This should ideally return speed from server state if needed
    // return this._speed; // Returning potentially stale local value
    console.warn('getSpeed() called, returning potentially stale local value or default.');
    return 1; // Return default or value from server state if stored
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

  // private _clearMap() {
  // this._marbles = []; // State managed by server
  // }

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

  // private _changeShakeAvailable(v: boolean) { ... } // REMOVED - Handled by server state

  public shake() {
    // Keep local shake effect if purely visual? Or trigger server action?
    // Assume purely visual for now, triggered by button in index.html
    console.log('Local shake effect triggered.');
    // Add visual shake logic here if needed, independent of server state.
    // if (!this._shakeAvailable) return; // Check local state? Or always allow visual shake?
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

  public screenToWorld(clientX: number, clientY: number, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    // 캔버스 좌표를 월드 좌표로 변환
    // 렌더러의 줌과 카메라 위치를 고려해야 함
    const worldX = (canvasX / this._renderer.width) * this._camera.width + this._camera.x - this._camera.width / 2;
    const worldY = (canvasY / this._renderer.height) * this._camera.height + this._camera.y - this._camera.height / 2;

    return { x: worldX, y: worldY };
  }
}
