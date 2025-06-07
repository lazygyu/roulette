# Camera 좌표 시스템 개선 완료

## 개선 목표
매직 넘버 `2`를 제거하고 좌표 변환 로직을 더 명확하고 확장 가능하게 만들기

## 선택된 해결책: 방안 2 - CoordinateTransform 유틸리티 클래스

### ✅ 구현 완료 사항

#### 1. CoordinateTransform 클래스 생성 (`utils/coordinateTransform.ts`)
```typescript
export class CoordinateTransform {
  private readonly centerOffsetMultiplier = 2; // 매직 넘버를 클래스 내부로 캡슐화
  
  // 핵심 메서드들:
  getZoomFactor(cameraZoom: number): number
  getCenterOffset(cameraZoom: number): { x: number; y: number }
  getTransformParams(cameraZoom: number)
  updateCanvasSize(width: number, height: number): CoordinateTransform
}
```

#### 2. Camera 클래스 업데이트
- `_coordinateTransform` 프로퍼티 추가
- `renderScene()`에서 `getCenterOffset()` 사용
- `setSize()`에서 캔버스 크기 변경 시 CoordinateTransform 재생성

#### 3. Roulette 클래스 업데이트  
- `_coordinateTransform` 프로퍼티 추가
- `screenToWorld()`에서 `CAMERA_CENTER_OFFSET_DIVISOR` 제거
- CoordinateTransform의 `getCenterOffset()` 메서드 사용

#### 4. 상수 정리
- `CAMERA_CENTER_OFFSET_DIVISOR` 상수 완전 제거
- 매직 넘버가 CoordinateTransform 클래스 내부로 캡슐화됨

### 🎯 달성된 개선 효과

1. **가독성 향상**: `initialZoom * 2 * zoom` → `coordinateTransform.getZoomFactor(zoom)`
2. **의도 명확화**: 매직 넘버 2가 "중앙 정렬을 위한 보정값"임이 명확해짐
3. **확장성 증대**: 좌표 변환 로직이 한 곳에 집중되어 수정이 용이
4. **재사용성**: 다른 클래스에서도 동일한 변환 로직 사용 가능
5. **유지보수성**: 좌표 변환 관련 변경사항이 CoordinateTransform 클래스로 국한됨

### 빌드 테스트 결과
✅ **성공적으로 빌드 완료** - 모든 타입스크립트 에러 해결

### 코드 품질 개선
- 매직 넘버 완전 제거
- 단일 책임 원칙 적용 (좌표 변환만 담당하는 전용 클래스)
- 명확한 메서드 네이밍
- 포괄적인 JSDoc 문서화
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
