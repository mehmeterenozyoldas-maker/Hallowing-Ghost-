import * as THREE from 'three';
import { spatialAudio } from './spatialAudio';

export interface CandleProp {
  id: string;
  group: THREE.Group;
  light: THREE.PointLight;
  flameMesh: THREE.Mesh;
  baseY: number;
  phase: number;
  speed: number;
  amplitude: number;
  velocity: THREE.Vector3;
  radius: number;
}

export interface PumpkinProp {
  id: string;
  group: THREE.Group;
  light: THREE.PointLight;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  angularVel: THREE.Vector3;
  radius: number;
  mass: number;
}

export class PropsManager {
  public scene: THREE.Scene;
  public candles: CandleProp[] = [];
  public pumpkins: PumpkinProp[] = [];
  public obstacles: THREE.Box3[] = [];
  private propContainer: THREE.Group;
  public candleGlowIntensity: number = 1.2;
  public physicsEnabled: boolean = true;
  private time: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.propContainer = new THREE.Group();
    this.propContainer.name = 'SpookyPropsGroup';
    this.scene.add(this.propContainer);
    this.initDefaultProps();
  }

  // Build a charming stylized floating candle
  private createCandleMesh(colorHex = 0xfff0db): { group: THREE.Group; light: THREE.PointLight; flame: THREE.Mesh } {
    const group = new THREE.Group();

    // Candle wax body
    const bodyGeo = new THREE.CylinderGeometry(8, 9, 45, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.35,
      metalness: 0.05,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 22.5;
    group.add(bodyMesh);

    // Candle wax drips
    const dripGeo = new THREE.SphereGeometry(3.5, 8, 8);
    const dripMesh1 = new THREE.Mesh(dripGeo, bodyMat);
    dripMesh1.position.set(6.5, 36, 2);
    dripMesh1.scale.set(0.6, 1.4, 0.6);
    group.add(dripMesh1);

    // Dark wick
    const wickGeo = new THREE.CylinderGeometry(0.8, 0.8, 7, 8);
    const wickMat = new THREE.MeshBasicMaterial({ color: 0x221105 });
    const wickMesh = new THREE.Mesh(wickGeo, wickMat);
    wickMesh.position.y = 47.5;
    group.add(wickMesh);

    // Glowing flame teardrop
    const flameGeo = new THREE.ConeGeometry(3.2, 11, 10);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xffaa22,
      wireframe: false,
    });
    const flameMesh = new THREE.Mesh(flameGeo, flameMat);
    flameMesh.position.y = 53.5;
    group.add(flameMesh);

    // Inner bright flame core
    const coreGeo = new THREE.ConeGeometry(1.6, 6, 8);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.y = 52.0;
    group.add(coreMesh);

    // Local warm flickering PointLight
    const light = new THREE.PointLight(0xff9933, 1.8, 550, 1.4);
    light.position.set(0, 56, 0);
    group.add(light);

    // Attach metadata for raycasting detection
    group.userData = { type: 'candle', radius: 18 };

    return { group, light, flame: flameMesh };
  }

  // Build a Jack-o'-Lantern Pumpkin with glowing eyes & mouth
  private createPumpkinMesh(scale = 1.0): { group: THREE.Group; light: THREE.PointLight } {
    const group = new THREE.Group();
    const pumpkinRadius = 26 * scale;

    // Segmented gourd body
    const gourdGroup = new THREE.Group();
    const segmentCount = 10;
    const gourdMat = new THREE.MeshStandardMaterial({
      color: 0xd95b00,
      roughness: 0.55,
      metalness: 0.1,
    });

    for (let i = 0; i < segmentCount; i++) {
      const angle = (i / segmentCount) * Math.PI * 2;
      const segGeo = new THREE.SphereGeometry(15 * scale, 12, 12);
      const segMesh = new THREE.Mesh(segGeo, gourdMat);
      segMesh.scale.set(0.65, 0.88, 1.05);
      segMesh.position.set(Math.cos(angle) * (13 * scale), 0, Math.sin(angle) * (13 * scale));
      segMesh.rotation.y = -angle;
      gourdGroup.add(segMesh);
    }
    gourdGroup.position.y = pumpkinRadius;
    group.add(gourdGroup);

    // Curled green stem
    const stemGeo = new THREE.CylinderGeometry(2.5 * scale, 4.0 * scale, 12 * scale, 8);
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x3d661e,
      roughness: 0.8,
    });
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    stemMesh.position.set(0, pumpkinRadius * 1.85, 0);
    stemMesh.rotation.z = 0.25;
    group.add(stemMesh);

    // Carved glowing eyes & jagged mouth
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });

    // Left Eye (triangle)
    const eyeGeo = new THREE.ConeGeometry(3.5 * scale, 6 * scale, 3);
    const eyeL = new THREE.Mesh(eyeGeo, glowMat);
    eyeL.position.set(-6 * scale, pumpkinRadius * 1.15, pumpkinRadius * 0.95);
    eyeL.rotation.x = Math.PI * 0.5;
    eyeL.rotation.z = 0.2;
    group.add(eyeL);

    // Right Eye
    const eyeR = new THREE.Mesh(eyeGeo, glowMat);
    eyeR.position.set(6 * scale, pumpkinRadius * 1.15, pumpkinRadius * 0.95);
    eyeR.rotation.x = Math.PI * 0.5;
    eyeR.rotation.z = -0.2;
    group.add(eyeR);

    // Jagged grin mouth
    const mouthGeo = new THREE.BoxGeometry(16 * scale, 4 * scale, 2.5 * scale);
    const mouth = new THREE.Mesh(mouthGeo, glowMat);
    mouth.position.set(0, pumpkinRadius * 0.72, pumpkinRadius * 0.96);
    mouth.rotation.x = 0.15;
    group.add(mouth);

    // Inner warm flicker light
    const light = new THREE.PointLight(0xff7700, 2.2 * scale, 420 * scale, 1.2);
    light.position.set(0, pumpkinRadius * 1.1, 4 * scale);
    group.add(light);

    group.userData = { type: 'pumpkin', radius: pumpkinRadius };

    return { group, light };
  }

  // Initialize a cozy initial stage layout
  public initDefaultProps(): void {
    this.clearAll();

    // Floating levitating candles around the stage
    this.addCandle(-180, 220, -120, 20, 1.4);
    this.addCandle(190, 240, -100, 22, 1.7);
    this.addCandle(-90, 290, 110, 25, 1.2);
    this.addCandle(130, 260, 120, 18, 1.5);
    this.addCandle(0, 340, -160, 26, 1.3);

    // Jack-o'-Lanterns on the floor
    this.addPumpkin(-140, 0, 150, 1.1);
    this.addPumpkin(150, 0, 160, 1.25);
    this.addPumpkin(0, 0, 230, 0.95);
  }

  public addCandle(x: number, y: number, z: number, amp = 22, spd = 1.5): CandleProp {
    const { group, light, flame } = this.createCandleMesh();
    group.position.set(x, y, z);
    this.propContainer.add(group);

    const candle: CandleProp = {
      id: `candle_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      group,
      light,
      flameMesh: flame,
      baseY: y,
      phase: Math.random() * Math.PI * 2,
      speed: spd,
      amplitude: amp,
      velocity: new THREE.Vector3(),
      radius: 18,
    };
    this.candles.push(candle);
    return candle;
  }

  public addPumpkin(x: number, y: number, z: number, scale = 1.0): PumpkinProp {
    const { group, light } = this.createPumpkinMesh(scale);
    group.position.set(x, y, z);
    this.propContainer.add(group);

    const pumpkin: PumpkinProp = {
      id: `pumpkin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      group,
      light,
      position: new THREE.Vector3(x, y, z),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        Math.random() * 40,
        (Math.random() - 0.5) * 20
      ),
      rotation: new THREE.Euler(0, Math.random() * Math.PI * 2, 0),
      angularVel: new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 1.5
      ),
      radius: 26 * scale,
      mass: 1.5 * scale,
    };
    this.pumpkins.push(pumpkin);
    return pumpkin;
  }

  public clearAll(): void {
    // Remove candles
    for (const c of this.candles) {
      this.propContainer.remove(c.group);
    }
    this.candles = [];

    // Remove pumpkins
    for (const p of this.pumpkins) {
      this.propContainer.remove(p.group);
    }
    this.pumpkins = [];
  }

  // Update frame: physics integration, levitation, collisions with ghost centroids
  public update(dt: number, ghostCentroids: THREE.Vector3[], ghostRadii: number[] = [120]): void {
    this.time += dt;
    const t = this.time;

    // 1. Update Floating Candles
    for (const candle of this.candles) {
      // Harmonic levitation
      const hoverY = candle.baseY + Math.sin(t * candle.speed + candle.phase) * candle.amplitude;
      candle.group.position.y += (hoverY - candle.group.position.y) * 0.1;

      // Realistic flame jitter and light flicker
      const flicker = 0.8 + 0.2 * Math.sin(t * 14 + candle.phase) + 0.08 * Math.cos(t * 27);
      candle.light.intensity = this.candleGlowIntensity * flicker;
      candle.flameMesh.scale.y = 1.0 + 0.25 * Math.sin(t * 18 + candle.phase);

      // Repulsion from ghosts if too close
      for (let g = 0; g < ghostCentroids.length; g++) {
        const gc = ghostCentroids[g];
        const gRad = ghostRadii[g] || 110;
        const cPos = candle.group.position;
        const distSq = cPos.distanceToSquared(gc);
        const minDist = gRad + candle.radius + 30;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 1;
          const push = (minDist - dist) * 0.08;
          const dirX = (cPos.x - gc.x) / dist;
          const dirZ = (cPos.z - gc.z) / dist;

          cPos.x += dirX * push;
          cPos.z += dirZ * push;
          candle.group.rotation.z = -dirX * 0.25;
          candle.group.rotation.x = dirZ * 0.25;

          // Spatial sound on near brush
          if (Math.random() < 0.04) {
            spatialAudio.playCandleWhoosh(cPos.x, cPos.y, cPos.z);
          }
        } else {
          // Smoothly return upright
          candle.group.rotation.z *= 0.94;
          candle.group.rotation.x *= 0.94;
        }
      }
    }

    // 2. Update Jack-o'-Lantern Pumpkins Physics
    if (this.physicsEnabled) {
      const gravity = -320; // mm/s^2
      const floorY = 0;

      for (let i = 0; i < this.pumpkins.length; i++) {
        const p = this.pumpkins[i];

        // Apply gravity
        p.velocity.y += gravity * dt;

        // Position integration
        p.position.x += p.velocity.x * dt;
        p.position.y += p.velocity.y * dt;
        p.position.z += p.velocity.z * dt;

        // Angular rotation integration
        p.rotation.x += p.angularVel.x * dt;
        p.rotation.y += p.angularVel.y * dt;
        p.rotation.z += p.angularVel.z * dt;

        // Friction dampening
        p.velocity.x *= 0.985;
        p.velocity.z *= 0.985;
        p.angularVel.x *= 0.98;
        p.angularVel.y *= 0.98;
        p.angularVel.z *= 0.98;

        // Floor collision with bounce restitution
        if (p.position.y <= floorY) {
          p.position.y = floorY;
          if (p.velocity.y < -30) {
            spatialAudio.playPropBump(p.position.x, p.position.y, p.position.z, 'pumpkin');
          }
          p.velocity.y = -p.velocity.y * 0.45; // Bounce restitution
          if (Math.abs(p.velocity.y) < 15) p.velocity.y = 0;
        }

        // Boundary reflection
        const maxStageDist = 480;
        if (Math.abs(p.position.x) > maxStageDist) {
          p.position.x = Math.sign(p.position.x) * maxStageDist;
          p.velocity.x = -p.velocity.x * 0.6;
        }
        if (Math.abs(p.position.z) > maxStageDist) {
          p.position.z = Math.sign(p.position.z) * maxStageDist;
          p.velocity.z = -p.velocity.z * 0.6;
        }

        // Ghost collision with pumpkins
        for (let g = 0; g < ghostCentroids.length; g++) {
          const gc = ghostCentroids[g];
          const gRad = ghostRadii[g] || 110;
          const pCenter = new THREE.Vector3(p.position.x, p.position.y + p.radius, p.position.z);
          const dist = pCenter.distanceTo(gc);
          const contactDist = gRad + p.radius;

          if (dist < contactDist) {
            const overlap = contactDist - dist;
            const norm = pCenter.clone().sub(gc).normalize();

            // Push pumpkin away with dynamic impulse
            p.position.x += norm.x * overlap * 0.6;
            p.position.z += norm.z * overlap * 0.6;

            const impactSpeed = 120 + overlap * 8;
            p.velocity.x += norm.x * impactSpeed;
            p.velocity.y += Math.max(40, norm.y * impactSpeed + 60);
            p.velocity.z += norm.z * impactSpeed;

            // Angular spin tumble
            p.angularVel.x += (Math.random() - 0.5) * 6;
            p.angularVel.y += 4;

            spatialAudio.playPropBump(p.position.x, p.position.y, p.position.z, 'pumpkin');
          }
        }

        // Pumpkin-to-pumpkin elastic bounce
        for (let j = i + 1; j < this.pumpkins.length; j++) {
          const p2 = this.pumpkins[j];
          const dx = p2.position.x - p.position.x;
          const dz = p2.position.z - p.position.z;
          const distSq = dx * dx + dz * dz;
          const minD = p.radius + p2.radius;

          if (distSq < minD * minD && distSq > 0.01) {
            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const nz = dz / dist;
            const sep = (minD - dist) * 0.5;

            p.position.x -= nx * sep;
            p.position.z -= nz * sep;
            p2.position.x += nx * sep;
            p2.position.z += nz * sep;

            const relVx = p.velocity.x - p2.velocity.x;
            const relVz = p.velocity.z - p2.velocity.z;
            const impulse = (relVx * nx + relVz * nz) * 0.7;

            p.velocity.x -= nx * impulse;
            p.velocity.z -= nz * impulse;
            p2.velocity.x += nx * impulse;
            p2.velocity.z += nz * impulse;

            if (Math.abs(impulse) > 20) {
              spatialAudio.playPropBump(p.position.x, p.position.y, p.position.z, 'pumpkin');
            }
          }
        }

        // Sync Three.js mesh transform
        p.group.position.set(p.position.x, p.position.y, p.position.z);
        p.group.rotation.copy(p.rotation);

        // Jack-o'-lantern internal candle flicker
        p.light.intensity = 1.8 + 0.4 * Math.sin(t * 11 + i * 2.3);
      }
    }
  }

  // Raycast helper to find clicked prop for grabbing/nudging
  public checkIntersection(raycaster: THREE.Raycaster): { type: 'candle' | 'pumpkin'; prop: CandleProp | PumpkinProp } | null {
    // Check candles
    for (const c of this.candles) {
      const hits = raycaster.intersectObject(c.group, true);
      if (hits.length > 0) {
        return { type: 'candle', prop: c };
      }
    }

    // Check pumpkins
    for (const p of this.pumpkins) {
      const hits = raycaster.intersectObject(p.group, true);
      if (hits.length > 0) {
        return { type: 'pumpkin', prop: p };
      }
    }

    return null;
  }

  // Kick/nudge all pumpkins with a fun radial burst
  public scatterPumpkins(): void {
    for (const p of this.pumpkins) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 140 + Math.random() * 180;
      p.velocity.set(Math.cos(angle) * speed, 120 + Math.random() * 100, Math.sin(angle) * speed);
      p.angularVel.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      spatialAudio.playPropBump(p.position.x, p.position.y, p.position.z, 'pumpkin');
    }
  }
}
