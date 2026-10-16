import Delaunator from 'delaunator';
import { BezierNode } from '../types';
import {
  distanceToPolygon,
  flattenSpline,
  pointInPolygon,
  polygonArea,
  polygonSelfIntersects,
  resamplePolygon,
} from './bezier';

export interface ClothMeshResult {
  N: number;
  nb: number;
  ni: number;
  s: number;
  area: number;
  pos0: Float32Array;
  index: Uint32Array;
  uv: Float32Array;
  eA: Int32Array;
  eB: Int32Array;
  eL: Float32Array;
  bA: Int32Array;
  bB: Int32Array;
  bL: Float32Array;
  outline: [number, number][];
  err?: string;
}

export function buildClothMesh(nodes: BezierNode[], targetResolution: number): ClothMeshResult {
  if (nodes.length < 3) {
    return { err: 'The ghost contour requires at least 3 anchor points.' } as ClothMeshResult;
  }

  let poly = flattenSpline(nodes, true, 48);
  const areaSigned = polygonArea(poly);
  if (Math.abs(areaSigned) < 400) {
    return { err: 'Contour area is too small for cloth simulation.' } as ClothMeshResult;
  }

  const coarsePoly = resamplePolygon(poly, Math.sqrt(Math.abs(areaSigned)) / 50);
  if (polygonSelfIntersects(coarsePoly)) {
    return { err: 'The contour intersects itself. Please adjust anchor points.' } as ClothMeshResult;
  }

  // Center around centroid
  let cx = 0;
  let cy = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const c = a[0] * b[1] - b[0] * a[1];
    cx += (a[0] + b[0]) * c;
    cy += (a[1] + b[1]) * c;
  }
  cx /= 6 * areaSigned;
  cy /= 6 * areaSigned;
  poly = poly.map((p) => [p[0] - cx, p[1] - cy]);

  const totalArea = Math.abs(areaSigned);
  const s = Math.sqrt(totalArea / (targetResolution * 0.866));
  const boundaryPoints = resamplePolygon(poly, s);
  const interiorPoints: [number, number][] = [];

  let minX = 1e9;
  let minY = 1e9;
  let maxX = -1e9;
  let maxY = -1e9;
  for (const p of boundaryPoints) {
    minX = Math.min(minX, p[0]);
    minY = Math.min(minY, p[1]);
    maxX = Math.max(maxX, p[0]);
    maxY = Math.max(maxY, p[1]);
  }

  // Hexagonal close packing for regular isotropic cloth distribution
  const dy = s * 0.866;
  let row = 0;
  for (let y = minY + dy * 0.5; y < maxY; y += dy, row++) {
    const xOffset = row % 2 ? s * 0.5 : 0;
    for (let x = minX + xOffset; x < maxX; x += s) {
      if (pointInPolygon(x, y, boundaryPoints) && distanceToPolygon(x, y, boundaryPoints) > 0.55 * s) {
        interiorPoints.push([x, y]);
      }
    }
  }

  const nb = boundaryPoints.length;
  const ni = interiorPoints.length;
  const allPoints = boundaryPoints.concat(interiorPoints);
  const coords = new Float64Array(allPoints.length * 2);
  allPoints.forEach((p, i) => {
    coords[2 * i] = p[0];
    coords[2 * i + 1] = p[1];
  });

  const del = new Delaunator(coords);
  const triIndices = del.triangles;
  const validTris: [number, number, number][] = [];

  for (let t = 0; t < triIndices.length; t += 3) {
    const a = triIndices[t];
    const b = triIndices[t + 1];
    const c = triIndices[t + 2];
    const pa = allPoints[a];
    const pb = allPoints[b];
    const pc = allPoints[c];

    const centroidX = (pa[0] + pb[0] + pc[0]) / 3;
    const centroidY = (pa[1] + pb[1] + pc[1]) / 3;
    if (!pointInPolygon(centroidX, centroidY, boundaryPoints)) continue;

    const maxEdge = Math.max(
      Math.hypot(pa[0] - pb[0], pa[1] - pb[1]),
      Math.hypot(pb[0] - pc[0], pb[1] - pc[1]),
      Math.hypot(pc[0] - pa[0], pc[1] - pa[1])
    );
    if (maxEdge > 2.5 * s) continue;

    const cross = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
    validTris.push(cross > 0 ? [a, c, b] : [a, b, c]);
  }

  // Total particles: boundary shared + top interior + bottom interior
  const N = nb + 2 * ni;
  const getBottomIndex = (k: number) => (k < nb ? k : k + ni);

  const pos0 = new Float32Array(N * 3);
  const Y0 = 6;
  const LIFT = 1.2;

  for (let k = 0; k < nb + ni; k++) {
    const p = allPoints[k];
    pos0[3 * k] = p[0];
    pos0[3 * k + 1] = Y0 + (k < nb ? 0 : LIFT);
    pos0[3 * k + 2] = p[1];

    if (k >= nb) {
      const j = getBottomIndex(k);
      pos0[3 * j] = p[0];
      pos0[3 * j + 1] = Y0 - LIFT;
      pos0[3 * j + 2] = p[1];
    }
  }

  const uv = new Float32Array(N * 2);
  for (let k = 0; k < nb + ni; k++) {
    uv[2 * k] = allPoints[k][0];
    uv[2 * k + 1] = allPoints[k][1];
    if (k >= nb) {
      const j = getBottomIndex(k);
      uv[2 * j] = allPoints[k][0];
      uv[2 * j + 1] = allPoints[k][1];
    }
  }

  const index = new Uint32Array(validTris.length * 6);
  validTris.forEach((t, i) => {
    // Top layer
    index[6 * i] = t[0];
    index[6 * i + 1] = t[1];
    index[6 * i + 2] = t[2];
    // Bottom layer (reversed winding for correct normals)
    index[6 * i + 3] = getBottomIndex(t[0]);
    index[6 * i + 4] = getBottomIndex(t[2]);
    index[6 * i + 5] = getBottomIndex(t[1]);
  });

  // Extract edges and opposing vertices for stretch and bending compliance
  const flatPoint = (k: number) => allPoints[k < nb + ni ? k : k - ni];
  const edgeMap = new Map<number, number>();
  const eA: number[] = [];
  const eB: number[] = [];
  const bA: number[] = [];
  const bB: number[] = [];

  const edgeKey = (i: number, j: number) => (i < j ? i * N + j : j * N + i);

  for (const layer of [0, 1]) {
    const oppMap = new Map<number, number>();
    for (const t0 of validTris) {
      const t = layer ? [getBottomIndex(t0[0]), getBottomIndex(t0[1]), getBottomIndex(t0[2])] : t0;
      for (let e = 0; e < 3; e++) {
        const i = t[e];
        const j = t[(e + 1) % 3];
        const o = t[(e + 2) % 3];
        const k = edgeKey(i, j);

        if (!edgeMap.has(k)) {
          edgeMap.set(k, 1);
          eA.push(i);
          eB.push(j);
        }

        if (oppMap.has(k)) {
          bA.push(oppMap.get(k)!);
          bB.push(o);
        } else {
          oppMap.set(k, o);
        }
      }
    }
  }

  const computeRestLengths = (srcA: number[], srcB: number[]) => {
    const rl = new Float32Array(srcA.length);
    for (let e = 0; e < srcA.length; e++) {
      const p = flatPoint(srcA[e]);
      const q = flatPoint(srcB[e]);
      rl[e] = Math.hypot(p[0] - q[0], p[1] - q[1]);
    }
    return rl;
  };

  return {
    N,
    nb,
    ni,
    s,
    area: totalArea,
    pos0,
    index,
    uv,
    eA: Int32Array.from(eA),
    eB: Int32Array.from(eB),
    eL: computeRestLengths(eA, eB),
    bA: Int32Array.from(bA),
    bB: Int32Array.from(bB),
    bL: computeRestLengths(bA, bB),
    outline: boundaryPoints,
  };
}
