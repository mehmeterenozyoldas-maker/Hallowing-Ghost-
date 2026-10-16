// High-Fidelity Cinematic Spatial Audio Engine for Spectral Town Hall
// Ground-up redesign: Multi-layer FM synthesis, formant vowel resonators,
// procedural convolution reverb, and physical cloth Foley. Zero external audio assets required.

import { FormantVowel, ReverbEnvironmentPreset, AudioChannelLevels } from '../types';

export interface SoundFxCueOptions {
  x?: number;
  y?: number;
  z?: number;
  intensity?: number;
  pitch?: number;
  vowel?: FormantVowel;
}

export class SpatialAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;

  // Channel Sub-Busses
  private voiceGain: GainNode | null = null;
  private foleyGain: GainNode | null = null;
  private envGain: GainNode | null = null;
  private propGain: GainNode | null = null;
  private droneGain: GainNode | null = null;

  // Reverb System (Convolution Reverb)
  private convolver: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private reverbDryGain: GainNode | null = null;
  private currentReverbPreset: ReverbEnvironmentPreset = 'cathedral';
  private reverbDecaySec: number = 2.8;
  private reverbMixLevel: number = 0.42;

  // Settings
  public enabled: boolean = true;
  public masterVolume: number = 0.75;
  public channelVolumes: AudioChannelLevels = {
    master: 0.75,
    voices: 0.85,
    foley: 0.8,
    environment: 0.85,
    props: 0.8,
    drone: 0.65,
  };

  // Throttles to prevent audio pileups
  private lastFoleyTime: number = 0;
  private lastStretchTime: number = 0;
  private lastBounceTime: number = 0;
  private lastBumpTime: number = 0;

  // Continuous Cloth Foley Source
  private clothFoleySource: AudioBufferSourceNode | null = null;
  private clothFoleyGain: GainNode | null = null;
  private clothFoleyFilter: BiquadFilterNode | null = null;

  constructor() {
    // Lazily initialized on first user interaction
  }

  public initCtx(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return null;

      try {
        this.ctx = new AudioCtxClass();

        // 1. Master Output Chain with Dynamics Compressor (anti-clipping limiter)
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-4, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(8, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.18, this.ctx.currentTime);

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);

        this.masterAnalyser = this.ctx.createAnalyser();
        this.masterAnalyser.fftSize = 128;
        this.masterAnalyser.smoothingTimeConstant = 0.6;
        this.dataArray = new Uint8Array(this.masterAnalyser.frequencyBinCount);

        // Compressor -> Master Gain -> Analyser -> Speakers
        this.compressor.connect(this.masterGain);
        this.masterGain.connect(this.masterAnalyser);
        this.masterAnalyser.connect(this.ctx.destination);

        // 2. Convolution Reverb System
        this.convolver = this.ctx.createConvolver();
        this.reverbWetGain = this.ctx.createGain();
        this.reverbDryGain = this.ctx.createGain();

        this.reverbWetGain.gain.setValueAtTime(this.reverbMixLevel, this.ctx.currentTime);
        this.reverbDryGain.gain.setValueAtTime(1.0 - this.reverbMixLevel * 0.5, this.ctx.currentTime);

        this.convolver.connect(this.reverbWetGain);
        this.reverbWetGain.connect(this.compressor);
        this.reverbDryGain.connect(this.compressor);

        // Generate initial impulse response
        this.generateImpulseResponse(this.currentReverbPreset, this.reverbDecaySec);

        // 3. Sub-Busses
        this.voiceGain = this.ctx.createGain();
        this.voiceGain.gain.setValueAtTime(this.channelVolumes.voices, this.ctx.currentTime);
        this.connectBus(this.voiceGain, true);

        this.foleyGain = this.ctx.createGain();
        this.foleyGain.gain.setValueAtTime(this.channelVolumes.foley, this.ctx.currentTime);
        this.connectBus(this.foleyGain, true);

        this.envGain = this.ctx.createGain();
        this.envGain.gain.setValueAtTime(this.channelVolumes.environment, this.ctx.currentTime);
        this.connectBus(this.envGain, true);

        this.propGain = this.ctx.createGain();
        this.propGain.gain.setValueAtTime(this.channelVolumes.props, this.ctx.currentTime);
        this.connectBus(this.propGain, true);

        this.droneGain = this.ctx.createGain();
        this.droneGain.gain.setValueAtTime(this.channelVolumes.drone, this.ctx.currentTime);
        this.connectBus(this.droneGain, true);

        this.initContinuousClothLoop();
      } catch {
        return null;
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private connectBus(bus: GainNode, sendToReverb: boolean): void {
    if (!this.reverbDryGain || !this.convolver) return;
    bus.connect(this.reverbDryGain);
    if (sendToReverb) {
      bus.connect(this.convolver);
    }
  }

  // Generate procedural algorithmic impulse response buffers for stone vaults & halls
  public generateImpulseResponse(preset: ReverbEnvironmentPreset, decaySec: number = 2.8): void {
    if (!this.ctx || !this.convolver) return;

    const sampleRate = this.ctx.sampleRate;
    const length = Math.max(0.5, Math.min(8.0, decaySec)) * sampleRate;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    // Preset acoustic characteristics
    let decayMultiplier = 3.5;
    let diffusion = 0.8;
    let highFreqCutoffFactor = 0.04;

    switch (preset) {
      case 'cathedral':
        decayMultiplier = 3.2; // Long lush stone vault
        diffusion = 0.95;
        highFreqCutoffFactor = 0.035;
        break;
      case 'crypt':
        decayMultiplier = 4.8; // Dense, heavy, damp stone tomb
        diffusion = 0.98;
        highFreqCutoffFactor = 0.02;
        break;
      case 'square':
        decayMultiplier = 5.8; // Open air, dispersed reflections
        diffusion = 0.65;
        highFreqCutoffFactor = 0.06;
        break;
      case 'void':
        decayMultiplier = 2.0; // Infinite spectral black hole
        diffusion = 0.99;
        highFreqCutoffFactor = 0.015;
        break;
    }

    // Early reflections table (milliseconds)
    const earlyReflections = [
      { t: 0.012, l: 0.7, r: 0.3 },
      { t: 0.024, l: 0.4, r: 0.65 },
      { t: 0.038, l: 0.5, r: 0.5 },
      { t: 0.056, l: 0.25, r: 0.4 },
      { t: 0.075, l: 0.35, r: 0.2 },
    ];

    for (let i = 0; i < length; i++) {
      const tNorm = i / length;
      // Exponential decay envelope
      const decay = Math.exp(-tNorm * decayMultiplier);
      // High-frequency absorption over distance
      const hfDamp = Math.exp(-tNorm / (highFreqCutoffFactor + 0.001));

      // Gaussian white noise with stereo decorrelation
      const noiseL = (Math.random() * 2 - 1) * decay * (0.4 + 0.6 * hfDamp);
      const noiseR = (Math.random() * 2 - 1) * decay * (0.4 + 0.6 * hfDamp);

      left[i] = noiseL * diffusion;
      right[i] = noiseR * diffusion;
    }

    // Add early discrete reflection spikes
    earlyReflections.forEach((er) => {
      const idx = Math.floor(er.t * sampleRate);
      if (idx < length) {
        left[idx] += er.l * 0.8;
        right[idx] += er.r * 0.8;
      }
    });

    this.convolver.buffer = impulse;
    this.currentReverbPreset = preset;
    this.reverbDecaySec = decaySec;
  }

  public setMasterVolume(val: number): void {
    this.masterVolume = Math.max(0, Math.min(1, val));
    this.channelVolumes.master = this.masterVolume;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  public setChannelVolume(channel: keyof AudioChannelLevels, val: number): void {
    const clamped = Math.max(0, Math.min(1.5, val));
    this.channelVolumes[channel] = clamped;
    const t = this.ctx ? this.ctx.currentTime : 0;

    switch (channel) {
      case 'master':
        this.setMasterVolume(clamped);
        break;
      case 'voices':
        if (this.voiceGain && this.ctx) this.voiceGain.gain.setTargetAtTime(clamped, t, 0.05);
        break;
      case 'foley':
        if (this.foleyGain && this.ctx) this.foleyGain.gain.setTargetAtTime(clamped, t, 0.05);
        break;
      case 'environment':
        if (this.envGain && this.ctx) this.envGain.gain.setTargetAtTime(clamped, t, 0.05);
        break;
      case 'props':
        if (this.propGain && this.ctx) this.propGain.gain.setTargetAtTime(clamped, t, 0.05);
        break;
      case 'drone':
        if (this.droneGain && this.ctx) this.droneGain.gain.setTargetAtTime(clamped, t, 0.05);
        break;
    }
  }

  public setReverbPreset(preset: ReverbEnvironmentPreset): void {
    this.currentReverbPreset = preset;
    this.generateImpulseResponse(preset, this.reverbDecaySec);
  }

  public setReverbDecay(decaySec: number): void {
    this.reverbDecaySec = Math.max(0.5, Math.min(7.0, decaySec));
    this.generateImpulseResponse(this.currentReverbPreset, this.reverbDecaySec);
  }

  public setReverbMix(wetLevel: number): void {
    this.reverbMixLevel = Math.max(0, Math.min(1, wetLevel));
    if (this.ctx && this.reverbWetGain && this.reverbDryGain) {
      const t = this.ctx.currentTime;
      this.reverbWetGain.gain.setTargetAtTime(this.reverbMixLevel, t, 0.05);
      this.reverbDryGain.gain.setTargetAtTime(1.0 - this.reverbMixLevel * 0.4, t, 0.05);
    }
  }

  public setEnabled(en: boolean): void {
    this.enabled = en;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(en ? this.masterVolume : 0, this.ctx.currentTime, 0.05);
    }
  }

  public updateListenerPosition(
    camX: number,
    camY: number,
    camZ: number,
    fwdX = 0,
    fwdY = 0,
    fwdZ = -1
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const listener = ctx.listener;
    const x = camX * 0.002;
    const y = camY * 0.002;
    const z = camZ * 0.002;

    if (listener.positionX) {
      listener.positionX.setTargetAtTime(x, ctx.currentTime, 0.05);
      listener.positionY.setTargetAtTime(y, ctx.currentTime, 0.05);
      listener.positionZ.setTargetAtTime(z, ctx.currentTime, 0.05);
      listener.forwardX.setTargetAtTime(fwdX, ctx.currentTime, 0.05);
      listener.forwardY.setTargetAtTime(fwdY, ctx.currentTime, 0.05);
      listener.forwardZ.setTargetAtTime(fwdZ, ctx.currentTime, 0.05);
    } else {
      listener.setPosition(x, y, z);
      listener.setOrientation(fwdX, fwdY, fwdZ, 0, 1, 0);
    }
  }

  private createPanner(xMm: number, yMm: number, zMm: number): PannerNode | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.0;
    panner.maxDistance = 30.0;
    panner.rolloffFactor = 1.1;

    const x = xMm * 0.002;
    const y = yMm * 0.002;
    const z = zMm * 0.002;

    if (panner.positionX) {
      panner.positionX.setValueAtTime(x, ctx.currentTime);
      panner.positionY.setValueAtTime(y, ctx.currentTime);
      panner.positionZ.setValueAtTime(z, ctx.currentTime);
    } else {
      panner.setPosition(x, y, z);
    }
    return panner;
  }

  // ============================================================================
  // 1. GHOST SPECTRAL VOICES & FORMANT WAILS (Multi-operator FM + Vowel Formants)
  // ============================================================================
  public playSpectralVoice(
    vowel: FormantVowel = 'o',
    pitchHz: number = 220,
    intensity: number = 1.0,
    xMm: number = 0,
    yMm: number = 220,
    zMm: number = 0,
    flutterHz: number = 6.2
  ): void {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx || !this.voiceGain) return;

    const panner = this.createPanner(xMm, yMm, zMm);
    const dest = panner || this.voiceGain;
    if (panner) panner.connect(this.voiceGain);

    const t = ctx.currentTime;
    const duration = 1.4 + intensity * 0.6;

    // Multi-operator FM synthesis: Carrier (Saw/Sine) modulated by Modulator
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();

    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(pitchHz, t);
    // Subtle upward spectral bend on initiation, slow ghostly droop on release
    carrier.frequency.exponentialRampToValueAtTime(pitchHz * 1.12, t + 0.3);
    carrier.frequency.exponentialRampToValueAtTime(pitchHz * 0.88, t + duration);

    // Modulator for eerie vibrato flutter
    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(flutterHz, t);
    modGain.gain.setValueAtTime(pitchHz * 0.28, t);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    // Formant filter bank (F1, F2, F3) for human spectral vowel resonance
    const formantTable: Record<FormantVowel, { f1: number; f2: number; f3: number }> = {
      a: { f1: 800, f2: 1200, f3: 2500 },
      e: { f1: 520, f2: 1850, f3: 2800 },
      i: { f1: 320, f2: 2250, f3: 3100 },
      o: { f1: 500, f2: 850, f3: 2350 },
      u: { f1: 340, f2: 740, f3: 2200 },
    };
    const formants = formantTable[vowel] || formantTable.o;

    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.setValueAtTime(formants.f1, t);
    f1.Q.setValueAtTime(6.0, t);

    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.setValueAtTime(formants.f2, t);
    f2.Q.setValueAtTime(7.5, t);

    const f3 = ctx.createBiquadFilter();
    f3.type = 'bandpass';
    f3.frequency.setValueAtTime(formants.f3, t);
    f3.Q.setValueAtTime(8.0, t);

    const f1Gain = ctx.createGain();
    const f2Gain = ctx.createGain();
    const f3Gain = ctx.createGain();
    f1Gain.gain.setValueAtTime(0.5, t);
    f2Gain.gain.setValueAtTime(0.35, t);
    f3Gain.gain.setValueAtTime(0.2, t);

    carrier.connect(f1);
    carrier.connect(f2);
    carrier.connect(f3);

    f1.connect(f1Gain);
    f2.connect(f2Gain);
    f3.connect(f3Gain);

    const voiceMix = ctx.createGain();
    voiceMix.gain.setValueAtTime(0.001, t);
    voiceMix.gain.linearRampToValueAtTime(0.35 * Math.min(1.5, intensity), t + 0.25);
    voiceMix.gain.exponentialRampToValueAtTime(0.001, t + duration);

    f1Gain.connect(voiceMix);
    f2Gain.connect(voiceMix);
    f3Gain.connect(voiceMix);
    voiceMix.connect(dest);

    carrier.start(t);
    modulator.start(t);
    carrier.stop(t + duration);
    modulator.stop(t + duration);
  }

  // Ghost Stretch Chime: Harmonically rich crystalline whistle
  public playGhostStretch(xMm: number, yMm: number, zMm: number, strain: number = 0.5): void {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastStretchTime < 80) return;
    this.lastStretchTime = now;

    const vowels: FormantVowel[] = ['e', 'i', 'o', 'u'];
    const selectedVowel = vowels[Math.floor(Math.min(vowels.length - 1, strain * vowels.length))];
    const pitch = 280 + Math.min(2.0, strain) * 340;
    this.playSpectralVoice(selectedVowel, pitch, Math.min(1.4, strain + 0.4), xMm, yMm, zMm, 7.5);
  }

  // ============================================================================
  // 2. PHYSICAL CLOTH FOLEY & AERODYNAMIC WHOOSH
  // ============================================================================
  private initContinuousClothLoop(): void {
    if (!this.ctx || !this.foleyGain) return;
    try {
      // Pink/Brown noise continuous loop generator for aerodynamic fabric rustle
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2 + white * 0.5362) * 0.1;
      }

      this.clothFoleySource = this.ctx.createBufferSource();
      this.clothFoleySource.buffer = buffer;
      this.clothFoleySource.loop = true;

      this.clothFoleyFilter = this.ctx.createBiquadFilter();
      this.clothFoleyFilter.type = 'bandpass';
      this.clothFoleyFilter.frequency.setValueAtTime(650, this.ctx.currentTime);
      this.clothFoleyFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

      this.clothFoleyGain = this.ctx.createGain();
      this.clothFoleyGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

      this.clothFoleySource.connect(this.clothFoleyFilter);
      this.clothFoleyFilter.connect(this.clothFoleyGain);
      this.clothFoleyGain.connect(this.foleyGain);

      this.clothFoleySource.start();
    } catch {
      // Non-critical
    }
  }

  public updateClothMotion(speedMmPerSec: number, strain: number = 0.3): void {
    if (!this.enabled || !this.ctx || !this.clothFoleyGain || !this.clothFoleyFilter) return;
    const normalizedSpeed = Math.min(1.0, speedMmPerSec / 1200);
    const targetGain = Math.max(0.001, normalizedSpeed * 0.28 * (strain + 0.7));
    const targetCutoff = 450 + normalizedSpeed * 1800;

    const t = this.ctx.currentTime;
    this.clothFoleyGain.gain.setTargetAtTime(targetGain, t, 0.04);
    this.clothFoleyFilter.frequency.setTargetAtTime(targetCutoff, t, 0.05);
  }

  public playClothRustle(velocity: number = 200, tension: number = 0.5): void {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastFoleyTime < 90) return;
    this.lastFoleyTime = now;

    const ctx = this.initCtx();
    if (!ctx || !this.foleyGain) return;

    const t = ctx.currentTime;
    const duration = 0.35;
    const normVel = Math.min(1.5, Math.max(0.2, velocity / 300));

    // Multi-band filtered fabric whoosh
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(550 + tension * 400, t);
    filter.frequency.exponentialRampToValueAtTime(1400 * normVel, t + duration * 0.5);
    filter.Q.setValueAtTime(2.8, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.25 * normVel, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.foleyGain);

    noise.start(t);
    noise.stop(t + duration);
  }

  // Aerodynamic Doppler Flight Swoop
  public playGhostWhoosh(
    xMm: number = 0,
    yMm: number = 200,
    zMm: number = 0,
    speed: number = 1.0
  ): void {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx || !this.foleyGain) return;

    const panner = this.createPanner(xMm, yMm, zMm);
    const dest = panner || this.foleyGain;
    if (panner) panner.connect(this.foleyGain);

    const t = ctx.currentTime;
    const clampedSpeed = Math.max(0.4, Math.min(3.0, speed));
    const duration = Math.max(0.35, 0.85 / clampedSpeed);

    // Multi-frequency aerodynamic wind body + sub rush
    const osc = ctx.createOscillator();
    const oscSub = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    oscSub.type = 'sine';

    osc.frequency.setValueAtTime(110 * clampedSpeed, t);
    osc.frequency.exponentialRampToValueAtTime(360 * clampedSpeed, t + duration * 0.4);
    osc.frequency.exponentialRampToValueAtTime(80, t + duration);

    oscSub.frequency.setValueAtTime(55 * clampedSpeed, t);
    oscSub.frequency.exponentialRampToValueAtTime(160 * clampedSpeed, t + duration * 0.4);
    oscSub.frequency.exponentialRampToValueAtTime(40, t + duration);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(280, t);
    filter.frequency.linearRampToValueAtTime(620 * clampedSpeed, t + duration * 0.4);
    filter.Q.setValueAtTime(2.2, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.32, t + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    oscSub.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(t);
    oscSub.start(t);
    osc.stop(t + duration);
    oscSub.stop(t + duration);
  }

  // ============================================================================
  // 3. CINEMATIC THUNDER & LIGHTNING (Deep Sub-bass + Electrostatic Snap)
  // ============================================================================
  public playLightningStrike(xMm: number = 0, yMm: number = 450, zMm: number = -100): void {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx || !this.envGain) return;

    const panner = this.createPanner(xMm, yMm, zMm);
    const dest = panner || this.envGain;
    if (panner) panner.connect(this.envGain);

    const t = ctx.currentTime;
    const snapDuration = 0.16;

    // 1. High-frequency electrostatic whip snap
    const bufferSize = Math.floor(ctx.sampleRate * snapDuration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.025));
    }
    const snapNoise = ctx.createBufferSource();
    snapNoise.buffer = buffer;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(1400, t);

    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.85, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + snapDuration);

    snapNoise.connect(highpass);
    highpass.connect(snapGain);
    snapGain.connect(dest);
    snapNoise.start(t);
    snapNoise.stop(t + snapDuration);

    // 2. Plasma arc FM discharge
    const arcOsc = ctx.createOscillator();
    const arcGain = ctx.createGain();
    arcOsc.type = 'sawtooth';
    arcOsc.frequency.setValueAtTime(950, t);
    arcOsc.frequency.exponentialRampToValueAtTime(120, t + 0.12);

    arcGain.gain.setValueAtTime(0.4, t);
    arcGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    arcOsc.connect(arcGain);
    arcGain.connect(dest);
    arcOsc.start(t);
    arcOsc.stop(t + 0.12);

    // Follow immediately with deep rolling spatial thunder
    setTimeout(() => {
      this.playThunder(1.4, xMm, yMm - 40, zMm);
    }, 110);
  }

  public playThunder(
    intensity: number = 1.0,
    xMm: number = 0,
    yMm: number = 400,
    zMm: number = -200
  ): void {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx || !this.envGain) return;

    const panner = this.createPanner(xMm, yMm, zMm);
    const dest = panner || this.envGain;
    if (panner) panner.connect(this.envGain);

    const t = ctx.currentTime;
    const duration = 3.2;
    const clampedInt = Math.max(0.3, Math.min(2.0, intensity));

    // A. Sub-bass Earthquake Shockwave (32Hz -> 18Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(46, t);
    subOsc.frequency.exponentialRampToValueAtTime(20, t + duration * 0.85);

    subGain.gain.setValueAtTime(0.001, t);
    subGain.gain.linearRampToValueAtTime(0.55 * clampedInt, t + 0.12);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    subOsc.connect(subGain);
    subGain.connect(dest);
    subOsc.start(t);
    subOsc.stop(t + duration);

    // B. Multi-layer Brownian Atmospheric Cavern Roar
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.025 * white) / 1.025;
      data[i] = lastOut * 4.2;
    }

    const roar = ctx.createBufferSource();
    roar.buffer = buffer;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(240, t);
    lowpass.frequency.exponentialRampToValueAtTime(55, t + duration);

    const roarGain = ctx.createGain();
    roarGain.gain.setValueAtTime(0.001, t);
    roarGain.gain.linearRampToValueAtTime(0.6 * clampedInt, t + 0.08);
    roarGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    roar.connect(lowpass);
    lowpass.connect(roarGain);
    roarGain.connect(dest);
    roar.start(t);
    roar.stop(t + duration);
  }

  // ============================================================================
  // 4. PHYSICAL ACOUSTIC PROPS & SUBTERRANEAN BOUNCES
  // ============================================================================
  public playFloorBounce(xMm: number, yMm: number, zMm: number, velocity: number = 100): void {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastBounceTime < 140) return;
    this.lastBounceTime = now;

    const ctx = this.initCtx();
    if (!ctx || !this.propGain) return;

    const panner = this.createPanner(xMm, yMm, zMm);
    const dest = panner || this.propGain;
    if (panner) panner.connect(this.propGain);

    const t = ctx.currentTime;
    const intensity = Math.min(1.2, Math.max(0.25, velocity / 240));
    const duration = 0.45;

    // Sub-harmonic resonant cobblestone thump
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(82, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + duration * 0.7);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.5 * intensity, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + duration);
  }

  public playPropBump(
    xMm: number,
    yMm: number,
    zMm: number,
    type: 'pumpkin' | 'candle' | 'stone' = 'pumpkin'
  ): void {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastBumpTime < 70) return;
    this.lastBumpTime = now;

    const ctx = this.initCtx();
    if (!ctx || !this.propGain) return;

    const panner = this.createPanner(xMm, yMm, zMm);
    const dest = panner || this.propGain;
    if (panner) panner.connect(this.propGain);

    const t = ctx.currentTime;

    if (type === 'pumpkin') {
      // Hollow organic gourd knock with woody body resonance
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const duration = 0.22;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(210, t);
      osc.frequency.exponentialRampToValueAtTime(68, t + duration);

      gain.gain.setValueAtTime(0.42, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + duration);
    } else if (type === 'candle') {
      // Crystalline glass/brass bell chime with dual overtone partials
      const partials = [880, 1760, 2640];
      const duration = 0.65;

      partials.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        const vol = (0.22 / (idx + 1));
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration / (idx + 1));

        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + duration);
      });
    } else {
      // Ancient crypt masonry stone clack
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const duration = 0.14;

      osc.type = 'square';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + duration);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + duration);
    }
  }

  // Ethereal Candle Flame Gust / Whoosh
  public playCandleWhoosh(xMm: number, yMm: number, zMm: number): void {
    this.playPropBump(xMm, yMm, zMm, 'candle');
  }

  // ============================================================================
  // 5. GOTHIC CHURCH ORGAN & MIDNIGHT CLOCK BELL
  // ============================================================================
  public playOrganStab(chordIndex: number = 0): void {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx || !this.droneGain) return;

    const t = ctx.currentTime;
    const duration = 2.2;

    // Authentic Gothic Cathedral Harmonies (Dm9, Gm6, Adim7, F#dim)
    const chords = [
      [73.42, 146.83, 220.0, 261.63, 329.63], // D2, D3, A3, C4, E4 (Dm9)
      [98.0, 196.0, 246.94, 293.66, 370.0],   // G2, G3, B3, D4, F#4 (Gmaj7)
      [110.0, 220.0, 261.63, 311.13, 440.0],  // A2, A3, C4, Eb4, A4 (Adim7)
    ];
    const notes = chords[Math.abs(chordIndex) % chords.length];

    notes.forEach((freq, idx) => {
      // 8' & 4' organ rank blend
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const oscGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, t);
      osc2.frequency.setValueAtTime(freq * 2.002, t); // Slight chorus detune

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, t);
      filter.frequency.exponentialRampToValueAtTime(480, t + duration);

      oscGain.gain.setValueAtTime(0.001, t);
      oscGain.gain.linearRampToValueAtTime(0.18 / notes.length, t + 0.06);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(this.droneGain!);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + duration);
      osc2.stop(t + duration);
    });
  }

  // Midnight Town Hall Tower Bronze Bell Toll
  public playClockBellToll(xMm: number = 0, yMm: number = 480, zMm: number = -150): void {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx || !this.droneGain) return;

    const panner = this.createPanner(xMm, yMm, zMm);
    const dest = panner || this.droneGain;
    if (panner) panner.connect(this.droneGain);

    const t = ctx.currentTime;
    const duration = 4.5;

    // Authentic bronze bell partials (Strike note D4 = 293.7Hz, Hum, Prime, Tierce, Quint)
    const bellPartials = [
      { freq: 146.8, gain: 0.35, decay: 4.5 }, // Hum tone (octave below)
      { freq: 293.7, gain: 0.5, decay: 3.5 },  // Prime / Strike note
      { freq: 349.2, gain: 0.3, decay: 2.8 },  // Tierce (minor 3rd)
      { freq: 440.0, gain: 0.25, decay: 2.2 }, // Quint (5th)
      { freq: 587.3, gain: 0.2, decay: 1.5 },  // Nominal (octave above)
    ];

    bellPartials.forEach((partial) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(partial.freq, t);

      gain.gain.setValueAtTime(partial.gain * 0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + partial.decay);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + partial.decay);
    });
  }

  // Creaking Historic Wooden Crypt Door
  public playCryptDoorCreak(xMm: number = -120, yMm: number = 80, zMm: number = 100): void {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx || !this.propGain) return;

    const panner = this.createPanner(xMm, yMm, zMm);
    const dest = panner || this.propGain;
    if (panner) panner.connect(this.propGain);

    const t = ctx.currentTime;
    const duration = 1.1;

    // FM stick-slip friction squeal
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const outGain = ctx.createGain();

    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(320, t);
    carrier.frequency.linearRampToValueAtTime(540, t + 0.6);
    carrier.frequency.linearRampToValueAtTime(260, t + duration);

    mod.type = 'square';
    mod.frequency.setValueAtTime(14, t); // Flutter friction rate
    modGain.gain.setValueAtTime(180, t);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);

    outGain.gain.setValueAtTime(0.001, t);
    outGain.gain.linearRampToValueAtTime(0.26, t + 0.1);
    outGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    carrier.connect(outGain);
    outGain.connect(dest);

    carrier.start(t);
    mod.start(t);
    carrier.stop(t + duration);
    mod.stop(t + duration);
  }

  // Deep Sub-bass Abyss Drone Pulse
  public playAbyssPulse(): void {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx || !this.droneGain) return;

    const t = ctx.currentTime;
    const duration = 3.5;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(36, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + duration);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.6, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.droneGain);
    osc.start(t);
    osc.stop(t + duration);
  }

  // Real-time Master Level Meter reading (for UI VU meters)
  public getMasterLevel(): number {
    if (!this.masterAnalyser || !this.dataArray || !this.enabled) return 0;
    this.masterAnalyser.getByteFrequencyData(this.dataArray as unknown as Uint8Array<ArrayBuffer>);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const avg = sum / this.dataArray.length;
    return Math.min(1.0, avg / 140);
  }
}

export const spatialAudio = new SpatialAudioEngine();
