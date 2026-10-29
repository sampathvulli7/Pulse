import { Track, Playlist } from '../types/audio';
import {
  getLocalPlaylists,
  saveLocalPlaylist,
  deleteLocalPlaylist,
  getLocalFavorites,
  toggleLocalFavorite,
  enqueueSyncOperation,
  saveLocalTracksBulk,
} from './localDatabase';

let lastHealthCheckTime = 0;
let cachedBackendStatus: boolean | null = null;

/**
 * Checks if the Pulse backend server is reachable.
 * Caches status for 6 seconds to eliminate redundant network overhead.
 */
export async function isBackendOnline(): Promise<boolean> {
  const now = Date.now();
  if (cachedBackendStatus !== null && now - lastHealthCheckTime < 6000) {
    return cachedBackendStatus;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('/api/health', { signal: controller.signal });
    clearTimeout(timeout);

    cachedBackendStatus = res.ok;
  } catch (e) {
    cachedBackendStatus = false;
  }

  lastHealthCheckTime = now;
  return cachedBackendStatus;
}

export async function fetchPlaylists(): Promise<Playlist[]> {
  const online = await isBackendOnline();

  if (online) {
    try {
      const res = await fetch('/api/playlists');
      if (res.ok) {
        const serverPlaylists: Playlist[] = await res.json();
        // Background cache into local IndexedDB
        for (const pl of serverPlaylists) {
          saveLocalPlaylist(pl).catch(() => {});
        }
        return serverPlaylists;
      }
    } catch (e) {
      console.warn('[DataProvider] Backend fetch failed, falling back to phone storage:', e);
    }
  }

  // Standalone / Offline Phone Fallback
  return getLocalPlaylists();
}

export async function fetchPlaylistDetails(id: string): Promise<Playlist | null> {
  const online = await isBackendOnline();

  if (online) {
    try {
      const res = await fetch(`/api/playlists/${id}`);
      if (res.ok) {
        const pl: Playlist = await res.json();
        saveLocalPlaylist(pl).catch(() => {});
        return pl;
      }
    } catch (e) {
      console.warn('[DataProvider] Could not load playlist from server:', e);
    }
  }

  // Load from local IndexedDB
  const localList = await getLocalPlaylists();
  return localList.find((p) => p.id === id) || null;
}

export async function createPlaylist(name: string, description?: string): Promise<Playlist> {
  const id = `pl-user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newPl: Playlist = {
    id,
    name,
    description: description || 'Personal Playlist',
    isSmart: false,
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
    isFavorite: false,
    trackCount: 0,
    tracks: [],
  };

  await saveLocalPlaylist(newPl);

  const online = await isBackendOnline();
  if (online) {
    try {
      await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPl),
      });
    } catch (e) {
      await enqueueSyncOperation('ADD_PLAYLIST', newPl);
    }
  } else {
    await enqueueSyncOperation('ADD_PLAYLIST', newPl);
  }

  return newPl;
}

export async function deletePlaylistById(id: string): Promise<void> {
  await deleteLocalPlaylist(id);

  const online = await isBackendOnline();
  if (online) {
    try {
      await fetch(`/api/playlists/${id}`, { method: 'DELETE' });
    } catch (e) {
      await enqueueSyncOperation('DELETE_PLAYLIST', { id });
    }
  } else {
    await enqueueSyncOperation('DELETE_PLAYLIST', { id });
  }
}

export async function addTrackToPlaylistById(playlistId: string, track: Track): Promise<void> {
  const pl = await fetchPlaylistDetails(playlistId);
  if (pl) {
    const existing = pl.tracks || [];
    if (!existing.some((t) => t.id === track.id)) {
      const updatedTracks = [...existing, track];
      await saveLocalPlaylist({
        ...pl,
        tracks: updatedTracks,
        trackCount: updatedTracks.length,
      });
    }
  }

  const online = await isBackendOnline();
  if (online) {
    try {
      await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id, track }),
      });
    } catch (e) {
      await enqueueSyncOperation('UPDATE_PLAYLIST', { playlistId, action: 'add', track });
    }
  } else {
    await enqueueSyncOperation('UPDATE_PLAYLIST', { playlistId, action: 'add', track });
  }
}

export async function removeTrackFromPlaylistById(playlistId: string, trackId: string): Promise<void> {
  const pl = await fetchPlaylistDetails(playlistId);
  if (pl) {
    const updatedTracks = (pl.tracks || []).filter((t) => t.id !== trackId);
    await saveLocalPlaylist({
      ...pl,
      tracks: updatedTracks,
      trackCount: updatedTracks.length,
    });
  }

  const online = await isBackendOnline();
  if (online) {
    try {
      await fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, { method: 'DELETE' });
    } catch (e) {
      await enqueueSyncOperation('UPDATE_PLAYLIST', { playlistId, action: 'remove', trackId });
    }
  } else {
    await enqueueSyncOperation('UPDATE_PLAYLIST', { playlistId, action: 'remove', trackId });
  }
}

export async function toggleTrackFavorite(trackId: string, track?: Track): Promise<boolean> {
  const isFav = await toggleLocalFavorite(trackId, track);

  const online = await isBackendOnline();
  if (online) {
    try {
      await fetch(`/api/tracks/${trackId}/toggle-like`, { method: 'POST' });
    } catch (e) {
      await enqueueSyncOperation('TOGGLE_LIKE', { trackId, isFavorite: isFav });
    }
  } else {
    await enqueueSyncOperation('TOGGLE_LIKE', { trackId, isFavorite: isFav });
  }

  return isFav;
}

export async function fetchFavoritesSet(): Promise<Set<string>> {
  return getLocalFavorites();
}

