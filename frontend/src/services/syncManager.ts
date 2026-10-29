import {
  getSyncQueue,
  clearSyncQueue,
  saveLocalPlaylist,
  toggleLocalFavorite,
  openLocalDB,
} from './localDatabase';
import { isBackendOnline } from './dataProvider';

let isSyncing = false;
let lastSyncTimestamp = 0;

try {
  const saved = localStorage.getItem('pulse_last_sync_ts');
  if (saved) lastSyncTimestamp = Number(saved) || 0;
} catch (e) {}

/**
 * Triggers an immediate bidirectional state synchronization with the backend.
 * Merges playlists, favorited tracks, and resolves queued offline changes.
 */
export async function syncWithBackend(): Promise<boolean> {
  if (isSyncing) return false;
  const online = await isBackendOnline();
  if (!online) return false;

  isSyncing = true;
  try {
    const queue = await getSyncQueue();

    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        syncQueue: queue,
        lastSyncTimestamp,
      }),
    });

    if (!response.ok) {
      isSyncing = false;
      return false;
    }

    const data = await response.json();

    // 1. Clear processed items from local sync queue
    if (Array.isArray(data.processedSyncIds) && data.processedSyncIds.length > 0) {
      await clearSyncQueue(data.processedSyncIds);
    }

    // 2. Merge server playlists into local IndexedDB
    if (Array.isArray(data.serverPlaylists)) {
      for (const pl of data.serverPlaylists) {
        await saveLocalPlaylist(pl);
      }
    }

    // 3. Merge server favorites
    if (Array.isArray(data.favoriteTrackIds)) {
      const db = await openLocalDB();
      const tx = db.transaction('favorites', 'readwrite');
      const store = tx.objectStore('favorites');
      for (const trkId of data.favoriteTrackIds) {
        store.put({ trackId: trkId, favoritedAt: Date.now() });
      }
    }

    lastSyncTimestamp = data.syncTimestamp || Date.now();
    try {
      localStorage.setItem('pulse_last_sync_ts', lastSyncTimestamp.toString());
    } catch (e) {}

    // Notify active UI components that library has synced
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulse-sync-completed', { detail: { timestamp: lastSyncTimestamp } }));
    }

    return true;
  } catch (err) {
    console.warn('[SyncManager] Sync failed:', err);
    return false;
  } finally {
    isSyncing = false;
  }
}

/**
 * Starts automatic background polling for cross-device sync.
 */
export function startAutoSync(intervalMs = 25000): () => void {
  // Sync immediately on launch
  syncWithBackend().catch(() => {});

  const intervalId = setInterval(() => {
    syncWithBackend().catch(() => {});
  }, intervalMs);

  const handleOnline = () => {
    syncWithBackend().catch(() => {});
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      syncWithBackend().catch(() => {});
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
  }

  return () => {
    clearInterval(intervalId);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    }
  };
}

