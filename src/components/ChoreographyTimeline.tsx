import React, { useRef, useState, useEffect } from 'react';
import {
  ChoreographyShow,
  EnvironmentAtmosphere,
  FlightKeyframe,
  PlaybackState,
  ShowCue,
  ShowCueType,
} from '../types';
import {
  Play,
  Pause,
  RotateCcw,
  Repeat,
  Radio,
  Zap,
  CloudFog,
  Music,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  Wind,
} from 'lucide-react';

interface ChoreographyTimelineProps {
  show: ChoreographyShow;
  onUpdateShow: (show: ChoreographyShow) => void;
  playback: PlaybackState;
  onUpdatePlayback: (updates: Partial<PlaybackState>) => void;
  atmosphere: EnvironmentAtmosphere;
  onUpdateAtmosphere: (updates: Partial<EnvironmentAtmosphere>) => void;
  activeGhostId: string;
  onSelectActiveGhost: (id: string) => void;
  onStrikeLightning: () => void;
  onFogSurge: () => void;
  onOrganStab: () => void;
  onAddKeyframeCurrentGhost: () => void;
  onSelectPreset: (presetKey: string) => void;
}

export const ChoreographyTimeline: React.FC<ChoreographyTimelineProps> = ({
  show,
  onUpdateShow,
  playback,
  onUpdatePlayback,
  atmosphere,
  onUpdateAtmosphere,
  activeGhostId,
  onSelectActiveGhost,
  onStrikeLightning,
  onFogSurge,
  onOrganStab,
  onAddKeyframeCurrentGhost,
  onSelectPreset,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [selectedCueType, setSelectedCueType] = useState<ShowCueType>('lightning');
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingPlayheadRef = useRef<boolean>(false);

  // Handle timeline scrubbing
  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return;
    isDraggingPlayheadRef.current = true;
    updatePlayheadFromMouse(e.clientX);

    const handleMouseMove = (ev: MouseEvent) => {
      if (isDraggingPlayheadRef.current) {
        updatePlayheadFromMouse(ev.clientX);
      }
    };

    const handleMouseUp = () => {
      isDraggingPlayheadRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const updatePlayheadFromMouse = (clientX: number) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = ratio * show.duration;
    onUpdatePlayback({ currentTime: Math.round(newTime * 100) / 100 });
  };

  const handleAddCueAtCurrentTime = () => {
    const newCue: ShowCue = {
      id: `cue_${Date.now()}`,
      time: Math.round(playback.currentTime * 10) / 10,
      type: selectedCueType,
      intensity: 1.5,
      label: selectedCueType.toUpperCase(),
    };
    onUpdateShow({
      ...show,
      cues: [...show.cues, newCue],
    });
  };

  const handleDeleteCue = (cueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateShow({
      ...show,
      cues: show.cues.filter((c) => c.id !== cueId),
    });
  };

  const handleDeleteKeyframe = (trackId: string, kfId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateShow({
      ...show,
      tracks: show.tracks.map((t) =>
        t.id === trackId
          ? { ...t, keyframes: t.keyframes.filter((k) => k.id !== kfId) }
          : t
      ),
    });
  };

  const cueIcon = (type: ShowCueType) => {
    switch (type) {
      case 'lightning':
        return <Zap className="w-3 h-3 text-amber-300" />;
      case 'thunder':
        return <span className="text-[10px]">🌩️</span>;
      case 'fog_burst':
        return <CloudFog className="w-3 h-3 text-cyan-300" />;
      case 'organ_stab':
        return <Music className="w-3 h-3 text-purple-300" />;
      case 'whoosh':
        return <Wind className="w-3 h-3 text-emerald-300" />;
    }
  };

  const playheadPercent = (playback.currentTime / Math.max(0.1, show.duration)) * 100;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 select-none bg-neutral-950/92 backdrop-blur-xl border-t border-neutral-800/90 shadow-2xl transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-neutral-800/80">
        <div className="flex items-center gap-3">
          {/* Collapse toggle */}
          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            title={isExpanded ? 'Collapse Timeline' : 'Expand Timeline'}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          {/* Transport Controls */}
          <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
            <button
              onClick={() => onUpdatePlayback({ currentTime: 0 })}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300 transition-colors cursor-pointer"
              title="Rewind to Start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onUpdatePlayback({ isPlaying: !playback.isPlaying })}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer shadow-sm ${
                playback.isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950'
              }`}
              title={playback.isPlaying ? 'Pause Show' : 'Play Show'}
            >
              {playback.isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play Show</span>
                </>
              )}
            </button>

            <button
              onClick={() => onUpdatePlayback({ loop: !playback.loop })}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                playback.loop
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60'
                  : 'text-neutral-400 hover:bg-neutral-800'
              }`}
              title="Toggle Loop"
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Time Counter */}
          <div className="px-3 py-1 bg-neutral-900/90 border border-neutral-800 rounded-md font-mono text-xs text-cyan-300 font-bold tracking-wider">
            {playback.currentTime.toFixed(1)}s{' '}
            <span className="text-neutral-500 font-normal">/ {show.duration.toFixed(1)}s</span>
          </div>

          {/* Flight Path Live Recording Button */}
          <button
            onClick={() => {
              const nextRec = !playback.isRecording;
              onUpdatePlayback({
                isRecording: nextRec,
                recordingGhostId: nextRec ? activeGhostId : null,
              });
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md ${
              playback.isRecording
                ? 'bg-rose-600 text-white animate-pulse ring-2 ring-rose-400/60'
                : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/80'
            }`}
            title="Record ghost mouse drags live into keyframes"
          >
            <Radio className={`w-3.5 h-3.5 ${playback.isRecording ? 'animate-spin' : 'text-rose-400'}`} />
            <span>{playback.isRecording ? 'Recording Flight...' : 'Record Flight'}</span>
          </button>

          {/* 3D Spline Ribbons Toggle */}
          <button
            onClick={() => onUpdatePlayback({ showFlightRibbons: !playback.showFlightRibbons })}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
              playback.showFlightRibbons
                ? 'bg-cyan-950/70 text-cyan-300 border-cyan-700/60'
                : 'bg-neutral-900/80 text-neutral-400 border-neutral-800 hover:text-neutral-200'
            }`}
            title="Toggle 3D Flight Spline Trajectories in Viewport"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">3D Flight Path</span>
          </button>
        </div>

        {/* Center / Right: Presets & Quick FX */}
        <div className="flex items-center gap-2">
          {/* Show Preset Selector */}
          <select
            value={show.id}
            onChange={(e) => onSelectPreset(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs rounded-lg px-2.5 py-1.5 outline-none cursor-pointer focus:border-cyan-500"
          >
            <option value="midnight_spiral">Preset: The Midnight Spiral</option>
            <option value="poltergeist_tempest">Preset: Poltergeist Tempest</option>
            <option value="phantom_waltz">Preset: Phantom Waltz</option>
          </select>

          {/* Quick Realtime Environmental Triggers */}
          <div className="flex items-center gap-1.5 border-l border-neutral-800 pl-2">
            <button
              onClick={onStrikeLightning}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-700/50 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Strike Lightning & Thunder"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Strike</span>
            </button>

            <button
              onClick={onFogSurge}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-700/50 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Surge Ground Fog"
            >
              <CloudFog className="w-3.5 h-3.5 text-cyan-400" />
              <span>Fog Surge</span>
            </button>

            <button
              onClick={onOrganStab}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-700/50 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Play Gothic Organ Chord"
            >
              <Music className="w-3.5 h-3.5 text-purple-400" />
              <span>Organ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Multi-Track Timeline Body */}
      {isExpanded && (
        <div className="px-5 py-3 space-y-2">
          {/* Timeline Toolbar (Add Keyframe / Cue) */}
          <div className="flex items-center justify-between text-xs text-neutral-400 pb-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider">
                Keyframes & Atmospheric Cues
              </span>
              <button
                onClick={onAddKeyframeCurrentGhost}
                className="flex items-center gap-1 px-2 py-0.5 bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-300 border border-cyan-700/50 rounded text-[11px] font-medium transition-colors cursor-pointer"
                title="Add keyframe for active ghost at current playhead position"
              >
                <Plus className="w-3 h-3" />
                <span>+ Keyframe (Current Pos)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-neutral-400">Add Cue:</span>
              <select
                value={selectedCueType}
                onChange={(e) => setSelectedCueType(e.target.value as ShowCueType)}
                className="bg-neutral-900 border border-neutral-800 text-neutral-300 text-[11px] rounded px-1.5 py-0.5 outline-none"
              >
                <option value="lightning">⚡ Lightning Flash</option>
                <option value="thunder">🌩️ Thunder Rumble</option>
                <option value="fog_burst">🌫️ Fog Surge</option>
                <option value="organ_stab">🎹 Organ Stab</option>
                <option value="whoosh">💨 Flight Whoosh</option>
              </select>
              <button
                onClick={handleAddCueAtCurrentTime}
                className="flex items-center gap-1 px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-[11px] font-medium transition-colors cursor-pointer"
                title="Insert cue at playhead"
              >
                <Plus className="w-3 h-3" />
                <span>Drop Cue</span>
              </button>
            </div>
          </div>

          {/* Ruler & Playhead Track Container */}
          <div
            ref={rulerRef}
            onMouseDown={handleRulerMouseDown}
            className="relative h-7 bg-neutral-900/90 rounded border border-neutral-800 cursor-pointer overflow-hidden"
          >
            {/* Seconds Ticks */}
            {Array.from({ length: Math.ceil(show.duration) + 1 }).map((_, sec) => {
              const pct = (sec / show.duration) * 100;
              return (
                <div
                  key={sec}
                  style={{ left: `${pct}%` }}
                  className="absolute top-0 bottom-0 border-l border-neutral-800/80 pointer-events-none flex flex-col justify-between pl-1"
                >
                  <span className="text-[9px] font-mono text-neutral-500 leading-none pt-0.5">
                    {sec}s
                  </span>
                </div>
              );
            })}

            {/* Glowing Red Playhead Line */}
            <div
              style={{ left: `${playheadPercent}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] z-20 pointer-events-none"
            >
              <div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 bg-rose-500 rotate-45 rounded-xs" />
            </div>
          </div>

          {/* Show Cues Track */}
          <div className="relative h-6 bg-neutral-900/50 rounded border border-neutral-800/60 overflow-hidden flex items-center">
            <div className="absolute left-2 text-[10px] font-mono text-neutral-500 pointer-events-none uppercase">
              Storm Cues
            </div>
            {/* Cue markers */}
            {show.cues.map((cue) => {
              const cuePct = (cue.time / show.duration) * 100;
              return (
                <div
                  key={cue.id}
                  style={{ left: `${cuePct}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdatePlayback({ currentTime: cue.time });
                  }}
                  className="absolute -translate-x-1/2 flex items-center justify-center p-1 bg-neutral-950 border border-neutral-700 hover:border-amber-400 rounded-full cursor-pointer group z-10 transition-transform hover:scale-125"
                  title={`${cue.label || cue.type} at ${cue.time}s (Click to jump)`}
                >
                  {cueIcon(cue.type)}
                  <button
                    onClick={(e) => handleDeleteCue(cue.id, e)}
                    className="absolute -top-5 hidden group-hover:flex items-center p-0.5 bg-neutral-950 border border-neutral-800 rounded text-neutral-400 hover:text-rose-400"
                    title="Delete cue"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            })}
            {/* Playhead indicator on cue track */}
            <div
              style={{ left: `${playheadPercent}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500/60 pointer-events-none z-15"
            />
          </div>

          {/* Ghost Flight Tracks */}
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {show.tracks.map((track) => {
              const isActiveGhost = track.ghostId === activeGhostId;
              return (
                <div
                  key={track.id}
                  onClick={() => onSelectActiveGhost(track.ghostId)}
                  className={`relative h-6 rounded border flex items-center transition-colors cursor-pointer ${
                    isActiveGhost
                      ? 'bg-neutral-900 border-neutral-700 ring-1 ring-cyan-500/40'
                      : 'bg-neutral-900/40 border-neutral-800/60 hover:bg-neutral-900/80'
                  }`}
                >
                  <div className="flex items-center gap-1.5 px-2.5 shrink-0 z-10">
                    <span
                      style={{ backgroundColor: track.color }}
                      className="w-2 h-2 rounded-full inline-block shrink-0 shadow-sm"
                    />
                    <span className="text-[11px] font-medium text-neutral-300 whitespace-nowrap">
                      {track.name}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      ({track.keyframes.length} pts)
                    </span>
                  </div>

                  {/* Keyframe diamonds on track */}
                  <div className="relative flex-1 h-full">
                    {track.keyframes.map((kf) => {
                      const kfPct = (kf.time / show.duration) * 100;
                      return (
                        <div
                          key={kf.id}
                          style={{ left: `${kfPct}%` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdatePlayback({ currentTime: kf.time });
                          }}
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 rounded-xs cursor-pointer group z-10 transition-transform hover:scale-150"
                        >
                          <div
                            style={{ backgroundColor: track.color }}
                            className="w-full h-full border border-neutral-900 shadow-sm"
                          />
                          <button
                            onClick={(e) => handleDeleteKeyframe(track.id, kf.id, e)}
                            className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center p-0.5 bg-neutral-950 border border-neutral-800 rounded text-neutral-400 hover:text-rose-400"
                            title="Delete keyframe"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      );
                    })}

                    {/* Playhead indicator */}
                    <div
                      style={{ left: `${playheadPercent}%` }}
                      className="absolute top-0 bottom-0 w-0.5 bg-rose-500/60 pointer-events-none z-15"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
