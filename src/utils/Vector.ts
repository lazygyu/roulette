import {VectorLike} from '../types/VectorLike';

export class Vector {
    static sub(v1: VectorLike, v2: VectorLike): VectorLike {
        return {x: v2.x - v1.x, y: v2.y - v1.y};
    }

    static lenSq(v: VectorLike) {
        return v.x * v.x + v.y * v.y;
    }

    static len(v: VectorLike) {
        return Math.sqrt(this.lenSq(v));
    }
}
