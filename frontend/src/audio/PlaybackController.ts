import { Track, ABLoopMarker } from '../types/audio';
import { globalAudioGraph, AudioGraph, AudioDeck } from './AudioGraph';
import { Crossfader } from './Crossfader';
import { globalYouTubeBridge, YouTubeBridge } from './YouTubeBridge';
import { getOfflineTrackUrl } from '../utils/offlineStorage';

export interface PlaybackControllerCallbacks {
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onTrackEnded: () => void;
  onStateChange: (isPlaying: boolean, isBuffering: boolean) => void;
  onError: (err: any) => void;
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
}

export class PlaybackController {
  private audioGraph: AudioGraph;
  private crossfader: Crossfader;
  private ytBridge: YouTubeBridge;

  private currentTrack: Track | null = null;
  private activeEngine: 'html5' | 'youtube' | 'none' = 'none';
  private isPlaying: boolean = false;
  private volume: number = 0.8;
  private playbackRate: number = 1.0;
  private isMuted: boolean = false;

  private abLoop: ABLoopMarker = { enabled: false, startTime: 0, endTime: 0 };
  private callbacks: PlaybackControllerCallbacks;

  // Concurrency guard: only the latest play request is allowed to complete
  private currentRequestId: number = 0;
  private playPromise: Promise<void> | null = null;

  constructor(callbacks: PlaybackControllerCallbacks) {
    this.callbacks = callbacks;
    this.audioGraph = globalAudioGraph;
    this.crossfader = new Crossfader(2.0);
    this.ytBridge = globalYouTubeBridge;

    this.setupListeners();
  }

  private setupListeners() {
    this.ytBridge.onTimeUpdate((currentTime, duration) => {
      if (this.activeEngine === 'youtube') {
        this.checkABLoop(currentTime);
        this.callbacks.onTimeUpdate(currentTime, duration);
      }
    });

    this.ytBridge.onStateChange((state) => {
      if (this.activeEngine === 'youtube') {
        if (state === 'playing') {
          this.isPlaying = true;
          this.callbacks.onStateChange(true, false);
        } else if (state === 'paused') {
          this.isPlaying = false;
          this.callbacks.onStateChange(false, false);
        } else if (state === 'buffering') {
          this.callbacks.onStateChange(this.isPlaying, true);
        }
      }
    });

    this.ytBridge.onTrackEnded(() => {
      if (this.activeEngine === 'youtube') {
        this.callbacks.onTrackEnded();
      }
    });
  }

  public async playTrack(track: Track, startTime: number = 0, crossfade: boolean = false): Promise<void> {
    const requestId = ++this.currentRequestId;
    this.currentTrack = track;
    this.updateMediaSession(track);

    // Prioritize direct Web Audio stream (0ms buffer, connects to 10-band EQ & visualizer)
    const hasDirectStream = Boolean(
      track.sourceUrl ||
      track.sourceType === 'local' ||
      track.sourceType === 'stream'
    );

    if (!hasDirectStream && track.sourceType === 'youtube' && track.youtubeVideoId) {
      // Switch to YouTube Engine
      this.stopHTML5();
      this.activeEngine = 'youtube';
      await this.ytBridge.init();
      if (this.currentRequestId !== requestId) return;

      this.ytBridge.showDock();
      this.ytBridge.loadVideoById(track.youtubeVideoId, startTime);
      this.ytBridge.setVolume(this.isMuted ? 0 : this.volume);
      this.ytBridge.setPlaybackRate(this.playbackRate);
      this.ytBridge.play();
      this.isPlaying = true;
      this.updateMediaSessionPlaybackState(true);
      this.callbacks.onStateChange(true, false);
      return;
    }

    // Switch to HTML5 Web Audio API Engine
    this.ytBridge.pause();
    this.ytBridge.hideDock();
    this.activeEngine = 'html5';

    const ctx = this.audioGraph.init();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const activeDeck = this.audioGraph.getActiveDeck();
    const inactiveDeck = this.audioGraph.getInactiveDeck();
    const offlineUrl = await getOfflineTrackUrl(track.id);
    const streamUrl = offlineUrl || track.sourceUrl || `/api/stream/${track.id}`;

    // Always cancel any pending crossfades from previous track switches
    this.crossfader.cancel(activeDeck, inactiveDeck, ctx);

    if (crossfade && this.isPlaying && activeDeck.audioElement.src) {
      // Natural automated crossfade transition
      this.detachDeckListeners(inactiveDeck);
      inactiveDeck.audioElement.pause();
      inactiveDeck.audioElement.src = streamUrl;
      inactiveDeck.audioElement.currentTime = startTime;
      inactiveDeck.audioElement.playbackRate = this.playbackRate;
      this.attachDeckListeners(inactiveDeck);

      try {
        this.playPromise = inactiveDeck.audioElement.play();
        await this.playPromise;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('[PlaybackController] Inactive deck play error:', err);
      } finally {
        this.playPromise = null;
      }

      if (this.currentRequestId !== requestId) return;

      if (ctx && ctx.currentTime !== undefined) {
        await this.crossfader.crossfade(activeDeck, inactiveDeck, ctx);
      }

      if (this.currentRequestId !== requestId) return;

      this.audioGraph.swapDecks();
      this.detachDeckListeners(activeDeck);
      activeDeck.audioElement.pause();
    } else {
      // Instant manual track switch (ZERO CROSSFADE DELAY, ZERO 2-SONG COLLISION)
      // 1. Immediately detach listeners and pause inactive deck
      this.detachDeckListeners(inactiveDeck);
      inactiveDeck.audioElement.pause();
      try {
        inactiveDeck.audioElement.currentTime = 0;
      } catch (e) {}

      // 2. Pause active deck before changing src to prevent browser play() AbortError
      activeDeck.audioElement.pause();

      // 3. Reset hardware gains: active=1.0, inactive=0.0
      this.audioGraph.resetDecks();

      // 4. Attach listeners exclusively to the active deck
      this.attachDeckListeners(activeDeck);
      activeDeck.audioElement.src = streamUrl;
      activeDeck.audioElement.currentTime = startTime;
      activeDeck.audioElement.playbackRate = this.playbackRate;

      try {
        this.playPromise = activeDeck.audioElement.play();
        await this.playPromise;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // Normal interruption by fast skip or pause - safely ignore
          return;
        }
        console.warn('[PlaybackController] HTML5 Audio play error:', err);
      } finally {
        this.playPromise = null;
      }
    }

    if (this.currentRequestId !== requestId) return;

    this.audioGraph.setMasterVolume(this.isMuted ? 0 : this.volume);
    this.isPlaying = true;
    this.updateMediaSessionPlaybackState(true);
    this.callbacks.onStateChange(true, false);
  }

  private updateMediaSession(track: Track) {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const artworkUrl =
        track.coverArtUrl ||
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=512&q=80';

      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'Pulse Audio Workstation',
        artwork: [
          { src: artworkUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '192x192', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' },
        ],
      });

      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (this.callbacks.onPreviousTrack) {
          this.callbacks.onPreviousTrack();
        } else {
          this.seek(0);
        }
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (this.callbacks.onNextTrack) {
          this.callbacks.onNextTrack();
        } else {
          this.callbacks.onTrackEnded();
        }
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          this.seek(details.seekTime);
        }
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        this.seek(Math.max(0, this.getCurrentTime() - offset));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        this.seek(this.getCurrentTime() + offset);
      });
    } catch (e) {
      console.warn('[MediaSession] setup notice:', e);
    }
  }

  private updateMediaSessionPlaybackState(isPlaying: boolean) {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (e) {}
  }

  private updateMediaSessionPositionState(currentTime: number, duration: number) {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !duration || isNaN(duration) || duration <= 0) return;
    try {
      if (typeof navigator.mediaSession.setPositionState === 'function') {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0, duration),
          playbackRate: this.playbackRate,
          position: Math.max(0, Math.min(currentTime, duration)),
        });
      }
    } catch (e) {}
  }

  private attachDeckListeners(deck: AudioDeck) {
    const audio = deck.audioElement;

    audio.ontimeupdate = () => {
      if (this.activeEngine === 'html5') {
        this.checkABLoop(audio.currentTime);
        this.callbacks.onTimeUpdate(audio.currentTime, audio.duration || 0);
        this.updateMediaSessionPositionState(audio.currentTime, audio.duration || 0);
      }
    };

    audio.onended = () => {
      if (this.activeEngine === 'html5') {
        this.callbacks.onTrackEnded();
      }
    };

    audio.onplay = () => {
      if (this.activeEngine === 'html5') {
        this.isPlaying = true;
        this.updateMediaSessionPlaybackState(true);
        this.callbacks.onStateChange(true, false);
      }
    };

    audio.onpause = () => {
      if (this.activeEngine === 'html5') {
        this.isPlaying = false;
        this.updateMediaSessionPlaybackState(false);
        this.callbacks.onStateChange(false, false);
      }
    };

    audio.onwaiting = () => {
      if (this.activeEngine === 'html5') {
        this.callbacks.onStateChange(this.isPlaying, true);
      }
    };

    audio.onerror = (e) => {
      console.warn('[PlaybackController] HTML5 Audio element error:', e);
      if (this.currentTrack?.youtubeVideoId && this.activeEngine !== 'youtube') {
        console.log('[PlaybackController] Falling back to YouTube bridge for:', this.currentTrack.title);
        this.stopHTML5();
        this.activeEngine = 'youtube';
        this.ytBridge.init().then(() => {
          this.ytBridge.showDock();
          this.ytBridge.loadVideoById(this.currentTrack!.youtubeVideoId!, 0);
          this.ytBridge.play();
        }).catch(() => {
          this.callbacks.onError(e);
        });
        return;
      }
      this.callbacks.onError(e);
    };
  }

  private detachDeckListeners(deck: AudioDeck) {
    const audio = deck.audioElement;
    audio.ontimeupdate = null;
    audio.onended = null;
    audio.onplay = null;
    audio.onpause = null;
    audio.onwaiting = null;
    audio.onerror = null;
  }

  public async togglePlay(): Promise<void> {
    if (this.isPlaying) {
      await this.pause();
    } else {
      await this.play();
    }
  }

  public async play(): Promise<void> {
    this.isPlaying = true;
    this.updateMediaSessionPlaybackState(true);
    this.callbacks.onStateChange(true, false);

    if (this.activeEngine === 'youtube') {
      this.ytBridge.play();
      return;
    }

    if (this.activeEngine === 'html5') {
      const deck = this.audioGraph.getActiveDeck();
      const ctx = this.audioGraph.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      try {
        this.playPromise = deck.audioElement.play();
        await this.playPromise;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        console.warn('[PlaybackController] play() error:', err);
        this.isPlaying = false;
        this.updateMediaSessionPlaybackState(false);
        this.callbacks.onStateChange(false, false);
      } finally {
        this.playPromise = null;
      }
    }
  }

  public async pause(): Promise<void> {
    this.isPlaying = false;
    this.updateMediaSessionPlaybackState(false);
    this.callbacks.onStateChange(false, false);

    if (this.activeEngine === 'youtube') {
      this.ytBridge.pause();
      return;
    }

    if (this.activeEngine === 'html5') {
      const deck = this.audioGraph.getActiveDeck();
      if (this.playPromise) {
        try {
          await this.playPromise;
        } catch (e) {}
      }
      deck.audioElement.pause();
    }
  }

  public seek(seconds: number) {
    if (this.activeEngine === 'youtube') {
      this.ytBridge.seekTo(seconds);
    } else if (this.activeEngine === 'html5') {
      const deck = this.audioGraph.getActiveDeck();
      deck.audioElement.currentTime = seconds;
    }
  }

  public getCurrentTime(): number {
    if (this.activeEngine === 'html5') {
      return this.audioGraph.getActiveDeck().audioElement.currentTime || 0;
    } else if (this.activeEngine === 'youtube') {
      return this.ytBridge.getCurrentTime();
    }
    return 0;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.activeEngine === 'youtube') {
      this.ytBridge.setVolume(this.isMuted ? 0 : this.volume);
    } else {
      this.audioGraph.setMasterVolume(this.isMuted ? 0 : this.volume);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    this.setVolume(this.volume);
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = Math.max(0.5, Math.min(2.0, rate));
    if (this.activeEngine === 'youtube') {
      this.ytBridge.setPlaybackRate(this.playbackRate);
    } else if (this.activeEngine === 'html5') {
      const deck = this.audioGraph.getActiveDeck();
      deck.audioElement.playbackRate = this.playbackRate;
    }
  }

  public setABLoop(loop: ABLoopMarker) {
    this.abLoop = loop;
  }

  public clearABLoop() {
    this.abLoop = { enabled: false, startTime: 0, endTime: 0 };
  }

  public setCrossfadeDuration(seconds: number) {
    this.crossfader.setDuration(seconds);
  }

  private checkABLoop(currentTime: number) {
    if (this.abLoop.enabled && this.abLoop.endTime > this.abLoop.startTime) {
      if (currentTime >= this.abLoop.endTime) {
        this.seek(this.abLoop.startTime);
      }
    }
  }

  private stopHTML5() {
    const deckA = this.audioGraph.getActiveDeck();
    const deckB = this.audioGraph.getInactiveDeck();
    this.detachDeckListeners(deckA);
    this.detachDeckListeners(deckB);
    deckA.audioElement.pause();
    deckB.audioElement.pause();
  }

  public getActiveEngine(): 'html5' | 'youtube' | 'none' {
    return this.activeEngine;
  }
}
