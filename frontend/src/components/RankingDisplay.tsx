import React from 'react';
import { RankingEntry } from '../types/gameTypes'; // MarbleState 대신 RankingEntry 사용
import './RankingDisplay.css'; // 스타일 파일 임포트

interface RankingDisplayProps {
  ranking: RankingEntry[] | null; // 타입을 RankingEntry[]로 변경
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
          {ranking.map((entry, index) => ( // 변수명을 marble에서 entry로 변경
            // RankingEntry에는 color 정보가 없으므로, 필요하다면 백엔드에서 추가하거나 여기서 기본값 처리
            // 여기서는 isWinner를 사용하여 스타일을 적용
            <li key={entry.marbleName + '-' + entry.rank} className={entry.isWinner ? 'ranking-winner' : ''}>
              <span className="rank-number">{entry.rank}.</span>
              <span className="marble-name">{entry.marbleName}</span>
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="close-ranking-button">Close</button>
      </div>
    </div>
  );
};

export default RankingDisplay;
