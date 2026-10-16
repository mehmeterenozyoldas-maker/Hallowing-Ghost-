import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CosinePalette, GhostArchetype, ShaderParams } from '../types';
import {
  SHADER_PRESETS,
  processUserShader,
  testUserShader,
  QFS_TEMPLATE,
} from '../engine/shaders';
import {
  COSINE_PALETTES,
  BUILTIN_ARCHETYPES,
  loadUserArchetypes,
  saveUserArchetype,
} from '../engine/archetypes';
import {
  SpectralVideoPipeline,
  VideoSourceType,
} from '../engine/videoTexture';
import {
  Code,
  Play,
  Pause,
  Sparkles,
  Sliders,
  Check,
  Send,
  Radio,
  Palette,
  BookmarkPlus,
  Volume2,
  VolumeX,
  Layers,
  Activity,
  AlertCircle,
  CheckCircle2,
  Video,
  Camera,
  Upload,
  Eye,
  RefreshCw,
  MonitorPlay,
  Maximize2,
} from 'lucide-react';

interface ShaderStudioProps {
  params: ShaderParams;
  onChange: (params: ShaderParams) => void;
  onApplyShader: (code: string) => string | null;
  lastCompileError: string | null;
  onReturnToStage?: () => void;
  audioEnergy?: number;
  onLoadArchetype?: (archetype: GhostArchetype) => void;
  onSaveArchetype?: (name: string, desc: string) => void;
}

type CategoryFilter = 'all' | 'raymarch' | 'fractal' | 'morphogenesis' | 'visage';
type PreviewModelType = 'cloth' | 'sphere' | 'quad';

export const ShaderStudio: React.FC<ShaderStudioProps> = ({
  params,
  onChange,
  onApplyShader,
  lastCompileError,
  onReturnToStage,
  audioEnergy = 0,
  onLoadArchetype,
  onSaveArchetype,
}) => {
  const [localCode, setLocalCode] = useState(params.userCode);
  const [compileError, setCompileError] = useState<string | null>(lastCompileError);
  const [deploySuccess, setDeploySuccess] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [previewModel, setPreviewModel] = useState<PreviewModelType>('cloth');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(60);

  // Audio Reactivity State
  const [audioReactiveEnabled, setAudioReactiveEnabled] = useState<boolean>(true);
  const [audioSensitivity, setAudioSensitivity] = useState<number>(1.2);
  const [simulatedBass, setSimulatedBass] = useState<number>(0);

  // Cosine Palette Generator State
  const [activePaletteKey, setActivePaletteKey] = useState<string>('phantom_cyan');
  const [paletteParams, setPaletteParams] = useState<CosinePalette>(COSINE_PALETTES.phantom_cyan);
  const [paletteDrawerOpen, setPaletteDrawerOpen] = useState<boolean>(false);
  const paletteCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Archetype Modal State
  const [archetypeDropdownOpen, setArchetypeDropdownOpen] = useState<boolean>(false);
  const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false);
  const [newArchetypeName, setNewArchetypeName] = useState<string>('');
  const [newArchetypeDesc, setNewArchetypeDesc] = useState<string>('');
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);
  const [userArchetypes, setUserArchetypes] = useState<GhostArchetype[]>(() => loadUserArchetypes());

  // Video & Webcam Spectral Projection State
  const [videoEnabled, setVideoEnabled] = useState<boolean>(params.videoEnabled ?? false);
  const [videoSource, setVideoSource] = useState<VideoSourceType>(params.videoSource ?? 'mist_loop');
  const [videoBlendMode, setVideoBlendMode] = useState<number>(params.videoBlendMode ?? 0);
  const [videoThreshold, setVideoThreshold] = useState<number>(params.videoThreshold ?? 0.35);
  const [videoExposure, setVideoExposure] = useState<number>(params.videoExposure ?? 1.4);
  const [videoStatus, setVideoStatus] = useState<string>('Ready');
  const [videoDrawerOpen, setVideoDrawerOpen] = useState<boolean>(true);
  const videoPipelineRef = useRef<SpectralVideoPipeline | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const videoEnabledRef = useRef<boolean>(videoEnabled);
  const videoBlendModeRef = useRef<number>(videoBlendMode);
  const videoThresholdRef = useRef<number>(videoThreshold);
  const videoExposureRef = useRef<number>(videoExposure);

  useEffect(() => {
    videoEnabledRef.current = videoEnabled;
  }, [videoEnabled]);
  useEffect(() => {
    videoBlendModeRef.current = videoBlendMode;
  }, [videoBlendMode]);
  useEffect(() => {
    videoThresholdRef.current = videoThreshold;
  }, [videoThreshold]);
  useEffect(() => {
    videoExposureRef.current = videoExposure;
  }, [videoExposure]);

  // Preview Three.js References
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const previewMeshRef = useRef<THREE.Mesh | null>(null);

  // Render Target for live procedural texture simulation
  const quadSceneRef = useRef<THREE.Scene | null>(null);
  const quadCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const quadMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const rtRef = useRef<THREE.WebGLRenderTarget | null>(null);

  const uniformsRef = useRef<{
    uTime: THREE.IUniform<number>;
    uScale: THREE.IUniform<number>;
    uRes: THREE.IUniform<THREE.Vector2>;
    uMouse: THREE.IUniform<THREE.Vector2>;
    uWindVel: THREE.IUniform<THREE.Vector2>;
    uMorph: THREE.IUniform<number>;
    uBass: THREE.IUniform<number>;
    uCurvature: THREE.IUniform<number>;
    uVideoTexture: THREE.IUniform<THREE.Texture>;
    uVideoEnabled: THREE.IUniform<number>;
    uVideoBlend: THREE.IUniform<number>;
    uVideoThreshold: THREE.IUniform<number>;
    uVideoChroma: THREE.IUniform<number>;
    uVideoExposure: THREE.IUniform<number>;
  }>({
    uTime: { value: 0 },
    uScale: { value: params.scale },
    uRes: { value: new THREE.Vector2(512, 512) },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uWindVel: { value: new THREE.Vector2(0, 0) },
    uMorph: { value: params.morphFactor },
    uBass: { value: 0.2 },
    uCurvature: { value: 0.5 },
    uVideoTexture: { value: new THREE.Texture() },
    uVideoEnabled: { value: 0 },
    uVideoBlend: { value: 0 },
    uVideoThreshold: { value: 0.35 },
    uVideoChroma: { value: 0.15 },
    uVideoExposure: { value: 1.4 },
  });

  const updateParam = <K extends keyof ShaderParams>(key: K, value: ShaderParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  // Compile and Deploy to Projector
  const handleDeployToProjector = () => {
    const err = onApplyShader(localCode);
    setCompileError(err);
    if (!err) {
      onChange({
        ...params,
        userCode: localCode,
      });
      setDeploySuccess(true);
      setTimeout(() => setDeploySuccess(false), 3000);
    }
  };

  // Select Preset Card
  const handleSelectPreset = (presetKey: string) => {
    const preset = SHADER_PRESETS[presetKey];
    if (preset) {
      setLocalCode(preset.code);
      setCompileError(null);
      onChange({
        ...params,
        preset: presetKey,
        userCode: preset.code,
      });
      onApplyShader(preset.code);
      setDeploySuccess(true);
      setTimeout(() => setDeploySuccess(false), 2500);
    }
  };

  const handleInsertSnippet = (snippet: string) => {
    setLocalCode((prev) => prev + '\n' + snippet);
  };

  // Draw Cosine Gradient Ramp on Preview Canvas
  const drawPaletteRamp = useCallback(() => {
    const canvas = paletteCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.createImageData(w, h);
    const d = imgData.data;

    const { a, b, c, d: dVec } = paletteParams;

    for (let x = 0; x < w; x++) {
      const t = x / w;
      const r = Math.round(
        Math.max(0, Math.min(1, a[0] + b[0] * Math.cos(6.28318 * (c[0] * t + dVec[0])))) * 255
      );
      const g = Math.round(
        Math.max(0, Math.min(1, a[1] + b[1] * Math.cos(6.28318 * (c[1] * t + dVec[1])))) * 255
      );
      const blue = Math.round(
        Math.max(0, Math.min(1, a[2] + b[2] * Math.cos(6.28318 * (c[2] * t + dVec[2])))) * 255
      );

      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * 4;
        d[idx] = r;
        d[idx + 1] = g;
        d[idx + 2] = blue;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [paletteParams]);

  useEffect(() => {
    drawPaletteRamp();
  }, [drawPaletteRamp]);

  // Inject Cosine Palette GLSL function into editor
  const handleInjectPalette = () => {
    const { a, b, c, d } = paletteParams;
    const glslSnippet = `// Inigo Quilez Cosine Gradient Palette: ${paletteParams.name}
vec3 palette(float t) {
  vec3 a = vec3(${a[0].toFixed(3)}, ${a[1].toFixed(3)}, ${a[2].toFixed(3)});
  vec3 b = vec3(${b[0].toFixed(3)}, ${b[1].toFixed(3)}, ${b[2].toFixed(3)});
  vec3 c = vec3(${c[0].toFixed(3)}, ${c[1].toFixed(3)}, ${c[2].toFixed(3)});
  vec3 d = vec3(${d[0].toFixed(3)}, ${d[1].toFixed(3)}, ${d[2].toFixed(3)});
  return a + b * cos(6.28318 * (c * t + d));
}`;
    setLocalCode((prev) => glslSnippet + '\n\n' + prev);
    setDeploySuccess(true);
    setTimeout(() => setDeploySuccess(false), 2000);
  };

  // Archetype Handlers
  const handleLoadArchetype = (arch: GhostArchetype) => {
    if (arch.shaderParams.userCode) {
      setLocalCode(arch.shaderParams.userCode);
      onChange({
        ...params,
        ...arch.shaderParams,
        userCode: arch.shaderParams.userCode,
      });
      onApplyShader(arch.shaderParams.userCode);
    }
    if (arch.palette) {
      setPaletteParams(arch.palette);
    }
    onLoadArchetype?.(arch);
    setArchetypeDropdownOpen(false);
  };

  const handleSaveArchetype = () => {
    if (!newArchetypeName.trim()) return;
    const customArch: GhostArchetype = {
      id: `custom_${Date.now()}`,
      name: newArchetypeName.trim(),
      desc: newArchetypeDesc.trim() || 'Custom user spectral shader archetype',
      nodes: [],
      shaderParams: {
        preset: params.preset,
        userCode: localCode,
        scale: params.scale,
        speed: params.speed,
        brightness: params.brightness,
        contrast: params.contrast,
        chromaticDispersion: params.chromaticDispersion,
        bloomIntensity: params.bloomIntensity,
        morphFactor: params.morphFactor,
      },
      palette: paletteParams,
      isCustom: true,
    };
    saveUserArchetype(customArch);
    setUserArchetypes(loadUserArchetypes());
    onSaveArchetype?.(customArch.name, customArch.desc);
    setSaveModalOpen(false);
    setNewArchetypeName('');
    setNewArchetypeDesc('');
    setSavedSuccessMsg('Saved to Archetype Library!');
    setTimeout(() => setSavedSuccessMsg(null), 3000);
  };

  // Initialize and manage Spectral Video Pipeline
  useEffect(() => {
    const pipeline = new SpectralVideoPipeline();
    videoPipelineRef.current = pipeline;
    setVideoStatus(pipeline.getStatus());

    if (params.videoEnabled && params.videoSource) {
      pipeline.setSource(params.videoSource).then(() => {
        setVideoStatus(pipeline.getStatus());
      });
    }

    return () => {
      pipeline.dispose();
      videoPipelineRef.current = null;
    };
  }, []);

  const handleToggleVideo = async () => {
    const next = !videoEnabled;
    setVideoEnabled(next);
    updateParam('videoEnabled', next);
    if (next && videoSource === 'webcam' && videoPipelineRef.current) {
      await videoPipelineRef.current.setSource('webcam');
      setVideoStatus(videoPipelineRef.current.getStatus());
    }
  };

  const handleSelectVideoSource = async (src: VideoSourceType) => {
    setVideoSource(src);
    updateParam('videoSource', src);
    if (videoPipelineRef.current) {
      await videoPipelineRef.current.setSource(src);
      setVideoStatus(videoPipelineRef.current.getStatus());
    }
  };

  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && videoPipelineRef.current) {
      setVideoSource('custom');
      updateParam('videoSource', 'custom');
      await videoPipelineRef.current.setSource('custom', file);
      setVideoStatus(videoPipelineRef.current.getStatus());
    }
  };

  const handleInjectVideoSnippet = () => {
    const glslSnippet = `// Spectral Video Projection Sampling
vec4 vid = getSpectralVideo(uv);
// Glowing ethereal apparition blend
col = mix(col, vid.rgb, vid.a * 0.9);`;
    setLocalCode((prev) => prev + '\n\n' + glslSnippet);
    setDeploySuccess(true);
    setTimeout(() => setDeploySuccess(false), 2000);
  };

  // Initialize Three.js Preview Canvas
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08090c);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 2000);
    camera.position.set(0, 30, 220);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    const rt = new THREE.WebGLRenderTarget(512, 512, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    rtRef.current = rt;

    const qScene = new THREE.Scene();
    quadSceneRef.current = qScene;
    const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quadCameraRef.current = qCam;

    const procCode = processUserShader(localCode);
    const qMat = new THREE.ShaderMaterial({
      uniforms: uniformsRef.current,
      vertexShader: `
        varying vec2 vUv2;
        void main() {
          vUv2 = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: QFS_TEMPLATE.replace('/*USER*/', procCode),
    });
    quadMatRef.current = qMat;

    const qQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), qMat);
    qScene.add(qQuad);

    let lastTime = performance.now();
    let frames = 0;
    let fpsTimer = performance.now();
    let animId: number;

    const renderLoop = () => {
      animId = requestAnimationFrame(renderLoop);
      const now = performance.now();
      const dt = (now - lastTime) * 0.001;
      lastTime = now;

      frames++;
      if (now - fpsTimer >= 1000) {
        setFps(frames);
        frames = 0;
        fpsTimer = now;
      }

      // Audio Reactive Modulation
      let currentBass = 0.2;
      if (audioReactiveEnabled) {
        const livePulse =
          audioEnergy > 0.01
            ? audioEnergy * audioSensitivity
            : (Math.sin(now * 0.004) * 0.5 + 0.5) * 0.6 * audioSensitivity;
        currentBass = livePulse;
        setSimulatedBass(livePulse);
      } else {
        setSimulatedBass(0);
      }

      uniformsRef.current.uBass.value = currentBass;
      uniformsRef.current.uMorph.value =
        params.morphFactor + (audioReactiveEnabled ? currentBass * 0.25 : 0);

      if (isPlaying) {
        const audioSpeedBoost = audioReactiveEnabled ? 1.0 + currentBass * 0.8 : 1.0;
        uniformsRef.current.uTime.value +=
          dt * (params.speed > 5 ? params.speed / 50 : params.speed * 0.5) * audioSpeedBoost;
      }
      uniformsRef.current.uScale.value = params.scale;

      // Update Spectral Video Texture & Uniforms
      if (videoPipelineRef.current) {
        videoPipelineRef.current.update(dt);
        uniformsRef.current.uVideoTexture.value = videoPipelineRef.current.getTexture();
        uniformsRef.current.uVideoEnabled.value = videoEnabledRef.current ? 1.0 : 0.0;
        uniformsRef.current.uVideoBlend.value = videoBlendModeRef.current;
        uniformsRef.current.uVideoThreshold.value = videoThresholdRef.current;
        uniformsRef.current.uVideoExposure.value = videoExposureRef.current;
      }

      if (renderer && qScene && qCam && rt) {
        renderer.setRenderTarget(rt);
        renderer.render(qScene, qCam);
        renderer.setRenderTarget(null);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    renderLoop();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      rt.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [audioReactiveEnabled, audioSensitivity, audioEnergy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rebuild preview geometry when model type changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !rtRef.current) return;

    if (previewMeshRef.current) {
      scene.remove(previewMeshRef.current);
      previewMeshRef.current.geometry.dispose();
      previewMeshRef.current = null;
    }

    let geo: THREE.BufferGeometry;
    if (previewModel === 'cloth') {
      geo = new THREE.CylinderGeometry(40, 75, 120, 48, 24, true);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const normY = (60 - y) / 120;
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const ripple = Math.sin(normY * Math.PI * 4 + Math.atan2(z, x) * 6) * (6 * normY);
        pos.setX(i, x * (1 + normY * 0.4) + (x / (Math.hypot(x, z) || 1)) * ripple);
        pos.setZ(i, z * (1 + normY * 0.4) + (z / (Math.hypot(x, z) || 1)) * ripple);
      }
      geo.computeVertexNormals();
    } else if (previewModel === 'sphere') {
      geo = new THREE.SphereGeometry(60, 48, 48);
    } else {
      geo = new THREE.PlaneGeometry(130, 130, 1, 1);
    }

    const mat = new THREE.MeshBasicMaterial({
      map: rtRef.current.texture,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    previewMeshRef.current = mesh;
  }, [previewModel]);

  // Recompile offscreen quad material whenever user code changes
  useEffect(() => {
    if (!quadMatRef.current) return;
    try {
      const proc = processUserShader(localCode);
      const newMat = new THREE.ShaderMaterial({
        uniforms: uniformsRef.current,
        vertexShader: `
          varying vec2 vUv2;
          void main() {
            vUv2 = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `,
        fragmentShader: QFS_TEMPLATE.replace('/*USER*/', proc),
      });

      if (quadSceneRef.current && quadSceneRef.current.children[0]) {
        const quadMesh = quadSceneRef.current.children[0] as THREE.Mesh;
        quadMesh.material = newMat;
        quadMatRef.current.dispose();
        quadMatRef.current = newMat;
      }
      setCompileError(null);
    } catch (e: unknown) {
      setCompileError(e instanceof Error ? e.message : 'Shader compilation syntax error');
    }
  }, [localCode]);

  const filteredPresets = Object.entries(SHADER_PRESETS).filter(([_, item]) => {
    if (categoryFilter === 'all') return true;
    return item.category === categoryFilter;
  });

  return (
    <div className="w-full h-full flex flex-col bg-neutral-950 text-neutral-100 select-none overflow-hidden font-sans">
      {/* 1. Header Studio Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-neutral-900/90 border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-neutral-100">
                Spectral Shaders & Audio-Reactive Laboratory
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                Audio Modulation + Cosine Palettes
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Live WebGL preview with sound-reactive ripples, cosine gradient palettes, and direct projector deployment.
            </p>
          </div>
        </div>

        {/* Action Controls & Archetype Dropdown */}
        <div className="flex items-center gap-2.5">
          {/* Archetypes Dropdown */}
          <div className="relative">
            <button
              onClick={() => setArchetypeDropdownOpen(!archetypeDropdownOpen)}
              className="px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-purple-400" />
              <span>Ghost Archetypes</span>
            </button>

            {archetypeDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl bg-neutral-900 border border-neutral-800 shadow-2xl z-30 p-2 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 px-2 py-1">
                  Built-in Archetypes
                </div>
                {BUILTIN_ARCHETYPES.map((arch) => (
                  <button
                    key={arch.id}
                    onClick={() => handleLoadArchetype(arch)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-xs text-neutral-200 transition-colors flex flex-col cursor-pointer"
                  >
                    <span className="font-semibold text-cyan-300">{arch.name}</span>
                    <span className="text-[10px] text-neutral-400 truncate">{arch.desc}</span>
                  </button>
                ))}

                {userArchetypes.length > 0 && (
                  <>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-purple-400 px-2 py-1 pt-2 border-t border-neutral-800">
                      Custom Saved Archetypes
                    </div>
                    {userArchetypes.map((arch) => (
                      <button
                        key={arch.id}
                        onClick={() => handleLoadArchetype(arch)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-xs text-neutral-200 transition-colors flex flex-col cursor-pointer"
                      >
                        <span className="font-semibold text-purple-300">{arch.name}</span>
                        <span className="text-[10px] text-neutral-400 truncate">{arch.desc}</span>
                      </button>
                    ))}
                  </>
                )}

                <div className="pt-1 border-t border-neutral-800">
                  <button
                    onClick={() => {
                      setArchetypeDropdownOpen(false);
                      setSaveModalOpen(true);
                    }}
                    className="w-full py-1.5 text-center text-xs font-semibold text-cyan-400 hover:text-cyan-300 rounded-lg hover:bg-cyan-950/50 cursor-pointer"
                  >
                    + Save Shader as Archetype
                  </button>
                </div>
              </div>
            )}
          </div>

          {onReturnToStage && (
            <button
              onClick={onReturnToStage}
              className="px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Return to Stage
            </button>
          )}

          <button
            onClick={handleDeployToProjector}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 ${
              deploySuccess
                ? 'bg-emerald-500 text-white'
                : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950'
            }`}
          >
            {deploySuccess ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
            <span>{deploySuccess ? 'Active on Projector!' : 'Deploy to Projector'}</span>
          </button>
        </div>
      </div>

      {/* 2. Main Split-Screen Studio */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-neutral-800 overflow-hidden">
        {/* Left Pane: Live WebGL Shader Preview & Audio / Palettes */}
        <div className="flex flex-col h-full bg-[#08090c] overflow-y-auto">
          {/* 3D Viewport Controls Bar */}
          <div className="relative flex-1 min-h-[300px] max-h-[440px] bg-black border-b border-neutral-800 overflow-hidden">
            {/* Top Viewport HUD */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md px-3 py-1 rounded-lg border border-neutral-800 text-xs">
              <span className="text-neutral-400 font-mono text-[10px]">MODEL:</span>
              {(['cloth', 'sphere', 'quad'] as PreviewModelType[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setPreviewModel(m)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium uppercase transition-colors cursor-pointer ${
                    previewModel === m
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {m === 'cloth' ? 'Ghost Shroud' : m === 'sphere' ? '3D Orb' : 'Quad'}
                </button>
              ))}
            </div>

            {/* Audio Modulation HUD Meter */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2.5 bg-neutral-900/90 backdrop-blur-md px-3 py-1 rounded-lg border border-neutral-800 text-[11px] font-mono text-neutral-400">
              <div className="flex items-center gap-1.5">
                <Radio className={`w-3.5 h-3.5 ${audioReactiveEnabled ? 'text-cyan-400 animate-pulse' : 'text-neutral-600'}`} />
                <span className="text-[10px]">{audioReactiveEnabled ? 'AUDIO LIVE' : 'AUDIO OFF'}</span>
              </div>

              {/* Dynamic VU meter bars */}
              {audioReactiveEnabled && (
                <div className="flex items-end gap-0.5 h-3.5 w-6 px-0.5 py-0.5 bg-black rounded">
                  <div
                    className="w-1 bg-cyan-400 rounded-xs transition-all"
                    style={{ height: `${Math.min(100, simulatedBass * 100)}%` }}
                  />
                  <div
                    className="w-1 bg-purple-400 rounded-xs transition-all"
                    style={{ height: `${Math.min(100, (simulatedBass + 0.2) * 80)}%` }}
                  />
                  <div
                    className="w-1 bg-emerald-400 rounded-xs transition-all"
                    style={{ height: `${Math.min(100, simulatedBass * 120)}%` }}
                  />
                </div>
              )}

              <span className="text-emerald-400 border-l border-neutral-800 pl-2">{fps} FPS</span>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-1 text-neutral-300 hover:text-white cursor-pointer ml-1"
                title={isPlaying ? 'Pause Animation' : 'Play Animation'}
              >
                {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
            </div>

            {/* Three.js Container */}
            <div ref={previewContainerRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-neutral-950/80 backdrop-blur-md px-3.5 py-1 rounded-md border border-neutral-800 text-[10px] text-neutral-400">
              Drag to orbit preview · Scroll to zoom
            </div>
          </div>

          {/* Real-Time Uniform Controls & Audio/Palette Section */}
          <div className="p-5 space-y-5">
            {/* Audio Modulation Matrix */}
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Real-Time Audio Reactive Modulation
                  </h3>
                </div>
                <button
                  onClick={() => setAudioReactiveEnabled(!audioReactiveEnabled)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    audioReactiveEnabled
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                      : 'bg-neutral-850 text-neutral-500 border-neutral-700'
                  }`}
                >
                  {audioReactiveEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span>{audioReactiveEnabled ? 'Audio React: ON' : 'Audio React: OFF'}</span>
                </button>
              </div>

              {audioReactiveEnabled && (
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-neutral-400">Audio Sensitivity Gain</span>
                      <span className="text-cyan-400 font-mono text-[11px]">{audioSensitivity.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.1"
                      value={audioSensitivity}
                      onChange={(e) => setAudioSensitivity(parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-neutral-400">Wrinkle Curvature React</span>
                      <span className="text-purple-300 font-mono text-[11px]">
                        {Math.round(params.wrinkleReactivity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.05"
                      value={params.wrinkleReactivity}
                      onChange={(e) => updateParam('wrinkleReactivity', parseFloat(e.target.value))}
                      className="w-full accent-purple-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Cosine Color Palette Generator */}
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Cosine Color Palette Generator
                  </h3>
                </div>
                <button
                  onClick={handleInjectPalette}
                  className="px-2.5 py-1 rounded-md bg-purple-950 text-purple-300 border border-purple-700/60 hover:bg-purple-900/60 text-xs font-semibold transition-colors cursor-pointer"
                >
                  + Inject into GLSL
                </button>
              </div>

              {/* Live Gradient Ramp Canvas */}
              <div className="h-6 w-full rounded-lg overflow-hidden border border-neutral-700">
                <canvas ref={paletteCanvasRef} width={256} height={24} className="w-full h-full block" />
              </div>

              {/* Preset Palettes */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Object.entries(COSINE_PALETTES).map(([key, pal]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setActivePaletteKey(key);
                      setPaletteParams(pal);
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                      activePaletteKey === key
                        ? 'bg-purple-950/80 border-purple-500 text-purple-200'
                        : 'bg-neutral-950/70 border-neutral-850 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {pal.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Webcam & Video Spectral Projection Mapping */}
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-violet-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Spectral Video & Webcam Projection
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleVideo}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      videoEnabled
                        ? 'bg-violet-950 text-violet-300 border border-violet-600 shadow-[0_0_12px_rgba(192,132,252,0.3)]'
                        : 'bg-neutral-850 text-neutral-500 border-neutral-700 hover:text-neutral-300'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5 text-violet-400" />
                    <span>{videoEnabled ? 'Projection: ACTIVE' : 'Projection: OFF'}</span>
                  </button>
                  <button
                    onClick={handleInjectVideoSnippet}
                    className="px-2 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-mono border border-neutral-700 cursor-pointer"
                    title="Inject getSpectralVideo(uv) sampling snippet into GLSL code"
                  >
                    + GLSL
                  </button>
                </div>
              </div>

              {/* Status & Resolution HUD */}
              <div className="flex items-center justify-between text-[11px] font-mono px-2.5 py-1 rounded bg-black/50 border border-neutral-800">
                <span className="text-neutral-400 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${videoEnabled ? 'bg-violet-400 animate-pulse' : 'bg-neutral-600'}`} />
                  {videoStatus}
                </span>
                <span className="text-violet-300">
                  {videoSource === 'webcam' ? '640x480 Live Stream' : '512x512 Procedural Buffer'}
                </span>
              </div>

              {/* Video Source Selector */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  Projection Source Stream
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  <button
                    onClick={() => handleSelectVideoSource('webcam')}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      videoSource === 'webcam'
                        ? 'bg-violet-950/80 border-violet-500 text-violet-200 shadow-sm'
                        : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-[10px] leading-tight">Live Cam</span>
                  </button>

                  <button
                    onClick={() => handleSelectVideoSource('mist_loop')}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      videoSource === 'mist_loop'
                        ? 'bg-violet-950/80 border-violet-500 text-violet-200 shadow-sm'
                        : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                    }`}
                  >
                    <span className="text-sm">🌫️</span>
                    <span className="text-[10px] leading-tight">Mist Loop</span>
                  </button>

                  <button
                    onClick={() => handleSelectVideoSource('banshee_loop')}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      videoSource === 'banshee_loop'
                        ? 'bg-violet-950/80 border-violet-500 text-violet-200 shadow-sm'
                        : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                    }`}
                  >
                    <span className="text-sm">👻</span>
                    <span className="text-[10px] leading-tight">Banshee</span>
                  </button>

                  <button
                    onClick={() => handleSelectVideoSource('shadow_loop')}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      videoSource === 'shadow_loop'
                        ? 'bg-violet-950/80 border-violet-500 text-violet-200 shadow-sm'
                        : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                    }`}
                  >
                    <span className="text-sm">👥</span>
                    <span className="text-[10px] leading-tight">Shadows</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      videoSource === 'custom'
                        ? 'bg-violet-950/80 border-violet-500 text-violet-200 shadow-sm'
                        : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-[10px] leading-tight">Upload MP4</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Spectral Blend Modes */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  Spectral Blend & Chroma Key Mode
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 0, label: 'Luma Ghost Key', desc: 'Thresholds dark shadows into spectral void' },
                    { id: 1, label: 'Sobel Edge Luminescence', desc: 'Neon contour edge outline on moving silhouettes' },
                    { id: 2, label: 'Slit-Scan Mirage', desc: 'Temporal wave distortion warping video feed' },
                    { id: 3, label: 'Ectoplasm Screen', desc: 'Radiant phosphorescent phosphor composite' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => {
                        setVideoBlendMode(mode.id);
                        updateParam('videoBlendMode', mode.id);
                      }}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        videoBlendMode === mode.id
                          ? 'bg-violet-950/80 border-violet-500 text-violet-200 ring-1 ring-violet-500/30'
                          : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                      }`}
                    >
                      <div className="font-semibold text-xs text-neutral-200">{mode.label}</div>
                      <div className="text-[10px] text-neutral-400 line-clamp-1">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders: Threshold & Exposure */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-neutral-400">Luma Key Threshold</span>
                    <span className="text-violet-400 font-mono text-[11px]">{Math.round(videoThreshold * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.85"
                    step="0.02"
                    value={videoThreshold}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setVideoThreshold(v);
                      updateParam('videoThreshold', v);
                    }}
                    className="w-full accent-violet-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-neutral-400">Projection Exposure / Gain</span>
                    <span className="text-violet-400 font-mono text-[11px]">{videoExposure.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={videoExposure}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setVideoExposure(v);
                      updateParam('videoExposure', v);
                    }}
                    className="w-full accent-violet-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Core Optics Uniform Sliders */}
            <div className="grid grid-cols-2 gap-4 bg-neutral-900/50 p-4 rounded-xl border border-neutral-850">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-neutral-400">Scale</span>
                  <span className="text-cyan-400 font-mono text-[11px]">{params.scale}</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="70"
                  value={params.scale}
                  onChange={(e) => updateParam('scale', parseInt(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-neutral-400">Speed</span>
                  <span className="text-cyan-400 font-mono text-[11px]">{params.speed}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="80"
                  value={params.speed}
                  onChange={(e) => updateParam('speed', parseInt(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-neutral-400">Brightness</span>
                  <span className="text-cyan-400 font-mono text-[11px]">
                    {params.brightness.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="2.5"
                  step="0.05"
                  value={params.brightness}
                  onChange={(e) => updateParam('brightness', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-neutral-400">Contrast</span>
                  <span className="text-cyan-400 font-mono text-[11px]">
                    {params.contrast.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="3.2"
                  step="0.05"
                  value={params.contrast}
                  onChange={(e) => updateParam('contrast', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-neutral-400">Chromatic Dispersion</span>
                  <span className="text-purple-300 font-mono text-[11px]">
                    {Math.round(params.chromaticDispersion * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={params.chromaticDispersion}
                  onChange={(e) => updateParam('chromaticDispersion', parseFloat(e.target.value))}
                  className="w-full accent-purple-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-neutral-400">Bloom Radiance</span>
                  <span className="text-purple-300 font-mono text-[11px]">
                    {Math.round(params.bloomIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={params.bloomIntensity}
                  onChange={(e) => updateParam('bloomIntensity', parseFloat(e.target.value))}
                  className="w-full accent-purple-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Pane: Computational Art Gallery & GLSL Code Studio */}
        <div className="flex flex-col h-full bg-neutral-950 overflow-y-auto p-5 space-y-5">
          {/* Gallery */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Computational Art Gallery
                </h3>
              </div>
              <span className="text-[11px] text-neutral-500 font-mono">
                {filteredPresets.length} presets
              </span>
            </div>

            <div className="flex flex-wrap gap-1 p-1 bg-neutral-900 rounded-lg border border-neutral-800">
              {[
                { id: 'all', label: 'All' },
                { id: 'raymarch', label: '3D Raymarching' },
                { id: 'fractal', label: '3D Fractals' },
                { id: 'morphogenesis', label: 'Morphogenesis' },
                { id: 'visage', label: 'Spectral Visages' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id as CategoryFilter)}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                    categoryFilter === cat.id
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/80 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
              {filteredPresets.map(([key, item]) => {
                const isActive = params.preset === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleSelectPreset(key)}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'bg-cyan-950/70 border-cyan-500 ring-1 ring-cyan-500/30'
                        : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-semibold text-neutral-200 truncate">
                        {item.name}
                      </span>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-black/40 text-neutral-400">
                        {item.category}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-400 line-clamp-2">
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* GLSL Code Studio & Diagnostics */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Live GLSL Fragment Code
                </h3>
              </div>
              <span className="text-[11px] font-mono text-neutral-500">GLSL ES 3.0 / WebGL</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 text-[11px]">
              <span className="text-neutral-500 font-mono mr-1">Insert:</span>
              <button
                onClick={() =>
                  handleInsertSnippet(
                    '// Sphere SDF\nfloat sdSphere(vec3 p, float s) {\n  return length(p) - s;\n}'
                  )
                }
                className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
              >
                + Sphere SDF
              </button>
              <button
                onClick={() =>
                  handleInsertSnippet(
                    '// Fresnel Glow\nfloat fresnel = pow(1.0 - max(0.0, dot(vNormal, vViewDir)), 3.0);'
                  )
                }
                className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
              >
                + Fresnel Rim
              </button>
              <button
                onClick={() =>
                  handleInsertSnippet(
                    '// 3D Rotation\nmat2 rot(float a) {\n  float c = cos(a), s = sin(a);\n  return mat2(c, -s, s, c);\n}'
                  )
                }
                className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
              >
                + Matrix Rot
              </button>
            </div>

            <div className="relative rounded-xl border border-neutral-800 bg-[#07080a] overflow-hidden">
              <textarea
                value={localCode}
                onChange={(e) => setLocalCode(e.target.value)}
                spellCheck={false}
                rows={13}
                className="w-full p-4 font-mono text-xs text-cyan-200 bg-transparent resize-y focus:outline-none leading-relaxed tracking-wide"
                placeholder="// Enter GLSL fragment shader code here..."
              />
            </div>

            {compileError ? (
              <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-xs text-rose-200 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold">GLSL Shader Compile Error:</div>
                  <pre className="font-mono text-[11px] whitespace-pre-wrap text-rose-300">
                    {compileError}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/40">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Shader syntax valid & streaming in live preview viewport</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Archetype Modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-sm font-bold text-neutral-100">
              <BookmarkPlus className="w-5 h-5 text-purple-400" />
              <span>Save as New Ghost Archetype</span>
            </div>
            <p className="text-xs text-neutral-400">
              Saves the current GLSL shader and cosine palette to your local archetype library.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-neutral-300 block mb-1">Archetype Name</label>
                <input
                  type="text"
                  value={newArchetypeName}
                  onChange={(e) => setNewArchetypeName(e.target.value)}
                  placeholder="e.g. Abyssal Voidcaller"
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-300 block mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={newArchetypeDesc}
                  onChange={(e) => setNewArchetypeDesc(e.target.value)}
                  placeholder="e.g. Glowing violet core with deep noise ripples"
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSaveModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-neutral-700 bg-neutral-850 hover:bg-neutral-800 text-xs text-neutral-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveArchetype}
                disabled={!newArchetypeName.trim()}
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-xs font-bold text-white shadow-md cursor-pointer"
              >
                Save Archetype
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
