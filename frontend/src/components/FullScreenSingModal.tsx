import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Heart,
  Radio,
  Sparkles,
  Maximize2,
  Minimize2,
  Shuffle,
  Repeat,
} from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { SyncedLyricLine } from '../types/audio';

export const FullScreenSingModal: React.FC = () => {
  const {
    isFullScreenSingOpen,
    setIsFullScreenSingOpen,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    timeDisplayMode,
    toggleTimeDisplayMode,
    shuffleMode,
    setShuffleMode,
    repeatMode,
    setRepeatMode,
    toggleCurrentTrackLike,
    setIsAudioQualityModalOpen,
    playTrack,
  } = usePlayerStore();

  const [lyrics, setLyrics] = useState<SyncedLyricLine[]>([]);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const activeLyricRef = useRef<HTMLDivElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreenSingOpen) {
        setIsFullScreenSingOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreenSingOpen, setIsFullScreenSingOpen]);

  // Fetch Synced Lyrics
  useEffect(() => {
    if (!currentTrack || !isFullScreenSingOpen) return;

    let isMounted = true;
    setLoadingLyrics(true);

    const params = new URLSearchParams({
      track_name: currentTrack.title,
      artist_name: currentTrack.artist,
      duration: String(currentTrack.durationSeconds || 180),
    });

    fetch(`/api/lyrics?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data && data.parsedLines && data.parsedLines.length > 0) {
          setLyrics(data.parsedLines);
        } else {
          setLyrics([]);
        }
      })
      .catch(() => {
        if (isMounted) setLyrics([]);
      })
      .finally(() => {
        if (isMounted) setLoadingLyrics(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentTrack, isFullScreenSingOpen]);

  // Smooth scroll active lyric into view
  useEffect(() => {
    if (activeLyricRef.current && lyricsContainerRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentTime]);

  if (!isFullScreenSingOpen || !currentTrack) return null;

  const currentMs = currentTime * 1000;
  let activeLyricIndex = -1;
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (currentMs >= lyrics[i].timeMs) {
      activeLyricIndex = i;
      break;
    }
  }

  const formatTime = (seconds: number) => {
    const s = Math.floor(seconds || 0);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const remainingSeconds = Math.max(0, duration - currentTime);
  const formattedRightTime =
    timeDisplayMode === 'remaining' ? `-${formatTime(remainingSeconds)}` : formatTime(duration);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleStartRadio = async () => {
    try {
      const res = await fetch(`/api/tracks/${currentTrack.id}/radio?limit=30`);
      if (res.ok) {
        const data = await res.json();
        if (data.tracks && data.tracks.length > 0) {
          await playTrack(data.tracks[0], data.tracks);
        }
      }
    } catch (e) {
      console.warn('Radio launch failed:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-[#0d0d11] text-white flex flex-col select-none animate-in fade-in duration-300">
      {/* Apple Music Fluid Animated Mesh Backdrop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] opacity-40 blur-[120px] ambient-mesh-blob"
          style={{
            background: `radial-gradient(circle at 30% 30%, #fa243c 0%, #a855f7 40%, #3b82f6 75%, transparent 100%)`,
          }}
        />
        <div className="absolute inset-0 bg-black/30 backdrop-blur-3xl" />
      </div>

      {/* Top Header */}
      <div className="relative z-10 px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAudioQualityModalOpen(true)}
            className="apple-lossless-badge font-bold text-white/90 border-white/20 bg-white/10 hover:bg-[#fa243c] hover:border-[#fa243c] transition"
            title="Audio Quality"
          >
            {currentTrack.isHiRes ? 'Hi-Res Lossless' : currentTrack.isLossless ? 'Lossless' : 'Apple Music AAC'}
          </button>
          <span className="text-xs text-white/60">•</span>
          <span className="text-xs text-white/70 font-medium">Apple Music Sing (Karaoke)</span>
        </div>

        <button
          id="sing-close-btn"
          aria-label="Close sing view"
          onClick={() => setIsFullScreenSingOpen(false)}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
          title="Exit Full Screen (ESC)"
        >
          <Minimize2 className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content: Split Hero on Left & Sing Lyrics on Right */}
      <div className="relative z-10 flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-8 px-6 md:px-14 min-h-0 items-center overflow-y-auto">
        {/* Left Column: Artwork & Track Info (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left space-y-3 lg:space-y-6 shrink-0">
          <div className="relative group">
            <img
              src={
                currentTrack.coverArtUrl ||
                'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80'
              }
              alt=""
              className="w-40 h-40 sm:w-64 sm:h-64 lg:w-96 lg:h-96 rounded-2xl object-cover shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-white/10 transition transform group-hover:scale-[1.02] duration-300"
            />
          </div>

          <div className="max-w-md">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white line-clamp-2">
              {currentTrack.title}
            </h1>
            <p className="text-lg sm:text-xl font-medium text-white/70 mt-1 truncate">
              {currentTrack.artist}
            </p>
            {currentTrack.album && (
              <p className="text-sm text-white/40 mt-0.5 truncate">{currentTrack.album}</p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleCurrentTrackLike}
              className={`p-3 rounded-full border transition active:scale-95 ${
                currentTrack.isFavorite
                  ? 'bg-[#fa243c] border-[#fa243c] text-white'
                  : 'bg-white/10 border-white/15 text-white hover:bg-white/20'
              }`}
              title="Love / Favorite"
            >
              <Heart className={`w-5 h-5 ${currentTrack.isFavorite ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={handleStartRadio}
              className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold transition flex items-center gap-2 active:scale-95"
              title="Start Song Radio"
            >
              <Radio className="w-4 h-4 text-[#fa243c]" />
              <span>Song Radio</span>
            </button>
          </div>
        </div>

        {/* Right Column: Apple Music Sing Lyrics (7 cols) */}
        <div
          ref={lyricsContainerRef}
          className="lg:col-span-7 w-full h-[180px] sm:h-[260px] lg:h-[540px] overflow-y-auto scrollbar-none pr-2 lg:pr-4 space-y-4 lg:space-y-6 flex flex-col justify-start"
        >
          {loadingLyrics ? (
            <div className="h-full flex items-center justify-center text-white/50 text-base">
              Synchronizing lyrics with studio audio...
            </div>
          ) : lyrics.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-white/40 space-y-3">
              <Sparkles className="w-8 h-8 text-white/30" />
              <p className="text-xl font-bold">Instrumental or Plain Lyrics</p>
              <p className="text-sm max-w-sm">
                Sing along and feel the studio mix with Apple Music Spatial Audio virtualizer enabled.
              </p>
            </div>
          ) : (
            lyrics.map((line, idx) => {
              const isActive = idx === activeLyricIndex;
              const isPast = idx < activeLyricIndex;

              return (
                <div
                  key={`${line.timeMs}-${idx}`}
                  ref={isActive ? activeLyricRef : null}
                  onClick={() => seek(line.timeMs / 1000)}
                  className={`cursor-pointer transition-all duration-300 transform text-left ${
                    isActive
                      ? 'text-white text-2xl sm:text-3xl md:text-4xl font-black scale-[1.03] opacity-100 drop-shadow-[0_4px_16px_rgba(250,36,60,0.5)]'
                      : isPast
                      ? 'text-white/35 text-xl sm:text-2xl md:text-3xl font-bold hover:text-white/60'
                      : 'text-white/50 text-xl sm:text-2xl md:text-3xl font-bold hover:text-white/80'
                  }`}
                >
                  {line.text}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Transport Player Controls */}
      <div className="relative z-10 px-6 md:px-14 pb-safe pt-2 shrink-0">
        {/* Playhead Timeline */}
        <div className="flex items-center gap-4 mb-4">
          <span className="text-xs font-mono text-white/60 w-10 text-right">{formatTime(currentTime)}</span>
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const pct = Math.max(0, Math.min(1, clickX / rect.width));
              seek(pct * duration);
            }}
            className="flex-1 h-3 cursor-pointer flex items-center group relative"
          >
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden group-hover:h-2 transition-all">
              <div
                className="h-full bg-gradient-to-r from-[#fa243c] to-[#fc3c44] rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <button
            onClick={toggleTimeDisplayMode}
            className="text-xs font-mono text-white/60 w-12 text-left hover:text-white transition"
            title="Click to toggle elapsed / remaining time"
          >
            {formattedRightTime}
          </button>
        </div>

        {/* Playback Buttons & Volume */}
        <div className="flex items-center justify-between">
          {/* Left: Shuffle & Repeat */}
          <div className="flex items-center gap-3 w-1/4">
            <button
              onClick={() => {
                const modes: any[] = ['off', 'fisher-yates', 'artist-spread', 'bpm-flow'];
                const next = modes[(modes.indexOf(shuffleMode) + 1) % modes.length];
                setShuffleMode(next);
              }}
              className={`p-2 rounded-full transition ${
                shuffleMode !== 'off' ? 'text-[#fa243c]' : 'text-white/60 hover:text-white'
              }`}
              title={`Shuffle: ${shuffleMode}`}
            >
              <Shuffle className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                const next = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
                setRepeatMode(next);
              }}
              className={`p-2 rounded-full transition ${
                repeatMode !== 'off' ? 'text-[#fa243c]' : 'text-white/60 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              <Repeat className="w-5 h-5" />
            </button>
          </div>

          {/* Center: Playback Controls */}
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => prevTrack()}
              className="p-3 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition"
              title="Previous Track"
            >
              <SkipBack className="w-7 h-7 fill-current" />
            </button>

            <button
              onClick={() => togglePlay()}
              className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 fill-current" />
              ) : (
                <Play className="w-8 h-8 fill-current ml-1" />
              )}
            </button>

            <button
              onClick={() => nextTrack()}
              className="p-3 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition"
              title="Next Track"
            >
              <SkipForward className="w-7 h-7 fill-current" />
            </button>
          </div>

          {/* Right: Volume Slider */}
          <div className="flex items-center justify-end gap-3 w-1/4">
            <button onClick={toggleMute} className="text-white/70 hover:text-white transition">
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-24 accent-[#fa243c] cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
