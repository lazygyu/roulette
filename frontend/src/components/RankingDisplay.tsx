import React from 'react';
import { RankingEntry } from '../types/gameTypes';
import './RankingDisplay.css';

interface RankingDisplayProps {
  ranking: RankingEntry[] | null;
  roomName: string | null;
  onClose: () => void;
}

const RankingDisplay: React.FC<RankingDisplayProps> = ({ ranking, roomName, onClose }) => {
  if (!ranking || ranking.length === 0) {
    return null;
  }

  const winnerEntry = ranking.find(entry => entry.isWinner);

  return (
    <div className="ranking-modal-overlay">
      <div className="ranking-modal-content">
        <h2>🏆 {roomName || 'Game'} Final Ranking 🏆</h2>
        {winnerEntry && (
          <div className="final-winner-section">
            <p className="winner-label">🎉 Winner 🎉</p>
            <p className="winner-name">{winnerEntry.marbleName}</p>
            <p className="winner-rank">(Rank: {winnerEntry.rank})</p>
          </div>
        )}
        <h3>Overall Ranking:</h3>
        <ul>
          {ranking.map((entry) => (
            <li
              key={`${entry.marbleName}-${entry.rank}`}
              className={entry.isWinner ? 'ranking-winner-entry' : 'ranking-entry'}
            >
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
