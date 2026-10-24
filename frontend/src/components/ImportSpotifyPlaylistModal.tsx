import React, { useState } from 'react';
import { X, ListMusic, ArrowRight, Loader2, Check, Link } from 'lucide-react';

interface ImportSpotifyPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaylistImported: (playlistId: string) => void;
}

export const ImportSpotifyPlaylistModal: React.FC<ImportSpotifyPlaylistModalProps> = ({
  isOpen,
  onClose,
  onPlaylistImported,
}) => {
  const [urlOrId, setUrlOrId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImport = async (target?: string) => {
    const raw = target || urlOrId;
    const clean = raw.trim();
    if (!clean) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/spotify/import-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: clean }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to import playlist');
      }

      setSuccess(`Imported "${data.name}" (${data.tracksImported} tracks)!`);
      setTimeout(() => {
        onPlaylistImported(data.playlistId);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Could not import playlist. Check the URL and ensure the playlist is public.');
    } finally {
      setLoading(false);
    }
  };

  const samplePlaylists = [
    { name: "Today's Top Hits", url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' },
    { name: 'Pop Rising', url: 'https://open.spotify.com/playlist/37i9dQZF1DWUa8ZRTfalHk' },
    { name: 'Rock Classics', url: 'https://open.spotify.com/playlist/37i9dQZF1DWXRqgorJj26U' },
    { name: 'Lofi Beats', url: 'https://open.spotify.com/playlist/37i9dQZF1DXdLEN7aqioXM' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Import Spotify Playlist
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Paste any public Spotify link to import tracks into your library
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
              Playlist URL or ID
            </label>
            <div className="relative">
              <Link className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
                value={urlOrId}
                onChange={(e) => setUrlOrId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-white transition"
              />
            </div>
          </div>

          {/* Quick Suggestions */}
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
              Sample public playlists
            </span>
            <div className="grid grid-cols-2 gap-2">
              {samplePlaylists.map((sp) => (
                <button
                  key={sp.name}
                  onClick={() => {
                    setUrlOrId(sp.url);
                    handleImport(sp.url);
                  }}
                  className="text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group"
                >
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white block truncate">
                    {sp.name}
                  </span>
                  <span className="text-[10px] text-slate-400">Click to import</span>
                </button>
              ))}
            </div>
          </div>

          {/* Status feedback */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleImport()}
              disabled={loading || !urlOrId.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-xl transition shadow-xs disabled:opacity-40 flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Importing tracks...
                </>
              ) : (
                <>
                  <span>Import Playlist</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
