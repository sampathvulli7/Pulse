export type SourceType = 'local' | 'stream' | 'youtube';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationSeconds: number;
  sourceType: SourceType;
  sourceUrl?: string;
  localPath?: string;
  youtubeVideoId?: string;
  coverArtUrl?: string;
  bpm?: number;
  energy?: number; // 0.0 to 1.0
  keySignature?: string;
  genre?: string;
  isrc?: string;
  bitrate?: number;
  sampleRate?: number; // e.g. 44100, 48000, 96000, 192000 Hz
  bitDepth?: number;   // e.g. 16, 24 bit
  codec?: 'ALAC' | 'FLAC' | 'AAC' | 'WAV' | 'MP3';
  isLossless?: boolean;
  isHiRes?: boolean;
  isSpatialAvailable?: boolean;
  playCount: number;
  skipCount: number;
  isFavorite?: boolean;
  isDownloaded?: boolean;
  uid?: string; // Unique instance ID in dual-queue
  lastPlayedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QueueItem {
  uid: string;
  track: Track;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  isSmart: boolean;
  coverUrl?: string;
  isFavorite?: boolean;
  tracks?: Track[];
  trackCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type RuleField = 'genre' | 'artist' | 'bpm' | 'energy' | 'play_count' | 'skip_count' | 'duration';
export type RuleOperator = 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between';

export interface SmartRuleDTO {
  field: RuleField;
  operator: RuleOperator;
  value: string;
  logic_gate?: 'AND' | 'OR';
}

export interface SmartPlaylistRule {
  id: string;
  playlistId: string;
  field: RuleField;
  operator: RuleOperator;
  value: string;
  logicGate: 'AND' | 'OR';
}

export interface QueueSnapshot {
  id: string;
  name: string;
  priorityQueue: Track[];
  contextQueue: Track[];
  currentTrackId?: string;
  currentPlaybackTime: number;
  shuffleMode: ShuffleMode;
  createdAt?: string;
}

export interface EQPreset {
  id: string;
  name: string;
  isDefault: boolean;
  preampGain: number; // dB (-12 to +12)
  bandGains: [number, number, number, number, number, number, number, number, number, number]; // 10 bands in dB
}

export type ShuffleMode = 'off' | 'fisher-yates' | 'artist-spread' | 'bpm-flow';
export type RepeatMode = 'off' | 'all' | 'one';

export interface ABLoopMarker {
  enabled: boolean;
  startTime: number;
  endTime: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;       // 0.0 to 1.0
  isMuted: boolean;
  playbackRate: number; // 0.5 to 2.0
  activeEngine: 'html5' | 'youtube' | 'none';
}

export interface SyncedLyricLine {
  timeMs: number;
  text: string;
}

export interface LyricsData {
  syncedLyrics?: string;
  plainLyrics?: string;
  parsedLines?: SyncedLyricLine[];
  instrumental: boolean;
}

// Spotify xpui UI State & Navigation Types
export type RightPanelTab = 'now-playing' | 'queue' | 'eq' | 'lyrics' | null;
export type LeftRailMode = 'expanded' | 'collapsed';
export type LibraryFilter = 'all' | 'playlists' | 'artists' | 'albums' | 'mixes';
export type LibrarySort = 'recents' | 'recently_added' | 'alphabetical' | 'creator';

export interface SpotifyAudioFeatures {
  id: string;
  danceability: number;
  energy: number;
  key: number;
  key_name: string;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
  duration_ms: number;
  time_signature: number;
}

export interface DailyMix {
  id: string;
  name: string;
  subtitle: string;
  genre: string;
  coverUrl: string;
  trackCount: number;
  tracks: Track[];
}

// Apple Music & Hybrid Workstation Audio Types
export type AudioQualityTier = 'high-efficiency' | 'high-quality' | 'lossless' | 'hi-res-lossless';
export type SpatialAudioMode = 'off' | 'fixed' | 'wide-stage';
export type AppTheme = 'light' | 'dark' | 'auto';

export interface AudioQualitySettings {
  streamingTier: AudioQualityTier;
  soundCheckEnabled: boolean; // Loudness Normalization to -14 LUFS
  spatialAudioMode: SpatialAudioMode;
  dacSampleRate: number; // e.g. 48000, 96000, 192000
}

