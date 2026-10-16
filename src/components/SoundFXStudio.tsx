import React, { useState, useEffect, useRef } from 'react';
import { FormantVowel, ReverbEnvironmentPreset, SoundFxSettings } from '../types';
import { spatialAudio } from '../engine/spatialAudio';
import {
  Volume2,
  VolumeX,
  Sparkles,
  Zap,
  Bell,
  Ghost,
  Radio,
  Sliders,
  Wind,
  CloudLightning,
  Music,
  Activity,
  Waves,
} from 'lucide-react';

interface SoundFXStudioProps {
  soundSettings: SoundFxSettings;
  onUpdateSettings: (settings: Partial<SoundFxSettings>) => void;
  isKidMode?: boolean;
}

export const SoundFXStudio: React.FC<SoundFXStudioProps> = ({
  soundSettings,
  onUpdateSettings,
  isKidMode = false,
}) => {
  const [activePad, setActivePad] = useState<string | null>(null);
  const [liveMeter, setLiveMeter] = useState<number>(0);
  const [vowelChoice, setVowelChoice] = useState<FormantVowel>('o');
  const [voicePitch, setVoicePitch] = useState<number>(240);
  const [voiceFlutter, setVoiceFlutter] = useState<number>(6.5);
  const [voiceIntensity, setVoiceIntensity] = useState<number>(1.0);
  const animFrameRef = useRef<number | null>(null);

  // Meter update loop
  useEffect(() => {
    const updateMeter = () => {
      const level = spatialAudio.getMasterLevel();
      setLiveMeter(level);
      animFrameRef.current = requestAnimationFrame(updateMeter);
    };
    animFrameRef.current = requestAnimationFrame(updateMeter);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const triggerPad = (id: string, action: () => void) => {
    setActivePad(id);
    spatialAudio.initCtx();
    action();
    setTimeout(() => {
      setActivePad((curr) => (curr === id ? null : curr));
    }, 450);
  };

  const handleMasterChange = (val: number) => {
    spatialAudio.setMasterVolume(val);
    onUpdateSettings({
      masterVolume: val,
      channels: { ...soundSettings.channels, master: val },
    });
  };

  const handleChannelChange = (
    channel: keyof typeof soundSettings.channels,
    val: number
  ) => {
    spatialAudio.setChannelVolume(channel, val);
    onUpdateSettings({
      channels: { ...soundSettings.channels, [channel]: val },
    });
  };

  const handleReverbPresetChange = (preset: ReverbEnvironmentPreset) => {
    spatialAudio.setReverbPreset(preset);
    onUpdateSettings({ reverbPreset: preset });
  };

  const handleReverbDecayChange = (decay: number) => {
    spatialAudio.setReverbDecay(decay);
    onUpdateSettings({ reverbDecay: decay });
  };

  const handleReverbMixChange = (mix: number) => {
    spatialAudio.setReverbMix(mix);
    onUpdateSettings({ reverbMix: mix });
  };

  const handleAuditionVoice = () => {
    spatialAudio.initCtx();
    spatialAudio.playSpectralVoice(
      vowelChoice,
      voicePitch,
      voiceIntensity,
      0,
      220,
      0,
      voiceFlutter
    );
  };

  return (
    <div className="h-full flex flex-col bg-neutral-950 text-neutral-100 overflow-y-auto p-4 sm:p-6 space-y-6 select-none font-sans">
      {/* 1. Header & Master Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-neutral-900/80 border border-neutral-800/80 backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-neutral-100">
                {isKidMode ? '🎵 Spooky Magic Sound Studio' : 'Gothic Sound FX & Spatial Audio Studio'}
              </h2>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                HD FM + IR Reverb
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Procedural Web Audio engine with multi-layer FM synthesis, formant vowel resonators, and cathedral convolution reverb.
            </p>
          </div>
        </div>

        {/* Master Volume & Live VU Meter */}
        <div className="flex items-center gap-4 bg-neutral-950/80 px-4 py-2.5 rounded-lg border border-neutral-800">
          <button
            onClick={() => {
              const newEn = !soundSettings.enabled;
              spatialAudio.setEnabled(newEn);
              onUpdateSettings({ enabled: newEn });
            }}
            className={`p-2 rounded-md transition-colors cursor-pointer ${
              soundSettings.enabled
                ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                : 'bg-neutral-800 text-neutral-500 hover:text-neutral-400'
            }`}
            title={soundSettings.enabled ? 'Mute Master Audio' : 'Unmute Master Audio'}
          >
            {soundSettings.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <div className="flex flex-col gap-1 w-36">
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
              <span>MASTER</span>
              <span className="text-cyan-400">{Math.round(soundSettings.masterVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={soundSettings.masterVolume}
              onChange={(e) => handleMasterChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Mini VU Meter */}
          <div className="flex items-end gap-0.5 h-6 w-10 px-1 py-0.5 bg-black rounded border border-neutral-800">
            {[0.1, 0.25, 0.45, 0.7, 0.9].map((thresh, idx) => {
              const active = liveMeter >= thresh;
              const color =
                idx === 4
                  ? active
                    ? 'bg-rose-500'
                    : 'bg-rose-950'
                  : idx >= 3
                  ? active
                    ? 'bg-amber-400'
                    : 'bg-amber-950'
                  : active
                  ? 'bg-cyan-400'
                  : 'bg-cyan-950';
              return <div key={idx} className={`w-1.5 h-full rounded-xs transition-colors duration-75 ${color}`} />;
            })}
          </div>
        </div>
      </div>

      {/* 2. Gothic Soundboard Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
              {isKidMode ? 'Spooky Sound Buttons' : 'Cinematic Soundboard (Audition & Trigger)'}
            </h3>
          </div>
          <span className="text-xs text-neutral-500">Tap to fire instantly with 3D spatial acoustics</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Pad 1: Banshee Shriek */}
          <button
            onClick={() =>
              triggerPad('banshee', () =>
                spatialAudio.playSpectralVoice('e', 440, 1.3, -120, 240, 0, 8.5)
              )
            }
            className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activePad === 'banshee'
                ? 'bg-cyan-500/30 border-cyan-400 scale-[0.98] shadow-lg shadow-cyan-500/20'
                : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Ghost className="w-4 h-4 text-cyan-400" />
              <span className="text-[10px] font-mono text-neutral-500">VOICE</span>
            </div>
            <span className="text-xs font-semibold text-neutral-200">Banshee Shriek</span>
            <span className="text-[10px] text-neutral-400">High resonant 'E' wail with vibrato</span>
          </button>

          {/* Pad 2: Wraith Cry */}
          <button
            onClick={() =>
              triggerPad('wraith', () =>
                spatialAudio.playSpectralVoice('o', 180, 1.2, 80, 200, 0, 5.5)
              )
            }
            className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activePad === 'wraith'
                ? 'bg-purple-500/30 border-purple-400 scale-[0.98] shadow-lg shadow-purple-500/20'
                : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Ghost className="w-4 h-4 text-purple-400" />
              <span className="text-[10px] font-mono text-neutral-500">VOICE</span>
            </div>
            <span className="text-xs font-semibold text-neutral-200">Wraith Moan</span>
            <span className="text-[10px] text-neutral-400">Deep cavernous 'O' vowel glide</span>
          </button>

          {/* Pad 3: Lightning Strike */}
          <button
            onClick={() =>
              triggerPad('lightning', () =>
                spatialAudio.playLightningStrike(0, 450, -80)
              )
            }
            className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activePad === 'lightning'
                ? 'bg-amber-500/30 border-amber-400 scale-[0.98] shadow-lg shadow-amber-500/20'
                : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-mono text-neutral-500">STORM</span>
            </div>
            <span className="text-xs font-semibold text-neutral-200">Lightning Whip</span>
            <span className="text-[10px] text-neutral-400">Electrostatic crack + plasma arc</span>
          </button>

          {/* Pad 4: Thunder Rumble */}
          <button
            onClick={() =>
              triggerPad('thunder', () =>
                spatialAudio.playThunder(1.4, 0, 380, -200)
              )
            }
            className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activePad === 'thunder'
                ? 'bg-blue-500/30 border-blue-400 scale-[0.98] shadow-lg shadow-blue-500/20'
                : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <CloudLightning className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] font-mono text-neutral-500">STORM</span>
            </div>
            <span className="text-xs font-semibold text-neutral-200">Sub-Bass Thunder</span>
            <span className="text-[10px] text-neutral-400">Deep 30Hz rolling acoustic wash</span>
          </button>

          {/* Pad 5: Cathedral Church Organ */}
          <button
            onClick={() =>
              triggerPad('organ', () =>
                spatialAudio.playOrganStab(Math.floor(Math.random() * 3))
              )
            }
            className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activePad === 'organ'
                ? 'bg-emerald-500/30 border-emerald-400 scale-[0.98] shadow-lg shadow-emerald-500/20'
                : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Music className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-mono text-neutral-500">CATHEDRAL</span>
            </div>
            <span className="text-xs font-semibold text-neutral-200">Cathedral Organ Stab</span>
            <span className="text-[10px] text-neutral-400">Multi-rank D Minor pipe chord</span>
          </button>

          {/* Pad 6: Town Hall Clock Bell */}
          <button
            onClick={() =>
              triggerPad('bell', () =>
                spatialAudio.playClockBellToll(0, 480, -150)
              )
            }
            className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activePad === 'bell'
                ? 'bg-yellow-500/30 border-yellow-400 scale-[0.98] shadow-lg shadow-yellow-500/20'
                : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Bell className="w-4 h-4 text-yellow-400" />
              <span className="text-[10px] font-mono text-neutral-500">CIVIC</span>
            </div>
            <span className="text-xs font-semibold text-neutral-200">Tower Clock Bell</span>
            <span className="text-[10px] text-neutral-400">Heavy bronze toll with strike overtones</span>
          </button>

          {/* Pad 7: Crypt Door Creak */}
          <button
            onClick={() =>
              triggerPad('creak', () =>
                spatialAudio.playCryptDoorCreak(-140, 80, 50)
              )
            }
            className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activePad === 'creak'
                ? 'bg-orange-500/30 border-orange-400 scale-[0.98] shadow-lg shadow-orange-500/20'
                : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Waves className="w-4 h-4 text-orange-400" />
              <span className="text-[10px] font-mono text-neutral-500">FOLEY</span>
            </div>
            <span className="text-xs font-semibold text-neutral-200">Crypt Door Creak</span>
            <span className="text-[10px] text-neutral-400">Friction stick-slip wood squeal</span>
          </button>

          {/* Pad 8: Cloth Aerodynamic Swoop */}
          <button
            onClick={() =>
              triggerPad('whoosh', () =>
                spatialAudio.playGhostWhoosh(0, 200, 0, 1.4)
              )
            }
            className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activePad === 'whoosh'
                ? 'bg-cyan-500/30 border-cyan-400 scale-[0.98] shadow-lg shadow-cyan-500/20'
                : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Wind className="w-4 h-4 text-cyan-400" />
              <span className="text-[10px] font-mono text-neutral-500">FOLEY</span>
            </div>
            <span className="text-xs font-semibold text-neutral-200">Flight Whoosh</span>
            <span className="text-[10px] text-neutral-400">Doppler aerodynamic air turbulence</span>
          </button>

          {/* Pad 9: Gourd Pumpkin Knock */}
          <button
            onClick={() =>
              triggerPad('pumpkin', () =>
                spatialAudio.playPropBump(120, 60, 60, 'pumpkin')
              )
            }
            className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activePad === 'pumpkin'
                ? 'bg-amber-500/30 border-amber-400 scale-[0.98] shadow-lg shadow-amber-500/20'
                : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-mono text-neutral-500">PROPS</span>
            </div>
            <span className="text-xs font-semibold text-neutral-200">Pumpkin Knock</span>
            <span className="text-[10px] text-neutral-400">Woody hollow gourd impact</span>
          </button>

          {/* Pad 10: Candle Glass Bell */}
          <button
            onClick={() =>
              triggerPad('candle', () =>
                spatialAudio.playPropBump(-120, 160, 80, 'candle')
              )
            }
            className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activePad === 'candle'
                ? 'bg-yellow-500/30 border-yellow-400 scale-[0.98] shadow-lg shadow-yellow-500/20'
                : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Bell className="w-4 h-4 text-yellow-300" />
              <span className="text-[10px] font-mono text-neutral-500">PROPS</span>
            </div>
            <span className="text-xs font-semibold text-neutral-200">Candle Chime</span>
            <span className="text-[10px] text-neutral-400">Crystalline harmonic glass resonance</span>
          </button>

          {/* Pad 11: Cobblestone Thump */}
          <button
            onClick={() =>
              triggerPad('bounce', () =>
                spatialAudio.playFloorBounce(0, 0, 0, 180)
              )
            }
            className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activePad === 'bounce'
                ? 'bg-slate-500/30 border-slate-400 scale-[0.98] shadow-lg shadow-slate-500/20'
                : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Activity className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] font-mono text-neutral-500">PHYSICS</span>
            </div>
            <span className="text-xs font-semibold text-neutral-200">Floor Impact</span>
            <span className="text-[10px] text-neutral-400">Subterranean cobblestone thud</span>
          </button>

          {/* Pad 12: Sub-Bass Abyss Pulse */}
          <button
            onClick={() =>
              triggerPad('abyss', () =>
                spatialAudio.playAbyssPulse()
              )
            }
            className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activePad === 'abyss'
                ? 'bg-red-500/30 border-red-400 scale-[0.98] shadow-lg shadow-red-500/20'
                : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Activity className="w-4 h-4 text-red-500" />
              <span className="text-[10px] font-mono text-neutral-500">SUB-BASS</span>
            </div>
            <span className="text-xs font-semibold text-neutral-200">Abyss Pulse</span>
            <span className="text-[10px] text-neutral-400">28Hz tectonic subterranean surge</span>
          </button>
        </div>
      </div>

      {/* 3. Bottom Grid: Channel Mixer + Acoustic Chamber & Voice Synthesizer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: 5-Channel Sub-Mixer */}
        <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
                5-Channel Audio Mixer
              </h3>
            </div>
            <span className="text-xs text-neutral-500 font-mono">Gain Staging</span>
          </div>

          <div className="space-y-3">
            {[
              {
                id: 'voices' as const,
                label: 'Ghost Voices & Formants',
                icon: Ghost,
                color: 'text-cyan-400',
              },
              {
                id: 'foley' as const,
                label: 'Cloth Foley & Whooshes',
                icon: Wind,
                color: 'text-purple-400',
              },
              {
                id: 'environment' as const,
                label: 'Storm, Thunder & Lightning',
                icon: CloudLightning,
                color: 'text-amber-400',
              },
              {
                id: 'props' as const,
                label: 'Props & Collisions',
                icon: Sparkles,
                color: 'text-yellow-400',
              },
              {
                id: 'drone' as const,
                label: 'Cathedral Organ & Drone',
                icon: Music,
                color: 'text-emerald-400',
              },
            ].map(({ id, label, icon: Icon, color }) => {
              const val = soundSettings.channels[id];
              return (
                <div key={id} className="flex items-center gap-3 bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-850">
                  <Icon className={`w-4 h-4 ${color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-neutral-300 truncate">{label}</span>
                      <span className="text-neutral-400 font-mono text-[11px]">
                        {Math.round(val * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.05"
                      value={val}
                      onChange={(e) => handleChannelChange(id, parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Reverb Chamber & Formant Voice Morph */}
        <div className="space-y-6">
          {/* A. Reverb Chamber Matrix */}
          <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Waves className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
                  Cathedral Convolution Reverb
                </h3>
              </div>
              <span className="text-xs text-neutral-500 font-mono">IR Acoustics</span>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'cathedral' as const, label: 'Cathedral Vault', sub: '3.2s Lush' },
                { id: 'crypt' as const, label: 'Town Hall Crypt', sub: '4.8s Damp' },
                { id: 'square' as const, label: 'Misty Square', sub: '5.8s Dispersed' },
                { id: 'void' as const, label: 'Spectral Void', sub: 'Infinite Tail' },
              ].map((p) => {
                const active = soundSettings.reverbPreset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleReverbPresetChange(p.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      active
                        ? 'bg-purple-950/80 border-purple-500 text-purple-200'
                        : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                    }`}
                  >
                    <span className="text-xs font-semibold">{p.label}</span>
                    <span className="text-[10px] text-neutral-500 font-mono">{p.sub}</span>
                  </button>
                );
              })}
            </div>

            {/* Sliders: Decay & Mix */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-neutral-400">Decay Time</span>
                  <span className="text-purple-300 font-mono text-[11px]">
                    {soundSettings.reverbDecay.toFixed(1)}s
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="6.5"
                  step="0.2"
                  value={soundSettings.reverbDecay}
                  onChange={(e) => handleReverbDecayChange(parseFloat(e.target.value))}
                  className="w-full accent-purple-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-neutral-400">Reverb Wet Mix</span>
                  <span className="text-purple-300 font-mono text-[11px]">
                    {Math.round(soundSettings.reverbMix * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundSettings.reverbMix}
                  onChange={(e) => handleReverbMixChange(parseFloat(e.target.value))}
                  className="w-full accent-purple-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* B. Ghost Voice Formant Synthesizer */}
          <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ghost className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
                  Interactive Ghost Voice Morpher
                </h3>
              </div>
              <button
                onClick={handleAuditionVoice}
                className="px-3 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors active:scale-95"
              >
                <Ghost className="w-3.5 h-3.5" />
                <span>Audition Wail</span>
              </button>
            </div>

            {/* Vowel selector */}
            <div className="space-y-1.5">
              <span className="text-xs text-neutral-400">Resonant Vowel Formant (F1, F2, F3)</span>
              <div className="flex items-center gap-2">
                {(['a', 'e', 'i', 'o', 'u'] as FormantVowel[]).map((vowel) => {
                  const active = vowelChoice === vowel;
                  const labels: Record<FormantVowel, string> = {
                    a: 'A ("Ah")',
                    e: 'E ("Eh")',
                    i: 'I ("Ee")',
                    o: 'O ("Oh")',
                    u: 'U ("Oo")',
                  };
                  return (
                    <button
                      key={vowel}
                      onClick={() => setVowelChoice(vowel)}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                        active
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                      }`}
                    >
                      {labels[vowel]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pitch & Flutter */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-neutral-400">Fundamental Pitch</span>
                  <span className="text-cyan-400 font-mono text-[11px]">{voicePitch} Hz</span>
                </div>
                <input
                  type="range"
                  min="90"
                  max="520"
                  step="10"
                  value={voicePitch}
                  onChange={(e) => setVoicePitch(parseInt(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-neutral-400">Spectral Flutter</span>
                  <span className="text-cyan-400 font-mono text-[11px]">{voiceFlutter.toFixed(1)} Hz</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="14"
                  step="0.5"
                  value={voiceFlutter}
                  onChange={(e) => setVoiceFlutter(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
