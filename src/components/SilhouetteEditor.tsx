import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BezierNode, GhostArchetype } from '../types';
import {
  createNode,
  evalBezier,
  flattenSpline,
  polygonArea,
  SHROUD_PRESETS,
} from '../engine/bezier';
import { buildClothMesh } from '../engine/meshBuilder';
import {
  BUILTIN_ARCHETYPES,
  loadUserArchetypes,
  saveUserArchetype,
} from '../engine/archetypes';
import {
  ContourClothSimulator,
  ClothPhysicsConfig,
  DEFAULT_CLOTH_PHYSICS_CONFIG,
} from '../engine/clothPhysics';
import {
  RotateCcw,
  RotateCw,
  Sparkles,
  Maximize2,
  Trash2,
  CheckCircle2,
  Scissors,
  Layers,
  Box,
  Compass,
  Move,
  Rotate3d,
  MousePointer,
  Square,
  BookmarkPlus,
  Sliders,
  Check,
  Wind,
  Play,
  Pause,
  Waves,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface SilhouetteEditorProps {
  initialNodes: BezierNode[];
  onApply: (nodes: BezierNode[]) => void;
  onCancel: () => void;
  onLoadArchetype?: (archetype: GhostArchetype) => void;
  onSaveArchetype?: (name: string, desc: string) => void;
}

type TransformHandleType =
  | 'nw'
  | 'ne'
  | 'se'
  | 'sw'
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'rot'
  | 'body';

export const SilhouetteEditor: React.FC<SilhouetteEditorProps> = ({
  initialNodes,
  onApply,
  onCancel,
  onLoadArchetype,
  onSaveArchetype,
}) => {
  // 2D Canvas State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [nodes, setNodes] = useState<BezierNode[]>(() =>
    initialNodes.map((n) => ({ ...n }))
  );
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [activeSingleIdx, setActiveSingleIdx] = useState<number>(-1);
  const [view, setView] = useState({ cx: 0, cy: 0, sc: 1.0 });
  const [mousePos, setMousePos] = useState<[number, number] | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [shiftPressed, setShiftPressed] = useState(false);
  const [symmetryMode, setSymmetryMode] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Marquee Selection Box [x0, y0, x1, y1] in world coordinates
  const [marqueeBox, setMarqueeBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  // Drag interaction state
  const [drag, setDrag] = useState<{
    type: 'pan' | 'node' | 'handle' | 'marquee' | 'gizmo';
    sx: number;
    sy: number;
    cx?: number;
    cy?: number;
    idx?: number;
    handle?: 'i' | 'o';
    gizmoType?: TransformHandleType;
    initialNodes?: BezierNode[];
    boxCenter?: [number, number];
    boxSize?: [number, number];
  } | null>(null);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<BezierNode[][]>(() => [
    initialNodes.map((n) => ({ ...n })),
  ]);
  const [historyIdx, setHistoryIdx] = useState<number>(0);

  // 3D Live Preview State
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const previewRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const previewSceneRef = useRef<THREE.Scene | null>(null);
  const previewCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const previewControlsRef = useRef<OrbitControls | null>(null);
  const previewMeshRef = useRef<THREE.Mesh | null>(null);
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);
  const [clothShading, setClothShading] = useState<'solid' | 'normals'>('solid');

  // Archetype management modal
  const [archetypeDropdownOpen, setArchetypeDropdownOpen] = useState<boolean>(false);
  const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false);
  const [newArchetypeName, setNewArchetypeName] = useState<string>('');
  const [newArchetypeDesc, setNewArchetypeDesc] = useState<string>('');
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Combined archetypes
  const [userArchetypes, setUserArchetypes] = useState<GhostArchetype[]>(() => loadUserArchetypes());

  // Real-Time Cloth Physics & Hem Flutter State
  const [clothConfig, setClothConfig] = useState<ClothPhysicsConfig>(DEFAULT_CLOTH_PHYSICS_CONFIG);
  const [clothSimActive, setClothSimActive] = useState<boolean>(false);
  const [isFlutterPlaying, setIsFlutterPlaying] = useState<boolean>(true);
  const [clothDrawerOpen, setClothDrawerOpen] = useState<boolean>(false);
  const [bakedSuccessNotice, setBakedSuccessNotice] = useState<string | null>(null);
  const clothSimRef = useRef<ContourClothSimulator>(new ContourClothSimulator());
  const basePositions3DRef = useRef<Float32Array | null>(null);
  const vertexNormYRef = useRef<Float32Array | null>(null);
  const flutterPolygonRef = useRef<[number, number][]>([]);
  const clothSimActiveRef = useRef<boolean>(clothSimActive);
  const clothConfigRef = useRef<ClothPhysicsConfig>(clothConfig);

  useEffect(() => {
    clothSimActiveRef.current = clothSimActive;
    clothConfigRef.current = clothConfig;
  }, [clothSimActive, clothConfig]);

  // Re-initialize cloth simulation particles whenever nodes change or simulation starts
  useEffect(() => {
    if (clothSimActive && nodes.length >= 3) {
      clothSimRef.current.init(nodes, 96);
    }
  }, [clothSimActive, nodes]);

  const pushHistory = useCallback(
    (newNodes: BezierNode[]) => {
      const cloned = newNodes.map((n) => ({ ...n }));
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIdx + 1);
        return [...sliced, cloned];
      });
      setHistoryIdx((prev) => prev + 1);
    },
    [historyIdx]
  );

  const handleUndo = () => {
    if (historyIdx > 0) {
      const newIdx = historyIdx - 1;
      setHistoryIdx(newIdx);
      setNodes(history[newIdx].map((n) => ({ ...n })));
    }
  };

  const handleRedo = () => {
    if (historyIdx < history.length - 1) {
      const newIdx = historyIdx + 1;
      setHistoryIdx(newIdx);
      setNodes(history[newIdx].map((n) => ({ ...n })));
    }
  };

  // Find paired symmetric node across X=0
  const findSymmetricNodeIdx = (idx: number, currentNodes: BezierNode[]): number => {
    const target = currentNodes[idx];
    if (Math.abs(target.x) < 4) return idx; // Centerline node
    let bestDist = 1e9;
    let bestIdx = -1;
    for (let i = 0; i < currentNodes.length; i++) {
      if (i === idx) continue;
      const candidate = currentNodes[i];
      const dist = Math.hypot(candidate.x - -target.x, candidate.y - target.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return bestDist < 120 ? bestIdx : -1;
  };

  // Fit 2D canvas view to contour
  const fitView = useCallback((currentNodes: BezierNode[]) => {
    if (!canvasRef.current) return;
    const w = canvasRef.current.clientWidth || 600;
    const h = canvasRef.current.clientHeight || 500;
    const flat =
      currentNodes.length > 1
        ? flattenSpline(currentNodes, true, 16)
        : [[-200, -200], [200, 200]];
    let minX = 1e9,
      minY = 1e9,
      maxX = -1e9,
      maxY = -1e9;
    for (const p of flat) {
      minX = Math.min(minX, p[0]);
      minY = Math.min(minY, p[1]);
      maxX = Math.max(maxX, p[0]);
      maxY = Math.max(maxY, p[1]);
    }
    const spanW = Math.max(250, maxX - minX);
    const spanH = Math.max(250, maxY - minY);
    setView({
      cx: 0,
      cy: (minY + maxY) / 2,
      sc: Math.min(w / (spanW * 1.55), h / (spanH * 1.55)),
    });
  }, []);

  useEffect(() => {
    fitView(nodes);
  }, [fitView]); // eslint-disable-line react-hooks/exhaustive-deps

  const toScreen = useCallback(
    (wx: number, wy: number, width: number, height: number): [number, number] => {
      return [width / 2 + (wx - view.cx) * view.sc, height / 2 + (wy - view.cy) * view.sc];
    },
    [view]
  );

  const toWorld = useCallback(
    (sx: number, sy: number, width: number, height: number): [number, number] => {
      return [(sx - width / 2) / view.sc + view.cx, (sy - height / 2) / view.sc + view.cy];
    },
    [view]
  );

  // Calculate bounding box of currently selected nodes
  const getSelectedBoundingBox = useCallback(() => {
    if (selectedIndices.size === 0) return null;
    let minX = 1e9,
      minY = 1e9,
      maxX = -1e9,
      maxY = -1e9;
    selectedIndices.forEach((idx) => {
      const n = nodes[idx];
      if (n) {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x > maxX) maxX = n.x;
        if (n.y > maxY) maxY = n.y;
      }
    });
    if (minX > maxX) return null;
    return {
      minX,
      minY,
      maxX,
      maxY,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      w: Math.max(20, maxX - minX),
      h: Math.max(20, maxY - minY),
    };
  }, [selectedIndices, nodes]);

  // Initialize 3D Live Drape Preview
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08090c);
    previewSceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(36, width / height, 10, 3000);
    camera.position.set(0, 180, 520);
    previewCameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    previewRendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 40, 0);
    previewControlsRef.current = controls;

    // Studio Lighting
    const ambLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambLight);

    const dirLight1 = new THREE.DirectionalLight(0xa5f3fc, 1.4);
    dirLight1.position.set(200, 400, 250);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xc084fc, 0.9);
    dirLight2.position.set(-200, 200, -180);
    scene.add(dirLight2);

    const rimLight = new THREE.PointLight(0x38bdf8, 1.2, 800);
    rimLight.position.set(0, -100, 150);
    scene.add(rimLight);

    // Subtle Ground Pedestal Ring
    const ringGeo = new THREE.RingGeometry(180, 184, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = -120;
    scene.add(ringMesh);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      if (previewMeshRef.current) {
        const t = performance.now() * 0.0015;
        previewMeshRef.current.position.y = Math.sin(t * 1.5) * 8;
        previewMeshRef.current.rotation.y = Math.sin(t * 0.8) * 0.06;

        // Dynamic 3D Cloth Physics Hem Flutter Deformation
        if (clothSimActiveRef.current && basePositions3DRef.current && vertexNormYRef.current) {
          const geo = previewMeshRef.current.geometry;
          const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
          if (posAttr) {
            const posArray = posAttr.array as Float32Array;
            const basePos = basePositions3DRef.current;
            const normY = vertexNormYRef.current;
            const cfg = clothConfigRef.current;
            const speed = cfg.windSpeed * 0.01;
            const turb = cfg.turbulence * 0.01;
            const draft = cfg.upwardDraft * 0.01;
            const windRad = (cfg.windAngle * Math.PI) / 180;
            const cosW = Math.cos(windRad);
            const sinW = Math.sin(windRad);

            const count = Math.min(posArray.length / 3, basePos.length / 3);
            for (let i = 0; i < count; i++) {
              const ny = normY[i]; // 0 at head, 1.0 at skirt hem
              if (ny > 0.22) {
                const flutterFactor = Math.pow((ny - 0.22) / 0.78, 1.7);
                const bx = basePos[3 * i];
                const by = basePos[3 * i + 1];
                const bz = basePos[3 * i + 2];

                const wave1 = Math.sin(t * 6.5 + bx * 0.035 + by * 0.02);
                const wave2 = Math.cos(t * 8.8 + bz * 0.04 - bx * 0.02);
                const wave3 = Math.sin(t * 12.4 + (bx + bz) * 0.045);

                const ripple = (wave1 * 0.55 + wave2 * 0.3 + wave3 * 0.2) * (turb * 22);
                const windDisplacement = speed * 15;

                posArray[3 * i] = bx + (cosW * windDisplacement + ripple) * flutterFactor;
                posArray[3 * i + 1] = by + (-draft * 16 + ripple * 0.4) * flutterFactor;
                posArray[3 * i + 2] = bz + (sinW * windDisplacement + wave2 * turb * 18) * flutterFactor;
              }
            }
            posAttr.needsUpdate = true;
            geo.computeVertexNormals();
          }
        }
      }

      renderer.render(scene, camera);
    };
    animate();

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
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update 3D Preview Mesh whenever 2D nodes mutate
  useEffect(() => {
    const scene = previewSceneRef.current;
    if (!scene) return;

    try {
      const meshData = buildClothMesh(nodes, 600);
      if (meshData.err || !meshData.pos0 || !meshData.index) {
        setErrorMessage(meshData.err || 'Invalid mesh topology');
        return;
      }
      setErrorMessage(null);

      if (previewMeshRef.current) {
        scene.remove(previewMeshRef.current);
        previewMeshRef.current.geometry.dispose();
        if (Array.isArray(previewMeshRef.current.material)) {
          previewMeshRef.current.material.forEach((m) => m.dispose());
        } else {
          previewMeshRef.current.material.dispose();
        }
        previewMeshRef.current = null;
      }

      const N = meshData.N;
      const pos0 = meshData.pos0;
      const indices = meshData.index;

      const positions3D = new Float32Array(N * 3);
      let minY = 1e9,
        maxY = -1e9;
      for (let i = 0; i < N; i++) {
        const y = -pos0[2 * i + 1];
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const heightSpan = Math.max(1, maxY - minY);

      const normYArray = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const x = pos0[2 * i];
        const y = -pos0[2 * i + 1];
        const normY = (y - minY) / heightSpan;
        normYArray[i] = normY;
        const domeCurve = Math.sin(normY * Math.PI * 0.95);
        const z = domeCurve * (65 + Math.sin(x * 0.04) * 8);

        positions3D[3 * i] = x;
        positions3D[3 * i + 1] = y;
        positions3D[3 * i + 2] = z;
      }

      basePositions3DRef.current = new Float32Array(positions3D);
      vertexNormYRef.current = normYArray;

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions3D, 3));
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
      geo.computeVertexNormals();

      const mat =
        clothShading === 'normals'
          ? new THREE.MeshNormalMaterial({
              wireframe: wireframeMode,
              side: THREE.DoubleSide,
            })
          : new THREE.MeshStandardMaterial({
              color: 0xd4d4d4,
              roughness: 0.35,
              metalness: 0.1,
              wireframe: wireframeMode,
              side: THREE.DoubleSide,
            });

      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      previewMeshRef.current = mesh;
    } catch {
      // Ignore active drag topology states
    }
  }, [nodes, wireframeMode, clothShading]);

  // Curvature Smoothing Tool
  const handleSmoothContour = () => {
    if (nodes.length < 3) return;
    const n = nodes.length;
    const smoothed = nodes.map((curr, i) => {
      // If we have selected nodes, only smooth selected ones
      if (selectedIndices.size > 0 && !selectedIndices.has(i)) {
        return { ...curr };
      }

      const prev = nodes[(i - 1 + n) % n];
      const next = nodes[(i + 1) % n];
      const isCenter = Math.abs(curr.x) < 5;
      const newX = isCenter ? 0 : curr.x * 0.5 + (prev.x + next.x) * 0.25;
      const newY = curr.y * 0.5 + (prev.y + next.y) * 0.25;

      const dx = (next.x - prev.x) * 0.25;
      const dy = (next.y - prev.y) * 0.25;

      return {
        x: newX,
        y: newY,
        ix: -dx,
        iy: -dy,
        ox: dx,
        oy: dy,
      };
    });

    setNodes(smoothed);
    pushHistory(smoothed);
  };

  // Subdivide Tool
  const handleSubdivide = () => {
    const targetIdx = activeSingleIdx >= 0 ? activeSingleIdx : Array.from(selectedIndices)[0] ?? -1;
    if (targetIdx < 0 || nodes.length < 2) return;
    const nextIdx = (targetIdx + 1) % nodes.length;
    const a = nodes[targetIdx];
    const b = nodes[nextIdx];
    const [midX, midY] = evalBezier(a, b, 0.5);

    const newNode = createNode(
      midX,
      midY,
      (a.x - b.x) * 0.15,
      (a.y - b.y) * 0.15,
      (b.x - a.x) * 0.15,
      (b.y - a.y) * 0.15
    );

    const newNodes = [...nodes];
    newNodes.splice(targetIdx + 1, 0, newNode);
    setNodes(newNodes);
    pushHistory(newNodes);
    setActiveSingleIdx(targetIdx + 1);
    setSelectedIndices(new Set([targetIdx + 1]));
  };

  // Convert Node Corner Type: Smooth vs Sharp vs Flat
  const handleSetCornerType = (type: 'smooth' | 'sharp' | 'balanced') => {
    const targets = selectedIndices.size > 0 ? selectedIndices : new Set([activeSingleIdx]);
    if (targets.size === 0) return;

    setNodes((prev) => {
      const updated = prev.map((node, i) => {
        if (!targets.has(i)) return { ...node };
        const copy = { ...node };
        if (type === 'sharp') {
          copy.ix = 0;
          copy.iy = 0;
          copy.ox = 0;
          copy.oy = 0;
        } else if (type === 'balanced') {
          // Equalize handle lengths in opposite directions
          const len = (Math.hypot(copy.ix, copy.iy) + Math.hypot(copy.ox, copy.oy)) * 0.5 || 30;
          const angle = Math.atan2(copy.oy, copy.ox);
          copy.ox = Math.cos(angle) * len;
          copy.oy = Math.sin(angle) * len;
          copy.ix = -copy.ox;
          copy.iy = -copy.oy;
        } else {
          // Smooth curvature based on neighboring nodes
          const n = prev.length;
          const pPrev = prev[(i - 1 + n) % n];
          const pNext = prev[(i + 1) % n];
          const dx = (pNext.x - pPrev.x) * 0.25;
          const dy = (pNext.y - pPrev.y) * 0.25;
          copy.ox = dx;
          copy.oy = dy;
          copy.ix = -dx;
          copy.iy = -dy;
        }
        return copy;
      });
      pushHistory(updated);
      return updated;
    });
  };

  // Delete Selected Node(s)
  const handleDeleteNode = () => {
    const targets = selectedIndices.size > 0 ? selectedIndices : new Set([activeSingleIdx]);
    if (nodes.length - targets.size < 4 || targets.size === 0) return;
    const newNodes = nodes.filter((_, idx) => !targets.has(idx));
    setNodes(newNodes);
    pushHistory(newNodes);
    setSelectedIndices(new Set());
    setActiveSingleIdx(-1);
  };

  // Select all nodes
  const handleSelectAll = () => {
    const all = new Set<number>();
    nodes.forEach((_, i) => all.add(i));
    setSelectedIndices(all);
    setActiveSingleIdx(0);
  };

  // Cloth Simulation Handlers
  const handleToggleClothSim = () => {
    if (!clothSimActive) {
      clothSimRef.current.init(nodes, 96);
      setClothSimActive(true);
      setClothDrawerOpen(true);
    } else {
      setClothSimActive(false);
    }
  };

  const handleBakeFlutter = () => {
    if (!clothSimActive) return;
    const baked = clothSimRef.current.bakeToNodes();
    setNodes(baked);
    pushHistory(baked);
    setClothSimActive(false);
    setBakedSuccessNotice('✨ Flutter Pose Frozen & Baked into Bezier Spline!');
    setTimeout(() => setBakedSuccessNotice(null), 3500);
  };

  const handleResetRestPose = () => {
    clothSimRef.current.resetToRest();
    flutterPolygonRef.current = [];
    draw2D();
  };

  // Archetype Actions
  const handleLoadArchetype = (arch: GhostArchetype) => {
    setNodes(arch.nodes.map((n) => ({ ...n })));
    pushHistory(arch.nodes);
    fitView(arch.nodes);
    if (arch.clothPhysics) {
      setClothConfig((prev) => ({ ...prev, ...arch.clothPhysics }));
      if (arch.clothPhysics.enabled) {
        setClothSimActive(true);
        setClothDrawerOpen(true);
      }
    }
    onLoadArchetype?.(arch);
    setArchetypeDropdownOpen(false);
  };

  const handleSaveArchetype = () => {
    if (!newArchetypeName.trim()) return;
    const customArch: GhostArchetype = {
      id: `custom_${Date.now()}`,
      name: newArchetypeName.trim(),
      desc: newArchetypeDesc.trim() || 'Custom user sculpted contour archetype',
      nodes: nodes.map((n) => ({ ...n })),
      shaderParams: {},
      clothPhysics: clothConfig,
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

  // 2D Canvas Drawing
  const draw2D = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Dark grid background
    ctx.fillStyle = '#08090c';
    ctx.fillRect(0, 0, w, h);

    // Draw coordinate grid lines
    const gridSpacing = 50 * view.sc;
    const [ox, oy] = toScreen(0, 0, w, h);

    ctx.strokeStyle = '#181b22';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = ox % gridSpacing; x < w; x += gridSpacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = oy % gridSpacing; y < h; y += gridSpacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Symmetry Centerline Axis (X = 0)
    if (symmetryMode) {
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(ox, 0);
      ctx.lineTo(ox, h);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#22d3ee';
      ctx.font = '10px JetBrains Mono';
      ctx.fillText('MIRROR AXIS (X=0)', ox + 6, 20);
    }

    if (nodes.length < 2) return;

    // Evaluated closed Bezier curve (rest pose)
    const flat = flattenSpline(nodes, true, 36);
    ctx.strokeStyle = clothSimActive ? 'rgba(34, 211, 238, 0.35)' : '#22d3ee';
    ctx.lineWidth = clothSimActive ? 1.5 : 2.5;
    if (clothSimActive) ctx.setLineDash([4, 4]);
    ctx.beginPath();
    flat.forEach(([wx, wy], idx) => {
      const [sx, sy] = toScreen(wx, wy, w, h);
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.stroke();
    if (clothSimActive) ctx.setLineDash([]);

    // Semi-transparent interior fill
    ctx.fillStyle = clothSimActive ? 'rgba(34, 211, 238, 0.03)' : 'rgba(34, 211, 238, 0.06)';
    ctx.fill();

    // Render Real-Time Fluttering Cloth Simulation Contour (Verlet Network)
    if (clothSimActive && flutterPolygonRef.current.length > 2) {
      const flutterPoly = flutterPolygonRef.current;
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      flutterPoly.forEach(([wx, wy], idx) => {
        const [sx, sy] = toScreen(wx, wy, w, h);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = 'rgba(52, 211, 153, 0.08)';
      ctx.fill();

      // Draw subtle flutter nodes along the lower hem
      ctx.fillStyle = '#34d399';
      for (let pIdx = 0; pIdx < flutterPoly.length; pIdx += 3) {
        const [fx, fy] = flutterPoly[pIdx];
        const [fsx, fsy] = toScreen(fx, fy, w, h);
        ctx.beginPath();
        ctx.arc(fsx, fsy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Wind Vector Compass Indicator at top-left
      const windAngle = clothConfig.windAngle;
      const windRad = (windAngle * Math.PI) / 180;
      const windLen = 22 + (clothConfig.windSpeed / 100) * 18;
      const compassCx = 46;
      const compassCy = 46;

      ctx.save();
      ctx.fillStyle = 'rgba(9, 10, 15, 0.75)';
      ctx.beginPath();
      ctx.arc(compassCx, compassCy, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Wind Arrow
      const tipX = compassCx + Math.cos(windRad) * windLen;
      const tipY = compassCy + Math.sin(windRad) * windLen;
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(compassCx, compassCy);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Arrow Head
      const headAngle = Math.PI * 0.85;
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX + Math.cos(windRad + headAngle) * 6, tipY + Math.sin(windRad + headAngle) * 6);
      ctx.lineTo(tipX + Math.cos(windRad - headAngle) * 6, tipY + Math.sin(windRad - headAngle) * 6);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#34d399';
      ctx.font = '9px JetBrains Mono';
      ctx.fillText(`${clothConfig.windSpeed} km/h`, compassCx - 18, compassCy + 44);
      ctx.restore();
    }

    // Render Nodes and Tangent Handles
    nodes.forEach((node, idx) => {
      const [nx, ny] = toScreen(node.x, node.y, w, h);
      const isSelected = selectedIndices.has(idx) || idx === activeSingleIdx;

      // Draw tangent handles if selected
      if (isSelected) {
        const [inX, inY] = toScreen(node.x + node.ix, node.y + node.iy, w, h);
        const [outX, outY] = toScreen(node.x + node.ox, node.y + node.oy, w, h);

        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(inX, inY);
        ctx.lineTo(nx, ny);
        ctx.lineTo(outX, outY);
        ctx.stroke();

        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.arc(inX, inY, 4, 0, Math.PI * 2);
        ctx.arc(outX, outY, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Anchor Point Box
      ctx.fillStyle = isSelected ? '#38bdf8' : '#e2e8f0';
      ctx.strokeStyle = isSelected ? '#ffffff' : '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(nx, ny, isSelected ? 6.5 : 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isSelected ? '#38bdf8' : '#64748b';
      ctx.font = '10px JetBrains Mono';
      ctx.fillText(`${idx + 1}`, nx + 8, ny - 6);
    });

    // Render Bounding Box Transform Gizmo when multiple nodes are selected
    const bbox = getSelectedBoundingBox();
    if (bbox && selectedIndices.size > 1) {
      const [b0x, b0y] = toScreen(bbox.minX, bbox.minY, w, h);
      const [b1x, b1y] = toScreen(bbox.maxX, bbox.maxY, w, h);
      const bw = b1x - b0x;
      const bh = b1y - b0y;
      const [bcx, bcy] = toScreen(bbox.cx, bbox.cy, w, h);

      // Bounding box border
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(b0x, b0y, bw, bh);
      ctx.setLineDash([]);

      // Rotation stem and handle
      const rotY = b0y - 24;
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bcx, b0y);
      ctx.lineTo(bcx, rotY);
      ctx.stroke();

      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(bcx, rotY, 5, 0, Math.PI * 2);
      ctx.fill();

      // 8 Resize Handles (Corners & Edges)
      const handles: [number, number, TransformHandleType][] = [
        [b0x, b0y, 'nw'],
        [bcx, b0y, 'n'],
        [b1x, b0y, 'ne'],
        [b1x, bcy, 'e'],
        [b1x, b1y, 'se'],
        [bcx, b1y, 's'],
        [b0x, b1y, 'sw'],
        [b0x, bcy, 'w'],
      ];

      handles.forEach(([hx, hy]) => {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.fillRect(hx - 4, hy - 4, 8, 8);
        ctx.strokeRect(hx - 4, hy - 4, 8, 8);
      });
    }

    // Render Marquee Selection Box
    if (marqueeBox) {
      const [m0x, m0y] = toScreen(marqueeBox.x0, marqueeBox.y0, w, h);
      const [m1x, m1y] = toScreen(marqueeBox.x1, marqueeBox.y1, w, h);
      const mw = m1x - m0x;
      const mh = m1y - m0y;

      ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(m0x, m0y, mw, mh);
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(34, 211, 238, 0.12)';
      ctx.fillRect(m0x, m0y, mw, mh);
    }
  }, [nodes, selectedIndices, activeSingleIdx, view, symmetryMode, marqueeBox, toScreen, getSelectedBoundingBox, clothSimActive, clothConfig]);

  useEffect(() => {
    draw2D();
  }, [draw2D]);

  // Real-Time 2D Cloth Simulation Animation Loop
  useEffect(() => {
    if (!clothSimActive || !isFlutterPlaying) return;
    let animId: number;
    let lastT = performance.now();

    const simLoop = (now: number) => {
      animId = requestAnimationFrame(simLoop);
      const dt = Math.max(0.005, Math.min(0.033, (now - lastT) * 0.001));
      lastT = now;

      clothSimRef.current.step(dt, clothConfig);
      flutterPolygonRef.current = clothSimRef.current.getContourPolygon();
      draw2D();
    };

    animId = requestAnimationFrame(simLoop);
    return () => cancelAnimationFrame(animId);
  }, [clothSimActive, isFlutterPlaying, clothConfig, draw2D]);

  // Check if pointer is on any transform gizmo handle
  const checkGizmoHit = (
    wx: number,
    wy: number
  ): TransformHandleType | null => {
    const bbox = getSelectedBoundingBox();
    if (!bbox || selectedIndices.size <= 1) return null;
    const hitRadius = 14 / view.sc;

    // Rotation handle
    const rotY = bbox.minY - 24 / view.sc;
    if (Math.hypot(wx - bbox.cx, wy - rotY) < hitRadius) return 'rot';

    // 8 Bounding Box Handles
    if (Math.hypot(wx - bbox.minX, wy - bbox.minY) < hitRadius) return 'nw';
    if (Math.hypot(wx - bbox.maxX, wy - bbox.minY) < hitRadius) return 'ne';
    if (Math.hypot(wx - bbox.maxX, wy - bbox.maxY) < hitRadius) return 'se';
    if (Math.hypot(wx - bbox.minX, wy - bbox.maxY) < hitRadius) return 'sw';

    if (Math.hypot(wx - bbox.cx, wy - bbox.minY) < hitRadius) return 'n';
    if (Math.hypot(wx - bbox.cx, wy - bbox.maxY) < hitRadius) return 's';
    if (Math.hypot(wx - bbox.minX, wy - bbox.cy) < hitRadius) return 'w';
    if (Math.hypot(wx - bbox.maxX, wy - bbox.cy) < hitRadius) return 'e';

    // Body translation
    if (wx >= bbox.minX && wx <= bbox.maxX && wy >= bbox.minY && wy <= bbox.maxY) {
      return 'body';
    }

    return null;
  };

  // 2D Mouse Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const [wx, wy] = toWorld(sx, sy, canvas.clientWidth, canvas.clientHeight);

    if (spacePressed || e.button === 1) {
      setDrag({ type: 'pan', sx, sy, cx: view.cx, cy: view.cy });
      return;
    }

    if (e.button !== 0) return;

    // 1. Check Transform Gizmo Hit
    const gizmoHit = checkGizmoHit(wx, wy);
    if (gizmoHit) {
      const bbox = getSelectedBoundingBox();
      setDrag({
        type: 'gizmo',
        sx,
        sy,
        gizmoType: gizmoHit,
        initialNodes: nodes.map((n) => ({ ...n })),
        boxCenter: bbox ? [bbox.cx, bbox.cy] : undefined,
        boxSize: bbox ? [bbox.w, bbox.h] : undefined,
      });
      return;
    }

    // 2. Check Selected Node's Tangent Handles
    if (activeSingleIdx >= 0) {
      const node = nodes[activeSingleIdx];
      const hitRadius = 14 / view.sc;
      if (Math.hypot(wx - (node.x + node.ix), wy - (node.y + node.iy)) < hitRadius) {
        setDrag({ type: 'handle', sx, sy, idx: activeSingleIdx, handle: 'i' });
        return;
      }
      if (Math.hypot(wx - (node.x + node.ox), wy - (node.y + node.oy)) < hitRadius) {
        setDrag({ type: 'handle', sx, sy, idx: activeSingleIdx, handle: 'o' });
        return;
      }
    }

    // 3. Check Anchor Node Hit
    let hitIdx = -1;
    let minDist = 16 / view.sc;
    nodes.forEach((node, idx) => {
      const d = Math.hypot(wx - node.x, wy - node.y);
      if (d < minDist) {
        minDist = d;
        hitIdx = idx;
      }
    });

    if (hitIdx >= 0) {
      if (shiftPressed) {
        // Multi-selection toggle
        const updated = new Set(selectedIndices);
        if (updated.has(hitIdx)) updated.delete(hitIdx);
        else updated.add(hitIdx);
        setSelectedIndices(updated);
        setActiveSingleIdx(hitIdx);
      } else {
        if (!selectedIndices.has(hitIdx)) {
          setSelectedIndices(new Set([hitIdx]));
        }
        setActiveSingleIdx(hitIdx);
        setDrag({ type: 'node', sx, sy, idx: hitIdx });
      }
      return;
    }

    // 4. Clicked Empty Space: Start Marquee Selection Box
    if (!shiftPressed) {
      setSelectedIndices(new Set());
      setActiveSingleIdx(-1);
    }
    setMarqueeBox({ x0: wx, y0: wy, x1: wx, y1: wy });
    setDrag({ type: 'marquee', sx, sy });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const [wx, wy] = toWorld(sx, sy, canvas.clientWidth, canvas.clientHeight);
    setMousePos([Math.round(wx), Math.round(wy)]);

    if (clothSimActive && clothConfig.cursorDraft) {
      clothSimRef.current.feedCursorMotion(wx, wy);
    }

    if (!drag) return;

    if (drag.type === 'pan' && drag.cx !== undefined && drag.cy !== undefined) {
      const dx = (sx - drag.sx) / view.sc;
      const dy = (sy - drag.sy) / view.sc;
      setView((prev) => ({ ...prev, cx: drag.cx! - dx, cy: drag.cy! - dy }));
    } else if (drag.type === 'marquee' && marqueeBox) {
      setMarqueeBox((prev) => (prev ? { ...prev, x1: wx, y1: wy } : null));

      // Calculate enclosed nodes
      const minX = Math.min(marqueeBox.x0, wx);
      const maxX = Math.max(marqueeBox.x0, wx);
      const minY = Math.min(marqueeBox.y0, wy);
      const maxY = Math.max(marqueeBox.y0, wy);

      const enclosed = new Set(shiftPressed ? selectedIndices : []);
      nodes.forEach((n, idx) => {
        if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) {
          enclosed.add(idx);
        }
      });
      setSelectedIndices(enclosed);
    } else if (drag.type === 'node' && drag.idx !== undefined) {
      const idx = drag.idx;
      setNodes((prev) => {
        const updated = prev.map((n) => ({ ...n }));
        const target = updated[idx];
        const isCenter = Math.abs(wx) < 10 && symmetryMode;
        target.x = isCenter ? 0 : wx;
        target.y = wy;

        if (symmetryMode && !isCenter) {
          const symIdx = findSymmetricNodeIdx(idx, updated);
          if (symIdx >= 0 && symIdx !== idx) {
            const sym = updated[symIdx];
            sym.x = -target.x;
            sym.y = target.y;
            sym.ix = -target.ox;
            sym.iy = target.oy;
            sym.ox = -target.ix;
            sym.oy = target.iy;
          }
        }
        return updated;
      });
    } else if (drag.type === 'handle' && drag.idx !== undefined && drag.handle !== undefined) {
      const idx = drag.idx;
      setNodes((prev) => {
        const updated = prev.map((n) => ({ ...n }));
        const target = updated[idx];
        const hx = wx - target.x;
        const hy = wy - target.y;

        if (drag.handle === 'i') {
          target.ix = hx;
          target.iy = hy;
          target.ox = -hx;
          target.oy = -hy;
        } else {
          target.ox = hx;
          target.oy = hy;
          target.ix = -hx;
          target.iy = -hy;
        }

        if (symmetryMode) {
          const symIdx = findSymmetricNodeIdx(idx, updated);
          if (symIdx >= 0 && symIdx !== idx) {
            const sym = updated[symIdx];
            sym.ix = -target.ox;
            sym.iy = target.oy;
            sym.ox = -target.ix;
            sym.oy = target.iy;
          }
        }
        return updated;
      });
    } else if (
      drag.type === 'gizmo' &&
      drag.gizmoType &&
      drag.initialNodes &&
      drag.boxCenter &&
      drag.boxSize
    ) {
      // Execute 8-Handle Transform (Scaling, Rotation, Translation)
      const [bcx, bcy] = drag.boxCenter;
      const [bw, bh] = drag.boxSize;
      const gType = drag.gizmoType;
      const initNodes = drag.initialNodes;

      if (gType === 'body') {
        const dx = wx - toWorld(drag.sx, drag.sy, canvas.clientWidth, canvas.clientHeight)[0];
        const dy = wy - toWorld(drag.sx, drag.sy, canvas.clientWidth, canvas.clientHeight)[1];

        setNodes(() =>
          initNodes.map((n, i) => {
            if (!selectedIndices.has(i)) return { ...n };
            return {
              ...n,
              x: n.x + dx,
              y: n.y + dy,
            };
          })
        );
      } else if (gType === 'rot') {
        // Compute angle delta around center
        const startPt = toWorld(drag.sx, drag.sy, canvas.clientWidth, canvas.clientHeight);
        const a0 = Math.atan2(startPt[1] - bcy, startPt[0] - bcx);
        const a1 = Math.atan2(wy - bcy, wx - bcx);
        const da = a1 - a0;
        const cosA = Math.cos(da);
        const sinA = Math.sin(da);

        setNodes(() =>
          initNodes.map((n, i) => {
            if (!selectedIndices.has(i)) return { ...n };
            const rx = n.x - bcx;
            const ry = n.y - bcy;
            return {
              ...n,
              x: bcx + rx * cosA - ry * sinA,
              y: bcy + rx * sinA + ry * cosA,
              ix: n.ix * cosA - n.iy * sinA,
              iy: n.ix * sinA + n.iy * cosA,
              ox: n.ox * cosA - n.oy * sinA,
              oy: n.ox * sinA + n.oy * cosA,
            };
          })
        );
      } else {
        // Scaling Handles (Corner and Edge)
        const startPt = toWorld(drag.sx, drag.sy, canvas.clientWidth, canvas.clientHeight);
        let scaleX = 1.0;
        let scaleY = 1.0;

        if (gType.includes('e') || gType.includes('w')) {
          const initSpanX = bw / 2 || 1;
          const curSpanX = Math.abs(wx - bcx);
          scaleX = Math.max(0.1, curSpanX / initSpanX);
        }
        if (gType.includes('n') || gType.includes('s')) {
          const initSpanY = bh / 2 || 1;
          const curSpanY = Math.abs(wy - bcy);
          scaleY = Math.max(0.1, curSpanY / initSpanY);
        }

        // Uniform scaling if corner handle
        if (['nw', 'ne', 'se', 'sw'].includes(gType)) {
          const avgScale = (scaleX + scaleY) * 0.5;
          scaleX = avgScale;
          scaleY = avgScale;
        }

        setNodes(() =>
          initNodes.map((n, i) => {
            if (!selectedIndices.has(i)) return { ...n };
            const rx = n.x - bcx;
            const ry = n.y - bcy;
            return {
              ...n,
              x: bcx + rx * scaleX,
              y: bcy + ry * scaleY,
              ix: n.ix * scaleX,
              iy: n.iy * scaleY,
              ox: n.ox * scaleX,
              oy: n.oy * scaleY,
            };
          })
        );
      }
    }
  };

  const handlePointerUp = () => {
    if (drag && (drag.type === 'node' || drag.type === 'handle' || drag.type === 'gizmo')) {
      pushHistory(nodes);
    }
    setMarqueeBox(null);
    setDrag(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.88;
    setView((prev) => ({
      ...prev,
      sc: Math.max(0.2, Math.min(6.0, prev.sc * factor)),
    }));
  };

  // Keyboard shortcut helpers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(true);
      if (e.shiftKey) setShiftPressed(true);
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') handleRedo();
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        handleSelectAll();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') handleDeleteNode();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
      if (!e.shiftKey) setShiftPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  });

  const flatContour = flattenSpline(nodes, true, 36);
  const rawArea = Math.abs(polygonArea(flatContour));
  const areaCm2 = Math.round(rawArea / 100);
  const approxVolumeL = (areaCm2 * 0.45 * 0.001).toFixed(1);

  return (
    <div className="w-full h-full flex flex-col bg-neutral-950 text-neutral-100 select-none overflow-hidden font-sans">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-neutral-900/90 border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-neutral-100">
                2D Contour Sculptor & Vector CAD Suite
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                Transform Gizmo + Live XPBD
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Drag box to multi-select; use the purple 8-handle gizmo to scale and rotate shroud curves.
            </p>
          </div>
        </div>

        {/* Action Controls & Archetype Dropdown */}
        <div className="flex items-center gap-2.5">
          {/* Archetype Library Selector */}
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
                    + Save Current as New Archetype
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(nodes)}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Apply to Stage Ghost</span>
          </button>
        </div>
      </div>

      {/* 2. Secondary Editing Ribbon (Symmetry, Transform Tools, Corner Modes) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2 bg-neutral-900/50 border-b border-neutral-800/80 text-xs shrink-0">
        <div className="flex items-center gap-2">
          {/* Symmetry Toggle */}
          <button
            onClick={() => setSymmetryMode(!symmetryMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
              symmetryMode
                ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                : 'bg-neutral-850 text-neutral-400 border-neutral-700 hover:text-neutral-200'
            }`}
            title="Toggle Bilateral Symmetry across X=0"
          >
            <span>Symmetry:</span>
            <span className="font-bold">{symmetryMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* Smooth Curvature */}
          <button
            onClick={handleSmoothContour}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-neutral-700 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 text-xs transition-colors cursor-pointer"
            title="Relax and smooth spline curvature"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Smooth</span>
          </button>

          {/* Subdivide */}
          <button
            onClick={handleSubdivide}
            disabled={selectedIndices.size === 0 && activeSingleIdx < 0}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs transition-colors cursor-pointer ${
              selectedIndices.size > 0 || activeSingleIdx >= 0
                ? 'border-neutral-700 bg-neutral-850 hover:bg-neutral-800 text-neutral-300'
                : 'border-neutral-800 bg-neutral-900 text-neutral-600 cursor-not-allowed'
            }`}
            title="Subdivide curve segment after selected node"
          >
            <Scissors className="w-3.5 h-3.5 text-cyan-400" />
            <span>Subdivide</span>
          </button>

          {/* Corner Mode Switchers */}
          <div className="flex items-center gap-1 border-l border-neutral-800 pl-2">
            <span className="text-[10px] text-neutral-500 font-mono">Corner:</span>
            <button
              onClick={() => handleSetCornerType('balanced')}
              className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] text-neutral-300 cursor-pointer"
              title="Smooth balanced curve"
            >
              Balanced
            </button>
            <button
              onClick={() => handleSetCornerType('sharp')}
              className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] text-neutral-300 cursor-pointer"
              title="Sharp angular vertex"
            >
              Sharp
            </button>
          </div>

          {/* Delete Node */}
          <button
            onClick={handleDeleteNode}
            disabled={selectedIndices.size === 0 && activeSingleIdx < 0}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs transition-colors cursor-pointer ${
              selectedIndices.size > 0 || activeSingleIdx >= 0
                ? 'border-rose-900/60 bg-rose-950/40 text-rose-300 hover:bg-rose-900/40'
                : 'border-neutral-800 bg-neutral-900 text-neutral-600 cursor-not-allowed'
            }`}
            title="Remove selected anchor node(s)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>

          {/* Undo / Redo */}
          <div className="flex items-center gap-1 border-l border-neutral-800 pl-2">
            <button
              onClick={handleUndo}
              disabled={historyIdx <= 0}
              className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                historyIdx > 0
                  ? 'border-neutral-700 bg-neutral-850 hover:bg-neutral-800 text-neutral-300'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-600 cursor-not-allowed'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIdx >= history.length - 1}
              className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                historyIdx < history.length - 1
                  ? 'border-neutral-700 bg-neutral-850 hover:bg-neutral-800 text-neutral-300'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-600 cursor-not-allowed'
              }`}
              title="Redo (Ctrl+Y)"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Cloth Physics & Hem Flutter Toggle */}
          <div className="flex items-center gap-1.5 border-l border-neutral-800 pl-2">
            <button
              onClick={handleToggleClothSim}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer ${
                clothSimActive
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-[0_0_14px_rgba(52,211,153,0.25)]'
                  : 'bg-neutral-850 text-neutral-400 border-neutral-700 hover:text-neutral-200'
              }`}
              title="Toggle Real-Time Cloth Physics Simulation for Fluttering Hems"
            >
              <Wind className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cloth Flutter:</span>
              <span className="font-bold">{clothSimActive ? 'ACTIVE' : 'OFF'}</span>
            </button>

            {clothSimActive && (
              <>
                <button
                  onClick={() => setIsFlutterPlaying(!isFlutterPlaying)}
                  className="p-1 rounded-md bg-neutral-850 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 cursor-pointer"
                  title={isFlutterPlaying ? 'Pause Simulation' : 'Resume Simulation'}
                >
                  {isFlutterPlaying ? (
                    <Pause className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </button>

                <button
                  onClick={handleBakeFlutter}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-neutral-950 font-bold text-xs shadow-sm transition-all cursor-pointer active:scale-95"
                  title="Freeze and bake current simulated flutter ripples into editable Bezier spline"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Freeze & Bake</span>
                </button>

                <button
                  onClick={handleResetRestPose}
                  className="p-1 rounded-md bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-700 cursor-pointer"
                  title="Reset to rest pose"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* View Fit & Notices */}
        <div className="flex items-center gap-2">
          {bakedSuccessNotice && (
            <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1 bg-emerald-950/80 border border-emerald-700 px-2 py-0.5 rounded animate-pulse">
              <Check className="w-3.5 h-3.5" /> {bakedSuccessNotice}
            </span>
          )}
          {savedSuccessMsg && (
            <span className="text-xs text-purple-300 font-medium flex items-center gap-1 animate-pulse">
              <Check className="w-3.5 h-3.5" /> {savedSuccessMsg}
            </span>
          )}
          <button
            onClick={() => fitView(nodes)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-neutral-700 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 text-xs transition-colors cursor-pointer"
            title="Reset & Center Canvas View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Center View</span>
          </button>
        </div>
      </div>

      {/* 2b. Cloth Physics Parameter Drawer when active */}
      {clothSimActive && (
        <div className="px-6 py-2.5 bg-neutral-900/95 border-b border-neutral-800 text-xs flex flex-wrap items-center justify-between gap-4 animate-in slide-in-from-top-1 duration-150">
          <div className="flex flex-wrap items-center gap-5">
            {/* Wind Speed */}
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 font-mono text-[11px]">Wind Speed:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={clothConfig.windSpeed}
                onChange={(e) =>
                  setClothConfig((prev) => ({ ...prev, windSpeed: parseFloat(e.target.value) }))
                }
                className="w-20 accent-emerald-400 h-1 bg-neutral-700 rounded cursor-pointer"
              />
              <span className="font-mono text-emerald-400 text-[11px] w-9">{clothConfig.windSpeed} km/h</span>
            </div>

            {/* Wind Direction */}
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 font-mono text-[11px]">Direction:</span>
              <input
                type="range"
                min="0"
                max="360"
                value={clothConfig.windAngle}
                onChange={(e) =>
                  setClothConfig((prev) => ({ ...prev, windAngle: parseFloat(e.target.value) }))
                }
                className="w-20 accent-emerald-400 h-1 bg-neutral-700 rounded cursor-pointer"
              />
              <span className="font-mono text-emerald-400 text-[11px] w-8">{Math.round(clothConfig.windAngle)}°</span>
            </div>

            {/* Turbulence */}
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 font-mono text-[11px]">Turbulence:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={clothConfig.turbulence}
                onChange={(e) =>
                  setClothConfig((prev) => ({ ...prev, turbulence: parseFloat(e.target.value) }))
                }
                className="w-20 accent-emerald-400 h-1 bg-neutral-700 rounded cursor-pointer"
              />
              <span className="font-mono text-emerald-400 text-[11px] w-8">{clothConfig.turbulence}%</span>
            </div>

            {/* Upward Draft */}
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 font-mono text-[11px]">Ghost Draft:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={clothConfig.upwardDraft}
                onChange={(e) =>
                  setClothConfig((prev) => ({ ...prev, upwardDraft: parseFloat(e.target.value) }))
                }
                className="w-20 accent-emerald-400 h-1 bg-neutral-700 rounded cursor-pointer"
              />
              <span className="font-mono text-emerald-400 text-[11px] w-8">{clothConfig.upwardDraft}%</span>
            </div>

            {/* Fabric Stiffness */}
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 font-mono text-[11px]">Fabric Drape:</span>
              <input
                type="range"
                min="10"
                max="90"
                value={clothConfig.stiffness}
                onChange={(e) =>
                  setClothConfig((prev) => ({ ...prev, stiffness: parseFloat(e.target.value) }))
                }
                className="w-20 accent-emerald-400 h-1 bg-neutral-700 rounded cursor-pointer"
              />
              <span className="font-mono text-emerald-400 text-[11px] w-8">{clothConfig.stiffness}%</span>
            </div>

            {/* Cursor Aerodynamic Gust Toggle */}
            <button
              onClick={() =>
                setClothConfig((prev) => ({ ...prev, cursorDraft: !prev.cursorDraft }))
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] border font-medium transition-colors cursor-pointer ${
                clothConfig.cursorDraft
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}
              title="Move cursor over 2D canvas to push and billow the hem with directional air currents"
            >
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>Cursor Gust: {clothConfig.cursorDraft ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Split-Screen Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-neutral-800 overflow-hidden">
        {/* Left Pane: 2D Canvas Editor */}
        <div className="relative w-full h-full bg-[#08090c] overflow-hidden">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
            className="w-full h-full block cursor-crosshair"
          />

          {/* Canvas Coordinate and Telemetry HUD */}
          <div className="absolute bottom-4 left-4 flex items-center gap-3 bg-neutral-950/90 backdrop-blur-md px-3.5 py-2 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-400">
            <div>
              <span className="text-neutral-500 mr-1.5">XY:</span>
              <span className="text-cyan-400">
                {mousePos ? `${mousePos[0]}, ${mousePos[1]} mm` : '0, 0'}
              </span>
            </div>
            <div className="border-l border-neutral-800 pl-3">
              <span className="text-neutral-500 mr-1.5">Selected:</span>
              <span className="text-purple-300">{selectedIndices.size} nodes</span>
            </div>
            <div className="border-l border-neutral-800 pl-3">
              <span className="text-neutral-500 mr-1.5">Area:</span>
              <span className="text-cyan-300">{areaCm2} cm²</span>
            </div>
          </div>

          {/* Quick Help Guide */}
          <div className="absolute top-4 right-4 bg-neutral-950/80 backdrop-blur-md px-3 py-1.5 border border-neutral-800 rounded-lg text-[11px] text-neutral-400">
            <span>Drag box to select · Drag purple gizmo handles to scale/rotate · Scroll to zoom</span>
          </div>

          {errorMessage && (
            <div className="absolute top-4 left-4 bg-rose-950/90 border border-rose-700 px-3.5 py-2 rounded-lg text-xs text-rose-200 shadow-xl flex items-center gap-2">
              <span>⚠️ {errorMessage}</span>
            </div>
          )}
        </div>

        {/* Right Pane: Live 3D Mesh & Drape Viewport */}
        <div className="relative w-full h-full bg-neutral-950 overflow-hidden flex flex-col">
          {/* 3D Viewport Controls Bar */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-neutral-800 text-xs">
            <span className="text-neutral-400 font-mono text-[11px] mr-1">3D VIEW:</span>
            <button
              onClick={() => setWireframeMode(!wireframeMode)}
              className={`px-2 py-0.5 rounded text-[11px] border transition-colors cursor-pointer ${
                wireframeMode
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                  : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
              }`}
            >
              Wireframe: {wireframeMode ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() =>
                setClothShading(clothShading === 'solid' ? 'normals' : 'solid')
              }
              className={`px-2 py-0.5 rounded text-[11px] border transition-colors cursor-pointer ${
                clothShading === 'normals'
                  ? 'bg-purple-950 text-purple-300 border-purple-700'
                  : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
              }`}
            >
              Shading: {clothShading === 'solid' ? 'Silk Cloth' : 'Normals'}
            </button>
          </div>

          <div className="absolute top-4 right-4 z-10 bg-neutral-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-neutral-800 text-[11px] font-mono text-neutral-300 flex items-center gap-2">
            <Box className="w-3.5 h-3.5 text-cyan-400" />
            <span>Est. Volume: {approxVolumeL} L</span>
          </div>

          <div ref={previewContainerRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-neutral-950/85 backdrop-blur-md px-4 py-1.5 border border-neutral-800 rounded-lg text-xs text-neutral-400 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Drag in 3D viewport to orbit camera · Scroll to zoom</span>
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
              Saves the current 2D Bezier contour and paired parameters to your local archetype library.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-neutral-300 block mb-1">Archetype Name</label>
                <input
                  type="text"
                  value={newArchetypeName}
                  onChange={(e) => setNewArchetypeName(e.target.value)}
                  placeholder="e.g. Spectral Night Warden"
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-300 block mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={newArchetypeDesc}
                  onChange={(e) => setNewArchetypeDesc(e.target.value)}
                  placeholder="e.g. Flared scalloped hem with sharp cowl"
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
