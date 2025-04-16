export enum Skills {
  None = 'none',
  Impact = 'impact'
}

export interface MarbleState {
  id: number;
  name: string;
  position: {
    x: number;
    y: number;
    angle: number;
  };
  color: string;
  hue: number;
  isActive: boolean;
  skill: Skills;
  weight: number;
} 