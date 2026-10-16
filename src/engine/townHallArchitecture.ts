import * as THREE from 'three';

export interface TownHallSceneAssets {
  group: THREE.Group;
  facadeMesh: THREE.Mesh;
  groundMesh: THREE.Mesh;
  projectorRig: THREE.Group;
  projectorCone: THREE.LineSegments;
  normalMapTexture: THREE.CanvasTexture;
}

// Procedural normal map generator for masonry stone and cobblestone
export function generateProceduralStoneNormalMap(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Generate height map first
  const heightData = new Float32Array(size * size);
  const blockW = 64;
  const blockH = 32;

  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / blockH);
    const rowOffset = (row % 2) * (blockW / 2);
    for (let x = 0; x < size; x++) {
      const colX = (x + rowOffset) % blockW;
      const colY = y % blockH;

      // Mortar groove
      const isGroove = colX < 3 || colY < 3;
      let h = isGroove ? 0.2 : 0.8;

      // Subtle rough stone grain
      const grain = Math.sin(x * 0.2) * Math.cos(y * 0.2) * 0.08 + Math.random() * 0.05;
      h = Math.max(0, Math.min(1, h + grain));
      heightData[y * size + x] = h;
    }
  }

  // Convert height map to normal map (Sobel filter)
  const imgData = ctx.createImageData(size, size);
  const pixels = imgData.data;

  for (let y = 0; y < size; y++) {
    const yTop = (y - 1 + size) % size;
    const yBot = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xLeft = (x - 1 + size) % size;
      const xRight = (x + 1) % size;

      const dX =
        heightData[yTop * size + xRight] +
        2 * heightData[y * size + xRight] +
        heightData[yBot * size + xRight] -
        (heightData[yTop * size + xLeft] +
          2 * heightData[y * size + xLeft] +
          heightData[yBot * size + xLeft]);

      const dY =
        heightData[yBot * size + xLeft] +
        2 * heightData[yBot * size + x] +
        heightData[yBot * size + xRight] -
        (heightData[yTop * size + xLeft] +
          2 * heightData[yTop * size + x] +
          heightData[yTop * size + xRight]);

      const strength = 2.5;
      let nx = -dX * strength;
      let ny = -dY * strength;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * size + x) * 4;
      pixels[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      pixels[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      pixels[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      pixels[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  texture.needsUpdate = true;
  return texture;
}

export function createTownHallEnvironment(
  facadeMaterial: THREE.Material,
  groundMaterial: THREE.Material
): TownHallSceneAssets {
  const group = new THREE.Group();
  const normalMapTexture = generateProceduralStoneNormalMap();

  // 1. Grand Town Hall Back Wall
  const wallGeo = new THREE.PlaneGeometry(1600, 1000, 32, 20);
  const facadeMesh = new THREE.Mesh(wallGeo, facadeMaterial);
  facadeMesh.position.set(0, 320, -180);
  group.add(facadeMesh);

  // 2. Architectural Archway Framing
  const archGroup = new THREE.Group();
  archGroup.position.set(0, 0, -170);

  // Columns flanking center grand arch
  const colGeo = new THREE.CylinderGeometry(18, 22, 600, 24);
  const colBaseGeo = new THREE.BoxGeometry(48, 24, 48);

  const leftCol = new THREE.Mesh(colGeo, facadeMaterial);
  leftCol.position.set(-280, 300, 0);
  const leftBase = new THREE.Mesh(colBaseGeo, facadeMaterial);
  leftBase.position.set(-280, 12, 0);

  const rightCol = new THREE.Mesh(colGeo, facadeMaterial);
  rightCol.position.set(280, 300, 0);
  const rightBase = new THREE.Mesh(colBaseGeo, facadeMaterial);
  rightBase.position.set(280, 12, 0);

  // Outer secondary columns
  const outerLeftCol = new THREE.Mesh(colGeo, facadeMaterial);
  outerLeftCol.position.set(-560, 300, 0);
  const outerRightCol = new THREE.Mesh(colGeo, facadeMaterial);
  outerRightCol.position.set(560, 300, 0);

  // Grand Entablature & Cornice Architraves
  const corniceGeo = new THREE.BoxGeometry(1300, 32, 40);
  const lowerCornice = new THREE.Mesh(corniceGeo, facadeMaterial);
  lowerCornice.position.set(0, 610, 10);

  const pedimentGeo = new THREE.BoxGeometry(700, 24, 30);
  const upperPediment = new THREE.Mesh(pedimentGeo, facadeMaterial);
  upperPediment.position.set(0, 680, 10);

  // Center Gothic / Romanesque Curved Arch Ring
  const archCurveGeo = new THREE.TorusGeometry(280, 16, 16, 48, Math.PI);
  const archCurve = new THREE.Mesh(archCurveGeo, facadeMaterial);
  archCurve.position.set(0, 600, 0);
  archCurve.rotation.z = 0;

  archGroup.add(leftCol, leftBase, rightCol, rightBase, outerLeftCol, outerRightCol, lowerCornice, upperPediment, archCurve);
  group.add(archGroup);

  // 3. Grand Flagstone Plaza Floor
  const groundGeo = new THREE.PlaneGeometry(8000, 8000);
  const groundMesh = new THREE.Mesh(groundGeo, groundMaterial);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(0, 0, 0);
  group.add(groundMesh);

  // 4. Theatrical Footlights (Row of glowing brass footlight hoods along stage front)
  const footlightsGroup = new THREE.Group();
  const footlightHoodGeo = new THREE.CylinderGeometry(7, 10, 12, 16, 1, false, 0, Math.PI);
  footlightHoodGeo.rotateX(Math.PI / 2);
  const footlightHoodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.4,
    metalness: 0.8,
  });
  const footlightBulbGeo = new THREE.SphereGeometry(4, 12, 12);
  const footlightBulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  const footlightCount = 11;
  const footlightSpan = 680;
  for (let i = 0; i < footlightCount; i++) {
    const fx = -footlightSpan / 2 + (i / (footlightCount - 1)) * footlightSpan;
    const hood = new THREE.Mesh(footlightHoodGeo, footlightHoodMat);
    hood.position.set(fx, 6, 260);
    hood.rotation.y = Math.PI;

    const bulb = new THREE.Mesh(footlightBulbGeo, footlightBulbMat);
    bulb.position.set(fx, 6, 257);

    footlightsGroup.add(hood, bulb);
  }
  group.add(footlightsGroup);

  // 5. Gothic Rose Window with Stone Tracery & Backlit Stained Glass
  const roseWindowGroup = new THREE.Group();
  roseWindowGroup.position.set(0, 520, -172);

  // Glowing stained glass backdrop disc
  const glassDiscGeo = new THREE.CircleGeometry(110, 32);
  const glassDiscMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.75,
  });
  const glassDisc = new THREE.Mesh(glassDiscGeo, glassDiscMat);
  roseWindowGroup.add(glassDisc);

  // Outer stone frame ring
  const roseOuterRingGeo = new THREE.TorusGeometry(114, 10, 16, 48);
  const roseOuterRing = new THREE.Mesh(roseOuterRingGeo, facadeMaterial);
  roseWindowGroup.add(roseOuterRing);

  // Inner decorative stone ring
  const roseInnerRingGeo = new THREE.TorusGeometry(55, 6, 12, 36);
  const roseInnerRing = new THREE.Mesh(roseInnerRingGeo, facadeMaterial);
  roseWindowGroup.add(roseInnerRing);

  // Gothic Stone Radial Tracery Spokes (12 radiating mullions)
  const spokeGeo = new THREE.BoxGeometry(6, 110, 8);
  for (let s = 0; s < 6; s++) {
    const spoke = new THREE.Mesh(spokeGeo, facadeMaterial);
    spoke.rotation.z = (s * Math.PI) / 6;
    roseWindowGroup.add(spoke);
  }

  // Central rosette medallion
  const centerMedallionGeo = new THREE.CylinderGeometry(18, 18, 12, 16);
  centerMedallionGeo.rotateX(Math.PI / 2);
  const centerMedallion = new THREE.Mesh(centerMedallionGeo, facadeMaterial);
  roseWindowGroup.add(centerMedallion);

  group.add(roseWindowGroup);

  // 6. Plush Velvet Theatrical Stage Curtains (Left & Right Wings + Top Valance)
  const curtainMat = new THREE.MeshStandardMaterial({
    color: 0x881337, // Rich royal theatrical crimson velvet
    roughness: 0.85,
    metalness: 0.1,
  });
  const goldRopeMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.3,
    metalness: 0.85,
  });

  const curtainsGroup = new THREE.Group();

  // Left & right gathered curtain folds (procedural ribbed draped cylinders)
  const drapeFoldCount = 7;
  const drapeWidth = 140;
  for (let side = -1; side <= 1; side += 2) {
    const baseX = side * 390;
    for (let f = 0; f < drapeFoldCount; f++) {
      const fx = baseX + side * (f * (drapeWidth / drapeFoldCount));
      const foldRadius = 14 + Math.sin(f * 0.9) * 3;
      const foldGeo = new THREE.CylinderGeometry(foldRadius, foldRadius + 4, 580, 16);
      const foldMesh = new THREE.Mesh(foldGeo, curtainMat);
      foldMesh.position.set(fx, 300, -90 + f * 4);
      curtainsGroup.add(foldMesh);
    }

    // Golden tie-back rope band
    const tieBackGeo = new THREE.TorusGeometry(52, 8, 12, 24);
    const tieBack = new THREE.Mesh(tieBackGeo, goldRopeMat);
    tieBack.position.set(baseX + side * 45, 230, -80);
    tieBack.rotation.y = Math.PI / 2;
    curtainsGroup.add(tieBack);
  }

  // Top Proscenium Valance Scalloped Border
  const valanceGeo = new THREE.BoxGeometry(840, 50, 24);
  const valance = new THREE.Mesh(valanceGeo, curtainMat);
  valance.position.set(0, 580, -90);
  curtainsGroup.add(valance);

  // Valance Gold Fringes
  const fringeGeo = new THREE.BoxGeometry(844, 8, 28);
  const fringe = new THREE.Mesh(fringeGeo, goldRopeMat);
  fringe.position.set(0, 554, -90);
  curtainsGroup.add(fringe);

  group.add(curtainsGroup);

  // 7. Wrought Iron Wall Sconces & Lanterns on Inner Columns
  const lanternsGroup = new THREE.Group();
  const sconceArmGeo = new THREE.CylinderGeometry(4, 4, 45, 8);
  const sconceArmMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
  const lanternGlassGeo = new THREE.BoxGeometry(22, 34, 22);
  const lanternGlassMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 });

  for (let side = -1; side <= 1; side += 2) {
    const lx = side * 280;
    const arm = new THREE.Mesh(sconceArmGeo, sconceArmMat);
    arm.rotation.z = side * (Math.PI / 3);
    arm.position.set(lx + side * 20, 270, -150);

    const glass = new THREE.Mesh(lanternGlassGeo, lanternGlassMat);
    glass.position.set(lx + side * 36, 286, -145);

    lanternsGroup.add(arm, glass);
  }
  group.add(lanternsGroup);



  // 4. Virtual Projector Hardware Model & Projection Frustum Cone
  const projectorRig = new THREE.Group();

  // Rig Chassis
  const bodyGeo = new THREE.BoxGeometry(90, 50, 130);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1f242d,
    roughness: 0.4,
    metalness: 0.8,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);

  // Lens barrel
  const lensGeo = new THREE.CylinderGeometry(20, 24, 40, 24);
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.2,
    metalness: 0.9,
  });
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0, -75);

  // Emitter glass element with cyan emissive glow
  const glassGeo = new THREE.CircleGeometry(18, 24);
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.rotation.y = Math.PI;
  glass.position.set(0, 0, -96);

  // Mounting bracket
  const mountGeo = new THREE.CylinderGeometry(8, 8, 40, 12);
  const mountMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9 });
  const mount = new THREE.Mesh(mountGeo, mountMat);
  mount.position.set(0, 35, 0);

  projectorRig.add(body, lens, glass, mount);

  // Projection light cone wireframe (round spotlight beam, no 4-sided box pyramid)
  const coneGeo = new THREE.ConeGeometry(300, 1200, 24, 1, true);
  coneGeo.rotateX(-Math.PI / 2);
  coneGeo.translate(0, 0, -600);
  const coneEdges = new THREE.WireframeGeometry(coneGeo);
  const coneLineMat = new THREE.LineBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.25,
  });
  const projectorCone = new THREE.LineSegments(coneEdges, coneLineMat);
  projectorRig.add(projectorCone);

  group.add(projectorRig);

  return {
    group,
    facadeMesh,
    groundMesh,
    projectorRig,
    projectorCone,
    normalMapTexture,
  };
}
