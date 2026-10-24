import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'pulse.sqlite');
export const db = new Database(DB_PATH);

// Enable WAL mode and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    -- 1. Tracks Table
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT,
      duration_seconds REAL NOT NULL DEFAULT 0,
      source_type TEXT CHECK(source_type IN ('local', 'stream', 'youtube')) NOT NULL,
      source_url TEXT,
      local_path TEXT,
      youtube_video_id TEXT,
      cover_art_url TEXT,
      bpm REAL,
      energy REAL CHECK(energy >= 0.0 AND energy <= 1.0),
      key_signature TEXT,
      genre TEXT,
      isrc TEXT,
      bitrate INTEGER,
      play_count INTEGER NOT NULL DEFAULT 0,
      skip_count INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      last_played_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
    CREATE INDEX IF NOT EXISTS idx_tracks_source ON tracks(source_type);
    CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
    CREATE INDEX IF NOT EXISTS idx_tracks_bpm ON tracks(bpm);

    -- Ensure is_favorite column exists
  `);

  try {
    db.exec('ALTER TABLE tracks ADD COLUMN is_favorite INTEGER DEFAULT 0');
  } catch (e) {
    // Column already exists
  }

  db.exec(`

    -- 2. Playlists Table
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_smart INTEGER NOT NULL DEFAULT 0,
      cover_url TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Playlist Tracks Table (Ordered Join)
    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id TEXT PRIMARY KEY,
      playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(playlist_id, position)
    );

    CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);

    -- 4. Smart Playlist Rules Table
    CREATE TABLE IF NOT EXISTS smart_playlist_rules (
      id TEXT PRIMARY KEY,
      playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      field TEXT NOT NULL,
      operator TEXT NOT NULL,
      value TEXT NOT NULL,
      logic_gate TEXT NOT NULL DEFAULT 'AND' CHECK(logic_gate IN ('AND', 'OR'))
    );

    CREATE INDEX IF NOT EXISTS idx_smart_rules_playlist ON smart_playlist_rules(playlist_id);

    -- 5. Queue Snapshots Table
    CREATE TABLE IF NOT EXISTS queue_snapshots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      priority_queue_json TEXT NOT NULL,
      context_queue_json TEXT NOT NULL,
      current_track_id TEXT REFERENCES tracks(id) ON DELETE SET NULL,
      current_playback_time REAL NOT NULL DEFAULT 0,
      shuffle_mode TEXT NOT NULL DEFAULT 'off',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. EQ Presets Table
    CREATE TABLE IF NOT EXISTS eq_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      is_default INTEGER NOT NULL DEFAULT 0,
      preamp_gain REAL NOT NULL DEFAULT 0.0,
      band_gains_json TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. Play History Table
    CREATE TABLE IF NOT EXISTS play_history (
      id TEXT PRIMARY KEY,
      track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      played_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      duration_played_seconds REAL NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      context_type TEXT CHECK(context_type IN ('playlist', 'album', 'search', 'manual')),
      context_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_play_history_track ON play_history(track_id);
    CREATE INDEX IF NOT EXISTS idx_play_history_played_at ON play_history(played_at);
  `);

  initDefaultEQPresets();
}

function initDefaultEQPresets() {
  const defaults = [
    { name: 'Flat', isDefault: 1, preamp: 0.0, gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: 'Bass Boost', isDefault: 1, preamp: -1.5, gains: [5.5, 4.5, 3.0, 1.5, 0, 0, 0, 0, 0, 0] },
    { name: 'Vocal Clarity', isDefault: 1, preamp: -1.0, gains: [-2.0, -1.0, 0, 1.5, 3.5, 4.0, 3.0, 1.5, 0.5, 0] },
    { name: 'Late Night', isDefault: 1, preamp: -2.0, gains: [-3.0, -2.0, 0, 1.0, 1.5, 1.5, 0.5, -1.0, -2.5, -4.0] },
    { name: 'Electronic', isDefault: 1, preamp: -1.5, gains: [4.5, 3.5, 1.0, 0, -1.0, 1.5, 2.5, 3.5, 4.0, 4.5] },
    { name: 'Acoustic', isDefault: 1, preamp: -1.0, gains: [2.0, 1.5, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 2.5, 2.0] },
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO eq_presets (id, name, is_default, preamp_gain, band_gains_json)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const preset of defaults) {
    stmt.run(`preset-${preset.name.toLowerCase().replace(/\s+/g, '-')}`, preset.name, preset.isDefault, preset.preamp, JSON.stringify(preset.gains));
  }
}
