import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  BezierNode,
  CameraViewMode,
  ClothParams,
  GhostEntityConfig,
  ProjectorParams,
  PropsState,
  ShaderParams,
  SimStats,
  TendrilParams,
} from '../types';
import { buildClothMesh, ClothMeshResult } from '../engine/meshBuilder';
import {
  createDisplayBuffer,
  DisplayBuffer,
  smoothActivity,
  updateDisplayBuffer,
  XPBDSimulation,
} from '../engine/xpbdSolver';
import {
  FS_MAIN,
  processUserShader,
  QFS_TEMPLATE,
  SHADOW_RES,
  VS_MAIN,
} from '../engine/shaders';
import { createTownHallEnvironment } from '../engine/townHallArchitecture';
import { PropsManager, CandleProp, PumpkinProp } from '../engine/propsManager';
import { spatialAudio } from '../engine/spatialAudio';
import {
  ChoreographyShow,
  EnvironmentAtmosphere,
  PlaybackState,
  ShowCue,
} from '../types';
import { AtmosphereManager } from '../engine/atmosphereManager';
import { FlightRibbonManager, evaluateTrackPosition } from '../engine/choreographyEngine';

interface StageCanvasProps {
  nodes: BezierNode[];
  clothParams: ClothParams;
  tendrilParams: TendrilParams;
  projectorParams: ProjectorParams;
  shaderParams: ShaderParams;
  cameraView: CameraViewMode;
  audioEnergy: number;
  onStatsUpdate: (stats: SimStats) => void;
  onCompileError: (error: string | null) => void;
  referenceTrigger: number;
  // MVP2 Multi-Ghost & Props
  ghosts?: GhostEntityConfig[];
  activeGhostId?: string;
  onSelectActiveGhost?: (id: string) => void;
  propsState?: PropsState;
  onRegisterPropsActions?: (actions: {
    addCandle: () => void;
    addPumpkin: () => void;
    clearProps: () => void;
    scatterPumpkins: () => void;
  }) => void;
  // MVP3 Haunt Show Choreography & Atmosphere
  choreographyShow?: ChoreographyShow;
  playbackState?: PlaybackState;
  onUpdatePlayback?: (updates: Partial<PlaybackState>) => void;
  atmosphere?: EnvironmentAtmosphere;
  onRecordKeyframe?: (ghostId: string, time: number, pos: { x: number; y: number; z: number }) => void;
  onCueTriggered?: (cue: ShowCue) => void;
  onRegisterChoreographyActions?: (actions: {
    strikeLightning: () => void;
    triggerFogSurge: () => void;
    playOrganStab: () => void;
    getCurrentGhostPos: (ghostId: string) => { x: number; y: number; z: number };
  }) => void;
}


function createCompanionGhostGroup(colorHex: string, scale: number): { group: THREE.Group; mesh: THREE.Mesh } {
  const group = new THREE.Group();
  group.userData = { type: 'companion' };

  // Draped flowing ghost skirt with ruffled ripples
  const bodyGeo = new THREE.CylinderGeometry(18 * scale, 42 * scale, 95 * scale, 24, 8, true);
  const posAttr = bodyGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    if (y < 0) {
      const angle = Math.atan2(posAttr.getZ(i), posAttr.getX(i));
      const ripple = Math.sin(angle * 6) * (7 * scale) * (Math.abs(y) / (48 * scale));
      posAttr.setX(i, posAttr.getX(i) + Math.cos(angle) * ripple);
      posAttr.setZ(i, posAttr.getZ(i) + Math.sin(angle) * ripple);
    }
  }
  bodyGeo.computeVertexNormals();

  // Head dome
  const headGeo = new THREE.SphereGeometry(24 * scale, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
  headGeo.translate(0, 47 * scale, 0);

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.35,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92,
    emissive: new THREE.Color(colorHex),
    emissiveIntensity: 0.22,
    side: THREE.DoubleSide,
  });

  const bodyMesh = new THREE.Mesh(bodyGeo, mat);
  bodyMesh.position.y = 47 * scale;
  group.add(bodyMesh);

  const headMesh = new THREE.Mesh(headGeo, mat);
  headMesh.position.y = 47 * scale;
  group.add(headMesh);

  // Friendly expressive ghost eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x050510 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(2.8 * scale, 12, 12), eyeMat);
  eyeL.position.set(-7 * scale, 86 * scale, 20 * scale);
  group.add(eyeL);

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(2.8 * scale, 12, 12), eyeMat);
  eyeR.position.set(7 * scale, 86 * scale, 20 * scale);
  group.add(eyeR);

  // Soft internal ethereal point light
  const light = new THREE.PointLight(new THREE.Color(colorHex), 1.4, 380 * scale, 1.4);
  light.position.set(0, 65 * scale, 0);
  group.add(light);

  return { group, mesh: bodyMesh };
}

export const StageCanvas: React.FC<StageCanvasProps> = ({
  nodes,
  clothParams,
  tendrilParams,
  projectorParams,
  shaderParams,
  cameraView,
  audioEnergy,
  onStatsUpdate,
  onCompileError,
  referenceTrigger,
  ghosts = [],
  activeGhostId = 'ghost_1',
  onSelectActiveGhost,
  propsState,
  onRegisterPropsActions,
  choreographyShow,
  playbackState,
  onUpdatePlayback,
  atmosphere,
  onRecordKeyframe,
  onCueTriggered,
  onRegisterChoreographyActions,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // References to persistent Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const camRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pcamRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const simRef = useRef<XPBDSimulation | null>(null);
  const dispRef = useRef<DisplayBuffer | null>(null);
  const clothMeshRef = useRef<THREE.Mesh | null>(null);
  const hairMeshRef = useRef<THREE.LineSegments | null>(null);
  const hairGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const uniformsRef = useRef<Record<string, THREE.IUniform> | null>(null);
  const shadowRTRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const userRTRef = useRef<[THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null>(null);
  const userIdxRef = useRef<number>(0);
  const qMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const qSceneRef = useRef<THREE.Scene | null>(null);
  const qCamRef = useRef<THREE.OrthographicCamera | null>(null);
  const depthMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const projectorRigRef = useRef<THREE.Group | null>(null);

  // MVP3 Atmosphere & Choreography References
  const atmosphereManagerRef = useRef<AtmosphereManager | null>(null);
  const ribbonManagerRef = useRef<FlightRibbonManager | null>(null);
  const lastTriggeredCueIdsRef = useRef<Set<string>>(new Set());
  const lastRecordTimeRef = useRef<number>(0);
  const choreoPlaybackRef = useRef<{
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    playbackSpeed: number;
    loop: boolean;
    isRecording: boolean;
    recordingGhostId: string | null;
  }>({
    isPlaying: false,
    currentTime: 0,
    duration: 16,
    playbackSpeed: 1,
    loop: true,
    isRecording: false,
    recordingGhostId: null,
  });

  // Spooky Props & Multi-Ghost References
  const propsManagerRef = useRef<PropsManager | null>(null);
  const companionMeshesRef = useRef<
    Map<
      string,
      {
        group: THREE.Group;
        mesh: THREE.Mesh;
        pos: THREE.Vector3;
        vel: THREE.Vector3;
        basePos: THREE.Vector3;
        scale: number;
        bounciness: number;
        color: string;
      }
    >
  >(new Map());
  const companionsGroupRef = useRef<THREE.Group | null>(null);
  const draggedTargetRef = useRef<{
    type: 'primary' | 'companion' | 'prop';
    id?: string;
    prop?: CandleProp | PumpkinProp;
    plane: THREE.Plane;
  } | null>(null);
  const lowestPrevYRef = useRef<number>(60);
  const prevDragPtRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const dragVelRef = useRef<THREE.Vector3>(new THREE.Vector3());


  // Hair particle topology metadata
  const hairDataRef = useRef<{
    n: number;
    T: Int32Array;
    B: Float32Array;
    J: Float32Array;
    L: Float32Array;
    pos: Float32Array;
    nrm: Float32Array;
    ref: Float32Array;
    act: Float32Array;
  } | null>(null);

  // Interaction tracking
  const isGrabbingRef = useRef<boolean>(false);
  const grabPlaneRef = useRef<THREE.Plane>(new THREE.Plane());

  // Centroid tracking for spotlight
  const centroidInitRef = useRef<boolean>(false);
  const cSRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const cRefRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const refCapturedRef = useRef<boolean>(false);

  // Active keyboard tracking for WASD camera move & QE zoom
  const keysDownRef = useRef<Set<string>>(new Set());

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 1);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Viewport camera matching original perspective: looking at (0, 60, 0) from (0, 520, 980)
    const cam = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 10, 90000);
    cam.position.set(0, 520, 980);
    camRef.current = cam;

    // OrbitControls for natural background dragging, rotation, and zooming
    const controls = new OrbitControls(cam, canvas);
    controls.target.set(0, 60, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 150;
    controls.maxDistance = 20000;
    controls.update();
    controlsRef.current = controls;

    // Projector camera (used as projection lens)
    const pcam = new THREE.PerspectiveCamera(32, 1, 50, 6000);
    pcamRef.current = pcam;

    // Depth render target for shadow occlusion
    const shadowRT = new THREE.WebGLRenderTarget(SHADOW_RES, SHADOW_RES, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    shadowRTRef.current = shadowRT;

    // Offscreen user shader render targets (ping-pong)
    const userRes = shaderParams.resolution || 512;
    const userRT: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] = [
      new THREE.WebGLRenderTarget(userRes, userRes, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
      }),
      new THREE.WebGLRenderTarget(userRes, userRes, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
      }),
    ];
    userRTRef.current = userRT;

    // Black 1x1 fallback texture
    const blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
    blackTex.needsUpdate = true;

    // Offscreen sandbox quad setup
    const qU = {
      uTime: { value: 0 },
      uScale: { value: shaderParams.scale },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uRes: { value: new THREE.Vector2(userRes, userRes) },
      uWindVel: { value: new THREE.Vector2(0, 0) },
      uMorph: { value: shaderParams.morphFactor || 0.5 },
      uBass: { value: 0 },
      uCurvature: { value: 0 },
      backbuffer: { value: blackTex },
    };
    const processedInitial = processUserShader(shaderParams.userCode);
    const qMat = new THREE.ShaderMaterial({
      uniforms: qU,
      depthTest: false,
      depthWrite: false,
      vertexShader: `varying vec2 vUv2; void main(){ vUv2=uv; gl_Position=vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: QFS_TEMPLATE.replace('/*USER*/', processedInitial),
    });
    qMatRef.current = qMat;

    const qScene = new THREE.Scene();
    const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const qMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), qMat);
    qMesh.frustumCulled = false;
    qScene.add(qMesh);
    qSceneRef.current = qScene;
    qCamRef.current = qCam;

    // Shared uniforms
    const U: Record<string, THREE.IUniform> = {
      uShadow: { value: shadowRT.texture },
      uProjVP: { value: new THREE.Matrix4() },
      uContentVP: { value: new THREE.Matrix4() },
      uProjPos: { value: new THREE.Vector3() },
      uNear: { value: 50 },
      uFar: { value: 6000 },
      uBias: { value: 3 },
      uTime: { value: 0 },
      uScale: { value: 3 },
      uInt: { value: 1 },
      uHue: { value: 0 },
      uReact: { value: 0.6 },
      uAmb: { value: 0.015 },
      uLight: { value: 0.12 },
      uLightDir: { value: new THREE.Vector3(0.45, 1, 0.3).normalize() },
      uTouch: { value: new THREE.Vector3(0, -1e4, 0) },
      uTouchAge: { value: 99 },
      uTouchHold: { value: 0 },
      uAlbedo: { value: new THREE.Color(0.66, 0.66, 0.66) },
      uGloss: { value: 0.35 },
      uNM: { value: null },
      uHasNM: { value: 1 },
      uNMStr: { value: 0.4 },
      uRep: { value: 0.02 },
      uFloorProj: { value: 0 },
      uStick: { value: 1 },
      uPattern: { value: 2 },
      uContrast: { value: 2 },
      uRes: { value: new THREE.Vector2(1024, 1024) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uUserTex: { value: userRT[0].texture },
      uFogStart: { value: 10000 },
      uFogLen: { value: 9000 },
      uColorize: { value: 0.8 },
      uShadowK: { value: 0.8 },
      uSpill: { value: 0.5 },
      uTestPattern: { value: 0 },
      uChromatic: { value: shaderParams.chromaticDispersion ?? 0.4 },
      uBloom: { value: shaderParams.bloomIntensity ?? 0.8 },
      uGodRays: { value: shaderParams.godRays ?? 0.6 },
      uWrinkle: { value: shaderParams.wrinkleReactivity ?? 0.8 },
      uWindVel: { value: new THREE.Vector2(0, 0) },
      uMorph: { value: shaderParams.morphFactor ?? 0.5 },
      uBass: { value: 0 },
      uCurvature: { value: 0 },
    };
    uniformsRef.current = U;

    // Architectural Town Hall Scene Elements with flat ground plane at Y = 0
    const matFacade = new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: VS_MAIN,
      fragmentShader: FS_MAIN,
      defines: { IS_GROUND: '' },
    });
    const Ug = {
      ...U,
      uAlbedo: { value: new THREE.Color(0.06, 0.063, 0.068) },
      uGloss: { value: 0.3 },
      uAmb: { value: 0.04 },
      uLight: { value: 0.25 },
    };
    const matGround = new THREE.ShaderMaterial({
      uniforms: Ug,
      vertexShader: VS_MAIN,
      fragmentShader: FS_MAIN,
      defines: { IS_GROUND: '' },
    });

    const townHall = createTownHallEnvironment(matFacade, matGround);
    U.uNM.value = townHall.normalMapTexture;
    projectorRigRef.current = townHall.projectorRig;
    scene.add(townHall.group);

    // Companions group
    const companionsGroup = new THREE.Group();
    companionsGroup.name = 'CompanionGhostsGroup';
    scene.add(companionsGroup);
    companionsGroupRef.current = companionsGroup;

    // Spooky Props Manager
    const propsMgr = new PropsManager(scene);
    propsManagerRef.current = propsMgr;

    if (onRegisterPropsActions) {
      onRegisterPropsActions({
        addCandle: () => {
          const x = (Math.random() - 0.5) * 320;
          const y = 200 + Math.random() * 120;
          const z = (Math.random() - 0.5) * 240;
          propsMgr.addCandle(x, y, z, 20 + Math.random() * 10, 1.2 + Math.random() * 0.8);
        },
        addPumpkin: () => {
          const x = (Math.random() - 0.5) * 340;
          const z = (Math.random() - 0.5) * 260;
          propsMgr.addPumpkin(x, 40, z, 0.85 + Math.random() * 0.45);
        },
        clearProps: () => {
          propsMgr.clearAll();
        },
        scatterPumpkins: () => {
          propsMgr.scatterPumpkins();
        },
      });
    }

    // MVP3 Atmosphere & 3D Flight Ribbons System
    const atmosphereMgr = new AtmosphereManager(scene);
    atmosphereManagerRef.current = atmosphereMgr;

    const ribbonMgr = new FlightRibbonManager(scene);
    ribbonManagerRef.current = ribbonMgr;

    if (onRegisterChoreographyActions) {
      onRegisterChoreographyActions({
        strikeLightning: () => atmosphereMgr.strikeLightning(),
        triggerFogSurge: () => atmosphereMgr.triggerFogSurge(),
        playOrganStab: () => spatialAudio.playOrganStab(),
        getCurrentGhostPos: (ghostId: string) => {
          if (ghostId === 'ghost_1') {
            return {
              x: Math.round(cSRef.current.x),
              y: Math.round(cSRef.current.y),
              z: Math.round(cSRef.current.z),
            };
          }
          const comp = companionMeshesRef.current.get(ghostId);
          if (comp) {
            return {
              x: Math.round(comp.pos.x),
              y: Math.round(comp.pos.y),
              z: Math.round(comp.pos.z),
            };
          }
          return { x: 0, y: 220, z: 0 };
        },
      });
    }

    // Depth material for shadow pass
    const depthMat = new THREE.ShaderMaterial({
      uniforms: { uProjPos: U.uProjPos, uNear: U.uNear, uFar: U.uFar },
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec3 vW;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: `
        #include <packing>
        uniform vec3 uProjPos;
        uniform float uNear, uFar;
        varying vec3 vW;
        void main(){
          gl_FragColor = packDepthToRGBA(clamp((length(vW - uProjPos) - uNear)/(uFar - uNear), 0.0, 0.9999));
        }
      `,
    });
    depthMatRef.current = depthMat;

    // Window resize handler
    const handleResize = () => {
      if (!container || !renderer || !cam) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h, false);
      cam.aspect = w / Math.max(1, h);
      cam.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // Keyboard listeners for WASD camera move & QE zoom
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
        return;
      }
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        keysDownRef.current.add(k);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysDownRef.current.delete(k);
    };

    const handleBlur = () => {
      keysDownRef.current.clear();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      atmosphereMgr.dispose();
      ribbonMgr.dispose();
      controls.dispose();
      renderer.dispose();
      shadowRT.dispose();
      userRT[0].dispose();
      userRT[1].dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync playback state ref with parent
  useEffect(() => {
    if (playbackState) {
      choreoPlaybackRef.current = {
        isPlaying: playbackState.isPlaying,
        currentTime: playbackState.currentTime,
        duration: playbackState.duration,
        playbackSpeed: playbackState.playbackSpeed,
        loop: playbackState.loop,
        isRecording: playbackState.isRecording,
        recordingGhostId: playbackState.recordingGhostId,
      };
    }
  }, [playbackState]);

  // Sync flight ribbons with show and active ghost
  useEffect(() => {
    if (ribbonManagerRef.current && choreographyShow) {
      ribbonManagerRef.current.setVisible(playbackState?.showFlightRibbons ?? true);
      ribbonManagerRef.current.updateRibbons(choreographyShow, activeGhostId);
    }
  }, [choreographyShow, playbackState?.showFlightRibbons, activeGhostId]);


  // Rebuild cloth mesh when nodes or resolution changes
  const rebuildCloth = useCallback(
    (targetNodes: BezierNode[]) => {
      const scene = sceneRef.current;
      const U = uniformsRef.current;
      if (!scene || !U) return;

      const cloth = buildClothMesh(targetNodes, clothParams.resolution);
      if (cloth.err) {
        onCompileError(cloth.err);
        return;
      }
      onCompileError(null);

      const sim = new XPBDSimulation(cloth);
      simRef.current = sim;

      const disp = createDisplayBuffer(cloth);
      updateDisplayBuffer(disp, sim.x, clothParams.smoothing);
      dispRef.current = disp;

      // Dispose existing cloth mesh
      if (clothMeshRef.current) {
        scene.remove(clothMeshRef.current);
        clothMeshRef.current.geometry.dispose();
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(disp.pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(disp.nrm, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(cloth.uv, 2));
      geo.setAttribute('aAct', new THREE.BufferAttribute(disp.act, 1));
      disp.ref.set(disp.pos);
      geo.setAttribute('aRef', new THREE.BufferAttribute(disp.ref, 3));
      geo.setIndex(new THREE.BufferAttribute(cloth.index, 1));

      const matCloth = new THREE.ShaderMaterial({
        uniforms: U,
        vertexShader: VS_MAIN,
        fragmentShader: FS_MAIN,
        side: THREE.DoubleSide,
        defines: { USE_ACT: '' },
      });

      const clothMesh = new THREE.Mesh(geo, matCloth);
      clothMesh.frustumCulled = false;
      scene.add(clothMesh);
      clothMeshRef.current = clothMesh;

      centroidInitRef.current = false;
      refCapturedRef.current = false;

      // Rebuild plush tendril hair
      buildTendrils(cloth);
    },
    [clothParams.resolution, clothParams.smoothing, onCompileError] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Build tendril strands geometry
  const buildTendrils = (cloth: ClothMeshResult) => {
    const scene = sceneRef.current;
    const U = uniformsRef.current;
    if (!scene || !U) return;

    if (hairMeshRef.current) {
      scene.remove(hairMeshRef.current);
      hairMeshRef.current.geometry.dispose();
      hairMeshRef.current = null;
    }

    if (!tendrilParams.enabled) return;

    const n = Math.round(tendrilParams.density * 1000);
    const idx = cloth.index;
    const nT = idx.length / 3;

    const T = new Int32Array(n * 3);
    const B = new Float32Array(n * 2);
    const J = new Float32Array(n * 3);
    const L = new Float32Array(n);

    for (let h = 0; h < n; h++) {
      const t = Math.floor(Math.random() * nT);
      T[3 * h] = idx[3 * t];
      T[3 * h + 1] = idx[3 * t + 1];
      T[3 * h + 2] = idx[3 * t + 2];

      let u = Math.random();
      let v = Math.random();
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      B[2 * h] = u;
      B[2 * h + 1] = v;

      const jx = Math.random() * 2 - 1;
      const jy = Math.random() * 2 - 1;
      const jz = Math.random() * 2 - 1;
      const jl = Math.hypot(jx, jy, jz) || 1;
      J[3 * h] = jx / jl;
      J[3 * h + 1] = jy / jl;
      J[3 * h + 2] = jz / jl;
      L[h] = 0.55 + 0.9 * Math.random();
    }

    const pos = new Float32Array(n * 6);
    const nrm = new Float32Array(n * 6);
    const ref = new Float32Array(n * 6);
    const act = new Float32Array(n * 2);
    const tip = new Float32Array(n * 2);
    const uv = new Float32Array(n * 4);

    for (let h = 0; h < n; h++) {
      tip[2 * h + 1] = 1;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('aRef', new THREE.BufferAttribute(ref, 3));
    geo.setAttribute('aAct', new THREE.BufferAttribute(act, 1));
    geo.setAttribute('aTip', new THREE.BufferAttribute(tip, 1));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    hairGeoRef.current = geo;

    const hairMat = new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: VS_MAIN,
      fragmentShader: FS_MAIN,
      defines: { USE_ACT: '', HAIR: '' },
    });

    const mesh = new THREE.LineSegments(geo, hairMat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    hairMeshRef.current = mesh;

    hairDataRef.current = { n, T, B, J, L, pos, nrm, ref, act };
  };

  useEffect(() => {
    rebuildCloth(nodes);
  }, [nodes, rebuildCloth]);

  // Update Tendril strands positions
  const updateTendrils = () => {
    const hair = hairDataRef.current;
    const disp = dispRef.current;
    const sim = simRef.current;
    const geo = hairGeoRef.current;
    if (!hair || !disp || !sim || !geo || !tendrilParams.enabled) return;

    const { n, T, B, J, L, pos, nrm, ref, act } = hair;
    const P = disp.pos;
    const Nn = disp.nrm;
    const R = disp.ref;
    const Ac = disp.act;
    const V = sim.v;

    const len = tendrilParams.length;
    const droop = (tendrilParams.droop / 100) * 1.4;
    const wild = (tendrilParams.wildness / 100) * 1.1;
    const lag = 0.0018;

    for (let h = 0; h < n; h++) {
      const a = 3 * T[3 * h];
      const b = 3 * T[3 * h + 1];
      const c = 3 * T[3 * h + 2];
      const u = B[2 * h];
      const v = B[2 * h + 1];
      const w = 1 - u - v;
      const o = 6 * h;

      const rx = P[a] * w + P[b] * u + P[c] * v;
      const ry = P[a + 1] * w + P[b + 1] * u + P[c + 1] * v;
      const rz = P[a + 2] * w + P[b + 2] * u + P[c + 2] * v;

      let nx = Nn[a] * w + Nn[b] * u + Nn[c] * v;
      let ny = Nn[a + 1] * w + Nn[b + 1] * u + Nn[c + 1] * v;
      let nz = Nn[a + 2] * w + Nn[b + 2] * u + Nn[c + 2] * v;
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;

      const vx = V[a] * w + V[b] * u + V[c] * v;
      const vy = V[a + 1] * w + V[b + 1] * u + V[c + 1] * v;
      const vz = V[a + 2] * w + V[b + 2] * u + V[c + 2] * v;

      let dx = nx + J[3 * h] * wild - vx * lag;
      let dy = ny + J[3 * h + 1] * wild - droop - vy * lag;
      let dz = nz + J[3 * h + 2] * wild - vz * lag;
      const s = (len * L[h]) / (Math.sqrt(dx * dx + dy * dy + dz * dz) || 1);

      pos[o] = rx;
      pos[o + 1] = ry;
      pos[o + 2] = rz;
      pos[o + 3] = rx + dx * s;
      pos[o + 4] = Math.max(0, ry + dy * s);
      pos[o + 5] = rz + dz * s;

      nrm[o] = nrm[o + 3] = nx;
      nrm[o + 1] = nrm[o + 4] = ny;
      nrm[o + 2] = nrm[o + 5] = nz;

      const qx = R[a] * w + R[b] * u + R[c] * v;
      const qy = R[a + 1] * w + R[b + 1] * u + R[c + 1] * v;
      const qz = R[a + 2] * w + R[b + 2] * u + R[c + 2] * v;
      ref[o] = ref[o + 3] = qx;
      ref[o + 1] = ref[o + 4] = qy;
      ref[o + 2] = ref[o + 5] = qz;
      act[2 * h] = act[2 * h + 1] = Ac[T[3 * h]];
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.attributes.aRef.needsUpdate = true;
    geo.attributes.aAct.needsUpdate = true;
  };

  // Reset reference frame
  useEffect(() => {
    if (referenceTrigger > 0 && dispRef.current && clothMeshRef.current) {
      dispRef.current.ref.set(dispRef.current.pos);
      cRefRef.current.copy(cSRef.current);
      refCapturedRef.current = true;
      clothMeshRef.current.geometry.attributes.aRef.needsUpdate = true;
    }
  }, [referenceTrigger]);

  // Synchronize uniforms
  useEffect(() => {
    const U = uniformsRef.current;
    if (!U) return;

    // Normalizing brightness: support either 0..2 fractional or 10..200 percentage
    const b = shaderParams.brightness > 5 ? shaderParams.brightness / 100 : shaderParams.brightness;
    U.uInt.value = Math.max(0.3, b * 1.8);

    const c = shaderParams.contrast > 5 ? shaderParams.contrast / 100 : shaderParams.contrast;
    U.uContrast.value = Math.max(0.5, c);

    const s = shaderParams.scale > 0 ? shaderParams.scale : 32;
    U.uScale.value = s;

    const hue = shaderParams.hue > 5 ? shaderParams.hue / 100 : shaderParams.hue;
    U.uHue.value = hue;

    const colorize = shaderParams.colorize > 5 ? shaderParams.colorize / 100 : shaderParams.colorize;
    U.uColorize.value = colorize;

    const react = shaderParams.reactivity > 5 ? shaderParams.reactivity / 100 : shaderParams.reactivity;
    U.uReact.value = react * 1.4;

    U.uChromatic.value = shaderParams.chromaticDispersion ?? 0.45;
    U.uBloom.value = shaderParams.bloomIntensity ?? 0.85;
    U.uGodRays.value = projectorParams.floorProjection
      ? (shaderParams.godRays ?? 0.65)
      : (shaderParams.godRays ?? 0.65) * 0.7;
    U.uWrinkle.value = shaderParams.wrinkleReactivity ?? 0.9;
    U.uMorph.value = shaderParams.morphFactor ?? 0.5;

    // Always ensure pattern 2 (spectral shader quad texture) is enabled
    U.uPattern.value = 2;

    if (qMatRef.current) {
      qMatRef.current.uniforms.uMorph.value = shaderParams.morphFactor ?? 0.5;
      qMatRef.current.uniforms.uScale.value = s;
    }

    U.uShadowK.value = projectorParams.shadowK;
    U.uSpill.value = projectorParams.spill * 1.5;
    U.uFloorProj.value = projectorParams.floorProjection ? 1 : 0;
    U.uStick.value = projectorParams.stickMode === 2 ? 1 : 0;
    U.uTestPattern.value = projectorParams.testPattern;

    const primaryGhost = ghosts.find((g) => g.id === 'ghost_1');
    const tintColor = primaryGhost?.color || clothParams.color;
    U.uAlbedo.value.set(tintColor).convertSRGBToLinear();
    U.uGloss.value = clothParams.gloss;

    if (projectorRigRef.current) {
      projectorRigRef.current.visible = projectorParams.showRig;
    }
  }, [shaderParams, projectorParams, clothParams, ghosts]);

  // Synchronize companion ghosts
  useEffect(() => {
    const parentGroup = companionsGroupRef.current;
    if (!parentGroup) return;

    const currentMap = companionMeshesRef.current;
    const companionConfigs = ghosts.filter((g) => g.id !== 'ghost_1');

    // Remove disabled or removed companions
    for (const [id, comp] of currentMap.entries()) {
      const cfg = companionConfigs.find((c) => c.id === id);
      if (!cfg || !cfg.enabled) {
        parentGroup.remove(comp.group);
        currentMap.delete(id);
      }
    }

    // Add or update active companions
    for (const cfg of companionConfigs) {
      if (!cfg.enabled) continue;
      let comp = currentMap.get(cfg.id);
      if (!comp) {
        const { group, mesh } = createCompanionGhostGroup(cfg.color, cfg.scale);
        const basePos = new THREE.Vector3(cfg.offsetX, 200, cfg.offsetZ);
        group.position.copy(basePos);
        parentGroup.add(group);

        comp = {
          group,
          mesh,
          pos: basePos.clone(),
          vel: new THREE.Vector3(),
          basePos,
          scale: cfg.scale,
          bounciness: cfg.bounciness,
          color: cfg.color,
        };
        currentMap.set(cfg.id, comp);
      } else {
        comp.scale = cfg.scale;
        comp.bounciness = cfg.bounciness;
        comp.basePos.set(cfg.offsetX, 200, cfg.offsetZ);
        comp.group.scale.setScalar(cfg.scale);
      }
    }
  }, [ghosts]);

  // Dynamically recompile user GLSL material when userCode changes
  useEffect(() => {
    const qMat = qMatRef.current;
    if (!qMat || !shaderParams.userCode) return;
    try {
      const processed = processUserShader(shaderParams.userCode);
      qMat.fragmentShader = QFS_TEMPLATE.replace('/*USER*/', processed);
      qMat.needsUpdate = true;
      onCompileError(null);
    } catch (e) {
      console.error('Failed to update user shader material:', e);
      onCompileError(String(e));
    }
  }, [shaderParams.userCode, onCompileError]);

  // Handle camera view modes
  useEffect(() => {
    const cam = camRef.current;
    const pcam = pcamRef.current;
    const controls = controlsRef.current;
    if (!cam || !pcam || !controls) return;

    if (cameraView === 'projector_pov') {
      cam.position.copy(pcam.position);
      cam.rotation.copy(pcam.rotation);
      cam.fov = pcam.fov;
      cam.updateProjectionMatrix();
      controls.enabled = false;
    } else {
      controls.enabled = true;
      if (cameraView === 'orbit') {
        cam.fov = 38;
        cam.position.set(0, 520, 980);
        controls.target.set(0, 60, 0);
      } else if (cameraView === 'facade') {
        cam.fov = 36;
        cam.position.set(0, 160, 950);
        controls.target.set(0, 80, 0);
      } else if (cameraView === 'focus') {
        cam.fov = 30;
        cam.position.set(0, 240, 560);
        controls.target.set(0, 60, 0);
      }
      cam.updateProjectionMatrix();
      controls.update();
    }
  }, [cameraView]);

  /**
   * Pointer interactions faithful to original reference code + MVP2 Spooky Props & Multi-Ghost:
   * Touching the cloth grabs and lifts the surface with fluid elasticity;
   * Touching pumpkins or candles drags or flings them;
   * Touching companion ghosts selects and drags them;
   * Touching outside operates OrbitControls smoothly.
   */
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const cam = camRef.current;
    const sim = simRef.current;
    const clothMesh = clothMeshRef.current;
    const U = uniformsRef.current;
    const controls = controlsRef.current;
    if (!canvas || !cam || e.button !== 0) return;

    const rect = canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(mx, my), cam);

    // 1. Check if user clicked a spooky prop (candle or pumpkin)
    if (propsManagerRef.current) {
      const hitProp = propsManagerRef.current.checkIntersection(ray);
      if (hitProp) {
        e.preventDefault();
        e.stopPropagation();
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        if (controls) controls.enabled = false;

        const propPos = hitProp.prop.group.position;
        const dragPlane = new THREE.Plane();
        dragPlane.setFromNormalAndCoplanarPoint(
          cam.getWorldDirection(new THREE.Vector3()).negate(),
          propPos
        );
        draggedTargetRef.current = {
          type: 'prop',
          prop: hitProp.prop,
          plane: dragPlane,
        };
        prevDragPtRef.current.copy(propPos);
        dragVelRef.current.set(0, 0, 0);

        if (hitProp.type === 'pumpkin') {
          spatialAudio.playPropBump(propPos.x, propPos.y, propPos.z, 'pumpkin');
        } else {
          spatialAudio.playCandleWhoosh(propPos.x, propPos.y, propPos.z);
        }
        canvas.style.cursor = 'grabbing';
        return;
      }
    }

    // 2. Check if user clicked a companion ghost
    for (const [id, comp] of companionMeshesRef.current.entries()) {
      const hits = ray.intersectObjects(comp.group.children, true);
      if (hits.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        if (controls) controls.enabled = false;

        const dragPlane = new THREE.Plane();
        dragPlane.setFromNormalAndCoplanarPoint(
          cam.getWorldDirection(new THREE.Vector3()).negate(),
          hits[0].point
        );
        draggedTargetRef.current = {
          type: 'companion',
          id,
          plane: dragPlane,
        };
        prevDragPtRef.current.copy(hits[0].point);
        dragVelRef.current.set(0, 0, 0);
        onSelectActiveGhost?.(id);
        spatialAudio.playGhostStretch(hits[0].point.x, hits[0].point.y, hits[0].point.z, 0.45);
        canvas.style.cursor = 'grabbing';
        return;
      }
    }

    // 3. Check if user clicked the primary ghost cloth
    if (!clothMesh || !sim || !U) return;
    clothMesh.geometry.computeBoundingSphere();
    const hits = ray.intersectObject(clothMesh);
    if (!hits.length) {
      // User clicked outside the cloth -> OrbitControls handles scene rotation smoothly
      return;
    }

    const hit = hits[0];
    const R = Math.max(35, sim.mesh.s * 4);
    if (!sim.startGrab(hit.point.x, hit.point.y, hit.point.z, R)) return;

    // Direct object grab: intercept pointer and temporarily freeze OrbitControls
    e.preventDefault();
    e.stopPropagation();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (controls) controls.enabled = false;
    isGrabbingRef.current = true;
    grabPlaneRef.current.setFromNormalAndCoplanarPoint(
      cam.getWorldDirection(new THREE.Vector3()).negate(),
      hit.point
    );
    draggedTargetRef.current = {
      type: 'primary',
      plane: grabPlaneRef.current,
    };
    prevDragPtRef.current.copy(hit.point);
    dragVelRef.current.set(0, 0, 0);
    onSelectActiveGhost?.('ghost_1');

    U.uTouch.value.copy(hit.point);
    U.uTouchAge.value = 0;
    U.uTouchHold.value = 1;
    spatialAudio.playGhostStretch(hit.point.x, hit.point.y, hit.point.z, 0.6);
    canvas.style.cursor = 'grabbing';
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const cam = camRef.current;
    const sim = simRef.current;
    const U = uniformsRef.current;
    const target = draggedTargetRef.current;
    if (!canvas || !cam || !target) return;

    const rect = canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(mx, my), cam);
    const hitPt = new THREE.Vector3();

    if (ray.ray.intersectPlane(target.plane, hitPt)) {
      dragVelRef.current.subVectors(hitPt, prevDragPtRef.current).multiplyScalar(30);
      prevDragPtRef.current.copy(hitPt);

      if (target.type === 'primary' && isGrabbingRef.current && sim && U) {
        sim.moveGrab(hitPt.x, hitPt.y, hitPt.z);
        U.uTouch.value.set(hitPt.x, Math.max(0, hitPt.y), hitPt.z);

        const strain = Math.min(1.5, hitPt.distanceTo(cSRef.current) / 160);
        spatialAudio.playGhostStretch(hitPt.x, hitPt.y, hitPt.z, strain);
        const dragSpeed = dragVelRef.current.length();
        if (dragSpeed > 220) {
          spatialAudio.playClothRustle(dragSpeed, strain);
        }
      } else if (target.type === 'companion' && target.id) {
        const comp = companionMeshesRef.current.get(target.id);
        if (comp) {
          comp.pos.lerp(hitPt, 0.4);
          comp.group.position.copy(comp.pos);
          spatialAudio.playGhostStretch(hitPt.x, hitPt.y, hitPt.z, 0.5);
          const dragSpeed = dragVelRef.current.length();
          if (dragSpeed > 220) {
            spatialAudio.playClothRustle(dragSpeed, 0.5);
          }
        }
      } else if (target.type === 'prop' && target.prop) {
        const p = target.prop;
        if ('amplitude' in p) {
          // Candle
          p.group.position.set(hitPt.x, Math.max(40, hitPt.y), hitPt.z);
          p.baseY = hitPt.y;
        } else {
          // Pumpkin
          const pk = p as PumpkinProp;
          pk.position.set(hitPt.x, Math.max(0, hitPt.y), hitPt.z);
          pk.group.position.copy(pk.position);
          pk.velocity.copy(dragVelRef.current);
        }
      }
    }
    canvas.style.cursor = 'grabbing';
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const sim = simRef.current;
    const controls = controlsRef.current;
    const target = draggedTargetRef.current;

    if (target && target.type === 'prop' && target.prop && !('amplitude' in target.prop)) {
      // Impart throw momentum to the pumpkin
      const pk = target.prop as PumpkinProp;
      pk.velocity.copy(dragVelRef.current);
      pk.angularVel.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8
      );
      spatialAudio.playPropBump(pk.position.x, pk.position.y, pk.position.z, 'pumpkin');
    }
    draggedTargetRef.current = null;

    if (isGrabbingRef.current && sim) {
      isGrabbingRef.current = false;
      sim.endGrab();
      const throwSpeed = dragVelRef.current.length();
      if (throwSpeed > 180) {
        spatialAudio.playGhostWhoosh(
          cSRef.current.x,
          cSRef.current.y,
          cSRef.current.z,
          Math.min(2.5, throwSpeed / 220)
        );
      }
    }
    if (controls && cameraView !== 'projector_pov') {
      controls.enabled = true;
    }
    if (canvas) {
      canvas.style.cursor = '';
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Render and simulation loop
  useEffect(() => {
    let animId: number;
    let fpsTimer = performance.now();
    let frameCount = 0;
    const P0VP = new THREE.Matrix4();
    const pTarget = new THREE.Vector3(0, 60, 0);
    const fDelta = new THREE.Vector3();

    const loop = () => {
      animId = requestAnimationFrame(loop);

      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const cam = camRef.current;
      const pcam = pcamRef.current;
      const sim = simRef.current;
      const disp = dispRef.current;
      const clothMesh = clothMeshRef.current;
      const U = uniformsRef.current;
      const depthMat = depthMatRef.current;
      const shadowRT = shadowRTRef.current;
      const userRT = userRTRef.current;
      const qScene = qSceneRef.current;
      const qCam = qCamRef.current;
      const qMat = qMatRef.current;
      const controls = controlsRef.current;
      const projectorRig = projectorRigRef.current;

      if (!renderer || !scene || !cam || !pcam || !U) return;

      const dt = 1 / 60;

      // 0. Step Choreography Playback, Cues & Trajectory Following
      const choreo = choreoPlaybackRef.current;
      if (choreo.isPlaying && choreographyShow) {
        choreo.currentTime += dt * (choreo.playbackSpeed || 1.0);
        if (choreo.currentTime >= choreographyShow.duration) {
          if (choreographyShow.loop) {
            choreo.currentTime = choreo.currentTime % choreographyShow.duration;
            lastTriggeredCueIdsRef.current.clear();
          } else {
            choreo.currentTime = choreographyShow.duration;
            choreo.isPlaying = false;
            onUpdatePlayback?.({ isPlaying: false, currentTime: choreographyShow.duration });
          }
        }
        // Periodic React state throttle or scrub update
        if (Math.abs(choreo.currentTime - (playbackState?.currentTime || 0)) > 0.1) {
          onUpdatePlayback?.({ currentTime: Math.round(choreo.currentTime * 10) / 10 });
        }

        // Trigger cues
        for (const cue of choreographyShow.cues) {
          if (
            Math.abs(choreo.currentTime - cue.time) < 0.12 &&
            !lastTriggeredCueIdsRef.current.has(cue.id)
          ) {
            lastTriggeredCueIdsRef.current.add(cue.id);
            if (cue.type === 'lightning') {
              atmosphereManagerRef.current?.strikeLightning();
            } else if (cue.type === 'thunder') {
              spatialAudio.playThunder(cue.intensity || 1.2);
            } else if (cue.type === 'fog_burst') {
              atmosphereManagerRef.current?.triggerFogSurge();
            } else if (cue.type === 'organ_stab') {
              spatialAudio.playOrganStab();
            } else if (cue.type === 'whoosh') {
              spatialAudio.playGhostWhoosh(cSRef.current.x, cSRef.current.y, cSRef.current.z);
            }
            onCueTriggered?.(cue);
          }
        }
      }

      // If user scrubbed playhead backwards, reset triggered cues
      if (choreo.currentTime < 0.25) {
        lastTriggeredCueIdsRef.current.clear();
      }

      // Live Recording of User Mouse Drags into Flight Keyframes
      if (choreo.isRecording && choreo.recordingGhostId) {
        const now = performance.now();
        if (now - lastRecordTimeRef.current > 120) {
          lastRecordTimeRef.current = now;
          let curPos: { x: number; y: number; z: number } | null = null;
          if (choreo.recordingGhostId === 'ghost_1') {
            curPos = { x: Math.round(cSRef.current.x), y: Math.round(cSRef.current.y), z: Math.round(cSRef.current.z) };
          } else {
            const comp = companionMeshesRef.current.get(choreo.recordingGhostId);
            if (comp) {
              curPos = { x: Math.round(comp.pos.x), y: Math.round(comp.pos.y), z: Math.round(comp.pos.z) };
            }
          }
          if (curPos) {
            onRecordKeyframe?.(choreo.recordingGhostId, Math.round(choreo.currentTime * 10) / 10, curPos);
          }
        }
      }

      // Ghost Trajectory Follower during show playback for primary ghost
      if (choreographyShow && choreo.isPlaying && !isGrabbingRef.current) {
        const primaryTrack = choreographyShow.tracks.find((t) => t.ghostId === 'ghost_1');
        if (primaryTrack && primaryTrack.keyframes.length >= 2) {
          const targetPos = evaluateTrackPosition(
            primaryTrack,
            choreo.currentTime,
            choreographyShow.loop,
            choreographyShow.duration
          );
          if (targetPos && sim) {
            if (!sim.grab) {
              sim.startGrab(cSRef.current.x, cSRef.current.y, cSRef.current.z, 220);
            }
            sim.moveGrab(targetPos.x, targetPos.y, targetPos.z);
          }
        }
      } else if (!isGrabbingRef.current && sim && sim.grab && !choreo.isPlaying) {
        // Release grab back to fluid physics when playback is paused and user isn't grabbing
        sim.endGrab();
      }

      // 1. Step XPBD Simulation
      if (sim && disp && clothMesh) {
        sim.step(dt, clothParams);
        updateDisplayBuffer(disp, sim.x, clothParams.smoothing);
        smoothActivity(disp, sim.act);

        // Centroid computation for tracking
        let cx = 0, cy = 0, cz = 0;
        const X = sim.x;
        const n = sim.mesh.N;
        for (let i = 0; i < 3 * n; i += 3) {
          cx += X[i];
          cy += X[i + 1];
          cz += X[i + 2];
        }
        const cNow = new THREE.Vector3(cx / n, cy / n, cz / n);
        if (!centroidInitRef.current) {
          cSRef.current.copy(cNow);
          cRefRef.current.copy(cNow);
          centroidInitRef.current = true;
        } else {
          const moveSpeed = cNow.distanceTo(cSRef.current) / Math.max(0.001, dt);
          spatialAudio.updateClothMotion(moveSpeed, 0.45);
          cSRef.current.lerp(cNow, 0.25);
        }

        if (!refCapturedRef.current) {
          disp.ref.set(disp.pos);
          cRefRef.current.copy(cSRef.current);
          if (sim.time > 2.5 && !sim.grab) refCapturedRef.current = true;
        }

        const geo = clothMesh.geometry;
        geo.attributes.position.needsUpdate = true;
        geo.attributes.normal.needsUpdate = true;
        geo.attributes.aAct.needsUpdate = true;
        geo.attributes.aRef.needsUpdate = true;

        if (tendrilParams.enabled) {
          updateTendrils();
        }

        // Floor bounce acoustic trigger for primary ghost
        let minY = 9999;
        const simX = sim.x;
        for (let i = 1; i < simX.length; i += 3) {
          if (simX[i] < minY) minY = simX[i];
        }
        if (minY <= 4 && lowestPrevYRef.current > 12) {
          spatialAudio.playFloorBounce(cSRef.current.x, 0, cSRef.current.z, 140);
        }
        lowestPrevYRef.current = minY;
      }

      // 1.B Update 3D Audio Listener & Companion Ghosts Simulation
      spatialAudio.updateListenerPosition(cam.position.x, cam.position.y, cam.position.z);

      const companionPositions: THREE.Vector3[] = [];
      const companionRadii: number[] = [];
      const primaryCfg = ghosts.find((g) => g.id === 'ghost_1');
      const primaryScale = primaryCfg?.scale || 1.0;
      const simTime = (sim ? sim.time : performance.now() * 0.001);
      const activeDraggedTarget = draggedTargetRef.current;

      for (const [id, comp] of companionMeshesRef.current.entries()) {
        const isDragged = activeDraggedTarget?.type === 'companion' && activeDraggedTarget.id === id;
        if (!isDragged) {
          // If show playback is active, follow choreographed flight path
          let hasShowPosition = false;
          if (choreographyShow && choreo.isPlaying) {
            const trk = choreographyShow.tracks.find((t) => t.ghostId === id);
            if (trk && trk.keyframes.length >= 2) {
              const showPos = evaluateTrackPosition(
                trk,
                choreo.currentTime,
                choreographyShow.loop,
                choreographyShow.duration
              );
              if (showPos) {
                comp.pos.lerp(showPos, 0.35);
                comp.group.position.copy(comp.pos);
                hasShowPosition = true;
              }
            }
          }

          if (!hasShowPosition) {
            // Floating harmonic hover
            const hoverOffset = Math.sin(simTime * 2.2 + comp.basePos.x * 0.05) * (26 * comp.scale);
            const targetY = comp.basePos.y + hoverOffset;
            comp.pos.y += (targetY - comp.pos.y) * 0.08;

            // Gentle organic floating sway
            comp.group.rotation.z = Math.sin(simTime * 1.8 + comp.basePos.z * 0.05) * 0.08;
            comp.group.rotation.x = Math.cos(simTime * 1.5 + comp.basePos.x * 0.05) * 0.08;

            // Elastic collision repulsion against primary ghost
            const distToPrimary = comp.pos.distanceTo(cSRef.current);
            const contactDist = 110 * primaryScale + 75 * comp.scale;
            if (distToPrimary < contactDist && distToPrimary > 0.01) {
              const overlap = contactDist - distToPrimary;
              const pushDir = comp.pos.clone().sub(cSRef.current).normalize();
              comp.pos.addScaledVector(pushDir, overlap * 0.5);
              comp.group.rotation.z += pushDir.x * 0.2;
              if (overlap > 10 && Math.random() < 0.05) {
                spatialAudio.playFloorBounce(comp.pos.x, comp.pos.y, comp.pos.z, 80);
              }
            }

            // Floor collision
            if (comp.pos.y < 45 * comp.scale) {
              comp.pos.y = 45 * comp.scale;
              spatialAudio.playFloorBounce(comp.pos.x, comp.pos.y, comp.pos.z, 60);
            }

            comp.group.position.copy(comp.pos);
          }
        }
        companionPositions.push(comp.pos);
        companionRadii.push(65 * comp.scale);
      }

      // 1.C Update Interactive Spooky Props (candles & pumpkins)
      if (propsManagerRef.current) {
        if (propsState) {
          propsManagerRef.current.candleGlowIntensity = propsState.candleGlow;
          propsManagerRef.current.physicsEnabled = propsState.pumpkinPhysics;
        }
        propsManagerRef.current.update(
          dt,
          [cSRef.current, ...companionPositions],
          [110 * primaryScale, ...companionRadii]
        );
      }

      // 1.D Update Atmospheric Storm & Volumetric Ground Fog
      if (atmosphereManagerRef.current) {
        if (atmosphere) {
          atmosphereManagerRef.current.config.fogDensity = atmosphere.fogDensity;
          atmosphereManagerRef.current.config.fogHeight = atmosphere.fogHeight;
          atmosphereManagerRef.current.config.fogSpeed = atmosphere.fogSpeed;
          atmosphereManagerRef.current.config.lightningFrequency = atmosphere.lightningFrequency;
          atmosphereManagerRef.current.config.stormDarkness = atmosphere.stormDarkness;
          atmosphereManagerRef.current.config.lightningIntensity = atmosphere.lightningIntensity;
        }
        atmosphereManagerRef.current.update(dt, cSRef.current);

        // Modulate ambient and light intensity with storm darkness
        if (atmosphere) {
          const darkFactor = Math.max(0.1, 1.0 - atmosphere.stormDarkness * 0.7);
          U.uAmb.value = 0.015 * darkFactor;
          U.uLight.value = 0.12 * darkFactor;
        }
      }


      // 2. Update Virtual Optical Projector
      const az = (projectorParams.azimuth * Math.PI) / 180;
      const el = (projectorParams.elevation * Math.PI) / 180;
      const D = projectorParams.distance;
      const basePos = new THREE.Vector3(
        pTarget.x + Math.sin(az) * Math.cos(el) * D,
        pTarget.y + Math.sin(el) * D,
        pTarget.z + Math.cos(az) * Math.cos(el) * D
      );

      pcam.fov = projectorParams.fov;
      pcam.near = 200;
      pcam.far = 4000;
      pcam.updateProjectionMatrix();

      // Static reference projector
      pcam.position.copy(basePos);
      pcam.lookAt(pTarget);
      pcam.updateMatrixWorld();
      P0VP.multiplyMatrices(pcam.projectionMatrix, pcam.matrixWorldInverse);

      // Dynamic tracking (spotlight mode)
      fDelta.set(0, 0, 0);
      if (projectorParams.stickMode === 1 && centroidInitRef.current) {
        fDelta.subVectors(cSRef.current, cRefRef.current);
      }

      pcam.position.copy(basePos).add(fDelta);
      pcam.lookAt(pTarget.clone().add(fDelta));
      pcam.updateMatrixWorld();

      U.uProjVP.value.multiplyMatrices(pcam.projectionMatrix, pcam.matrixWorldInverse);
      U.uContentVP.value.copy(projectorParams.stickMode === 1 ? U.uProjVP.value : P0VP);
      U.uProjPos.value.copy(pcam.position);
      U.uNear.value = pcam.near;
      U.uFar.value = pcam.far;

      if (projectorRig) {
        projectorRig.position.copy(pcam.position);
        projectorRig.quaternion.copy(pcam.quaternion);
      }

      // 3. Update uniforms & touch decay
      const spd = shaderParams.speed > 5 ? shaderParams.speed / 100 : shaderParams.speed;
      U.uTime.value += dt * Math.max(0.1, spd) * 2.5;
      U.uTouchAge.value += dt;
      if (U.uTouchHold.value > 0.05) {
        const q = U.uTouch.value.clone().applyMatrix4(U.uContentVP.value);
        U.uMouse.value.set(q.x * 0.5 + 0.5, q.y * 0.5 + 0.5);
      }
      if (!isGrabbingRef.current) {
        U.uTouchHold.value *= 0.93;
      }

      // WASD camera movement and QE zoom in/out
      if (cam && controls && cameraView !== 'projector_pov') {
        const keys = keysDownRef.current;
        if (keys.size > 0) {
          const fwd = new THREE.Vector3();
          cam.getWorldDirection(fwd);
          fwd.y = 0;
          if (fwd.lengthSq() < 1e-4) {
            fwd.set(0, 0, -1);
          } else {
            fwd.normalize();
          }
          const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();

          const toCam = new THREE.Vector3().subVectors(cam.position, controls.target);
          const currentDist = toCam.length();
          const moveSpeed = Math.max(6.0, currentDist * 0.018);
          const zoomSpeed = Math.max(5.0, currentDist * 0.025);

          const deltaMove = new THREE.Vector3();
          if (keys.has('w') || keys.has('arrowup')) deltaMove.addScaledVector(fwd, moveSpeed);
          if (keys.has('s') || keys.has('arrowdown')) deltaMove.addScaledVector(fwd, -moveSpeed);
          if (keys.has('a') || keys.has('arrowleft')) deltaMove.addScaledVector(right, -moveSpeed);
          if (keys.has('d') || keys.has('arrowright')) deltaMove.addScaledVector(right, moveSpeed);

          if (deltaMove.lengthSq() > 0) {
            cam.position.add(deltaMove);
            controls.target.add(deltaMove);
          }

          if (keys.has('q')) {
            const newDist = Math.max(controls.minDistance + 5, currentDist - zoomSpeed);
            cam.position.copy(controls.target).addScaledVector(toCam.normalize(), newDist);
          }
          if (keys.has('e')) {
            const newDist = Math.min(controls.maxDistance - 5, currentDist + zoomSpeed);
            cam.position.copy(controls.target).addScaledVector(toCam.normalize(), newDist);
          }
        }
      }

      if (controls && controls.enabled) {
        controls.update();
      }

      // 4. Render User GLSL Sandbox offscreen FBO pass
      if (userRT && qScene && qCam && qMat) {
        qMat.uniforms.uTime.value = U.uTime.value;
        qMat.uniforms.uBass.value = audioEnergy;
        qMat.uniforms.uMouse.value.copy(U.uMouse.value);
        qMat.uniforms.uWindVel.value.set(clothParams.windStrength * 20, 0);
        if (U.uBass) U.uBass.value = audioEnergy;

        const dst = userRT[userIdxRef.current];
        qMat.uniforms.backbuffer.value = userRT[1 - userIdxRef.current].texture;

        renderer.setRenderTarget(dst);
        renderer.render(qScene, qCam);
        renderer.setRenderTarget(null);

        U.uUserTex.value = dst.texture;
        userIdxRef.current = 1 - userIdxRef.current;
      }

      // 5. Render Projector Depth Shadow pass
      if (shadowRT && depthMat) {
        if (projectorRig) projectorRig.visible = false;
        scene.overrideMaterial = depthMat;
        renderer.setRenderTarget(shadowRT);
        renderer.setClearColor(0xffffff, 1);
        renderer.clear();
        renderer.render(scene, pcam);
        scene.overrideMaterial = null;
        renderer.setRenderTarget(null);
        renderer.setClearColor(0x000000, 1);
        if (projectorRig) projectorRig.visible = projectorParams.showRig;
      }

      // 6. Main Viewport Render
      renderer.render(scene, cam);

      // 7. FPS and stats aggregation
      frameCount++;
      const now = performance.now();
      if (now - fpsTimer > 500) {
        const fps = Math.round((frameCount * 1000) / (now - fpsTimer));
        frameCount = 0;
        fpsTimer = now;

        onStatsUpdate({
          fps,
          particles: sim ? sim.mesh.N : 0,
          heightMm: sim ? sim.height : 0,
          volumeLiters: sim ? sim.volume / 1e6 : 0,
          windSpeed: 0,
        });
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    clothParams,
    projectorParams,
    shaderParams,
    tendrilParams,
    audioEnergy,
    onStatsUpdate,
    cameraView,
    ghosts,
    propsState,
    choreographyShow,
    atmosphere,
    onRecordKeyframe,
    onCueTriggered,
    onUpdatePlayback,
  ]);


  return (
    <div ref={containerRef} className="relative w-full h-full select-none overflow-hidden">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full h-full block cursor-default"
      />

      {/* Floating Spatial Navigation HUD Pill with WASD and QE controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none flex items-center gap-3 bg-neutral-950/85 backdrop-blur-md px-4 py-2 border border-neutral-800/80 rounded-xl shadow-2xl">
        <div className="flex items-center gap-2 text-xs text-neutral-300">
          <span className="text-neutral-400 font-mono text-[10px] uppercase tracking-wider mr-1">Controls:</span>
          <span>
            <strong className="text-cyan-300 font-medium">WASD</strong> move camera · <strong className="text-cyan-300 font-medium">Q / E</strong> zoom · Drag ghost to stretch · Drag background to orbit · Scroll to zoom
          </span>
        </div>
      </div>
    </div>
  );
};
