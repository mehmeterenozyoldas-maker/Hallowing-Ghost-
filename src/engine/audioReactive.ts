export interface AudioMetrics {
  volume: number;
  bass: number;
  high: number;
  energy: number;
}

export class AudioReactiveEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private freqData: Uint8Array | null = null;

  // Synthetic ambient civic sound generator (organ drone + church bell resonance + wind)
  private synthGain: GainNode | null = null;
  private oscDrone1: OscillatorNode | null = null;
  private oscDrone2: OscillatorNode | null = null;
  private lfoFilter: BiquadFilterNode | null = null;
  private lfoOsc: OscillatorNode | null = null;

  public isEnabled = false;
  public mode: 'mic' | 'synthetic' = 'synthetic';
  public hasMicPermission = false;

  public async init(): Promise<void> {
    if (this.audioCtx) return;
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new AudioCtxClass();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

    this.setupSyntheticGenerator();
  }

  private setupSyntheticGenerator(): void {
    if (!this.audioCtx || !this.analyser) return;

    try {
      this.synthGain = this.audioCtx.createGain();
      this.synthGain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);

      this.lfoFilter = this.audioCtx.createBiquadFilter();
      this.lfoFilter.type = 'lowpass';
      this.lfoFilter.frequency.setValueAtTime(320, this.audioCtx.currentTime);
      this.lfoFilter.Q.setValueAtTime(3.0, this.audioCtx.currentTime);

      // Low organ drone (C2 = 65.4 Hz, G2 = 98.0 Hz)
      this.oscDrone1 = this.audioCtx.createOscillator();
      this.oscDrone1.type = 'sawtooth';
      this.oscDrone1.frequency.setValueAtTime(65.4, this.audioCtx.currentTime);

      this.oscDrone2 = this.audioCtx.createOscillator();
      this.oscDrone2.type = 'sine';
      this.oscDrone2.frequency.setValueAtTime(98.0, this.audioCtx.currentTime);

      // LFO for breathing wind movement
      this.lfoOsc = this.audioCtx.createOscillator();
      this.lfoOsc.type = 'sine';
      this.lfoOsc.frequency.setValueAtTime(0.18, this.audioCtx.currentTime);

      const lfoDepth = this.audioCtx.createGain();
      lfoDepth.gain.setValueAtTime(140, this.audioCtx.currentTime);
      this.lfoOsc.connect(lfoDepth);
      lfoDepth.connect(this.lfoFilter.frequency);

      this.oscDrone1.connect(this.lfoFilter);
      this.oscDrone2.connect(this.lfoFilter);
      this.lfoFilter.connect(this.synthGain);

      // Connect to analyser for visual FFT calculations
      this.synthGain.connect(this.analyser);
      // Optional subtle audio destination output
      this.synthGain.connect(this.audioCtx.destination);

      this.oscDrone1.start();
      this.oscDrone2.start();
      this.lfoOsc.start();
    } catch {
      // Audio context might require user gesture
    }
  }

  public async enableMic(): Promise<boolean> {
    await this.init();
    if (!this.audioCtx || !this.analyser) return false;

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    try {
      if (this.micStream) {
        this.micStream.getTracks().forEach((t) => t.stop());
      }

      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.micSource = this.audioCtx.createMediaStreamSource(this.micStream);
      this.micSource.connect(this.analyser);

      // Mute synthetic generator when mic is active
      if (this.synthGain) {
        this.synthGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
      }

      this.mode = 'mic';
      this.isEnabled = true;
      this.hasMicPermission = true;
      return true;
    } catch {
      // Microphone not permitted or unavailable; fallback to synthetic ambient engine
      this.fallbackToSynthetic();
      return false;
    }
  }

  public enableSynthetic(): void {
    this.init().then(() => {
      if (this.audioCtx?.state === 'suspended') {
        this.audioCtx.resume();
      }
      if (this.micSource) {
        this.micSource.disconnect();
        this.micSource = null;
      }
      if (this.micStream) {
        this.micStream.getTracks().forEach((t) => t.stop());
        this.micStream = null;
      }
      if (this.synthGain && this.audioCtx) {
        this.synthGain.gain.setValueAtTime(0.045, this.audioCtx.currentTime);
      }
      this.mode = 'synthetic';
      this.isEnabled = true;
    });
  }

  public fallbackToSynthetic(): void {
    this.enableSynthetic();
  }

  public toggle(): void {
    if (!this.isEnabled) {
      if (this.hasMicPermission) {
        this.enableMic();
      } else {
        this.enableSynthetic();
      }
    } else {
      this.disable();
    }
  }

  public disable(): void {
    if (this.synthGain && this.audioCtx) {
      this.synthGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    this.isEnabled = false;
  }

  public getMetrics(): AudioMetrics {
    if (!this.isEnabled || !this.analyser || !this.freqData) {
      return { volume: 0, bass: 0, high: 0, energy: 0 };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.analyser as any).getByteFrequencyData(this.freqData);

    const length = this.freqData.length;
    let sum = 0;
    let bassSum = 0;
    let highSum = 0;

    const bassEnd = Math.floor(length * 0.15);
    const highStart = Math.floor(length * 0.55);

    for (let i = 0; i < length; i++) {
      const v = this.freqData[i] / 255;
      sum += v;
      if (i < bassEnd) bassSum += v;
      if (i > highStart) highSum += v;
    }

    const volume = Math.min(1, (sum / length) * 2.2);
    const bass = Math.min(1, (bassSum / (bassEnd || 1)) * 2.5);
    const high = Math.min(1, (highSum / (length - highStart || 1)) * 2.8);
    const energy = Math.max(0, bass * 0.6 + volume * 0.4);

    return { volume, bass, high, energy };
  }
}
