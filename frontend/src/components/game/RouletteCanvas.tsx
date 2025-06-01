import React, { useEffect, useRef, FC } from 'react';

interface RouletteCanvasProps {
  initializeGame: (container: HTMLDivElement) => void;
}

const RouletteCanvas: FC<RouletteCanvasProps> = ({ initializeGame }) => {
  const rouletteCanvasContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rouletteCanvasContainerRef.current) {
      initializeGame(rouletteCanvasContainerRef.current);
    }
  }, [initializeGame]);

  return (
    <div
      id="roulette-canvas-container"
      ref={rouletteCanvasContainerRef}
      style={{ width: '100%', height: '100%', position: 'fixed', top: 0, left: 0 }}
    />
  );
};

export default RouletteCanvas;
