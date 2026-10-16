import React from 'react';
import { SimStats, AudioState } from '../types';
import { Activity, Wind, Volume2 } from 'lucide-react';

interface InstallationHUDProps {
  stats: SimStats;
  audioState: AudioState;
  audioEnergy: number;
}

export const InstallationHUD: React.FC<InstallationHUDProps> = ({
  stats,
  audioState,
  audioEnergy,
}) => {
  return (
    <div className="absolute left-6 bottom-6 flex flex-col gap-2.5 pointer-events-none select-none z-20">
      {/* Telemetry pill */}
      <div className="flex items-center gap-4 px-3.5 py-2 bg-neutral-950/80 backdrop-blur-md border border-neutral-800/80 rounded-xl text-neutral-300 text-xs shadow-lg">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-mono tabular-nums font-semibold text-neutral-100">{stats.fps}</span>
          <span className="text-[10px] text-neutral-400">FPS</span>
        </div>

        <span className="text-neutral-700" aria-hidden="true">·</span>

        <div className="flex items-center gap-1">
          <span className="font-mono tabular-nums font-semibold text-neutral-100">{stats.particles}</span>
          <span className="text-[10px] text-neutral-400">Particles</span>
        </div>

        <span className="text-neutral-700" aria-hidden="true">·</span>

        <div className="flex items-center gap-1">
          <span className="font-mono tabular-nums font-semibold text-neutral-100">{Math.round(stats.heightMm)}</span>
          <span className="text-[10px] text-neutral-400">mm Height</span>
        </div>

        <span className="text-neutral-700" aria-hidden="true">·</span>

        <div className="flex items-center gap-1">
          <span className="font-mono tabular-nums font-semibold text-neutral-100">
            {stats.volumeLiters.toFixed(1)}
          </span>
          <span className="text-[10px] text-neutral-400">L Volume</span>
        </div>
      </div>

      {/* Dynamic status indicators */}
      <div className="flex items-center gap-3">
        {stats.windSpeed > 0.05 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-950/70 backdrop-blur-sm border border-neutral-800/70 rounded-lg text-xs text-cyan-300">
            <Wind className="w-3.5 h-3.5 animate-pulse" />
            <span>Spatial Wind:</span>
            <span className="font-mono tabular-nums">{Math.round(stats.windSpeed * 100)}%</span>
          </div>
        )}

        {audioState.enabled && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-950/70 backdrop-blur-sm border border-cyan-800/50 rounded-lg text-xs text-cyan-200">
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Resonance:</span>
            <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 rounded-full transition-all duration-75"
                style={{ width: `${Math.min(100, Math.round(audioEnergy * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Quick gesture guide */}
      <div className="text-[11px] text-neutral-400 max-w-xl bg-neutral-950/75 border border-neutral-800/60 backdrop-blur-xs px-3 py-1.5 rounded-lg flex items-center gap-2">
        <span className="text-cyan-400 font-medium">Custom Fly Area</span>
        <span className="text-neutral-700">·</span>
        <span className="text-emerald-400 font-medium">Fast Snap-Back</span>
        <span className="text-neutral-700">·</span>
        <span className="text-pink-400 font-medium">Kid Play Mode</span>
        <span className="text-neutral-700">·</span>
        <span>WSAD: Camera · Mouse: Move Ghost</span>
      </div>
    </div>
  );
};
