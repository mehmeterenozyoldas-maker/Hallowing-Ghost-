import { BezierNode } from '../types';

export function createNode(x: number, y: number, ix = 0, iy = 0, ox = 0, oy = 0): BezierNode {
  return { x, y, ix, iy, ox, oy };
}

export function evalBezier(a: BezierNode, b: BezierNode, t: number): [number, number] {
  const u = 1 - t;
  const c0x = a.x + a.ox;
  const c0y = a.y + a.oy;
  const c1x = b.x + b.ix;
  const c1y = b.y + b.iy;
  return [
    u * u * u * a.x + 3 * u * u * t * c0x + 3 * u * t * t * c1x + t * t * t * b.x,
    u * u * u * a.y + 3 * u * u * t * c0y + 3 * u * t * t * c1y + t * t * t * b.y,
  ];
}

export function flattenSpline(nodes: BezierNode[], closed: boolean, steps = 36): [number, number][] {
  const out: [number, number][] = [];
  const count = nodes.length;
  const segs = closed ? count : count - 1;
  for (let i = 0; i < segs; i++) {
    const a = nodes[i];
    const b = nodes[(i + 1) % count];
    for (let k = 0; k < steps; k++) {
      out.push(evalBezier(a, b, k / steps));
    }
  }
  if (!closed && count > 0) {
    out.push([nodes[count - 1].x, nodes[count - 1].y]);
  }
  return out;
}

export function polygonArea(poly: [number, number][]): number {
  let s = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

export function pointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}

function distToSegment(px: number, py: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t = ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
}

export function distanceToPolygon(x: number, y: number, poly: [number, number][]): number {
  let minD = 1e9;
  for (let i = 0, n = poly.length; i < n; i++) {
    const d = distToSegment(x, y, poly[i], poly[(i + 1) % n]);
    if (d < minD) minD = d;
  }
  return minD;
}

function segCross(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): boolean {
  const orient = (p: [number, number], q: [number, number], r: [number, number]) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return orient(a, b, c) > 0 !== orient(a, b, d) > 0 && orient(c, d, a) > 0 !== orient(c, d, b) > 0;
}

export function polygonSelfIntersects(poly: [number, number][]): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segCross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return true;
    }
  }
  return false;
}

export function resamplePolygon(poly: [number, number][], step: number): [number, number][] {
  const n = poly.length;
  const lengths = [0];
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    lengths.push(lengths[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = lengths[n];
  const count = Math.max(16, Math.round(total / step));
  const out: [number, number][] = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const targetD = (k * total) / count;
    while (lengths[j + 1] < targetD) j++;
    const t = (targetD - lengths[j]) / (lengths[j + 1] - lengths[j] || 1);
    const a = poly[j];
    const b = poly[(j + 1) % n];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

const K = 0.55228475; // Standard circular cubic bezier handle ratio

export const SHROUD_PRESETS: Record<string, () => BezierNode[]> = {
  // Iconic rounded ghost apparition with undulating scalloped skirt
  ethereal_wraith: () => {
    return [
      // Rounded dome head top
      createNode(0, -170, -75, 0, 75, 0),
      // Right ghost head cheek
      createNode(135, -90, -10, -50, 10, 50),
      // Right ghost arm / mantle sweep
      createNode(155, 30, -20, -40, 20, 50),
      // Right wavy skirt tail 1
      createNode(120, 150, 20, -30, -25, 15),
      // Right skirt fold notch
      createNode(60, 120, 20, 10, -20, -10),
      // Center skirt tail 2
      createNode(0, 160, 25, 0, -25, 0),
      // Left skirt fold notch
      createNode(-60, 120, 20, -10, -20, 10),
      // Left wavy skirt tail 3
      createNode(-120, 150, 25, 15, -20, -30),
      // Left ghost arm / mantle sweep
      createNode(-155, 30, -20, 50, 20, -40),
      // Left ghost head cheek
      createNode(-135, -90, -10, 50, 10, -50),
    ];
  },

  // Gothic town hall pointed arch specter with cathedral architectural lines
  gothic_arch: () => {
    return [
      // Pointed arch pinnacle
      createNode(0, -250, -15, 20, 15, 20),
      // Right arch curvature
      createNode(120, -110, -40, -60, 30, 50),
      // Right wing flare
      createNode(185, 70, -20, -40, 10, 60),
      // Right lower hemline
      createNode(110, 230, 30, -30, -30, 10),
      // Gothic center notch
      createNode(0, 170, 30, 0, -30, 0),
      // Left lower hemline
      createNode(-110, 230, 30, 10, -30, -30),
      // Left wing flare
      createNode(-185, 70, -10, 60, 20, -40),
      // Left arch curvature
      createNode(-120, -110, -30, 50, 40, -60),
    ];
  },

  // Flowing Phantom cloak billowing dynamically sideways
  flowing_cloak: () => {
    return [
      createNode(-20, -210, -40, 0, 50, 0),
      createNode(90, -130, -30, -40, 40, 30),
      createNode(190, -10, -30, -50, 40, 70),
      createNode(220, 190, -10, -60, -50, 20),
      createNode(60, 170, 40, 10, -40, 0),
      createNode(-80, 220, 30, 0, -50, -30),
      createNode(-170, 70, 10, 70, -10, -60),
      createNode(-120, -110, -40, 40, 30, -40),
    ];
  },

  // Deep hollow cowl veil with large center void opening
  hollow_veil: () => {
    const rx = 150;
    const ry = 190;
    const kx = K * rx;
    const ky = K * ry;
    return [
      createNode(0, -ry, -kx, 0, kx, 0),
      createNode(rx, 0, 0, -ky, 0, ky),
      createNode(0, ry, kx, 0, -kx, 0),
      createNode(-rx, 0, 0, ky, 0, -ky),
    ];
  },

  // Victorian sheet ghost with flowing scalloped hemline
  classic_sheet: () => {
    return [
      createNode(0, -180, -60, 0, 60, 0),
      createNode(110, -110, -15, -40, 15, 40),
      createNode(140, 10, -20, -40, 20, 50),
      createNode(120, 160, 20, -30, -20, 10),
      createNode(50, 140, 20, 10, -20, -10),
      createNode(0, 170, 20, 0, -20, 0),
      createNode(-50, 140, 20, -10, -20, 10),
      createNode(-120, 160, 20, 10, -20, -30),
      createNode(-140, 10, -20, 50, 20, -40),
      createNode(-110, -110, -15, 40, 15, -40),
    ];
  },

  // Elongated screaming banshee veil with sharp cowl
  banshee_veil: () => {
    return [
      createNode(0, -230, -30, 0, 30, 0),
      createNode(70, -130, -20, -50, 30, 50),
      createNode(170, -10, -30, -40, 30, 60),
      createNode(160, 140, 20, -50, -30, 20),
      createNode(70, 230, 30, -30, -30, 10),
      createNode(0, 170, 30, 0, -30, 0),
      createNode(-70, 230, 30, 10, -30, -30),
      createNode(-160, 140, 30, 20, -20, -50),
      createNode(-170, -10, -30, 60, 30, -40),
      createNode(-70, -130, -30, 50, 20, -50),
    ];
  },

  // Wide ribbed pumpkin gourd ghost
  pumpkin_cap: () => {
    return [
      createNode(0, -150, -80, 0, 80, 0),
      createNode(160, -80, -20, -40, 20, 50),
      createNode(180, 50, -10, -50, 10, 60),
      createNode(130, 170, 30, -30, -30, 10),
      createNode(60, 130, 20, 10, -20, -10),
      createNode(0, 160, 20, 0, -20, 0),
      createNode(-60, 130, 20, -10, -20, 10),
      createNode(-130, 170, 30, 10, -30, -30),
      createNode(-180, 50, -10, 60, 10, -50),
      createNode(-160, -80, -20, 50, 20, -40),
    ];
  },

  // Dynamic fluid wispy wisp ghost
  wispy_poltergeist: () => {
    return [
      createNode(0, -200, -50, 0, 50, 0),
      createNode(110, -120, -20, -40, 30, 40),
      createNode(150, 30, -20, -50, 20, 60),
      createNode(110, 180, 30, -40, -40, 10),
      createNode(20, 150, 30, 10, -30, -10),
      createNode(-40, 210, 30, 0, -40, -20),
      createNode(-120, 150, 30, 20, -30, -40),
      createNode(-140, 10, -20, 60, 20, -40),
      createNode(-100, -120, -30, 40, 20, -40),
    ];
  },
};

// Aliases for compatibility
SHROUD_PRESETS.banshee = SHROUD_PRESETS.banshee_veil;
SHROUD_PRESETS.screaming_banshee = SHROUD_PRESETS.banshee_veil;
SHROUD_PRESETS.pumpkin = SHROUD_PRESETS.pumpkin_cap;
SHROUD_PRESETS.wisp = SHROUD_PRESETS.wispy_poltergeist;
SHROUD_PRESETS.quantum_wisp = SHROUD_PRESETS.wispy_poltergeist;

export function getShroudPreset(key: string): BezierNode[] {
  const fn = SHROUD_PRESETS[key];
  if (typeof fn === 'function') {
    return fn();
  }
  if (typeof SHROUD_PRESETS.ethereal_wraith === 'function') {
    return SHROUD_PRESETS.ethereal_wraith();
  }
  return [
    createNode(0, -180, -60, 0, 60, 0),
    createNode(120, 0, -20, -40, 20, 50),
    createNode(0, 170, 20, 0, -20, 0),
    createNode(-120, 0, 20, 50, -20, -40),
  ];
}
