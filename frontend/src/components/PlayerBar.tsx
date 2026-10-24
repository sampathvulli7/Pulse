import React, { useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Sliders,
  ListMusic,
  Mic2,
  Bookmark,
  Heart,
  Disc3,
  Maximize2,
  Sun,
  Moon,
  Sparkles,
  Library,
  Search,
} from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';

interface PlayerBarProps {
  onExpandMobileNowPlaying?: () => void;
  onOpenMobileLibrary?: () => void;
  onOpenMobileSearch?: () => void;
  activeView?: 'library' | 'search';
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  onExpandMobileNowPlaying,
  onOpenMobileLibrary,
  onOpenMobileSearch,
  activeView = 'library',
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
    rightPanelTab,
    toggleRightPanelTab,
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
    theme,
    toggleTheme,
    timeDisplayMode,
    toggleTimeDisplayMode,
    setIsAudioQualityModalOpen,
    setIsFullScreenSingOpen,
  } = usePlayerStore();

  const [isScrubbing, setIsScrubbing] = useState(false);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

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

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    seek(ratio * duration);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const loopStartPercent = duration > 0 && abLoop.enabled ? (abLoop.startTime / duration) * 100 : 0;
  const loopEndPercent = duration > 0 && abLoop.enabled ? (abLoop.endTime / duration) * 100 : 0;

  const remainingSeconds = Math.max(0, duration - currentTime);
  const formattedRightTime =
    timeDisplayMode === 'remaining' ? `-${formatTime(remainingSeconds)}` : formatTime(duration);

  return (
    <>
      {/* Desktop Apple Music + Spotify Hybrid 92px Player Bar */}
      <footer className="spotify-now-playing-bar hidden md:flex items-center justify-between w-full h-[92px] bg-white/80 dark:bg-[#121214]/90 backdrop-blur-2xl px-5 text-[#1d1d1f] dark:text-white z-50 select-none border-t border-black/5 dark:border-white/5 transition-colors">
        {/* SEGMENT 1: LEFT (30%, min-width 200px) - Now Playing Widget */}
        <div className="flex items-center gap-3.5 w-[30%] min-w-[200px] max-w-[420px]">
          {currentTrack ? (
            <>
              <div
                onClick={() => setIsFullScreenSingOpen(true)}
                className="relative group w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-slate-200 dark:bg-[#282828] shadow-sm border border-black/5 dark:border-white/5 cursor-pointer"
                title="Open Apple Music Sing Fullscreen"
              >
                <img
                  src={
                    currentTrack.coverArtUrl ||
                    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=120&q=80'
                  }
                  alt={currentTrack.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <Maximize2 className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-[#1d1d1f] dark:text-white truncate hover:underline cursor-pointer">
                  {currentTrack.title}
                </div>
                <div className="text-xs text-[#6e6e73] dark:text-[#a1a1a6] truncate hover:underline cursor-pointer mt-0.5">
                  {currentTrack.artist}
                </div>

                {/* Apple Music Lossless & Hi-Res Badge Button */}
                <div className="flex items-center gap-1.5 mt-1">
                  <button
                    onClick={() => setIsAudioQualityModalOpen(true)}
                    className="apple-lossless-badge"
                    title="Configure Audio Quality & Spatial DSP"
                  >
                    {currentTrack.isHiRes ? 'Hi-Res Lossless' : currentTrack.isLossless ? 'Lossless' : 'AAC 320k'}
                  </button>
                </div>
              </div>

              <button
                onClick={toggleCurrentTrackLike}
                className="p-1.5 text-[#86868b] hover:text-[#fa243c] transition shrink-0"
                title={currentTrack.isFavorite ? 'Remove from Favorites' : 'Love this Song'}
              >
                <Heart
                  className={`w-4 h-4 ${
                    currentTrack.isFavorite
                      ? 'fill-[#fa243c] text-[#fa243c]'
                      : 'text-[#86868b] hover:text-[#fa243c]'
                  }`}
                />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#fa243c] animate-pulse" />
              <span className="text-xs font-bold tracking-wider text-[#86868b] uppercase">Sampath's Studio</span>
            </div>
          )}
        </div>

        {/* SEGMENT 2: CENTER (40%, max-width 722px) - Cupertino Transport Controls & Playhead */}
        <div className="flex flex-col items-center justify-center w-[40%] max-w-[722px] gap-1.5">
          {/* Controls Buttons Row */}
          <div className="flex items-center gap-4">
            {/* Shuffle */}
            <button
              onClick={cycleShuffle}
              className={`relative p-1.5 rounded-full transition ${
                shuffleMode !== 'off'
                  ? 'text-[#fa243c] active-dot-indicator'
                  : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white'
              }`}
              title={`Shuffle: ${shuffleMode.toUpperCase()}`}
            >
              <Shuffle className="w-4 h-4" />
              {shuffleMode !== 'off' && (
                <span className="absolute -top-2 -right-3 text-[8px] font-mono uppercase bg-[#fa243c] text-white px-1 rounded-xs font-bold">
                  {shuffleMode === 'fisher-yates' ? 'F-Y' : shuffleMode === 'artist-spread' ? 'ART' : 'BPM'}
                </span>
              )}
            </button>

            {/* Previous Track */}
            <button
              onClick={() => prevTrack()}
              className="p-1.5 text-[#1d1d1f] dark:text-white hover:opacity-75 transition active:scale-95"
              title="Previous Track"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            {/* Play / Pause 36px Circular Cupertino Button */}
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-full bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] hover:scale-105 active:scale-95 flex items-center justify-center shadow-md transition"
              title="Play / Pause (Space)"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            {/* Next Track */}
            <button
              onClick={() => nextTrack()}
              className="p-1.5 text-[#1d1d1f] dark:text-white hover:opacity-75 transition active:scale-95"
              title="Next Track"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            {/* Repeat */}
            <button
              onClick={cycleRepeat}
              className={`relative p-1.5 rounded-full transition ${
                repeatMode !== 'off'
                  ? 'text-[#fa243c] active-dot-indicator'
                  : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>

            {/* A-B Loop Marker Control */}
            <button
              onClick={handleABClick}
              className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border transition ${
                abLoop.enabled
                  ? 'bg-[#fa243c]/15 text-[#fa243c] border-[#fa243c]/40 font-semibold'
                  : 'bg-black/5 dark:bg-white/5 text-[#86868b] border-black/5 dark:border-white/10 hover:text-[#1d1d1f] dark:hover:text-white'
              }`}
              title={abLoop.enabled ? 'Clear A-B Loop' : 'Set A-B Loop (Repeat section)'}
            >
              <Bookmark className="w-3 h-3" />
              <span>{abLoop.enabled ? `A-B [${Math.round(abLoop.startTime)}s-${Math.round(abLoop.endTime)}s]` : 'A-B'}</span>
            </button>

            {/* Playback Rate Selector */}
            <select
              value={playbackRate}
              onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
              className="text-[10px] bg-black/5 dark:bg-[#181818] text-[#1d1d1f] dark:text-[#b3b3b3] border border-black/10 dark:border-white/10 rounded px-1.5 py-0.5 font-mono cursor-pointer"
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

          {/* Apple Music Cupertino Playhead Scrubber */}
          <div className="playback-progressbar-group w-full max-w-[600px]">
            <span className="text-[11px] font-mono text-[#86868b] dark:text-[#a1a1a6] w-10 text-right">
              {formatTime(currentTime)}
            </span>

            <div
              ref={progressBarRef}
              onClick={handleProgressBarClick}
              className="playback-progressbar flex-1"
            >
              <div className="playback-progressbar-track">
                {/* A-B Loop Highlight Range */}
                {abLoop.enabled && (
                  <div
                    className="absolute h-full bg-amber-400/60 rounded-full z-10 pointer-events-none"
                    style={{
                      left: `${loopStartPercent}%`,
                      width: `${Math.max(2, loopEndPercent - loopStartPercent)}%`,
                    }}
                  />
                )}

                {/* Progress Fill */}
                <div
                  className="playback-progressbar-fill"
                  style={{ width: `${progressPercent}%` }}
                />

                {/* Cupertino Hover Thumb */}
                <div
                  className="playback-progressbar-thumb"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Toggleable Remaining / Total Time (Apple Music style) */}
            <button
              onClick={toggleTimeDisplayMode}
              className="text-[11px] font-mono text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white w-12 text-left cursor-pointer transition"
              title="Click to toggle elapsed / remaining time"
            >
              {formattedRightTime}
            </button>
          </div>
        </div>

        {/* SEGMENT 3: RIGHT (30%, min-width 200px) - Apple Music & Workstation Toggles */}
        <div className="flex items-center justify-end gap-2.5 w-[30%] min-w-[200px] max-w-[420px]">
          {/* Apple Music Sing / Ambient Fullscreen */}
          <button
            onClick={() => setIsFullScreenSingOpen(true)}
            className="p-1.5 rounded-lg text-[#6e6e73] hover:text-[#fa243c] dark:text-[#a1a1a6] dark:hover:text-[#fa243c] hover:bg-black/5 dark:hover:bg-white/5 transition"
            title="Apple Music Sing (Karaoke & Ambient Screen)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Theme Toggle (Light / Dark) */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Now Playing View Toggle */}
          <button
            onClick={() => toggleRightPanelTab('now-playing')}
            className={`p-1.5 rounded-lg transition ${
              rightPanelTab === 'now-playing'
                ? 'text-[#fa243c] active-dot-indicator'
                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white'
            }`}
            title="Now Playing View"
          >
            <Disc3 className="w-4 h-4" />
          </button>

          {/* Synced Lyrics Toggle */}
          <button
            onClick={() => toggleRightPanelTab('lyrics')}
            className={`p-1.5 rounded-lg transition ${
              rightPanelTab === 'lyrics'
                ? 'text-[#fa243c] active-dot-indicator'
                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white'
            }`}
            title="Lyrics (L)"
          >
            <Mic2 className="w-4 h-4" />
          </button>

          {/* Queue Drawer Toggle */}
          <button
            onClick={() => toggleRightPanelTab('queue')}
            className={`relative p-1.5 rounded-lg transition ${
              rightPanelTab === 'queue'
                ? 'text-[#fa243c] active-dot-indicator'
                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white'
            }`}
            title="Queue (Q)"
          >
            <ListMusic className="w-4 h-4" />
            {(priorityQueue.length > 0 || contextQueue.length > 0) && (
              <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-[#fa243c] text-white w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-xs">
                {priorityQueue.length + contextQueue.length}
              </span>
            )}
          </button>

          {/* 10-Band EQ & Visualizer Toggle */}
          <button
            onClick={() => toggleRightPanelTab('eq')}
            className={`p-1.5 rounded-lg transition ${
              rightPanelTab === 'eq'
                ? 'text-[#fa243c] active-dot-indicator'
                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white'
            }`}
            title="Parametric EQ & Visualizer (E)"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Volume Slider Group */}
          <div className="flex items-center gap-1.5 ml-2">
            <button
              onClick={toggleMute}
              className="text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white transition"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-[#ff3b30]" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            <div className="w-20 group flex items-center">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1 bg-black/15 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#fa243c]"
                title={`Volume: ${Math.round(volume * 100)}%`}
              />
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Cupertino Floating Mini-Player & Bottom Navigation Dock (< 768px) */}
      <div className="md:hidden flex flex-col z-50 shrink-0 select-none bg-white/90 dark:bg-[#121214]/90 backdrop-blur-2xl border-t border-black/10 dark:border-white/10 transition-colors">
        {/* Continuous Progress Indicator Line */}
        <div className="w-full h-1 bg-black/10 dark:bg-white/10 overflow-hidden relative">
          <div
            className="h-full bg-[#fa243c] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Floating Mini Player Card */}
        <div
          id="mobile-mini-player"
          data-testid="mobile-mini-player"
          onClick={onExpandMobileNowPlaying}
          className="flex items-center justify-between px-3 py-2 cursor-pointer active:bg-black/5 dark:active:bg-white/5 transition"
        >
          {/* Cover Art + Title + Quality Badge */}
          <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
            <div className="relative shrink-0">
              <img
                src={
                  currentTrack?.coverArtUrl ||
                  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80'
                }
                alt=""
                className="w-11 h-11 rounded-xl object-cover shadow-sm border border-black/5 dark:border-white/5"
              />
              {isPlaying && (
                <div className="absolute inset-0 bg-black/20 rounded-xl flex items-center justify-center pointer-events-none">
                  <div className="flex items-end gap-0.5 h-3">
                    <span className="w-0.5 h-2 bg-white rounded-full animate-pulse" />
                    <span className="w-0.5 h-3 bg-white rounded-full animate-pulse delay-75" />
                    <span className="w-0.5 h-1.5 bg-white rounded-full animate-pulse delay-150" />
                  </div>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#1d1d1f] dark:text-white truncate">
                  {currentTrack ? currentTrack.title : "Sampath's Studio"}
                </span>
                {currentTrack && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAudioQualityModalOpen(true);
                    }}
                    className="apple-lossless-badge text-[8px] font-mono font-bold px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[#86868b] dark:text-[#a1a1a6] border border-black/10 dark:border-white/15 shrink-0"
                  >
                    {currentTrack.isHiRes ? 'HI-RES' : currentTrack.isLossless ? 'LOSSLESS' : 'AAC'}
                  </button>
                )}
              </div>
              <div className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] truncate">
                {currentTrack ? currentTrack.artist : 'Select a track to play'}
              </div>
            </div>
          </div>

          {/* Quick Transport Controls */}
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {currentTrack && (
              <button
                onClick={toggleCurrentTrackLike}
                className="p-2 text-[#86868b] hover:text-[#fa243c] active:scale-95 transition"
                aria-label={currentTrack.isFavorite ? 'Unlike' : 'Like'}
              >
                <Heart
                  className={`w-4 h-4 ${
                    currentTrack.isFavorite ? 'fill-[#fa243c] text-[#fa243c]' : ''
                  }`}
                />
              </button>
            )}
            <button
              onClick={togglePlay}
              disabled={!currentTrack}
              className="w-9 h-9 rounded-full bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] flex items-center justify-center active:scale-90 transition shadow-sm"
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
              className="p-2 text-[#1d1d1f] dark:text-white hover:opacity-75 active:scale-95 transition"
              aria-label="Next track"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>
        </div>

        {/* Apple Music Cupertino 4-Tab Bottom Navigation Bar */}
        <nav
          className="flex items-center justify-around border-t border-black/5 dark:border-white/5 py-1.5 px-2 pb-safe bg-white/95 dark:bg-[#121214]/95"
          aria-label="Mobile Navigation"
        >
          {/* Tab 1: Library */}
          <button
            onClick={onOpenMobileLibrary}
            className={`flex-1 flex flex-col items-center justify-center py-1 min-h-[44px] active:scale-95 transition ${
              activeView === 'library'
                ? 'text-[#fa243c]'
                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#fa243c]'
            }`}
          >
            <Library className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5">Library</span>
          </button>

          {/* Tab 2: Search */}
          <button
            onClick={onOpenMobileSearch}
            className={`flex-1 flex flex-col items-center justify-center py-1 min-h-[44px] active:scale-95 transition ${
              activeView === 'search'
                ? 'text-[#fa243c]'
                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#fa243c]'
            }`}
          >
            <Search className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5">Search</span>
          </button>

          {/* Tab 3: Equalizer */}
          <button
            onClick={() => toggleRightPanelTab('eq')}
            className={`flex-1 flex flex-col items-center justify-center py-1 min-h-[44px] active:scale-95 transition ${
              rightPanelTab === 'eq'
                ? 'text-[#fa243c]'
                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#fa243c]'
            }`}
          >
            <Sliders className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5">10-Band EQ</span>
          </button>

          {/* Tab 4: Sing Karaoke */}
          <button
            onClick={() => setIsFullScreenSingOpen(true)}
            className="flex-1 flex flex-col items-center justify-center py-1 min-h-[44px] text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#fa243c] active:scale-95 transition relative"
          >
            <div className="relative">
              <Mic2 className="w-5 h-5 text-[#fa243c]" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#fa243c] animate-ping" />
            </div>
            <span className="text-[10px] font-bold text-[#fa243c] mt-0.5">Sing</span>
          </button>
        </nav>
      </div>
    </>
  );
};
