import { initialZoom } from '../data/constants';

/**
 * 카메라 좌표 변환을 담당하는 유틸리티 클래스
 * 복잡한 좌표 변환 로직을 캡슐화하여 코드의 가독성과 유지보수성을 향상
 */
export class CoordinateTransform {
  private readonly centerOffsetMultiplier = 2; // 화면 중앙 정렬을 위한 보정값

  constructor(
    private readonly baseZoom: number = initialZoom,
    private readonly canvasWidth: number,
    private readonly canvasHeight: number
  ) {}

  /**
   * 줌 팩터 계산
   * @param cameraZoom 카메라의 현재 줌 레벨
   * @returns 최종 줌 팩터 (baseZoom * centerOffsetMultiplier * cameraZoom)
   */
  getZoomFactor(cameraZoom: number): number {
    return this.baseZoom * this.centerOffsetMultiplier * cameraZoom;
  }

  /**
   * 화면 중앙 정렬을 위한 오프셋 계산
   * @param cameraZoom 카메라의 현재 줌 레벨
   * @returns 중앙 정렬 오프셋 좌표
   */
  getCenterOffset(cameraZoom: number): { x: number; y: number } {
    const zoomFactor = this.getZoomFactor(cameraZoom);
    return {
      x: this.canvasWidth / zoomFactor,
      y: this.canvasHeight / zoomFactor
    };
  }

  /**
   * 월드 좌표를 화면 좌표로 변환하기 위한 변환 파라미터 계산
   * @param cameraZoom 카메라의 현재 줌 레벨
   * @returns 좌표 변환에 필요한 파라미터들
   */
  getTransformParams(cameraZoom: number) {
    const zoomFactor = this.getZoomFactor(cameraZoom);
    const centerOffset = this.getCenterOffset(cameraZoom);
    
    return {
      zoomFactor,
      centerOffset,
      baseZoom: this.baseZoom,
      cameraZoom
    };
  }

  /**
   * 캔버스 크기 업데이트
   * @param width 새로운 캔버스 너비
   * @param height 새로운 캔버스 높이
   */
  updateCanvasSize(width: number, height: number): CoordinateTransform {
    return new CoordinateTransform(this.baseZoom, width, height);
  }
}
