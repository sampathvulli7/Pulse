import React, { useState } from 'react';
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
    activePresetName,
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
  } = usePlayerStore();

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);

  if (!isOpen || !currentTrack) return null;

  const currentDisplayTime = isSeeking ? seekTime : currentTime;

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-white animate-in slide-in-from-bottom duration-300 overflow-y-auto">
      {/* Background ambient glow matching artwork */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40 dark:opacity-100">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/20 dark:bg-indigo-600/25 rounded-full blur-3xl"
          style={{ willChange: 'transform' }}
        />
        <div
          className="absolute top-1/3 -right-32 w-96 h-96 bg-purple-500/15 dark:bg-purple-600/20 rounded-full blur-3xl"
          style={{ willChange: 'transform' }}
        />
      </div>

      {/* Header bar */}
      <div className="relative z-10 p-4 pt-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/60 bg-white/60 dark:bg-slate-950/40 backdrop-blur-md shrink-0">
        <button
          onClick={onClose}
          className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-full active:bg-slate-100 dark:active:bg-slate-800 transition"
          aria-label="Dismiss now playing"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        <div className="text-center">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
            Playing From
          </span>
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
            <span>HQ Audio Engine</span>
          </div>
        </div>

        <div className="w-8">
          {activePresetName !== 'Flat' && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
              EQ
            </span>
          )}
        </div>
      </div>

      {/* Main Now Playing View */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-between px-6 py-4 max-w-md mx-auto w-full space-y-3.5">
        {/* Artwork with clean shadow */}
        <div className="w-52 h-52 sm:w-64 sm:h-64 aspect-square rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 relative group shrink-0">
          <img
            src={currentTrack.coverArtUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=85'}
            alt={currentTrack.title}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=85';
            }}
            className="w-full h-full object-cover select-none"
          />
          {isPlaying && (
            <div className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1.5 text-[9px] text-white font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>HQ PLAYBACK</span>
            </div>
          )}
        </div>

        {/* Track Title and Artist */}
        <div className="w-full text-center space-y-0.5">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white truncate px-2">
            {currentTrack.title}
          </h2>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
            {currentTrack.artist}
          </p>
          <div className="flex items-center justify-center gap-1.5 pt-0.5">
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {currentTrack.sourceType === 'local' ? 'Local' : currentTrack.sourceType.toUpperCase()}
            </span>
            {currentTrack.bpm && (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {Math.round(currentTrack.bpm)} BPM
              </span>
            )}
            {currentTrack.genre && (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {currentTrack.genre}
              </span>
            )}
          </div>
        </div>

        {/* Timeline & Scrubber */}
        <div className="w-full space-y-1.5 pt-1">
          <div className="relative flex items-center h-5">
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
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-500"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 px-1">
            <span>{formatTime(currentDisplayTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls Row */}
        <div className="w-full flex items-center justify-between px-2">
          {/* Shuffle Button */}
          <button
            onClick={cycleShuffle}
            className={`p-2.5 rounded-full transition active:scale-95 ${
              shuffleMode !== 'off'
                ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/20'
                : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
            title={`Shuffle: ${shuffleMode}`}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Previous Button */}
          <button
            onClick={() => prevTrack()}
            className="p-2.5 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-95 transition"
            title="Previous Track"
          >
            <SkipBack className="w-6 h-6 fill-slate-700 dark:fill-slate-300" />
          </button>

          {/* Large Center Play/Pause Button */}
          <button
            onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-xl shadow-slate-900/20 dark:shadow-white/20 active:scale-90 transition transform"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-white dark:fill-slate-950" />
            ) : (
              <Play className="w-6 h-6 fill-white dark:fill-slate-950 ml-0.5" />
            )}
          </button>

          {/* Next Button */}
          <button
            onClick={() => nextTrack()}
            className="p-2.5 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-95 transition"
            title="Next Track (Unlimited Skips)"
          >
            <SkipForward className="w-6 h-6 fill-slate-700 dark:fill-slate-300" />
          </button>

          {/* Repeat Button */}
          <button
            onClick={cycleRepeat}
            className={`p-2.5 rounded-full transition active:scale-95 ${
              repeatMode !== 'off'
                ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/20'
                : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          </button>
        </div>

        {/* Secondary Controls: Speed & A-B Loop & Volume */}
        <div className="w-full flex items-center justify-between gap-2 pt-1">
          <select
            value={playbackRate}
            onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
            className="text-[11px] bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 font-mono cursor-pointer shrink-0"
          >
            <option value="0.75">0.75x</option>
            <option value="1">1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
          </select>

          <button
            onClick={handleABClick}
            className={`flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-lg border transition shrink-0 ${
              abLoop.enabled
                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
            }`}
          >
            <Bookmark className="w-3 h-3" />
            {abLoop.enabled ? `Loop` : 'A-B Loop'}
          </button>

          <div className="flex items-center gap-1.5 flex-1 max-w-[150px]">
            <button onClick={toggleMute} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5 shrink-0">
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-500" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-500"
            />
          </div>
        </div>

        {/* Quick Drawer Action Pills (Open smoothly over Now Playing without losing playback view) */}
        <div className="w-full grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80 shrink-0">
          <button
            data-testid="mobile-btn-eq"
            onClick={onOpenEQ}
            className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:bg-slate-100 dark:active:bg-slate-800 transition shadow-2xs"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>10-Band EQ</span>
          </button>
          <button
            data-testid="mobile-btn-lyrics"
            onClick={onOpenLyrics}
            className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:bg-slate-100 dark:active:bg-slate-800 transition shadow-2xs"
          >
            <Mic2 className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
            <span>Lyrics</span>
          </button>
          <button
            data-testid="mobile-btn-queue"
            onClick={onOpenQueue}
            className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:bg-slate-100 dark:active:bg-slate-800 transition relative shadow-2xs"
          >
            <ListMusic className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Queue</span>
            {(priorityQueue.length > 0 || contextQueue.length > 0) && (
              <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-600 text-white">
                {priorityQueue.length + contextQueue.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
