import { useState, useEffect, useCallback } from 'react';
import socketService from '../services/socketService';
import { parseName } from '../utils/parseName';

export const useParticipantManager = (initialNames: string) => {
  const [namesInput, setNamesInput] = useState(initialNames);

  useEffect(() => {
    const savedNames = localStorage.getItem('mbr_names');
    if (savedNames) {
      setNamesInput(savedNames);
    }
  }, []);

  const handleNamesChange = useCallback((rawNames: string) => {
    localStorage.setItem('mbr_names', rawNames);
    setNamesInput(rawNames);

    const nameSource = rawNames.split(/[,\r\n]/g).map((v) => v.trim());
    const nameSet = new Set<string>();
    const nameCounts: { [key: string]: number } = {};

    nameSource.forEach((nameSrc) => {
      const item = parseName(nameSrc);
      const key = item.weight > 1 ? `${item.name}/${item.weight}` : item.name || '';
      if (item.name === '') return;
      if (!nameSet.has(key)) nameSet.add(key);
      nameCounts[key] = (nameCounts[key] || 0) + item.count;
    });

    const namesToSend = Object.keys(nameCounts).map((key) => {
      const count = nameCounts[key];
      const match = key.match(/^(.*?)(?:\/(\d+))?$/);
      const namePart = match ? match[1] : key;
      const weightPart = match && match[2] ? `/${match[2]}` : '';
      return count > 1 ? `${namePart}${weightPart}*${count}` : `${namePart}${weightPart}`;
    });

    socketService.setMarbles(namesToSend);
  }, []);

  const shuffleNames = useCallback(() => {
    const names = namesInput
      .split(/[,\r\n]/g)
      .map((v) => v.trim())
      .filter((v) => v !== '');
    
    for (let i = names.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [names[i], names[j]] = [names[j], names[i]];
    }
    
    const shuffledNames = names.join(', ');
    handleNamesChange(shuffledNames);
  }, [namesInput, handleNamesChange]);

  return {
    namesInput,
    handleNamesChange,
    shuffleNames,
  };
};
