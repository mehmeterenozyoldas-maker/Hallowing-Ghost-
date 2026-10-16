import React from 'react';
import { CameraViewMode, ProjectorParams } from '../types';
import { Crosshair, Eye, Video, Maximize2, Camera } from 'lucide-react';

interface ProjectorConsoleProps {
  params: ProjectorParams;
  onChange: (params: ProjectorParams) => void;
  cameraView: CameraViewMode;
  onCameraViewChange: (mode: CameraViewMode) => void;
  onSetReference: () => void;
}

export const ProjectorConsole: React.FC<ProjectorConsoleProps> = ({
  params,
  onChange,
  cameraView,
  onCameraViewChange,
  onSetReference,
}) => {
  const update = <K extends keyof ProjectorParams>(key: K, value: ProjectorParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  const cameraModes: { id: CameraViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'orbit', label: 'Audience Orbit', icon: <Eye className="w-3.5 h-3.5" /> },
    { id: 'projector_pov', label: 'Projector Lens POV', icon: <Video className="w-3.5 h-3.5" /> },
    { id: 'facade', label: 'Town Hall Facade', icon: <Maximize2 className="w-3.5 h-3.5" /> },
    { id: 'focus', label: 'Ghost Close-Up', icon: <Camera className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col gap-5 p-5 text-neutral-200">
      <div>
        <h2 className="text-xs font-bold tracking-wider uppercase text-neutral-400 mb-2.5">
          Camera & Staging Perspective
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {cameraModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onCameraViewChange(mode.id)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                cameraView === mode.id
                  ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-200 shadow-sm'
                  : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              {mode.icon}
              <span className="truncate">{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-neutral-800/80 pt-4">
        <h2 className="text-xs font-bold tracking-wider uppercase text-neutral-400 mb-3">
          Virtual Optical Projector
        </h2>

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Azimuth Angle</span>
              <span className="font-mono tabular-nums text-neutral-200">{params.azimuth}°</span>
            </div>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={params.azimuth}
              onChange={(e) => update('azimuth', parseInt(e.target.value))}
              className="accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Elevation Angle</span>
              <span className="font-mono tabular-nums text-neutral-200">{params.elevation}°</span>
            </div>
            <input
              type="range"
              min={5}
              max={85}
              step={1}
              value={params.elevation}
              onChange={(e) => update('elevation', parseInt(e.target.value))}
              className="accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Throw Distance</span>
              <span className="font-mono tabular-nums text-neutral-200">{params.distance} mm</span>
            </div>
            <input
              type="range"
              min={600}
              max={3000}
              step={50}
              value={params.distance}
              onChange={(e) => update('distance', parseInt(e.target.value))}
              className="accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Lens Field of View (FOV)</span>
              <span className="font-mono tabular-nums text-neutral-200">{params.fov}°</span>
            </div>
            <input
              type="range"
              min={12}
              max={65}
              step={1}
              value={params.fov}
              onChange={(e) => update('fov', parseInt(e.target.value))}
              className="accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-800/80 pt-4">
        <h2 className="text-xs font-bold tracking-wider uppercase text-neutral-400 mb-3">
          Surface Adhesion & Test Pattern
        </h2>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">Projection Tracking</span>
            <select
              value={params.stickMode}
              onChange={(e) => update('stickMode', parseInt(e.target.value))}
              className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1 text-xs text-neutral-200 cursor-pointer"
            >
              <option value={2}>Adheres to Shroud Mesh</option>
              <option value={1}>Spotlight Follows Body</option>
              <option value={0}>Fixed in Spatial Room</option>
            </select>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">Calibration Pattern</span>
            <select
              value={params.testPattern}
              onChange={(e) => update('testPattern', parseInt(e.target.value))}
              className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1 text-xs text-neutral-200 cursor-pointer"
            >
              <option value={0}>Active Spectral Shader</option>
              <option value={1}>Crosshair Alignment Grid</option>
            </select>
          </div>

          <button
            onClick={onSetReference}
            className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 text-neutral-200 transition-colors cursor-pointer mt-1"
          >
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            <span>Lock Reference Coordinates</span>
          </button>
        </div>
      </div>

      <div className="border-t border-neutral-800/80 pt-4">
        <h2 className="text-xs font-bold tracking-wider uppercase text-neutral-400 mb-3">
          Shadows & Environmental Spill
        </h2>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Occlusion Shadow Density</span>
              <span className="font-mono tabular-nums text-neutral-200">{Math.round(params.shadowK * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(params.shadowK * 100)}
              onChange={(e) => update('shadowK', parseInt(e.target.value) / 100)}
              className="accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Plaza Ground Spill</span>
              <span className="font-mono tabular-nums text-neutral-200">{Math.round(params.spill * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(params.spill * 100)}
              onChange={(e) => update('spill', parseInt(e.target.value) / 100)}
              className="accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
              <input
                type="checkbox"
                checked={params.showRig}
                onChange={(e) => update('showRig', e.target.checked)}
                className="accent-cyan-400 rounded cursor-pointer"
              />
              <span>Show Projector Hardware Rig</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
