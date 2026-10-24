import React, { useState, useRef } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Sliders,
  ListMusic,
  Mic2,
  Volume2,
  VolumeX,
  Bookmark,
  Sparkles,
  Heart,
  Radio,
} from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';

interface MobileNowPlayingProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenEQ: () => void;
  onOpenQueue: () => void;
  onOpenLyrics: () => void;
}

export const MobileNowPlaying: React.FC<MobileNowPlayingProps> = ({
  isOpen,
  onClose,
  onOpenEQ,
  onOpenQueue,
  onOpenLyrics,
}) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackRate,
    shuffleMode,
    repeatMode,
    abLoop,
    timeDisplayMode,
    toggleTimeDisplayMode,
    priorityQueue,
    contextQueue,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    setPlaybackRate,
    setShuffleMode,
    setRepeatMode,
    setABLoop,
    clearABLoop,
    toggleCurrentTrackLike,
    setIsAudioQualityModalOpen,
    setIsFullScreenSingOpen,
    spatialAudioMode,
  } = usePlayerStore();

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);

  // Touch Swipe-Down to Dismiss Sheet State
  const [dragOffset, setDragOffset] = useState(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);

  if (!isOpen || !currentTrack) return null;

  const currentDisplayTime = isSeeking ? seekTime : currentTime;

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const remainingSeconds = Math.max(0, (duration || 0) - currentDisplayTime);
  const formattedRightTime =
    timeDisplayMode === 'remaining'
      ? `-${formatTime(remainingSeconds)}`
      : formatTime(duration);

  const cycleShuffle = () => {
    const modes: any[] = ['off', 'fisher-yates', 'artist-spread', 'bpm-flow'];
    const next = modes[(modes.indexOf(shuffleMode) + 1) % modes.length];
    setShuffleMode(next);
  };

  const cycleRepeat = () => {
    const modes: any[] = ['off', 'all', 'one'];
    const next = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
    setRepeatMode(next);
  };

  const handleABClick = () => {
    if (!abLoop.enabled) {
      setABLoop(currentTime, Math.min(currentTime + 8, duration || currentTime + 8));
    } else {
      clearABLoop();
    }
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSeekTime(parseFloat(e.target.value));
  };

  const handleSeekCommit = () => {
    if (isSeeking) {
      seek(seekTime);
      setIsSeeking(false);
    }
  };

  // Touch Swipe Down Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    if (deltaY > 0) {
      // Pulling downwards with rubberband damping
      setDragOffset(deltaY * 0.85);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (dragOffset > 100) {
      onClose();
    }
    setDragOffset(0);
  };

  return (
    <div
      id="mobile-now-playing-sheet"
      data-testid="mobile-now-playing-sheet"
      className="fixed inset-0 z-[150] flex flex-col bg-[#f2f2f7]/95 dark:bg-[#121214]/95 backdrop-blur-3xl text-[#1d1d1f] dark:text-white select-none transition-transform duration-200 overflow-y-auto"
      style={{
        transform: dragOffset > 0 ? `translate3d(0, ${dragOffset}px, 0)` : 'translate3d(0, 0, 0)',
        willChange: 'transform',
      }}
    >
      {/* Background Fluid Cupertino Ambient Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40 dark:opacity-60">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 bg-[#fa243c]/20 dark:bg-[#fa243c]/25 rounded-full blur-[100px]"
          style={{ willChange: 'transform' }}
        />
        <div
          className="absolute top-1/3 -right-32 w-96 h-96 bg-purple-500/20 dark:bg-purple-600/20 rounded-full blur-[100px]"
          style={{ willChange: 'transform' }}
        />
      </div>

      {/* Top Touch Drag Handle Bar (iOS Sheet Handle) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full pt-3 pb-1 flex flex-col items-center justify-center shrink-0 cursor-grab active:cursor-grabbing"
      >
        <div className="w-10 h-1.5 bg-black/20 dark:bg-white/20 rounded-full" />
      </div>

      {/* Header bar */}
      <div className="relative z-10 px-5 py-2 flex items-center justify-between shrink-0">
        <button
          id="mobile-sheet-dismiss-btn"
          onClick={onClose}
          className="p-2 -ml-2 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white rounded-full active:bg-black/5 dark:active:bg-white/10 transition"
          aria-label="Close now playing"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        <div className="text-center">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#86868b] dark:text-[#a1a1a6]">
            Playing From
          </span>
          <div className="text-xs font-bold text-[#1d1d1f] dark:text-white flex items-center justify-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-[#fa243c] animate-pulse" />
            <span>Sampath's Studio Workstation</span>
          </div>
        </div>

        {/* Audio Quality Badge Button */}
        <button
          onClick={() => setIsAudioQualityModalOpen(true)}
          className="apple-lossless-badge font-bold text-[10px]"
          title="Configure Audio Quality & Spatial Audio"
        >
          {currentTrack.isHiRes ? 'Hi-Res' : currentTrack.isLossless ? 'Lossless' : '320k'}
        </button>
      </div>

      {/* Main Interactive Mobile View */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-between px-6 py-2 max-w-sm mx-auto w-full space-y-4">
        {/* Large Tactile Squircle Cover Artwork */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="w-60 h-60 sm:w-72 sm:h-72 aspect-square rounded-3xl overflow-hidden shadow-2xl border border-black/5 dark:border-white/10 bg-black/5 dark:bg-[#181818] relative group shrink-0"
        >
          <img
            src={
              currentTrack.coverArtUrl ||
              'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=85'
            }
            alt={currentTrack.title}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src =
                'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=85';
            }}
            className="w-full h-full object-cover select-none"
          />

          {/* Spatial Audio Badge Overlay */}
          {spatialAudioMode !== 'off' && (
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[9px] text-white font-mono font-bold border border-white/20">
              <Sparkles className="w-2.5 h-2.5 text-purple-400 fill-current" />
              <span>SPATIAL 3D</span>
            </div>
          )}

          {/* Heart / Favorite Button */}
          <button
            onClick={toggleCurrentTrackLike}
            className="absolute top-3 right-3 p-2.5 rounded-full bg-white/80 dark:bg-black/60 backdrop-blur-md text-[#1d1d1f] dark:text-white shadow-md active:scale-90 transition"
            title={currentTrack.isFavorite ? 'Remove from favorites' : 'Favorite track'}
          >
            <Heart
              className={`w-4 h-4 ${
                currentTrack.isFavorite ? 'fill-[#fa243c] text-[#fa243c]' : 'text-current'
              }`}
            />
          </button>
        </div>

        {/* Track Title and Artist with Badges */}
        <div className="w-full text-center space-y-1">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#1d1d1f] dark:text-white truncate px-2">
            {currentTrack.title}
          </h2>
          <p className="text-sm font-semibold text-[#6e6e73] dark:text-[#a1a1a6] truncate">
            {currentTrack.artist}
          </p>

          <div className="flex items-center justify-center gap-1.5 pt-1 flex-wrap">
            <button
              onClick={() => setIsAudioQualityModalOpen(true)}
              className="apple-lossless-badge text-[9px]"
            >
              {currentTrack.codec || 'ALAC'} • {currentTrack.sampleRate ? `${Math.round(currentTrack.sampleRate / 1000)}kHz` : '48kHz'}
            </button>
            {currentTrack.bpm && (
              <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#6e6e73] dark:text-[#b3b3b3]">
                {Math.round(currentTrack.bpm)} BPM
              </span>
            )}
            {currentTrack.genre && (
              <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#6e6e73] dark:text-[#b3b3b3]">
                {currentTrack.genre}
              </span>
            )}
          </div>
        </div>

        {/* Scrubber & Timeline with Remaining Time Toggle */}
        <div className="w-full space-y-1 pt-1">
          <div className="relative flex items-center h-8">
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentDisplayTime}
              onMouseDown={() => setIsSeeking(true)}
              onTouchStart={() => setIsSeeking(true)}
              onChange={handleScrubberChange}
              onMouseUp={handleSeekCommit}
              onTouchEnd={handleSeekCommit}
              className="w-full h-2 bg-black/10 dark:bg-white/20 rounded-full appearance-none cursor-pointer accent-[#fa243c]"
            />
          </div>
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-[#86868b] dark:text-[#a1a1a6] px-1">
            <span>{formatTime(currentDisplayTime)}</span>
            <button
              onClick={toggleTimeDisplayMode}
              className="hover:text-[#fa243c] transition active:scale-95"
              title="Tap to toggle between remaining time and duration"
            >
              {formattedRightTime}
            </button>
          </div>
        </div>

        {/* Primary Playback Controls Row (>= 48px Touch Targets) */}
        <div className="w-full flex items-center justify-between px-2">
          {/* Shuffle Button */}
          <button
            onClick={cycleShuffle}
            className={`p-3 rounded-full transition active:scale-95 ${
              shuffleMode !== 'off'
                ? 'text-[#fa243c] bg-[#fa243c]/15'
                : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white'
            }`}
            title={`Shuffle: ${shuffleMode}`}
          >
            <Shuffle className="w-5 h-5" />
          </button>

          {/* Previous Button */}
          <button
            onClick={() => prevTrack()}
            className="p-3 text-[#1d1d1f] dark:text-white active:scale-90 transition"
            title="Previous Track"
          >
            <SkipBack className="w-7 h-7 fill-current" />
          </button>

          {/* Large Center Play/Pause Button (64px) */}
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-[#fa243c] hover:bg-[#d91b32] text-white flex items-center justify-center shadow-xl shadow-[#fa243c]/30 active:scale-90 transition transform"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-0.5" />
            )}
          </button>

          {/* Next Button */}
          <button
            onClick={() => nextTrack()}
            className="p-3 text-[#1d1d1f] dark:text-white active:scale-90 transition"
            title="Next Track (Unlimited Skips)"
          >
            <SkipForward className="w-7 h-7 fill-current" />
          </button>

          {/* Repeat Button */}
          <button
            onClick={cycleRepeat}
            className={`p-3 rounded-full transition active:scale-95 ${
              repeatMode !== 'off'
                ? 'text-[#fa243c] bg-[#fa243c]/15'
                : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white'
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
          </button>
        </div>

        {/* Speed & A-B Loop & Volume */}
        <div className="w-full flex items-center justify-between gap-2 pt-1">
          <select
            value={playbackRate}
            onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
            className="text-xs bg-black/5 dark:bg-white/10 text-[#1d1d1f] dark:text-white border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 font-mono cursor-pointer shrink-0"
          >
            <option value="0.75">0.75x</option>
            <option value="1">1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2.0x</option>
          </select>

          <button
            onClick={handleABClick}
            className={`flex items-center gap-1 text-xs font-mono px-3 py-1.5 rounded-lg border transition shrink-0 ${
              abLoop.enabled
                ? 'bg-[#fa243c] text-white border-[#fa243c] shadow-xs'
                : 'bg-black/5 dark:bg-white/10 text-[#6e6e73] dark:text-[#a1a1a6] border-black/10 dark:border-white/10'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>{abLoop.enabled ? 'Loop Active' : 'A-B Loop'}</span>
          </button>

          <div className="flex items-center gap-1.5 flex-1 max-w-[140px]">
            <button
              onClick={toggleMute}
              className="text-[#86868b] hover:text-[#fa243c] p-1 shrink-0"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-[#fa243c]" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-black/15 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#fa243c]"
            />
          </div>
        </div>

        {/* Quick Drawer Action Pills (Apple Music Sing, 10-Band EQ, Lyrics, Queue) */}
        <div className="w-full grid grid-cols-4 gap-2 pt-2 border-t border-black/5 dark:border-white/10 shrink-0 pb-safe">
          <button
            onClick={() => {
              onClose();
              setIsFullScreenSingOpen(true);
            }}
            className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-[#fa243c] text-[#1d1d1f] dark:text-white hover:text-white transition active:scale-95 shadow-xs"
            title="Launch Apple Music Sing Full-Screen Karaoke"
          >
            <Sparkles className="w-4 h-4 text-[#fa243c]" />
            <span className="text-[10px] font-bold">Sing</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenEQ();
            }}
            className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-[#fa243c] text-[#1d1d1f] dark:text-white hover:text-white transition active:scale-95 shadow-xs"
            title="10-Band Equalizer"
          >
            <Sliders className="w-4 h-4 text-[#6e6e73] dark:text-[#a1a1a6]" />
            <span className="text-[10px] font-bold">EQ</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenLyrics();
            }}
            className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-[#fa243c] text-[#1d1d1f] dark:text-white hover:text-white transition active:scale-95 shadow-xs"
            title="Synced Lyrics"
          >
            <Mic2 className="w-4 h-4 text-[#6e6e73] dark:text-[#a1a1a6]" />
            <span className="text-[10px] font-bold">Lyrics</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenQueue();
            }}
            className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-[#fa243c] text-[#1d1d1f] dark:text-white hover:text-white transition active:scale-95 shadow-xs relative"
            title="Playback Queue"
          >
            <ListMusic className="w-4 h-4 text-[#6e6e73] dark:text-[#a1a1a6]" />
            <span className="text-[10px] font-bold">Queue</span>
            {(priorityQueue.length > 0 || contextQueue.length > 0) && (
              <span className="absolute top-1 right-2 text-[8px] font-bold px-1 rounded-full bg-[#fa243c] text-white">
                {priorityQueue.length + contextQueue.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
