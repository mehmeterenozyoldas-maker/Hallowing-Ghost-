import { ClothMeshResult } from './meshBuilder';
import { ClothParams } from '../types';

export interface GrabInteraction {
  indices: Int32Array;
  offsets: Float32Array;
  weights: Float32Array;
  targetX: number;
  targetY: number;
  targetZ: number;
}

export interface DisplayBuffer {
  N: number;
  st: Int32Array;
  adj: Int32Array;
  index: Uint32Array;
  pos: Float32Array;
  tmp: Float32Array;
  nrm: Float32Array;
  nt: Float32Array;
  act: Float32Array;
  at: Float32Array;
  ref: Float32Array;
}

export class XPBDSimulation {
  public mesh: ClothMeshResult;
  public x: Float32Array;
  public prevX: Float32Array;
  public v: Float32Array;
  public forces: Float32Array;
  public act: Float32Array;
  public invMass: Float32Array;
  public invMass0: number;
  public time = 0;
  public volume = 0;
  public height = 0;
  public grab: GrabInteraction | null = null;

  constructor(mesh: ClothMeshResult) {
    this.mesh = mesh;
    const N = mesh.N;
    this.x = new Float32Array(mesh.pos0);
    this.prevX = new Float32Array(N * 3);
    this.v = new Float32Array(N * 3);
    this.forces = new Float32Array(N * 3);
    this.act = new Float32Array(N);

    // Particle mass proportional to hex area (density = 1)
    this.invMass0 = 1 / (0.866 * mesh.s * mesh.s);
    this.invMass = new Float32Array(N).fill(this.invMass0);
  }

  public reset(): void {
    this.x.set(this.mesh.pos0);
    this.prevX.fill(0);
    this.v.fill(0);
    this.act.fill(0);
    this.invMass.fill(this.invMass0);
    this.time = 0;
    this.grab = null;
    this.volume = 0;
    this.height = 0;
  }

  private solveConstraints(
    indicesA: Int32Array,
    indicesB: Int32Array,
    restLengths: Float32Array,
    complianceOverH2: number
  ): void {
    const x = this.x;
    const w = this.invMass;
    const count = indicesA.length;

    for (let e = 0; e < count; e++) {
      const idxA = 3 * indicesA[e];
      const idxB = 3 * indicesB[e];
      const wi = w[indicesA[e]];
      const wj = w[indicesB[e]];
      const wSum = wi + wj;
      if (wSum === 0) continue;

      const dx = x[idxB] - x[idxA];
      const dy = x[idxB + 1] - x[idxA + 1];
      const dz = x[idxB + 2] - x[idxA + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 1e-9) continue;

      const delta = -(dist - restLengths[e]) / (wSum + complianceOverH2) / dist;

      x[idxA] -= wi * delta * dx;
      x[idxA + 1] -= wi * delta * dy;
      x[idxA + 2] -= wi * delta * dz;

      x[idxB] += wj * delta * dx;
      x[idxB + 1] += wj * delta * dy;
      x[idxB + 2] += wj * delta * dz;
    }
  }

  /**
   * Faithful numerical simulation step matching original reference code:
   * Pressure inflation outward from surface triangle normals,
   * natural gravity pulling downward, and soft ground contact at y = 0.
   */
  public step(dt: number, params: ClothParams): void {
    const sub = 8;
    const h = dt / sub;
    const h2 = h * h;
    const N = this.mesh.N;
    const x = this.x;
    const p = this.prevX;
    const v = this.v;
    const F = this.forces;
    const w = this.invMass;
    const index = this.mesh.index;
    const nTris = index.length / 3;

    // Gradual pressure ramp-up upon reinflation
    const ramp = Math.min(1, this.time / 1.2);
    const P = params.pressure * ramp;

    // Volumetric inflation forces from surface triangles
    F.fill(0);
    let vol = 0;

    for (let t = 0; t < nTris; t++) {
      const a = 3 * index[3 * t];
      const b = 3 * index[3 * t + 1];
      const d = 3 * index[3 * t + 2];

      const ux = x[b] - x[a];
      const uy = x[b + 1] - x[a + 1];
      const uz = x[b + 2] - x[a + 2];

      const vx_ = x[d] - x[a];
      const vy = x[d + 1] - x[a + 1];
      const vz = x[d + 2] - x[a + 2];

      const nx = uy * vz - uz * vy;
      const ny = uz * vx_ - ux * vz;
      const nz = ux * vy - uy * vx_;

      const k = P / 6;
      F[a] += k * nx;
      F[a + 1] += k * ny;
      F[a + 2] += k * nz;

      F[b] += k * nx;
      F[b + 1] += k * ny;
      F[b + 2] += k * nz;

      F[d] += k * nx;
      F[d + 1] += k * ny;
      F[d + 2] += k * nz;

      vol +=
        (x[a] * (x[b + 1] * x[d + 2] - x[b + 2] * x[d + 1]) -
          x[a + 1] * (x[b] * x[d + 2] - x[b + 2] * x[d]) +
          x[a + 2] * (x[b] * x[d + 1] - x[b + 1] * x[d])) /
        6;
    }
    this.volume = vol;

    const g = this.grab;
    const aS = params.stretch / h2;
    const aB = params.bend / h2;
    const mu = 0.55; // ground friction

    for (let s = 0; s < sub; s++) {
      for (let i = 0; i < N; i++) {
        const k = 3 * i;
        const wi = w[i];
        if (wi > 0) {
          v[k] += h * F[k] * wi;
          v[k + 1] += h * (F[k + 1] * wi - params.gravity);
          v[k + 2] += h * F[k + 2] * wi;
        }

        p[k] = x[k];
        p[k + 1] = x[k + 1];
        p[k + 2] = x[k + 2];

        x[k] += h * v[k];
        x[k + 1] += h * v[k + 1];
        x[k + 2] += h * v[k + 2];
      }

      // Solve stretch and bending constraints
      this.solveConstraints(this.mesh.eA, this.mesh.eB, this.mesh.eL, aS);
      this.solveConstraints(this.mesh.bA, this.mesh.bB, this.mesh.bL, aB);

      // Interactive user grabbing constraint
      if (g) {
        for (let m = 0; m < g.indices.length; m++) {
          const k = 3 * g.indices[m];
          const q = g.weights[m];
          x[k] += (g.targetX + g.offsets[3 * m] - x[k]) * q;
          x[k + 1] += (g.targetY + g.offsets[3 * m + 1] - x[k + 1]) * q;
          x[k + 2] += (g.targetZ + g.offsets[3 * m + 2] - x[k + 2]) * q;
        }
      }

      // Floor plane collision with friction at y = 0
      for (let i = 0; i < N; i++) {
        const k = 3 * i;
        if (x[k + 1] < 0) {
          x[k + 1] = 0;
          x[k] -= (x[k] - p[k]) * mu;
          x[k + 2] -= (x[k + 2] - p[k + 2]) * mu;
        }

        v[k] = (x[k] - p[k]) / h;
        v[k + 1] = (x[k + 1] - p[k + 1]) / h;
        v[k + 2] = (x[k + 2] - p[k + 2]) / h;
      }
    }

    // Velocity dampening
    const damp = Math.exp(-1.2 * dt);
    let maxHeight = 0;
    let corrupted = false;

    for (let i = 0; i < N; i++) {
      const k = 3 * i;
      v[k] *= damp;
      v[k + 1] *= damp;
      v[k + 2] *= damp;

      const speed = Math.sqrt(v[k] * v[k] + v[k + 1] * v[k + 1] + v[k + 2] * v[k + 2]);
      this.act[i] = Math.max(this.act[i] * 0.94, Math.min(1, speed / 220));

      if (x[k + 1] > maxHeight) maxHeight = x[k + 1];
      if (!(Math.abs(x[k]) < 1e5 && Math.abs(x[k + 1]) < 1e5 && Math.abs(x[k + 2]) < 1e5)) {
        corrupted = true;
      }
    }

    if (g) {
      for (let m = 0; m < g.indices.length; m++) {
        this.act[g.indices[m]] = Math.max(this.act[g.indices[m]], g.weights[m]);
      }
    }

    this.height = maxHeight;
    this.time += dt;

    if (corrupted) {
      this.reset();
    }
  }

  public startGrab(px: number, py: number, pz: number, radius: number): boolean {
    const indices: number[] = [];
    const offsets: number[] = [];
    const weights: number[] = [];
    const x = this.x;
    const N = this.mesh.N;

    for (let i = 0; i < N; i++) {
      const k = 3 * i;
      const dx = x[k] - px;
      const dy = x[k + 1] - py;
      const dz = x[k + 2] - pz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < radius) {
        indices.push(i);
        offsets.push(dx, dy, dz);
        const q = 1 - d / radius;
        weights.push(Math.min(1, q * q * 1.4));
      }
    }

    if (indices.length === 0) return false;

    this.grab = {
      indices: Int32Array.from(indices),
      offsets: Float32Array.from(offsets),
      weights: Float32Array.from(weights),
      targetX: px,
      targetY: py,
      targetZ: pz,
    };

    for (let m = 0; m < indices.length; m++) {
      if (weights[m] > 0.95) this.invMass[indices[m]] = 0;
    }

    return true;
  }

  public moveGrab(tx: number, ty: number, tz: number): void {
    if (this.grab) {
      this.grab.targetX = tx;
      this.grab.targetY = Math.max(0, ty);
      this.grab.targetZ = tz;
    }
  }

  public endGrab(): void {
    if (this.grab) {
      for (const idx of this.grab.indices) {
        this.invMass[idx] = this.invMass0;
      }
      this.grab = null;
    }
  }
}

export function createDisplayBuffer(mesh: ClothMeshResult): DisplayBuffer {
  const N = mesh.N;
  const deg = new Int32Array(N + 1);
  for (let e = 0; e < mesh.eA.length; e++) {
    deg[mesh.eA[e] + 1]++;
    deg[mesh.eB[e] + 1]++;
  }
  for (let i = 0; i < N; i++) deg[i + 1] += deg[i];

  const adj = new Int32Array(deg[N]);
  const fill = deg.slice(0, N);
  for (let e = 0; e < mesh.eA.length; e++) {
    adj[fill[mesh.eA[e]]++] = mesh.eB[e];
    adj[fill[mesh.eB[e]]++] = mesh.eA[e];
  }

  return {
    N,
    st: deg,
    adj,
    index: mesh.index,
    pos: new Float32Array(N * 3),
    tmp: new Float32Array(N * 3),
    nrm: new Float32Array(N * 3),
    nt: new Float32Array(N * 3),
    act: new Float32Array(N),
    at: new Float32Array(N),
    ref: new Float32Array(N * 3),
  };
}

function laplacianPass(d: DisplayBuffer, src: Float32Array, dst: Float32Array, factor: number): void {
  const { N, st, adj } = d;
  for (let i = 0; i < N; i++) {
    let ax = 0;
    let ay = 0;
    let az = 0;
    const a = st[i];
    const b = st[i + 1];
    const n = b - a;
    const k = 3 * i;
    for (let m = a; m < b; m++) {
      const j = 3 * adj[m];
      ax += src[j];
      ay += src[j + 1];
      az += src[j + 2];
    }
    dst[k] = src[k] + factor * (ax / n - src[k]);
    dst[k + 1] = src[k + 1] + factor * (ay / n - src[k + 1]);
    dst[k + 2] = src[k + 2] + factor * (az / n - src[k + 2]);
  }
}

export function updateDisplayBuffer(d: DisplayBuffer, simX: Float32Array, smoothingIters: number): void {
  const { N, st, adj, index, pos, tmp, nrm, nt } = d;
  pos.set(simX);

  // Taubin non-shrinking dual smoothing passes
  for (let k = 0; k < smoothingIters; k++) {
    laplacianPass(d, pos, tmp, 0.5);
    laplacianPass(d, tmp, pos, -0.53);
  }

  for (let i = 1; i < pos.length; i += 3) {
    if (pos[i] < 0) pos[i] = 0;
  }

  // Calculate face normals and accumulate on vertices
  nt.fill(0);
  for (let t = 0; t < index.length; t += 3) {
    const a = 3 * index[t];
    const b = 3 * index[t + 1];
    const c = 3 * index[t + 2];

    const ux = pos[b] - pos[a];
    const uy = pos[b + 1] - pos[a + 1];
    const uz = pos[b + 2] - pos[a + 2];

    const vx = pos[c] - pos[a];
    const vy = pos[c + 1] - pos[a + 1];
    const vz = pos[c + 2] - pos[a + 2];

    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;

    nt[a] += nx;
    nt[a + 1] += ny;
    nt[a + 2] += nz;
    nt[b] += nx;
    nt[b + 1] += ny;
    nt[b + 2] += nz;
    nt[c] += nx;
    nt[c + 1] += ny;
    nt[c + 2] += nz;
  }

  for (let i = 0; i < N; i++) {
    const k = 3 * i;
    const len = Math.sqrt(nt[k] * nt[k] + nt[k + 1] * nt[k + 1] + nt[k + 2] * nt[k + 2]) || 1;
    nt[k] /= len;
    nt[k + 1] /= len;
    nt[k + 2] /= len;
  }

  // Smooth normals across 1-ring neighbors if smoothing enabled
  if (smoothingIters > 0) {
    for (let i = 0; i < N; i++) {
      const k = 3 * i;
      let ax = nt[k] * 2;
      let ay = nt[k + 1] * 2;
      let az = nt[k + 2] * 2;
      for (let m = st[i]; m < st[i + 1]; m++) {
        const j = 3 * adj[m];
        ax += nt[j];
        ay += nt[j + 1];
        az += nt[j + 2];
      }
      const len = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
      nrm[k] = ax / len;
      nrm[k + 1] = ay / len;
      nrm[k + 2] = az / len;
    }
  } else {
    nrm.set(nt);
  }
}

export function smoothActivity(d: DisplayBuffer, src: Float32Array): void {
  const { N, st, adj, act, at } = d;
  for (let i = 0; i < N; i++) {
    let v = src[i] * 2;
    for (let m = st[i]; m < st[i + 1]; m++) v += src[adj[m]];
    at[i] = v / (st[i + 1] - st[i] + 2);
  }
  act.set(at);
}
