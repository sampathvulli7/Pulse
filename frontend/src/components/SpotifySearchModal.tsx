import React, { useState, useEffect } from 'react';
import { X, Search, Play, Plus, Check, Loader2, Sparkles, Globe, Radio } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';

interface SpotifySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackImported: () => void;
}

type SourceFilter = 'all' | 'audius' | 'global' | 'archive';

export const SpotifySearchModal: React.FC<SpotifySearchModalProps> = ({
  isOpen,
  onClose,
  onTrackImported,
}) => {
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [queuedId, setQueuedId] = useState<string | null>(null);

  const { playTrack, addToPriorityQueue } = usePlayerStore();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      fetchResults(query.trim(), sourceFilter);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, sourceFilter]);

  const fetchResults = async (q: string, filter: SourceFilter) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&source=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data || []);
      }
    } catch (e) {
      console.warn('Search failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayNow = async (rawTrack: any) => {
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
        onClose();
      }
    } catch (e) {
      console.warn('Could not resolve track:', e);
    } finally {
      setResolvingId(null);
    }
  };

  const handlePlayNext = async (rawTrack: any) => {
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

  if (!isOpen) return null;

  const quickPicks = ['Daft Punk', 'Lofi Hip Hop', 'Taylor Swift', 'The Weeknd', 'Synthwave', 'Hans Zimmer'];

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[82vh] transition-colors">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Universal Search
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Stream full songs instantly across open platforms or paste any Spotify link
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Filter Segmented Control */}
        <div className="px-5 pt-3 pb-2 flex items-center gap-1.5 bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800/80 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setSourceFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition shrink-0 ${
              sourceFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            All Sources
          </button>
          <button
            onClick={() => setSourceFilter('audius')}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition shrink-0 ${
              sourceFilter === 'audius'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            Audius (HQ)
          </button>
          <button
            onClick={() => setSourceFilter('global')}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition shrink-0 ${
              sourceFilter === 'global'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            Open Catalog
          </button>
          <button
            onClick={() => setSourceFilter('archive')}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition shrink-0 ${
              sourceFilter === 'archive'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            Internet Archive
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-white dark:bg-slate-900">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search song, artist, album, or paste Spotify link..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full text-sm bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {results.length === 0 ? (
            <div className="py-14 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {query.trim() ? 'No matching tracks found' : 'Explore music or paste a Spotify link'}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                  {query.trim()
                    ? 'Try searching by artist or track title, or switch sources above.'
                    : 'Search any artist or song name to instantly stream without ads or skip limits.'}
                </p>
              </div>

              {!query.trim() && (
                <div className="pt-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                    Popular searches
                  </span>
                  <div className="flex flex-wrap justify-center gap-1.5 max-w-md mx-auto">
                    {quickPicks.map((pick) => (
                      <button
                        key={pick}
                        onClick={() => setQuery(pick)}
                        className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                      >
                        {pick}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            results.map((t) => {
              const isResolving = resolvingId === t.id;
              const isQueued = queuedId === t.id;
              const durationFormatted = `${Math.floor((t.durationSeconds || 180) / 60)}:${(
                (t.durationSeconds || 180) % 60
              )
                .toString()
                .padStart(2, '0')}`;

              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition group"
                >
                  <img
                    src={t.coverArtUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80'}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80';
                    }}
                    className="w-12 h-12 rounded-lg object-cover shadow-xs border border-slate-200/60 dark:border-slate-700/60"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {t.title}
                      </span>
                      {t.platformBadge && (
                        <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {t.platformBadge}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {t.artist}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                      {t.album} • {durationFormatted}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handlePlayNext(t)}
                      disabled={isResolving}
                      className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                        isQueued
                          ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-slate-300 dark:border-slate-700'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                      }`}
                      title="Add to Priority Queue"
                    >
                      {isQueued ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Queued
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          Queue
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handlePlayNow(t)}
                      disabled={isResolving}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-xs transition flex items-center gap-1.5 active:scale-95"
                      title="Play track now"
                    >
                      {isResolving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Loading
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Play
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
