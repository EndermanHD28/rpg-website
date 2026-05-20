
'use client';

import { useCallback, useEffect, useState, useRef } from 'react';

const SOUNDS = {
  celebration: '/sound_effects/celebration.mp3',
  error: '/sound_effects/error.mp3',
  stat_point: '/sound_effects/stat_point.wav',
  tab_change: '/sound_effects/tab_change.mp3',
  random_button: '/sound_effects/random_button.mp3',
  skill_unlock: '/sound_effects/skill_unlock.mp3',
};

export const useSound = () => {
  const [volume, setVolume] = useState(1);
  const [userInteracted, setUserInteractedState] = useState(false);
  const audioContextRef = useRef(null);

  // Create an AudioContext on first user interaction
  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      // Resume context if it's suspended (common in some browsers)
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    }
  }, []);

  const setUserInteracted = useCallback(() => {
    if (!userInteracted) {
      setUserInteractedState(true);
      ensureAudioContext();
    }
  }, [userInteracted, ensureAudioContext]);

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
    if (soundPath && userInteracted) { // Only play if user has interacted
      ensureAudioContext(); // Ensure AudioContext is ready
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
      
      audio.play().catch(err => console.error("Error playing sound (user not interacted or other error):", err));
    } else if (soundPath && !userInteracted) {
      console.warn("Sound playback prevented: User has not interacted with the page yet. Please click anywhere to enable audio.");
    }
  }, [userInteracted, ensureAudioContext]); // Add userInteracted and ensureAudioContext to dependencies

  return { playSound, volume, changeVolume, setUserInteracted };
};
