import React, { useState, useEffect } from 'react';
import { Search, Play, Sliders, Mic2, ListMusic, Shuffle, Sparkles, X, HardDrive } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { Track } from '../types/audio';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: Track[];
  onOpenEQ: () => void;
  onOpenLyrics: () => void;
  onOpenQueue: () => void;
  onOpenSmartModal: () => void;
  onOpenSpotifySearch: () => void;
  onOpenStorage?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  tracks,
  onOpenEQ,
  onOpenLyrics,
  onOpenQueue,
  onOpenSmartModal,
  onOpenSpotifySearch,
  onOpenStorage,
}) => {
  const [query, setQuery] = useState('');
  const {
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    setShuffleMode,
    shuffleMode,
    toggleTheme,
    theme,
    setIsAudioQualityModalOpen,
    setIsFullScreenSingOpen,
  } = usePlayerStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredTracks = query.trim()
    ? tracks
        .filter(
          (t) =>
            t.title.toLowerCase().includes(query.toLowerCase()) ||
            t.artist.toLowerCase().includes(query.toLowerCase()) ||
            (t.genre && t.genre.toLowerCase().includes(query.toLowerCase()))
        )
        .slice(0, 6)
    : [];

  const actions = [
    {
      id: 'act-storage',
      icon: HardDrive,
      title: 'Manage Storage & Audio Disk Cache',
      shortcut: '⌘M',
      run: () => onOpenStorage?.(),
    },
    {
      id: 'act-lossless',
      icon: Sparkles,
      title: 'Configure Lossless & Hi-Res Audio Quality',
      shortcut: '⌘Q',
      run: () => setIsAudioQualityModalOpen(true),
    },
    {
      id: 'act-sing',
      icon: Mic2,
      title: 'Launch Apple Music Sing (Full-Screen Karaoke)',
      shortcut: '⌘K',
      run: () => setIsFullScreenSingOpen(true),
    },
    {
      id: 'act-theme',
      icon: Sparkles,
      title: `Switch to ${theme === 'light' ? 'Dark Mode' : 'Luminous Light Mode'}`,
      shortcut: '⌘T',
      run: () => toggleTheme(),
    },
    {
      id: 'act-spotify-search',
      icon: Search,
      title: 'Search Universal Music Catalog',
      shortcut: '⌘S',
      run: () => onOpenSpotifySearch(),
    },
    {
      id: 'act-play-pause',
      icon: Play,
      title: 'Play / Pause',
      shortcut: 'Space',
      run: () => togglePlay(),
    },
    {
      id: 'act-next',
      icon: Play,
      title: 'Next Track',
      shortcut: 'N',
      run: () => nextTrack(),
    },
    {
      id: 'act-prev',
      icon: Play,
      title: 'Previous Track',
      shortcut: 'P',
      run: () => prevTrack(),
    },
    {
      id: 'act-shuffle',
      icon: Shuffle,
      title: `Cycle Shuffle Mode (${shuffleMode})`,
      shortcut: 'S',
      run: () => {
        const modes: any[] = ['off', 'fisher-yates', 'artist-spread', 'bpm-flow'];
        const next = modes[(modes.indexOf(shuffleMode) + 1) % modes.length];
        setShuffleMode(next);
      },
    },
    {
      id: 'act-eq',
      icon: Sliders,
      title: 'Open 10-Band Equalizer',
      shortcut: 'E',
      run: () => onOpenEQ(),
    },
    {
      id: 'act-lyrics',
      icon: Mic2,
      title: 'Open Synced Lyrics',
      shortcut: 'L',
      run: () => onOpenLyrics(),
    },
    {
      id: 'act-queue',
      icon: ListMusic,
      title: 'Open Playback Queue',
      shortcut: 'Q',
      run: () => onOpenQueue(),
    },
    {
      id: 'act-smart',
      icon: Sparkles,
      title: 'Create Smart Playlist',
      shortcut: '⇧S',
      run: () => onOpenSmartModal(),
    },
  ];

  const filteredActions = query.trim()
    ? actions.filter((a) => a.title.toLowerCase().includes(query.toLowerCase()))
    : actions;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-100">
      <div className="w-full max-w-xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden transition-colors">
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800 gap-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command or search tracks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          <button onClick={onClose} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 space-y-4">
          {/* Tracks results */}
          {filteredTracks.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-3 block mb-1">
                Matching Tracks
              </span>
              <div className="space-y-1">
                {filteredTracks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      playTrack(t, tracks);
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition group"
                  >
                    <img
                      src={t.coverArtUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=80&q=80'}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=80&q=80';
                      }}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{t.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{t.artist}</div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {t.genre || 'Music'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-3 block mb-1">
              Commands
            </span>
            <div className="space-y-1">
              {filteredActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => {
                      action.run();
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-slate-500" />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{action.title}</span>
                    </div>
                    {action.shortcut && (
                      <kbd className="text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 px-2 py-0.5 rounded-md font-mono">
                        {action.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
