import React, { FC } from 'react';

const GameFooter: FC = () => {
  return (
    <div className="copyright">
      &copy; 2025.{' '}
      <a href="https://lazygyu.net" target="_blank" rel="noopener noreferrer">
        lazygyu
      </a>
      <span data-trans>
        This program is freeware and may be used freely anywhere, including in broadcasts and videos.
      </span>
    </div>
  );
};

export default GameFooter;
