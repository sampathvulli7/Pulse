import React, { useState, useEffect } from 'react';
import {
  X,
  ListMusic,
  ArrowRight,
  Loader2,
  Check,
  Link as LinkIcon,
  Key,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ClipboardList,
  Sparkles,
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'url' | 'paste'>('url');
  const [urlOrId, setUrlOrId] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [customPlaylistName, setCustomPlaylistName] = useState('');

  // Spotify App Credentials (persisted in localStorage)
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showCredentials, setShowCredentials] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const savedId = localStorage.getItem('pulse_spotify_client_id') || '';
    const savedSecret = localStorage.getItem('pulse_spotify_client_secret') || '';
    if (savedId) setClientId(savedId);
    if (savedSecret) setClientSecret(savedSecret);
  }, []);

  if (!isOpen) return null;

  const saveCredentials = (newId: string, newSecret: string) => {
    setClientId(newId);
    setClientSecret(newSecret);
    localStorage.setItem('pulse_spotify_client_id', newId.trim());
    localStorage.setItem('pulse_spotify_client_secret', newSecret.trim());
  };

  const handleImportUrl = async (target?: string) => {
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
        body: JSON.stringify({
          url: clean,
          clientId: clientId.trim() || undefined,
          clientSecret: clientSecret.trim() || undefined,
        }),
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

  const handleBulkImport = async () => {
    const text = bulkText.trim();
    if (!text) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/spotify/import-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawTracklist: text,
          playlistName: customPlaylistName.trim() || undefined,
          clientId: clientId.trim() || undefined,
          clientSecret: clientSecret.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to import tracks');
      }

      setSuccess(`Imported "${data.name}" (${data.tracksImported} tracks)!`);
      setTimeout(() => {
        onPlaylistImported(data.playlistId);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Could not process tracklist.');
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

  const estimatedLineCount = bulkText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0).length;

  const hasCredentialsConfigured = Boolean(clientId.trim() && clientSecret.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ListMusic className="w-5 h-5 text-indigo-500" />
              Import Spotify Playlist
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Import entire playlists without limits into your personal workstation
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

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-5 pt-3 gap-2 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'url'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            Playlist Link
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'paste'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Paste All Tracks (Cmd+A)
            <span className="px-1.5 py-0.2 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full font-bold">
              Unlimited
            </span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {activeTab === 'url' ? (
            <>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                  Spotify Playlist URL or ID
                </label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
                    value={urlOrId}
                    onChange={(e) => setUrlOrId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleImportUrl()}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition"
                  />
                </div>
              </div>

              {/* Informational Callout explaining why 100 tracks and how to unlock all */}
              <div className="rounded-xl border border-indigo-200/70 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>How to import playlists with {'>'}100 tracks</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCredentials(!showCredentials)}
                    className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <span>{hasCredentialsConfigured ? '✓ Keys Configured' : 'Connect API Keys'}</span>
                    {showCredentials ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Spotify's anonymous preview caps public playlists at 100 tracks. To automatically import 200–5,000+ tracks, connect free Spotify API keys or use the{' '}
                  <strong className="text-indigo-600 dark:text-indigo-400 cursor-pointer" onClick={() => setActiveTab('paste')}>
                    Paste All Tracks
                  </strong>{' '}
                  tab!
                </p>

                {/* Expandable Credentials Box */}
                {showCredentials && (
                  <div className="pt-2 border-t border-indigo-200/50 dark:border-indigo-900/50 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Spotify Developer Keys (Saved locally in browser)
                      </span>
                      <a
                        href="https://developer.spotify.com/dashboard"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                      >
                        Get free keys <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                          Client ID
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 4a8b7..."
                          value={clientId}
                          onChange={(e) => saveCredentials(e.target.value, clientSecret)}
                          className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                          Client Secret
                        </label>
                        <input
                          type="password"
                          placeholder="e.g. 9c12e..."
                          value={clientSecret}
                          onChange={(e) => saveCredentials(clientId, e.target.value)}
                          className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      💡 Tip: You can also set <code className="bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">SPOTIFY_CLIENT_ID</code> and{' '}
                      <code className="bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">SPOTIFY_CLIENT_SECRET</code> in Render Environment variables to enable full imports permanently for everyone.
                    </p>
                  </div>
                )}
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
                        handleImportUrl(sp.url);
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
            </>
          ) : (
            /* Bulk Paste Tab */
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <span className="font-semibold text-slate-900 dark:text-white block">
                  📋 Instant Bulk Import (Zero Keys Required)
                </span>
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  1. Open Spotify desktop or web player and go to your playlist.<br />
                  2. Press <kbd className="px-1 py-0.5 bg-black/10 dark:bg-white/10 rounded font-mono">Cmd+A</kbd> (or{' '}
                  <kbd className="px-1 py-0.5 bg-black/10 dark:bg-white/10 rounded font-mono">Ctrl+A</kbd>) to select all songs.<br />
                  3. Press <kbd className="px-1 py-0.5 bg-black/10 dark:bg-white/10 rounded font-mono">Cmd+C</kbd> to copy, and paste below!
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Playlist Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="My Mega Playlist"
                  value={customPlaylistName}
                  onChange={(e) => setCustomPlaylistName(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Paste Track Links or Titles (One per line)
                  </label>
                  {estimatedLineCount > 0 && (
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                      {estimatedLineCount} track{estimatedLineCount === 1 ? '' : 's'} detected
                    </span>
                  )}
                </div>
                <textarea
                  rows={8}
                  placeholder={`https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT\nhttps://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6\n...or paste "Artist - Song Title" lines`}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>
            </div>
          )}

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
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center p-5 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="text-[11px] text-slate-400">
            {hasCredentialsConfigured ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Full API active
              </span>
            ) : (
              <span>Standard 100-track preview mode</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl transition"
            >
              Cancel
            </button>
            {activeTab === 'url' ? (
              <button
                type="button"
                onClick={() => handleImportUrl()}
                disabled={loading || !urlOrId.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm disabled:opacity-40 flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Importing playlist...
                  </>
                ) : (
                  <>
                    <span>Import Playlist</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleBulkImport()}
                disabled={loading || !bulkText.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm disabled:opacity-40 flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Importing tracks...
                  </>
                ) : (
                  <>
                    <span>Import All {estimatedLineCount > 0 ? `(${estimatedLineCount})` : ''} Tracks</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
