import { MapEntity } from '../types/MapEntity.type';

export type StageDef = {
  title: string;
  entities?: MapEntity[];
  goalY: number;
  zoomY: number;
};

export const stages: StageDef[] = [
  {
    title: 'Wheel of fortune',
    goalY: 111,
    zoomY: 106.75,
    entities: [
      // polyline
      {
        position: { x: 0, y: 0 },
        shape: {
          type: 'polyline',
          points: [
            [16.5, -300],
            [9.25, -300],
            [9.25, 8.5],
            [2, 19.25],
            [2, 26],
            [9.75, 30],
            [9.75, 33.5],
            [1.25, 41],
            [1.25, 53.75],
            [8.25, 58.75],
            [8.25, 63],
            [9.25, 64],
            [8.25, 65],
            [8.25, 99.25],
            [15.1, 106.75],
            [15.1, 111.75],
          ],
          rotation: 0,
        },
        type: 'static',
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        type: 'static',
        position: { x: 0, y: 0 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [16.5, -300],
            [16.5, 9.25],
            [9.5, 20],
            [9.5, 22.5],
            [17.5, 26],
            [17.5, 33.5],
            [24, 38.5],
            [19, 45.5],
            [19, 55.5],
            [24, 59.25],
            [24, 63],
            [23, 64],
            [24, 65],
            [24, 100.5],
            [16, 106.75],
            [16, 111.75],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 0, y: 0 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points:
            [
              [12.75, 37.5],
              [7, 43.5],
              [7, 49.75],
              [12.75, 53.75],
              [12.75, 37.5],
            ],
        },
      },
      {
        type: 'static',
        position: { x: 0, y: 0 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points:
            [
              [14.75, 37.5],
              [14.75, 43],
              [17.5, 40.25],
              [14.75, 37.5],
            ],
        },
      },
      // boxes
      {
        position: { x: 15.5, y: 30.0 },
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45 },
        type: 'static',
        props: { density: 1, angularVelocity: 0, restitution: 1 },
      },
      // ... 생략 (많은 다른 box 엔티티들)
      
      // wheels
      {
        position: { x: 8, y: 75 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: 3.5, restitution: 0 },
      },
      {
        position: { x: 12, y: 75 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: -3.5, restitution: 0 },
      },
      {
        position: { x: 16, y: 75 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: 3.5, restitution: 0 },
      },
      {
        position: { x: 20, y: 75 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: -3.5, restitution: 0 },
      },
      {
        position: { x: 24, y: 75 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: 3.5, restitution: 0 },
      },
      {
        position: { x: 14, y: 106.75 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: -1.2, restitution: 0 },
      },
    ],
  },
  {
    'title': 'BubblePop',
    'goalY': 83,
    'zoomY': 78,
    'entities': [
      // BubblePop 맵의 엔티티들 (생략됨)
      {
        'type': 'static',
        'position': { 'x': 10.375, 'y': -108.5 },
        'props': { 'angularVelocity': 0, 'density': 1, 'restitution': 0 },
        'shape': {
          'type': 'polyline',
          'rotation': 0,
          'points': [[6.125, -191.5], [-1.125, -191.5], [-1.125, 108.5], [-1.125, 151.5], [-6.125, 158.5], [-1.125, 161.5], [-1.125, 179.5], [-0.9128679656440362, 179.7498817789222], [-1.125, 179.9997635578444], [-1.125, 183.5], [1.625, 188.5], [1.625, 191.5]],
        },
      }
      // 생략 (다른 엔티티들)
    ],
  },
  {
    title: 'Pot of greed',
    goalY: 111,
    zoomY: 110,
    entities: [
      // Pot of greed 맵의 엔티티들 (생략됨)
      {
        type: 'static',
        position: { x: 0, y: 0 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [17, -300],
            [9, -300],
            [9, 8.5],
            [2, 15],
            [6, 61.5],
          ],
        },
      }
      // 생략 (다른 엔티티들)
    ],
  },
];