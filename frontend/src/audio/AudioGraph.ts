/**
 * Web Audio API Dual-Deck DSP Graph with 10-Band Parametric EQ and AnalyserNode
 */

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export interface AudioDeck {
  audioElement: HTMLAudioElement;
  sourceNode: MediaElementAudioSourceNode;
  gainNode: GainNode;
}

export class AudioGraph {
  private ctx: AudioContext | null = null;
  private deckA: AudioDeck | null = null;
  private deckB: AudioDeck | null = null;
  private activeDeck: 'A' | 'B' = 'A';

  // DSP Nodes
  private preampGain: GainNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;

  private isInitialized = false;

  public init(): AudioContext {
    if (typeof window === 'undefined') {
      return {} as any;
    }

    if (this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      return {} as any;
    }
    this.ctx = new AudioContextClass();

    // Create Preamp Gain
    this.preampGain = this.ctx.createGain();
    this.preampGain.gain.value = 1.0;

    // Create 10-band cascaded Parametric Equalizer
    this.eqFilters = EQ_FREQUENCIES.map((freq, index) => {
      if (!this.ctx) throw new Error('AudioContext unavailable');
      const filter = this.ctx.createBiquadFilter();
      filter.frequency.value = freq;

      if (index === 0) {
        filter.type = 'lowshelf';
        filter.Q.value = 0.707;
      } else if (index === EQ_FREQUENCIES.length - 1) {
        filter.type = 'highshelf';
        filter.Q.value = 0.707;
      } else {
        filter.type = 'peaking';
        filter.Q.value = 1.414;
      }

      filter.gain.value = 0.0;
      return filter;
    });

    // Cascade EQ filters
    for (let i = 0; i < this.eqFilters.length - 1; i++) {
      this.eqFilters[i].connect(this.eqFilters[i + 1]);
    }

    // Create AnalyserNode (FFT size 256 for smooth 60fps rendering)
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.82;

    // Create Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;

    // Create Studio Mastering Limiter / Compressor to prevent clipping distortion on bass boosts
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1.0; // dB
    this.limiter.knee.value = 6.0;
    this.limiter.ratio.value = 12.0;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.15;

    // Wire DSP Chain:
    // Deck Gain -> Preamp -> Filter[0] ... Filter[9] -> MasterGain -> Limiter -> Analyser -> Destination
    this.preampGain.connect(this.eqFilters[0]);
    this.eqFilters[this.eqFilters.length - 1].connect(this.masterGain);
    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Initialize Decks
    this.deckA = this.createDeck();
    this.deckB = this.createDeck();

    // Route Decks to Preamp
    this.deckA.gainNode.connect(this.preampGain);
    this.deckB.gainNode.connect(this.preampGain);

    // Deck A active initially, Deck B muted
    this.deckA.gainNode.gain.value = 1.0;
    this.deckB.gainNode.gain.value = 0.0;

    if (typeof window !== 'undefined') {
      (window as any).__PULSE_AUDIO_DECKS__ = [this.deckA, this.deckB];
      (window as any).__PULSE_AUDIO_GRAPH__ = this;
    }

    this.isInitialized = true;
    return this.ctx;
  }

  private createDeck(): AudioDeck {
    if (!this.ctx) throw new Error('AudioContext required to create deck');
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';

    const source = this.ctx.createMediaElementSource(audio);
    const gain = this.ctx.createGain();
    source.connect(gain);

    return {
      audioElement: audio,
      sourceNode: source,
      gainNode: gain,
    };
  }

  public getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  public getActiveDeck(): AudioDeck {
    this.ensureInitialized();
    if (!this.deckA) {
      return {
        audioElement: { play: async () => {}, pause: () => {}, src: '', currentTime: 0 } as any,
        sourceNode: {} as any,
        gainNode: { gain: { setValueAtTime: () => {}, setTargetAtTime: () => {} } } as any,
      };
    }
    return this.activeDeck === 'A' ? this.deckA! : this.deckB!;
  }

  public getInactiveDeck(): AudioDeck {
    this.ensureInitialized();
    if (!this.deckB) {
      return {
        audioElement: { play: async () => {}, pause: () => {}, src: '', currentTime: 0 } as any,
        sourceNode: {} as any,
        gainNode: { gain: { setValueAtTime: () => {}, setTargetAtTime: () => {} } } as any,
      };
    }
    return this.activeDeck === 'A' ? this.deckB! : this.deckA!;
  }

  public swapDecks() {
    this.activeDeck = this.activeDeck === 'A' ? 'B' : 'A';
  }

  public resetDecks(preferredActiveDeck?: 'A' | 'B') {
    this.ensureInitialized();
    if (preferredActiveDeck) {
      this.activeDeck = preferredActiveDeck;
    }
    const active = this.getActiveDeck();
    const inactive = this.getInactiveDeck();

    if (this.ctx && this.ctx.currentTime !== undefined) {
      const now = this.ctx.currentTime;
      if (active.gainNode?.gain) {
        active.gainNode.gain.cancelScheduledValues(now);
        active.gainNode.gain.setValueAtTime(1.0, now);
      }
      if (inactive.gainNode?.gain) {
        inactive.gainNode.gain.cancelScheduledValues(now);
        inactive.gainNode.gain.setValueAtTime(0.0, now);
      }
    }

    try {
      inactive.audioElement.pause();
    } catch (e) {}
  }

  public setEQBandGain(bandIndex: number, gainDb: number) {
    this.ensureInitialized();
    if (bandIndex >= 0 && bandIndex < this.eqFilters.length) {
      const clamped = Math.max(-12, Math.min(12, gainDb));
      this.eqFilters[bandIndex].gain.setTargetAtTime(clamped, this.ctx!.currentTime, 0.02);
    }
  }

  public setEQGains(gains: number[]) {
    this.ensureInitialized();
    gains.forEach((gain, idx) => {
      this.setEQBandGain(idx, gain);
    });
  }

  public setPreampGain(preampDb: number) {
    this.ensureInitialized();
    if (this.preampGain && this.ctx) {
      const linear = Math.pow(10, preampDb / 20);
      this.preampGain.gain.setTargetAtTime(linear, this.ctx.currentTime, 0.02);
    }
  }

  public setMasterVolume(volume: number) {
    this.ensureInitialized();
    if (this.masterGain && this.ctx) {
      const clamped = Math.max(0, Math.min(1, volume));
      this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.02);
    }
  }

  public getByteFrequencyData(outputArray: Uint8Array): void {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(outputArray);
    }
  }

  public getByteTimeDomainData(outputArray: Uint8Array): void {
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(outputArray);
    }
  }

  public getFrequencyBinCount(): number {
    return this.analyser ? this.analyser.frequencyBinCount : 128;
  }

  private ensureInitialized() {
    if (!this.isInitialized) {
      this.init();
    }
  }
}

export const globalAudioGraph = new AudioGraph();
