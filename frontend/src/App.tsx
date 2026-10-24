import React, { useEffect, useState } from 'react';
import {
  Activity,
  Menu,
  Search,
  Music2,
  Sliders,
  Mic2,
  ListMusic,
} from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { TrackTable } from './components/TrackTable';
import { PlayerBar } from './components/PlayerBar';
import { EQDrawer } from './components/EQDrawer';
import { QueueDrawer } from './components/QueueDrawer';
import { LyricsPanel } from './components/LyricsPanel';
import { SmartPlaylistModal } from './components/SmartPlaylistModal';
import { SpotifySearchModal } from './components/SpotifySearchModal';
import { ImportSpotifyPlaylistModal } from './components/ImportSpotifyPlaylistModal';
import { AddSongsModal } from './components/AddSongsModal';
import { CommandPalette } from './components/CommandPalette';
import { MobileNowPlaying } from './components/MobileNowPlaying';
import { usePlayerStore } from './store/playerStore';
import { Track, Playlist } from './types/audio';

export function App() {
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [displayedTracks, setDisplayedTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [viewTitle, setViewTitle] = useState('All Tracks');
  const [viewSubtitle, setViewSubtitle] = useState('Unrestricted Personal Music Workstation');

  // Modals & Panels
  const [isEQOpen, setIsEQOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isSmartModalOpen, setIsSmartModalOpen] = useState(false);
  const [isSpotifySearchOpen, setIsSpotifySearchOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddSongsModalOpen, setIsAddSongsModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileNowPlayingOpen, setIsMobileNowPlayingOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const initController = usePlayerStore((s) => s.initController);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const prevTrack = usePlayerStore((s) => s.prevTrack);
  const seek = usePlayerStore((s) => s.seek);
  const setShuffleMode = usePlayerStore((s) => s.setShuffleMode);

  useEffect(() => {
    initController();
    loadTracks();
    loadPlaylists();
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight' || e.key === 'l') {
        const cur = usePlayerStore.getState().currentTime;
        seek(cur + 5);
      } else if (e.code === 'ArrowLeft' || e.key === 'j') {
        const cur = usePlayerStore.getState().currentTime;
        seek(Math.max(0, cur - 5));
      } else if (e.key.toLowerCase() === 'n') {
        nextTrack();
      } else if (e.key.toLowerCase() === 'p') {
        prevTrack();
      } else if (e.key.toLowerCase() === 's') {
        const currentMode = usePlayerStore.getState().shuffleMode;
        const modes: any[] = ['off', 'fisher-yates', 'artist-spread', 'bpm-flow'];
        const next = modes[(modes.indexOf(currentMode) + 1) % modes.length];
        setShuffleMode(next);
      } else if (e.key.toLowerCase() === 'e') {
        setIsEQOpen((prev) => !prev);
      } else if (e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.metaKey) {
        setIsLyricsOpen((prev) => !prev);
      } else if (e.key.toLowerCase() === 'q') {
        setIsQueueOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, nextTrack, prevTrack, seek, setShuffleMode]);

  const loadTracks = async () => {
    try {
      const res = await fetch('/api/tracks?limit=2000');
      if (res.ok) {
        const data = await res.json();
        setAllTracks(data.tracks || []);
        if (selectedPlaylistId === null) {
          setDisplayedTracks(data.tracks || []);
        } else if (selectedPlaylistId === 'liked') {
          setDisplayedTracks((data.tracks || []).filter((t: Track) => t.isFavorite));
        }
      }
    } catch (e) {
      console.warn('Could not fetch tracks:', e);
    }
  };

  const loadPlaylists = async () => {
    try {
      const res = await fetch('/api/playlists');
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data || []);
      }
    } catch (e) {
      console.warn('Could not fetch playlists:', e);
    }
  };

  const handleSelectPlaylist = async (id: string | null) => {
    setSelectedPlaylistId(id);
    if (id === null) {
      setViewTitle('All Tracks');
      setViewSubtitle('Unrestricted Personal Music Workstation');
      setDisplayedTracks(allTracks);
      return;
    }

    if (id === 'liked') {
      setViewTitle('Liked Songs');
      setViewSubtitle('Your favorite songs across all sources');
      setDisplayedTracks(allTracks.filter((t) => t.isFavorite));
      return;
    }

    try {
      const res = await fetch(`/api/playlists/${id}`);
      if (res.ok) {
        const pl = await res.json();
        setViewTitle(pl.name);
        setViewSubtitle(pl.description || (pl.is_smart ? 'Dynamic Smart Playlist' : 'Curated Playlist'));
        setDisplayedTracks(pl.tracks || []);
      }
    } catch (e) {
      console.warn('Could not load playlist:', e);
    }
  };

  const handleToggleLike = async (trackId: string) => {
    try {
      const res = await fetch(`/api/tracks/${trackId}/toggle-like`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAllTracks((prev) =>
          prev.map((t) => (t.id === trackId ? { ...t, isFavorite: data.isFavorite } : t))
        );
        setDisplayedTracks((prev) => {
          if (selectedPlaylistId === 'liked' && !data.isFavorite) {
            return prev.filter((t) => t.id !== trackId);
          }
          return prev.map((t) => (t.id === trackId ? { ...t, isFavorite: data.isFavorite } : t));
        });
      }
    } catch (err) {
      console.warn('Toggle like error:', err);
    }
  };

  const handleRemoveTrackFromPlaylist = async (trackId: string) => {
    if (!selectedPlaylistId || selectedPlaylistId === 'liked') return;
    try {
      const res = await fetch(`/api/playlists/${selectedPlaylistId}/tracks/${trackId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDisplayedTracks((prev) => prev.filter((t) => t.id !== trackId));
        setBannerMessage('✓ Track removed from playlist');
        loadPlaylists();
        setTimeout(() => setBannerMessage(null), 2500);
      }
    } catch (err) {
      console.warn('Remove track error:', err);
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    try {
      const res = await fetch(`/api/tracks/${trackId}`, { method: 'DELETE' });
      if (res.ok) {
        setAllTracks((prev) => prev.filter((t) => t.id !== trackId));
        setDisplayedTracks((prev) => prev.filter((t) => t.id !== trackId));
        setBannerMessage('✓ Track deleted from library');
        setTimeout(() => setBannerMessage(null), 2500);
      }
    } catch (err) {
      console.warn('Delete track error:', err);
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' });
      if (res.ok) {
        loadPlaylists();
        if (selectedPlaylistId === playlistId) {
          handleSelectPlaylist(null);
        }
        setBannerMessage('✓ Playlist deleted');
        setTimeout(() => setBannerMessage(null), 2500);
      }
    } catch (err) {
      console.warn('Delete playlist error:', err);
    }
  };

  const handleTrackAdded = (track: Track) => {
    setDisplayedTracks((prev) => [...prev, track]);
    loadPlaylists();
    setBannerMessage(`✓ Added "${track.title}" to playlist`);
    setTimeout(() => setBannerMessage(null), 2500);
  };

  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/library/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setBannerMessage(`✓ Scanned local library: ${data.scanned} files inspected, ${data.added} new tracks added.`);
        loadTracks();
        setTimeout(() => setBannerMessage(null), 3500);
      }
    } catch (e) {
      console.warn('Scan failed:', e);
    } finally {
      setScanning(false);
    }
  };

  const handleTriggerSpotifySeed = async () => {
    try {
      const res = await fetch('/api/spotify/seed-demo', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setBannerMessage(`✓ Seeded ${data.seeded || 50}+ tracks with audio previews across multiple genres!`);
        loadTracks();
        loadPlaylists();
        setTimeout(() => setBannerMessage(null), 3500);
      }
    } catch (e) {
      console.warn('Seed failed:', e);
    }
  };

  const likedCount = allTracks.filter((t) => t.isFavorite).length;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Banner */}
      {bannerMessage && (
        <div className="bg-slate-900 dark:bg-indigo-600 text-white text-xs font-semibold py-1.5 px-4 text-center z-50 shadow-md animate-in fade-in shrink-0">
          {bannerMessage}
        </div>
      )}

      {/* Mobile Top Header (Phones < 768px) */}
      <header className="md:hidden flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md z-30 shrink-0">
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="p-2 -ml-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl active:bg-slate-100 dark:active:bg-slate-800 transition"
          aria-label="Open library menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center shadow-xs text-white dark:text-slate-900">
            <Activity className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">PULSE</span>
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            PRO
          </span>
        </div>

        <button
          onClick={() => setIsSpotifySearchOpen(true)}
          className="p-2 -mr-1 text-slate-600 dark:text-slate-300 rounded-xl active:bg-slate-100 dark:active:bg-slate-800 transition"
          aria-label="Universal Search"
        >
          <Search className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar (Desktop + Mobile Drawer) */}
        <Sidebar
          playlists={playlists}
          selectedPlaylistId={selectedPlaylistId}
          likedCount={likedCount}
          onSelectPlaylist={handleSelectPlaylist}
          onOpenSmartModal={() => setIsSmartModalOpen(true)}
          onOpenSpotifySearch={() => setIsSpotifySearchOpen(true)}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          onTriggerScan={handleTriggerScan}
          onTriggerSpotifySeed={handleTriggerSpotifySeed}
          onDeletePlaylist={handleDeletePlaylist}
          scanning={scanning}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Center Track Table */}
        <main className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col">
          <TrackTable
            tracks={displayedTracks}
            title={viewTitle}
            subtitle={viewSubtitle}
            playlistId={selectedPlaylistId}
            onOpenAddSongs={() => {
              if (selectedPlaylistId && selectedPlaylistId !== 'liked') {
                setIsAddSongsModalOpen(true);
              } else {
                setIsSpotifySearchOpen(true);
              }
            }}
            onDeletePlaylist={handleDeletePlaylist}
            onRemoveFromPlaylist={handleRemoveTrackFromPlaylist}
            onDeleteTrack={handleDeleteTrack}
            onToggleLike={handleToggleLike}
          />
        </main>
      </div>

      {/* Persistent Player Bar (Desktop Bar + Mobile Mini-Player) */}
      <PlayerBar
        onToggleEQ={() => setIsEQOpen((prev) => !prev)}
        onToggleQueue={() => setIsQueueOpen((prev) => !prev)}
        onToggleLyrics={() => setIsLyricsOpen((prev) => !prev)}
        isEQOpen={isEQOpen}
        isQueueOpen={isQueueOpen}
        isLyricsOpen={isLyricsOpen}
        onExpandMobileNowPlaying={() => setIsMobileNowPlayingOpen(true)}
      />

      {/* Mobile Bottom Navigation Bar (Phone Screens < 768px) */}
      <nav className="md:hidden grid grid-cols-5 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl z-30 shrink-0 pb-[env(safe-area-inset-bottom)]">
        {/* 1. Library */}
        <button
          onClick={() => handleSelectPlaylist(null)}
          className={`flex flex-col items-center justify-center py-2 gap-1 active:bg-slate-100 dark:active:bg-slate-900 transition ${
            selectedPlaylistId === null ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <Music2 className="w-4 h-4" />
          <span className="text-[10px] font-medium">Library</span>
        </button>

        {/* 2. Universal Search */}
        <button
          onClick={() => setIsSpotifySearchOpen(true)}
          className="flex flex-col items-center justify-center py-2 gap-1 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white active:bg-slate-100 dark:active:bg-slate-900 transition"
        >
          <Search className="w-4 h-4" />
          <span className="text-[10px] font-medium">Search</span>
        </button>

        {/* 3. 10-Band EQ */}
        <button
          onClick={() => setIsEQOpen((prev) => !prev)}
          className={`flex flex-col items-center justify-center py-2 gap-1 active:bg-slate-100 dark:active:bg-slate-900 transition ${
            isEQOpen ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span className="text-[10px] font-medium">EQ</span>
        </button>

        {/* 4. Lyrics */}
        <button
          onClick={() => setIsLyricsOpen((prev) => !prev)}
          className={`flex flex-col items-center justify-center py-2 gap-1 active:bg-slate-100 dark:active:bg-slate-900 transition ${
            isLyricsOpen ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <Mic2 className="w-4 h-4" />
          <span className="text-[10px] font-medium">Lyrics</span>
        </button>

        {/* 5. Queue */}
        <button
          onClick={() => setIsQueueOpen((prev) => !prev)}
          className={`flex flex-col items-center justify-center py-2 gap-1 active:bg-slate-100 dark:active:bg-slate-900 transition ${
            isQueueOpen ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <ListMusic className="w-4 h-4" />
          <span className="text-[10px] font-medium">Queue</span>
        </button>
      </nav>

      {/* Full-Screen Mobile Now Playing Sheet */}
      {isMobileNowPlayingOpen && (
        <MobileNowPlaying
          isOpen={isMobileNowPlayingOpen}
          onClose={() => setIsMobileNowPlayingOpen(false)}
          onOpenEQ={() => setIsEQOpen(true)}
          onOpenQueue={() => setIsQueueOpen(true)}
          onOpenLyrics={() => setIsLyricsOpen(true)}
        />
      )}

      {/* Add Songs Modal */}
      {isAddSongsModalOpen && (
        <AddSongsModal
          isOpen={isAddSongsModalOpen}
          onClose={() => setIsAddSongsModalOpen(false)}
          playlistId={selectedPlaylistId}
          playlistName={viewTitle}
          allTracks={allTracks}
          currentTrackIds={new Set(displayedTracks.map((t) => t.id))}
          onTrackAdded={handleTrackAdded}
        />
      )}

      {/* Slide-over Drawers & Modals (Mounted on-demand for maximum phone performance) */}
      {isEQOpen && <EQDrawer isOpen={isEQOpen} onClose={() => setIsEQOpen(false)} />}
      {isQueueOpen && <QueueDrawer isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />}
      {isLyricsOpen && <LyricsPanel isOpen={isLyricsOpen} onClose={() => setIsLyricsOpen(false)} />}
      {isSmartModalOpen && (
        <SmartPlaylistModal
          isOpen={isSmartModalOpen}
          onClose={() => setIsSmartModalOpen(false)}
          onCreated={() => {
            loadPlaylists();
            setBannerMessage('✓ Smart Playlist created and auto-evaluated against library rules!');
            setTimeout(() => setBannerMessage(null), 3000);
          }}
        />
      )}
      {isSpotifySearchOpen && (
        <SpotifySearchModal
          isOpen={isSpotifySearchOpen}
          onClose={() => setIsSpotifySearchOpen(false)}
          onTrackImported={() => {
            loadTracks();
            setBannerMessage('✓ Track resolved and imported to local library with unlimited playback!');
            setTimeout(() => setBannerMessage(null), 3000);
          }}
        />
      )}
      {isImportModalOpen && (
        <ImportSpotifyPlaylistModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onPlaylistImported={(plId) => {
            loadPlaylists();
            handleSelectPlaylist(plId);
            setBannerMessage('✓ Spotify playlist successfully imported with full-length streaming!');
            setTimeout(() => setBannerMessage(null), 3500);
          }}
        />
      )}
      {isCommandPaletteOpen && (
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          tracks={allTracks}
          onOpenEQ={() => setIsEQOpen(true)}
          onOpenLyrics={() => setIsLyricsOpen(true)}
          onOpenQueue={() => setIsQueueOpen(true)}
          onOpenSmartModal={() => setIsSmartModalOpen(true)}
          onOpenSpotifySearch={() => setIsSpotifySearchOpen(true)}
        />
      )}
    </div>
  );
}

export default App;
