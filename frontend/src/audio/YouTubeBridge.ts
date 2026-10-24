/**
 * Official YouTube IFrame Player API Bridge
 */

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export type YTStateChangeHandler = (state: 'playing' | 'paused' | 'buffering' | 'ended') => void;
export type YTTimeUpdateHandler = (currentTime: number, duration: number) => void;

export class YouTubeBridge {
  private player: any = null;
  private isReady: boolean = false;
  private containerId: string = 'pulse-yt-player-container';
  private timePollInterval: any = null;

  private onStateChangeCallback: YTStateChangeHandler | null = null;
  private onTimeUpdateCallback: YTTimeUpdateHandler | null = null;
  private onTrackEndedCallback: (() => void) | null = null;

  public async init(containerId: string = 'pulse-yt-player-container'): Promise<void> {
    this.containerId = containerId;
    return new Promise((resolve) => {
      if (window.YT && window.YT.Player) {
        this.mountPlayer(resolve);
        return;
      }

      // Load script
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      const prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevReady) prevReady();
        this.mountPlayer(resolve);
      };
    });
  }

  private mountPlayer(onReadyResolve: () => void) {
    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.style.position = 'fixed';
      container.style.bottom = '96px';
      container.style.right = '24px';
      container.style.width = '260px';
      container.style.height = '146px';
      container.style.zIndex = '9999';
      container.style.borderRadius = '12px';
      container.style.overflow = 'hidden';
      container.style.boxShadow = '0 20px 30px rgba(0,0,0,0.6)';
      container.style.border = '1px solid rgba(255,255,255,0.2)';
      container.style.backgroundColor = '#000';
      container.style.display = 'none'; // Shown when YouTube track is playing
      document.body.appendChild(container);
    }

    try {
      this.player = new window.YT.Player(this.containerId, {
        height: '146',
        width: '260',
        playerVars: {
          autoplay: 1,
          controls: 1,
          disablekb: 0,
          fs: 0,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            this.isReady = true;
            this.startTimePolling();
            onReadyResolve();
          },
          onStateChange: (event: any) => {
            this.handlePlayerStateChange(event.data);
          },
          onError: (err: any) => {
            console.warn('[YouTubeBridge] Player error:', err);
          },
        },
      });
    } catch (e) {
      console.warn('[YouTubeBridge] Initialization fallback:', e);
      onReadyResolve();
    }
  }

  public showDock() {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(this.containerId);
    if (el) el.style.display = 'block';
  }

  public hideDock() {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(this.containerId);
    if (el) el.style.display = 'none';
  }

  private handlePlayerStateChange(state: number) {
    // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
    if (state === 1) {
      this.onStateChangeCallback?.('playing');
    } else if (state === 2) {
      this.onStateChangeCallback?.('paused');
    } else if (state === 3) {
      this.onStateChangeCallback?.('buffering');
    } else if (state === 0) {
      this.onStateChangeCallback?.('ended');
      this.onTrackEndedCallback?.();
    }
  }

  private startTimePolling() {
    if (this.timePollInterval) clearInterval(this.timePollInterval);
    this.timePollInterval = setInterval(() => {
      if (this.player && this.isReady && typeof this.player.getCurrentTime === 'function') {
        const currentTime = this.player.getCurrentTime() || 0;
        const duration = this.player.getDuration() || 0;
        this.onTimeUpdateCallback?.(currentTime, duration);
      }
    }, 250);
  }

  public loadVideoById(videoId: string, startSeconds: number = 0) {
    if (this.player && this.isReady && typeof this.player.loadVideoById === 'function') {
      this.player.loadVideoById({
        videoId,
        startSeconds,
      });
    }
  }

  public play() {
    if (this.player && typeof this.player.playVideo === 'function') {
      this.player.playVideo();
    }
  }

  public pause() {
    if (this.player && typeof this.player.pauseVideo === 'function') {
      this.player.pauseVideo();
    }
  }

  public seekTo(seconds: number) {
    if (this.player && typeof this.player.seekTo === 'function') {
      this.player.seekTo(seconds, true);
    }
  }

  public getCurrentTime(): number {
    if (this.player && typeof this.player.getCurrentTime === 'function') {
      return this.player.getCurrentTime() || 0;
    }
    return 0;
  }

  public setVolume(volume0to1: number) {
    if (this.player && typeof this.player.setVolume === 'function') {
      const ytVol = Math.round(volume0to1 * 100);
      this.player.setVolume(ytVol);
    }
  }

  public setPlaybackRate(rate: number) {
    if (this.player && typeof this.player.setPlaybackRate === 'function') {
      this.player.setPlaybackRate(rate);
    }
  }

  public onStateChange(cb: YTStateChangeHandler) {
    this.onStateChangeCallback = cb;
  }

  public onTimeUpdate(cb: YTTimeUpdateHandler) {
    this.onTimeUpdateCallback = cb;
  }

  public onTrackEnded(cb: () => void) {
    this.onTrackEndedCallback = cb;
  }

  public destroy() {
    if (this.timePollInterval) clearInterval(this.timePollInterval);
    if (this.player && typeof this.player.destroy === 'function') {
      this.player.destroy();
    }
    this.isReady = false;
  }
}

export const globalYouTubeBridge = new YouTubeBridge();
