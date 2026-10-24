import { Track } from '../types/audio';

const DB_NAME = 'sampath_studio_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'offline_tracks';

interface OfflineRecord {
  trackId: string;
  track: Track;
  audioBlob: Blob;
  sizeBytes: number;
  downloadedAt: number;
}

/**
 * Initializes and returns the IndexedDB instance for offline music storage.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      return reject(new Error('IndexedDB is not supported on this browser'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'trackId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Triggers a direct native file download into the phone's or computer's Downloads folder.
 */
export function downloadTrackToDevice(track: Track) {
  const downloadUrl = `/api/download/${track.id}`;
  const cleanTitle = (track.title || 'Track').replace(/[/\\?%*:|"<>]/g, '_');
  const cleanArtist = (track.artist || 'Artist').replace(/[/\\?%*:|"<>]/g, '_');
  const filename = `${cleanArtist} - ${cleanTitle}.m4a`;

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
  }, 1000);
}

/**
 * Downloads and caches the track's audio into phone/browser offline storage (IndexedDB)
 * so it can be played with ZERO network connection (Airplane Mode).
 */
export async function saveTrackOffline(
  track: Track,
  onProgress?: (msg: string) => void
): Promise<boolean> {
  try {
    if (onProgress) onProgress('Fetching studio audio stream...');

    const res = await fetch(`/api/stream/${track.id}`);
    if (!res.ok) {
      throw new Error(`Stream fetch failed with status ${res.status}`);
    }

    if (onProgress) onProgress('Encrypting and caching offline blob...');
    const blob = await res.blob();

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record: OfflineRecord = {
      trackId: track.id,
      track: { ...track, isDownloaded: true },
      audioBlob: blob,
      sizeBytes: blob.size,
      downloadedAt: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Notify all active React components
    window.dispatchEvent(new CustomEvent('offline-tracks-updated', { detail: { trackId: track.id, added: true } }));
    return true;
  } catch (err) {
    console.warn('[OfflineStorage] Could not save track offline:', err);
    return false;
  }
}

/**
 * Deletes a track from offline storage.
 */
export async function removeTrackOffline(trackId: string): Promise<boolean> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const req = store.delete(trackId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    window.dispatchEvent(new CustomEvent('offline-tracks-updated', { detail: { trackId, added: false } }));
    return true;
  } catch (err) {
    console.warn('[OfflineStorage] Could not remove track offline:', err);
    return false;
  }
}

/**
 * Checks if a track is saved for offline listening.
 */
export async function isTrackOffline(trackId: string): Promise<boolean> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise<boolean>((resolve) => {
      const req = store.get(trackId);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Returns an offline Blob URL (e.g. blob:http://...) for zero-network audio playback.
 */
export async function getOfflineTrackUrl(trackId: string): Promise<string | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise<string | null>((resolve) => {
      const req = store.get(trackId);
      req.onsuccess = () => {
        const record = req.result as OfflineRecord | undefined;
        if (record && record.audioBlob) {
          const blobUrl = URL.createObjectURL(record.audioBlob);
          resolve(blobUrl);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Retrieves all tracks currently saved for offline playback.
 */
export async function getAllOfflineTracks(): Promise<Track[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise<Track[]>((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (req.result || []) as OfflineRecord[];
        const tracks = records.map((r) => r.track);
        resolve(tracks);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Returns offline storage telemetry: song count and total MB occupied on this device.
 */
export async function getOfflineStats(): Promise<{ count: number; totalMB: string }> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise<{ count: number; totalMB: string }>((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (req.result || []) as OfflineRecord[];
        const totalBytes = records.reduce((acc, r) => acc + (r.sizeBytes || 0), 0);
        resolve({
          count: records.length,
          totalMB: (totalBytes / (1024 * 1024)).toFixed(2) + ' MB',
        });
      };
      req.onerror = () => resolve({ count: 0, totalMB: '0.00 MB' });
    });
  } catch {
    return { count: 0, totalMB: '0.00 MB' };
  }
}
