import { create } from 'zustand';
import { Track, ShuffleMode, RepeatMode, ABLoopMarker, EQPreset, QueueSnapshot } from '../types/audio';
import { PlaybackController } from '../audio/PlaybackController';
import { pureFisherYatesShuffle, artistSpreadShuffle, bpmEnergyFlowShuffle } from '../audio/shuffle';
import { globalAudioGraph } from '../audio/AudioGraph';

export interface PlayerState {
  // Dual-Layer Queue State
  priorityQueue: Track[];
  contextQueue: Track[];
  originalContextQueue: Track[];
  currentTrack: Track | null;
  history: Track[];

  // Playback Telemetry
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  activeEngine: 'html5' | 'youtube' | 'none';

  // Workstation Controls
  shuffleMode: ShuffleMode;
  repeatMode: RepeatMode;
  abLoop: ABLoopMarker;
  crossfadeDuration: number;

  // 10-Band EQ State
  eqGains: number[];
  preampGain: number;
  activePresetName: string;

  // Controller reference
  controller: PlaybackController | null;

  // Actions
  initController: () => void;
  playTrack: (track: Track, newContextQueue?: Track[]) => Promise<void>;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  setShuffleMode: (mode: ShuffleMode) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  setABLoop: (startTime: number, endTime: number) => void;
  clearABLoop: () => void;
  setCrossfadeDuration: (seconds: number) => void;
  toggleCurrentTrackLike: () => Promise<void>;

  // Queue Operations (Drag & Drop, Insert, Remove)
  addToPriorityQueue: (track: Track, position?: 'next' | 'last') => void;
  reorderPriorityQueue: (fromIndex: number, toIndex: number) => void;
  reorderContextQueue: (fromIndex: number, toIndex: number) => void;
  removeFromPriorityQueue: (index: number) => void;
  removeFromContextQueue: (index: number) => void;
  moveContextToPriority: (contextIndex: number) => void;
  clearPriorityQueue: () => void;

  // Navigation
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;

  // Snapshots & EQ
  saveQueueSnapshot: (name: string) => Promise<QueueSnapshot | null>;
  restoreQueueSnapshot: (snapshot: QueueSnapshot) => Promise<void>;
  setEQBandGain: (bandIndex: number, gainDb: number) => void;
  applyEQPreset: (preset: EQPreset) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  priorityQueue: [],
  contextQueue: [],
  originalContextQueue: [],
  currentTrack: null,
  history: [],

  isPlaying: false,
  isBuffering: false,
  currentTime: 0,
  duration: 0,
  volume: 0.85,
  isMuted: false,
  playbackRate: 1.0,
  activeEngine: 'none',

  shuffleMode: 'off',
  repeatMode: 'off',
  abLoop: { enabled: false, startTime: 0, endTime: 0 },
  crossfadeDuration: 2.0,

  eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  preampGain: 0.0,
  activePresetName: 'Flat',

  controller: null,

  initController: () => {
    if (get().controller) return;

    const controller = new PlaybackController({
      onTimeUpdate: (currentTime, duration) => {
        set({ currentTime, duration: duration || get().currentTrack?.durationSeconds || 0 });
      },
      onStateChange: (isPlaying, isBuffering) => {
        set({ isPlaying, isBuffering });
      },
      onTrackEnded: () => {
        const { currentTrack, repeatMode } = get();
        if (currentTrack) {
          // Report telemetry
          fetch(`/api/tracks/${currentTrack.id}/telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ durationPlayed: currentTrack.durationSeconds, completed: true }),
          }).catch(() => {});
        }

        if (repeatMode === 'one' && currentTrack) {
          get().controller?.seek(0);
          get().controller?.play();
        } else {
          get().nextTrack();
        }
      },
      onError: (err) => {
        console.warn('[PlayerStore] Playback error:', err);
        set({ isBuffering: false });
      },
      onPreviousTrack: () => {
        get().prevTrack();
      },
      onNextTrack: () => {
        get().nextTrack();
      },
    });

    set({ controller });
  },

  playTrack: async (track: Track, newContextQueue?: Track[]) => {
    let controller = get().controller;
    if (!controller) {
      get().initController();
      controller = get().controller;
    }

    const { currentTrack, history, shuffleMode } = get();
    const updatedHistory = currentTrack ? [currentTrack, ...history.slice(0, 49)] : history;

    let nextContext = [...get().contextQueue];
    let nextOriginal = get().originalContextQueue;

    if (newContextQueue) {
      nextOriginal = [...newContextQueue];
      if (shuffleMode === 'fisher-yates') {
        nextContext = pureFisherYatesShuffle(newContextQueue);
      } else if (shuffleMode === 'artist-spread') {
        nextContext = artistSpreadShuffle(newContextQueue);
      } else if (shuffleMode === 'bpm-flow') {
        nextContext = bpmEnergyFlowShuffle(newContextQueue);
      } else {
        // Natural playlist progression: upcoming tracks are those following the clicked track
        const clickedIdx = newContextQueue.findIndex((t) => t.id === track.id);
        if (clickedIdx !== -1) {
          nextContext = newContextQueue.slice(clickedIdx + 1);
        } else {
          nextContext = newContextQueue.filter((t) => t.id !== track.id);
        }
      }

      // If shuffle was applied, make sure currently selected track is excluded from upcoming context
      if (shuffleMode !== 'off') {
        nextContext = nextContext.filter((t) => t.id !== track.id);
      }
    } else {
      // User clicked a track directly (from QueueDrawer or Search) without a new playlist context:
      // 1. If in priorityQueue, remove it:
      if (get().priorityQueue.some((t) => t.id === track.id)) {
        set({ priorityQueue: get().priorityQueue.filter((t) => t.id !== track.id) });
      }
      // 2. If in contextQueue, advance contextQueue to tracks following it:
      const inContextIdx = nextContext.findIndex((t) => t.id === track.id);
      if (inContextIdx !== -1) {
        nextContext = nextContext.slice(inContextIdx + 1);
      }
    }

    set({
      currentTrack: track,
      isPlaying: true,
      history: updatedHistory,
      contextQueue: nextContext,
      originalContextQueue: nextOriginal,
      currentTime: 0,
      duration: track.durationSeconds || 0,
      activeEngine: track.sourceType === 'youtube' ? 'youtube' : 'html5',
    });

    // Manual track plays are instant (crossfade = false) to prevent deck collision
    await controller?.playTrack(track, 0, false);
  },

  togglePlay: () => {
    const { controller, isPlaying, currentTrack, priorityQueue, contextQueue } = get();
    if (!currentTrack) {
      const next = priorityQueue[0] || contextQueue[0];
      if (next) {
        get().playTrack(next);
      }
      return;
    }
    const nextPlaying = !isPlaying;
    // Instant optimistic state change (<1ms latency feedback)
    set({ isPlaying: nextPlaying });
    if (nextPlaying) {
      controller?.play();
    } else {
      controller?.pause();
    }
  },

  pause: () => {
    set({ isPlaying: false });
    get().controller?.pause();
  },

  resume: () => {
    set({ isPlaying: true });
    get().controller?.play();
  },

  seek: (seconds: number) => {
    get().controller?.seek(seconds);
    set({ currentTime: seconds });
  },

  setVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    get().controller?.setVolume(clamped);
    set({ volume: clamped, isMuted: clamped === 0 });
  },

  toggleMute: () => {
    const { isMuted, volume, controller } = get();
    const newMuted = !isMuted;
    controller?.setMuted(newMuted);
    set({ isMuted: newMuted });
  },

  setPlaybackRate: (rate: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, rate));
    get().controller?.setPlaybackRate(clamped);
    set({ playbackRate: clamped });
  },

  setShuffleMode: (mode: ShuffleMode) => {
    const { originalContextQueue, currentTrack } = get();
    let reordered: Track[] = [];

    if (mode === 'fisher-yates') {
      reordered = pureFisherYatesShuffle(originalContextQueue);
    } else if (mode === 'artist-spread') {
      reordered = artistSpreadShuffle(originalContextQueue);
    } else if (mode === 'bpm-flow') {
      reordered = bpmEnergyFlowShuffle(originalContextQueue);
    } else {
      reordered = [...originalContextQueue];
    }

    // Keep current track out of remaining queue
    if (currentTrack) {
      reordered = reordered.filter((t) => t.id !== currentTrack.id);
    }

    set({ shuffleMode: mode, contextQueue: reordered });
  },

  setRepeatMode: (mode: RepeatMode) => {
    set({ repeatMode: mode });
  },

  setABLoop: (startTime: number, endTime: number) => {
    const loop = { enabled: true, startTime, endTime };
    get().controller?.setABLoop(loop);
    set({ abLoop: loop });
  },

  clearABLoop: () => {
    get().controller?.clearABLoop();
    set({ abLoop: { enabled: false, startTime: 0, endTime: 0 } });
  },

  setCrossfadeDuration: (seconds: number) => {
    get().controller?.setCrossfadeDuration(seconds);
    set({ crossfadeDuration: seconds });
  },

  toggleCurrentTrackLike: async () => {
    const { currentTrack } = get();
    if (!currentTrack) return;
    const nextFav = !currentTrack.isFavorite;
    // Optimistic instant update
    set({ currentTrack: { ...currentTrack, isFavorite: nextFav } });
    try {
      await fetch(`/api/tracks/${currentTrack.id}/toggle-like`, { method: 'POST' });
    } catch (e) {
      // Revert if error
      set({ currentTrack: { ...currentTrack, isFavorite: !nextFav } });
    }
  },

  addToPriorityQueue: (track: Track, position: 'next' | 'last' = 'last') => {
    const { priorityQueue } = get();
    if (position === 'next') {
      set({ priorityQueue: [track, ...priorityQueue] });
    } else {
      set({ priorityQueue: [...priorityQueue, track] });
    }
  },

  reorderPriorityQueue: (fromIndex: number, toIndex: number) => {
    const queue = [...get().priorityQueue];
    const [moved] = queue.splice(fromIndex, 1);
    queue.splice(toIndex, 0, moved);
    set({ priorityQueue: queue });
  },

  reorderContextQueue: (fromIndex: number, toIndex: number) => {
    const queue = [...get().contextQueue];
    const [moved] = queue.splice(fromIndex, 1);
    queue.splice(toIndex, 0, moved);
    set({ contextQueue: queue });
  },

  removeFromPriorityQueue: (index: number) => {
    const queue = [...get().priorityQueue];
    queue.splice(index, 1);
    set({ priorityQueue: queue });
  },

  removeFromContextQueue: (index: number) => {
    const queue = [...get().contextQueue];
    queue.splice(index, 1);
    set({ contextQueue: queue });
  },

  moveContextToPriority: (contextIndex: number) => {
    const context = [...get().contextQueue];
    const [track] = context.splice(contextIndex, 1);
    if (track) {
      set({
        contextQueue: context,
        priorityQueue: [...get().priorityQueue, track],
      });
    }
  },

  clearPriorityQueue: () => {
    set({ priorityQueue: [] });
  },

  nextTrack: async () => {
    const { priorityQueue, contextQueue, repeatMode, originalContextQueue } = get();

    // 1. Priority Queue takes precedence
    if (priorityQueue.length > 0) {
      const [next, ...remainingPriority] = priorityQueue;
      set({ priorityQueue: remainingPriority, isPlaying: true });
      await get().playTrack(next);
      return;
    }

    // 2. Context Queue
    if (contextQueue.length > 0) {
      const [next, ...remainingContext] = contextQueue;
      set({ contextQueue: remainingContext, isPlaying: true });
      await get().playTrack(next);
      return;
    }

    // 3. Queue Exhausted: Loop context if repeat is 'all'
    if (repeatMode === 'all' && originalContextQueue.length > 0) {
      const freshPool = [...originalContextQueue];
      const [first, ...rest] = freshPool;
      set({ contextQueue: rest, isPlaying: true });
      await get().playTrack(first);
      return;
    }

    set({ isPlaying: false });
    get().controller?.pause();
  },

  prevTrack: async () => {
    const { currentTime, history, currentTrack, contextQueue } = get();

    // If past 3 seconds, restart current track
    if (currentTime > 3) {
      get().seek(0);
      return;
    }

    // Otherwise pop previous track from history
    if (history.length > 0) {
      const [prev, ...remainingHistory] = history;
      const updatedContext = currentTrack ? [currentTrack, ...contextQueue] : contextQueue;

      let controller = get().controller;
      if (!controller) {
        get().initController();
        controller = get().controller;
      }

      set({
        currentTrack: prev,
        isPlaying: true,
        history: remainingHistory,
        contextQueue: updatedContext,
        currentTime: 0,
        duration: prev.durationSeconds || 0,
        activeEngine: prev.sourceType === 'youtube' ? 'youtube' : 'html5',
      });

      await controller?.playTrack(prev, 0, false);
    } else {
      get().seek(0);
    }
  },

  saveQueueSnapshot: async (name: string) => {
    const { priorityQueue, contextQueue, currentTrack, currentTime, shuffleMode } = get();

    const payload = {
      name,
      priorityQueue,
      contextQueue,
      currentTrackId: currentTrack?.id,
      currentPlaybackTime: currentTime,
      shuffleMode,
    };

    try {
      const res = await fetch('/api/queue-snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Could not save snapshot:', e);
    }
    return null;
  },

  restoreQueueSnapshot: async (snapshot: QueueSnapshot) => {
    set({
      priorityQueue: snapshot.priorityQueue || [],
      contextQueue: snapshot.contextQueue || [],
      shuffleMode: snapshot.shuffleMode || 'off',
    });

    if (snapshot.currentTrackId) {
      try {
        const res = await fetch(`/api/tracks/${snapshot.currentTrackId}`);
        if (res.ok) {
          const track = await res.json();
          await get().playTrack(track);
          if (snapshot.currentPlaybackTime > 0) {
            get().seek(snapshot.currentPlaybackTime);
          }
        }
      } catch (e) {
        console.warn('Could not restore current track for snapshot:', e);
      }
    }
  },

  setEQBandGain: (bandIndex: number, gainDb: number) => {
    const gains = [...get().eqGains];
    if (bandIndex >= 0 && bandIndex < gains.length) {
      gains[bandIndex] = gainDb;
      globalAudioGraph.setEQBandGain(bandIndex, gainDb);
      set({ eqGains: gains, activePresetName: 'Custom' });
    }
  },

  applyEQPreset: (preset: EQPreset) => {
    globalAudioGraph.setEQGains(preset.bandGains);
    globalAudioGraph.setPreampGain(preset.preampGain);
    set({
      eqGains: [...preset.bandGains],
      preampGain: preset.preampGain,
      activePresetName: preset.name,
    });
  },
}));

if (typeof window !== 'undefined') {
  (window as any).__PULSE_STORE__ = usePlayerStore;
}
