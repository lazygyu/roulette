import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import options from '../options';
import { useGame } from '../contexts/GameContext';
import { GameStatus, RoomInfo, RankingEntry, GameInfo } from '../types/gameTypes';
import { Roulette } from '../roulette'; // Roulette 타입 임포트

interface UseGamePageLogicResult {
  roomName: string | null; // string | undefined -> string | null 로 변경
  roomDetails: RoomInfo | null;
  gameDetails: GameInfo | null;
  isManager: boolean;
  finalRanking: RankingEntry[] | null;
  showRankingModal: boolean;
  setShowRankingModal: (show: boolean) => void;
  showPasswordModal: boolean;
  passwordInput: string;
  setPasswordInput: (password: string) => void;
  joinError: string | null;
  winnerSelectionType: 'first' | 'last' | 'custom';
  winningRankDisplay: number | null;
  rouletteInstance: Roulette | null;
  availableMaps: { index: number; title: string; }[];
  initializeGame: (container: HTMLDivElement) => void;
  handlePasswordJoin: () => void;
  namesInput: string;
  autoRecording: boolean;
  useSkills: boolean;
  mapIndex: number | null;
  onNamesInput: (event: React.FormEvent<HTMLTextAreaElement>) => void;
  onNamesBlur: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onShuffleClick: () => void;
  onStartClick: () => void;
  onSkillChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onWinningRankChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFirstWinnerClick: () => void;
  onLastWinnerClick: () => void;
  onMapChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onAutoRecordingChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  passwordInputRef: React.RefObject<HTMLInputElement | null>; // HTMLInputElement -> HTMLInputElement | null 로 변경
  lastUsedSkill: { playerId: string; nickname: string; skillType: string; skillPosition: { x: number; y: number }; extra: any } | null;
}

export const useGamePageLogic = (): UseGamePageLogicResult => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const {
    roomName,
    roomDetails,
    gameDetails,
    isManager,
    finalRanking,
    showRankingModal,
    setShowRankingModal,
    showPasswordModal,
    passwordInput,
    setPasswordInput,
    joinError,
    winnerSelectionType,
    setWinnerSelectionType,
    winningRankDisplay,
    rouletteInstance,
    availableMaps,
    initializeGame,
    handlePasswordJoin,
    setWinnerRank,
    updateParticipants,
    startGame,
    setUseSkills: setGameContextUseSkills, // GameContext의 setUseSkills와 충돌 방지
    setMap,
    setAutoRecording: setGameContextAutoRecording, // GameContext의 setAutoRecording과 충돌 방지
    lastUsedSkill,
  } = useGame();

  // Local states for controlled components
  const [namesInput, setNamesInput] = useState<string>('');
  const [autoRecording, setAutoRecording] = useState<boolean>(options.autoRecording);
  const [useSkills, setUseSkills] = useState<boolean>(true); // GamePage.tsx의 defaultChecked에 따라 초기값 설정
  const [mapIndex, setMapIndex] = useState<number | null>(null);

  // Ref for password input (still needed for focus)
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Initial load for names from localStorage
  useEffect(() => {
    const savedNames = localStorage.getItem('mbr_names');
    if (savedNames) {
      setNamesInput(savedNames);
      updateParticipants(savedNames); // 초기 로드 시 GameContext에도 업데이트
    }
  }, [updateParticipants]);

  // Update local states based on gameDetails from context
  useEffect(() => {
    if (gameDetails) {
      if (gameDetails.status === GameStatus.WAITING || gameDetails.status === GameStatus.IN_PROGRESS) {
        if (gameDetails.marbles && gameDetails.marbles.length > 0) {
          setNamesInput(gameDetails.marbles.join(','));
        }
        if (gameDetails.mapIndex !== null && typeof gameDetails.mapIndex !== 'undefined') {
          setMapIndex(gameDetails.mapIndex);
        }
        setUseSkills(gameDetails.useSkills); // gameDetails에서 useSkills 상태 동기화
        setAutoRecording(gameDetails.autoRecording); // gameDetails에서 autoRecording 상태 동기화
      }
    }
  }, [gameDetails]);

  // Sync local autoRecording state with rouletteInstance and GameContext
  useEffect(() => {
    if (rouletteInstance) {
      rouletteInstance.setAutoRecording(autoRecording);
      setGameContextAutoRecording(autoRecording);
    }
  }, [autoRecording, rouletteInstance, setGameContextAutoRecording]);

  // Sync local useSkills state with GameContext
  useEffect(() => {
    setGameContextUseSkills(useSkills);
  }, [useSkills, setGameContextUseSkills]);


  const handleInNamesInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    setNamesInput(e.currentTarget.value);
    updateParticipants(e.currentTarget.value);
  }, [updateParticipants]);

  const handleInNamesBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    setNamesInput(e.currentTarget.value);
    updateParticipants(e.currentTarget.value);
  }, [updateParticipants]);

  const handleBtnShuffleClick = useCallback(() => {
    updateParticipants(namesInput); // 현재 namesInput 상태 사용
  }, [updateParticipants, namesInput]);

  const handleBtnStartClick = useCallback(() => {
    startGame();
  }, [startGame]);

  const handleChkSkillChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUseSkills(e.target.checked);
  }, []); // setGameContextUseSkills는 useEffect에서 동기화되므로 의존성 제거

  const handleInWinningRankChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseInt(e.target.value, 10);
      setWinnerRank(isNaN(v) || v < 1 ? 1 : v, 'custom');
    },
    [setWinnerRank],
  );

  const handleBtnLastWinnerClick = useCallback(() => {
    const total = rouletteInstance?.getCount() ?? 1;
    setWinnerRank(total > 0 ? total : 1, 'last');
  }, [setWinnerRank, rouletteInstance]);

  const handleBtnFirstWinnerClick = useCallback(() => {
    setWinnerRank(1, 'first');
  }, [setWinnerRank]);

  const handleMapChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const index = parseInt(e.target.value, 10);
    setMapIndex(index); // 로컬 상태 업데이트
    setMap(index); // GameContext 업데이트
  }, [setMap]);

  const handleAutoRecordingChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAutoRecording(e.target.checked);
  }, []); // setGameContextAutoRecording는 useEffect에서 동기화되므로 의존성 제거

  return {
    roomName,
    roomDetails,
    gameDetails,
    isManager,
    finalRanking,
    showRankingModal,
    setShowRankingModal,
    showPasswordModal,
    passwordInput,
    setPasswordInput,
    joinError,
    winnerSelectionType,
    winningRankDisplay,
    rouletteInstance,
    availableMaps,
    initializeGame,
    handlePasswordJoin,
    namesInput,
    autoRecording,
    useSkills,
    mapIndex,
    onNamesInput: handleInNamesInput,
    onNamesBlur: handleInNamesBlur,
    onShuffleClick: handleBtnShuffleClick,
    onStartClick: handleBtnStartClick,
    onSkillChange: handleChkSkillChange,
    onWinningRankChange: handleInWinningRankChange,
    onFirstWinnerClick: handleBtnFirstWinnerClick,
    onLastWinnerClick: handleBtnLastWinnerClick,
    onMapChange: handleMapChange,
    onAutoRecordingChange: handleAutoRecordingChange,
    passwordInputRef,
    lastUsedSkill,
  };
};
