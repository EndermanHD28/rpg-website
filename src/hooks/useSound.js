'use client';

import { useCallback, useEffect, useState } from 'react';

const SOUNDS = {
  celebration: '/sound_effects/celebration.mp3',
  error: '/sound_effects/error.mp3',
  stat_point: '/sound_effects/stat_point.wav',
  tab_change: '/sound_effects/tab_change.mp3',
  random_button: '/sound_effects/random_button.mp3',
};

export const useSound = () => {
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const savedVolume = localStorage.getItem('rpg_volume');
    if (savedVolume !== null) {
      setVolume(parseFloat(savedVolume));
    }

    const handleStorageChange = (e) => {
      if (e.key === 'rpg_volume') {
        setVolume(parseFloat(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const changeVolume = (newVolume) => {
    setVolume(newVolume);
    localStorage.setItem('rpg_volume', newVolume.toString());
    // Dispatch a storage event manually for the same window
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'rpg_volume',
      newValue: newVolume.toString()
    }));
  };

  const playSound = useCallback((soundName) => {
    const soundPath = SOUNDS[soundName];
    if (soundPath) {
      const audio = new Audio(soundPath);
      const currentVol = parseFloat(localStorage.getItem('rpg_volume') ?? "1");
      audio.volume = 0.4 * currentVol; // Base volume is 40%, adjusted by master slider
      
      if (soundName === 'random_button') {
        audio.preservesPitch = true; // Return pitch to normal
        audio.playbackRate = 1.7; // Speed up 1.7x
      }
      
      // Explicitly tell the browser this audio should not interrupt others
      // This is a hint for some mobile browsers and Electron/WebView environments
      if ('mediaSession' in navigator) {
        // No-op to avoid breaking, but Standard Audio() is already fairly isolated.
      }
      
      audio.play().catch(err => console.error("Error playing sound:", err));
    }
  }, []);

  return { playSound, volume, changeVolume };
};
