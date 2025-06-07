import { Camera } from '../camera';
import { initialZoom } from '../data/constants';
import { Minimap } from '../minimap';
import { VectorLike } from '../types/VectorLike';

/**
 * 모든 좌표 변환을 중앙에서 관리하는 클래스.
 * 복잡한 좌표 변환 로직을 캡슐화하여 일관성과 재사용성을 높입니다.
 */
export class CoordinateManager {
  private camera!: Camera;
  private canvas!: HTMLCanvasElement;
  private minimap!: Minimap;

  private canvasRect: DOMRect | null = null;
  private canvasScaling: { scaleX: number; scaleY: number } | null = null;

  /**
   * 매 프레임 최신 상태를 주입받아 내부 상태를 업데이트합니다.
   * @param camera - 현재 카메라 객체
   * @param canvas - 렌더링에 사용되는 canvas 엘리먼트
   * @param minimap - 미니맵 객체
   */
  public update(camera: Camera, canvas: HTMLCanvasElement, minimap: Minimap) {
    this.camera = camera;
    this.canvas = canvas;
    this.minimap = minimap;

    // 캔버스 정보는 계산 비용이 있으므로, 이전과 동일한 캔버스일 경우 캐시된 값을 재사용할 수 있습니다.
    // 하지만 매번 업데이트하는 것이 가장 정확성을 보장합니다.
    this.canvasRect = this.canvas.getBoundingClientRect();
    this.canvasScaling = {
      scaleX: this.canvas.width / this.canvasRect.width,
      scaleY: this.canvas.height / this.canvasRect.height,
    };
  }

  /**
   * 화면(클라이언트) 좌표를 월드 좌표로 변환합니다.
   * @param screenPos - 변환할 화면 좌표 (e.g., event.clientX, event.clientY)
   * @returns 변환된 월드 좌표
   */
  public screenToWorld(screenPos: VectorLike): VectorLike {
    if (!this.camera || !this.canvasRect || !this.canvasScaling) {
      console.warn('CoordinateManager is not updated. Returning zero vector.');
      return { x: 0, y: 0 };
    }

    // 1. 브라우저 화면 좌표 -> 캔버스 내부 좌표
    const canvasX = (screenPos.x - this.canvasRect.left) * this.canvasScaling.scaleX;
    const canvasY = (screenPos.y - this.canvasRect.top) * this.canvasScaling.scaleY;

    // 2. 캔버스 좌표 -> `initialZoom`이 적용된 렌더링 좌표
    const renderX = canvasX / initialZoom;
    const renderY = canvasY / initialZoom;

    // 3. `renderScene` 변환의 역과정
    const centerOffsetDivisor = 2;
    const zoomFactor = initialZoom * centerOffsetDivisor * this.camera.zoom;
    const centerOffsetX = this.canvas.width / zoomFactor;
    const centerOffsetY = this.canvas.height / zoomFactor;

    const untranslatedX = renderX - centerOffsetX;
    const untranslatedY = renderY - centerOffsetY;

    const unscaledX = untranslatedX / this.camera.zoom;
    const unscaledY = untranslatedY / this.camera.zoom;

    const worldX = unscaledX + this.camera.x;
    const worldY = unscaledY + this.camera.y;

    return { x: worldX, y: worldY };
  }

  /**
   * 월드 좌표를 화면(클라이언트) 좌표로 변환합니다.
   * @param worldPos - 변환할 월드 좌표
   * @returns 변환된 화면 좌표
   */
  public worldToScreen(worldPos: VectorLike): VectorLike {
    if (!this.camera || !this.canvasRect || !this.canvasScaling) {
      console.warn('CoordinateManager is not updated. Returning zero vector.');
      return { x: 0, y: 0 };
    }

    // 1. `renderScene` 변환 과정
    const centerOffsetDivisor = 2;
    const zoomFactor = initialZoom * centerOffsetDivisor * this.camera.zoom;
    const centerOffsetX = this.canvas.width / zoomFactor;
    const centerOffsetY = this.canvas.height / zoomFactor;

    const translatedX = worldPos.x - this.camera.x;
    const translatedY = worldPos.y - this.camera.y;

    const scaledX = translatedX * this.camera.zoom;
    const scaledY = translatedY * this.camera.zoom;

    const renderX = scaledX + centerOffsetX;
    const renderY = scaledY + centerOffsetY;

    // 2. 렌더링 좌표 -> 캔버스 좌표
    const canvasX = renderX * initialZoom;
    const canvasY = renderY * initialZoom;

    // 3. 캔버스 좌표 -> 화면 좌표
    const screenX = canvasX / this.canvasScaling.scaleX + this.canvasRect.left;
    const screenY = canvasY / this.canvasScaling.scaleY + this.canvasRect.top;

    return { x: screenX, y: screenY };
  }

  /**
   * 미니맵 좌표를 월드 좌표로 변환합니다.
   * @param minimapPos - 변환할 미니맵 내부 좌표
   * @returns 변환된 월드 좌표
   */
  public minimapToWorld(minimapPos: VectorLike): VectorLike {
    const minimapScale = 4;
    // 미니맵의 스케일만 역으로 적용하여 월드 좌표를 구합니다.
    // 미니맵의 위치 오프셋은 미니맵 내부 좌표계에 포함되지 않습니다.
    return {
      x: minimapPos.x / minimapScale,
      y: minimapPos.y / minimapScale,
    };
  }

  /**
   * 월드 좌표를 미니맵 좌표로 변환합니다.
   * @param worldPos - 변환할 월드 좌표
   * @returns 변환된 미니맵 좌표
   */
  public worldToMinimap(worldPos: VectorLike): VectorLike {
    const minimapScale = 4;
    return {
      x: worldPos.x * minimapScale,
      y: worldPos.y * minimapScale,
    };
  }
}
