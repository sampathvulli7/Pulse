import React, { useState, useRef, useEffect } from 'react';
import {
  Home,
  Search,
  Library,
  Plus,
  Heart,
  FolderSync,
  Radio,
  Sparkles,
  ListMusic,
  Trash2,
  ChevronRight,
  ChevronLeft,
  ArrowUpDown,
  Music2,
  ListFilter,
  Layers,
  X,
  HardDrive,
} from 'lucide-react';
import { Playlist, LibraryFilter, LibrarySort, DailyMix } from '../types/audio';
import { usePlayerStore } from '../store/playerStore';

interface SidebarProps {
  playlists: Playlist[];
  selectedPlaylistId: string | null;
  likedCount: number;
  activeView?: 'library' | 'search';
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
  activeView = 'library',
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
  const {
    leftRailMode,
    toggleLeftRailMode,
    leftRailWidth,
    setLeftRailWidth,
    libraryFilter,
    setLibraryFilter,
    librarySort,
    setLibrarySort,
    librarySearchQuery,
    setLibrarySearchQuery,
    setIsStorageModalOpen,
  } = usePlayerStore();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [dailyMixes, setDailyMixes] = useState<DailyMix[]>([]);
  const isCollapsed = leftRailMode === 'collapsed';

  useEffect(() => {
    fetch('/api/mixes')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.mixes)) {
          setDailyMixes(data.mixes);
        }
      })
      .catch(() => {});
  }, []);

  // Drag resizer
  const isResizingRef = useRef(false);

  const startResizing = (e: React.MouseEvent) => {
    isResizingRef.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const newWidth = Math.max(200, Math.min(480, e.clientX));
    setLeftRailWidth(newWidth);
  };

  const handleMouseUp = () => {
    isResizingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Filter & Search logic
  const filteredPlaylists = playlists
    .filter((pl) => {
      if (libraryFilter === 'playlists') return !pl.isSmart;
      if (libraryFilter === 'artists') return false; // Future extension
      if (libraryFilter === 'albums') return false;
      return true;
    })
    .filter((pl) => {
      if (!librarySearchQuery.trim()) return true;
      return pl.name.toLowerCase().includes(librarySearchQuery.toLowerCase());
    })
    .sort((a, b) => {
      if (librarySort === 'alphabetical') {
        return a.name.localeCompare(b.name);
      }
      return 0; // default recents
    });

  return (
    <>
      <aside
        className={`spotify-sidebar spotify-panel hidden md:flex flex-col h-full bg-white/55 dark:bg-[#121214]/65 backdrop-blur-2xl select-none text-[#1d1d1f] dark:text-white border border-black/5 dark:border-white/5 transition-all duration-150 relative ${
          isCollapsed ? 'w-[72px]' : ''
        }`}
      style={{ width: isCollapsed ? '72px' : `${leftRailWidth}px` }}
      aria-label="Main sidebar"
    >
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
        <div className="w-2.5 h-2.5 rounded-full bg-[#fa243c] animate-pulse shrink-0" />
        {!isCollapsed && (
          <>
            <span className="font-black text-xs tracking-widest text-[#1d1d1f] dark:text-white uppercase truncate">
              Sampath's Studio
            </span>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-[#fa243c]/10 text-[#fa243c] border border-[#fa243c]/20 ml-auto shrink-0">
              PRO
            </span>
          </>
        )}
      </div>

      {/* Top Nav Block (Home & Search) */}
      <div className="bg-slate-50/70 dark:bg-white/[0.03] rounded-xl p-2.5 space-y-1 mb-2 border border-black/5 dark:border-white/5">
        <button
          onClick={() => onSelectPlaylist(null)}
          className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-bold transition ${
            activeView === 'library' && selectedPlaylistId === null
              ? 'bg-black/5 dark:bg-white/10 text-[#fa243c] dark:text-white'
              : 'text-[#6e6e73] dark:text-[#b3b3b3] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
          }`}
          title="Home / All Tracks"
        >
          <Home className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span>Home</span>}
        </button>

        <button
          onClick={onOpenSpotifySearch}
          className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-bold transition ${
            activeView === 'search'
              ? 'bg-black/5 dark:bg-white/10 text-[#fa243c] dark:text-white'
              : 'text-[#6e6e73] dark:text-[#b3b3b3] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
          }`}
          title="Search Music"
        >
          <Search className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span>Search</span>}
        </button>
      </div>

      {/* Library Rail Container */}
      <div className="bg-slate-50/70 dark:bg-white/[0.03] rounded-xl flex-1 flex flex-col min-h-0 overflow-hidden border border-black/5 dark:border-white/5">
        {/* Your Library Header */}
        <div className="p-3 flex items-center justify-between">
          <button
            onClick={toggleLeftRailMode}
            className="flex items-center gap-3 text-[#6e6e73] dark:text-[#b3b3b3] hover:text-[#1d1d1f] dark:hover:text-white px-2 py-1 rounded-lg transition"
            title={isCollapsed ? 'Expand Your Library' : 'Collapse Your Library'}
          >
            <Library className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span className="text-sm font-bold">Your Library</span>}
          </button>

          {!isCollapsed && (
            <div className="flex items-center gap-1 relative">
              <button
                onClick={() => setShowCreateMenu(!showCreateMenu)}
                className="p-1.5 text-[#b3b3b3] hover:text-white hover:bg-white/10 rounded-full transition"
                title="Create playlist or smart collection"
              >
                <Plus className="w-5 h-5" />
              </button>

              {/* Create Dropdown */}
              {showCreateMenu && (
                <div
                  className="absolute right-0 top-8 w-48 bg-[#282828] border border-white/10 rounded-md shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                  onMouseLeave={() => setShowCreateMenu(false)}
                >
                  <button
                    onClick={() => {
                      setShowCreateMenu(false);
                      onOpenSmartModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 rounded"
                  >
                    <Sparkles className="w-4 h-4 text-[#1ed760]" />
                    <span>Create Smart Playlist</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateMenu(false);
                      onOpenImportModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 rounded"
                  >
                    <ListMusic className="w-4 h-4 text-white" />
                    <span>Import Spotify URL</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateMenu(false);
                      onTriggerSpotifySeed();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 rounded"
                  >
                    <Radio className="w-4 h-4 text-[#1ed760]" />
                    <span>Demo Seed (50+ Songs)</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateMenu(false);
                      onTriggerScan();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 rounded"
                  >
                    <FolderSync className="w-4 h-4 text-white" />
                    <span>Scan Local Storage</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateMenu(false);
                      setIsStorageModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 rounded"
                  >
                    <HardDrive className="w-4 h-4 text-[#fa243c]" />
                    <span>Storage & Audio Cache</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filter Pills (When Expanded) */}
        {!isCollapsed && (
          <div className="px-3 pb-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setLibraryFilter('all')}
              className={`spotify-filter-pill ${libraryFilter === 'all' ? 'active' : ''}`}
            >
              All
            </button>
            <button
              onClick={() => setLibraryFilter('playlists')}
              className={`spotify-filter-pill ${libraryFilter === 'playlists' ? 'active' : ''}`}
            >
              Playlists
            </button>
            <button
              onClick={() => setLibraryFilter('mixes')}
              className={`spotify-filter-pill ${libraryFilter === 'mixes' ? 'active' : ''}`}
            >
              Daily Mixes
            </button>
          </div>
        )}

        {/* Search & Sort Controls (When Expanded) */}
        {!isCollapsed && (
          <div className="px-3 py-1 flex items-center justify-between text-[#b3b3b3]">
            {isSearchOpen ? (
              <div className="flex-1 flex items-center bg-white/10 rounded px-2 py-1 mr-2">
                <Search className="w-3.5 h-3.5 text-[#b3b3b3] mr-1.5 shrink-0" />
                <input
                  type="text"
                  placeholder="Search in Your Library"
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  className="bg-transparent text-xs text-white placeholder-[#727272] w-full focus:outline-none"
                  autoFocus
                  onBlur={() => {
                    if (!librarySearchQuery) setIsSearchOpen(false);
                  }}
                />
              </div>
            ) : (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-1.5 hover:text-white hover:bg-white/10 rounded-full transition"
                title="Search Your Library"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() =>
                setLibrarySort(librarySort === 'recents' ? 'alphabetical' : 'recents')
              }
              className="flex items-center gap-1.5 text-xs hover:text-white transition"
              title="Change sort order"
            >
              <span>{librarySort === 'recents' ? 'Recents' : 'Alphabetical'}</span>
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Playlists List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {/* Liked Songs Special Card */}
          <div
            onClick={() => onSelectPlaylist('liked')}
            className={`group flex items-center gap-3 p-2 rounded-xl cursor-pointer transition ${
              selectedPlaylistId === 'liked'
                ? 'bg-black/5 dark:bg-white/10 text-[#fa243c] dark:text-white font-bold'
                : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#6e6e73] dark:text-[#b3b3b3] hover:text-[#1d1d1f] dark:hover:text-white'
            }`}
            title="Liked Songs"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#fa243c] to-[#fc3c44] flex items-center justify-center shrink-0 shadow-sm">
              <Heart className="w-6 h-6 fill-white text-white" />
            </div>

            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-bold truncate ${
                    selectedPlaylistId === 'liked' ? 'text-[#fa243c] dark:text-white' : 'text-[#1d1d1f] dark:text-white'
                  }`}
                >
                  Liked Songs
                </p>
                <p className="text-xs text-[#86868b] truncate mt-0.5">
                  Playlist • {likedCount} songs
                </p>
              </div>
            )}
          </div>

          {/* Regular & Smart Playlists */}
          {filteredPlaylists.map((pl) => {
            const isSelected = selectedPlaylistId === pl.id;
            return (
              <div
                key={pl.id}
                onClick={() => onSelectPlaylist(pl.id)}
                className={`group flex items-center gap-3 p-2 rounded-xl cursor-pointer transition ${
                  isSelected
                    ? 'bg-black/5 dark:bg-white/10 text-[#fa243c] dark:text-white font-bold'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#6e6e73] dark:text-[#b3b3b3] hover:text-[#1d1d1f] dark:hover:text-white'
                }`}
                title={pl.name}
              >
                {pl.coverUrl ? (
                  <img
                    src={pl.coverUrl}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-xs border border-black/5 dark:border-white/5"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-[#282828] flex items-center justify-center shrink-0">
                    {pl.isSmart ? (
                      <Sparkles className="w-6 h-6 text-[#fa243c]" />
                    ) : (
                      <Music2 className="w-6 h-6 text-[#86868b]" />
                    )}
                  </div>
                )}

                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-bold truncate ${
                        isSelected ? 'text-[#fa243c] dark:text-white' : 'text-[#1d1d1f] dark:text-white'
                      }`}
                    >
                      {pl.name}
                    </p>
                    <p className="text-xs text-[#86868b] truncate mt-0.5">
                      {pl.isSmart ? 'Smart Playlist' : 'Playlist'} • {pl.trackCount || 0} tracks
                    </p>
                  </div>
                )}

                {!isCollapsed && onDeletePlaylist && pl.id !== 'all' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete playlist "${pl.name}"?`)) {
                        onDeletePlaylist(pl.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#86868b] hover:text-[#ff3b30] transition"
                    title="Delete playlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Daily Mixes Section */}
          {(libraryFilter === 'all' || libraryFilter === 'mixes') &&
            dailyMixes.map((mix) => {
              const isSelected = selectedPlaylistId === mix.id;
              return (
                <div
                  key={mix.id}
                  onClick={() => onSelectPlaylist(mix.id)}
                  className={`group flex items-center gap-3 p-2 rounded-xl cursor-pointer transition ${
                    isSelected
                      ? 'bg-black/5 dark:bg-white/10 text-[#fa243c] dark:text-white font-bold'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#6e6e73] dark:text-[#b3b3b3] hover:text-[#1d1d1f] dark:hover:text-white'
                  }`}
                  title={mix.name}
                >
                  <img
                    src={mix.coverUrl}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-xs border border-black/5 dark:border-white/5"
                  />
                  {!isCollapsed && (
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-bold truncate ${
                          isSelected ? 'text-[#fa243c] dark:text-white' : 'text-[#1d1d1f] dark:text-white'
                        }`}
                      >
                        {mix.name}
                      </p>
                      <p className="text-xs text-[#86868b] truncate mt-0.5">
                        {mix.subtitle}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Resize Handle (when not collapsed) */}
      {!isCollapsed && (
        <div
          onMouseDown={startResizing}
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/20 transition"
          title="Drag to resize library"
        />
      )}
    </aside>

    {/* Mobile Slide-Out Drawer (< 768px) */}
    {isOpenMobile && (
      <div className="md:hidden fixed inset-0 z-[120] flex animate-in fade-in duration-200">
        {/* Backdrop Blur Overlay */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onCloseMobile}
        />

        {/* Drawer Content */}
        <div className="relative w-[310px] max-w-[85vw] h-full bg-[#f2f2f7]/95 dark:bg-[#121214]/95 backdrop-blur-2xl border-r border-black/10 dark:border-white/10 flex flex-col pt-safe pb-safe shadow-2xl z-10 animate-in slide-in-from-left duration-250 select-none">
          {/* Top Bar with Branding & Close */}
          <div className="p-4 flex items-center justify-between border-b border-black/5 dark:border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#fa243c] animate-pulse" />
              <span className="font-black text-sm tracking-widest text-[#1d1d1f] dark:text-white uppercase">
                Sampath's Studio
              </span>
            </div>
            <button
              onClick={onCloseMobile}
              className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-[#6e6e73] dark:text-[#a1a1a6] active:scale-90 transition"
              aria-label="Close library drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Links */}
          <div className="p-3 space-y-1 border-b border-black/5 dark:border-white/10">
            <button
              onClick={() => {
                onSelectPlaylist(null);
                onCloseMobile?.();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeView === 'library' && selectedPlaylistId === null
                  ? 'bg-[#fa243c] text-white shadow-sm'
                  : 'text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>All Tracks (Home)</span>
            </button>

            <button
              onClick={() => {
                onOpenSpotifySearch();
                onCloseMobile?.();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeView === 'search'
                  ? 'bg-[#fa243c] text-white shadow-sm'
                  : 'text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Search Music</span>
            </button>

            <button
              onClick={() => {
                onSelectPlaylist('liked');
                onCloseMobile?.();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                selectedPlaylistId === 'liked'
                  ? 'bg-[#fa243c] text-white shadow-sm'
                  : 'text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Heart className={`w-4 h-4 ${selectedPlaylistId === 'liked' ? 'fill-current' : 'text-[#fa243c]'}`} />
              <span className="flex-1 text-left">Liked Songs</span>
              <span className="text-xs opacity-80">{likedCount}</span>
            </button>
          </div>

          {/* Playlists Header & Actions */}
          <div className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-bold text-[#86868b] uppercase tracking-wider">
              Playlists ({playlists.length})
            </span>
            <button
              onClick={() => {
                onOpenSmartModal();
                onCloseMobile?.();
              }}
              className="text-xs text-[#fa243c] font-bold hover:underline flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart</span>
            </button>
          </div>

          {/* Scrollable Playlist List */}
          <div className="flex-1 overflow-y-auto px-2 space-y-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {filteredPlaylists.map((pl) => {
              const isSelected = selectedPlaylistId === pl.id;
              return (
                <div
                  key={pl.id}
                  onClick={() => {
                    onSelectPlaylist(pl.id);
                    onCloseMobile?.();
                  }}
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition ${
                    isSelected
                      ? 'bg-black/10 dark:bg-white/10 text-[#fa243c] font-bold'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#1d1d1f] dark:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-[#fa243c]/15 text-[#fa243c] flex items-center justify-center shrink-0">
                      {pl.isSmart ? <Sparkles className="w-4 h-4" /> : <ListMusic className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs truncate font-medium">{pl.name}</div>
                      <div className="text-[11px] text-[#86868b] truncate">
                        {pl.tracks?.length || 0} tracks {pl.isSmart && '• Smart'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Actions */}
          <div className="p-3 border-t border-black/5 dark:border-white/10 space-y-2">
            <button
              onClick={() => {
                onTriggerScan();
                onCloseMobile?.();
              }}
              disabled={scanning}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-bold text-[#1d1d1f] dark:text-white transition disabled:opacity-50"
            >
              <FolderSync className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'Scanning...' : 'Scan Local Music'}</span>
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
