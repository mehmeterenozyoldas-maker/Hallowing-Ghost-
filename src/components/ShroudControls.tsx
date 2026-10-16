import React from 'react';
import { ClothParams, TendrilParams } from '../types';
import { RefreshCw, Sparkles, Wind, Layers } from 'lucide-react';

interface ShroudControlsProps {
  clothParams: ClothParams;
  onClothChange: (params: ClothParams) => void;
  tendrilParams: TendrilParams;
  onTendrilChange: (params: TendrilParams) => void;
  onRebuild: () => void;
  onSelectPreset: (presetKey: string) => void;
}

export const ShroudControls: React.FC<ShroudControlsProps> = ({
  clothParams,
  onClothChange,
  tendrilParams,
  onTendrilChange,
  onRebuild,
  onSelectPreset,
}) => {
  const updateCloth = <K extends keyof ClothParams>(key: K, value: ClothParams[K]) => {
    onClothChange({ ...clothParams, [key]: value });
  };

  const updateTendril = <K extends keyof TendrilParams>(key: K, value: TendrilParams[K]) => {
    onTendrilChange({ ...tendrilParams, [key]: value });
  };

  const presets = [
    { id: 'ethereal_wraith', label: 'Ethereal Wraith' },
    { id: 'gothic_arch', label: 'Gothic Arch' },
    { id: 'flowing_cloak', label: 'Flowing Cloak' },
    { id: 'hollow_veil', label: 'Hollow Veil' },
  ];

  return (
    <div className="flex flex-col gap-5 p-5 text-neutral-200">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-bold tracking-wider uppercase text-neutral-400">
            Hollow Shroud Silhouette
          </h2>
          <button
            onClick={onRebuild}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-neutral-950 font-semibold rounded transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Re-inflate</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset.id)}
              className="px-3 py-2 text-xs font-medium bg-neutral-900/60 hover:bg-neutral-800/80 border border-neutral-800 hover:border-neutral-700 rounded-lg text-neutral-300 transition-colors cursor-pointer text-left truncate"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-neutral-800/80 pt-4">
        <h2 className="text-xs font-bold tracking-wider uppercase text-neutral-400 mb-3 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>XPBD Cloth Dynamics</span>
        </h2>

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Inflation Pressure</span>
              <span className="font-mono tabular-nums text-neutral-200">
                {Math.round((clothParams.pressure / 1800) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              step={1}
              value={Math.round((clothParams.pressure / 1800) * 100)}
              onChange={(e) => updateCloth('pressure', (parseInt(e.target.value) / 100) * 1800)}
              className="accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Stretch Resistance</span>
              <span className="font-mono tabular-nums text-neutral-200">
                {Math.round((Math.log(clothParams.stretch / 4e-8) / Math.log(4e-6 / 4e-8)) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round((Math.log(clothParams.stretch / 4e-8) / Math.log(4e-6 / 4e-8)) * 100)}
              onChange={(e) => {
                const t = parseInt(e.target.value) / 100;
                updateCloth('stretch', Math.exp(Math.log(4e-8) + (Math.log(4e-6) - Math.log(4e-8)) * t));
              }}
              className="accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Wrinkle / Bending Softness</span>
              <span className="font-mono tabular-nums text-neutral-200">
                {Math.round((Math.log(clothParams.bend / 1e-7) / Math.log(1e-2 / 1e-7)) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round((Math.log(clothParams.bend / 1e-7) / Math.log(1e-2 / 1e-7)) * 100)}
              onChange={(e) => {
                const t = parseInt(e.target.value) / 100;
                updateCloth('bend', Math.exp(Math.log(1e-7) + (Math.log(1e-2) - Math.log(1e-7)) * t));
              }}
              className="accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Gravity Pull</span>
              <span className="font-mono tabular-nums text-neutral-200">
                {Math.round((clothParams.gravity / 400) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round((clothParams.gravity / 400) * 100)}
              onChange={(e) => updateCloth('gravity', (parseInt(e.target.value) / 100) * 400)}
              className="accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Taubin Surface Smoothing</span>
              <span className="font-mono tabular-nums text-neutral-200">{clothParams.smoothing} iters</span>
            </div>
            <input
              type="range"
              min={0}
              max={6}
              step={1}
              value={clothParams.smoothing}
              onChange={(e) => updateCloth('smoothing', parseInt(e.target.value))}
              className="accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-2 p-2.5 bg-neutral-900/60 rounded-xl border border-neutral-800">
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-300 font-semibold flex items-center gap-1.5">
                <span>🌌</span>
                <span>Flight Arena Freedom</span>
              </span>
              <span className="text-cyan-400 font-mono text-[11px]">
                {clothParams.flyZone?.preset === 'free' || clothParams.flyZone?.unrestricted
                  ? 'Free Roam'
                  : `±${Math.round(clothParams.arenaRadius ?? 180)}mm`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  updateCloth('flyZone', {
                    ...(clothParams.flyZone || {
                      shape: 'cylinder',
                      centerX: 0,
                      centerY: 230,
                      centerZ: 0,
                      radiusX: 520,
                      radiusZ: 280,
                      minY: 60,
                      maxY: 460,
                    }),
                    preset: 'free',
                    unrestricted: true,
                    visibleCage: false,
                  });
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  clothParams.flyZone?.preset === 'free' || clothParams.flyZone?.unrestricted
                    ? 'bg-cyan-600 text-neutral-950 font-bold'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-750'
                }`}
              >
                <span>🌌 Free Fly (Stage)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  updateCloth('flyZone', {
                    ...(clothParams.flyZone || {
                      shape: 'cylinder',
                      centerX: 0,
                      centerY: 230,
                      centerZ: 0,
                      minY: 85,
                      maxY: 345,
                    }),
                    preset: 'center',
                    unrestricted: false,
                    radiusX: clothParams.arenaRadius || 180,
                    radiusZ: (clothParams.arenaRadius || 180) * 0.82,
                    visibleCage: true,
                  });
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  clothParams.flyZone?.preset !== 'free' && !clothParams.flyZone?.unrestricted
                    ? 'bg-cyan-600 text-neutral-950 font-bold'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-750'
                }`}
              >
                <span>🎯 Confined Arena</span>
              </button>
            </div>

            {(!clothParams.flyZone || (!clothParams.flyZone.unrestricted && clothParams.flyZone.preset !== 'free')) && (
              <div className="flex flex-col gap-1 mt-1">
                <input
                  type="range"
                  min={100}
                  max={260}
                  step={5}
                  value={Math.round(clothParams.arenaRadius ?? 180)}
                  onChange={(e) => updateCloth('arenaRadius', parseInt(e.target.value))}
                  className="accent-cyan-400 cursor-pointer"
                />
              </div>
            )}
            <p className="text-[11px] text-neutral-500">
              {clothParams.flyZone?.preset === 'free' || clothParams.flyZone?.unrestricted
                ? 'Original stage mode: Ghost flies freely across the entire stage with no invisible walls or cages.'
                : 'Confines the ghost floating and mouse movements strictly within the limited stage perimeter.'}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-800/80 pt-4">
        <h2 className="text-xs font-bold tracking-wider uppercase text-neutral-400 mb-3 flex items-center gap-1.5">
          <Wind className="w-3.5 h-3.5 text-cyan-400" />
          <span>Spatial Cursor Wind Vortex</span>
        </h2>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Aerodynamic Wind Response</span>
            <span className="font-mono tabular-nums text-neutral-200">
              {Math.round(clothParams.windStrength * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(clothParams.windStrength * 100)}
            onChange={(e) => updateCloth('windStrength', parseInt(e.target.value) / 100)}
            className="accent-cyan-400 cursor-pointer"
          />
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Moving your cursor around the ghost generates swirling spatial air currents.
          </p>
        </div>
      </div>

      <div className="border-t border-neutral-800/80 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold tracking-wider uppercase text-neutral-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Plush Ghost Fur</span>
          </h2>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={tendrilParams.enabled}
              onChange={(e) => updateTendril('enabled', e.target.checked)}
              className="accent-cyan-400 rounded cursor-pointer"
            />
            <span>Enabled</span>
          </label>
        </div>

        {tendrilParams.enabled && (
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Fur Density</span>
                <span className="font-mono tabular-nums text-neutral-200">{tendrilParams.density}k fibers</span>
              </div>
              <input
                type="range"
                min={15}
                max={150}
                step={5}
                value={tendrilParams.density}
                onChange={(e) => updateTendril('density', parseInt(e.target.value))}
                className="accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Fur Length</span>
                <span className="font-mono tabular-nums text-neutral-200">{tendrilParams.length} mm</span>
              </div>
              <input
                type="range"
                min={4}
                max={25}
                step={1}
                value={tendrilParams.length}
                onChange={(e) => updateTendril('length', parseInt(e.target.value))}
                className="accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Wispy Sag / Droop</span>
                <span className="font-mono tabular-nums text-neutral-200">{tendrilParams.droop}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={tendrilParams.droop}
                onChange={(e) => updateTendril('droop', parseInt(e.target.value))}
                className="accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Organic Wildness</span>
                <span className="font-mono tabular-nums text-neutral-200">{tendrilParams.wildness}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={tendrilParams.wildness}
                onChange={(e) => updateTendril('wildness', parseInt(e.target.value))}
                className="accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-neutral-800/80 pt-4">
        <h2 className="text-xs font-bold tracking-wider uppercase text-neutral-400 mb-3">
          Fabric Material Appearance
        </h2>
        <div className="flex items-center justify-between text-xs mb-3">
          <span className="text-neutral-400">Base Shroud Tint</span>
          <input
            type="color"
            value={clothParams.color}
            onChange={(e) => updateCloth('color', e.target.value)}
            className="w-8 h-7 bg-transparent border border-neutral-700 rounded cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Specular Sheen / Gloss</span>
            <span className="font-mono tabular-nums text-neutral-200">
              {Math.round(clothParams.gloss * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(clothParams.gloss * 100)}
            onChange={(e) => updateCloth('gloss', parseInt(e.target.value) / 100)}
            className="accent-cyan-400 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
