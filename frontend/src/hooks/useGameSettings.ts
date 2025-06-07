import { useState, useEffect, useCallback } from 'react';
import socketService from '../services/socketService';
import { GameInfo } from '../types/gameTypes';
import { Roulette } from '../roulette';

export const useGameSettings = (
  gameDetails: GameInfo | null,
  rouletteInstance: Roulette | null,
  marbleCount: number,
) => {
  const [mapIndex, setMapIndex] = useState<number>(0);
  const [useSkills, setUseSkills] = useState<boolean>(true);
  const [autoRecording, setAutoRecording] = useState<boolean>(false);
  const [winnerSelectionType, setWinnerSelectionType] = useState<'first' | 'last' | 'custom'>('first');
  const [winningRank, setWinningRank] = useState<number>(1);

  useEffect(() => {
    if (gameDetails) {
      setMapIndex(gameDetails.mapIndex ?? 0);
      setUseSkills(gameDetails.useSkills);
      setAutoRecording(gameDetails.autoRecording);
      if (gameDetails.winningRank !== null) {
        setWinningRank(gameDetails.winningRank + 1);
        setWinnerSelectionType(gameDetails.winningRank === 0 ? 'first' : 'custom');
      }
    }
  }, [gameDetails]);

  useEffect(() => {
    if (winnerSelectionType === 'last') {
      const newRank = marbleCount > 0 ? marbleCount : 1;
      setWinningRank(newRank);
      socketService.setWinningRank(newRank - 1);
    }
  }, [marbleCount, winnerSelectionType]);

  const handleMapChange = useCallback((index: number) => {
    setMapIndex(index);
    socketService.setMap(index);
  }, []);

  const handleSkillChange = useCallback((enabled: boolean) => {
    setUseSkills(enabled);
    // Note: We might need a socket event for this if it needs to be synced instantly.
    // For now, we assume it's part of the "start_game" payload.
  }, []);

  const handleAutoRecordingChange = useCallback((enabled: boolean) => {
    setAutoRecording(enabled);
    rouletteInstance?.setAutoRecording(enabled);
  }, [rouletteInstance]);

  const handleWinningRankChange = useCallback((rank: number) => {
    const newRank = Math.max(1, rank);
    setWinningRank(newRank);
    setWinnerSelectionType('custom');
    socketService.setWinningRank(newRank - 1);
  }, []);

  const selectFirstWinner = useCallback(() => {
    setWinningRank(1);
    setWinnerSelectionType('first');
    socketService.setWinningRank(0);
  }, []);

  const selectLastWinner = useCallback(() => {
    const rank = marbleCount > 0 ? marbleCount : 1;
    setWinningRank(rank);
    setWinnerSelectionType('last');
    socketService.setWinningRank(rank - 1);
  }, [marbleCount]);

  const startGame = useCallback(() => {
    if ((rouletteInstance?.getCount() ?? 0) === 0) {
      alert('Please add participants.');
      return;
    }
    socketService.startGame();
  }, [rouletteInstance]);

  return {
    mapIndex,
    useSkills,
    autoRecording,
    winnerSelectionType,
    winningRank,
    handleMapChange,
    handleSkillChange,
    handleAutoRecordingChange,
    handleWinningRankChange,
    selectFirstWinner,
    selectLastWinner,
    startGame,
  };
};
