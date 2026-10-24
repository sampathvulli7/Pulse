import React, { useState } from 'react';
import { X, Search, Plus, Check, Music, Sparkles } from 'lucide-react';
import { Track } from '../types/audio';

interface AddSongsModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlistId: string | null;
  playlistName: string;
  allTracks: Track[];
  currentTrackIds: Set<string>;
  onTrackAdded: (track: Track) => void;
}

export const AddSongsModal: React.FC<AddSongsModalProps> = ({
  isOpen,
  onClose,
  playlistId,
  playlistName,
  allTracks,
  currentTrackIds,
  onTrackAdded,
}) => {
  const [search, setSearch] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filtered = allTracks.filter((t) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      (t.album && t.album.toLowerCase().includes(q))
    );
  });

  const handleAddTrack = async (track: Track) => {
    if (!playlistId) return;

    setLoadingId(track.id);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id }),
      });

      if (res.ok) {
        setAddedIds((prev) => new Set(prev).add(track.id));
        onTrackAdded(track);
      }
    } catch (err) {
      console.warn('Failed to add track to playlist:', err);
    } finally {
      setLoadingId(null);
    }
  };

  const formatDuration = (sec?: number) => {
    const sVal = typeof sec === 'number' && !isNaN(sec) ? sec : 0;
    const m = Math.floor(sVal / 60);
    const s = Math.floor(sVal % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Add Songs to "{playlistName}"
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose tracks from your library to add to this playlist
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by title, artist, or album..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
              autoFocus
            />
          </div>
        </div>

        {/* Track List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No matching tracks found.
            </div>
          ) : (
            filtered.map((track) => {
              const isAlreadyIn = currentTrackIds.has(track.id) || addedIds.has(track.id);
              const isLoading = loadingId === track.id;

              return (
                <div
                  key={track.id}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition group border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/60"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                    <img
                      src={track.coverArtUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=80&q=80'}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=80&q=80';
                      }}
                      className="w-10 h-10 rounded-lg object-cover shadow-xs border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {track.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {track.artist} • {track.album || 'Single'}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0 hidden sm:inline">
                      {formatDuration(track.durationSeconds)}
                    </span>
                  </div>

                  {/* Add Button */}
                  <button
                    onClick={() => handleAddTrack(track)}
                    disabled={isAlreadyIn || isLoading}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition shrink-0 ${
                      isAlreadyIn
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-default'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs active:scale-95'
                    }`}
                  >
                    {isAlreadyIn ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        Added
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between text-xs text-slate-500">
          <span>{filtered.length} tracks available</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-800 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
