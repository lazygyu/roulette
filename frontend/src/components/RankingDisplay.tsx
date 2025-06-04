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
    return null;
  }

  // 최종 승자 찾기
  const winnerEntry = ranking.find(entry => entry.isWinner);

  return (
    <div className="ranking-modal-overlay">
      <div className="ranking-modal-content">
        <h2>🏆 {roomName || 'Game'} Final Ranking 🏆</h2>
        {/* 최종 승자 표시 */}
        {winnerEntry && (
          <div className="final-winner-section">
            <p className="winner-label">🎉 Winner 🎉</p>
            <p className="winner-name">{winnerEntry.marbleName}</p>
            <p className="winner-rank">(Rank: {winnerEntry.rank})</p>
          </div>
        )}
        {/* 전체 순위 목록 */}
        <h3>Overall Ranking:</h3>
        <ul>
          {ranking.map((entry) => (
            <li
              key={`${entry.marbleName}-${entry.rank}`}
              className={entry.isWinner ? 'ranking-winner-entry' : 'ranking-entry'} // 클래스명 변경하여 구분
            >
              <span className="rank-number">{entry.rank}.</span>
              <span className="marble-name">{entry.marbleName}</span>
              {/* entry.isWinner && <span className="winner-star">⭐</span> */} {/* 필요시 승자 표시 추가 */}
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="close-ranking-button">Close</button>
      </div>
    </div>
  );
};

export default RankingDisplay;
