import React, { FC } from 'react';

interface WinnerSettingProps {
  winnerSelectionType: 'first' | 'last' | 'custom';
  winningRankDisplay: number | null;
  onFirstWinnerClick: () => void;
  onLastWinnerClick: () => void;
  onWinningRankChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
}

const WinnerSetting: FC<WinnerSettingProps> = ({
  winnerSelectionType,
  winningRankDisplay,
  onFirstWinnerClick,
  onLastWinnerClick,
  onWinningRankChange,
  disabled,
}) => {
  return (
    <div className="row">
      <label>
        <i className="icon trophy"></i>
        <span data-trans>The winner is</span>
      </label>
      <div className="btn-group">
        <button
          onClick={onFirstWinnerClick}
          className={`btn-winner btn-first-winner ${winnerSelectionType === 'first' ? 'active' : ''}`}
          data-trans
          disabled={disabled}
        >
          First
        </button>
        <button
          onClick={onLastWinnerClick}
          className={`btn-winner btn-last-winner ${winnerSelectionType === 'last' ? 'active' : ''}`}
          data-trans
          disabled={disabled}
        >
          Last
        </button>
        <input
          type="number"
          id="in_winningRank"
          value={winningRankDisplay ?? ''}
          min="1"
          onChange={onWinningRankChange}
          className={winnerSelectionType === 'custom' ? 'active' : ''}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default WinnerSetting;
