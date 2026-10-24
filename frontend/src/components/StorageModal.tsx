import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Trash2,
  X,
  AlertTriangle,
  RefreshCw,
  Folder,
  Copy,
  Check,
  Music2,
  Search,
  Sparkles,
} from 'lucide-react';

interface CachedFile {
  id: string;
  fileName: string;
  title: string;
  artist: string;
  sizeBytes: number;
  sizeMB: string;
  cachedAt: string;
}

interface CacheStats {
  fileCount: number;
  totalBytes: number;
  totalSizeMB: string;
  cacheDir: string;
  files: CachedFile[];
}

interface StorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCacheCleared?: () => void;
}

export const StorageModal: React.FC<StorageModalProps> = ({
  isOpen,
  onClose,
  onCacheCleared,
}) => {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cache/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.warn('Could not load cache stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
      setConfirmClear(false);
      setSearch('');
    }
  }, [isOpen]);

  const handleClearAll = async () => {
    setClearing(true);
    try {
      const res = await fetch('/api/cache/clear', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setToastMessage(`✓ Freed ${data.freedMB} of disk space!`);
        setTimeout(() => setToastMessage(null), 3000);
        setConfirmClear(false);
        await fetchStats();
        if (onCacheCleared) onCacheCleared();
      }
    } catch (e) {
      console.warn('Could not clear cache:', e);
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteTrack = async (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(trackId);
    try {
      const res = await fetch(`/api/cache/tracks/${trackId}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setToastMessage(`✓ Deleted track cache (${data.freedMB})`);
        setTimeout(() => setToastMessage(null), 2500);
        await fetchStats();
      }
    } catch (e) {
      console.warn('Could not delete track cache:', e);
    } finally {
      setDeletingId(null);
    }
  };

  const copyPath = () => {
    if (stats?.cacheDir) {
      navigator.clipboard.writeText(stats.cacheDir);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  const filteredFiles = stats?.files.filter((f) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      f.title.toLowerCase().includes(q) ||
      f.artist.toLowerCase().includes(q) ||
      f.fileName.toLowerCase().includes(q)
    );
  }) || [];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#18181a] border border-black/10 dark:border-white/10 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-[#1d1d1f] dark:text-white">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[#fa243c] text-white text-xs font-bold rounded-full shadow-2xl animate-in fade-in slide-in-from-top duration-200">
            {toastMessage}
          </div>
        )}

        {/* Modal Header */}
        <div className="p-5 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#fa243c]/10 text-[#fa243c] flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Storage & Audio Cache</h2>
              <p className="text-xs text-[#86868b] dark:text-[#a1a1a6]">
                Manage offline audio files and reclaim disk space
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {/* Storage Overview Card */}
          <div className="p-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#86868b]">
                  Current Disk Usage
                </span>
                <div className="text-2xl font-black text-[#1d1d1f] dark:text-white mt-0.5">
                  {stats ? stats.totalSizeMB : 'Calculating...'}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#86868b]">
                  Cached Audio Tracks
                </span>
                <div className="text-xl font-bold text-[#fa243c] mt-0.5">
                  {stats ? `${stats.fileCount} songs` : '...'}
                </div>
              </div>
            </div>

            {/* Disk Directory Path */}
            <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-[#86868b] truncate min-w-0">
                <Folder className="w-4 h-4 shrink-0 text-[#fa243c]" />
                <span className="truncate font-mono text-[11px]">
                  {stats?.cacheDir || 'backend/cache/audio'}
                </span>
              </div>
              <button
                onClick={copyPath}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 transition"
                title="Copy folder path"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Path'}</span>
              </button>
            </div>
          </div>

          {/* Reclaim Action Section */}
          <div className="space-y-2">
            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                disabled={!stats || stats.fileCount === 0 || clearing}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#fa243c] hover:bg-[#d91b32] text-white flex items-center justify-center gap-2 shadow-lg shadow-[#fa243c]/20 transition disabled:opacity-40 disabled:pointer-events-none"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear All Audio Cache ({stats?.totalSizeMB || '0 MB'})</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-xl bg-[#fa243c]/10 border border-[#fa243c]/30 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center gap-2 text-[#fa243c] text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Free up {stats?.totalSizeMB}? Songs will re-stream on-demand.</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearAll}
                    disabled={clearing}
                    className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold bg-[#fa243c] text-white hover:bg-[#d91b32] transition flex items-center justify-center gap-1"
                  >
                    {clearing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm & Free Disk Space</span>
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="py-1.5 px-3 rounded-lg text-xs font-bold bg-black/5 dark:bg-white/10 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
              Clearing audio cache removes the local audio files from your disk. Your playlists, favorites, and track history remain 100% intact—Sampath's Studio will automatically stream full-length songs when you play them.
            </p>
          </div>

          {/* Cached Song Breakdown */}
          {stats && stats.fileCount > 0 && (
            <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">
                  Cached Files ({filteredFiles.length})
                </span>
                <div className="relative w-44">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#86868b]" />
                  <input
                    type="text"
                    placeholder="Filter cached songs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full text-xs pl-7 pr-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:border-[#fa243c]"
                  />
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 border border-black/5 dark:border-white/5 rounded-xl">
                {filteredFiles.map((file) => (
                  <div
                    key={file.fileName}
                    className="p-2.5 flex items-center justify-between gap-3 text-xs hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate text-[#1d1d1f] dark:text-white">
                        {file.title}
                      </div>
                      <div className="text-[11px] text-[#86868b] truncate">
                        {file.artist}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[11px] text-[#86868b] dark:text-[#a1a1a6] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5">
                        {file.sizeMB}
                      </span>
                      <button
                        onClick={(e) => handleDeleteTrack(file.id, e)}
                        disabled={deletingId === file.id}
                        className="p-1 rounded text-[#86868b] hover:text-[#fa243c] hover:bg-black/5 dark:hover:bg-white/10 transition"
                        title="Delete this cached track"
                      >
                        {deletingId === file.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#fa243c]" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 px-5 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs text-[#86868b]">
          <span>Terminal path: <code className="font-mono text-[11px]">backend/cache/audio</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 font-bold hover:bg-black/10 dark:hover:bg-white/15 text-[#1d1d1f] dark:text-white transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
