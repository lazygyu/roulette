import { MarbleState } from './MarbleState.type';
import { MapEntityState } from './MapEntityState.type';

export interface GameState {
  marbles: MarbleState[];
  winners: MarbleState[];
  winner: MarbleState | null;
  entities: MapEntityState[]; // Array of map entity states from the backend
  isRunning: boolean;
  winnerRank: number;
  totalMarbleCount: number;
  shakeAvailable: boolean;
  // Add any other properties returned by backend's getGameState()
}
