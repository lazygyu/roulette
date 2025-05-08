import React, { useRef, useEffect } from 'react';
import { GameState, MarbleState, MapEntityState } from '../types/gameTypes'; // 타입 가져오기

interface RouletteVisualizerProps {
  gameState: GameState | null;
}

const RouletteVisualizer: React.FC<RouletteVisualizerProps> = ({ gameState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 화면 클리어
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!gameState) {
      ctx.fillStyle = 'grey';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for game data...', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Entities (장애물 등) 렌더링
    gameState.entities.forEach((entity: MapEntityState) => {
      ctx.save();
      ctx.translate(entity.x, entity.y); // 임시 - 실제 좌표 변환 필요
      ctx.rotate(entity.angle);

      const shape = entity.shape;
      switch (shape.type) {
        case 'polyline':
          ctx.strokeStyle = 'white'; // 색상 및 스타일은 기존 코드 참고
          ctx.lineWidth = 2;
          if (shape.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(shape.points[0][0], shape.points[0][1]);
            for (let i = 1; i < shape.points.length; i++) {
              ctx.lineTo(shape.points[i][0], shape.points[i][1]);
            }
            ctx.stroke();
          }
          break;
        case 'box':
          ctx.fillStyle = 'cyan'; // 색상 및 스타일은 기존 코드 참고
          ctx.strokeStyle = 'blue';
          ctx.lineWidth = 1;
          const halfWidth = shape.width;
          const halfHeight = shape.height;
          ctx.fillRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);
          ctx.strokeRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);
          break;
        case 'circle':
          ctx.fillStyle = 'yellow'; // 색상 및 스타일은 기존 코드 참고
          ctx.strokeStyle = 'orange';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, shape.radius, 0, Math.PI * 2, false);
          ctx.fill();
          ctx.stroke();
          break;
      }
      ctx.restore();
    });

    // Marbles 렌더링
    gameState.marbles.forEach((marble: MarbleState) => {
      ctx.beginPath();
      ctx.arc(marble.x, marble.y, marble.radius, 0, Math.PI * 2); // 임시 - 실제 좌표 변환 필요
      ctx.fillStyle = marble.color;
      ctx.fill();
    });
  }, [gameState]);

  return (
    <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', backgroundColor: '#333' }} />
  );
};

export default RouletteVisualizer;
