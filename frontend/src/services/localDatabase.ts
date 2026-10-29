import { Track, Playlist } from '../types/audio';

const DB_NAME = 'pulse_local_store';
const DB_VERSION = 2;

export interface SyncOperation {
  id: string;
  type: 'ADD_PLAYLIST' | 'UPDATE_PLAYLIST' | 'DELETE_PLAYLIST' | 'TOGGLE_LIKE' | 'ADD_TRACK';
  payload: any;
  timestamp: number;
}

let dbInstance: IDBDatabase | null = null;

export function openLocalDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('favorites')) {
        db.createObjectStore('favorites', { keyPath: 'trackId' });
      }
      if (!db.objectStoreNames.contains('tracks')) {
        db.createObjectStore('tracks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('history')) {
        db.createObjectStore('history', { keyPath: 'trackId' });
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

// ======================== PLAYLISTS ========================

export async function getLocalPlaylists(): Promise<Playlist[]> {
  const db = await openLocalDB();
  return new Promise((resolve) => {
    const tx = db.transaction('playlists', 'readonly');
    const store = tx.objectStore('playlists');
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result || []) as Playlist[];
      if (items.length === 0) {
        // Seed default starter playlists for first-time phone launch
        const defaultPlaylists: Playlist[] = [
          {
            id: 'pl-local-favorites',
            name: 'Liked Songs',
            description: 'Your favorite tracks on this device',
            isSmart: false,
            coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80',
            isFavorite: true,
            trackCount: 0,
            tracks: [],
          },
          {
            id: 'pl-local-vibes',
            name: '✨ Midnight Pulse',
            description: 'Ambient synthwave and deep focus beats',
            isSmart: false,
            coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
            isFavorite: false,
            trackCount: 0,
            tracks: [],
          },
        ];
        defaultPlaylists.forEach((pl) => saveLocalPlaylist(pl));
        return resolve(defaultPlaylists);
      }
      resolve(items);
    };
    req.onerror = () => resolve([]);
  });
}

export async function saveLocalPlaylist(playlist: Playlist): Promise<void> {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('playlists', 'readwrite');
    const store = tx.objectStore('playlists');
    const req = store.put({
      ...playlist,
      updatedAt: Date.now(),
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocalPlaylist(id: string): Promise<void> {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('playlists', 'readwrite');
    const store = tx.objectStore('playlists');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ======================== FAVORITES ========================

export async function getLocalFavorites(): Promise<Set<string>> {
  const db = await openLocalDB();
  return new Promise((resolve) => {
    const tx = db.transaction('favorites', 'readonly');
    const store = tx.objectStore('favorites');
    const req = store.getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      const set = new Set<string>(items.map((i: any) => i.trackId));
      resolve(set);
    };
    req.onerror = () => resolve(new Set());
  });
}

export async function toggleLocalFavorite(trackId: string, track?: Track): Promise<boolean> {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('favorites', 'readwrite');
    const store = tx.objectStore('favorites');
    const checkReq = store.get(trackId);

    checkReq.onsuccess = () => {
      if (checkReq.result) {
        store.delete(trackId);
        resolve(false);
      } else {
        store.put({
          trackId,
          track: track || null,
          favoritedAt: Date.now(),
        });
        resolve(true);
      }
    };
    checkReq.onerror = () => reject(checkReq.error);
  });
}

// ======================== TRACKS ========================

export async function getLocalTracks(): Promise<Track[]> {
  const db = await openLocalDB();
  return new Promise((resolve) => {
    const tx = db.transaction('tracks', 'readonly');
    const store = tx.objectStore('tracks');
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []) as Track[]);
    req.onerror = () => resolve([]);
  });
}

export async function saveLocalTrack(track: Track): Promise<void> {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');
    const req = store.put(track);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalTracksBulk(tracks: Track[]): Promise<void> {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');
    tracks.forEach((t) => store.put(t));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ======================== SYNC QUEUE ========================

export async function enqueueSyncOperation(type: SyncOperation['type'], payload: any): Promise<void> {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const item: SyncOperation = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      payload,
      timestamp: Date.now(),
    };
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getSyncQueue(): Promise<SyncOperation[]> {
  const db = await openLocalDB();
  return new Promise((resolve) => {
    const tx = db.transaction('sync_queue', 'readonly');
    const store = tx.objectStore('sync_queue');
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []) as SyncOperation[]);
    req.onerror = () => resolve([]);
  });
}

export async function clearSyncQueue(ids: string[]): Promise<void> {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    ids.forEach((id) => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
