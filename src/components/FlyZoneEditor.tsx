import React, { useRef } from 'react';
import { FlyZone } from '../types';
import { Compass, Eye, EyeOff, RotateCcw, Circle, Move } from 'lucide-react';

interface FlyZoneEditorProps {
  flyZone: FlyZone;
  onChange: (zone: FlyZone) => void;
  onResetGhostCenter?: () => void;
}

export const FlyZoneEditor: React.FC<FlyZoneEditorProps> = ({
  flyZone,
  onChange,
  onResetGhostCenter,
}) => {
  const mapRef = useRef<HTMLDivElement | null>(null);

  const updateZone = <K extends keyof FlyZone>(key: K, value: FlyZone[K]) => {
    onChange({ ...flyZone, [key]: value, preset: key === 'preset' ? (value as any) : 'custom' });
  };

  const presets: { id: FlyZone['preset']; label: string; icon: string; desc: string; zone: Partial<FlyZone> }[] = [
    {
      id: 'free',
      label: 'Free Fly (Original Stage)',
      icon: '🌌',
      desc: 'Free unrestricted flight across the entire stage with no walls or cages',
      zone: {
        shape: 'cylinder',
        centerX: 0,
        centerY: 230,
        centerZ: 0,
        radiusX: 520,
        radiusZ: 280,
        minY: 60,
        maxY: 460,
        visibleCage: false,
        unrestricted: true,
      },
    },
    {
      id: 'center',
      label: 'Center Stage',
      icon: '🎪',
      desc: 'Balanced theatrical arena for dramatic hovering',
      zone: {
        shape: 'cylinder',
        centerX: 0,
        centerY: 230,
        centerZ: 0,
        radiusX: 175,
        radiusZ: 145,
        minY: 85,
        maxY: 345,
        visibleCage: true,
        unrestricted: false,
      },
    },
    {
      id: 'playpen',
      label: 'Cozy Playpen',
      icon: '🧸',
      desc: 'Small safe perimeter, stays close to front and center',
      zone: {
        shape: 'cylinder',
        centerX: 0,
        centerY: 220,
        centerZ: 20,
        radiusX: 110,
        radiusZ: 95,
        minY: 90,
        maxY: 300,
        visibleCage: true,
        unrestricted: false,
      },
    },
    {
      id: 'wide',
      label: 'Wide Playground',
      icon: '🦅',
      desc: 'Extended flight area across all columns and wings',
      zone: {
        shape: 'cylinder',
        centerX: 0,
        centerY: 240,
        centerZ: 10,
        radiusX: 270,
        radiusZ: 190,
        minY: 70,
        maxY: 380,
        visibleCage: true,
        unrestricted: false,
      },
    },
    {
      id: 'balcony',
      label: 'Gothic High Flight',
      icon: '🏰',
      desc: 'Soars high in the air near the grand arches & rose window',
      zone: {
        shape: 'cylinder',
        centerX: 0,
        centerY: 310,
        centerZ: -30,
        radiusX: 200,
        radiusZ: 140,
        minY: 170,
        maxY: 440,
        visibleCage: true,
        unrestricted: false,
      },
    },
  ];

  const handleApplyPreset = (p: typeof presets[0]) => {
    onChange({
      ...flyZone,
      ...p.zone,
      preset: p.id,
      unrestricted: p.id === 'free',
    });
  };

  // Interactive 2D Stage Map dragging
  const handleMapPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width; // 0 to 1 (left to right = -X to +X)
    const py = (e.clientY - rect.top) / rect.height; // 0 to 1 (top to bottom = -Z back to +Z front)

    // Map: X is -300 to +300 mm, Z is -200 (back wall) to +200 (front lip)
    const newX = Math.round((px - 0.5) * 560);
    const newZ = Math.round((py - 0.5) * 360);

    onChange({
      ...flyZone,
      centerX: Math.max(-200, Math.min(200, newX)),
      centerZ: Math.max(-140, Math.min(140, newZ)),
      preset: 'custom',
      unrestricted: false,
    });
  };

  // Coordinates for the 2D SVG map representation
  const mapW = 320;
  const mapH = 180;
  const isFreeMode = flyZone.preset === 'free' || flyZone.unrestricted;
  const mapCenterX = mapW / 2 + (flyZone.centerX / 280) * (mapW / 2 - 20);
  const mapCenterZ = mapH / 2 + (flyZone.centerZ / 180) * (mapH / 2 - 20);
  const mapRadX = Math.max(25, (flyZone.radiusX / 280) * (mapW / 2 - 20));
  const mapRadZ = Math.max(20, (flyZone.radiusZ / 180) * (mapH / 2 - 20));

  return (
    <div className="flex flex-col gap-4 p-5 text-neutral-200">
      {/* Free Fly vs Limited Area Mode Switcher */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-900/90 rounded-xl border border-neutral-800">
        <button
          onClick={() =>
            onChange({
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
          className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            isFreeMode
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
          }`}
        >
          <span className="text-sm">🌌</span>
          <span>Free Fly (Original)</span>
        </button>
        <button
          onClick={() =>
            onChange({
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
          className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            !isFreeMode
              ? 'bg-neutral-800 text-cyan-300 border border-neutral-700 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
          }`}
        >
          <span className="text-sm">🎯</span>
          <span>Limited Arena</span>
        </button>
      </div>

      {/* Header with 3D boundary fence & reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold tracking-wider uppercase text-neutral-300">
            {isFreeMode ? 'Original Stage (Free Fly)' : 'Custom Flight Area'}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => updateZone('visibleCage', !flyZone.visibleCage)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors cursor-pointer ${
              flyZone.visibleCage
                ? 'bg-cyan-950/60 border-cyan-700/60 text-cyan-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
            title={flyZone.visibleCage ? 'Hide 3D Magic Boundary Fence' : 'Show 3D Magic Boundary Fence'}
          >
            {flyZone.visibleCage ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span className="text-[11px] hidden sm:inline">3D Fence</span>
          </button>
          {onResetGhostCenter && (
            <button
              onClick={onResetGhostCenter}
              className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs flex items-center gap-1 cursor-pointer transition-colors"
              title="Summon Ghost to Center of Fly Zone"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] hidden sm:inline">Center</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive 2D Stage Fly Map */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-neutral-400 flex items-center gap-1">
            <Move className="w-3 h-3 text-cyan-400" />
            <span>Click or Drag on Stage to Move Flight Center</span>
          </span>
          <span className="font-mono tabular-nums text-cyan-300 text-[11px]">
            X: {Math.round(flyZone.centerX)}mm · Z: {Math.round(flyZone.centerZ)}mm
          </span>
        </div>

        <div
          ref={mapRef}
          onPointerDown={handleMapPointer}
          onPointerMove={(e) => {
            if (e.buttons === 1) handleMapPointer(e);
          }}
          className="relative w-full h-44 bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden cursor-crosshair select-none flex items-center justify-center shadow-inner"
        >
          {/* SVG Stage layout visualizer */}
          <svg className="w-full h-full" viewBox={`0 0 ${mapW} ${mapH}`}>
            {/* Stage Back Wall & Architecture facade */}
            <rect x="15" y="10" width={mapW - 30} height="12" fill="#1e293b" rx="2" />
            <text x={mapW / 2} y="19" fill="#64748b" fontSize="8" textAnchor="middle" fontWeight="bold">
              HISTORIC TOWN HALL FACADE (BACK WALL)
            </text>

            {/* Stage floor grid */}
            <line x1="20" y1={mapH / 2} x2={mapW - 20} y2={mapH / 2} stroke="#334155" strokeDasharray="3 3" />
            <line x1={mapW / 2} y1="25" x2={mapW / 2} y2={mapH - 15} stroke="#334155" strokeDasharray="3 3" />

            {/* Front Stage Apron */}
            <rect x="25" y={mapH - 18} width={mapW - 50} height="8" fill="#78350f" opacity="0.6" rx="2" />
            <text x={mapW / 2} y={mapH - 12} fill="#ca8a04" fontSize="7" textAnchor="middle">
              STAGE APRON & FOOTLIGHTS (FRONT)
            </text>

            {/* User Defined Flight Boundary */}
            {isFreeMode ? (
              <>
                <rect
                  x="20"
                  y="26"
                  width={mapW - 40}
                  height={mapH - 46}
                  rx="14"
                  fill="rgba(56, 189, 248, 0.08)"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={mapW / 2}
                  y={mapH / 2 + 3}
                  fill="#38bdf8"
                  fontSize="9"
                  textAnchor="middle"
                  fontWeight="bold"
                  opacity="0.85"
                >
                  ✨ FULL ORIGINAL STAGE FREE FLY ✨
                </text>
              </>
            ) : (
              <>
                <ellipse
                  cx={mapCenterX}
                  cy={mapCenterZ}
                  rx={mapRadX}
                  ry={mapRadZ}
                  fill="rgba(56, 189, 248, 0.12)"
                  stroke="#38bdf8"
                  strokeWidth="1.8"
                />
                {/* Flight Center Pin */}
                <circle cx={mapCenterX} cy={mapCenterZ} r="5" fill="#38bdf8" />
                <circle cx={mapCenterX} cy={mapCenterZ} r="10" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.6" />
                <circle cx={mapCenterX} cy={mapCenterZ} r="2" fill="#08090c" />
              </>
            )}
          </svg>

          {/* Badge indicator */}
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-neutral-900/85 backdrop-blur-xs text-[10px] text-cyan-300 font-mono border border-neutral-800">
            {isFreeMode ? '🌌 Free Roam (Original Stage)' : '🎯 Limited Arena'}
          </div>
        </div>
      </div>

      {/* Preset Quick Selections */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold tracking-wider uppercase text-neutral-400">
          Flight Area Presets
        </span>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((p) => {
            const isSelected = flyZone.preset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleApplyPreset(p)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-500/80 text-neutral-100 shadow-sm'
                    : 'bg-neutral-900/50 border-neutral-800/80 hover:border-neutral-700 text-neutral-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{p.icon}</span>
                  <span className="text-xs font-semibold">{p.label}</span>
                </div>
                <p className="text-[10px] text-neutral-400 line-clamp-2 leading-relaxed">
                  {p.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fine-Tuning Sliders */}
      <div className="flex flex-col gap-3.5 pt-2 border-t border-neutral-800/80">
        <span className="text-xs font-bold tracking-wider uppercase text-neutral-400">
          Spatial Dimensions (Millimeters)
        </span>

        {/* Width (X radius) */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Flight Width (X-Span)</span>
            <span className="font-mono tabular-nums text-cyan-400 font-medium">
              ±{Math.round(flyZone.radiusX)} mm ({Math.round(flyZone.radiusX * 2)} mm total)
            </span>
          </div>
          <input
            type="range"
            min={70}
            max={300}
            step={5}
            value={flyZone.radiusX}
            onChange={(e) => updateZone('radiusX', parseInt(e.target.value))}
            className="accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Depth (Z radius) */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Flight Depth (Front-Back Z)</span>
            <span className="font-mono tabular-nums text-cyan-400 font-medium">
              ±{Math.round(flyZone.radiusZ)} mm ({Math.round(flyZone.radiusZ * 2)} mm total)
            </span>
          </div>
          <input
            type="range"
            min={60}
            max={240}
            step={5}
            value={flyZone.radiusZ}
            onChange={(e) => updateZone('radiusZ', parseInt(e.target.value))}
            className="accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Floor Clearance Min Height */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Floor Clearance (Lowest Flight Y)</span>
            <span className="font-mono tabular-nums text-neutral-200">
              {Math.round(flyZone.minY)} mm above stage
            </span>
          </div>
          <input
            type="range"
            min={60}
            max={190}
            step={5}
            value={flyZone.minY}
            onChange={(e) => updateZone('minY', parseInt(e.target.value))}
            className="accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Ceiling Limit Max Height */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Ceiling Limit (Highest Flight Y)</span>
            <span className="font-mono tabular-nums text-neutral-200">
              {Math.round(flyZone.maxY)} mm (Arch clearance)
            </span>
          </div>
          <input
            type="range"
            min={240}
            max={480}
            step={10}
            value={flyZone.maxY}
            onChange={(e) => updateZone('maxY', parseInt(e.target.value))}
            className="accent-cyan-400 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
