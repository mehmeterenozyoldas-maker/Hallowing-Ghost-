export type ActiveTab = 'stage' | 'choreography' | 'sound' | 'props' | 'flyzone' | 'projector' | 'shroud' | 'shader' | 'sculptor';

export type CameraViewMode = 'orbit' | 'projector_pov' | 'facade' | 'focus';

export interface BezierNode {
  x: number;
  y: number;
  ix: number;
  iy: number;
  ox: number;
  oy: number;
}

export interface FlyZone {
  shape?: 'cylinder' | 'box';
  centerX: number;      // -220 to 220 mm (stage center offset)
  centerY: number;      // 120 to 360 mm (rest hover center)
  centerZ: number;      // -160 to 160 mm
  radiusX: number;      // 70 to 300 mm (half-width or radius)
  radiusZ: number;      // 70 to 260 mm (half-depth)
  minY: number;         // 60 to 200 mm (floor buffer)
  maxY: number;         // 220 to 500 mm (ceiling limit)
  preset: 'free' | 'center' | 'playpen' | 'wide' | 'balcony' | 'custom';
  visibleCage: boolean; // Show glowing floor boundary ring
  unrestricted?: boolean; // When true, ghost flies freely across entire original stage with no boundaries
}

export interface ClothParams {
  pressure: number;     // inflation force
  stretch: number;      // compliance aS
  bend: number;         // compliance aB (wrinkles)
  gravity: number;      // downward pull
  smoothing: number;    // Taubin smoothing iterations (0-6)
  resolution: number;   // particles per layer (400-3500)
  color: string;        // base cloth tint
  gloss: number;        // specular shine
  windStrength: number; // wind vortex strength
  arenaRadius?: number; // Spatial movement arena boundary radius in mm (legacy fallback)
  flyZone?: FlyZone;    // User-defined 3D flight boundary
}

export interface TendrilParams {
  enabled: boolean;
  density: number;      // count in thousands
  length: number;       // strand length in mm
  droop: number;        // gravity sag
  wildness: number;     // organic curl
  inertiaLag: number;   // drag lag
}

export interface ProjectorParams {
  azimuth: number;      // -180 to 180 degrees
  elevation: number;    // 5 to 85 degrees
  distance: number;     // distance to stage center
  fov: number;          // lens FOV
  keystone: number;     // vertical keystone tilt
  shadowK: number;      // shadow darkness 0-1
  spill: number;        // floor light spill 0-1
  stickMode: number;    // 0: static in room, 1: spotlight follows ghost, 2: sticks to mesh UVs
  testPattern: number;  // 0: none, 1: alignment grid, 2: checkerboard, 3: calibration target
  floorProjection: boolean;
  showRig: boolean;
}

export interface ShaderParams {
  preset: string;
  userCode: string;
  brightness: number;
  contrast: number;
  scale: number;
  speed: number;
  hue: number;
  colorize: number;
  reactivity: number;         // touch and velocity displacement
  resolution: number;         // 256, 512, 1024
  chromaticDispersion: number; // 0.0 - 1.0 prismatic wavelength separation
  bloomIntensity: number;     // 0.0 - 2.0 phosphorescent glow bleed
  godRays: number;            // 0.0 - 1.0 volumetric light shafts
  morphFactor: number;        // 0.0 - 1.0 mathematical iteration/folding depth
  wrinkleReactivity: number;  // 0.0 - 2.0 sensitivity to cloth curvature
  // Video & Webcam Spectral Projection
  videoEnabled?: boolean;
  videoSource?: 'webcam' | 'mist_loop' | 'banshee_loop' | 'shadow_loop' | 'custom';
  videoBlendMode?: number;    // 0: Luma Ghost Key, 1: Sobel Edge Glow, 2: Slit-Scan Distortion, 3: Ectoplasmic Overlay
  videoThreshold?: number;    // 0.0 - 1.0
  videoChromaKey?: number;    // 0.0 - 1.0
  videoExposure?: number;     // 0.5 - 3.0
  keystone?: [number, number, number, number, number, number, number, number]; // 4 normalized corners [TL, TR, BR, BL]
}

export interface ClothPhysicsConfig {
  enabled: boolean;
  windSpeed: number;          // 0 to 100
  windAngle: number;          // 0 to 360 deg
  turbulence: number;         // 0 to 100
  upwardDraft: number;        // 0 to 100
  stiffness: number;          // 0 to 100
  cursorDraft: boolean;       // air gust on cursor hover
}

export interface AudioState {
  enabled: boolean;
  mode: 'mic' | 'synthetic';
  volume: number;       // normalized 0-1
  bass: number;         // low frequencies 0-1
  high: number;         // high frequencies 0-1
}

export interface SimStats {
  fps: number;
  particles: number;
  heightMm: number;
  volumeLiters: number;
  windSpeed: number;
}

export interface GhostEntityConfig {
  id: string;
  name: string;
  color: string;
  scale: number;
  pressure: number;
  offsetX: number;
  offsetZ: number;
  enabled: boolean;
  bounciness: number;
}

export interface PropsState {
  candlesCount: number;
  pumpkinsCount: number;
  candleGlow: number;
  pumpkinPhysics: boolean;
}

export interface SpatialAudioSettings {
  enabled: boolean;
  masterVolume: number;
}

export type ReverbEnvironmentPreset = 'cathedral' | 'crypt' | 'square' | 'void';
export type FormantVowel = 'a' | 'e' | 'i' | 'o' | 'u';

export interface AudioChannelLevels {
  master: number;
  voices: number;
  foley: number;
  environment: number;
  props: number;
  drone: number;
}

export interface SoundFxSettings {
  enabled: boolean;
  masterVolume: number;
  channels: AudioChannelLevels;
  reverbPreset: ReverbEnvironmentPreset;
  reverbDecay: number;      // 0.4 to 6.0 seconds
  reverbMix: number;        // 0.0 to 1.0 (wet mix)
  reverbDampening: number;  // 1000 to 12000 Hz
  subBassBoost: boolean;
  clothFoleySensitivity: number; // 0.2 to 2.5
}

export interface CosinePalette {
  name: string;
  a: [number, number, number]; // base offset
  b: [number, number, number]; // amplitude
  c: [number, number, number]; // frequency
  d: [number, number, number]; // phase
}

export interface GhostArchetype {
  id: string;
  name: string;
  desc: string;
  nodes: BezierNode[];
  shaderParams: Partial<ShaderParams>;
  palette?: CosinePalette;
  clothPhysics?: Partial<ClothPhysicsConfig>;
  isCustom?: boolean;
}

// ==================== MVP3 Haunt Show Choreography & Flight Path Timeline ====================

export interface FlightKeyframe {
  id: string;
  time: number; // Time in seconds
  x: number;
  y: number;
  z: number;
  tension?: number;
}

export type ShowCueType = 'lightning' | 'thunder' | 'fog_burst' | 'organ_stab' | 'whoosh';

export interface ShowCue {
  id: string;
  time: number; // Time in seconds
  type: ShowCueType;
  intensity?: number;
  label?: string;
}

export interface FlightTrack {
  id: string;
  ghostId: string;
  name: string;
  color: string;
  visible: boolean;
  keyframes: FlightKeyframe[];
}

export interface ChoreographyShow {
  id: string;
  name: string;
  duration: number; // seconds
  loop: boolean;
  tracks: FlightTrack[];
  cues: ShowCue[];
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  loop: boolean;
  isRecording: boolean;
  recordingGhostId: string | null;
  showFlightRibbons: boolean;
}

export type LightningFrequency = 'off' | 'rare' | 'medium' | 'storm';

export interface EnvironmentAtmosphere {
  fogDensity: number;       // 0.0 - 2.5
  fogHeight: number;        // 20 - 180 mm
  fogSpeed: number;         // 0.2 - 2.5
  lightningFrequency: LightningFrequency;
  stormDarkness: number;    // 0.0 - 0.9 (ambient dimming)
  lightningIntensity: number; // 0.5 - 3.0
  activeLightning: boolean; // transient trigger state
}

