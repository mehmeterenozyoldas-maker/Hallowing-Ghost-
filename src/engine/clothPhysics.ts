import { BezierNode, ClothPhysicsConfig } from '../types';
import { flattenSpline } from './bezier';

export type { ClothPhysicsConfig };

export const DEFAULT_CLOTH_PHYSICS_CONFIG: ClothPhysicsConfig = {
  enabled: false,
  windSpeed: 45,
  windAngle: 25,
  turbulence: 55,
  upwardDraft: 30,
  stiffness: 45,
  cursorDraft: true,
};

export interface ClothSimParticle {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
  baseX: number;
  baseY: number;
  weight: number; // 0.0 at top head/shoulders, 1.0 at fluttering hem
  pinned: boolean;
  angle: number;
}

export interface ClothSimConstraint {
  p1: number;
  p2: number;
  dist: number;
  stiffness: number;
}

export class ContourClothSimulator {
  public particles: ClothSimParticle[] = [];
  public constraints: ClothSimConstraint[] = [];
  public originalNodes: BezierNode[] = [];
  private time: number = 0;
  private cursorX: number = 0;
  private cursorY: number = 0;
  private cursorVx: number = 0;
  private cursorVy: number = 0;
  private lastCursorTime: number = 0;
  private isInitialized: boolean = false;

  constructor() {
    this.particles = [];
    this.constraints = [];
  }

  public init(nodes: BezierNode[], sampleCount: number = 96): void {
    if (!nodes || nodes.length < 3) return;
    this.originalNodes = nodes.map((n) => ({ ...n }));

    // Dense polygon sampling around the closed contour
    const poly = flattenSpline(nodes, true, Math.max(6, Math.floor(sampleCount / nodes.length)));
    const n = poly.length;
    this.particles = [];
    this.constraints = [];

    let minY = 1e9;
    let maxY = -1e9;
    for (let i = 0; i < n; i++) {
      if (poly[i][1] < minY) minY = poly[i][1];
      if (poly[i][1] > maxY) maxY = poly[i][1];
    }
    const spanY = Math.max(10, maxY - minY);
    const hemThresholdY = minY + spanY * 0.35; // upper 35% is head/neck

    for (let i = 0; i < n; i++) {
      const px = poly[i][0];
      const py = poly[i][1];
      // Normalized vertical height: 0 at head top (minY), 1.0 at hem tail (maxY)
      const normY = Math.max(0, Math.min(1, (py - minY) / spanY));
      
      // Top 30% is firm anchor (weight 0), lower 70% gets quadratic flutter compliance
      const flutterFactor = py < hemThresholdY ? 0 : Math.pow((py - hemThresholdY) / (maxY - hemThresholdY), 1.6);
      const isTopAnchor = normY < 0.18;

      this.particles.push({
        x: px,
        y: py,
        oldX: px,
        oldY: py,
        baseX: px,
        baseY: py,
        weight: flutterFactor,
        pinned: isTopAnchor,
        angle: (i / n) * Math.PI * 2,
      });
    }

    // Distance constraints: adjacent neighbors (perimeter preservation)
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      const d = Math.hypot(
        this.particles[next].x - this.particles[i].x,
        this.particles[next].y - this.particles[i].y
      );
      this.constraints.push({
        p1: i,
        p2: next,
        dist: d,
        stiffness: 0.92,
      });
    }

    // Stride-2 and Stride-3 structural springs to prevent sharp folds
    for (let i = 0; i < n; i++) {
      const next2 = (i + 2) % n;
      const d2 = Math.hypot(
        this.particles[next2].x - this.particles[i].x,
        this.particles[next2].y - this.particles[i].y
      );
      this.constraints.push({
        p1: i,
        p2: next2,
        dist: d2,
        stiffness: 0.45,
      });
    }

    this.isInitialized = true;
  }

  public feedCursorMotion(wx: number, wy: number): void {
    const now = performance.now();
    const dt = Math.max(0.001, (now - this.lastCursorTime) * 0.001);
    this.lastCursorTime = now;

    const vx = (wx - this.cursorX) / dt;
    const vy = (wy - this.cursorY) / dt;
    this.cursorX = wx;
    this.cursorY = wy;
    this.cursorVx = Math.max(-800, Math.min(800, vx));
    this.cursorVy = Math.max(-800, Math.min(800, vy));
  }

  public step(dt: number, config: ClothPhysicsConfig): void {
    if (!this.isInitialized || this.particles.length === 0) return;
    const safeDt = Math.min(0.033, Math.max(0.005, dt));
    this.time += safeDt;

    const windRad = (config.windAngle * Math.PI) / 180;
    const windBaseX = Math.cos(windRad) * (config.windSpeed * 0.85);
    const windBaseY = Math.sin(windRad) * (config.windSpeed * 0.85);

    // Damping factor: higher stiffness => slightly more damped
    const damping = 0.94 - (config.stiffness / 100) * 0.06;
    const t = this.time;

    // 1. Verlet Integration with Environmental & Cursor Forces
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.pinned) {
        p.x = p.baseX;
        p.y = p.baseY;
        p.oldX = p.baseX;
        p.oldY = p.baseY;
        continue;
      }

      const vx = (p.x - p.oldX) * damping;
      const vy = (p.y - p.oldY) * damping;

      // Multi-frequency wind turbulence ripples
      const wavePhase = t * 6.5 + p.angle * 4.0;
      const ripple1 = Math.sin(wavePhase);
      const ripple2 = Math.cos(t * 9.2 + p.x * 0.03);
      const ripple3 = Math.sin(t * 3.8 + p.y * 0.04);
      const turbForce = (ripple1 * 0.6 + ripple2 * 0.3 + ripple3 * 0.25) * (config.turbulence * 0.8);

      // Ghostly upward draft (negative Y in screen coords lifts the bottom hem)
      const draftForce = -config.upwardDraft * 0.65;

      // Aerodynamic hem fluttering
      const flutterX = (windBaseX + turbForce * Math.cos(windRad + Math.PI / 2)) * p.weight;
      const flutterY = (windBaseY + draftForce + turbForce * Math.sin(windRad + Math.PI / 2)) * p.weight;

      // Elastic pull back to rest pose (governed by fabric drape / stiffness)
      const returnStiffness = 0.08 + (config.stiffness / 100) * 0.42;
      const pullX = (p.baseX - p.x) * returnStiffness * (1 - p.weight * 0.65);
      const pullY = (p.baseY - p.y) * returnStiffness * (1 - p.weight * 0.65);

      // Cursor draft impulse
      let cursorImpulseX = 0;
      let cursorImpulseY = 0;
      if (config.cursorDraft && (Math.abs(this.cursorVx) > 5 || Math.abs(this.cursorVy) > 5)) {
        const dx = p.x - this.cursorX;
        const dy = p.y - this.cursorY;
        const distSq = dx * dx + dy * dy;
        const radius = 140;
        if (distSq < radius * radius && distSq > 1) {
          const dist = Math.sqrt(distSq);
          const falloff = Math.pow(1 - dist / radius, 1.8) * p.weight;
          cursorImpulseX = this.cursorVx * falloff * 0.045;
          cursorImpulseY = this.cursorVy * falloff * 0.045;
        }
      }

      // Total acceleration
      const ax = flutterX + pullX + cursorImpulseX;
      const ay = flutterY + pullY + cursorImpulseY;

      p.oldX = p.x;
      p.oldY = p.y;
      p.x += vx + ax * (safeDt * safeDt * 60);
      p.y += vy + ay * (safeDt * safeDt * 60);
    }

    // Decay cursor velocity
    this.cursorVx *= 0.88;
    this.cursorVy *= 0.88;

    // 2. Constraint Relaxation (4 iterations for crisp cloth rigidity without rubbery ballooning)
    const iterations = 4;
    for (let iter = 0; iter < iterations; iter++) {
      for (let c = 0; c < this.constraints.length; c++) {
        const con = this.constraints[c];
        const p1 = this.particles[con.p1];
        const p2 = this.particles[con.p2];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const currentDist = Math.hypot(dx, dy);
        if (currentDist < 1e-4) continue;

        const diff = (currentDist - con.dist) / currentDist;
        const correction = diff * con.stiffness * 0.5;

        const w1 = p1.pinned ? 0 : p1.weight * 0.8 + 0.2;
        const w2 = p2.pinned ? 0 : p2.weight * 0.8 + 0.2;
        const sumW = w1 + w2;
        if (sumW < 1e-4) continue;

        const factor1 = (w1 / sumW) * correction;
        const factor2 = (w2 / sumW) * correction;

        if (!p1.pinned) {
          p1.x += dx * factor1;
          p1.y += dy * factor1;
        }
        if (!p2.pinned) {
          p2.x -= dx * factor2;
          p2.y -= dy * factor2;
        }
      }
    }
  }

  public resetToRest(): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x = p.baseX;
      p.y = p.baseY;
      p.oldX = p.baseX;
      p.oldY = p.baseY;
    }
  }

  public getContourPolygon(): [number, number][] {
    return this.particles.map((p) => [p.x, p.y]);
  }

  /**
   * Freezes and bakes current simulated flutter wave into smooth Bezier nodes
   */
  public bakeToNodes(): BezierNode[] {
    if (this.particles.length === 0 || this.originalNodes.length === 0) {
      return this.originalNodes;
    }

    const nOrig = this.originalNodes.length;
    const nParts = this.particles.length;
    const bakedNodes: BezierNode[] = [];

    // Map each original anchor node to its nearest index in the simulated particle loop
    for (let i = 0; i < nOrig; i++) {
      const orig = this.originalNodes[i];
      // Estimate fractional position along perimeter
      const sampleIdx = Math.round((i / nOrig) * nParts) % nParts;
      const currPart = this.particles[sampleIdx];

      // Shift position based on flutter displacement
      const dispX = currPart.x - currPart.baseX;
      const dispY = currPart.y - currPart.baseY;

      // New anchor position
      const newX = orig.x + dispX;
      const newY = orig.y + dispY;

      // Preserve tangent vectors while rotating slightly with displacement gradient
      bakedNodes.push({
        x: newX,
        y: newY,
        ix: orig.ix,
        iy: orig.iy,
        ox: orig.ox,
        oy: orig.oy,
      });
    }

    // Refine tangents to ensure seamless C1 continuity across the newly baked hem
    for (let i = 0; i < nOrig; i++) {
      const prev = bakedNodes[(i - 1 + nOrig) % nOrig];
      const curr = bakedNodes[i];
      const next = bakedNodes[(i + 1) % nOrig];

      // Catmull-Rom tangent estimate for smooth flutter curves
      const dx = (next.x - prev.x) * 0.22;
      const dy = (next.y - prev.y) * 0.22;

      // Only adjust bottom hem nodes, keep head top structure clean
      const origNode = this.originalNodes[i];
      if (Math.abs(origNode.x) < 5 && origNode.y < 0) {
        // Keep head top centered
        curr.x = 0;
      } else {
        curr.ix = -dx;
        curr.iy = -dy;
        curr.ox = dx;
        curr.oy = dy;
      }
    }

    return bakedNodes;
  }
}
