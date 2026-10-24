import { AudioDeck } from './AudioGraph';

export class Crossfader {
  private crossfadeDuration: number = 2.0; // Seconds (0 to 12)
  private isTransitioning: boolean = false;
  private activeTimeout: any = null;

  constructor(durationSeconds: number = 2.0) {
    this.setDuration(durationSeconds);
  }

  public setDuration(seconds: number) {
    this.crossfadeDuration = Math.max(0, Math.min(12, seconds));
  }

  public getDuration(): number {
    return this.crossfadeDuration;
  }

  public getIsTransitioning(): boolean {
    return this.isTransitioning;
  }

  public cancel(
    outgoingDeck?: AudioDeck,
    incomingDeck?: AudioDeck,
    audioContext?: AudioContext | null
  ): void {
    this.isTransitioning = false;
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = null;
    }

    if (audioContext && audioContext.currentTime !== undefined) {
      const now = audioContext.currentTime;
      if (outgoingDeck?.gainNode?.gain) {
        outgoingDeck.gainNode.gain.cancelScheduledValues(now);
        outgoingDeck.gainNode.gain.setValueAtTime(0, now);
        try {
          outgoingDeck.audioElement.pause();
        } catch (e) {}
      }
      if (incomingDeck?.gainNode?.gain) {
        incomingDeck.gainNode.gain.cancelScheduledValues(now);
        incomingDeck.gainNode.gain.setValueAtTime(1.0, now);
      }
    }
  }

  public async crossfade(
    outgoingDeck: AudioDeck,
    incomingDeck: AudioDeck,
    audioContext: AudioContext
  ): Promise<void> {
    this.cancel(outgoingDeck, incomingDeck, audioContext);

    if (this.crossfadeDuration === 0) {
      outgoingDeck.gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      incomingDeck.gainNode.gain.setValueAtTime(1, audioContext.currentTime);
      outgoingDeck.audioElement.pause();
      return;
    }

    this.isTransitioning = true;
    const now = audioContext.currentTime;
    const duration = this.crossfadeDuration;
    const steps = 30;
    const stepInterval = duration / steps;

    // Equal-power crossfade curve
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps; // 0 to 1
      const outGain = Math.cos((progress * Math.PI) / 2);
      const inGain = Math.sin((progress * Math.PI) / 2);

      const targetTime = now + i * stepInterval;
      outgoingDeck.gainNode.gain.setTargetAtTime(outGain, targetTime, 0.015);
      incomingDeck.gainNode.gain.setTargetAtTime(inGain, targetTime, 0.015);
    }

    return new Promise((resolve) => {
      this.activeTimeout = setTimeout(() => {
        this.activeTimeout = null;
        if (this.isTransitioning) {
          outgoingDeck.gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          incomingDeck.gainNode.gain.setValueAtTime(1, audioContext.currentTime);
          outgoingDeck.audioElement.pause();
          this.isTransitioning = false;
        }
        resolve();
      }, duration * 1000);
    });
  }
}
