# Camera 좌표 시스템 개선 제안

## 현재 문제점
- 매직 넘버 `2`가 코드에 하드코딩되어 있어 의도가 불분명
- 복잡한 좌표 변환 로직이 분산되어 있음
- `initialZoom * 2 * zoom` 같은 계산이 직관적이지 않음

## 개선 방안

### 방안 1: 의미있는 상수 사용 (현재 적용됨)
```typescript
export const CAMERA_CENTER_OFFSET_DIVISOR = 2;
const zoomFactor = initialZoom * CAMERA_CENTER_OFFSET_DIVISOR * this._zoom;
```

### 방안 2: 좌표 변환 유틸리티 클래스
```typescript
class CoordinateTransform {
  constructor(
    private initialZoom: number,
    private canvasWidth: number,
    private canvasHeight: number
  ) {}

  getCenterOffset(zoom: number): { x: number; y: number } {
    const factor = this.initialZoom * 2 * zoom;
    return {
      x: this.canvasWidth / factor,
      y: this.canvasHeight / factor
    };
  }

  getZoomFactor(zoom: number): number {
    return this.initialZoom * 2 * zoom;
  }
}
```

### 방안 3: 카메라 설정 객체
```typescript
interface CameraConfig {
  baseZoom: number;
  centerOffsetMultiplier: number;
  canvasSize: { width: number; height: number };
}

class Camera {
  constructor(private config: CameraConfig) {}
  
  private getZoomFactor(): number {
    return this.config.baseZoom * this.config.centerOffsetMultiplier * this._zoom;
  }
}
```

### 방안 4: 함수형 접근
```typescript
const createZoomFactor = (baseZoom: number, centerMultiplier: number) => 
  (zoom: number) => baseZoom * centerMultiplier * zoom;

const createCenterOffset = (canvasWidth: number, canvasHeight: number) =>
  (zoomFactor: number) => ({
    x: canvasWidth / zoomFactor,
    y: canvasHeight / zoomFactor
  });
```

## 권장사항
1. 현재 적용한 상수 방식이 가장 간단하고 효과적
2. 더 복잡한 로직이 추가될 경우 방안 2나 3 고려
3. 주석을 통해 수학적 근거 명시
