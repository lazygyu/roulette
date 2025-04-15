import { VectorLike } from '../types/VectorLike';

export class Vector {
  static sub(v1: VectorLike, v2: VectorLike): VectorLike {
    return { x: v2.x - v1.x, y: v2.y - v1.y };
  }

  static lenSq(v: VectorLike) {
    return v.x * v.x + v.y * v.y;
  }

  static len(v: VectorLike) {
    return Math.sqrt(this.lenSq(v));
  }

  static mul(v: VectorLike, scalar: number) {
    return { x: v.x * scalar, y: v.y * scalar };
  }

  static add(v1: VectorLike, v2: VectorLike) {
    return { x: v1.x + v2.x, y: v1.y + v2.y };
  }
}
