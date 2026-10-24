import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Sliders,
  ListMusic,
  Mic2,
  Repeat1,
  Bookmark,
  Heart,
} from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';

interface PlayerBarProps {
  onToggleEQ: () => void;
  onToggleQueue: () => void;
  onToggleLyrics: () => void;
  isEQOpen: boolean;
  isQueueOpen: boolean;
  isLyricsOpen: boolean;
  onExpandMobileNowPlaying?: () => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  onToggleEQ,
  onToggleQueue,
  onToggleLyrics,
  isEQOpen,
  isQueueOpen,
  isLyricsOpen,
  onExpandMobileNowPlaying,
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
    toggleCurrentTrackLike,
  } = usePlayerStore();

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    seek(val);
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

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const loopStartPercent = duration > 0 && abLoop.enabled ? (abLoop.startTime / duration) * 100 : 0;
  const loopEndPercent = duration > 0 && abLoop.enabled ? (abLoop.endTime / duration) * 100 : 0;

  return (
    <>
      {/* Desktop Workstation PlayerBar */}
      <footer className="hidden md:flex h-24 bg-white/95 dark:bg-slate-950/95 border-t border-slate-200 dark:border-slate-800/80 px-6 items-center justify-between z-40 shrink-0 select-none shadow-sm transition-colors">
        {/* Left: Track Info */}
        <div className="flex items-center gap-3 w-1/4 min-w-[200px]">
          {currentTrack ? (
            <>
              <img
                src={
                  currentTrack.coverArtUrl ||
                  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80'
                }
                alt=""
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80';
                }}
                className="w-14 h-14 rounded-xl object-cover shadow-xs border border-slate-200 dark:border-slate-700/50"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {currentTrack.title}
                  </div>
                  <button
                    onClick={toggleCurrentTrackLike}
                    className="p-1 text-slate-400 hover:text-rose-500 transition shrink-0"
                    title={currentTrack.isFavorite ? 'Unlike' : 'Like'}
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${
                        currentTrack.isFavorite
                          ? 'fill-rose-500 text-rose-500'
                          : 'text-slate-400 hover:text-rose-500'
                      }`}
                    />
                  </button>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{currentTrack.artist}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {currentTrack.sourceType === 'local' ? 'Local' : currentTrack.sourceType.toUpperCase()}
                  </span>
                  {currentTrack.bpm && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {Math.round(currentTrack.bpm)} BPM
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400 italic">No track selected</div>
          )}
        </div>

        {/* Center: Controls & Scrubber */}
        <div className="flex flex-col items-center gap-2 max-w-xl w-2/4">
          {/* Buttons Row */}
          <div className="flex items-center gap-4">
            {/* Smart Shuffle */}
            <button
              onClick={cycleShuffle}
              className={`relative p-2 rounded-xl transition ${
                shuffleMode !== 'off'
                  ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
              }`}
              title={`Shuffle: ${shuffleMode}`}
            >
              <Shuffle className="w-4 h-4" />
              {shuffleMode !== 'off' && (
                <span className="absolute -top-1.5 -right-3 text-[9px] font-mono uppercase bg-indigo-600 text-white px-1 rounded-sm">
                  {shuffleMode === 'fisher-yates' ? 'F-Y' : shuffleMode === 'artist-spread' ? 'ART' : 'BPM'}
                </span>
              )}
            </button>

            {/* Previous Track */}
            <button
              onClick={() => prevTrack()}
              className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition active:scale-95"
              title="Previous Track"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:scale-105 active:scale-95 flex items-center justify-center shadow-md transition"
              title="Play / Pause (Space)"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Next Track (Zero skip limit!) */}
            <button
              onClick={() => nextTrack()}
              className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition active:scale-95"
              title="Next Track (Unlimited Skips)"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            {/* Repeat */}
            <button
              onClick={cycleRepeat}
              className={`p-2 rounded-xl transition ${
                repeatMode !== 'off'
                  ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>

            {/* A-B Loop Section */}
            <button
              onClick={handleABClick}
              className={`flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-lg border transition ${
                abLoop.enabled
                  ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-700'
              }`}
              title={abLoop.enabled ? 'Clear A-B Loop' : 'Set A-B Loop (Repeat chorus/solo)'}
            >
              <Bookmark className="w-3 h-3" />
              {abLoop.enabled ? `A-B [${Math.round(abLoop.startTime)}s - ${Math.round(abLoop.endTime)}s]` : 'A-B'}
            </button>

            {/* Speed Selector */}
            <select
              value={playbackRate}
              onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
              className="text-[11px] bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-0.5 font-mono cursor-pointer"
              title="Playback Speed"
            >
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1.0x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2.0x</option>
            </select>
          </div>

          {/* Timeline Scrubber */}
          <div className="w-full flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400 w-10 text-right">
              {formatTime(currentTime)}
            </span>

            <div className="relative flex-1 flex items-center h-5">
              {abLoop.enabled && (
                <div
                  className="absolute h-1.5 bg-amber-400/50 rounded-full z-10 pointer-events-none"
                  style={{
                    left: `${loopStartPercent}%`,
                    width: `${Math.max(2, loopEndPercent - loopStartPercent)}%`,
                  }}
                />
              )}

              <input
                type="range"
                min="0"
                max={duration || 100}
                step="0.1"
                value={currentTime}
                onChange={handleScrubberChange}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-white relative z-20"
              />
            </div>

            <span className="text-[11px] font-mono text-slate-400 w-10">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right: Workstation Tools */}
        <div className="flex items-center justify-end gap-2 w-1/4 min-w-[200px]">
          {/* Synced Lyrics Toggle */}
          <button
            onClick={onToggleLyrics}
            className={`p-2 rounded-xl transition ${
              isLyricsOpen
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Toggle Synchronized Lyrics (L)"
          >
            <Mic2 className="w-4 h-4" />
          </button>

          {/* EQ Workstation Toggle */}
          <button
            onClick={onToggleEQ}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              isEQOpen
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
            title="10-Band Parametric Equalizer (E)"
          >
            <Sliders className="w-4 h-4" />
            <span className="text-[11px] font-mono hidden xl:inline">{activePresetName || 'EQ'}</span>
          </button>

          {/* Dual Queue Drawer Toggle */}
          <button
            onClick={onToggleQueue}
            className={`relative p-2 rounded-xl transition ${
              isQueueOpen
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Playback Queue (Q)"
          >
            <ListMusic className="w-4 h-4" />
            {(priorityQueue.length > 0 || contextQueue.length > 0) && (
              <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 w-4 h-4 rounded-full flex items-center justify-center">
                {priorityQueue.length + contextQueue.length}
              </span>
            )}
          </button>

          {/* Volume Slider */}
          <div className="flex items-center gap-1.5 ml-1">
            <button onClick={toggleMute} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-500" />
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
              className="w-18 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-white"
              title={`Volume: ${Math.round(volume * 100)}%`}
            />
          </div>
        </div>
      </footer>

      {/* Mobile Floating Mini-Player Bar (Phone Screens < 768px) */}
      <div className="md:hidden flex flex-col z-40 shrink-0 select-none border-t border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl transition-colors">
        {/* Progress line */}
        <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Mini Player Touch Surface */}
        <div
          onClick={onExpandMobileNowPlaying}
          className="flex items-center justify-between px-3.5 py-2 cursor-pointer active:bg-slate-100 dark:active:bg-slate-900/60 transition"
        >
          {/* Left: Artwork + Title */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
            <img
              src={
                currentTrack?.coverArtUrl ||
                'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80'
              }
              alt=""
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80';
              }}
              className="w-10 h-10 rounded-lg object-cover shadow-xs border border-slate-200 dark:border-slate-800 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {currentTrack ? currentTrack.title : 'No track selected'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                <span>{currentTrack ? currentTrack.artist : 'Tap to choose song'}</span>
              </div>
            </div>
          </div>

          {/* Right: Quick Touch Playback Actions */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {currentTrack && (
              <button
                onClick={toggleCurrentTrackLike}
                className="p-1.5 text-slate-400 hover:text-rose-500 active:scale-90 transition"
              >
                <Heart
                  className={`w-4 h-4 ${
                    currentTrack.isFavorite ? 'fill-rose-500 text-rose-500' : 'text-slate-400'
                  }`}
                />
              </button>
            )}
            <button
              onClick={togglePlay}
              disabled={!currentTrack}
              className="w-9 h-9 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 flex items-center justify-center active:scale-90 transition shadow-sm"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>
            <button
              onClick={() => nextTrack()}
              disabled={!currentTrack}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-90 transition"
              aria-label="Next track"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
