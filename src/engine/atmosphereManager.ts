import * as THREE from 'three';
import { EnvironmentAtmosphere, LightningFrequency } from '../types';
import { spatialAudio } from './spatialAudio';

// Procedural ground fog GLSL shader
const FOG_VS = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FOG_FS = `
  uniform float uTime;
  uniform float uDensity;
  uniform float uHeight;
  uniform float uLightningFlash;
  uniform vec3 uGhostPos;
  uniform vec3 uFogColor;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  // Simple procedural 2D noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
               mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = rot * p * 2.0 + vec2(100.0);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Distance from stage center
    float dist = length(vWorldPos.xz);
    float radialFade = smoothstep(580.0, 160.0, dist);

    // Height fade: thickest near cobblestone ground
    float heightFade = smoothstep(uHeight, 2.0, vWorldPos.y);

    // Drifting animated noise
    vec2 drift = vec2(uTime * 0.04, uTime * 0.025);
    float n1 = fbm(vWorldPos.xz * 0.004 + drift);
    float n2 = fbm(vWorldPos.xz * 0.008 - drift * 0.7);
    float mist = n1 * 0.65 + n2 * 0.35;

    // Ghost wake stirring
    float dGhost = length(vWorldPos.xz - uGhostPos.xz);
    float ghostWake = smoothstep(60.0, 150.0, dGhost);
    mist *= mix(0.4, 1.0, ghostWake);

    float alpha = mist * radialFade * heightFade * uDensity * 0.62;
    if (alpha < 0.01) discard;

    // Base ghostly cyan/lavender mist tinted with lightning flash
    vec3 baseColor = uFogColor;
    vec3 flashColor = vec3(0.85, 0.95, 1.0);
    vec3 finalColor = mix(baseColor, flashColor, uLightningFlash * 0.85);

    gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 0.85));
  }
`;

export class AtmosphereManager {
  private scene: THREE.Scene;
  private group: THREE.Group;

  // Ground Fog Elements
  private fogPlanes: THREE.Mesh[] = [];
  private fogUniforms: {
    uTime: THREE.IUniform<number>;
    uDensity: THREE.IUniform<number>;
    uHeight: THREE.IUniform<number>;
    uLightningFlash: THREE.IUniform<number>;
    uGhostPos: THREE.IUniform<THREE.Vector3>;
    uFogColor: THREE.IUniform<THREE.Color>;
  };
  private fogSurgeFactor: number = 1.0;

  // Dynamic Lightning Elements
  private lightningLight!: THREE.DirectionalLight;
  private lightningPointLight!: THREE.PointLight;
  private lightningBoltGroup!: THREE.Group;
  private lightningFlashTime: number = 0; // seconds remaining in current flash
  private lightningIntensity: number = 0;
  private autoLightningTimer: number = 0;

  // Configuration State
  public config: EnvironmentAtmosphere = {
    fogDensity: 1.1,
    fogHeight: 75,
    fogSpeed: 1.0,
    lightningFrequency: 'medium',
    stormDarkness: 0.35,
    lightningIntensity: 1.8,
    activeLightning: false,
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'AtmosphereStormSystem';
    scene.add(this.group);

    // 1. Setup Ground Mist Uniforms
    this.fogUniforms = {
      uTime: { value: 0 },
      uDensity: { value: this.config.fogDensity },
      uHeight: { value: this.config.fogHeight },
      uLightningFlash: { value: 0 },
      uGhostPos: { value: new THREE.Vector3(0, 0, 0) },
      uFogColor: { value: new THREE.Color(0x38556a) },
    };

    this.createVolumetricGroundFog();
    this.setupLightningLights();
    this.resetAutoLightningTimer();
  }

  private createVolumetricGroundFog(): void {
    // Stack multiple layered horizontal planes above cobblestones to simulate volumetric ground depth
    const layers = 5;
    const planeGeo = new THREE.PlaneGeometry(1100, 1100, 1, 1);
    planeGeo.rotateX(-Math.PI / 2);

    const fogMat = new THREE.ShaderMaterial({
      uniforms: this.fogUniforms,
      vertexShader: FOG_VS,
      fragmentShader: FOG_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < layers; i++) {
      const plane = new THREE.Mesh(planeGeo, fogMat);
      // Layer heights from Y=8 to Y=72 mm
      plane.position.y = 8 + i * 14;
      this.group.add(plane);
      this.fogPlanes.push(plane);
    }
  }

  private setupLightningLights(): void {
    // High-angle dramatic directional storm flash
    this.lightningLight = new THREE.DirectionalLight(0xd0e8ff, 0);
    this.lightningLight.position.set(120, 900, 200);
    this.group.add(this.lightningLight);

    // Point flash at strike epicenter
    this.lightningPointLight = new THREE.PointLight(0xcfe2fe, 0, 1400, 1.2);
    this.lightningPointLight.position.set(0, 480, -120);
    this.group.add(this.lightningPointLight);

    // Container for branching 3D lightning bolt geometry
    this.lightningBoltGroup = new THREE.Group();
    this.lightningBoltGroup.visible = false;
    this.group.add(this.lightningBoltGroup);
  }

  /**
   * Generates a realistic 3D fractal branching lightning bolt
   */
  private generateLightningBolt(
    start: THREE.Vector3,
    end: THREE.Vector3,
    branchDepth: number = 3
  ): void {
    // Clear old geometry
    while (this.lightningBoltGroup.children.length > 0) {
      const child = this.lightningBoltGroup.children[0] as THREE.Line;
      this.lightningBoltGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    const segments: THREE.Vector3[] = [];
    const buildBranch = (p0: THREE.Vector3, p1: THREE.Vector3, depth: number) => {
      if (depth <= 0) {
        segments.push(p0, p1);
        return;
      }
      const mid = new THREE.Vector3().lerpVectors(p0, p1, 0.45 + Math.random() * 0.1);
      const span = p0.distanceTo(p1);
      const jitter = span * 0.18;
      mid.x += (Math.random() - 0.5) * jitter;
      mid.y += (Math.random() - 0.5) * jitter * 0.5;
      mid.z += (Math.random() - 0.5) * jitter;

      buildBranch(p0, mid, depth - 1);
      buildBranch(mid, p1, depth - 1);

      // Random side fork
      if (Math.random() < 0.42 && depth >= 2) {
        const forkEnd = mid.clone().add(
          new THREE.Vector3(
            (Math.random() - 0.5) * span * 0.5,
            -Math.random() * span * 0.4,
            (Math.random() - 0.5) * span * 0.5
          )
        );
        buildBranch(mid, forkEnd, depth - 2);
      }
    };

    buildBranch(start, end, branchDepth);

    const geo = new THREE.BufferGeometry().setFromPoints(segments);
    const mat = new THREE.LineBasicMaterial({
      color: 0xe0f2fe,
      linewidth: 3,
      transparent: true,
      opacity: 0.98,
    });

    const bolt = new THREE.LineSegments(geo, mat);
    this.lightningBoltGroup.add(bolt);
    this.lightningBoltGroup.visible = true;
  }

  private resetAutoLightningTimer(): void {
    switch (this.config.lightningFrequency) {
      case 'rare':
        this.autoLightningTimer = 18 + Math.random() * 14;
        break;
      case 'medium':
        this.autoLightningTimer = 8 + Math.random() * 8;
        break;
      case 'storm':
        this.autoLightningTimer = 3.5 + Math.random() * 4;
        break;
      default:
        this.autoLightningTimer = 999999;
        break;
    }
  }

  /**
   * Fires an explosive lightning strike with visual bolt, multi-flash decay, and audio
   */
  public strikeLightning(
    targetX: number = (Math.random() - 0.5) * 180,
    targetY: number = 380, // Clock tower / facade spire height
    targetZ: number = -120 + (Math.random() - 0.5) * 60
  ): void {
    const startPoint = new THREE.Vector3(
      targetX + (Math.random() - 0.5) * 120,
      820 + Math.random() * 150,
      targetZ - 80
    );
    const endPoint = new THREE.Vector3(targetX, targetY, targetZ);

    this.generateLightningBolt(startPoint, endPoint, 4);
    this.lightningPointLight.position.copy(endPoint);

    // Stroboscopic flash trigger (lasting ~0.26s)
    this.lightningFlashTime = 0.26;
    this.lightningIntensity = this.config.lightningIntensity;
    this.config.activeLightning = true;

    // Trigger spatial audio
    spatialAudio.playLightningStrike(endPoint.x, endPoint.y, endPoint.z);
  }

  /**
   * Triggers a temporary ground fog surge
   */
  public triggerFogSurge(): void {
    this.fogSurgeFactor = 2.4;
  }

  public update(dt: number, primaryGhostPos?: THREE.Vector3): void {
    // 1. Update Ground Fog Uniforms
    this.fogUniforms.uTime.value += dt * this.config.fogSpeed;
    if (this.fogSurgeFactor > 1.0) {
      this.fogSurgeFactor = Math.max(1.0, this.fogSurgeFactor - dt * 0.6);
    }
    this.fogUniforms.uDensity.value = this.config.fogDensity * this.fogSurgeFactor;
    this.fogUniforms.uHeight.value = this.config.fogHeight;

    if (primaryGhostPos) {
      this.fogUniforms.uGhostPos.value.copy(primaryGhostPos);
    }

    // Adjust layer plane heights according to config
    for (let i = 0; i < this.fogPlanes.length; i++) {
      this.fogPlanes[i].position.y = 8 + i * (this.config.fogHeight / this.fogPlanes.length);
    }

    // 2. Update Lightning Flash Decays
    if (this.lightningFlashTime > 0) {
      this.lightningFlashTime -= dt;

      // Stroboscopic stutter effect: rapid flicker
      const phase = this.lightningFlashTime / 0.26; // 1 down to 0
      const flicker = Math.sin(phase * 45) > 0 ? 1.0 : 0.45;
      const curIntensity = phase * this.lightningIntensity * flicker * 3.8;

      this.lightningLight.intensity = curIntensity;
      this.lightningPointLight.intensity = curIntensity * 1.8;
      this.fogUniforms.uLightningFlash.value = Math.max(0, phase * flicker);

      if (this.lightningFlashTime <= 0) {
        this.lightningLight.intensity = 0;
        this.lightningPointLight.intensity = 0;
        this.fogUniforms.uLightningFlash.value = 0;
        this.lightningBoltGroup.visible = false;
        this.config.activeLightning = false;
      }
    } else {
      this.lightningLight.intensity = 0;
      this.lightningPointLight.intensity = 0;
      this.fogUniforms.uLightningFlash.value = 0;
      this.lightningBoltGroup.visible = false;
    }

    // 3. Auto Lightning Timer
    if (this.config.lightningFrequency !== 'off') {
      this.autoLightningTimer -= dt;
      if (this.autoLightningTimer <= 0) {
        this.strikeLightning();
        this.resetAutoLightningTimer();
      }
    }
  }

  public setFrequency(freq: LightningFrequency): void {
    this.config.lightningFrequency = freq;
    this.resetAutoLightningTimer();
  }

  public dispose(): void {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    for (const plane of this.fogPlanes) {
      plane.geometry.dispose();
    }
  }
}
