import React, { useEffect, useState } from 'react';
import {
  Activity,
  Menu,
  Search,
  Music2,
  Sliders,
  Mic2,
  ListMusic,
  Sun,
  Moon,
} from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { TrackTable } from './components/TrackTable';
import { PlayerBar } from './components/PlayerBar';
import { RightPanel } from './components/RightPanel';
import { SmartPlaylistModal } from './components/SmartPlaylistModal';
import { SearchView } from './components/SearchView';
import { ImportSpotifyPlaylistModal } from './components/ImportSpotifyPlaylistModal';
import { AddSongsModal } from './components/AddSongsModal';
import { CommandPalette } from './components/CommandPalette';
import { MobileNowPlaying } from './components/MobileNowPlaying';
import { AudioQualityModal } from './components/AudioQualityModal';
import { FullScreenSingModal } from './components/FullScreenSingModal';
import { StorageModal } from './components/StorageModal';
import { usePlayerStore } from './store/playerStore';
import { Track, Playlist } from './types/audio';
import { globalAudioGraph } from './audio/AudioGraph';

export function App() {
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [displayedTracks, setDisplayedTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [viewTitle, setViewTitle] = useState('All Tracks');
  const [viewSubtitle, setViewSubtitle] = useState("Sampath's Personal Music Workstation");

  // Navigation View State ('library' or in-canvas 'search')
  const [activeView, setActiveView] = useState<'library' | 'search'>('library');

  const navigateView = (view: 'library' | 'search') => {
    if (typeof document !== 'undefined' && (document as any).startViewTransition) {
      (document as any).startViewTransition(() => {
        setActiveView(view);
      });
    } else {
      setActiveView(view);
    }
  };

  // Modals
  const [isSmartModalOpen, setIsSmartModalOpen] = useState(false);
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
  const rightPanelTab = usePlayerStore((s) => s.rightPanelTab);
  const toggleRightPanelTab = usePlayerStore((s) => s.toggleRightPanelTab);
  const theme = usePlayerStore((s) => s.theme);
  const toggleTheme = usePlayerStore((s) => s.toggleTheme);
  const isStorageModalOpen = usePlayerStore((s) => s.isStorageModalOpen);
  const setIsStorageModalOpen = usePlayerStore((s) => s.setIsStorageModalOpen);

  useEffect(() => {
    initController();
    loadTracks();
    loadPlaylists();

    // Mobile Web Audio unlock on initial user touch/pointer interaction
    const unlockAudio = () => {
      globalAudioGraph.resume().catch(() => {});
    };
    window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
    window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
    return () => {
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('pointerdown', unlockAudio);
    };
  }, []);

  // Synchronize HTML root with active theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.setAttribute('data-theme', theme);
    document.body?.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('pulse-theme', theme);
    } catch (e) {}
  }, [theme]);

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
      } else if (e.code === 'ArrowRight' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        nextTrack();
      } else if (e.code === 'ArrowLeft' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        prevTrack();
      } else if (e.code === 'ArrowRight') {
        const cur = usePlayerStore.getState().currentTime;
        seek(cur + 5);
      } else if (e.code === 'ArrowLeft') {
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
        toggleRightPanelTab('eq');
      } else if (e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.metaKey) {
        toggleRightPanelTab('lyrics');
      } else if (e.key.toLowerCase() === 'q') {
        toggleRightPanelTab('queue');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, nextTrack, prevTrack, seek, setShuffleMode, toggleRightPanelTab]);

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
    navigateView('library');
    setSelectedPlaylistId(id);
    if (id === null) {
      setViewTitle('All Tracks');
      setViewSubtitle('Complete workstation audio library with unlimited playback');
      setDisplayedTracks(allTracks);
      return;
    }

    if (id === 'liked') {
      setViewTitle('Liked Songs');
      setViewSubtitle('Your hand-curated collection of favorite tracks');
      setDisplayedTracks(allTracks.filter((t) => t.isFavorite));
      return;
    }

    if (id.startsWith('daily-mix-')) {
      try {
        const res = await fetch(`/api/mixes/${id}`);
        if (res.ok) {
          const mix = await res.json();
          setViewTitle(mix.name);
          setViewSubtitle(mix.subtitle);
          setDisplayedTracks(mix.tracks || []);
        }
      } catch (e) {
        console.warn('Could not load Daily Mix:', e);
      }
      return;
    }

    try {
      const res = await fetch(`/api/playlists/${id}`);
      if (res.ok) {
        const pl = await res.json();
        setViewTitle(pl.name);
        setViewSubtitle(
          pl.description ||
            (pl.isSmart
              ? 'Dynamically filtered by rule engine'
              : 'Workstation playlist')
        );
        setDisplayedTracks(pl.tracks || []);
      }
    } catch (e) {
      console.warn('Could not load playlist:', e);
    }
  };

  const handleTriggerScan = async () => {
    setScanning(true);
    setBannerMessage('Scanning local music library folder for high-res audio files...');
    try {
      const res = await fetch('/api/tracks/scan', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setBannerMessage(`✓ Scan complete! ${data.added || 0} new tracks indexed with audio telemetry.`);
        await loadTracks();
      }
    } catch (e) {
      setBannerMessage('Scan finished.');
    } finally {
      setScanning(false);
      setTimeout(() => setBannerMessage(null), 4000);
    }
  };

  const handleTriggerSpotifySeed = async () => {
    setBannerMessage('Seeding 50+ diverse demo tracks across Synthwave, Lo-Fi, Rock, Electronic...');
    try {
      const res = await fetch('/api/spotify/seed-demo', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setBannerMessage(`✓ ${data.seeded || 50} demo tracks seeded into workstation!`);
        await loadTracks();
        await loadPlaylists();
      }
    } catch (e) {
      setBannerMessage('Could not seed demo tracks.');
    } finally {
      setTimeout(() => setBannerMessage(null), 4000);
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' });
      if (res.ok) {
        setBannerMessage('Playlist deleted.');
        await loadPlaylists();
        if (selectedPlaylistId === playlistId) {
          handleSelectPlaylist(null);
        }
      }
    } catch (e) {
      console.warn('Could not delete playlist:', e);
    } finally {
      setTimeout(() => setBannerMessage(null), 3000);
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
        loadPlaylists();
      }
    } catch (e) {
      console.warn('Could not remove track:', e);
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    try {
      const res = await fetch(`/api/tracks/${trackId}`, { method: 'DELETE' });
      if (res.ok) {
        setAllTracks((prev) => prev.filter((t) => t.id !== trackId));
        setDisplayedTracks((prev) => prev.filter((t) => t.id !== trackId));
        loadPlaylists();
      }
    } catch (e) {
      console.warn('Could not delete track:', e);
    }
  };

  const handleToggleLike = async (trackId: string) => {
    setAllTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, isFavorite: !t.isFavorite } : t))
    );
    setDisplayedTracks((prev) => {
      const updated = prev.map((t) =>
        t.id === trackId ? { ...t, isFavorite: !t.isFavorite } : t
      );
      if (selectedPlaylistId === 'liked') {
        return updated.filter((t) => t.isFavorite);
      }
      return updated;
    });

    try {
      await fetch(`/api/tracks/${trackId}/toggle-like`, { method: 'POST' });
    } catch (e) {
      console.warn('Like toggle failed:', e);
    }
  };

  const handleTrackAdded = () => {
    if (selectedPlaylistId) {
      handleSelectPlaylist(selectedPlaylistId);
    }
  };

  const likedCount = allTracks.filter((t) => t.isFavorite).length;

  return (
    <div
      className={`relative w-screen h-[100dvh] flex flex-col overflow-hidden font-sans antialiased select-none ${theme} ${
        theme === 'dark' ? 'dark' : ''
      } bg-[#f2f2f7] dark:bg-black text-[#1d1d1f] dark:text-white transition-colors duration-300`}
    >
      {/* Luminous Apple Music Ambient Mesh Gradient */}
      <div className="ambient-mesh pointer-events-none">
        <div className="ambient-mesh-blob ambient-mesh-blob-1" />
        <div className="ambient-mesh-blob ambient-mesh-blob-2" />
        <div className="ambient-mesh-blob ambient-mesh-blob-3" />
      </div>

      {/* Toast Notification Banner */}
      {bannerMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 bg-[#fa243c] text-white text-xs font-bold rounded-full shadow-2xl animate-in fade-in slide-in-from-top duration-200">
          {bannerMessage}
        </div>
      )}

      {/* Mobile Top App Bar (< 768px) */}
      <header className="md:hidden flex items-center justify-between px-4 py-2.5 bg-white/90 dark:bg-[#121214]/90 backdrop-blur-xl border-b border-black/5 dark:border-white/5 z-30 shrink-0 pt-safe">
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="p-2 -ml-1 rounded-xl text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition"
          aria-label="Open library menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div
          className="flex items-center gap-2 cursor-pointer active:opacity-75 transition"
          onClick={() => handleSelectPlaylist(null)}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-[#fa243c] animate-pulse" />
          <span className="font-black text-sm tracking-widest text-[#1d1d1f] dark:text-white uppercase">
            Sampath's Studio
          </span>
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-[#fa243c]/10 text-[#fa243c] border border-[#fa243c]/20">
            PRO
          </span>
        </div>

        <div className="flex items-center gap-1 -mr-1">
          <button
            onClick={() => navigateView('search')}
            className={`p-2 rounded-xl transition ${
              activeView === 'search'
                ? 'bg-[#fa243c] text-white shadow-xs'
                : 'text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95'
            }`}
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition"
            aria-label="Toggle dark / light theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-500" />
            )}
          </button>
        </div>
      </header>

      {/* Spotify xpui 3-Pane Desktop Grid Container */}
      <div
        className={`spotify-xpui-container ${
          rightPanelTab ? 'has-right-panel' : 'no-right-panel'
        }`}
      >
        {/* Pane 1: Collapsible / Resizable Left Sidebar */}
        <Sidebar
          playlists={playlists}
          selectedPlaylistId={selectedPlaylistId}
          likedCount={likedCount}
          activeView={activeView}
          onSelectPlaylist={handleSelectPlaylist}
          onOpenSmartModal={() => setIsSmartModalOpen(true)}
          onOpenSpotifySearch={() => navigateView('search')}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          onTriggerScan={handleTriggerScan}
          onTriggerSpotifySeed={handleTriggerSpotifySeed}
          onDeletePlaylist={handleDeletePlaylist}
          scanning={scanning}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Pane 2: Center Main View (In-Canvas SearchView or Playlist TrackTable) */}
        <main className="spotify-main-view">
          {activeView === 'search' ? (
            <SearchView
              onBackToLibrary={() => navigateView('library')}
              onTrackImported={loadTracks}
              playlists={playlists}
            />
          ) : (
            <TrackTable
              tracks={displayedTracks}
              title={viewTitle}
              subtitle={viewSubtitle}
              playlistId={selectedPlaylistId}
              onOpenAddSongs={() => {
                if (selectedPlaylistId && selectedPlaylistId !== 'liked') {
                  setIsAddSongsModalOpen(true);
                } else {
                  navigateView('search');
                }
              }}
              onDeletePlaylist={handleDeletePlaylist}
              onRemoveFromPlaylist={handleRemoveTrackFromPlaylist}
              onDeleteTrack={handleDeleteTrack}
              onToggleLike={handleToggleLike}
            />
          )}
        </main>

        {/* Pane 3: Docked Right Context Panel (Now Playing, Dual Queue, 10-Band EQ, Synced Lyrics) */}
        <RightPanel />

        {/* Persistent 90px Now Playing Bar & Mobile Mini-Player + Nav Dock */}
        <PlayerBar
          activeView={activeView}
          onExpandMobileNowPlaying={() => setIsMobileNowPlayingOpen(true)}
          onOpenMobileLibrary={() => {
            if (activeView === 'search') {
              navigateView('library');
            } else {
              setIsMobileSidebarOpen(true);
            }
          }}
          onOpenMobileSearch={() => navigateView('search')}
        />
      </div>

      {/* Mobile Floating Mini-Player & Full-Screen Mobile Sheet */}
      {isMobileNowPlayingOpen && (
        <MobileNowPlaying
          isOpen={isMobileNowPlayingOpen}
          onClose={() => setIsMobileNowPlayingOpen(false)}
          onOpenEQ={() => toggleRightPanelTab('eq')}
          onOpenQueue={() => toggleRightPanelTab('queue')}
          onOpenLyrics={() => toggleRightPanelTab('lyrics')}
        />
      )}

      {/* Modal Dialogs */}
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
          onOpenEQ={() => toggleRightPanelTab('eq')}
          onOpenLyrics={() => toggleRightPanelTab('lyrics')}
          onOpenQueue={() => toggleRightPanelTab('queue')}
          onOpenSmartModal={() => setIsSmartModalOpen(true)}
          onOpenSpotifySearch={() => navigateView('search')}
          onOpenStorage={() => setIsStorageModalOpen(true)}
        />
      )}

      {/* Apple Music Lossless & Audio Quality Config Modal */}
      <AudioQualityModal />

      {/* Apple Music Sing Full-Screen Ambient Karaoke */}
      <FullScreenSingModal />

      {/* Disk Storage & Audio Cache Manager Modal */}
      <StorageModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        onCacheCleared={loadTracks}
      />
    </div>
  );
}

export default App;
