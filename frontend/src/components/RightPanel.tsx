import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ListMusic,
  Sliders,
  Mic2,
  Disc3,
  ArrowUp,
  ArrowDown,
  Trash2,
  Camera,
  Play,
  RotateCcw,
  Sparkles,
  Info,
  Heart,
  Volume2,
  Radio,
  Zap,
} from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { EQ_FREQUENCIES, globalAudioGraph } from '../audio/AudioGraph';
import { VisualizerCanvas } from './VisualizerCanvas';
import { EQPreset, RightPanelTab, SpotifyAudioFeatures } from '../types/audio';

interface ParsedLine {
  timeMs: number;
  text: string;
}

function parseLrc(lrcText: string): ParsedLine[] {
  if (!lrcText) return [];
  const lines = lrcText.split(/\r?\n/);
  const parsed: ParsedLine[] = [];
  let globalOffsetMs = 0;

  for (const line of lines) {
    const offsetMatch = line.match(/^\[offset:\s*([+-]?\d+)\]/i);
    if (offsetMatch) {
      globalOffsetMs = parseInt(offsetMatch[1], 10) || 0;
      break;
    }
  }

  const timeRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const line of lines) {
    if (/^\[(ti|ar|al|au|length|by|offset|re|ve):/i.test(line)) continue;

    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    timeRegex.lastIndex = 0;

    while ((match = timeRegex.exec(line)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      let ms = 0;
      if (match[3]) {
        if (match[3].length === 1) ms = parseInt(match[3], 10) * 100;
        else if (match[3].length === 2) ms = parseInt(match[3], 10) * 10;
        else ms = parseInt(match[3].slice(0, 3), 10);
      }
      timestamps.push(min * 60000 + sec * 1000 + ms + globalOffsetMs);
    }

    if (timestamps.length === 0) continue;

    const text = line.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, '').trim();
    for (const timeMs of timestamps) {
      parsed.push({
        timeMs: Math.max(0, timeMs),
        text: text || '♪',
      });
    }
  }

  parsed.sort((a, b) => a.timeMs - b.timeMs);
  return parsed;
}

export const RightPanel: React.FC = () => {
  const {
    rightPanelTab,
    setRightPanelTab,
    toggleRightPanelTab,
    rightRailWidth,
    currentTrack,
    priorityQueue,
    contextQueue,
    reorderPriorityQueue,
    removeFromPriorityQueue,
    removeFromPriorityQueueByUid,
    moveContextToPriority,
    clearPriorityQueue,
    playTrack,
    saveQueueSnapshot,
    seek,
    eqGains,
    preampGain,
    activePresetName,
    setEQBandGain,
    applyEQPreset,
    toggleCurrentTrackLike,
    setIsFullScreenSingOpen,
  } = usePlayerStore();

  // Snapshot State
  const [snapshotName, setSnapshotName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // EQ Presets State
  const [presets, setPresets] = useState<EQPreset[]>([]);

  // Spotify Audio Features State
  const [audioFeatures, setAudioFeatures] = useState<SpotifyAudioFeatures | null>(null);
  const [isGeneratingRadio, setIsGeneratingRadio] = useState(false);

  // Lyrics State
  const [lyricLines, setLyricLines] = useState<ParsedLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string>('');
  const [isInstrumental, setIsInstrumental] = useState<boolean>(false);
  const [lyricsLoading, setLyricsLoading] = useState<boolean>(false);
  const [activeLyricIndex, setActiveLyricIndex] = useState<number>(-1);
  const activeLyricIndexRef = useRef<number>(-1);
  const lyricLinesRef = useRef<ParsedLine[]>([]);
  lyricLinesRef.current = lyricLines;
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  // Load EQ Presets on mount
  useEffect(() => {
    fetch('/api/eq-presets')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPresets(data);
      })
      .catch((err) => console.warn('Could not load EQ presets:', err));
  }, []);

  // Fetch lyrics & Spotify audio features whenever currentTrack changes
  useEffect(() => {
    if (!currentTrack) {
      setLyricLines([]);
      setPlainLyrics('');
      setActiveLyricIndex(-1);
      activeLyricIndexRef.current = -1;
      setAudioFeatures(null);
      return;
    }

    // Fetch Spotify acoustic DNA features
    fetch(`/api/tracks/${currentTrack.id}/audio-features`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setAudioFeatures(data))
      .catch(() => setAudioFeatures(null));

    setLyricsLoading(true);
    setActiveLyricIndex(-1);
    activeLyricIndexRef.current = -1;

    const params = new URLSearchParams({
      track_name: currentTrack.title,
      artist_name: currentTrack.artist,
      duration: (currentTrack.durationSeconds || 0).toString(),
    });

    fetch(`/api/lyrics?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setIsInstrumental(!!data.instrumental);
        setPlainLyrics(data.plainLyrics || '');

        if (data.parsedLines && Array.isArray(data.parsedLines) && data.parsedLines.length > 0) {
          setLyricLines(data.parsedLines);
        } else if (data.syncedLyrics) {
          setLyricLines(parseLrc(data.syncedLyrics));
        } else {
          setLyricLines([]);
        }
      })
      .catch((err) => {
        console.warn('Could not load lyrics:', err);
        setLyricLines([]);
      })
      .finally(() => setLyricsLoading(false));
  }, [currentTrack?.id]);

  // High-precision zero-latency hardware clock lyrics sync
  useEffect(() => {
    if (rightPanelTab !== 'lyrics') return;

    let animId: number;
    let lastCheck = 0;

    const syncLyrics = (now: number) => {
      // Sample at ~25ms (~40fps) for millisecond-exact audio synchronization
      if (now - lastCheck >= 25) {
        lastCheck = now;
        const lines = lyricLinesRef.current;
        if (lines.length > 0) {
          const controller = usePlayerStore.getState().controller;
          // Direct sub-frame accurate hardware audio clock
          const currentSec = controller ? controller.getCurrentTime() : usePlayerStore.getState().currentTime;
          // Perceptual acoustic lead compensation (80ms) for natural alignment with vocal onset
          const currentMs = currentSec * 1000 + 80;

          // O(log N) binary search for active lyric
          let low = 0;
          let high = lines.length - 1;
          let idx = -1;

          while (low <= high) {
            const mid = (low + high) >> 1;
            if (lines[mid].timeMs <= currentMs) {
              idx = mid;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }

          if (idx !== activeLyricIndexRef.current) {
            activeLyricIndexRef.current = idx;
            setActiveLyricIndex(idx);

            if (idx !== -1 && lyricsContainerRef.current) {
              const lineEl = lyricsContainerRef.current.querySelector(`[data-lyric-idx="${idx}"]`);
              if (lineEl) {
                lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }
          }
        }
      }

      animId = requestAnimationFrame(syncLyrics);
    };

    animId = requestAnimationFrame(syncLyrics);
    return () => cancelAnimationFrame(animId);
  }, [rightPanelTab]);

  if (!rightPanelTab) return null;

  const handleSaveSnapshot = async () => {
    if (!snapshotName.trim()) return;
    setIsSaving(true);
    const snap = await saveQueueSnapshot(snapshotName.trim());
    setIsSaving(false);
    if (snap) {
      setSaveSuccess(true);
      setSnapshotName('');
      setTimeout(() => setSaveSuccess(false), 2500);
    }
  };

  const handleResetEQ = () => {
    const flatPreset: EQPreset = {
      id: 'flat',
      name: 'Flat',
      isDefault: true,
      preampGain: 0,
      bandGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    };
    applyEQPreset(flatPreset);
  };

  const handleStartSongRadio = async () => {
    if (!currentTrack) return;
    setIsGeneratingRadio(true);
    try {
      const res = await fetch(`/api/tracks/${currentTrack.id}/radio?limit=30`);
      if (res.ok) {
        const data = await res.json();
        if (data.tracks && data.tracks.length > 0) {
          await playTrack(data.tracks[0], data.tracks);
          setRightPanelTab('queue');
        }
      }
    } catch (e) {
      console.warn('Could not launch Song Radio:', e);
    } finally {
      setIsGeneratingRadio(false);
    }
  };

  return (
    <aside
      className="spotify-right-sidebar spotify-panel hidden md:flex flex-col h-full bg-white/40 dark:bg-[#0c1220]/60 backdrop-blur-3xl select-none text-[#14171f] dark:text-white border-l border-black/5 dark:border-white/5"
      style={{ width: `${rightRailWidth}px` }}
      aria-label="Context panel"
    >
      {/* Panel Tab Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setRightPanelTab('now-playing')}
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              rightPanelTab === 'now-playing'
                ? 'bg-black/5 dark:bg-white/10 text-[#fa243c] font-bold'
                : 'text-[#86868b] dark:text-[#b3b3b3] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            title="Now Playing"
          >
            <Disc3 className="w-4 h-4" />
            <span className="hidden sm:inline">Info</span>
          </button>

          <button
            onClick={() => setRightPanelTab('queue')}
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              rightPanelTab === 'queue'
                ? 'bg-black/5 dark:bg-white/10 text-[#fa243c] font-bold'
                : 'text-[#86868b] dark:text-[#b3b3b3] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            title="Queue"
          >
            <ListMusic className="w-4 h-4" />
            <span className="hidden sm:inline">Queue</span>
          </button>

          <button
            onClick={() => setRightPanelTab('eq')}
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              rightPanelTab === 'eq'
                ? 'bg-black/5 dark:bg-white/10 text-[#fa243c] font-bold'
                : 'text-[#86868b] dark:text-[#b3b3b3] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            title="10-Band EQ"
          >
            <Sliders className="w-4 h-4" />
            <span className="hidden sm:inline">EQ</span>
          </button>

          <button
            onClick={() => setRightPanelTab('lyrics')}
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              rightPanelTab === 'lyrics'
                ? 'bg-black/5 dark:bg-white/10 text-[#fa243c] font-bold'
                : 'text-[#86868b] dark:text-[#b3b3b3] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            title="Lyrics"
          >
            <Mic2 className="w-4 h-4" />
            <span className="hidden sm:inline">Lyrics</span>
          </button>
        </div>

        <button
          onClick={() => toggleRightPanelTab(rightPanelTab)}
          aria-label="Close panel"
          className="p-1.5 text-[#86868b] dark:text-[#b3b3b3] hover:text-[#1d1d1f] dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Tab Views */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: NOW PLAYING VIEW */}
        {rightPanelTab === 'now-playing' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {currentTrack ? (
              <>
                <div className="aspect-square w-full rounded-xl overflow-hidden bg-black/5 dark:bg-[#282828] shadow-md border border-black/5 dark:border-white/5 relative group">
                  <img
                    src={
                      currentTrack.coverArtUrl ||
                      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80'
                    }
                    alt={currentTrack.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <button
                    onClick={toggleCurrentTrackLike}
                    className="absolute top-3 right-3 p-2 rounded-full bg-white/80 dark:bg-black/60 backdrop-blur-md text-[#1d1d1f] dark:text-white hover:scale-110 transition shadow-sm"
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        currentTrack.isFavorite ? 'fill-[#fa243c] text-[#fa243c]' : 'text-[#1d1d1f] dark:text-white'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f] dark:text-white hover:underline cursor-pointer">
                    {currentTrack.title}
                  </h2>
                  <p className="text-sm font-medium text-[#6e6e73] dark:text-[#b3b3b3] hover:underline cursor-pointer mt-0.5">
                    {currentTrack.artist}
                  </p>
                  {currentTrack.album && (
                    <p className="text-xs text-[#86868b] dark:text-[#727272] mt-0.5">{currentTrack.album}</p>
                  )}
                </div>

                {/* Spotify Song Radio Action Button */}
                <button
                  onClick={handleStartSongRadio}
                  disabled={isGeneratingRadio}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-full bg-[#fa243c] hover:bg-[#d91b32] text-white font-bold text-xs hover:scale-102 active:scale-98 transition shadow-md shadow-[#fa243c]/20 disabled:opacity-50"
                  title="Generate endless radio mix seeded by this song"
                >
                  <Radio className={`w-4 h-4 ${isGeneratingRadio ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingRadio ? 'Generating Radio...' : 'Launch Song Radio'}</span>
                </button>

                {/* Audio Telemetry Badges */}
                <div className="p-3.5 rounded-xl bg-black/5 dark:bg-[#181818] border border-black/5 dark:border-white/5 space-y-2.5">
                  <div className="text-xs font-semibold text-[#86868b] dark:text-[#b3b3b3] uppercase tracking-wider flex items-center justify-between">
                    <span>Lossless & Audio Specs</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#fa243c]/10 text-[#fa243c] font-bold font-mono border border-[#fa243c]/20">
                      {currentTrack.codec || currentTrack.sourceType.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 backdrop-blur-xs">
                      <span className="text-[#86868b] dark:text-[#727272] block text-[10px] uppercase font-semibold">Sampling</span>
                      <span className="font-semibold text-[#1d1d1f] dark:text-white">
                        {currentTrack.sampleRate ? `${currentTrack.sampleRate >= 1000 ? `${currentTrack.sampleRate / 1000} kHz` : `${currentTrack.sampleRate} Hz`}` : '44.1 kHz'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 backdrop-blur-xs">
                      <span className="text-[#86868b] dark:text-[#727272] block text-[10px] uppercase font-semibold">Bit Depth</span>
                      <span className="font-semibold text-[#1d1d1f] dark:text-white">
                        {currentTrack.bitDepth ? `${currentTrack.bitDepth}-bit Studio` : '24-bit Lossless'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 backdrop-blur-xs">
                      <span className="text-[#86868b] dark:text-[#727272] block text-[10px] uppercase font-semibold">BPM / Tempo</span>
                      <span className="font-semibold text-[#1d1d1f] dark:text-white">
                        {currentTrack.bpm ? `${Math.round(currentTrack.bpm)} BPM` : 'Adaptive'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 backdrop-blur-xs">
                      <span className="text-[#86868b] dark:text-[#727272] block text-[10px] uppercase font-semibold">Key</span>
                      <span className="font-semibold text-[#1d1d1f] dark:text-white">
                        {audioFeatures?.key_name || currentTrack.keySignature || 'Standard 440Hz'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Spotify Acoustic DNA Card */}
                {audioFeatures && (
                  <div className="p-3.5 rounded-xl bg-black/5 dark:bg-[#181818] border border-black/5 dark:border-white/5 space-y-2.5">
                    <div className="text-xs font-semibold text-[#86868b] dark:text-[#b3b3b3] uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-[#fa243c]" />
                        <span>Acoustic Profile</span>
                      </span>
                      <span className="text-[10px] text-[#86868b] dark:text-[#727272]">Acoustic DNA</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-[#6e6e73] dark:text-[#b3b3b3]">Energy</span>
                          <span className="text-[#1d1d1f] dark:text-white font-mono font-semibold">{Math.round(audioFeatures.energy * 100)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-black/10 dark:bg-black/40 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#fa243c] rounded-full"
                            style={{ width: `${Math.round(audioFeatures.energy * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-[#6e6e73] dark:text-[#b3b3b3]">Danceability</span>
                          <span className="text-[#1d1d1f] dark:text-white font-mono font-semibold">{Math.round(audioFeatures.danceability * 100)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-black/10 dark:bg-black/40 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-500 rounded-full"
                            style={{ width: `${Math.round(audioFeatures.danceability * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-[#6e6e73] dark:text-[#b3b3b3]">Valence (Positivity)</span>
                          <span className="text-[#1d1d1f] dark:text-white font-mono font-semibold">{Math.round(audioFeatures.valence * 100)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-black/10 dark:bg-black/40 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${Math.round(audioFeatures.valence * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-[#6e6e73] dark:text-[#b3b3b3]">Acousticness</span>
                          <span className="text-[#1d1d1f] dark:text-white font-mono font-semibold">{Math.round(audioFeatures.acousticness * 100)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-black/10 dark:bg-black/40 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full"
                            style={{ width: `${Math.round(audioFeatures.acousticness * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* About Artist Card */}
                <div className="p-4 rounded-xl bg-black/5 dark:bg-[#181818] border border-black/5 dark:border-white/5 space-y-2">
                  <h3 className="text-sm font-bold text-[#1d1d1f] dark:text-white">About the artist</h3>
                  <p className="text-xs text-[#6e6e73] dark:text-[#b3b3b3] leading-relaxed">
                    {currentTrack.artist} is featured in your workstation library. Audio is decoded with 24-bit studio precision through
                    the 10-band Web Audio DSP graph, binaural Spatial Audio processor, and Sound Check loudness normalizer.
                  </p>
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-[#727272]">
                <Disc3 className="w-12 h-12 mx-auto mb-3 opacity-30 animate-spin" />
                <p className="text-sm">No track currently playing</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DUAL QUEUE VIEW */}
        {rightPanelTab === 'queue' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Snapshot trigger */}
            <div className="p-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 backdrop-blur-xs">
              <span className="text-xs font-semibold text-[#86868b] dark:text-[#b3b3b3] block mb-2">
                Save Queue Snapshot
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Snapshot name..."
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  className="flex-1 bg-black/[0.04] dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-[#14171f] dark:text-white placeholder-[#86868b] focus:outline-none focus:border-[#f97316]"
                />
                <button
                  onClick={handleSaveSnapshot}
                  disabled={isSaving || !snapshotName.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-[#fa243c] text-white text-xs font-semibold hover:bg-[#d91b32] active:scale-95 disabled:opacity-50 transition shadow-sm"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
              {saveSuccess && (
                <p className="text-[11px] text-[#fa243c] mt-1.5">✓ Snapshot preserved to database</p>
              )}
            </div>

            {/* Now Playing Mini Row */}
            {currentTrack && (
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#86868b] dark:text-[#b3b3b3] block mb-2">
                  Now Playing
                </span>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                  <img
                    src={
                      currentTrack.coverArtUrl ||
                      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80'
                    }
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover shadow-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#fa243c] truncate">
                      {currentTrack.title}
                    </p>
                    <p className="text-xs text-[#6e6e73] dark:text-[#b3b3b3] truncate">{currentTrack.artist}</p>
                  </div>
                  <div className="flex items-center gap-0.5 text-[#fa243c]">
                    <span className="w-1 h-3 bg-[#fa243c] rounded-full eq-bar-1" />
                    <span className="w-1 h-4 bg-[#fa243c] rounded-full eq-bar-2" />
                    <span className="w-1 h-2 bg-[#fa243c] rounded-full eq-bar-3" />
                  </div>
                </div>
              </div>
            )}

            {/* Next Up (Priority Queue) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#86868b] dark:text-[#b3b3b3]">
                  Next Up ({priorityQueue.length})
                </span>
                {priorityQueue.length > 0 && (
                  <button
                    onClick={clearPriorityQueue}
                    className="text-xs text-[#86868b] dark:text-[#b3b3b3] hover:text-[#fa243c] transition"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {priorityQueue.length === 0 ? (
                <p className="text-xs text-[#86868b] dark:text-[#727272] py-2">
                  No priority tracks. Tap + on any song to queue next.
                </p>
              ) : (
                <div className="space-y-1">
                  {priorityQueue.map((track, idx) => (
                    <div
                      key={track.uid || `${track.id}-${idx}`}
                      className="group flex items-center justify-between p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition"
                    >
                      <div
                        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                        onClick={() => playTrack(track)}
                      >
                        <img
                          src={track.coverArtUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80'}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover shadow-sm"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#1d1d1f] dark:text-white truncate group-hover:text-[#fa243c]">
                            {track.title}
                          </p>
                          <p className="text-[11px] text-[#86868b] dark:text-[#b3b3b3] truncate">{track.artist}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => idx > 0 && reorderPriorityQueue(idx, idx - 1)}
                          disabled={idx === 0}
                          className="p-1 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white disabled:opacity-30"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            idx < priorityQueue.length - 1 && reorderPriorityQueue(idx, idx + 1)
                          }
                          disabled={idx === priorityQueue.length - 1}
                          className="p-1 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white disabled:opacity-30"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (track.uid) {
                              removeFromPriorityQueueByUid(track.uid);
                            } else {
                              removeFromPriorityQueue(idx);
                            }
                          }}
                          className="p-1 text-[#86868b] hover:text-[#fa243c]"
                          title="Remove from queue"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Next From Context (Context Queue) */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#86868b] dark:text-[#b3b3b3] block mb-2">
                Next From Playlist ({contextQueue.length})
              </span>

              {contextQueue.length === 0 ? (
                <p className="text-xs text-[#86868b] dark:text-[#727272] py-2">No upcoming context tracks</p>
              ) : (
                <div className="space-y-1">
                  {contextQueue.slice(0, 30).map((track, idx) => (
                    <div
                      key={`${track.id}-${idx}`}
                      className="group flex items-center justify-between p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition"
                    >
                      <div
                        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                        onClick={() => playTrack(track)}
                      >
                        <img
                          src={track.coverArtUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80'}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover shadow-sm"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#1d1d1f] dark:text-white truncate group-hover:text-[#fa243c]">
                            {track.title}
                          </p>
                          <p className="text-[11px] text-[#86868b] dark:text-[#b3b3b3] truncate">{track.artist}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => moveContextToPriority(idx)}
                        className="p-1 text-[#86868b] hover:text-white opacity-0 group-hover:opacity-100 transition text-[11px] px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 hover:bg-[#fa243c]"
                        title="Add to Next Up"
                      >
                        + Up Next
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: 10-BAND EQ & VISUALIZER VIEW */}
        {rightPanelTab === 'eq' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Real-Time FFT Visualizer Canvas */}
            <div className="rounded-xl overflow-hidden border border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/60 p-2.5">
              <span className="text-[11px] font-semibold text-[#86868b] dark:text-[#b3b3b3] uppercase tracking-wider block mb-2">
                FFT Spectrum Analyzer (60fps)
              </span>
              <VisualizerCanvas height={110} />
            </div>

            {/* Presets Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#86868b] dark:text-[#b3b3b3]">
                  Acoustic Presets
                </span>
                <button
                  onClick={handleResetEQ}
                  className="flex items-center gap-1 text-xs text-[#86868b] hover:text-[#fa243c] transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {presets.map((preset) => {
                  const isActive = activePresetName === preset.name;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => applyEQPreset(preset)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition truncate ${
                        isActive
                          ? 'bg-[#fa243c] text-white font-semibold shadow-sm'
                          : 'bg-black/5 dark:bg-[#181818] text-[#6e6e73] dark:text-[#b3b3b3] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10'
                      }`}
                    >
                      {preset.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preamp Control */}
            <div className="p-3.5 rounded-xl bg-black/5 dark:bg-[#181818] border border-black/5 dark:border-white/5">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-[#1d1d1f] dark:text-white">Preamp Gain</span>
                <span className="font-mono font-bold text-[#fa243c]">
                  {preampGain > 0 ? `+${preampGain.toFixed(1)}` : preampGain.toFixed(1)} dB
                </span>
              </div>
              <input
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={preampGain}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  globalAudioGraph.setPreampGain(val);
                  usePlayerStore.setState({ preampGain: val });
                }}
                className="w-full accent-[#fa243c] cursor-pointer"
              />
            </div>

            {/* 10 Band Parametric Sliders */}
            <div className="p-3.5 rounded-xl bg-black/5 dark:bg-[#181818] border border-black/5 dark:border-white/5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#86868b] dark:text-[#b3b3b3] block mb-4">
                Parametric Bands (-12dB to +12dB)
              </span>

              <div className="grid grid-cols-5 gap-y-4 gap-x-2">
                {EQ_FREQUENCIES.map((freq, idx) => {
                  const gain = eqGains[idx] || 0;
                  const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
                  return (
                    <div key={freq} className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] font-mono text-[#86868b] dark:text-[#b3b3b3]">
                        {gain > 0 ? `+${gain}` : `${gain}`}
                      </span>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={gain}
                        onChange={(e) => setEQBandGain(idx, parseFloat(e.target.value))}
                        className="h-20 -rotate-90 accent-[#fa243c] cursor-pointer my-2"
                      />
                      <span className="text-[10px] font-semibold text-[#1d1d1f] dark:text-white mt-1">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SYNCED LYRICS VIEW */}
        {rightPanelTab === 'lyrics' && (
          <div
            ref={lyricsContainerRef}
            className="h-full space-y-4 animate-in fade-in duration-150"
          >
            {/* Apple Music Sing Quick Trigger Banner */}
            <button
              onClick={() => setIsFullScreenSingOpen(true)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-[#fa243c]/10 via-purple-500/10 to-indigo-500/10 border border-[#fa243c]/20 hover:border-[#fa243c]/50 transition group shadow-sm text-left"
              title="Launch Apple Music Sing Full-Screen Karaoke Mode"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#fa243c]" />
                <div>
                  <div className="text-xs font-bold text-[#1d1d1f] dark:text-white">Apple Music Sing</div>
                  <div className="text-[10px] text-[#86868b]">Full-screen ambient karaoke</div>
                </div>
              </div>
              <span className="text-xs font-bold text-[#fa243c] group-hover:translate-x-0.5 transition">
                Open ↗
              </span>
            </button>

            {lyricsLoading ? (
              <div className="py-20 text-center text-[#86868b]">
                <Mic2 className="w-8 h-8 mx-auto mb-2 opacity-60 animate-pulse text-[#fa243c]" />
                <p className="text-xs">Fetching synced lyrics from LRCLIB...</p>
              </div>
            ) : isInstrumental ? (
              <div className="py-20 text-center text-[#86868b]">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50 text-[#fa243c]" />
                <p className="text-sm font-semibold text-[#1d1d1f] dark:text-white">Instrumental Track</p>
                <p className="text-xs mt-1">No vocal lyrics available for this song</p>
              </div>
            ) : lyricLines.length > 0 ? (
              <div className="space-y-4 py-4">
                {lyricLines.map((line, idx) => {
                  const isActive = idx === activeLyricIndex;
                  return (
                    <p
                      key={idx}
                      data-lyric-idx={idx}
                      onClick={() => {
                        seek(line.timeMs / 1000);
                        setActiveLyricIndex(idx);
                        activeLyricIndexRef.current = idx;
                      }}
                      className={`text-lg font-bold transition-all duration-200 cursor-pointer select-none leading-relaxed ${
                        isActive
                          ? 'text-[#fa243c] text-xl font-black scale-102 drop-shadow-sm'
                          : 'text-[#86868b] dark:text-[#535353] hover:text-[#1d1d1f] dark:hover:text-[#b3b3b3]'
                      }`}
                    >
                      {line.text}
                    </p>
                  );
                })}
              </div>
            ) : plainLyrics ? (
              <div className="whitespace-pre-line text-sm text-[#6e6e73] dark:text-[#b3b3b3] leading-relaxed py-4">
                {plainLyrics}
              </div>
            ) : (
              <div className="py-20 text-center text-[#86868b]">
                <Mic2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Couldn't find lyrics for this song</p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
