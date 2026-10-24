import React from 'react';
import {
  Activity,
  Music2,
  FolderSync,
  Sparkles,
  Plus,
  Heart,
  Search,
  ListMusic,
  X,
  Sun,
  Moon,
  Trash2,
  Radio,
} from 'lucide-react';
import { Playlist } from '../types/audio';
import { useThemeStore } from '../store/themeStore';

interface SidebarProps {
  playlists: Playlist[];
  selectedPlaylistId: string | null;
  likedCount: number;
  onSelectPlaylist: (id: string | null) => void;
  onOpenSmartModal: () => void;
  onOpenSpotifySearch: () => void;
  onOpenImportModal: () => void;
  onTriggerScan: () => void;
  onTriggerSpotifySeed: () => void;
  onDeletePlaylist?: (playlistId: string) => void;
  scanning: boolean;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  playlists,
  selectedPlaylistId,
  likedCount,
  onSelectPlaylist,
  onOpenSmartModal,
  onOpenSpotifySearch,
  onOpenImportModal,
  onTriggerScan,
  onTriggerSpotifySeed,
  onDeletePlaylist,
  scanning,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const { theme, toggleTheme } = useThemeStore();
  const regularPlaylists = playlists.filter((p) => !p.isSmart);
  const smartPlaylists = playlists.filter((p) => p.isSmart);

  const handleSelectAndClose = (id: string | null) => {
    onSelectPlaylist(id);
    onCloseMobile?.();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 md:static md:w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full select-none shrink-0 transition-all duration-200 md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-xs">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                PULSE
                <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  PRO
                </span>
              </h1>
              <p className="text-[10px] text-slate-400">Audio Workstation</p>
            </div>
          </div>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Main Library Nav */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-1.5">
              Library
            </span>
            <nav className="space-y-0.5">
              <button
                onClick={() => handleSelectAndClose(null)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  selectedPlaylistId === null
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                <Music2 className="w-4 h-4" />
                <span>All Tracks</span>
              </button>

              <button
                onClick={() => handleSelectAndClose('liked')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  selectedPlaylistId === 'liked'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Heart className={`w-4 h-4 ${selectedPlaylistId === 'liked' ? 'fill-current' : 'fill-rose-500 text-rose-500'}`} />
                  <span>Liked Songs</span>
                </div>
                {likedCount > 0 && (
                  <span className={`text-[10px] font-mono px-2 py-0.2 rounded-full font-semibold ${
                    selectedPlaylistId === 'liked'
                      ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                      : 'bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300'
                  }`}>
                    {likedCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  onOpenSpotifySearch();
                  onCloseMobile?.();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 transition"
              >
                <Search className="w-4 h-4" />
                <span>Search Music</span>
              </button>

              <button
                onClick={() => {
                  onOpenImportModal();
                  onCloseMobile?.();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 transition"
              >
                <ListMusic className="w-4 h-4" />
                <span>Import Playlist</span>
              </button>

              <button
                onClick={onTriggerScan}
                disabled={scanning}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 transition"
              >
                <FolderSync className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
                <span>{scanning ? 'Scanning...' : 'Scan Local Audio'}</span>
              </button>

              <button
                onClick={onTriggerSpotifySeed}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 transition"
              >
                <Radio className="w-4 h-4" />
                <span>Demo Tracks (50+)</span>
              </button>
            </nav>
          </div>

          {/* Smart Playlists Section */}
          <div>
            <div className="flex items-center justify-between px-3 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Smart Playlists
              </span>
              <button
                onClick={onOpenSmartModal}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Create Smart Playlist"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {smartPlaylists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => handleSelectAndClose(pl.id)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                    selectedPlaylistId === pl.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
                  }`}
                >
                  <span className="truncate">{pl.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">Smart</span>
                </button>
              ))}
            </div>
          </div>

          {/* Standard Playlists */}
          <div>
            <div className="px-3 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Playlists
              </span>
            </div>
            <div className="space-y-0.5">
              {regularPlaylists.map((pl) => {
                const isSelected = selectedPlaylistId === pl.id;
                return (
                  <div
                    key={pl.id}
                    className={`group flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
                    }`}
                    onClick={() => handleSelectAndClose(pl.id)}
                  >
                    <span className="truncate flex-1 pr-2">{pl.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-mono ${
                        isSelected ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'
                      }`}>
                        {pl.trackCount || 0}
                      </span>
                      {onDeletePlaylist && pl.id !== 'all' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete playlist "${pl.name}"?`)) {
                              onDeletePlaylist(pl.id);
                            }
                          }}
                          className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition ${
                            isSelected ? 'text-slate-300 hover:text-white' : 'text-slate-400 hover:text-rose-600'
                          }`}
                          title="Delete playlist"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer: Theme Switcher & Shortcuts */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 transition"
            title="Toggle Light / Dark theme"
          >
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 text-slate-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
              <span>Theme</span>
            </div>
            <span className="text-[11px] font-mono capitalize px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {theme}
            </span>
          </button>

          <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-400">
            <span>Quick search</span>
            <kbd className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              ⌘K
            </kbd>
          </div>
        </div>
      </aside>
    </>
  );
};
