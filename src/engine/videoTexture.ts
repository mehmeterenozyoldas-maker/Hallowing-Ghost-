import * as THREE from 'three';

export type VideoSourceType = 'webcam' | 'mist_loop' | 'banshee_loop' | 'shadow_loop' | 'custom';

export interface VideoProjectionConfig {
  enabled: boolean;
  source: VideoSourceType;
  blendMode: number; // 0: Luma Ghost Key, 1: Sobel Edge Luminescence, 2: Slit-Scan Distortion, 3: Ectoplasmic Overlay
  threshold: number; // 0.0 - 1.0
  chromaKey: number; // 0.0 - 1.0
  exposure: number;  // 0.5 - 3.0
  corners: [number, number, number, number, number, number, number, number]; // [TL, TR, BR, BL] normalized (0-1)
}

export const DEFAULT_PROJECTION_CONFIG: VideoProjectionConfig = {
  enabled: false,
  source: 'mist_loop',
  blendMode: 0,
  threshold: 0.35,
  chromaKey: 0.15,
  exposure: 1.4,
  corners: [
    0.0, 0.0, // Top-Left
    1.0, 0.0, // Top-Right
    1.0, 1.0, // Bottom-Right
    0.0, 1.0, // Bottom-Left
  ],
};

export class SpectralVideoPipeline {
  private videoElement: HTMLVideoElement | null = null;
  private mediaStream: MediaStream | null = null;
  private loopCanvas: HTMLCanvasElement;
  private loopCtx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private source: VideoSourceType = 'mist_loop';
  private customVideoUrl: string | null = null;
  private isPlaying: boolean = true;
  private time: number = 0;
  private lastError: string | null = null;
  private statusMessage: string = 'Initialized';

  constructor() {
    this.loopCanvas = document.createElement('canvas');
    this.loopCanvas.width = 512;
    this.loopCanvas.height = 512;
    const ctx = this.loopCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');
    this.loopCtx = ctx;

    this.texture = new THREE.CanvasTexture(this.loopCanvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.format = THREE.RGBAFormat;

    this.renderProceduralLoop('mist_loop', 0);
    this.texture.needsUpdate = true;
  }

  public getTexture(): THREE.CanvasTexture {
    return this.texture;
  }

  public getStatus(): string {
    return this.statusMessage;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public async setSource(sourceType: VideoSourceType, customFile?: File): Promise<void> {
    this.source = sourceType;
    this.lastError = null;

    // Clean up existing media stream or video element
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
      this.videoElement.load();
      this.videoElement = null;
    }
    if (this.customVideoUrl) {
      URL.revokeObjectURL(this.customVideoUrl);
      this.customVideoUrl = null;
    }

    if (sourceType === 'webcam') {
      this.statusMessage = 'Requesting camera access...';
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access not supported by browser');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: false,
        });
        this.mediaStream = stream;

        const video = document.createElement('video');
        video.playsInline = true;
        video.muted = true;
        video.autoplay = true;
        video.srcObject = stream;
        await video.play();

        this.videoElement = video;
        this.statusMessage = 'Webcam active (640x480)';
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Webcam permission denied';
        this.lastError = msg;
        this.statusMessage = 'Camera unavailable: Falling back to Ectoplasm Mist';
        this.source = 'mist_loop';
      }
    } else if (sourceType === 'custom' && customFile) {
      try {
        this.customVideoUrl = URL.createObjectURL(customFile);
        const video = document.createElement('video');
        video.playsInline = true;
        video.muted = true;
        video.loop = true;
        video.src = this.customVideoUrl;
        await video.play();

        this.videoElement = video;
        this.statusMessage = `Custom video active (${customFile.name})`;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to play video file';
        this.lastError = msg;
        this.statusMessage = 'Video error: Falling back to Mist Loop';
        this.source = 'mist_loop';
      }
    } else {
      this.statusMessage = `Procedural loop active (${sourceType})`;
    }
  }

  public update(dt: number = 0.016): void {
    if (!this.isPlaying) return;
    this.time += dt;

    if (this.videoElement && this.videoElement.readyState >= 2) {
      // Draw live video frame onto our texture canvas
      this.loopCtx.drawImage(
        this.videoElement,
        0,
        0,
        this.loopCanvas.width,
        this.loopCanvas.height
      );
      this.texture.needsUpdate = true;
    } else {
      // Draw dynamic high-fps procedural eerie loop
      this.renderProceduralLoop(this.source, this.time);
      this.texture.needsUpdate = true;
    }
  }

  private renderProceduralLoop(loopType: VideoSourceType, t: number): void {
    const ctx = this.loopCtx;
    const w = this.loopCanvas.width;
    const h = this.loopCanvas.height;

    if (loopType === 'banshee_loop') {
      // Screaming banshee apparition with undulating mouth and glowing sockets
      ctx.fillStyle = '#040508';
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2 - 20;

      // Outer ethereal head mist aura
      const grad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 210);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.7)');
      grad.addColorStop(0.5, 'rgba(192, 132, 252, 0.35)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 210, 0, Math.PI * 2);
      ctx.fill();

      // Screaming elongated jaw
      const jawDrop = 35 + Math.sin(t * 3.5) * 18;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 65 + jawDrop * 0.4, 38, 48 + jawDrop, 0, 0, Math.PI * 2);
      ctx.fill();

      // Piercing eyes
      const eyeL = cx - 55 + Math.sin(t * 2.0) * 3;
      const eyeR = cx + 55 + Math.cos(t * 2.0) * 3;
      const eyeY = cy - 25;

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(eyeL, eyeY, 26, 36, -0.15, 0, Math.PI * 2);
      ctx.ellipse(eyeR, eyeY, 26, 36, 0.15, 0, Math.PI * 2);
      ctx.fill();

      // Glowing pupils radiating pulses
      const pupilGlow = 0.6 + Math.sin(t * 7.0) * 0.4;
      ctx.fillStyle = `rgba(224, 242, 254, ${pupilGlow})`;
      ctx.beginPath();
      ctx.arc(eyeL, eyeY, 12, 0, Math.PI * 2);
      ctx.arc(eyeR, eyeY, 12, 0, Math.PI * 2);
      ctx.fill();

      // Ectoplasmic tears streaming down
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.8)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(eyeL, eyeY + 20);
      ctx.bezierCurveTo(eyeL - 10, eyeY + 80, eyeL + 15, eyeY + 120, eyeL - 5, eyeY + 170);
      ctx.moveTo(eyeR, eyeY + 20);
      ctx.bezierCurveTo(eyeR + 10, eyeY + 80, eyeR - 15, eyeY + 120, eyeR + 5, eyeY + 170);
      ctx.stroke();
    } else if (loopType === 'shadow_loop') {
      // Creeping Victorian shadow figures floating across mist
      ctx.fillStyle = '#020306';
      ctx.fillRect(0, 0, w, h);

      for (let s = 0; s < 4; s++) {
        const speed = 0.4 + s * 0.25;
        const posX = ((t * speed * 80 + s * 140) % (w + 120)) - 60;
        const posY = h / 2 + Math.sin(t * 1.5 + s) * 40;
        const shadowGrad = ctx.createRadialGradient(posX, posY, 10, posX, posY, 90);
        shadowGrad.addColorStop(0, 'rgba(168, 85, 247, 0.75)');
        shadowGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.25)');
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(posX, posY, 55, 110, 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Default: Swirling Ectoplasmic Mist Maiden
      ctx.fillStyle = '#030509';
      ctx.fillRect(0, 0, w, h);

      // 5 harmonic swirling mist vortices
      for (let i = 0; i < 5; i++) {
        const angle = t * (0.8 + i * 0.2) + (i * Math.PI) / 2.5;
        const radius = 60 + Math.sin(t * 1.4 + i) * 45;
        const cx = w / 2 + Math.cos(angle) * radius;
        const cy = h / 2 + Math.sin(angle) * (radius * 0.8);

        const mistGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 140);
        mistGrad.addColorStop(0, 'rgba(45, 212, 191, 0.65)');
        mistGrad.addColorStop(0.5, 'rgba(129, 140, 248, 0.3)');
        mistGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = mistGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, 140, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bioluminescent floating spark embers
      for (let k = 0; k < 12; k++) {
        const emberX = (Math.sin(k * 77 + t * 0.9) * 0.5 + 0.5) * w;
        const emberY = ((t * (25 + k * 8) + k * 80) % h);
        const emberSize = 2 + (k % 3) * 1.5;
        ctx.fillStyle = 'rgba(167, 243, 208, 0.85)';
        ctx.beginPath();
        ctx.arc(emberX, h - emberY, emberSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  public dispose(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
      this.videoElement = null;
    }
    if (this.customVideoUrl) {
      URL.revokeObjectURL(this.customVideoUrl);
      this.customVideoUrl = null;
    }
    this.texture.dispose();
  }
}
