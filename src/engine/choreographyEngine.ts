import * as THREE from 'three';
import {
  ChoreographyShow,
  FlightKeyframe,
  FlightTrack,
  ShowCue,
} from '../types';

/**
 * 3D Spline interpolation helper for flight keyframes
 */
export function evaluateTrackPosition(
  track: FlightTrack,
  time: number,
  loop: boolean = true,
  duration: number = 16.0
): THREE.Vector3 | null {
  const kfs = track.keyframes;
  if (!kfs || kfs.length === 0) return null;
  if (kfs.length === 1) return new THREE.Vector3(kfs[0].x, kfs[0].y, kfs[0].z);

  // Normalize time within show duration
  let t = loop ? ((time % duration) + duration) % duration : Math.max(0, Math.min(duration, time));

  // Sort keyframes by time
  const sorted = [...kfs].sort((a, b) => a.time - b.time);

  // If before first keyframe
  if (t <= sorted[0].time) {
    if (loop && sorted.length >= 2) {
      // Loop wrap: interpolate from last to first
      const last = sorted[sorted.length - 1];
      const first = sorted[0];
      const wrapSpan = (duration - last.time) + first.time;
      if (wrapSpan > 0.001) {
        const wrapT = (t + (duration - last.time)) / wrapSpan;
        return new THREE.Vector3().lerpVectors(
          new THREE.Vector3(last.x, last.y, last.z),
          new THREE.Vector3(first.x, first.y, first.z),
          Math.min(1, Math.max(0, wrapT))
        );
      }
    }
    return new THREE.Vector3(sorted[0].x, sorted[0].y, sorted[0].z);
  }

  // If after last keyframe
  if (t >= sorted[sorted.length - 1].time) {
    if (loop && sorted.length >= 2) {
      const last = sorted[sorted.length - 1];
      const first = sorted[0];
      const wrapSpan = (duration - last.time) + first.time;
      if (wrapSpan > 0.001) {
        const wrapT = (t - last.time) / wrapSpan;
        return new THREE.Vector3().lerpVectors(
          new THREE.Vector3(last.x, last.y, last.z),
          new THREE.Vector3(first.x, first.y, first.z),
          Math.min(1, Math.max(0, wrapT))
        );
      }
    }
    const last = sorted[sorted.length - 1];
    return new THREE.Vector3(last.x, last.y, last.z);
  }

  // Find segment [i, i+1]
  for (let i = 0; i < sorted.length - 1; i++) {
    const k0 = sorted[i];
    const k1 = sorted[i + 1];
    if (t >= k0.time && t <= k1.time) {
      const span = k1.time - k0.time;
      const alpha = span > 0.0001 ? (t - k0.time) / span : 0;
      // Smooth Hermite / Catmull-Rom ease interpolation
      const smoothAlpha = alpha * alpha * (3 - 2 * alpha);

      // Previous and next points for tangent continuity
      const pPrev = i > 0 ? sorted[i - 1] : k0;
      const pNext = i + 2 < sorted.length ? sorted[i + 2] : k1;

      const p0 = new THREE.Vector3(k0.x, k0.y, k0.z);
      const p1 = new THREE.Vector3(k1.x, k1.y, k1.z);
      const pm1 = new THREE.Vector3(pPrev.x, pPrev.y, pPrev.z);
      const p2 = new THREE.Vector3(pNext.x, pNext.y, pNext.z);

      // Standard Catmull-Rom spline formula
      const a = alpha;
      const a2 = a * a;
      const a3 = a2 * a;

      const res = new THREE.Vector3();
      res.x = 0.5 * ((2 * p0.x) + (-pm1.x + p1.x) * a + (2 * pm1.x - 5 * p0.x + 4 * p1.x - p2.x) * a2 + (-pm1.x + 3 * p0.x - 3 * p1.x + p2.x) * a3);
      res.y = 0.5 * ((2 * p0.y) + (-pm1.y + p1.y) * a + (2 * pm1.y - 5 * p0.y + 4 * p1.y - p2.y) * a2 + (-pm1.y + 3 * p0.y - 3 * p1.y + p2.y) * a3);
      res.z = 0.5 * ((2 * p0.z) + (-pm1.z + p1.z) * a + (2 * pm1.z - 5 * p0.z + 4 * p1.z - p2.z) * a2 + (-pm1.z + 3 * p0.z - 3 * p1.z + p2.z) * a3);

      return res;
    }
  }

  const kf = sorted[0];
  return new THREE.Vector3(kf.x, kf.y, kf.z);
}

/**
 * Built-in Choreography Presets
 */
export const SHOW_PRESETS: Record<string, ChoreographyShow> = {
  midnight_spiral: {
    id: 'midnight_spiral',
    name: 'The Midnight Spiral',
    duration: 16.0,
    loop: true,
    tracks: [
      {
        id: 'track_wraith',
        ghostId: 'ghost_1',
        name: 'Ethereal Wraith',
        color: '#38bdf8',
        visible: true,
        keyframes: [
          { id: 'ms_w_0', time: 0.0, x: 0, y: 220, z: 0 },
          { id: 'ms_w_1', time: 2.5, x: 160, y: 280, z: 120 },
          { id: 'ms_w_2', time: 5.0, x: 220, y: 390, z: -80 }, // Spire ascent
          { id: 'ms_w_3', time: 7.5, x: 40, y: 440, z: -160 }, // Spire crest
          { id: 'ms_w_4', time: 10.0, x: -180, y: 290, z: -60 }, // Dive down
          { id: 'ms_w_5', time: 12.5, x: -160, y: 140, z: 140 }, // Courtyard sweep
          { id: 'ms_w_6', time: 14.5, x: -40, y: 170, z: 60 },
          { id: 'ms_w_7', time: 16.0, x: 0, y: 220, z: 0 },
        ],
      },
      {
        id: 'track_spectre',
        ghostId: 'ghost_2',
        name: 'Midnight Spectre',
        color: '#c084fc',
        visible: true,
        keyframes: [
          { id: 'ms_s_0', time: 0.0, x: -180, y: 160, z: 80 },
          { id: 'ms_s_1', time: 3.0, x: -210, y: 260, z: -90 },
          { id: 'ms_s_2', time: 6.5, x: -70, y: 350, z: -150 },
          { id: 'ms_s_3', time: 9.5, x: 140, y: 270, z: -40 },
          { id: 'ms_s_4', time: 13.0, x: 160, y: 150, z: 90 },
          { id: 'ms_s_5', time: 16.0, x: -180, y: 160, z: 80 },
        ],
      },
      {
        id: 'track_pumpkin',
        ghostId: 'ghost_3',
        name: 'Pumpkin Poltergeist',
        color: '#fb923c',
        visible: true,
        keyframes: [
          { id: 'ms_p_0', time: 0.0, x: 190, y: 120, z: 60 },
          { id: 'ms_p_1', time: 4.0, x: 90, y: 80, z: 180 },
          { id: 'ms_p_2', time: 8.0, x: -120, y: 110, z: 140 },
          { id: 'ms_p_3', time: 12.0, x: 40, y: 190, z: -20 },
          { id: 'ms_p_4', time: 16.0, x: 190, y: 120, z: 60 },
        ],
      },
    ],
    cues: [
      { id: 'cue_ms_1', time: 4.8, type: 'lightning', intensity: 2.0, label: 'Spire Flash' },
      { id: 'cue_ms_2', time: 5.4, type: 'thunder', intensity: 1.5, label: 'Town Hall Rumble' },
      { id: 'cue_ms_3', time: 9.8, type: 'organ_stab', intensity: 1.0, label: 'Gothic Minor Stab' },
      { id: 'cue_ms_4', time: 12.2, type: 'fog_burst', intensity: 1.8, label: 'Ground Mist Surge' },
      { id: 'cue_ms_5', time: 14.2, type: 'whoosh', intensity: 1.2, label: 'Courtyard Swoop' },
    ],
  },

  poltergeist_tempest: {
    id: 'poltergeist_tempest',
    name: 'Poltergeist Tempest',
    duration: 12.0,
    loop: true,
    tracks: [
      {
        id: 'track_wraith',
        ghostId: 'ghost_1',
        name: 'Ethereal Wraith',
        color: '#38bdf8',
        visible: true,
        keyframes: [
          { id: 'pt_w_0', time: 0.0, x: -220, y: 320, z: -120 },
          { id: 'pt_w_1', time: 2.0, x: 180, y: 110, z: 140 },
          { id: 'pt_w_2', time: 4.2, x: 240, y: 380, z: -60 },
          { id: 'pt_w_3', time: 6.5, x: -140, y: 120, z: 120 },
          { id: 'pt_w_4', time: 9.0, x: 0, y: 460, z: 0 },
          { id: 'pt_w_5', time: 12.0, x: -220, y: 320, z: -120 },
        ],
      },
      {
        id: 'track_spectre',
        ghostId: 'ghost_2',
        name: 'Midnight Spectre',
        color: '#c084fc',
        visible: true,
        keyframes: [
          { id: 'pt_s_0', time: 0.0, x: 200, y: 140, z: 100 },
          { id: 'pt_s_1', time: 3.0, x: -190, y: 360, z: -80 },
          { id: 'pt_s_2', time: 6.0, x: 150, y: 130, z: -110 },
          { id: 'pt_s_3', time: 9.0, x: -80, y: 290, z: 120 },
          { id: 'pt_s_4', time: 12.0, x: 200, y: 140, z: 100 },
        ],
      },
      {
        id: 'track_pumpkin',
        ghostId: 'ghost_3',
        name: 'Pumpkin Poltergeist',
        color: '#fb923c',
        visible: true,
        keyframes: [
          { id: 'pt_p_0', time: 0.0, x: 0, y: 90, z: 190 },
          { id: 'pt_p_1', time: 2.5, x: 160, y: 260, z: 0 },
          { id: 'pt_p_2', time: 5.5, x: -160, y: 190, z: -60 },
          { id: 'pt_p_3', time: 8.5, x: 90, y: 110, z: 150 },
          { id: 'pt_p_4', time: 12.0, x: 0, y: 90, z: 190 },
        ],
      },
    ],
    cues: [
      { id: 'cue_pt_1', time: 1.8, type: 'lightning', intensity: 2.5, label: 'Flash Strike' },
      { id: 'cue_pt_2', time: 2.3, type: 'fog_burst', intensity: 2.0, label: 'Mist Cloud' },
      { id: 'cue_pt_3', time: 4.1, type: 'whoosh', intensity: 1.5, label: 'Dart Swoop' },
      { id: 'cue_pt_4', time: 6.2, type: 'lightning', intensity: 2.8, label: 'Storm Bolt' },
      { id: 'cue_pt_5', time: 8.8, type: 'organ_stab', intensity: 1.6, label: 'Climax Organ' },
      { id: 'cue_pt_6', time: 11.2, type: 'thunder', intensity: 2.0, label: 'Rolling Thunder' },
    ],
  },

  phantom_waltz: {
    id: 'phantom_waltz',
    name: 'Phantom Waltz',
    duration: 20.0,
    loop: true,
    tracks: [
      {
        id: 'track_wraith',
        ghostId: 'ghost_1',
        name: 'Ethereal Wraith',
        color: '#38bdf8',
        visible: true,
        keyframes: [
          { id: 'pw_w_0', time: 0.0, x: -120, y: 210, z: 0 },
          { id: 'pw_w_1', time: 5.0, x: 0, y: 270, z: 130 },
          { id: 'pw_w_2', time: 10.0, x: 120, y: 210, z: 0 },
          { id: 'pw_w_3', time: 15.0, x: 0, y: 160, z: -130 },
          { id: 'pw_w_4', time: 20.0, x: -120, y: 210, z: 0 },
        ],
      },
      {
        id: 'track_spectre',
        ghostId: 'ghost_2',
        name: 'Midnight Spectre',
        color: '#c084fc',
        visible: true,
        keyframes: [
          { id: 'pw_s_0', time: 0.0, x: 120, y: 210, z: 0 },
          { id: 'pw_s_1', time: 5.0, x: 0, y: 160, z: -130 },
          { id: 'pw_s_2', time: 10.0, x: -120, y: 210, z: 0 },
          { id: 'pw_s_3', time: 15.0, x: 0, y: 270, z: 130 },
          { id: 'pw_s_4', time: 20.0, x: 120, y: 210, z: 0 },
        ],
      },
      {
        id: 'track_pumpkin',
        ghostId: 'ghost_3',
        name: 'Pumpkin Poltergeist',
        color: '#fb923c',
        visible: true,
        keyframes: [
          { id: 'pw_p_0', time: 0.0, x: 0, y: 310, z: 0 },
          { id: 'pw_p_1', time: 5.0, x: 80, y: 330, z: 50 },
          { id: 'pw_p_2', time: 10.0, x: 0, y: 350, z: -60 },
          { id: 'pw_p_3', time: 15.0, x: -80, y: 330, z: 50 },
          { id: 'pw_p_4', time: 20.0, x: 0, y: 310, z: 0 },
        ],
      },
    ],
    cues: [
      { id: 'cue_pw_1', time: 0.1, type: 'organ_stab', intensity: 0.9, label: 'Waltz Intro' },
      { id: 'cue_pw_2', time: 5.2, type: 'whoosh', intensity: 0.8, label: 'Figure Eight Cross' },
      { id: 'cue_pw_3', time: 9.8, type: 'fog_burst', intensity: 1.4, label: 'Dancing Mist' },
      { id: 'cue_pw_4', time: 14.8, type: 'lightning', intensity: 1.5, label: 'Gentle Flash' },
      { id: 'cue_pw_5', time: 19.5, type: 'organ_stab', intensity: 1.2, label: 'Waltz Finale' },
    ],
  },
};

/**
 * 3D Flight Ribbon Visualizer Manager for Three.js
 */
export class FlightRibbonManager {
  private group: THREE.Group;
  private trackMeshes: Map<
    string,
    {
      curveMesh: THREE.Line | THREE.Mesh;
      nodeGroup: THREE.Group;
    }
  > = new Map();

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'FlightTrajectoryRibbons';
    scene.add(this.group);
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public updateRibbons(show: ChoreographyShow, activeGhostId?: string): void {
    // Clear old ribbon meshes
    for (const [, entry] of this.trackMeshes) {
      this.group.remove(entry.curveMesh);
      this.group.remove(entry.nodeGroup);
      if ('geometry' in entry.curveMesh) {
        entry.curveMesh.geometry.dispose();
      }
    }
    this.trackMeshes.clear();

    if (!this.group.visible) return;

    for (const track of show.tracks) {
      if (!track.visible || track.keyframes.length < 2) continue;

      const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);
      const points: THREE.Vector3[] = [];
      const samples = 80;
      for (let s = 0; s <= samples; s++) {
        const t = (s / samples) * show.duration;
        const pos = evaluateTrackPosition(track, t, show.loop, show.duration);
        if (pos) points.push(pos);
      }

      if (points.length < 2) continue;

      const curve = new THREE.CatmullRomCurve3(points, show.loop);
      const curveGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(120));

      const isSelected = track.ghostId === activeGhostId;
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(track.color),
        linewidth: isSelected ? 3 : 1.5,
        transparent: true,
        opacity: isSelected ? 0.95 : 0.65,
      });

      const line = new THREE.Line(curveGeo, mat);
      this.group.add(line);

      // Node keyframe markers
      const nodeGroup = new THREE.Group();
      const nodeGeo = new THREE.SphereGeometry(isSelected ? 4.5 : 3.2, 12, 12);
      const nodeMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(track.color),
      });

      for (const kf of sorted) {
        const sphere = new THREE.Mesh(nodeGeo, nodeMat);
        sphere.position.set(kf.x, kf.y, kf.z);
        nodeGroup.add(sphere);
      }
      this.group.add(nodeGroup);

      this.trackMeshes.set(track.id, {
        curveMesh: line,
        nodeGroup,
      });
    }
  }

  public dispose(): void {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
