/**
 * Ambient Focus Soundscape Engine
 * Pure synthesized Web Audio API soundscapes (zero assets, zero network requests, offline-ready).
 * Provides Brown Noise, Soft Rain, and 10Hz Alpha Binaural Beats for deep focus.
 */

export type SoundscapeType = 'off' | 'brown' | 'rain' | 'binaural';

class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentSourceNodes: (AudioNode | { stop: () => void; disconnect: () => void })[] = [];
  private activeType: SoundscapeType = 'off';
  private volume: number = 0.5;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private initMasterGain(ctx: AudioContext): GainNode {
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, ctx.currentTime);
      this.masterGain.connect(ctx.destination);
    }
    return this.masterGain;
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.1);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getActiveType(): SoundscapeType {
    return this.activeType;
  }

  public stop() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(0, now + 0.2);
    }
    setTimeout(() => {
      this.currentSourceNodes.forEach((node) => {
        try {
          if ('stop' in node && typeof node.stop === 'function') node.stop();
          if ('disconnect' in node && typeof node.disconnect === 'function') node.disconnect();
        } catch {
          // ignore already stopped
        }
      });
      this.currentSourceNodes = [];
      this.activeType = 'off';
    }, 250);
  }

  public async play(type: SoundscapeType, volume: number = this.volume) {
    this.volume = volume;
    if (type === 'off') {
      this.stop();
      return;
    }

    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Stop current active nodes
    this.currentSourceNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof node.stop === 'function') node.stop();
        if ('disconnect' in node && typeof node.disconnect === 'function') node.disconnect();
      } catch {
        // ignore
      }
    });
    this.currentSourceNodes = [];

    const master = this.initMasterGain(ctx);
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 0.4);

    if (type === 'brown') {
      this.startBrownNoise(ctx, master);
    } else if (type === 'rain') {
      this.startSoftRain(ctx, master);
    } else if (type === 'binaural') {
      this.startBinauralBeats(ctx, master);
    }

    this.activeType = type;
  }

  /**
   * Brown Noise (1/f^2)
   * Deep, warm rumble ideal for thought masking and continuous flow state.
   */
  private startBrownNoise(ctx: AudioContext, destination: AudioNode) {
    const bufferSize = 5 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      output[i] = lastOut * 3.5; // Gain compensation
    }

    const whiteSource = ctx.createBufferSource();
    whiteSource.buffer = buffer;
    whiteSource.loop = true;

    // Filter to eliminate high-end hiss and keep warm rumble
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, ctx.currentTime);

    whiteSource.connect(filter);
    filter.connect(destination);

    whiteSource.start();
    this.currentSourceNodes.push(whiteSource, filter);
  }

  /**
   * Soft Rain Soundscape
   * Pink noise filtered through gentle bandpass + soft randomized modulations.
   */
  private startSoftRain(ctx: AudioContext, destination: AudioNode) {
    const bufferSize = 5 * ctx.sampleRate;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

    // Generate Pink Noise (Paul Kellet's filter method)
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    // Rain highpass (remove unnatural low boom)
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(400, ctx.currentTime);

    // Rain lowpass (soften spray)
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(1400, ctx.currentTime);

    noiseSource.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(destination);

    noiseSource.start();
    this.currentSourceNodes.push(noiseSource, highpass, lowpass);
  }

  /**
   * 10Hz Alpha Binaural Beats
   * Left: 200 Hz, Right: 210 Hz.
   * Encourages relaxed, alert focus through auditory beat stimulation.
   */
  private startBinauralBeats(ctx: AudioContext, destination: AudioNode) {
    const baseFreq = 200; // Left ear
    const beatFreq = 10;  // 10 Hz Alpha
    const rightFreq = baseFreq + beatFreq; // Right ear

    const oscL = ctx.createOscillator();
    oscL.type = 'sine';
    oscL.frequency.setValueAtTime(baseFreq, ctx.currentTime);

    const oscR = ctx.createOscillator();
    oscR.type = 'sine';
    oscR.frequency.setValueAtTime(rightFreq, ctx.currentTime);

    // Channel merger for true stereo separation
    const merger = ctx.createChannelMerger(2);
    const gainL = ctx.createGain();
    const gainR = ctx.createGain();
    gainL.gain.setValueAtTime(0.4, ctx.currentTime);
    gainR.gain.setValueAtTime(0.4, ctx.currentTime);

    oscL.connect(gainL);
    gainL.connect(merger, 0, 0); // Left channel

    oscR.connect(gainR);
    gainR.connect(merger, 0, 1); // Right channel

    merger.connect(destination);

    oscL.start();
    oscR.start();

    this.currentSourceNodes.push(oscL, oscR, gainL, gainR, merger);
  }
}

export const soundscape = new SoundscapeEngine();
