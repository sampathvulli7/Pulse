import React, { useState, useMemo, useEffect } from 'react';
import {
  Play,
  Pause,
  Plus,
  Clock,
  Check,
  Heart,
  Trash2,
  Search,
  ListPlus,
  AlertCircle,
} from 'lucide-react';
import { Track } from '../types/audio';
import { usePlayerStore } from '../store/playerStore';

interface TrackTableProps {
  tracks: Track[];
  title?: string;
  subtitle?: string;
  playlistId?: string | null;
  onOpenAddSongs?: () => void;
  onDeletePlaylist?: (playlistId: string) => void;
  onRemoveFromPlaylist?: (trackId: string) => void;
  onDeleteTrack?: (trackId: string) => void;
  onToggleLike?: (trackId: string) => void;
}

export const TrackTable: React.FC<TrackTableProps> = ({
  tracks,
  title = 'All Tracks',
  subtitle = 'Unrestricted Personal Music Workstation',
  playlistId,
  onOpenAddSongs,
  onDeletePlaylist,
  onRemoveFromPlaylist,
  onDeleteTrack,
  onToggleLike,
}) => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const addToPriorityQueue = usePlayerStore((s) => s.addToPriorityQueue);

  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'default' | 'title' | 'artist' | 'duration' | 'bpm'>('default');
  const [addedTrackId, setAddedTrackId] = useState<string | null>(null);
  const [confirmDeletePlaylist, setConfirmDeletePlaylist] = useState(false);

  // Progressive rendering window for mobile performance (renders first 40, appends as user scrolls)
  const [visibleCount, setVisibleCount] = useState<number>(45);

  const genres = ['All', 'Synthwave', 'Rock', 'Lo-Fi', 'Electronic', 'Metal', 'Classical', 'Pop', 'Jazz'];

  const filteredAndSorted = useMemo(() => {
    let list = tracks.filter((t) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q));

      const matchesGenre = selectedGenre === 'All' || (t.genre && t.genre.toLowerCase() === selectedGenre.toLowerCase());
      return matchesSearch && matchesGenre;
    });

    if (sortBy === 'title') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'artist') {
      list = [...list].sort((a, b) => a.artist.localeCompare(b.artist));
    } else if (sortBy === 'duration') {
      list = [...list].sort((a, b) => (a.durationSeconds || 0) - (b.durationSeconds || 0));
    } else if (sortBy === 'bpm') {
      list = [...list].sort((a, b) => (a.bpm || 0) - (b.bpm || 0));
    }

    return list;
  }, [tracks, search, selectedGenre, sortBy]);

  // Reset progressive slice when filter or sort criteria changes
  useEffect(() => {
    setVisibleCount(45);
  }, [search, selectedGenre, sortBy]);

  const visibleTracks = useMemo(() => {
    return filteredAndSorted.slice(0, visibleCount);
  }, [filteredAndSorted, visibleCount]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 350) {
      if (visibleCount < filteredAndSorted.length) {
        setVisibleCount((prev) => Math.min(prev + 40, filteredAndSorted.length));
      }
    }
  };

  const formatDuration = (sec?: number) => {
    const sVal = typeof sec === 'number' && !isNaN(sec) ? sec : 0;
    const m = Math.floor(sVal / 60);
    const s = Math.floor(sVal % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handlePlayNext = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    addToPriorityQueue(track, 'next');
    setAddedTrackId(track.id);
    setTimeout(() => setAddedTrackId(null), 1800);
  };

  const handleLike = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleLike) {
      onToggleLike(track.id);
    }
  };

  const handleDelete = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playlistId && onRemoveFromPlaylist) {
      onRemoveFromPlaylist(track.id);
    } else if (onDeleteTrack) {
      onDeleteTrack(track.id);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full p-4 md:p-8 overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col gap-4 mb-5 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {title}
              </h1>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                {filteredAndSorted.length} tracks
              </span>

              {/* Delete Playlist button if custom playlist */}
              {playlistId && onDeletePlaylist && (
                <div className="relative">
                  {confirmDeletePlaylist ? (
                    <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl px-2.5 py-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300">Delete playlist?</span>
                      <button
                        onClick={() => {
                          onDeletePlaylist(playlistId);
                          setConfirmDeletePlaylist(false);
                        }}
                        className="text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:underline ml-1"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeletePlaylist(false)}
                        className="text-[11px] text-slate-500 hover:underline ml-1"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeletePlaylist(true)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Delete this playlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tracks, artists..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs transition"
              />
            </div>

            <div className="relative shrink-0">
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none focus:border-indigo-500 shadow-xs"
                title="Sort tracks"
              >
                <option value="default">Default Order</option>
                <option value="title">Title (A-Z)</option>
                <option value="artist">Artist (A-Z)</option>
                <option value="duration">Duration (Short to Long)</option>
                <option value="bpm">BPM (Slow to Fast)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Genre Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition shrink-0 ${
                selectedGenre === g
                  ? 'bg-slate-900 text-white dark:bg-indigo-600 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Track List Container with Progressive Scroll */}
      <div
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 shadow-xs overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* A. Mobile View (Phones < 768px) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
          {visibleTracks.map((track) => {
            const isCurrent = currentTrack?.id === track.id;
            return (
              <div
                key={`mob-${track.id}`}
                onClick={() => playTrack(track, filteredAndSorted)}
                className={`flex items-center justify-between p-3 active:bg-slate-50 dark:active:bg-slate-800/80 transition cursor-pointer select-none ${
                  isCurrent ? 'bg-indigo-50/70 dark:bg-indigo-600/15 border-l-4 border-indigo-600 dark:border-indigo-500' : ''
                }`}
              >
                {/* Artwork + Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                  <div className="relative shrink-0">
                    <img
                      src={track.coverArtUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80'}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80';
                      }}
                      className="w-12 h-12 rounded-xl object-cover shadow-xs border border-slate-200 dark:border-slate-800"
                    />
                    {isCurrent && (
                      <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                        {isPlaying ? (
                          <div className="w-3 h-3 rounded-full bg-white dark:bg-indigo-400 animate-pulse" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-semibold truncate ${isCurrent ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-900 dark:text-white'}`}>
                      {track.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {track.artist}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                      <span className="font-mono">{formatDuration(track.durationSeconds)}</span>
                      {track.bpm && <span>• {Math.round(track.bpm)} BPM</span>}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => handleLike(track, e)}
                    className="p-2 text-slate-400 hover:text-rose-500 transition"
                    title={track.isFavorite ? 'Unlike song' : 'Like song'}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        track.isFavorite ? 'fill-rose-500 text-rose-500' : 'text-slate-400'
                      }`}
                    />
                  </button>

                  <button
                    onClick={(e) => handlePlayNext(track, e)}
                    className={`p-2 rounded-lg border text-xs font-medium transition ${
                      addedTrackId === track.id
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-slate-700'
                    }`}
                    title="Play Next"
                  >
                    {addedTrackId === track.id ? <Check className="w-3.5 h-3.5" /> : <ListPlus className="w-3.5 h-3.5" />}
                  </button>

                  {(playlistId || onDeleteTrack) && (
                    <button
                      onClick={(e) => handleDelete(track, e)}
                      className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition"
                      title={playlistId ? 'Remove from playlist' : 'Delete track'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* B. Desktop Table (Screens >= 768px) */}
        <table className="w-full text-left border-collapse hidden md:table">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 bg-slate-50/95 dark:bg-slate-950/90 backdrop-blur z-10">
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-3 w-8 text-center"></th>
              <th className="py-3 px-4">Title & Artist</th>
              <th className="py-3 px-4 hidden md:table-cell">Album</th>
              <th className="py-3 px-4 hidden lg:table-cell">Energy / BPM</th>
              <th className="py-3 px-4 w-28 text-center">Source</th>
              <th className="py-3 px-4 w-20 text-right">
                <Clock className="w-3.5 h-3.5 inline" />
              </th>
              <th className="py-3 px-4 w-28 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
            {visibleTracks.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <tr
                  key={track.id}
                  onClick={() => playTrack(track, filteredAndSorted)}
                  className={`group cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition ${
                    isCurrent ? 'bg-indigo-50/80 dark:bg-indigo-600/10 border-l-2 border-indigo-600 dark:border-indigo-500' : ''
                  }`}
                >
                  {/* Index / Play Button */}
                  <td className="py-2.5 px-4 text-center">
                    {isCurrent ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlay();
                        }}
                        className="text-indigo-600 dark:text-indigo-400 hover:scale-110 transition"
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4 fill-indigo-600 dark:fill-indigo-400" />
                        ) : (
                          <Play className="w-4 h-4 fill-indigo-600 dark:fill-indigo-400 ml-0.5" />
                        )}
                      </button>
                    ) : (
                      <span className="font-mono text-slate-400 group-hover:hidden">
                        {idx + 1}
                      </span>
                    )}
                    {!isCurrent && (
                      <button className="hidden group-hover:inline text-indigo-600 dark:text-white">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </button>
                    )}
                  </td>

                  {/* Favorite / Heart Button */}
                  <td className="py-2.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleLike(track, e)}
                      className="p-1 rounded text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 transition"
                      title={track.isFavorite ? 'Unlike song' : 'Like song'}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          track.isFavorite
                            ? 'fill-rose-500 text-rose-500'
                            : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400'
                        }`}
                      />
                    </button>
                  </td>

                  {/* Title & Artist */}
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={track.coverArtUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=80&q=80'}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=80&q=80';
                        }}
                        className="w-9 h-9 rounded-lg object-cover shadow-xs border border-slate-200 dark:border-slate-800"
                      />
                      <div className="min-w-0">
                        <div
                          className={`font-semibold truncate ${
                            isCurrent
                              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {track.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {track.artist}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Album */}
                  <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 hidden md:table-cell truncate max-w-xs">
                    {track.album || '—'}
                  </td>

                  {/* Energy / BPM */}
                  <td className="py-2.5 px-4 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      {track.bpm && (
                        <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {Math.round(track.bpm)} BPM
                        </span>
                      )}
                      {track.genre && (
                        <span className="text-[11px] text-slate-400 truncate max-w-[100px]">
                          {track.genre}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Source Badge */}
                  <td className="py-2.5 px-4 text-center">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {track.sourceType === 'local' ? 'Local' : track.sourceType === 'youtube' ? 'YouTube' : 'Stream'}
                    </span>
                  </td>

                  {/* Duration */}
                  <td className="py-2.5 px-4 text-right font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                    {formatDuration(track.durationSeconds)}
                  </td>

                  {/* Actions: Play Next & Delete */}
                  <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={(e) => handlePlayNext(track, e)}
                        className={`text-[10px] font-medium px-2 py-1 rounded-lg transition flex items-center justify-center gap-1 ${
                          addedTrackId === track.id
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-white dark:hover:text-slate-900'
                        }`}
                        title="Add to Priority Queue (Plays Next)"
                      >
                        {addedTrackId === track.id ? (
                          <>
                            <Check className="w-3 h-3" />
                            Queued
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            Next
                          </>
                        )}
                      </button>

                      {(playlistId || onDeleteTrack) && (
                        <button
                          onClick={(e) => handleDelete(track, e)}
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition opacity-60 group-hover:opacity-100"
                          title={playlistId ? 'Remove from playlist' : 'Delete track from library'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Load More Button / Indicator */}
        {visibleCount < filteredAndSorted.length && (
          <div className="p-4 text-center border-t border-slate-100 dark:border-slate-800/40">
            <button
              onClick={() => setVisibleCount((prev) => Math.min(prev + 50, filteredAndSorted.length))}
              className="text-xs px-4 py-2 font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition shadow-2xs"
            >
              Showing {visibleCount} of {filteredAndSorted.length} tracks • Scroll or tap to load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
