"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function MusicPlayer({ isMaster, currentVolume: initialVolume = 0.5 }) {
  const [url, setUrl] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [songTitle, setSongTitle] = useState('Loading...');
  const [showTitle, setShowTitle] = useState(false);
  const [volume, setVolume] = useState(initialVolume);
  const [duration, setDuration] = useState(0);
  const [played, setPlayed] = useState(0);
  const ytPlayer = useRef(null);
  const lastSyncTime = useRef(0);

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
    let interval;

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
                const startedAt = new Date(Date.now() - currentTime * 1000).toISOString();
                await supabase
                  .from('global')
                  .update({ music_started_at: startedAt })
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
        // To start at a specific video in a playlist, we DON'T use videoId in the main config.
        // Instead, we use loadPlaylist or specify it in playerVars.
        playerConfig.playerVars.listType = 'playlist';
        playerConfig.playerVars.list = listId;
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
          
          const loadOptions = {
            listType: 'playlist',
            list: listId,
          };

          if (videoIdParam) {
            loadOptions.videoId = videoIdParam;
          } else if (indexParam) {
            loadOptions.index = parseInt(indexParam) - 1;
          }

          // Use loadPlaylist directly to force it to start the correct item
          // This overrides the initial player configuration
          event.target.loadPlaylist(loadOptions);
          
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

      // Sync Timestamp (Avoid master syncing to themselves)
      if (!isMaster && data.music_started_at && ytPlayer.current && ytPlayer.current.seekTo) {
        const startedAt = new Date(data.music_started_at).getTime();
        const now = Date.now();
        const elapsedSeconds = (now - startedAt) / 1000;
        
        const localTime = ytPlayer.current.getCurrentTime();
        const targetTime = Math.max(0, elapsedSeconds);
        
        // Only sync if the difference is at least 3 seconds
        if (Math.abs(targetTime - localTime) > 3) {
          console.log(`Syncing music: remote expected ${targetTime}s, local is ${localTime}s. Diff: ${Math.abs(targetTime - localTime)}s`);
          ytPlayer.current.seekTo(targetTime, true);
        }
      } else if (!isMaster && data.music_started_at) {
        // Store for when player is ready
        const startedAt = new Date(data.music_started_at).getTime();
        const now = Date.now();
        lastSyncTime.current = Math.max(0, (now - startedAt) / 1000);
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

    const channel = supabase.channel('music_sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'global', filter: 'id=eq.1' }, (p) => {
        syncWithSupabase(p.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMaster, url]);

  // Master Sync Pulse - No longer needed as we use music_started_at

  const handleUpdateMusic = async () => {
    if (!isMaster) return;
    
    let targetUrl = inputValue.trim();
    if (targetUrl === '') {
      targetUrl = null;
    }

    const { error } = await supabase
      .from('global')
      .update({
        music_url: targetUrl,
        music_timestamp: 0,
        music_started_at: targetUrl ? new Date().toISOString() : null,
        music_playing: !!targetUrl
      })
      .eq('id', 1);

    if (error) {
      console.error("MusicPlayer update error:", error);
      alert("Error updating music: " + error.message);
    } else {
      setIsOpen(false);
      setInputValue('');
    }
  };

  if (!url && !isMaster) return null;

  return (
    <div
      className="fixed bottom-8 right-8 z-[200] flex flex-col items-end gap-3"
      onMouseEnter={() => setShowTitle(true)}
      onMouseLeave={() => !isOpen && setShowTitle(false)}
    >
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
                setInputValue('');
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

        <button
          onClick={() => isMaster ? setIsOpen(!isOpen) : setShowTitle(!showTitle)}
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
