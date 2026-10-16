import { BezierNode, CosinePalette, GhostArchetype, ShaderParams } from '../types';
import { SHROUD_PRESETS, getShroudPreset } from './bezier';
import { SHADER_PRESETS } from './shaders';

export const COSINE_PALETTES: Record<string, CosinePalette> = {
  phantom_cyan: {
    name: 'Phantom Cyan & Soul Gold',
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.33, 0.67],
  },
  amethyst_void: {
    name: 'Amethyst Void & Spectral Violet',
    a: [0.5, 0.2, 0.6],
    b: [0.5, 0.4, 0.5],
    c: [2.0, 1.0, 1.0],
    d: [0.5, 0.2, 0.25],
  },
  bioluminescent_green: {
    name: 'Bioluminescent Abyssal Sea',
    a: [0.15, 0.7, 0.45],
    b: [0.25, 0.5, 0.4],
    c: [1.0, 1.5, 1.0],
    d: [0.0, 0.15, 0.25],
  },
  hellfire_crimson: {
    name: 'Hellfire Crimson & Soul Ash',
    a: [0.75, 0.25, 0.15],
    b: [0.5, 0.3, 0.2],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.1, 0.2],
  },
  glacial_aurora: {
    name: 'Glacial Aurora & Starlight',
    a: [0.45, 0.65, 0.75],
    b: [0.5, 0.4, 0.3],
    c: [1.0, 1.0, 1.0],
    d: [0.3, 0.2, 0.8],
  },
};

function safeShaderCode(key: string): string {
  try {
    const item = SHADER_PRESETS[key];
    if (item && item.code) return item.code;
  } catch {
    // fallback
  }
  return '';
}

export const BUILTIN_ARCHETYPES: GhostArchetype[] = [
  {
    id: 'wraith_abyss',
    name: 'Ethereal Wraith of the Crypt',
    desc: 'Bespoke floating phantom with 3D sphere-traced SDF skull, deep flowing robes, and cyan soul orbs.',
    nodes: getShroudPreset('ethereal_wraith'),
    shaderParams: {
      preset: 'raymarch_phantom',
      userCode: safeShaderCode('raymarch_phantom'),
      scale: 32,
      speed: 30,
      brightness: 1.45,
      contrast: 2.1,
      chromaticDispersion: 0.45,
      bloomIntensity: 0.85,
    },
    palette: COSINE_PALETTES.phantom_cyan,
    clothPhysics: {
      enabled: true,
      windSpeed: 45,
      windAngle: 25,
      turbulence: 55,
      upwardDraft: 35,
      stiffness: 40,
      cursorDraft: true,
    },
  },
  {
    id: 'screaming_banshee',
    name: 'Screaming Banshee Matron',
    desc: 'High-frequency sonic screeching visage with trailing veil contour and piercing spectral eyes.',
    nodes: getShroudPreset('banshee_veil'),
    shaderParams: {
      preset: 'banshee',
      userCode: safeShaderCode('banshee') || safeShaderCode('screaming_banshee'),
      scale: 28,
      speed: 42,
      brightness: 1.55,
      contrast: 2.3,
      chromaticDispersion: 0.6,
      bloomIntensity: 1.1,
    },
    palette: COSINE_PALETTES.amethyst_void,
    clothPhysics: {
      enabled: true,
      windSpeed: 70,
      windAngle: 40,
      turbulence: 80,
      upwardDraft: 50,
      stiffness: 25,
      cursorDraft: true,
    },
  },
  {
    id: 'pumpkin_poltergeist',
    name: 'Pumpkin Gourd Poltergeist',
    desc: 'Turing chemical reaction-diffusion morphogenesis with biomorphic slime veins and flared ribbed hem.',
    nodes: getShroudPreset('pumpkin_cap'),
    shaderParams: {
      preset: 'reaction_diffusion',
      userCode: safeShaderCode('reaction_diffusion'),
      scale: 38,
      speed: 36,
      brightness: 1.35,
      contrast: 1.95,
      chromaticDispersion: 0.3,
      bloomIntensity: 0.75,
    },
    palette: COSINE_PALETTES.hellfire_crimson,
    clothPhysics: {
      enabled: true,
      windSpeed: 30,
      windAngle: 10,
      turbulence: 40,
      upwardDraft: 20,
      stiffness: 65,
      cursorDraft: true,
    },
  },
  {
    id: 'quantum_wisp',
    name: 'Non-Euclidean Wisp',
    desc: 'Poincaré hyperbolic manifold with recursive kaleidoscopic fractal folds and airy trailing tendrils.',
    nodes: getShroudPreset('wispy_poltergeist'),
    shaderParams: {
      preset: 'hyperbolic_lattice',
      userCode: safeShaderCode('hyperbolic_lattice'),
      scale: 24,
      speed: 26,
      brightness: 1.4,
      contrast: 2.0,
      chromaticDispersion: 0.7,
      bloomIntensity: 0.95,
    },
    palette: COSINE_PALETTES.glacial_aurora,
    clothPhysics: {
      enabled: true,
      windSpeed: 55,
      windAngle: 15,
      turbulence: 75,
      upwardDraft: 60,
      stiffness: 30,
      cursorDraft: true,
    },
  },
  {
    id: 'classic_sheet',
    name: 'Victorian Sheet Spectre',
    desc: 'Classic flowing white sheet drapery with deep swirling nocturnal ectoplasm mist and sea-green embers.',
    nodes: getShroudPreset('classic_sheet'),
    shaderParams: {
      preset: 'phantom_void',
      userCode: safeShaderCode('phantom_void'),
      scale: 30,
      speed: 24,
      brightness: 1.3,
      contrast: 1.8,
      chromaticDispersion: 0.25,
      bloomIntensity: 0.7,
    },
    palette: COSINE_PALETTES.bioluminescent_green,
    clothPhysics: {
      enabled: true,
      windSpeed: 38,
      windAngle: 20,
      turbulence: 45,
      upwardDraft: 25,
      stiffness: 45,
      cursorDraft: true,
    },
  },
];

const LOCAL_STORAGE_KEY = 'spectral_ghost_user_archetypes_v1';

export function loadUserArchetypes(): GhostArchetype[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUserArchetype(archetype: GhostArchetype): void {
  try {
    const existing = loadUserArchetypes();
    const updated = [archetype, ...existing.filter((a) => a.id !== archetype.id)];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Non-critical local storage fallback
  }
}

export function deleteUserArchetype(id: string): void {
  try {
    const existing = loadUserArchetypes();
    const filtered = existing.filter((a) => a.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // Non-critical
  }
}
