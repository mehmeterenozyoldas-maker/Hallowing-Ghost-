import React from 'react';
import { ClothParams, FlyZone, ShaderParams, TendrilParams, AudioState } from '../types';
import { SHADER_PRESETS } from '../engine/shaders';
import { Sparkles, Wand2, RotateCcw, Volume2, VolumeX, Mic } from 'lucide-react';

const lerpLog = (a: number, b: number, t: number) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);

interface KidControlsProps {
  clothParams: ClothParams;
  onClothChange: (params: ClothParams) => void;
  tendrilParams: TendrilParams;
  onTendrilChange: (params: TendrilParams) => void;
  shaderParams: ShaderParams;
  onShaderChange: (params: ShaderParams) => void;
  flyZone: FlyZone;
  onFlyZoneChange: (zone: FlyZone) => void;
  audioState: AudioState;
  onToggleAudio: () => void;
  onToggleMic: () => void;
  onResetGhostCenter: () => void;
}

interface KidCharacter {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  color: string;
  fluffiness: number; // 0 to 1
  bounciness: number; // 0 to 1
  speed: number;      // 0 to 1
  sparkle: number;    // 0 to 1
  shaderPreset: string;
  flyZonePreset: FlyZone['preset'];
}

const KID_CHARACTERS: KidCharacter[] = [
  {
    id: 'marshmallow',
    name: 'Bouncy Mallow',
    emoji: '🐶',
    tagline: 'Super squishy, pops back like a marshmallow!',
    color: '#ffffff',
    fluffiness: 0.45,
    bounciness: 0.95,
    speed: 0.5,
    sparkle: 0.6,
    shaderPreset: 'raymarch_phantom',
    flyZonePreset: 'playpen',
  },
  {
    id: 'rainbow',
    name: 'Rainbow Sparkle',
    emoji: '🌈',
    tagline: 'Prismatic colors with extra shimmering fur!',
    color: '#38bdf8',
    fluffiness: 0.9,
    bounciness: 0.85,
    speed: 0.7,
    sparkle: 1.0,
    shaderPreset: 'reaction_diffusion',
    flyZonePreset: 'center',
  },
  {
    id: 'zoomy',
    name: 'Zoomy Bolt',
    emoji: '⚡',
    tagline: 'Electric neon ghost with vibrant hyperbolic kaleidoscope waves!',
    color: '#60a5fa',
    fluffiness: 0.25,
    bounciness: 0.9,
    speed: 1.0,
    sparkle: 0.8,
    shaderPreset: 'hyperbolic_lattice',
    flyZonePreset: 'wide',
  },
  {
    id: 'cloud',
    name: 'Sleepy Cloud',
    emoji: '☁️',
    tagline: 'Gentle pastel puff that drifts slow with abyssal ectoplasm mist.',
    color: '#e0e7ff',
    fluffiness: 0.8,
    bounciness: 0.4,
    speed: 0.25,
    sparkle: 0.35,
    shaderPreset: 'phantom_void',
    flyZonePreset: 'center',
  },
  {
    id: 'spooky',
    name: 'Spooky Pooky',
    emoji: '🎃',
    tagline: 'Weeping spectral face glowing with pumpkin warmth and spectral tears.',
    color: '#fb923c',
    fluffiness: 0.5,
    bounciness: 0.75,
    speed: 0.65,
    sparkle: 0.9,
    shaderPreset: 'ectoplasm',
    flyZonePreset: 'center',
  },
  {
    id: 'fairy',
    name: 'Starlight Fairy',
    emoji: '🌟',
    tagline: 'Golden celestial fairy with acoustic cymatic resonance vibration!',
    color: '#fef08a',
    fluffiness: 0.7,
    bounciness: 0.8,
    speed: 0.6,
    sparkle: 0.95,
    shaderPreset: 'cymatics_resonance',
    flyZonePreset: 'balcony',
  },
];

const COLOR_BUBBLES = [
  { label: 'Ghost White', hex: '#ffffff', border: '#cbd5e1' },
  { label: 'Bubblegum Pink', hex: '#f472b6', border: '#ec4899' },
  { label: 'Ocean Blue', hex: '#38bdf8', border: '#0284c7' },
  { label: 'Lemon Sunshine', hex: '#fde047', border: '#eab308' },
  { label: 'Magic Purple', hex: '#c084fc', border: '#9333ea' },
  { label: 'Slime Green', hex: '#4ade80', border: '#16a34a' },
  { label: 'Pumpkin Orange', hex: '#fb923c', border: '#ea580c' },
];

export const KidControls: React.FC<KidControlsProps> = ({
  clothParams,
  onClothChange,
  tendrilParams,
  onTendrilChange,
  shaderParams,
  onShaderChange,
  flyZone,
  onFlyZoneChange,
  audioState,
  onToggleAudio,
  onToggleMic,
  onResetGhostCenter,
}) => {
  // Convert current state to friendly normalized 0-1 values
  const currentFluffiness = tendrilParams.enabled
    ? Math.min(1, Math.max(0, (tendrilParams.density - 20) / 100))
    : 0;

  const currentBounciness = Math.min(
    1,
    Math.max(0, clothParams.pressure / 1800)
  );

  const currentSpeed = Math.min(1, Math.max(0, clothParams.windStrength / 1.5));
  const currentSparkle = Math.min(1, Math.max(0, shaderParams.bloomIntensity / 1.6));

  const applyKidCharacter = (c: KidCharacter) => {
    // 1. Color and physics
    onClothChange({
      ...clothParams,
      color: c.color,
      pressure: 250 + c.bounciness * 600,
      stretch: lerpLog(4e-8, 4e-6, 0.3),
      gravity: 40 + (1 - c.bounciness) * 120,
    });

    // 2. Tendrils / fluffiness
    onTendrilChange({
      ...tendrilParams,
      enabled: c.fluffiness > 0.05,
      density: Math.round(30 + c.fluffiness * 80),
      length: 5 + c.fluffiness * 9,
    });

    // 3. Shader
    const presetObj = SHADER_PRESETS[c.shaderPreset] || SHADER_PRESETS.raymarch_phantom;
    onShaderChange({
      ...shaderParams,
      preset: c.shaderPreset,
      userCode: presetObj.code,
      brightness: 1.2 + c.sparkle * 0.5,
      bloomIntensity: 0.3 + c.sparkle * 1.1,
      chromaticDispersion: 0.2 + c.sparkle * 0.6,
    });

    // 4. Fly zone preset
    if (c.flyZonePreset === 'playpen') {
      onFlyZoneChange({
        ...flyZone,
        preset: 'playpen',
        radiusX: 110,
        radiusZ: 95,
        minY: 90,
        maxY: 300,
      });
    } else if (c.flyZonePreset === 'wide') {
      onFlyZoneChange({
        ...flyZone,
        preset: 'wide',
        radiusX: 270,
        radiusZ: 190,
        minY: 70,
        maxY: 380,
      });
    } else if (c.flyZonePreset === 'balcony') {
      onFlyZoneChange({
        ...flyZone,
        preset: 'balcony',
        radiusX: 200,
        radiusZ: 140,
        minY: 170,
        maxY: 440,
      });
    } else {
      onFlyZoneChange({
        ...flyZone,
        preset: 'center',
        radiusX: 175,
        radiusZ: 145,
        minY: 85,
        maxY: 345,
      });
    }
  };

  const handleSurpriseMe = () => {
    const randomIndex = Math.floor(Math.random() * KID_CHARACTERS.length);
    applyKidCharacter(KID_CHARACTERS[randomIndex]);
  };

  return (
    <div className="flex flex-col gap-5 p-5 text-neutral-100 select-none">
      {/* Friendly Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎈</span>
          <div>
            <h2 className="text-sm font-bold text-cyan-300">Magic Ghost Playroom</h2>
            <p className="text-[11px] text-neutral-400">Tap a friend or pick your favorite colors!</p>
          </div>
        </div>
        <button
          onClick={handleSurpriseMe}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>Surprise Me!</span>
        </button>
      </div>

      {/* 1. Pick a Character (One-Tap Transforms) */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-neutral-300 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
          <span>Pick Your Ghost Friend:</span>
        </span>
        <div className="grid grid-cols-2 gap-2.5">
          {KID_CHARACTERS.map((char) => {
            return (
              <button
                key={char.id}
                onClick={() => applyKidCharacter(char)}
                className="p-3 rounded-2xl border border-neutral-800 bg-neutral-900/70 hover:bg-neutral-850 hover:border-cyan-500/70 transition-all cursor-pointer text-left flex flex-col gap-1 active:scale-98 group shadow-sm hover:shadow-cyan-950/40"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl group-hover:scale-110 transition-transform">
                    {char.emoji}
                  </span>
                  <span
                    className="w-4 h-4 rounded-full border border-neutral-700 shadow-xs"
                    style={{ backgroundColor: char.color }}
                  />
                </div>
                <span className="text-xs font-bold text-neutral-100 group-hover:text-cyan-300 transition-colors">
                  {char.name}
                </span>
                <p className="text-[10px] text-neutral-400 line-clamp-2 leading-tight">
                  {char.tagline}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Color Palette Bubbles */}
      <div className="flex flex-col gap-2 pt-1 border-t border-neutral-800/80">
        <span className="text-xs font-bold text-neutral-300">
          🎨 Change Ghost Glow Color:
        </span>
        <div className="flex items-center justify-between gap-1.5 p-2 bg-neutral-900/60 rounded-2xl border border-neutral-800">
          {COLOR_BUBBLES.map((c) => {
            const isSelected =
              clothParams.color?.toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.hex}
                onClick={() => onClothChange({ ...clothParams, color: c.hex })}
                className={`w-8 h-8 rounded-full cursor-pointer transition-all active:scale-90 flex items-center justify-center ${
                  isSelected
                    ? 'ring-3 ring-cyan-400 ring-offset-2 ring-offset-neutral-950 scale-110 shadow-md'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c.hex, border: `2px solid ${c.border}` }}
                title={c.label}
              >
                {isSelected && <span className="text-[10px] text-neutral-950 font-black">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Simple Kid Sliders with Emojis */}
      <div className="flex flex-col gap-3.5 pt-2 border-t border-neutral-800/80">
        <span className="text-xs font-bold text-neutral-300">
          ✨ Easy Sliders:
        </span>

        {/* Fluffiness */}
        <div className="flex flex-col gap-1 bg-neutral-900/40 p-2.5 rounded-xl border border-neutral-800/60">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-300 font-medium flex items-center gap-1.5">
              <span>🧸</span>
              <span>Fluffiness</span>
            </span>
            <span className="text-[11px] text-cyan-400 font-semibold">
              {currentFluffiness < 0.2
                ? '🐱 Smooth'
                : currentFluffiness < 0.6
                ? '🦊 Fluffy'
                : '🐻 Super Fuzzy Bear!'}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(currentFluffiness * 100)}
            onChange={(e) => {
              const val = parseInt(e.target.value) / 100;
              onTendrilChange({
                ...tendrilParams,
                enabled: val > 0.05,
                density: Math.round(25 + val * 85),
                length: 5 + val * 9,
              });
            }}
            className="accent-pink-400 cursor-pointer h-2"
          />
        </div>

        {/* Squishy Bounciness (Elastic stretch & recoil) */}
        <div className="flex flex-col gap-1 bg-neutral-900/40 p-2.5 rounded-xl border border-neutral-800/60">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-300 font-medium flex items-center gap-1.5">
              <span>🎈</span>
              <span>Squishy Stretch & Recoil</span>
            </span>
            <span className="text-[11px] text-cyan-400 font-semibold">
              {currentBounciness < 0.3
                ? '🪶 Soft Pillow'
                : currentBounciness < 0.7
                ? '🍡 Squishy Marshmallow'
                : '⚡ Elastic Jelly Pop!'}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(currentBounciness * 100)}
            onChange={(e) => {
              const val = parseInt(e.target.value) / 100;
              onClothChange({
                ...clothParams,
                pressure: Math.round(val * 1800),
                gravity: Math.round(40 + (1 - val) * 120),
              });
            }}
            className="accent-cyan-400 cursor-pointer h-2"
          />
        </div>

        {/* Flying Speed */}
        <div className="flex flex-col gap-1 bg-neutral-900/40 p-2.5 rounded-xl border border-neutral-800/60">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-300 font-medium flex items-center gap-1.5">
              <span>💨</span>
              <span>Fly Speed</span>
            </span>
            <span className="text-[11px] text-cyan-400 font-semibold">
              {currentSpeed < 0.3
                ? '🍃 Calm Float'
                : currentSpeed < 0.7
                ? '🌬️ Breezy'
                : '🚀 Turbo Zoom!'}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(currentSpeed * 100)}
            onChange={(e) => {
              const val = parseInt(e.target.value) / 100;
              onClothChange({
                ...clothParams,
                windStrength: 0.1 + val * 1.3,
              });
            }}
            className="accent-amber-400 cursor-pointer h-2"
          />
        </div>

        {/* Magic Sparkle Glow */}
        <div className="flex flex-col gap-1 bg-neutral-900/40 p-2.5 rounded-xl border border-neutral-800/60">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-300 font-medium flex items-center gap-1.5">
              <span>✨</span>
              <span>Magic Sparkles</span>
            </span>
            <span className="text-[11px] text-cyan-400 font-semibold">
              {currentSparkle < 0.3
                ? '🌙 Soft Whisper'
                : currentSparkle < 0.7
                ? '⭐ Shimmering'
                : '☀️ Super Glowing!'}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(currentSparkle * 100)}
            onChange={(e) => {
              const val = parseInt(e.target.value) / 100;
              onShaderChange({
                ...shaderParams,
                bloomIntensity: 0.1 + val * 1.4,
                brightness: 1.1 + val * 0.6,
              });
            }}
            className="accent-purple-400 cursor-pointer h-2"
          />
        </div>
      </div>

      {/* 4. Simple Fly Zone selector */}
      <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800/80">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
            <span>🏰</span>
            <span>Where Can Ghost Fly?</span>
          </span>
          <span className="text-[10px] text-cyan-400 font-semibold">
            {flyZone.preset === 'free' || flyZone.unrestricted
              ? '🌌 Free Roaming'
              : '🎯 Confined Arena'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* Big Free Fly Original Stage button */}
          <button
            onClick={() =>
              onFlyZoneChange({
                ...flyZone,
                preset: 'free',
                unrestricted: true,
                visibleCage: false,
                radiusX: 520,
                radiusZ: 280,
                minY: 60,
                maxY: 460,
                centerX: 0,
                centerZ: 0,
              })
            }
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 col-span-2 ${
              flyZone.preset === 'free' || flyZone.unrestricted
                ? 'bg-gradient-to-r from-cyan-950/80 to-blue-950/80 border-cyan-400 text-cyan-200 shadow-md ring-1 ring-cyan-500/50'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5 text-cyan-300">
                <span>🌌</span>
                <span>Free Fly Area (Original Stage)</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-900/60 text-cyan-200 font-mono">
                No walls / No cages
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">
              Ghost can fly freely everywhere across the entire theatre stage!
            </p>
          </button>

          <button
            onClick={() =>
              onFlyZoneChange({
                ...flyZone,
                preset: 'center',
                unrestricted: false,
                visibleCage: true,
                radiusX: 175,
                radiusZ: 145,
                minY: 85,
                maxY: 345,
                centerX: 0,
                centerZ: 0,
              })
            }
            className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
              flyZone.preset === 'center' && !flyZone.unrestricted
                ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
            }`}
          >
            <span className="text-lg">🎪</span>
            <span className="text-[11px] font-bold">Center Stage</span>
          </button>

          <button
            onClick={() =>
              onFlyZoneChange({
                ...flyZone,
                preset: 'playpen',
                unrestricted: false,
                visibleCage: true,
                radiusX: 110,
                radiusZ: 95,
                minY: 90,
                maxY: 300,
                centerX: 0,
                centerZ: 20,
              })
            }
            className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
              flyZone.preset === 'playpen' && !flyZone.unrestricted
                ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
            }`}
          >
            <span className="text-lg">🧸</span>
            <span className="text-[11px] font-bold">Close Playpen</span>
          </button>
        </div>
      </div>

      {/* 5. Big Kid Action Buttons */}
      <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800/80">
        <button
          onClick={onResetGhostCenter}
          className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-neutral-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-98"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Come Back Here! (Reset Ghost)</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onToggleAudio}
            className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              audioState.enabled
                ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-850'
            }`}
          >
            {audioState.enabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{audioState.enabled ? 'Music Dancing On' : 'Make Ghost Dance'}</span>
          </button>

          <button
            onClick={onToggleMic}
            className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              audioState.mode === 'mic'
                ? 'bg-indigo-950/70 border-indigo-500 text-indigo-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-850'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>{audioState.mode === 'mic' ? 'Hearing Voice!' : 'Hear My Voice'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
