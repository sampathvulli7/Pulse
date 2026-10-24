import React, { useEffect, useState, useRef } from 'react';
import { X, Mic2, Music } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';

interface LyricsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedLine {
  timeMs: number;
  text: string;
}

export const LyricsPanel: React.FC<LyricsPanelProps> = ({ isOpen, onClose }) => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const seek = usePlayerStore((s) => s.seek);

  const [lines, setLines] = useState<ParsedLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string>('');
  const [isInstrumental, setIsInstrumental] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const activeIndexRef = useRef<number>(-1);
  const linesRef = useRef<ParsedLine[]>([]);
  linesRef.current = lines;
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Fetch lyrics whenever currentTrack changes
  useEffect(() => {
    if (!currentTrack) {
      setLines([]);
      setPlainLyrics('');
      setActiveIndex(-1);
      activeIndexRef.current = -1;
      return;
    }

    setLoading(true);
    setActiveIndex(-1);
    activeIndexRef.current = -1;

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

        if (data.syncedLyrics) {
          // Parse LRC timestamp format: [mm:ss.xx] Lyric text
          const rawLines = data.syncedLyrics.split('\n');
          const parsed: ParsedLine[] = [];

          for (const line of rawLines) {
            const match = line.match(/\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/);
            if (match) {
              const min = parseInt(match[1], 10);
              const sec = parseInt(match[2], 10);
              const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
              const timeMs = min * 60000 + sec * 1000 + ms;
              const text = match[4].trim();
              if (text) {
                parsed.push({ timeMs, text });
              }
            }
          }
          setLines(parsed);
        } else {
          setLines([]);
        }
      })
      .catch((err) => {
        console.warn('Could not load lyrics:', err);
        setLines([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [currentTrack?.id]);

  // High-precision, zero-lag sync engine (sub-frame accurate hardware audio read)
  useEffect(() => {
    if (!isOpen) return;

    let animId: number;
    let lastTime = 0;

    const tick = (now: number) => {
      // Throttle RAF check to ~25ms (~40fps) to conserve mobile battery while ensuring millisecond-exact sync
      if (now - lastTime >= 25) {
        lastTime = now;
        const currentLines = linesRef.current;
        if (currentLines.length > 0) {
          const controller = usePlayerStore.getState().controller;
          const currentSec = controller ? controller.getCurrentTime() : usePlayerStore.getState().currentTime;
          // Compensate with 150ms lead time so highlighting matches acoustic vocal attack
          const currentMs = currentSec * 1000 + 150;

          // Fast O(log N) binary search
          let low = 0;
          let high = currentLines.length - 1;
          let foundIdx = -1;

          while (low <= high) {
            const mid = (low + high) >> 1;
            if (currentLines[mid].timeMs <= currentMs) {
              foundIdx = mid;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }

          if (foundIdx !== activeIndexRef.current) {
            activeIndexRef.current = foundIdx;
            setActiveIndex(foundIdx);

            if (foundIdx >= 0 && containerRef.current) {
              const el = document.getElementById(`lyric-line-${foundIdx}`);
              if (el) {
                const container = containerRef.current;
                const targetScroll = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
                container.scrollTo({
                  top: Math.max(0, targetScroll),
                  behavior: 'smooth',
                });
              }
            }
          }
        }
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[460px] z-[60] bg-white dark:bg-slate-950 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200">
            <Mic2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Live Lyrics</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Synced Real-Time LRC</p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Track Info Card */}
      {currentTrack && (
        <div className="px-5 py-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40 flex items-center gap-3 shrink-0">
          <img
            src={currentTrack.coverArtUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80'}
            alt=""
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80';
            }}
            className="w-10 h-10 rounded-lg object-cover shadow-xs border border-slate-200 dark:border-slate-700"
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {currentTrack.title}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {currentTrack.artist}
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium shrink-0">
            Tap line to seek
          </span>
        </div>
      )}

      {/* Lyrics content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-6 py-8 text-center scrollbar-none overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
            <Music className="w-8 h-8 animate-bounce text-slate-400" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Loading synchronized lyrics...</span>
          </div>
        ) : isInstrumental || lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <Music className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {currentTrack ? currentTrack.title : 'No track playing'}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 max-w-xs whitespace-pre-line leading-relaxed">
              {plainLyrics || 'Instrumental or live audio track. Enjoy the music.'}
            </div>
          </div>
        ) : (
          <div className="py-16 space-y-6">
            {lines.map((line, idx) => {
              const isActive = idx === activeIndex;
              return (
                <p
                  key={`${line.timeMs}-${idx}`}
                  id={`lyric-line-${idx}`}
                  onClick={() => seek(line.timeMs / 1000)}
                  className={`cursor-pointer transition-all duration-200 leading-relaxed select-none px-4 py-2 rounded-xl active:scale-95 ${
                    isActive
                      ? 'text-xl font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800/80 scale-[1.02] shadow-xs'
                      : 'text-base font-medium text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'
                  }`}
                >
                  {line.text}
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
