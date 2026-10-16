import React from 'react';
import { GhostEntityConfig, PropsState, SpatialAudioSettings } from '../types';
import { spatialAudio } from '../engine/spatialAudio';
import {
  Ghost,
  Flame,
  Volume2,
  VolumeX,
  Play,
  Sparkles,
  Plus,
  Trash2,
  Shuffle,
  ShieldAlert,
} from 'lucide-react';

interface PropsConsoleProps {
  ghosts: GhostEntityConfig[];
  activeGhostId: string;
  onSelectActiveGhost: (id: string) => void;
  onUpdateGhost: (id: string, updates: Partial<GhostEntityConfig>) => void;
  propsState: PropsState;
  onUpdatePropsState: (updates: Partial<PropsState>) => void;
  onAddCandle: () => void;
  onAddPumpkin: () => void;
  onClearProps: () => void;
  onScatterPumpkins: () => void;
  audioSettings: SpatialAudioSettings;
  onUpdateAudioSettings: (updates: Partial<SpatialAudioSettings>) => void;
}

export const PropsConsole: React.FC<PropsConsoleProps> = ({
  ghosts,
  activeGhostId,
  onSelectActiveGhost,
  onUpdateGhost,
  propsState,
  onUpdatePropsState,
  onAddCandle,
  onAddPumpkin,
  onClearProps,
  onScatterPumpkins,
  audioSettings,
  onUpdateAudioSettings,
}) => {
  const activeGhost = ghosts.find((g) => g.id === activeGhostId) || ghosts[0];

  const handleAudition = (type: 'stretch' | 'bounce' | 'pumpkin' | 'candle') => {
    switch (type) {
      case 'stretch':
        spatialAudio.playGhostStretch(0, 200, 0, 0.8);
        break;
      case 'bounce':
        spatialAudio.playFloorBounce(0, 0, 0, 220);
        break;
      case 'pumpkin':
        spatialAudio.playPropBump(0, 40, 0, 'pumpkin');
        break;
      case 'candle':
        spatialAudio.playCandleWhoosh(0, 220, 0);
        break;
    }
  };

  return (
    <div className="p-5 space-y-6 text-neutral-200">
      {/* 1. Multi-Ghost Roster */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ghost className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Ghost Companions ({ghosts.filter((g) => g.enabled).length}/{ghosts.length})
            </h3>
          </div>
          <span className="text-[10px] text-neutral-400 font-mono">MVP2 XPBD</span>
        </div>

        {/* Ghost selection tabs */}
        <div className="grid grid-cols-2 gap-2">
          {ghosts.map((g) => {
            const isSelected = g.id === activeGhostId;
            return (
              <div
                key={g.id}
                onClick={() => onSelectActiveGhost(g.id)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-neutral-900 border-cyan-500/80 shadow-md ring-1 ring-cyan-500/30'
                    : 'bg-neutral-950/70 border-neutral-800/80 hover:bg-neutral-900/60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20"
                    style={{ backgroundColor: g.color }}
                  />
                  <div className="truncate">
                    <p className={`text-xs font-semibold truncate ${isSelected ? 'text-cyan-200' : 'text-neutral-300'}`}>
                      {g.name}
                    </p>
                    <p className="text-[10px] text-neutral-500">
                      {g.enabled ? `${Math.round(g.scale * 100)}% size` : 'Sleeping'}
                    </p>
                  </div>
                </div>

                {/* Companion toggle switch */}
                <input
                  type="checkbox"
                  checked={g.enabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    onUpdateGhost(g.id, { enabled: e.target.checked });
                  }}
                  className="w-3.5 h-3.5 rounded accent-cyan-400 cursor-pointer"
                  title="Enable/Disable ghost companion"
                />
              </div>
            );
          })}
        </div>

        {/* Selected Ghost Inspector */}
        {activeGhost && (
          <div className="p-3 bg-neutral-900/50 border border-neutral-800/80 rounded-xl space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-300">
                Editing: {activeGhost.name}
              </span>
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] text-neutral-400">Tint</label>
                <input
                  type="color"
                  value={activeGhost.color}
                  onChange={(e) => onUpdateGhost(activeGhost.id, { color: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                />
              </div>
            </div>

            {/* Ghost scale */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-neutral-400">Scale & Presence</span>
                <span className="font-mono text-cyan-300">
                  {Math.round(activeGhost.scale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={activeGhost.scale}
                onChange={(e) => onUpdateGhost(activeGhost.id, { scale: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1 bg-neutral-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Ghost pressure */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-neutral-400">Inflation Pressure</span>
                <span className="font-mono text-cyan-300">{activeGhost.pressure} Pa</span>
              </div>
              <input
                type="range"
                min="200"
                max="1200"
                step="25"
                value={activeGhost.pressure}
                onChange={(e) => onUpdateGhost(activeGhost.id, { pressure: parseInt(e.target.value) })}
                className="w-full accent-cyan-400 h-1 bg-neutral-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Ghost bounciness */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-neutral-400">Elastic Bounciness</span>
                <span className="font-mono text-cyan-300">
                  {Math.round(activeGhost.bounciness * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={activeGhost.bounciness}
                onChange={(e) => onUpdateGhost(activeGhost.id, { bounciness: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1 bg-neutral-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        )}
      </section>

      {/* 2. Interactive Spooky Props */}
      <section className="space-y-3 pt-2 border-t border-neutral-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Interactive Spooky Props
            </h3>
          </div>
          <button
            onClick={onClearProps}
            className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
            title="Clear all props"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        </div>

        {/* Action spawner buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onAddCandle}
            className="flex items-center justify-center gap-2 py-2 px-3 bg-neutral-900 hover:bg-neutral-800 border border-amber-500/30 hover:border-amber-500/60 rounded-xl text-xs font-medium text-amber-200 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>+ Float Candle</span>
          </button>

          <button
            onClick={onAddPumpkin}
            className="flex items-center justify-center gap-2 py-2 px-3 bg-neutral-900 hover:bg-neutral-800 border border-orange-500/30 hover:border-orange-500/60 rounded-xl text-xs font-medium text-orange-200 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 text-orange-400" />
            <span>+ Jack-o'-Lantern</span>
          </button>
        </div>

        {/* Kick/Scatter pumpkins burst button */}
        <button
          onClick={onScatterPumpkins}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-orange-950/70 to-amber-950/70 hover:from-orange-900/80 hover:to-amber-900/80 border border-orange-600/40 rounded-xl text-xs font-semibold text-orange-200 transition-all cursor-pointer active:scale-95 shadow-md"
        >
          <Shuffle className="w-3.5 h-3.5 text-orange-400" />
          <span>🎃 Kick & Scatter Pumpkins (Impulse Blast)</span>
        </button>

        {/* Candle Glow Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-neutral-400">Candle Glow Intensity</span>
            <span className="font-mono text-amber-300">
              {Math.round(propsState.candleGlow * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.2"
            max="2.5"
            step="0.1"
            value={propsState.candleGlow}
            onChange={(e) => onUpdatePropsState({ candleGlow: parseFloat(e.target.value) })}
            className="w-full accent-amber-400 h-1 bg-neutral-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Pumpkin physics toggle */}
        <div className="flex items-center justify-between py-1 text-xs">
          <span className="text-neutral-300">Pumpkin Restitution Physics</span>
          <input
            type="checkbox"
            checked={propsState.pumpkinPhysics}
            onChange={(e) => onUpdatePropsState({ pumpkinPhysics: e.target.checked })}
            className="w-4 h-4 rounded accent-orange-400 cursor-pointer"
          />
        </div>
      </section>

      {/* 3. Procedural 3D Spatial Audio Engine */}
      <section className="space-y-3 pt-2 border-t border-neutral-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {audioSettings.enabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-neutral-500" />
            )}
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Procedural Spatial Audio
            </h3>
          </div>
          <input
            type="checkbox"
            checked={audioSettings.enabled}
            onChange={(e) => {
              const en = e.target.checked;
              onUpdateAudioSettings({ enabled: en });
              spatialAudio.setEnabled(en);
            }}
            className="w-4 h-4 rounded accent-emerald-400 cursor-pointer"
            title="Enable/Mute procedural sound effects"
          />
        </div>

        {/* Master SFX Volume */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-neutral-400">Haunting SFX Volume</span>
            <span className="font-mono text-emerald-300">
              {Math.round(audioSettings.masterVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={audioSettings.masterVolume}
            onChange={(e) => {
              const vol = parseFloat(e.target.value);
              onUpdateAudioSettings({ masterVolume: vol });
              spatialAudio.setMasterVolume(vol);
            }}
            className="w-full accent-emerald-400 h-1 bg-neutral-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Quick Audition Soundboard */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
            Spatial Acoustic Patches
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => handleAudition('stretch')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-[11px] text-cyan-300 transition-colors cursor-pointer"
            >
              <Play className="w-3 h-3 text-cyan-400" />
              <span>Stretch Chime</span>
            </button>
            <button
              onClick={() => handleAudition('bounce')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-[11px] text-purple-300 transition-colors cursor-pointer"
            >
              <Play className="w-3 h-3 text-purple-400" />
              <span>Floor Thud</span>
            </button>
            <button
              onClick={() => handleAudition('pumpkin')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-[11px] text-orange-300 transition-colors cursor-pointer"
            >
              <Play className="w-3 h-3 text-orange-400" />
              <span>Pumpkin Knock</span>
            </button>
            <button
              onClick={() => handleAudition('candle')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-[11px] text-amber-300 transition-colors cursor-pointer"
            >
              <Play className="w-3 h-3 text-amber-400" />
              <span>Candle Whoosh</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
