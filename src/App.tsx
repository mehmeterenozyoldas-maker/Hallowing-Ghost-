import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ActiveTab,
  AudioState,
  BezierNode,
  CameraViewMode,
  ClothParams,
  FlyZone,
  GhostEntityConfig,
  ProjectorParams,
  PropsState,
  ShaderParams,
  SimStats,
  SpatialAudioSettings,
  SoundFxSettings,
  TendrilParams,
  GhostArchetype,
} from './types';
import { SHROUD_PRESETS } from './engine/bezier';
import { SHADER_PRESETS, processUserShader, testUserShader } from './engine/shaders';
import { AudioReactiveEngine } from './engine/audioReactive';
import { TopBar } from './components/TopBar';
import { StageCanvas } from './components/StageCanvas';
import { ProjectorConsole } from './components/ProjectorConsole';
import { ShroudControls } from './components/ShroudControls';
import { ShaderStudio } from './components/ShaderStudio';
import { SilhouetteEditor } from './components/SilhouetteEditor';
import { InstallationHUD } from './components/InstallationHUD';
import { FlyZoneEditor } from './components/FlyZoneEditor';
import { KidControls } from './components/KidControls';
import { PropsConsole } from './components/PropsConsole';
import { SoundFXStudio } from './components/SoundFXStudio';
import { X, SlidersHorizontal, Sparkles } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('stage');
  const [cameraView, setCameraView] = useState<CameraViewMode>('orbit');
  const [panelOpen, setPanelOpen] = useState<boolean>(true);
  const [isKidMode, setIsKidMode] = useState<boolean>(false); // Pro Studio active with all controls and Spectral Shaders tab accessible

  // 2D Spline contour nodes
  const [nodes, setNodes] = useState<BezierNode[]>(() =>
    SHROUD_PRESETS.ethereal_wraith()
  );

  // XPBD Simulation parameters (matching original code: pr=35%, ex=30%, fo=65%, gr=25%)
  const [clothParams, setClothParams] = useState<ClothParams>({
    pressure: 630,      // (35 / 100) * 1800
    stretch: 1.0e-7,    // lerpLog(4e-8, 4e-6, 0.3)
    bend: 6.5e-4,       // lerpLog(1e-7, 1e-2, 0.65)
    gravity: 100,       // (25 / 100) * 400
    smoothing: 3,
    resolution: 1800,
    color: '#d4d4d4',
    gloss: 0.35,
    windStrength: 0,
  });

  // 3D flight boundary with Free Fly Area (Original Stage)
  const [flyZone, setFlyZone] = useState<FlyZone>({
    shape: 'cylinder',
    centerX: 0,
    centerY: 230,
    centerZ: 0,
    radiusX: 520,
    radiusZ: 280,
    minY: 60,
    maxY: 460,
    preset: 'free',
    visibleCage: false,
    unrestricted: true,
  });

  const handleResetGhostCenter = () => {
    setReferenceTrigger((prev) => prev + 1);
  };

  // Ethereal plush ghost fur (rich dense & short velvety fuzz)
  const [tendrilParams, setTendrilParams] = useState<TendrilParams>({
    enabled: true,
    density: 85, // 85k ultra-dense plush fibers
    length: 8.5, // 8.5mm short velvety ghostly fur
    droop: 22,
    wildness: 26,
    inertiaLag: 0.0018,
  });

  // Spatial Projector parameters (aligned directly at hovering wraith)
  const [projectorParams, setProjectorParams] = useState<ProjectorParams>({
    azimuth: 24,
    elevation: 32,
    distance: 1300,
    fov: 32,
    keystone: 0,
    shadowK: 0.85,
    spill: 0.35,
    stickMode: 2, // Adheres to mesh
    testPattern: 0,
    floorProjection: false,
    showRig: false, // Hidden by default so no projector hardware box clutters the stage
  });

  // Projection GLSL shaders (3D Raymarched Wraith & Computational Art)
  const [shaderParams, setShaderParams] = useState<ShaderParams>({
    preset: 'raymarch_phantom',
    userCode: SHADER_PRESETS.raymarch_phantom.code,
    brightness: 1.45,
    contrast: 2.0,
    scale: 32,
    speed: 32,
    hue: 0.0,
    colorize: 0.85,
    reactivity: 0.8,
    resolution: 512,
    chromaticDispersion: 0.45,
    bloomIntensity: 0.85,
    godRays: 0.65,
    morphFactor: 0.5,
    wrinkleReactivity: 0.9,
  });

  // Audio reactivity
  const [audioState, setAudioState] = useState<AudioState>({
    enabled: false,
    mode: 'synthetic',
    volume: 0,
    bass: 0,
    high: 0,
  });
  const [audioEnergy, setAudioEnergy] = useState<number>(0);
  const audioEngineRef = useRef<AudioReactiveEngine | null>(null);

  // Simulation statistics
  const [stats, setStats] = useState<SimStats>({
    fps: 60,
    particles: 1800,
    heightMm: 450,
    volumeLiters: 12.5,
    windSpeed: 0,
  });

  const [referenceTrigger, setReferenceTrigger] = useState<number>(0);
  const [compileError, setCompileError] = useState<string | null>(null);

  // Multi-Ghost Companions roster
  const [ghosts, setGhosts] = useState<GhostEntityConfig[]>([
    {
      id: 'ghost_1',
      name: 'Ethereal Wraith',
      color: '#d4d4d4',
      scale: 1.0,
      pressure: 630,
      offsetX: 0,
      offsetZ: 0,
      enabled: true,
      bounciness: 0.8,
    },
    {
      id: 'ghost_2',
      name: 'Midnight Spectre',
      color: '#a855f7',
      scale: 0.85,
      pressure: 580,
      offsetX: -220,
      offsetZ: 80,
      enabled: true,
      bounciness: 0.85,
    },
    {
      id: 'ghost_3',
      name: 'Pumpkin Poltergeist',
      color: '#f97316',
      scale: 0.75,
      pressure: 720,
      offsetX: 210,
      offsetZ: 60,
      enabled: true,
      bounciness: 0.9,
    },
    {
      id: 'ghost_4',
      name: 'Phantom Banshee',
      color: '#06b6d4',
      scale: 0.9,
      pressure: 600,
      offsetX: -120,
      offsetZ: -180,
      enabled: false,
      bounciness: 0.75,
    },
  ]);

  const [activeGhostId, setActiveGhostId] = useState<string>('ghost_1');

  // Interactive Spooky Props state
  const [propsState, setPropsState] = useState<PropsState>({
    candlesCount: 5,
    pumpkinsCount: 3,
    candleGlow: 1.2,
    pumpkinPhysics: true,
  });

  // Procedural 3D Spatial Audio state
  const [audioSettings, setAudioSettings] = useState<SpatialAudioSettings>({
    enabled: true,
    masterVolume: 0.75,
  });

  const [soundSettings, setSoundSettings] = useState<SoundFxSettings>({
    enabled: true,
    masterVolume: 0.75,
    channels: {
      master: 0.75,
      voices: 0.85,
      foley: 0.8,
      environment: 0.85,
      props: 0.8,
      drone: 0.65,
    },
    reverbPreset: 'cathedral',
    reverbDecay: 3.2,
    reverbMix: 0.42,
    reverbDampening: 4500,
    subBassBoost: true,
    clothFoleySensitivity: 1.0,
  });

  const propsActionsRef = useRef<{
    addCandle: () => void;
    addPumpkin: () => void;
    clearProps: () => void;
    scatterPumpkins: () => void;
  } | null>(null);

  const handleUpdateGhost = (id: string, updates: Partial<GhostEntityConfig>) => {
    setGhosts((prev) =>
      prev.map((g) => {
        if (g.id === id) {
          const updated = { ...g, ...updates };
          if (id === 'ghost_1') {
            if (updates.color) setClothParams((cp) => ({ ...cp, color: updates.color! }));
            if (updates.pressure) setClothParams((cp) => ({ ...cp, pressure: updates.pressure! }));
          }
          return updated;
        }
        return g;
      })
    );
  };

  // Initialize audio engine
  useEffect(() => {
    const engine = new AudioReactiveEngine();
    audioEngineRef.current = engine;

    let animId: number;
    const pollAudio = () => {
      animId = requestAnimationFrame(pollAudio);
      if (engine.isEnabled) {
        const metrics = engine.getMetrics();
        setAudioEnergy(metrics.energy);
        setAudioState((prev) => ({
          ...prev,
          volume: metrics.volume,
          bass: metrics.bass,
          high: metrics.high,
        }));
      } else {
        setAudioEnergy(0);
      }
    };
    animId = requestAnimationFrame(pollAudio);

    return () => {
      cancelAnimationFrame(animId);
      engine.disable();
    };
  }, []);

  const handleToggleAudio = () => {
    const engine = audioEngineRef.current;
    if (!engine) return;
    engine.toggle();
    setAudioState((prev) => ({
      ...prev,
      enabled: engine.isEnabled,
      mode: engine.mode,
    }));
  };

  const handleToggleMic = async () => {
    const engine = audioEngineRef.current;
    if (!engine) return;
    if (engine.mode === 'mic') {
      engine.enableSynthetic();
    } else {
      await engine.enableMic();
    }
    setAudioState((prev) => ({
      ...prev,
      enabled: engine.isEnabled,
      mode: engine.mode,
    }));
  };

  const handleApplyUserShader = (code: string): string | null => {
    let err: string | null = null;
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        const processed = processUserShader(code);
        err = testUserShader(processed, gl);
      }
    } catch {
      // Ignore validation context allocation quirks
    }
    setCompileError(err);
    if (!err) {
      setShaderParams((prev) => ({ ...prev, userCode: code }));
    }
    return err;
  };

  const handleSelectPreset = (presetKey: string) => {
    const factory = SHROUD_PRESETS[presetKey];
    if (factory) {
      const newNodes = factory();
      setNodes(newNodes);
    }
  };

  const handleLoadArchetype = (arch: GhostArchetype) => {
    if (arch.nodes && arch.nodes.length >= 3) {
      setNodes(arch.nodes.map((n) => ({ ...n })));
    }
    if (arch.shaderParams) {
      setShaderParams((prev) => ({
        ...prev,
        ...arch.shaderParams,
      }));
      if (arch.shaderParams.userCode) {
        handleApplyUserShader(arch.shaderParams.userCode);
      }
    }
  };

  const handleTabChange = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab !== 'stage' && tab !== 'sculptor') {
      setPanelOpen(true);
    }
  }, []);

  return (
    <div className="flex flex-col w-screen h-screen bg-[#08090c] text-neutral-100 overflow-hidden font-sans">
      {/* Universal 3-zone Top Bar */}
      <TopBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        audioState={audioState}
        onToggleAudio={handleToggleAudio}
        onToggleMic={handleToggleMic}
        isKidMode={isKidMode}
        onToggleKidMode={() => setIsKidMode((k) => !k)}
      />

      {/* Main Workspace Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {activeTab === 'sculptor' ? (
          <SilhouetteEditor
            initialNodes={nodes}
            onApply={(updatedNodes) => {
              setNodes(updatedNodes);
              setActiveTab('stage');
            }}
            onCancel={() => setActiveTab('stage')}
            onLoadArchetype={handleLoadArchetype}
          />
        ) : activeTab === 'shader' ? (
          <ShaderStudio
            params={shaderParams}
            onChange={setShaderParams}
            onApplyShader={handleApplyUserShader}
            lastCompileError={compileError}
            onReturnToStage={() => setActiveTab('stage')}
            audioEnergy={audioEnergy}
            onLoadArchetype={handleLoadArchetype}
          />
        ) : activeTab === 'sound' ? (
          <div className="relative w-full h-full flex flex-col bg-neutral-950">
            <div className="flex items-center justify-between px-6 py-2 bg-neutral-900/90 border-b border-neutral-800 text-xs shrink-0">
              <span className="text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                GOTHIC SOUND DESIGN CONSOLE · PROCEDURAL FM & CONVOLUTION REVERB
              </span>
              <button
                onClick={() => setActiveTab('stage')}
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium transition-colors cursor-pointer text-xs"
              >
                Return to 3D Stage →
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <SoundFXStudio
                soundSettings={soundSettings}
                onUpdateSettings={(updates) => setSoundSettings((prev) => ({ ...prev, ...updates }))}
                isKidMode={isKidMode}
              />
            </div>
          </div>
        ) : (
          <>
            {/* 3D WebGL Projection Mapping Canvas */}
            <StageCanvas
              nodes={nodes}
              clothParams={{ ...clothParams, arenaRadius: flyZone.radiusX, flyZone }}
              tendrilParams={tendrilParams}
              projectorParams={projectorParams}
              shaderParams={shaderParams}
              cameraView={cameraView}
              audioEnergy={audioEnergy}
              onStatsUpdate={setStats}
              onCompileError={setCompileError}
              referenceTrigger={referenceTrigger}
              ghosts={ghosts}
              activeGhostId={activeGhostId}
              onSelectActiveGhost={setActiveGhostId}
              propsState={propsState}
              onRegisterPropsActions={(actions) => {
                propsActionsRef.current = actions;
              }}
            />

            {/* Real-time telemetry & interaction HUD */}
            <InstallationHUD
              stats={stats}
              audioState={audioState}
              audioEnergy={audioEnergy}
            />

            {/* Toggle Dock Button when panel is closed */}
            {!panelOpen && (
              <button
                onClick={() => setPanelOpen(true)}
                className="absolute right-6 top-6 flex items-center gap-2 px-3.5 py-2 bg-neutral-950/85 backdrop-blur-md border border-neutral-800/80 rounded-xl text-neutral-200 text-xs font-semibold hover:bg-neutral-900 transition-all cursor-pointer shadow-xl z-20 active:scale-95"
              >
                {isKidMode ? (
                  <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                ) : (
                  <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span>{isKidMode ? '🎈 Magic Toys Panel' : 'Show Controls'}</span>
              </button>
            )}

            {/* Floating Glass Control Panel */}
            {panelOpen && (isKidMode || activeTab !== 'stage') && (
              <aside className="absolute right-6 top-6 bottom-6 w-96 max-w-[calc(100vw-3rem)] bg-neutral-950/85 backdrop-blur-xl border border-neutral-800/80 rounded-2xl shadow-2xl flex flex-col z-20 overflow-hidden animate-in fade-in duration-200">
                {/* Panel Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800/80 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold tracking-wider uppercase text-neutral-200">
                      {activeTab === 'props' && (isKidMode ? '🎃 Spooky Toys & Friends' : '🎃 Entities & Spooky Props')}
                      {activeTab === 'flyzone' && '🏰 Ghost Flight Area'}
                      {activeTab !== 'props' && activeTab !== 'flyzone' && isKidMode && '🎈 Magic Ghost Playroom'}
                      {!isKidMode && activeTab === 'projector' && 'Projector Calibration Rig'}
                      {!isKidMode && activeTab === 'shroud' && 'Hollow Shroud & Drapery'}
                    </span>
                  </div>
                  <button
                    onClick={() => setPanelOpen(false)}
                    className="p-1 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
                    title="Collapse Panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Panel Scrollable Content */}
                <div className="flex-1 overflow-y-auto">
                  {activeTab === 'props' ? (
                    <PropsConsole
                      ghosts={ghosts}
                      activeGhostId={activeGhostId}
                      onSelectActiveGhost={setActiveGhostId}
                      onUpdateGhost={handleUpdateGhost}
                      propsState={propsState}
                      onUpdatePropsState={(updates) => setPropsState((prev) => ({ ...prev, ...updates }))}
                      onAddCandle={() => propsActionsRef.current?.addCandle()}
                      onAddPumpkin={() => propsActionsRef.current?.addPumpkin()}
                      onClearProps={() => propsActionsRef.current?.clearProps()}
                      onScatterPumpkins={() => propsActionsRef.current?.scatterPumpkins()}
                      audioSettings={audioSettings}
                      onUpdateAudioSettings={(updates) => setAudioSettings((prev) => ({ ...prev, ...updates }))}
                    />
                  ) : isKidMode && activeTab !== 'flyzone' ? (
                    <KidControls
                      clothParams={clothParams}
                      onClothChange={setClothParams}
                      tendrilParams={tendrilParams}
                      onTendrilChange={setTendrilParams}
                      shaderParams={shaderParams}
                      onShaderChange={setShaderParams}
                      flyZone={flyZone}
                      onFlyZoneChange={setFlyZone}
                      audioState={audioState}
                      onToggleAudio={handleToggleAudio}
                      onToggleMic={handleToggleMic}
                      onResetGhostCenter={handleResetGhostCenter}
                    />
                  ) : activeTab === 'flyzone' ? (
                    <FlyZoneEditor
                      flyZone={flyZone}
                      onChange={setFlyZone}
                      onResetGhostCenter={handleResetGhostCenter}
                    />
                  ) : (
                    <>
                      {activeTab === 'projector' && (
                        <ProjectorConsole
                          params={projectorParams}
                          onChange={setProjectorParams}
                          cameraView={cameraView}
                          onCameraViewChange={setCameraView}
                          onSetReference={() => setReferenceTrigger((prev) => prev + 1)}
                        />
                      )}

                      {activeTab === 'shroud' && (
                        <ShroudControls
                          clothParams={{ ...clothParams, arenaRadius: flyZone.radiusX, flyZone }}
                          onClothChange={(newParams) => {
                            setClothParams(newParams);
                            if (newParams.arenaRadius !== undefined) {
                              const r = newParams.arenaRadius;
                              setFlyZone((prev) => ({ ...prev, radiusX: r }));
                            }
                          }}
                          tendrilParams={tendrilParams}
                          onTendrilChange={setTendrilParams}
                          onRebuild={() => setNodes([...nodes])}
                          onSelectPreset={handleSelectPreset}
                        />
                      )}
                    </>
                  )}
                </div>
              </aside>
            )}
          </>
        )}
      </div>
    </div>
  );
}
