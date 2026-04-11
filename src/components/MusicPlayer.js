"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function MusicPlayer({ isMaster, currentVolume: initialVolume = 0.5 }) {
  const [url, setUrl] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSFXOpen, setIsSFXOpen] = useState(false);
  const [activeSounds, setActiveSounds] = useState(new Set());
  const audioRefs = useRef({});
  const [sfxList, setSfxList] = useState({ builtIn: [], soundEffects: [] });
  const [sfxSearchBuiltIn, setSfxSearchBuiltIn] = useState('');
  const [sfxSearchPlayable, setSfxSearchPlayable] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [songTitle, setSongTitle] = useState('Loading...');
  const [showTitle, setShowTitle] = useState(false);
  const [volume, setVolume] = useState(initialVolume);
  const [duration, setDuration] = useState(0);
  const [currentSfxUrl, setCurrentSfxUrl] = useState(null);
  const [currentSfxTriggeredAt, setCurrentSfxTriggeredAt] = useState(null);

  useEffect(() => {
    setVolume(initialVolume);
  }, [initialVolume]);
  const [played, setPlayed] = useState(0);
  const ytPlayer = useRef(null);
  const lastSyncTime = useRef(0);
  const sfxAudioRef = useRef(null); // Ref for playing synchronized SFX

  // YouTube API Logic
  useEffect(() => {
    if (!url || !hasInteracted) return;

    const getUrlParams = (url) => {
      try {
        const urlObj = new URL(url);
        let videoId = urlObj.searchParams.get('v');
        if (!videoId && urlObj.hostname.includes('youtu.be')) {
          videoId = urlObj.pathname.slice(1);
        }
        if (!videoId && !urlObj.searchParams.get('list')) {
          videoId = url.split('/').pop();
        }
        const listId = urlObj.searchParams.get('list');
        return { videoId, listId };
      } catch (e) {
        return { videoId: url.split('/').pop(), listId: null };
      }
    };

    const { videoId, listId } = getUrlParams(url);
    let interval = null;

    const initializePlayer = () => {
      // Don't re-initialize if the element is missing
      const playerElement = document.getElementById('youtube-player-raw');
      if (!playerElement) return;

      if (ytPlayer.current) {
        try {
          ytPlayer.current.destroy();
        } catch (e) {
          console.error("Error destroying player:", e);
        }
      }

      const playerConfig = {
        playerVars: {
          autoplay: 0, // Disable internal autoplay to let our manual sync/playlist logic take over
          controls: 0,
          modestbranding: 1,
          rel: 0,
          mute: 0,
          loop: 1,
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(volume * 100);
            setDuration(event.target.getDuration());

            if (lastSyncTime.current > 0) {
              event.target.seekTo(lastSyncTime.current, true);
            }
            
            interval = setInterval(() => {
              if (ytPlayer.current && ytPlayer.current.getCurrentTime) {
                const currentTime = ytPlayer.current.getCurrentTime();
                const totalTime = ytPlayer.current.getDuration();
                if (totalTime > 0) {
                  setPlayed(currentTime / totalTime);
                  setDuration(totalTime);
                }
              }
            }, 1000);
          },
          onStateChange: async (event) => {
            event.target.setVolume(volume * 100);

            // If Master pauses or plays, we should update music_started_at to keep sync
            if (isMaster) {
              if (event.data === window.YT.PlayerState.PLAYING) {
                const currentTime = event.target.getCurrentTime();
                const currentVideoData = event.target.getVideoData();
                const videoId = currentVideoData?.video_id;
                
                const startedAt = new Date(Date.now() - currentTime * 1000).toISOString();
                
                const updates = { music_started_at: startedAt };
                
                // If we are in a playlist, update the music_url to the specific video being played
                if (videoId && url.includes('list=')) {
                  const urlObj = new URL(url);
                  urlObj.searchParams.set('v', videoId);
                  updates.music_url = urlObj.toString();
                }

                await supabase
                  .from('global')
                  .update(updates)
                  .eq('id', 1);
              }
            }
            
            // Handle metadata updates when song changes in playlist
            if (event.data === window.YT.PlayerState.PLAYING) {
              const currentVideoData = event.target.getVideoData();
              if (currentVideoData && currentVideoData.title) {
                setSongTitle(currentVideoData.title);
              }
              setDuration(event.target.getDuration());
            }

            // If playlist ended or video ended and loop didn't trigger
            if (event.data === window.YT.PlayerState.ENDED) {
              if (listId) {
                event.target.playVideo();
              }
            }
          }
        }
      };

      if (listId) {
        playerConfig.playerVars.listType = 'playlist';
        playerConfig.playerVars.list = listId;
        // If we have a videoId, we can try to hint the player to start there
        if (videoId) playerConfig.videoId = videoId;
      } else {
        playerConfig.videoId = videoId;
        playerConfig.playerVars.playlist = videoId; // Required for single video loop
        playerConfig.playerVars.autoplay = 1; // Re-enable autoplay for single videos
      }

      // Initialize the player
      ytPlayer.current = new window.YT.Player('youtube-player-raw', playerConfig);

      // Manual Playlist Setup on Ready
      if (listId) {
        const onPlayerReady = (event) => {
          const urlObj = new URL(url);
          const videoIdParam = urlObj.searchParams.get('v');
          const indexParam = urlObj.searchParams.get('index');
          
          if (videoIdParam) {
            // If we have a specific video ID, use loadVideoById to start it
            event.target.loadVideoById({
              videoId: videoIdParam,
              startSeconds: Math.max(0, lastSyncTime.current)
            });
          } else {
            const loadOptions = {
              listType: 'playlist',
              list: listId,
            };
            if (indexParam) {
              loadOptions.index = parseInt(indexParam) - 1;
            }
            event.target.loadPlaylist(loadOptions);
          }
          
          // Ensure it actually plays and has the right volume
          setTimeout(() => {
            if (ytPlayer.current) {
              if (ytPlayer.current.playVideo) ytPlayer.current.playVideo();
              if (ytPlayer.current.setVolume) ytPlayer.current.setVolume(volume * 100);
            }
          }, 500);
        };

        ytPlayer.current.addEventListener('onReady', onPlayerReady);
      }
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = initializePlayer;
    } else {
      initializePlayer();
    }

    return () => {
      if (interval) clearInterval(interval);
      if (ytPlayer.current) {
        try {
          ytPlayer.current.destroy();
        } catch (e) {
          console.error("Error destroying player in cleanup:", e);
        }
      }
      // Stop all playing SFX
      Object.values(audioRefs.current).forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });
    };
  }, [url, hasInteracted]);

  // Handle Volume Changes
  useEffect(() => {
    if (ytPlayer.current && ytPlayer.current.setVolume) {
      ytPlayer.current.setVolume(volume * 100);
    }
  }, [volume]);

  useEffect(() => {
    const handleFirstInteraction = () => {
      console.log("--- FIRST INTERACTION DETECTED ---");
      setHasInteracted(true);
      window.removeEventListener('mousedown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
    window.addEventListener('mousedown', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);
    return () => {
      window.removeEventListener('mousedown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  useEffect(() => {
    const fetchSongTitle = async (videoUrl) => {
      try {
        const videoId = videoUrl.includes('v=')
          ? videoUrl.split('v=')[1].split('&')[0]
          : videoUrl.split('/').pop();
        
        const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
        const data = await response.json();
        if (data.title) {
          setSongTitle(data.title);
        }
      } catch (e) {
        console.error("Error fetching title:", e);
        setSongTitle("Unknown Track");
      }
    };

    const syncWithSupabase = (data) => {
      if (!data) return;

      // --- Music Sync ---
      if (data.music_url !== undefined) {
        const urlChanged = data.music_url !== url;
        setUrl(data.music_url);
        setPlaying(!!data.music_url);
        
        if (data.music_url) {
          if (urlChanged) fetchSongTitle(data.music_url);
        } else {
          setSongTitle('');
        }
      }

      // Sync Music Timestamp (Avoid master syncing to themselves)
      if (!isMaster && (data.music_started_at || data.music_url)) {
        const startedAt = data.music_started_at ? new Date(data.music_started_at).getTime() : Date.now();
        const now = Date.now();
        const targetTime = Math.max(0, (now - startedAt) / 1000);

        if (ytPlayer.current && ytPlayer.current.seekTo && data.music_started_at) {
          const localTime = ytPlayer.current.getCurrentTime();
          
          // Only sync if the difference is at least 3 seconds
          if (Math.abs(targetTime - localTime) > 3) {
            console.log(`Syncing music: remote expected ${targetTime}s, local is ${localTime}s. Diff: ${Math.abs(targetTime - localTime)}s`);
            ytPlayer.current.seekTo(targetTime, true);
          }
        } else {
          // Store for when player is ready
          lastSyncTime.current = targetTime;
        }
      }

      // --- SFX Sync ---
      if (data.sfx_url !== undefined) {
        if (data.sfx_url === null) {
          // Stop current SFX
          if (sfxAudioRef.current) {
            sfxAudioRef.current.pause();
            sfxAudioRef.current.currentTime = 0;
            sfxAudioRef.current = null;
          }
          setCurrentSfxUrl(null);
          setCurrentSfxTriggeredAt(null);
        } else if (!isMaster && (data.sfx_url !== currentSfxUrl || (data.sfx_triggered_at && currentSfxTriggeredAt && new Date(data.sfx_triggered_at).getTime() > new Date(currentSfxTriggeredAt).getTime()))) {
          // Play new SFX on non-master clients
          console.log("Playing remote SFX:", data.sfx_url);
          playRemoteSFX(data.sfx_url);
          setCurrentSfxUrl(data.sfx_url);
          setCurrentSfxTriggeredAt(data.sfx_triggered_at);
        }
      }
    };

    const fetchMusic = async () => {
      const { data, error } = await supabase.from('global').select('*').eq('id', 1).maybeSingle();
      if (error) {
        console.error("MusicPlayer fetch error:", error);
        return;
      }
      syncWithSupabase(data);
    };

    fetchMusic();

    let interval = null;
    const channel = supabase.channel('music_sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'global', filter: 'id=eq.1' }, (p) => {
        syncWithSupabase(p.new);
      })
      .subscribe();

    return () => {
      if (interval) clearInterval(interval);
      if (ytPlayer.current) {
        try {
          ytPlayer.current.destroy();
        } catch (e) {
          console.error("Error destroying player in cleanup:", e);
        }
      }
      // Stop all playing SFX
      Object.values(audioRefs.current).forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });
    };
  }, [isMaster, url, currentSfxUrl, currentSfxTriggeredAt]);

  // Master Sync Pulse - No longer needed as we use music_started_at

  useEffect(() => {
    if (isMaster) {
      fetch('/api/sounds')
        .then(res => res.json())
        .then(data => {
          console.log("SFX List from API:", data);
          setSfxList(data);
        })
        .catch(err => console.error("Error fetching sounds:", err));
    }
  }, [isMaster]);

  const playSFX = async (filename, category) => {
    const path = category === 'builtIn' ? `/sound_effects/${filename}` : `/sound_effects/playable/${filename}`;
    console.log("Attempting to play SFX (Master):", { filename, category, path, volume });

    if (isMaster) {
      const { error } = await supabase
        .from('global')
        .update({
          sfx_url: path,
          sfx_triggered_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (error) {
        console.error("Error updating global SFX state:", error);
      } else {
        // Master also plays locally, but the sync will prevent double-triggering
        // The conditional logic in syncWithSupabase will handle whether the master should play
        // or if it's already playing from the local trigger.
        playRemoteSFX(path); // Master plays it immediately
        setCurrentSfxUrl(path);
        setCurrentSfxTriggeredAt(new Date().toISOString());
      }
    } else {
      // For non-masters, direct playback is not allowed; they receive via sync.
      console.warn("Non-master attempted to play SFX directly.");
    }
  };

  const stopSFX = async (e, filename, category) => {
    e.stopPropagation(); // Prevent event from bubbling up to the parent play button
    const path = category === 'builtIn' ? `/sound_effects/${filename}` : `/sound_effects/playable/${filename}`;
    console.log("Attempting to stop SFX (Master):", path);

    if (isMaster) {
      const { error } = await supabase
        .from('global')
        .update({
          sfx_url: null,
          sfx_triggered_at: null
        })
        .eq('id', 1);

      if (error) {
        console.error("Error stopping global SFX state:", error);
      } else {
        // Master also stops locally
        if (sfxAudioRef.current) {
          sfxAudioRef.current.pause();
          sfxAudioRef.current.currentTime = 0;
          sfxAudioRef.current = null;
        }
        setCurrentSfxUrl(null);
        setCurrentSfxTriggeredAt(null);
      }
    }
    // Remove from active sounds set immediately regardless of master status
    setActiveSounds(prev => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
    // Also stop any locally playing SFX (for master, or if a non-master somehow played it)
    if (audioRefs.current[path]) {
      audioRefs.current[path].pause();
      audioRefs.current[path].currentTime = 0;
      delete audioRefs.current[path];
    }
  };

  const playRemoteSFX = (sfxPath) => {
    if (sfxAudioRef.current) {
      sfxAudioRef.current.pause();
      sfxAudioRef.current.currentTime = 0;
    }
    sfxAudioRef.current = new Audio(sfxPath);
    sfxAudioRef.current.volume = volume; // Use the global volume
    
    // Track active sound for UI
    setActiveSounds(prev => new Set(prev).add(sfxPath));
    
    sfxAudioRef.current.onended = () => {
      setActiveSounds(prev => {
        const next = new Set(prev);
        next.delete(sfxPath);
        return next;
      });
      if (sfxAudioRef.current?.src.includes(sfxPath)) {
        sfxAudioRef.current = null;
      }
    };

    sfxAudioRef.current.play().catch(err => {
      console.error("Error playing remote SFX:", sfxPath, err);
      setActiveSounds(prev => {
        const next = new Set(prev);
        next.delete(sfxPath);
        return next;
      });
    });
  };

  const handleUpdateMusic = async () => {
    if (!isMaster) return;
    
    let targetUrl = inputValue.trim();
    if (targetUrl === "") {
      targetUrl = null;
    }

    const { error } = await supabase
      .from("global")
      .update({
        music_url: targetUrl,
        music_timestamp: 0,
        music_started_at: targetUrl ? new Date().toISOString() : null,
        music_playing: !!targetUrl
      })
      .eq("id", 1);

    if (error) {
      console.error("MusicPlayer update error:", error);
      alert("Error updating music: " + error.message);
    } else {
      setIsOpen(false);
      setInputValue("");
    }
  };

  if (!url && !isMaster) return null;

  return (
    <div
      className="fixed bottom-8 right-8 z-[200] flex flex-col items-end gap-3"
      onMouseEnter={() => setShowTitle(true)}
      onMouseLeave={() => !isOpen && !isSFXOpen && setShowTitle(false)}
    >
      {/* SFX Panel */}
      {isSFXOpen && isMaster && (
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl shadow-2xl w-80 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col gap-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] font-black text-zinc-500 uppercase">Sound Effects</p>
              <input 
                type="text" 
                placeholder="Search..." 
                value={sfxSearchPlayable}
                onChange={(e) => setSfxSearchPlayable(e.target.value)}
                className="bg-black border border-zinc-800 rounded px-2 py-0.5 text-[9px] text-white outline-none focus:border-red-600 w-24"
              />
            </div>
            <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto custom-scrollbar">
              {sfxList.soundEffects.filter(s => s.toLowerCase().includes(sfxSearchPlayable.toLowerCase())).map(s => {
                const path = `/sound_effects/playable/${s}`;
                const active = activeSounds.has(path);
                return (
                  <button 
                    key={s} 
                    onClick={() => playSFX(s, 'playable')}
                    className={`text-[9px] text-left px-2 py-1 rounded truncate transition-colors relative ${
                      active ? 'bg-red-600 text-white font-bold shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-zinc-800/50 text-zinc-300 hover:bg-red-600/30'
                    }`}
                    title={s}
                  >
                    {s.split('.')[0]}
                    {active && (
                      <span 
                        onClick={(e) => stopSFX(e, s, 'playable')}
                        className="ml-2 bg-black/40 hover:bg-black text-[7px] px-1 rounded border border-white/20"
                      >
                        STOP
                      </span>
                    )}
                  </button>
                );
              })}
              {sfxList.soundEffects.length === 0 && <p className="text-[9px] text-zinc-600 italic col-span-2">No effects found</p>}
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-3">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] font-black text-zinc-500 uppercase">Built-In</p>
              <input 
                type="text" 
                placeholder="Search..." 
                value={sfxSearchBuiltIn}
                onChange={(e) => setSfxSearchBuiltIn(e.target.value)}
                className="bg-black border border-zinc-800 rounded px-2 py-0.5 text-[9px] text-white outline-none focus:border-red-600 w-24"
              />
            </div>
            <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto custom-scrollbar">
              {sfxList.builtIn.filter(s => s.toLowerCase().includes(sfxSearchBuiltIn.toLowerCase())).map(s => {
                const path = `/sound_effects/${s}`;
                const active = activeSounds.has(path);
                return (
                  <button 
                    key={s} 
                    onClick={() => playSFX(s, 'builtIn')}
                    className={`text-[9px] text-left px-2 py-1 rounded truncate transition-colors relative ${
                      active ? 'bg-zinc-100 text-black font-bold shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700'
                    }`}
                    title={s}
                  >
                    {s.split('.')[0]}
                    {active && (
                      <span 
                        onClick={(e) => stopSFX(e, s, 'builtIn')}
                        className="ml-2 bg-black/40 hover:bg-black text-[7px] px-1 rounded border border-white/20 text-white"
                      >
                        STOP
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Master Input Panel */}
      {isOpen && isMaster && (
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl shadow-2xl w-72 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <p className="text-[10px] font-black text-zinc-500 uppercase mb-3">YouTube Music Link</p>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Paste URL here..."
            className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white mb-3 outline-none focus:border-red-600 transition-colors"
          />
          <div className="flex gap-2">
            <button
              onClick={handleUpdateMusic}
              className="flex-1 bg-red-600 text-white text-[10px] font-black uppercase py-2 rounded-lg hover:bg-red-500 transition-colors"
            >
              Play
            </button>
            <button
              onClick={() => {
                setInputValue("");
                handleUpdateMusic();
              }}
              className="px-3 bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase py-2 rounded-lg hover:text-white transition-colors"
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <div className="flex items-center gap-3">
        {url && (
          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out flex items-center ${
              showTitle ? 'max-w-[400px] opacity-100' : 'max-w-0 opacity-0 pointer-events-none'
            }`}
          >
            <div className="bg-black/80 backdrop-blur-md border border-zinc-800 px-5 py-3 rounded-2xl whitespace-nowrap flex flex-col gap-1 shadow-2xl">
              <div className="flex items-center justify-between gap-4">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-white tracking-wider truncate uppercase hover:text-red-500 transition-colors max-w-[200px]"
                >
                  {songTitle}
                </a>
                <span className="text-[9px] font-medium text-zinc-500 tabular-nums">
                  {formatTime(played * duration)} / {formatTime(duration)}
                </span>
              </div>
              
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px]">🔈</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-24 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
                <span className="text-[10px]">🔊</span>
              </div>
            </div>
          </div>
        )}

        {isMaster && (
          <button
            onClick={() => {
              setIsSFXOpen(!isSFXOpen);
              setIsOpen(false);
            }}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl group bg-zinc-900 border border-white/10 hover:border-red-600/50 cursor-pointer hover:scale-110 active:scale-95`}
          >
            <span className="text-xl group-hover:scale-110 transition-transform">🔊</span>
          </button>
        )}

        <button
          onClick={() => {
            if (isMaster) {
              setIsOpen(!isOpen);
              setIsSFXOpen(false);
            } else {
              setShowTitle(!showTitle);
            }
          }}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl group ${
            url ? 'bg-red-600' : 'bg-zinc-900 border border-white/10 hover:border-red-600/50'
          } ${isMaster ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-pointer active:scale-95'}`}
        >
        {url ? (
          <div className="flex items-end gap-[2px] h-4">
            <div className="w-[3px] bg-white animate-music-bar-1 rounded-full"></div>
            <div className="w-[3px] bg-white animate-music-bar-2 rounded-full"></div>
            <div className="w-[3px] bg-white animate-music-bar-3 rounded-full"></div>
            <div className="w-[3px] bg-white animate-music-bar-2 rounded-full"></div>
            <div className="w-[3px] bg-white animate-music-bar-1 rounded-full"></div>
          </div>
        ) : (
          <span className="text-xl group-hover:scale-110 transition-transform">🎵</span>
        )}
        </button>
      </div>

      {/* Hidden Player Div */}
      <div style={{
        position: 'fixed',
        bottom: '0',
        left: '0',
        width: '100%',
        height: '0px',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: -1
      }}>
        <div id="youtube-player-raw" style={{ display: (url && hasInteracted) ? 'block' : 'none' }}></div>
      </div>

      <style jsx global>{`
        @keyframes music-bar {
          0%, 100% { height: 4px; }
          50% { height: 16px; }
        }
        .animate-music-bar-1 { animation: music-bar 0.8s ease-in-out infinite; }
        .animate-music-bar-2 { animation: music-bar 1.1s ease-in-out infinite; }
        .animate-music-bar-3 { animation: music-bar 0.9s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
function formatTime(seconds) {
  if (isNaN(seconds) || seconds === Infinity) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
