import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Play,
  Pause,
  Plus,
  Check,
  Loader2,
  Sparkles,
  Disc,
  Radio,
  Flame,
  Waves,
  Star,
  Award,
  Headphones,
  Mic,
  Film,
  Zap,
  ArrowLeft,
  X,
  ListPlus,
  Heart,
  Music2,
} from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { Playlist, Track } from '../types/audio';

interface SearchViewProps {
  onBackToLibrary: () => void;
  onTrackImported: () => void;
  playlists: Playlist[];
}

type SourceFilter = 'all' | 'audius' | 'global' | 'archive';

interface BrowseCategory {
  id: string;
  title: string;
  query: string;
  gradient: string;
  icon: React.ComponentType<{ className?: string }>;
}

const BROWSE_CATEGORIES: BrowseCategory[] = [
  {
    id: 'synthwave',
    title: 'Synthwave & Retro',
    query: 'Synthwave',
    gradient: 'from-[#ec008c] to-[#fc6767]',
    icon: Sparkles,
  },
  {
    id: 'lofi',
    title: 'Lo-Fi Study Beats',
    query: 'Lo-Fi Hip Hop',
    gradient: 'from-[#f7971e] to-[#ffd200]',
    icon: Headphones,
  },
  {
    id: 'electronic',
    title: 'Electronic & Dance',
    query: 'Electronic Dance Music',
    gradient: 'from-[#11998e] to-[#38ef7d]',
    icon: Radio,
  },
  {
    id: 'rock',
    title: 'Rock & Alternative',
    query: 'Classic Rock',
    gradient: 'from-[#e52d27] to-[#b31217]',
    icon: Flame,
  },
  {
    id: 'chill',
    title: 'Chill & Ambient',
    query: 'Ambient Chillout',
    gradient: 'from-[#8e2de2] to-[#4a00e0]',
    icon: Waves,
  },
  {
    id: 'pop',
    title: 'Pop & Chart Hits',
    query: 'Pop Hits',
    gradient: 'from-[#ff0844] to-[#ffb199]',
    icon: Star,
  },
  {
    id: 'hiphop',
    title: 'Hip-Hop & Urban',
    query: 'Hip Hop',
    gradient: 'from-[#fa709a] to-[#fee140]',
    icon: Mic,
  },
  {
    id: 'lossless',
    title: 'Hi-Res Lossless Studio',
    query: 'Lossless Audiophile Master',
    gradient: 'from-[#00c6ff] to-[#0072ff]',
    icon: Disc,
  },
  {
    id: 'classical',
    title: 'Classical & Focus',
    query: 'Classical Piano Orchestral',
    gradient: 'from-[#4b6cb7] to-[#182848]',
    icon: Award,
  },
  {
    id: 'gaming',
    title: 'Gaming & Cyber Beats',
    query: 'Gaming Cyberpunk',
    gradient: 'from-[#f857a6] to-[#ff5858]',
    icon: Zap,
  },
  {
    id: 'soundtracks',
    title: 'Cinematic Scores',
    query: 'Hans Zimmer Soundtrack',
    gradient: 'from-[#1d2671] to-[#c33764]',
    icon: Film,
  },
  {
    id: 'jazz',
    title: 'Jazz & Lounge',
    query: 'Smooth Jazz',
    gradient: 'from-[#2c3e50] to-[#3498db]',
    icon: Music2,
  },
];

const QUICK_TRENDING = [
  'Daft Punk',
  'Lo-Fi Hip Hop',
  'The Weeknd',
  'Taylor Swift',
  'Hans Zimmer',
  'Synthwave',
  'Billie Eilish',
  'Kendrick Lamar',
];

export const SearchView: React.FC<SearchViewProps> = ({
  onBackToLibrary,
  onTrackImported,
  playlists,
}) => {
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [queuedId, setQueuedId] = useState<string | null>(null);
  const [activePlaylistMenuTrackId, setActivePlaylistMenuTrackId] = useState<string | null>(null);
  const [addedPlaylistMessage, setAddedPlaylistMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const { playTrack, addToPriorityQueue, currentTrack, isPlaying, togglePlay } = usePlayerStore();

  // Auto-focus search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search query
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSuggestions(null);
      return;
    }

    const timer = setTimeout(() => {
      fetchResults(query.trim(), sourceFilter);
    }, 280);

    return () => clearTimeout(timer);
  }, [query, sourceFilter]);

  const fetchResults = async (q: string, filter: SourceFilter) => {
    setLoading(true);
    try {
      const [searchRes, suggRes] = await Promise.allSettled([
        fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&source=${filter}`),
        fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`),
      ]);

      if (searchRes.status === 'fulfilled' && searchRes.value.ok) {
        const data = await searchRes.value.json();
        setResults(data || []);
      }
      if (suggRes.status === 'fulfilled' && suggRes.value.ok) {
        const suggData = await suggRes.value.json();
        setSuggestions(suggData);
      }
    } catch (e) {
      console.warn('Search failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayNow = async (rawTrack: any) => {
    if (currentTrack?.id === rawTrack.id) {
      togglePlay();
      return;
    }

    setResolvingId(rawTrack.id);
    try {
      const res = await fetch('/api/spotify/resolve-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawTrack),
      });

      if (res.ok) {
        const resolved = await res.json();
        onTrackImported();
        await playTrack(resolved);
      }
    } catch (e) {
      console.warn('Could not resolve track:', e);
    } finally {
      setResolvingId(null);
    }
  };

  const handlePlayNext = async (rawTrack: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setResolvingId(rawTrack.id);
    try {
      const res = await fetch('/api/spotify/resolve-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawTrack),
      });

      if (res.ok) {
        const resolved = await res.json();
        onTrackImported();
        addToPriorityQueue(resolved, 'next');
        setQueuedId(rawTrack.id);
        setTimeout(() => setQueuedId(null), 2000);
      }
    } catch (e) {
      console.warn('Could not queue track:', e);
    } finally {
      setResolvingId(null);
    }
  };

  const handleAddToPlaylist = async (rawTrack: any, playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePlaylistMenuTrackId(null);
    try {
      // First ensure track is resolved in db
      const resolveRes = await fetch('/api/spotify/resolve-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawTrack),
      });

      if (resolveRes.ok) {
        const resolved = await resolveRes.json();
        onTrackImported();

        const addRes = await fetch(`/api/playlists/${playlistId}/tracks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackId: resolved.id }),
        });

        if (addRes.ok) {
          const target = playlists.find((p) => p.id === playlistId);
          setAddedPlaylistMessage(`Added to "${target?.name || 'Playlist'}"!`);
          setTimeout(() => setAddedPlaylistMessage(null), 2500);
        }
      }
    } catch (err) {
      console.warn('Failed to add track to playlist:', err);
    }
  };

  const formatDuration = (sec?: number) => {
    const sVal = typeof sec === 'number' && !isNaN(sec) ? sec : 0;
    const m = Math.floor(sVal / 60);
    const s = Math.floor(sVal % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const topResult = suggestions?.topResult || (results.length > 0 ? results[0] : null);
  const otherResults = topResult ? results.filter((r) => r.id !== topResult.id) : results;

  return (
    <div
      className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-white/85 dark:bg-[#121214]/90 backdrop-blur-2xl select-none text-[#1d1d1f] dark:text-white transition-colors animate-in fade-in duration-200"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Toast Notification */}
      {addedPlaylistMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[#fa243c] text-white text-xs font-bold rounded-full shadow-2xl animate-in fade-in slide-in-from-top duration-200">
          {addedPlaylistMessage}
        </div>
      )}

      {/* Sticky Top Header with Ambient Frosted Styling */}
      <header className="sticky top-0 z-20 px-4 sm:px-8 pt-5 pb-4 bg-white/90 dark:bg-[#121214]/90 backdrop-blur-xl border-b border-black/5 dark:border-white/5 space-y-3.5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToLibrary}
            className="p-2 -ml-2 rounded-xl text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition"
            title="Back to Library"
            aria-label="Back to Library"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1d1d1f] dark:text-white">
              Search
            </h1>
            <p className="text-xs text-[#86868b] hidden sm:block">
              Stream full songs across Spotify, YouTube, Audius Lossless, or local files
            </p>
          </div>
        </div>

        {/* Large Cupertino / Spotify Hybrid Search Input */}
        <div className="relative flex items-center">
          <div className="w-full h-11 sm:h-14 px-3.5 sm:px-4 rounded-2xl bg-slate-100/90 dark:bg-white/[0.08] hover:bg-slate-200/60 dark:hover:bg-white/[0.12] focus-within:bg-white dark:focus-within:bg-[#1a1a1c] focus-within:border-black/20 dark:focus-within:border-white/20 focus-within:ring-4 focus-within:ring-[#fa243c]/15 border border-black/5 dark:border-white/10 transition-all flex items-center gap-2.5 sm:gap-3 shadow-inner">
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-[#86868b] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="What do you want to play? (Artists, songs, albums, or paste link...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-xs sm:text-base bg-transparent text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none"
            />
            {loading && <Loader2 className="w-4 h-4 text-[#fa243c] animate-spin shrink-0" />}
            {query.trim() && (
              <button
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="p-1 rounded-full text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition shrink-0"
                aria-label="Clear search query"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Source Filter Segmented Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          <button
            onClick={() => setSourceFilter('all')}
            className={`text-xs px-3.5 py-1.5 rounded-full font-semibold transition shrink-0 ${
              sourceFilter === 'all'
                ? 'bg-[#fa243c] text-white shadow-xs'
                : 'bg-black/5 dark:bg-white/10 text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white'
            }`}
          >
            All Sources
          </button>
          <button
            onClick={() => setSourceFilter('audius')}
            className={`text-xs px-3.5 py-1.5 rounded-full font-semibold transition shrink-0 flex items-center gap-1.5 ${
              sourceFilter === 'audius'
                ? 'bg-[#fa243c] text-white shadow-xs'
                : 'bg-black/5 dark:bg-white/10 text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            <span>Audius Lossless (HQ)</span>
          </button>
          <button
            onClick={() => setSourceFilter('global')}
            className={`text-xs px-3.5 py-1.5 rounded-full font-semibold transition shrink-0 flex items-center gap-1.5 ${
              sourceFilter === 'global'
                ? 'bg-[#fa243c] text-white shadow-xs'
                : 'bg-black/5 dark:bg-white/10 text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760]" />
            <span>Spotify & YouTube</span>
          </button>
          <button
            onClick={() => setSourceFilter('archive')}
            className={`text-xs px-3.5 py-1.5 rounded-full font-semibold transition shrink-0 flex items-center gap-1.5 ${
              sourceFilter === 'archive'
                ? 'bg-[#fa243c] text-white shadow-xs'
                : 'bg-black/5 dark:bg-white/10 text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>Internet Archive</span>
          </button>
        </div>

        {/* Quick Trending Tags */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs text-[#86868b]">
          <span className="text-[11px] font-bold uppercase tracking-wider shrink-0 mr-1 text-[#86868b]">
            Trending:
          </span>
          {QUICK_TRENDING.map((term) => (
            <button
              key={term}
              onClick={() => setQuery(term)}
              className="px-2.5 py-1 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/5 dark:hover:bg-white/10 text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white transition shrink-0 font-medium text-[11px]"
            >
              {term}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 p-3.5 sm:p-8">
        {!query.trim() ? (
          /* Empty Search State: Spotify & Apple Music "Browse All" Genre Grid */
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-2xl font-black tracking-tight text-[#1d1d1f] dark:text-white">
                Browse all
              </h2>
              <span className="text-xs text-[#86868b] font-medium hidden sm:inline">
                Tap any category to start listening
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-4">
              {BROWSE_CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                return (
                  <div
                    key={cat.id}
                    onClick={() => setQuery(cat.query)}
                    className={`group relative h-20 sm:h-32 rounded-xl sm:rounded-2xl p-3 sm:p-4 bg-gradient-to-br ${cat.gradient} cursor-pointer shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 overflow-hidden text-white flex flex-col justify-between`}
                  >
                    <span className="font-extrabold text-xs sm:text-base leading-snug drop-shadow-xs">
                      {cat.title}
                    </span>
                    <div className="self-end translate-x-1 translate-y-1 opacity-80 group-hover:scale-105 transition-all duration-200">
                      <IconComponent className="w-8 h-8 sm:w-14 sm:h-14 stroke-[1.5]" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : loading && results.length === 0 ? (
          /* Loading State */
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-[#fa243c] animate-spin" />
            <p className="text-sm font-semibold text-[#86868b]">
              Searching across open catalogs & Spotify...
            </p>
          </div>
        ) : results.length === 0 ? (
          /* No Results State */
          <div className="py-24 text-center space-y-3 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center mx-auto text-[#86868b]">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#1d1d1f] dark:text-white">
              No matching tracks found for "{query}"
            </h3>
            <p className="text-xs text-[#86868b]">
              Try searching with another artist or song name, or switch source filters above.
            </p>
          </div>
        ) : (
          /* Search Results Layout */
          <div className="space-y-8">
            {/* Top Result + Top 4 Songs Section (Spotify xpui style) */}
            {topResult && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Top Result Card */}
                <div className="lg:col-span-2 space-y-2">
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-[#1d1d1f] dark:text-white">
                    Top result
                  </h3>
                  <div
                    onClick={() => handlePlayNow(topResult)}
                    className="group relative p-5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] border border-black/5 dark:border-white/5 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[230px]"
                  >
                    <div className="flex items-start gap-4">
                      <img
                        src={
                          topResult.coverArtUrl ||
                          'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80'
                        }
                        alt=""
                        className="w-24 h-24 rounded-xl object-cover shadow-md shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#fa243c] block mb-1">
                          Top Match
                        </span>
                        <h4 className="text-lg font-black text-[#1d1d1f] dark:text-white truncate">
                          {topResult.title}
                        </h4>
                        <p className="text-xs font-semibold text-[#86868b] truncate mt-0.5">
                          {topResult.artist}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#6e6e73] dark:text-[#a1a1a6] font-semibold">
                            {topResult.sourceType === 'audius' ? 'Audius Lossless' : 'Open Catalog'}
                          </span>
                          <span className="text-xs text-[#86868b]">
                            {formatDuration(topResult.durationSeconds)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handlePlayNext(topResult, e)}
                          className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-xs font-bold text-[#1d1d1f] dark:text-white transition flex items-center gap-1.5"
                          title="Play Next in Priority Queue"
                        >
                          {queuedId === topResult.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Queued</span>
                            </>
                          ) : (
                            <>
                              <ListPlus className="w-3.5 h-3.5" />
                              <span>Play Next</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Play Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayNow(topResult);
                        }}
                        className="w-12 h-12 rounded-full bg-[#fa243c] text-white flex items-center justify-center shadow-lg group-hover:scale-105 active:scale-95 transition"
                        aria-label="Play Top Result"
                      >
                        {resolvingId === topResult.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : currentTrack?.id === topResult.id && isPlaying ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Top 4 Quick Songs List */}
                <div className="lg:col-span-3 space-y-2">
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-[#1d1d1f] dark:text-white">
                    Songs
                  </h3>
                  <div className="space-y-1">
                    {otherResults.slice(0, 4).map((track) => {
                      const isThisPlaying = currentTrack?.id === track.id && isPlaying;
                      return (
                        <div
                          key={track.id}
                          onClick={() => handlePlayNow(track)}
                          className={`group flex items-center justify-between p-2 rounded-xl transition cursor-pointer ${
                            isThisPlaying
                              ? 'bg-[#fa243c]/10 text-[#fa243c]'
                              : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#1d1d1f] dark:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-slate-200 dark:bg-white/5">
                              <img
                                src={
                                  track.coverArtUrl ||
                                  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80'
                                }
                                alt=""
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                                {resolvingId === track.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Play className="w-4 h-4 fill-current ml-0.5" />
                                )}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate">{track.title}</p>
                              <p className="text-xs text-[#86868b] truncate">{track.artist}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            <span className="text-xs text-[#86868b] hidden sm:block">
                              {formatDuration(track.durationSeconds)}
                            </span>

                            <button
                              onClick={(e) => handlePlayNext(track, e)}
                              className="p-1.5 rounded-lg text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition"
                              title="Add to Next Up Queue"
                            >
                              {queuedId === track.id ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Plus className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* All Search Results Table */}
            <div className="space-y-3 pt-2">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-[#1d1d1f] dark:text-white">
                All Results ({results.length})
              </h3>

              <div className="space-y-1">
                {results.map((track, idx) => {
                  const isThisPlaying = currentTrack?.id === track.id && isPlaying;
                  const isMenuOpen = activePlaylistMenuTrackId === track.id;

                  return (
                    <div
                      key={`${track.id}-${idx}`}
                      onClick={() => handlePlayNow(track)}
                      className={`mobile-track-item group flex items-center justify-between px-3 py-2.5 rounded-xl transition cursor-pointer border border-transparent hover:border-black/5 dark:hover:border-white/5 active:scale-[0.99] ${
                        isThisPlaying
                          ? 'bg-[#fa243c]/10 text-[#fa243c]'
                          : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#1d1d1f] dark:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <span className="w-5 text-center text-xs font-semibold text-[#86868b] shrink-0">
                          {idx + 1}
                        </span>

                        <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-slate-200 dark:bg-white/5">
                          <img
                            src={
                              track.coverArtUrl ||
                              'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80'
                            }
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                            {resolvingId === track.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            )}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{track.title}</p>
                          <p className="text-xs text-[#86868b] truncate">{track.artist}</p>
                        </div>
                      </div>

                      {/* Album Column (Desktop) */}
                      <div className="hidden md:block w-48 text-xs text-[#86868b] truncate px-2">
                        {track.album || 'Single'}
                      </div>

                      {/* Source & Duration & Actions */}
                      <div className="flex items-center gap-3 shrink-0 relative">
                        <span className="hidden sm:inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-[#86868b]">
                          {track.sourceType || 'stream'}
                        </span>

                        <span className="text-xs text-[#86868b] w-12 text-right">
                          {formatDuration(track.durationSeconds)}
                        </span>

                        {/* Add to Queue Button */}
                        <button
                          onClick={(e) => handlePlayNext(track, e)}
                          className="p-1.5 rounded-lg text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition"
                          title="Add to Priority Queue"
                        >
                          {queuedId === track.id ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </button>

                        {/* Add to Playlist Dropdown Trigger */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePlaylistMenuTrackId(isMenuOpen ? null : track.id);
                          }}
                          className="p-1.5 rounded-lg text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition"
                          title="Add to Playlist"
                        >
                          <ListPlus className="w-4 h-4" />
                        </button>

                        {/* Playlist Selection Popover */}
                        {isMenuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-9 w-52 bg-white dark:bg-[#1e1e20] border border-black/10 dark:border-white/15 rounded-xl shadow-2xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-100"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868b] px-2 py-1 block">
                              Add to playlist
                            </span>
                            <div className="max-h-48 overflow-y-auto space-y-0.5">
                              {playlists.map((pl) => (
                                <button
                                  key={pl.id}
                                  onClick={(e) => handleAddToPlaylist(track, pl.id, e)}
                                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold text-[#1d1d1f] dark:text-white hover:bg-[#fa243c] hover:text-white transition flex items-center justify-between"
                                >
                                  <span className="truncate">{pl.name}</span>
                                  <span className="text-[10px] opacity-70">
                                    {pl.trackCount || 0}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
