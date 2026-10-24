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
  Music2,
  Disc,
  Radio,
  Sparkles,
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

  // Progressive rendering window
  const [visibleCount, setVisibleCount] = useState<number>(50);
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [enhancedTracks, setEnhancedTracks] = useState<(Track & { isEnhancedRecommendation?: boolean })[]>([]);
  const [loadingEnhance, setLoadingEnhance] = useState(false);

  const genres = ['All', 'Synthwave', 'Rock', 'Lo-Fi', 'Electronic', 'Metal', 'Classical', 'Pop', 'Jazz'];

  const filteredAndSorted = useMemo(() => {
    const existingIds = new Set(tracks.map((t) => t.id));
    const combinedTracks = isEnhanced
      ? [...tracks, ...enhancedTracks.filter((t) => !existingIds.has(t.id))]
      : tracks;

    let list = combinedTracks.filter((t) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q));

      const matchesGenre =
        selectedGenre === 'All' || (t.genre && t.genre.toLowerCase() === selectedGenre.toLowerCase());
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
  }, [tracks, search, selectedGenre, sortBy, isEnhanced, enhancedTracks]);

  useEffect(() => {
    setVisibleCount(50);
  }, [search, selectedGenre, sortBy]);

  const visibleTracks = useMemo(() => {
    return filteredAndSorted.slice(0, visibleCount);
  }, [filteredAndSorted, visibleCount]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 350) {
      if (visibleCount < filteredAndSorted.length) {
        setVisibleCount((prev) => Math.min(prev + 50, filteredAndSorted.length));
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

  const handleStartRadio = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/tracks/${track.id}/radio?limit=30`);
      if (res.ok) {
        const data = await res.json();
        if (data.tracks && data.tracks.length > 0) {
          await playTrack(data.tracks[0], data.tracks);
        }
      }
    } catch (err) {
      console.warn('Could not start Song Radio:', err);
    }
  };

  const handleToggleEnhance = async () => {
    if (isEnhanced) {
      setIsEnhanced(false);
      setEnhancedTracks([]);
      return;
    }

    setLoadingEnhance(true);
    try {
      let recs: Track[] = [];
      if (playlistId && !playlistId.startsWith('daily-mix-') && playlistId !== 'liked') {
        const res = await fetch(`/api/playlists/${playlistId}/enhance?limit=10`);
        if (res.ok) {
          const data = await res.json();
          recs = data.enhancedTracks || [];
        }
      } else if (tracks.length > 0) {
        const seedId = tracks[0].id;
        const res = await fetch(`/api/tracks/${seedId}/radio?limit=10`);
        if (res.ok) {
          const data = await res.json();
          recs = data.tracks || [];
        }
      }

      const marked = recs.map((t) => ({ ...t, isEnhancedRecommendation: true }));
      setEnhancedTracks(marked);
      setIsEnhanced(true);
    } catch (err) {
      console.warn('Could not enhance playlist:', err);
    } finally {
      setLoadingEnhance(false);
    }
  };

  const handleAddEnhancedTrack = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!playlistId || playlistId.startsWith('daily-mix-') || playlistId === 'liked') {
      // Add to queue if not a custom playlist
      addToPriorityQueue(track, 'next');
      setAddedTrackId(track.id);
      setTimeout(() => setAddedTrackId(null), 1800);
      return;
    }

    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id }),
      });
      if (res.ok) {
        setAddedTrackId(track.id);
        setTimeout(() => setAddedTrackId(null), 1800);
      }
    } catch (err) {
      console.warn('Failed to add enhanced track to playlist:', err);
    }
  };

  return (
    <div
      onScroll={handleScroll}
      className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-white/85 dark:bg-[#121214]/90 backdrop-blur-2xl select-none text-[#1d1d1f] dark:text-white transition-colors"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Apple Music + Spotify Hybrid Playlist Hero Header with Ambient Frosted Gradient */}
      <div className="relative p-4 sm:p-6 md:p-8 bg-gradient-to-b from-slate-200/50 via-white/20 to-transparent dark:from-[#2a2a2a] dark:to-transparent flex flex-row items-center md:items-end gap-3.5 sm:gap-6 shrink-0 border-b border-black/5 dark:border-white/5">
        {/* Hero Artwork */}
        <div className="w-20 h-20 sm:w-36 sm:h-36 md:w-52 md:h-52 rounded-xl md:rounded-2xl shadow-xl overflow-hidden bg-slate-200 dark:bg-[#181818] shrink-0 border border-black/5 dark:border-white/5 flex items-center justify-center">
          {tracks.length > 0 && tracks[0].coverArtUrl ? (
            <img
              src={tracks[0].coverArtUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <Disc className="w-10 h-10 sm:w-20 sm:h-20 text-[#86868b]" />
          )}
        </div>

        {/* Hero Text */}
        <div className="flex-1 min-w-0 flex flex-col justify-end">
          <span className="text-[10px] sm:text-xs uppercase font-bold text-[#86868b] tracking-wider block mb-0.5 sm:mb-1">
            {playlistId ? 'Playlist' : 'Collection'}
          </span>
          <h1 className="text-xl sm:text-3xl md:text-5xl font-black tracking-tight text-[#1d1d1f] dark:text-white mb-1 md:mb-2 truncate">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-[#6e6e73] dark:text-[#b3b3b3] mb-2 sm:mb-4 line-clamp-1 sm:line-clamp-2">{subtitle}</p>

          <div className="flex items-center gap-2 text-xs font-medium text-[#6e6e73] dark:text-[#b3b3b3]">
            <span className="font-bold text-[#1d1d1f] dark:text-white">Sampath's Studio</span>
            <span>•</span>
            <span>{filteredAndSorted.length} songs</span>
            {onOpenAddSongs && (
              <>
                <span>•</span>
                <button
                  onClick={onOpenAddSongs}
                  className="text-[#fa243c] hover:underline font-semibold"
                >
                  + Add tracks
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Toolbar & Filters */}
      <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 bg-white/95 dark:bg-[#121214]/95 backdrop-blur-md z-20 border-b border-black/5 dark:border-white/5">
        {/* Play Button & Secondary Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (filteredAndSorted.length > 0) {
                if (currentTrack && filteredAndSorted.some((t) => t.id === currentTrack.id)) {
                  togglePlay();
                } else {
                  playTrack(filteredAndSorted[0], filteredAndSorted);
                }
              }
            }}
            disabled={filteredAndSorted.length === 0}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#fa243c] hover:bg-[#d91b32] hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-[#fa243c]/25 transition disabled:opacity-50"
            title="Play Playlist"
          >
            {isPlaying && currentTrack && filteredAndSorted.some((t) => t.id === currentTrack.id) ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-1" />
            )}
          </button>

          {/* Spotify Enhance Button */}
          <button
            onClick={handleToggleEnhance}
            disabled={loadingEnhance}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 border ${
              isEnhanced
                ? 'bg-[#fa243c] text-white border-[#fa243c] shadow-md shadow-[#fa243c]/20'
                : 'bg-black/5 dark:bg-white/5 text-[#6e6e73] dark:text-[#b3b3b3] border-black/10 dark:border-white/10 hover:border-[#fa243c] hover:text-[#fa243c]'
            }`}
            title="Enhance Playlist: Get tailored track recommendations"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isEnhanced ? 'fill-current' : ''} ${loadingEnhance ? 'animate-spin' : ''}`} />
            <span>{loadingEnhance ? 'Enhancing...' : isEnhanced ? 'Enhanced' : 'Enhance'}</span>
          </button>

          {/* Delete Playlist Confirmation */}
          {playlistId && onDeletePlaylist && (
            <div>
              {confirmDeletePlaylist ? (
                <div className="flex items-center gap-2 bg-[#fa243c]/10 border border-[#fa243c]/30 rounded-lg px-3 py-1.5 text-xs">
                  <AlertCircle className="w-4 h-4 text-[#fa243c]" />
                  <span className="text-[#1d1d1f] dark:text-white font-medium">Delete playlist?</span>
                  <button
                    onClick={() => {
                      onDeletePlaylist(playlistId);
                      setConfirmDeletePlaylist(false);
                    }}
                    className="font-bold text-[#fa243c] hover:underline"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDeletePlaylist(false)}
                    className="text-[#6e6e73] dark:text-[#b3b3b3] hover:underline ml-1"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeletePlaylist(true)}
                  className="p-2 text-[#86868b] hover:text-[#fa243c] transition"
                  title="Delete playlist"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-[#86868b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search in playlist..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs bg-black/5 dark:bg-[#242424] border border-black/10 dark:border-white/10 rounded-full pl-9 pr-3.5 py-2 text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:border-[#fa243c] transition"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="text-xs bg-black/5 dark:bg-[#242424] border border-black/10 dark:border-white/10 rounded-full px-3 py-2 text-[#1d1d1f] dark:text-[#b3b3b3] hover:text-black dark:hover:text-white cursor-pointer focus:outline-none"
            title="Sort tracks"
          >
            <option value="default">Default Order</option>
            <option value="title">Title (A-Z)</option>
            <option value="artist">Artist (A-Z)</option>
            <option value="duration">Duration</option>
            <option value="bpm">BPM (Speed)</option>
          </select>
        </div>
      </div>

      {/* Genre Pills */}
      <div className="px-6 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {genres.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGenre(g)}
            className={`spotify-filter-pill ${selectedGenre === g ? 'active' : ''}`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Track List Table */}
      <div className="px-3 sm:px-6 pb-28 md:pb-12 flex-1">
        {/* Desktop Sticky Table Header */}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-black/5 dark:border-white/10 text-[11px] font-semibold text-[#86868b] dark:text-[#b3b3b3] uppercase tracking-wider sticky top-16 bg-white/95 dark:bg-[#121214]/95 backdrop-blur-md z-10">
              <th className="py-3 px-2 sm:px-3 w-8 sm:w-10 text-center">#</th>
              <th className="py-3 px-1 sm:px-2 w-7 sm:w-8 text-center"></th>
              <th className="py-3 px-2 sm:px-4">Title</th>
              <th className="py-3 px-4 hidden md:table-cell">Album</th>
              <th className="py-3 px-4 hidden lg:table-cell">BPM / Key</th>
              <th className="py-3 px-4 w-28 text-center hidden sm:table-cell">Audio Quality</th>
              <th className="py-3 px-2 sm:px-4 w-16 sm:w-20 text-right">
                <Clock className="w-4 h-4 inline" />
              </th>
              <th className="py-3 px-4 w-24 text-center hidden sm:table-cell">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5 text-xs">
            {visibleTracks.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <tr
                  key={track.id}
                  onClick={() => playTrack(track, filteredAndSorted)}
                  className={`group cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition ${
                    isCurrent ? 'bg-[#fa243c]/[0.06] dark:bg-white/5' : ''
                  }`}
                >
                  {/* # Index / Equalizer Waves / Play */}
                  <td className="py-2.5 sm:py-3 px-2 sm:px-3 text-center">
                    {isCurrent ? (
                      isPlaying ? (
                        <div className="flex items-end justify-center gap-0.5 h-4 text-[#fa243c]">
                          <span className="w-0.5 h-3 bg-[#fa243c] rounded-full eq-bar-1" />
                          <span className="w-0.5 h-4 bg-[#fa243c] rounded-full eq-bar-2" />
                          <span className="w-0.5 h-2 bg-[#fa243c] rounded-full eq-bar-3" />
                        </div>
                      ) : (
                        <span className="text-[#fa243c] font-bold">❚❚</span>
                      )
                    ) : (
                      <>
                        <span className="font-mono text-[#86868b] dark:text-[#b3b3b3] group-hover:hidden">
                          {idx + 1}
                        </span>
                        <Play className="w-3.5 h-3.5 fill-[#1d1d1f] dark:fill-white text-[#1d1d1f] dark:text-white hidden group-hover:inline ml-0.5" />
                      </>
                    )}
                  </td>

                  {/* Heart / Like */}
                  <td className="py-2.5 sm:py-3 px-1 sm:px-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleLike(track, e)}
                      className="p-1 rounded text-[#86868b] hover:text-[#fa243c] transition"
                      title={track.isFavorite ? 'Unlike song' : 'Like song'}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          track.isFavorite
                            ? 'fill-[#fa243c] text-[#fa243c]'
                            : 'opacity-0 group-hover:opacity-100 text-[#86868b]'
                        }`}
                      />
                    </button>
                  </td>

                  {/* Title & Artist */}
                  <td className="py-2.5 sm:py-3 px-2 sm:px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          track.coverArtUrl ||
                          'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=80&q=80'
                        }
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover shadow-sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`font-semibold truncate text-sm ${
                              isCurrent ? 'text-[#fa243c] font-bold' : 'text-[#1d1d1f] dark:text-white'
                            }`}
                          >
                            {track.title}
                          </span>
                          {track.isHiRes ? (
                            <span className="apple-lossless-badge text-[9px] px-1 py-0.2 rounded font-mono font-bold tracking-tight bg-black/5 dark:bg-white/10 text-[#86868b] dark:text-[#a1a1a6] border border-black/10 dark:border-white/15">
                              HI-RES
                            </span>
                          ) : track.isLossless ? (
                            <span className="apple-lossless-badge text-[9px] px-1 py-0.2 rounded font-mono font-bold tracking-tight bg-black/5 dark:bg-white/10 text-[#86868b] dark:text-[#a1a1a6] border border-black/10 dark:border-white/15">
                              LOSSLESS
                            </span>
                          ) : null}
                          {track.isSpatialAvailable && (
                            <span className="apple-lossless-badge text-[9px] px-1 py-0.2 rounded font-mono font-bold tracking-tight bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                              SPATIAL
                            </span>
                          )}
                          {(track as any).isEnhancedRecommendation && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-[#fa243c] font-semibold bg-[#fa243c]/10 border border-[#fa243c]/30 px-1.5 py-0.5 rounded-full shrink-0">
                              <Sparkles className="w-2.5 h-2.5 fill-current" />
                              Enhanced
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#86868b] dark:text-[#b3b3b3] truncate mt-0.5">
                          {track.artist}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Album */}
                  <td className="py-3 px-4 text-[#86868b] dark:text-[#b3b3b3] hidden md:table-cell truncate max-w-xs">
                    {track.album || '—'}
                  </td>

                  {/* BPM / Key */}
                  <td className="py-3 px-4 hidden lg:table-cell text-[#86868b] dark:text-[#b3b3b3]">
                    <div className="flex items-center gap-2">
                      {track.bpm && (
                        <span className="font-mono text-[11px] text-[#1d1d1f] dark:text-white bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded">
                          {Math.round(track.bpm)} BPM
                        </span>
                      )}
                      {track.keySignature && (
                        <span className="text-[11px] text-[#86868b] font-mono">
                          {track.keySignature}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Audio Quality / Source Badge */}
                  <td className="py-2.5 sm:py-3 px-4 text-center hidden sm:table-cell">
                    <div className="inline-flex flex-col items-center">
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[#1d1d1f] dark:text-[#b3b3b3]">
                        {track.codec || track.sourceType}
                      </span>
                      {track.sampleRate && (
                        <span className="text-[9px] font-mono text-[#86868b] mt-0.5">
                          {track.sampleRate >= 1000 ? `${track.sampleRate / 1000}kHz` : `${track.sampleRate}Hz`} / {track.bitDepth || 16}b
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Duration */}
                  <td className="py-2.5 sm:py-3 px-2 sm:px-4 text-right font-mono text-[#86868b] dark:text-[#b3b3b3] text-xs">
                    {formatDuration(track.durationSeconds)}
                  </td>

                  {/* Actions: Add to Priority Queue & Delete */}
                  <td className="py-2.5 sm:py-3 px-4 text-center hidden sm:table-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
                      {(track as any).isEnhancedRecommendation ? (
                        <button
                          onClick={(e) => handleAddEnhancedTrack(track, e)}
                          className={`text-[10px] font-semibold px-2 py-1 rounded transition flex items-center justify-center gap-1 ${
                            addedTrackId === track.id
                              ? 'bg-[#fa243c] text-white'
                              : 'bg-[#fa243c]/15 hover:bg-[#fa243c] text-[#fa243c] hover:text-white border border-[#fa243c]/30'
                          }`}
                          title="Add to Playlist"
                        >
                          {addedTrackId === track.id ? (
                            <>
                              <Check className="w-3 h-3" />
                              Added
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              Add
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handlePlayNext(track, e)}
                          className={`text-[10px] font-semibold px-2 py-1 rounded transition flex items-center justify-center gap-1 ${
                            addedTrackId === track.id
                              ? 'bg-[#fa243c] text-white'
                              : 'bg-black/5 dark:bg-white/10 hover:bg-[#fa243c] text-[#1d1d1f] dark:text-white hover:text-white'
                          }`}
                          title="Add to Next Up Queue"
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
                      )}

                      <button
                        onClick={(e) => handleStartRadio(track, e)}
                        className="p-1 text-[#86868b] hover:text-[#fa243c] rounded transition"
                        title="Start Song Radio (30 similar tracks)"
                      >
                        <Radio className="w-3.5 h-3.5" />
                      </button>

                      {(playlistId || onDeleteTrack) && (
                        <button
                          onClick={(e) => handleDelete(track, e)}
                          className="p-1 text-[#86868b] hover:text-[#fa243c] rounded transition"
                          title={playlistId ? 'Remove from playlist' : 'Delete track'}
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

        {/* Load More Indicator */}
        {visibleCount < filteredAndSorted.length && (
          <div className="p-4 text-center">
            <button
              onClick={() => setVisibleCount((prev) => Math.min(prev + 50, filteredAndSorted.length))}
              className="text-xs px-4 py-2 font-semibold text-[#86868b] dark:text-[#b3b3b3] hover:text-[#1d1d1f] dark:hover:text-white bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition"
            >
              Showing {visibleCount} of {filteredAndSorted.length} tracks • Tap to load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
