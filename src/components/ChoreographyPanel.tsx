import React from 'react';
import {
  ChoreographyShow,
  EnvironmentAtmosphere,
  GhostEntityConfig,
  LightningFrequency,
  PlaybackState,
} from '../types';
import {
  Zap,
  CloudFog,
  Music,
  Wind,
  Plus,
  Trash2,
  Sliders,
  Sparkles,
  Layers,
  Radio,
} from 'lucide-react';

interface ChoreographyPanelProps {
  show: ChoreographyShow;
  onUpdateShow: (show: ChoreographyShow) => void;
  playback: PlaybackState;
  onUpdatePlayback: (updates: Partial<PlaybackState>) => void;
  atmosphere: EnvironmentAtmosphere;
  onUpdateAtmosphere: (updates: Partial<EnvironmentAtmosphere>) => void;
  ghosts: GhostEntityConfig[];
  activeGhostId: string;
  onSelectActiveGhost: (id: string) => void;
  onStrikeLightning: () => void;
  onFogSurge: () => void;
  onOrganStab: () => void;
  onAddKeyframeCurrentGhost: () => void;
  onSelectPreset: (presetKey: string) => void;
}

export const ChoreographyPanel: React.FC<ChoreographyPanelProps> = ({
  show,
  onUpdateShow,
  playback,
  onUpdatePlayback,
  atmosphere,
  onUpdateAtmosphere,
  ghosts,
  activeGhostId,
  onSelectActiveGhost,
  onStrikeLightning,
  onFogSurge,
  onOrganStab,
  onAddKeyframeCurrentGhost,
  onSelectPreset,
}) => {
  const activeTrack = show.tracks.find((t) => t.ghostId === activeGhostId);
  const activeGhost = ghosts.find((g) => g.id === activeGhostId);

  const handleClearTrack = (trackId: string) => {
    onUpdateShow({
      ...show,
      tracks: show.tracks.map((t) => (t.id === trackId ? { ...t, keyframes: [] } : t)),
    });
  };

  const handleToggleTrackVisible = (trackId: string) => {
    onUpdateShow({
      ...show,
      tracks: show.tracks.map((t) => (t.id === trackId ? { ...t, visible: !t.visible } : t)),
    });
  };

  return (
    <div className="p-5 space-y-6 text-neutral-200">
      {/* 1. Show Preset & Master Settings */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            🎭 Show Preset & Choreography
          </span>
          <span className="text-[11px] font-mono text-cyan-400">
            {show.duration.toFixed(1)}s Loop
          </span>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] text-neutral-400">Preset Haunt Routine</label>
          <div className="grid grid-cols-1 gap-1.5">
            {[
              { id: 'midnight_spiral', name: 'The Midnight Spiral', desc: 'Ascending vortex with spire strikes' },
              { id: 'poltergeist_tempest', name: 'Poltergeist Tempest', desc: 'Erratic darting sweeps & thunder' },
              { id: 'phantom_waltz', name: 'Phantom Waltz', desc: 'Synchronized dual-ghost figure eight' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectPreset(p.id)}
                className={`flex flex-col text-left px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                  show.id === p.id
                    ? 'bg-cyan-950/50 border-cyan-500/70 text-cyan-200 shadow-md ring-1 ring-cyan-500/30'
                    : 'bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:bg-neutral-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{p.name}</span>
                  {show.id === p.id && (
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">ACTIVE</span>
                  )}
                </div>
                <span className="text-[10px] text-neutral-400 mt-0.5">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Show Duration slider */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Show Duration</span>
            <span className="font-mono text-cyan-400 font-semibold">{show.duration}s</span>
          </div>
          <input
            type="range"
            min={8}
            max={40}
            step={1}
            value={show.duration}
            onChange={(e) => onUpdateShow({ ...show, duration: Number(e.target.value) })}
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </section>

      {/* 2. Atmospheric Ground Fog System */}
      <section className="space-y-3 pt-3 border-t border-neutral-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CloudFog className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Volumetric Ground Mist
            </span>
          </div>
          <button
            onClick={onFogSurge}
            className="px-2 py-0.5 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-700/60 rounded text-[10px] font-semibold text-cyan-300 transition-colors cursor-pointer"
          >
            Fog Surge
          </button>
        </div>

        {/* Fog Density Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Mist Density</span>
            <span className="font-mono text-cyan-400">{atmosphere.fogDensity.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0}
            max={2.5}
            step={0.05}
            value={atmosphere.fogDensity}
            onChange={(e) => onUpdateAtmosphere({ fogDensity: Number(e.target.value) })}
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Fog Height Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Hover Altitude</span>
            <span className="font-mono text-cyan-400">{Math.round(atmosphere.fogHeight)} mm</span>
          </div>
          <input
            type="range"
            min={20}
            max={180}
            step={5}
            value={atmosphere.fogHeight}
            onChange={(e) => onUpdateAtmosphere({ fogHeight: Number(e.target.value) })}
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Mist Speed Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Wind Turbulence Speed</span>
            <span className="font-mono text-cyan-400">{atmosphere.fogSpeed.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={2.5}
            step={0.1}
            value={atmosphere.fogSpeed}
            onChange={(e) => onUpdateAtmosphere({ fogSpeed: Number(e.target.value) })}
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </section>

      {/* 3. Dynamic Lightning & Storm Flashes */}
      <section className="space-y-3 pt-3 border-t border-neutral-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Lightning & Thunder Storm
            </span>
          </div>
          <button
            onClick={onStrikeLightning}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-md text-xs transition-colors cursor-pointer shadow-sm active:scale-95"
          >
            ⚡ Strike Now
          </button>
        </div>

        {/* Lightning Frequency Buttons */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-neutral-400">Storm Frequency</label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['off', 'rare', 'medium', 'storm'] as LightningFrequency[]).map((freq) => (
              <button
                key={freq}
                onClick={() => onUpdateAtmosphere({ lightningFrequency: freq })}
                className={`py-1.5 text-xs font-semibold rounded-lg capitalize border transition-all cursor-pointer ${
                  atmosphere.lightningFrequency === freq
                    ? 'bg-amber-950/70 border-amber-500/80 text-amber-300 ring-1 ring-amber-400/40'
                    : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {freq}
              </button>
            ))}
          </div>
        </div>

        {/* Ambient Storm Darkness */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Storm Sky Darkness</span>
            <span className="font-mono text-cyan-400">
              {Math.round(atmosphere.stormDarkness * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={0.9}
            step={0.05}
            value={atmosphere.stormDarkness}
            onChange={(e) => onUpdateAtmosphere({ stormDarkness: Number(e.target.value) })}
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </section>

      {/* 4. Flight Track Control for Active Ghost */}
      <section className="space-y-3 pt-3 border-t border-neutral-800/80">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
            👻 Ghost Flight Path Track
          </span>
          <span className="text-[11px] font-mono text-cyan-400">
            {activeGhost?.name || 'Selected Ghost'}
          </span>
        </div>

        {/* Active ghost selector pills */}
        <div className="grid grid-cols-2 gap-1.5">
          {ghosts.map((g) => (
            <button
              key={g.id}
              onClick={() => onSelectActiveGhost(g.id)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                activeGhostId === g.id
                  ? 'bg-neutral-800 border-cyan-500 text-neutral-100 font-medium'
                  : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span
                style={{ backgroundColor: g.color }}
                className="w-2.5 h-2.5 rounded-full shrink-0"
              />
              <span className="truncate">{g.name}</span>
            </button>
          ))}
        </div>

        {/* Track actions */}
        {activeTrack && (
          <div className="space-y-2 bg-neutral-900/70 p-3 rounded-xl border border-neutral-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Recorded Keyframes</span>
              <span className="font-mono text-cyan-400 font-bold">
                {activeTrack.keyframes.length} waypoints
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={onAddKeyframeCurrentGhost}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold rounded-lg text-xs transition-colors cursor-pointer active:scale-95 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Keyframe At Playhead</span>
              </button>

              <button
                onClick={() => handleClearTrack(activeTrack.id)}
                className="px-2.5 py-2 bg-neutral-800 hover:bg-rose-950/60 hover:text-rose-300 text-neutral-400 rounded-lg text-xs transition-colors cursor-pointer"
                title="Clear track keyframes"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
