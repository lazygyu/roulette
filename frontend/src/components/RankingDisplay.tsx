import React from 'react';
import { MarbleState } from '../types/gameTypes';
import './RankingDisplay.css'; // 스타일 파일 임포트

interface RankingDisplayProps {
  ranking: MarbleState[] | null;
  roomName: string | null;
  onClose: () => void;
}

const RankingDisplay: React.FC<RankingDisplayProps> = ({ ranking, roomName, onClose }) => {
  if (!ranking || ranking.length === 0) {
    return null; // 랭킹 정보가 없으면 아무것도 표시하지 않음
  }

  return (
    <div className="ranking-modal-overlay">
      <div className="ranking-modal-content">
        <h2>🏆 {roomName || 'Game'} Final Ranking 🏆</h2>
        <ul>
          {ranking.map((marble, index) => (
            <li key={marble.id || index} style={{ color: marble.color }}>
              <span className="rank-number">{index + 1}.</span>
              <span className="marble-name">{marble.name}</span>
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="close-ranking-button">Close</button>
      </div>
    </div>
  );
};

export default RankingDisplay;
