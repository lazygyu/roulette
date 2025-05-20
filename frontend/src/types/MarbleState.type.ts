import { Skills } from '../data/constants'; // Assuming constants are mirrored or shared
import { VectorLike } from './VectorLike'; // Assuming VectorLike type exists

export interface MarbleState {
  id: number;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  skill: Skills | null;
  skillCooldown: number;
  skillDuration: number;
  isActive: boolean;
  // Add any other properties included in the backend's Marble.toJSON()
}
