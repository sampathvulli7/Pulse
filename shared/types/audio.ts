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
  playCount: number;
  skipCount: number;
  lastPlayedAt?: string;
  createdAt?: string;
  updatedAt?: string;
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
