import React, { useState } from 'react';
import { X, ListMusic, ArrowUp, ArrowDown, Trash2, Camera, Plus, Play } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({ isOpen, onClose }) => {
  const {
    priorityQueue,
    contextQueue,
    currentTrack,
    reorderPriorityQueue,
    removeFromPriorityQueue,
    moveContextToPriority,
    clearPriorityQueue,
    playTrack,
    saveQueueSnapshot,
  } = usePlayerStore();

  const [snapshotName, setSnapshotName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[460px] z-[60] bg-white dark:bg-slate-950 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200">
            <ListMusic className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Playback Queue</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {priorityQueue.length + contextQueue.length} upcoming tracks
            </p>
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

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Section 1: Now Playing */}
        {currentTrack && (
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2">
              Now Playing
            </span>
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <img
                src={currentTrack.coverArtUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80'}
                alt=""
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80';
                }}
                className="w-12 h-12 rounded-xl object-cover shadow-xs border border-slate-200/80 dark:border-slate-700/80"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {currentTrack.title}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {currentTrack.artist}
                </div>
              </div>
              <span className="text-[11px] font-mono font-medium px-2.5 py-1 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs">
                Playing
              </span>
            </div>
          </div>
        )}

        {/* Section 2: Priority "Up Next" Queue */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Priority "Up Next" ({priorityQueue.length})
            </span>
            {priorityQueue.length > 0 && (
              <button
                onClick={clearPriorityQueue}
                className="text-xs text-slate-400 hover:text-rose-600 transition font-medium"
              >
                Clear
              </button>
            )}
          </div>

          {priorityQueue.length === 0 ? (
            <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
              No manual additions in queue.
              <br />
              Click "Next" on any track to prioritize it.
            </div>
          ) : (
            <div className="space-y-1.5">
              {priorityQueue.map((track, idx) => (
                <div
                  key={`${track.id}-${idx}`}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 group transition"
                >
                  <span className="text-xs font-mono text-slate-400 w-5 text-center font-medium">
                    {idx + 1}
                  </span>
                  <img
                    src={track.coverArtUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80'}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80';
                    }}
                    className="w-9 h-9 rounded-lg object-cover shadow-xs border border-slate-200/60 dark:border-slate-700/60"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {track.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {track.artist}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {idx > 0 && (
                      <button
                        onClick={() => reorderPriorityQueue(idx, idx - 1)}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {idx < priorityQueue.length - 1 && (
                      <button
                        onClick={() => reorderPriorityQueue(idx, idx + 1)}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => removeFromPriorityQueue(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Context Queue */}
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2">
            Playing From Playlist ({contextQueue.length})
          </span>

          {contextQueue.length === 0 ? (
            <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
              No upcoming tracks in context playlist.
            </div>
          ) : (
            <div className="space-y-1">
              {contextQueue.map((track, idx) => (
                <div
                  key={`${track.id}-${idx}`}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/60 transition group border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                    <span className="text-xs font-mono text-slate-400 w-5 text-center">
                      {idx + 1}
                    </span>
                    <img
                      src={track.coverArtUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=80&q=80'}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=80&q=80';
                      }}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-900 dark:text-slate-200 truncate">
                        {track.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {track.artist}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => moveContextToPriority(idx)}
                      className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded"
                      title="Move to Priority Queue"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => playTrack(track)}
                      className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded"
                      title="Play Now"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 4: Queue Snapshot */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-xs space-y-2.5">
          <div className="flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-900 dark:text-white">
              Save Queue as Snapshot
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Focus Mix 2"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              className="flex-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
            <button
              onClick={handleSaveSnapshot}
              disabled={isSaving || !snapshotName.trim()}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 disabled:opacity-40 transition shadow-xs"
            >
              {saveSuccess ? 'Saved!' : isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
