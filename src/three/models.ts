import * as THREE from 'three';
import type { ArenaObstacle, WeaponId } from '../game/rules';

export interface SoldierRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  rightArm: THREE.Group;
  leftArm: THREE.Group;
  headGroup: THREE.Group;
  weaponMount: THREE.Group;
  muzzlePoint: THREE.Object3D;
  ejectPoint: THREE.Object3D;
  visorMesh: THREE.Mesh;
  hitFlashMeshes: THREE.Mesh[];
  setWeapon: (weaponId: WeaponId) => void;
  setHitFlash: (active: boolean) => void;
}

// Sculpted armor vest plate geometry (beveled chest rig)
function createArmorPlateGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.19, -0.2);
  s.lineTo(0.19, -0.2);
  s.lineTo(0.22, 0.08);
  s.lineTo(0.14, 0.21);
  s.lineTo(-0.14, 0.21);
  s.lineTo(-0.22, 0.08);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

// Curved AK-47 magazine geometry
function createCurvedMagGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.032, 0);
  s.lineTo(0.032, 0);
  s.quadraticCurveTo(0.055, -0.11, 0.095, -0.21);
  s.lineTo(0.035, -0.225);
  s.quadraticCurveTo(0.0, -0.12, -0.032, 0);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.004,
    bevelSegments: 1,
  });
  geo.translate(0, 0, -0.018);
  geo.rotateY(Math.PI / 2);
  return geo;
}

// Sculpted ballistic helmet shell via LatheGeometry (ordered bottom-to-top for outward normals)
function createHelmetGeometry(): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(0.142, -0.095),
    new THREE.Vector2(0.172, -0.075),
    new THREE.Vector2(0.182, -0.01),
    new THREE.Vector2(0.168, 0.075),
    new THREE.Vector2(0.112, 0.145),
    new THREE.Vector2(0.0, 0.165),
  ];
  return new THREE.LatheGeometry(pts, 20);
}

// Real pointed spire-point 3D rifle/SMG bullet slug geometry (pointing along +Z)
export function createBulletProjectileGeometry(): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(0.0, -0.09), // boat-tail base
    new THREE.Vector2(0.022, -0.075),
    new THREE.Vector2(0.024, 0.01), // cylindrical shank
    new THREE.Vector2(0.018, 0.055), // ogive taper
    new THREE.Vector2(0.004, 0.095), // spire tip
    new THREE.Vector2(0.0, 0.105),
  ];
  const geo = new THREE.LatheGeometry(pts, 10);
  geo.rotateX(Math.PI / 2); // Align tip to +Z so quaternion lookAt aligns directly
  return geo;
}

const sharedGeo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  capsule: new THREE.CapsuleGeometry(0.5, 0.7, 6, 12),
  sphere: new THREE.SphereGeometry(0.5, 16, 12),
  visorArc: new THREE.CylinderGeometry(0.168, 0.168, 0.068, 16, 1, true, Math.PI * 0.68, Math.PI * 0.64),
  armorPlate: createArmorPlateGeometry(),
  curvedMag: createCurvedMagGeometry(),
  helmet: createHelmetGeometry(),
  shadowDisc: new THREE.CircleGeometry(0.72, 24),
};

export function buildWeaponMesh(weaponId: WeaponId): THREE.Group {
  const group = new THREE.Group();
  const gunSteel = new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.28, metalness: 0.88 });
  const darkPolymer = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72, metalness: 0.18 });
  const chromeBolt = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.2, metalness: 0.94 });
  const woodStockMat = new THREE.MeshStandardMaterial({ color: 0x7c3f1d, roughness: 0.62, metalness: 0.06 });
  const sniperChassisMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.55, metalness: 0.22 });
  const opticGlassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
    roughness: 0.08,
    metalness: 0.95,
  });

  // Pistol grip (shared across modern firearms)
  const grip = new THREE.Mesh(sharedGeo.box, darkPolymer);
  grip.scale.set(0.042, 0.125, 0.055);
  grip.position.set(0, -0.075, 0.09);
  grip.rotation.x = 0.28;
  group.add(grip);

  // Trigger guard loop
  const tGuard = new THREE.Mesh(sharedGeo.box, gunSteel);
  tGuard.scale.set(0.022, 0.04, 0.065);
  tGuard.position.set(0, -0.045, 0.035);
  group.add(tGuard);

  if (weaponId === 'ak47') {
    // Stamped steel receiver
    const receiver = new THREE.Mesh(sharedGeo.box, gunSteel);
    receiver.scale.set(0.068, 0.095, 0.34);
    receiver.position.set(0, 0.01, -0.02);
    receiver.castShadow = true;
    group.add(receiver);

    // Chrome bolt carrier on right side
    const bolt = new THREE.Mesh(sharedGeo.box, chromeBolt);
    bolt.scale.set(0.02, 0.024, 0.11);
    bolt.position.set(0.032, 0.026, -0.02);
    group.add(bolt);

    // Laminated wood handguard
    const handguard = new THREE.Mesh(sharedGeo.box, woodStockMat);
    handguard.scale.set(0.062, 0.078, 0.22);
    handguard.position.set(0, 0.008, -0.29);
    group.add(handguard);

    // Wooden buttstock
    const stock = new THREE.Mesh(sharedGeo.box, woodStockMat);
    stock.scale.set(0.058, 0.105, 0.27);
    stock.position.set(0, -0.015, 0.27);
    stock.rotation.x = 0.08;
    group.add(stock);

    // Upper gas tube & long fluted barrel + slanted compensator
    const gasTube = new THREE.Mesh(sharedGeo.cyl, gunSteel);
    gasTube.rotation.x = Math.PI / 2;
    gasTube.scale.set(0.028, 0.23, 0.028);
    gasTube.position.set(0, 0.042, -0.3);
    group.add(gasTube);

    const barrel = new THREE.Mesh(sharedGeo.cyl, gunSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.scale.set(0.026, 0.44, 0.026);
    barrel.position.set(0, 0.018, -0.44);
    group.add(barrel);

    const comp = new THREE.Mesh(sharedGeo.cyl, gunSteel);
    comp.rotation.x = Math.PI / 2;
    comp.scale.set(0.034, 0.06, 0.034);
    comp.position.set(0, 0.018, -0.66);
    group.add(comp);

    // Front sight hood & curved banana magazine
    const fSight = new THREE.Mesh(sharedGeo.box, gunSteel);
    fSight.scale.set(0.02, 0.055, 0.022);
    fSight.position.set(0, 0.052, -0.56);
    group.add(fSight);

    const curvedMag = new THREE.Mesh(sharedGeo.curvedMag, darkPolymer);
    curvedMag.position.set(0, -0.025, -0.11);
    group.add(curvedMag);
  } else if (weaponId === 'mp40') {
    const receiver = new THREE.Mesh(sharedGeo.cyl, gunSteel);
    receiver.rotation.x = Math.PI / 2;
    receiver.scale.set(0.065, 0.34, 0.065);
    receiver.position.set(0, 0.015, -0.05);
    receiver.castShadow = true;
    group.add(receiver);

    const shroud = new THREE.Mesh(sharedGeo.cyl, darkPolymer);
    shroud.rotation.x = Math.PI / 2;
    shroud.scale.set(0.052, 0.24, 0.052);
    shroud.position.set(0, 0.015, -0.28);
    group.add(shroud);

    const barrel = new THREE.Mesh(sharedGeo.cyl, gunSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.scale.set(0.024, 0.26, 0.024);
    barrel.position.set(0, 0.015, -0.44);
    group.add(barrel);

    // Straight vertical SMG magazine
    const mag = new THREE.Mesh(sharedGeo.box, darkPolymer);
    mag.scale.set(0.034, 0.24, 0.046);
    mag.position.set(0, -0.13, -0.15);
    mag.rotation.x = 0.08;
    group.add(mag);

    // Tactical compact reflex red-dot optic
    const opticBase = new THREE.Mesh(sharedGeo.box, gunSteel);
    opticBase.scale.set(0.042, 0.038, 0.09);
    opticBase.position.set(0, 0.068, -0.04);
    group.add(opticBase);

    const opticLens = new THREE.Mesh(sharedGeo.cyl, opticGlassMat);
    opticLens.rotation.x = Math.PI / 2;
    opticLens.scale.set(0.032, 0.01, 0.032);
    opticLens.position.set(0, 0.072, -0.086);
    group.add(opticLens);

    // Folding wire stock
    const stockBar = new THREE.Mesh(sharedGeo.box, gunSteel);
    stockBar.scale.set(0.024, 0.028, 0.24);
    stockBar.position.set(0, -0.005, 0.22);
    group.add(stockBar);
  } else if (weaponId === 'm1887') {
    const receiver = new THREE.Mesh(sharedGeo.box, gunSteel);
    receiver.scale.set(0.066, 0.09, 0.28);
    receiver.position.set(0, 0.01, -0.02);
    receiver.castShadow = true;
    group.add(receiver);

    // Dual stacked heavy shotgun barrels
    const upperBarrel = new THREE.Mesh(sharedGeo.cyl, gunSteel);
    upperBarrel.rotation.x = Math.PI / 2;
    upperBarrel.scale.set(0.034, 0.56, 0.034);
    upperBarrel.position.set(0, 0.036, -0.4);
    group.add(upperBarrel);

    const lowerTube = new THREE.Mesh(sharedGeo.cyl, gunSteel);
    lowerTube.rotation.x = Math.PI / 2;
    lowerTube.scale.set(0.03, 0.52, 0.03);
    lowerTube.position.set(0, 0.004, -0.38);
    group.add(lowerTube);

    // Walnut forend + buttstock
    const forend = new THREE.Mesh(sharedGeo.box, woodStockMat);
    forend.scale.set(0.062, 0.06, 0.24);
    forend.position.set(0, -0.012, -0.3);
    group.add(forend);

    const stock = new THREE.Mesh(sharedGeo.box, woodStockMat);
    stock.scale.set(0.056, 0.11, 0.26);
    stock.position.set(0, -0.028, 0.23);
    stock.rotation.x = 0.14;
    group.add(stock);

    // Brass ejection port accent
    const port = new THREE.Mesh(sharedGeo.box, chromeBolt);
    port.scale.set(0.012, 0.028, 0.08);
    port.position.set(0.032, 0.026, -0.03);
    group.add(port);
  } else {
    // AWM Striker Precision Sniper Rifle
    const chassis = new THREE.Mesh(sharedGeo.box, sniperChassisMat);
    chassis.scale.set(0.072, 0.105, 0.66);
    chassis.position.set(0, 0.005, -0.06);
    chassis.castShadow = true;
    group.add(chassis);

    const barrel = new THREE.Mesh(sharedGeo.cyl, gunSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.scale.set(0.032, 0.64, 0.032);
    barrel.position.set(0, 0.032, -0.58);
    group.add(barrel);

    // Heavy slotted sniper muzzle brake
    const brake = new THREE.Mesh(sharedGeo.box, gunSteel);
    brake.scale.set(0.056, 0.05, 0.11);
    brake.position.set(0, 0.032, -0.92);
    group.add(brake);

    // Precision variable sniper scope + Picatinny rings + glass lens
    const scopeTube = new THREE.Mesh(sharedGeo.cyl, gunSteel);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.scale.set(0.044, 0.34, 0.044);
    scopeTube.position.set(0, 0.105, -0.04);
    group.add(scopeTube);

    const scopeBell = new THREE.Mesh(sharedGeo.cyl, gunSteel);
    scopeBell.rotation.x = Math.PI / 2;
    scopeBell.scale.set(0.062, 0.1, 0.062);
    scopeBell.position.set(0, 0.105, -0.22);
    group.add(scopeBell);

    const lens = new THREE.Mesh(sharedGeo.cyl, opticGlassMat);
    lens.rotation.x = Math.PI / 2;
    lens.scale.set(0.054, 0.01, 0.054);
    lens.position.set(0, 0.105, -0.272);
    group.add(lens);

    // Folded front bipod
    const bipodL = new THREE.Mesh(sharedGeo.cyl, gunSteel);
    bipodL.rotation.x = Math.PI / 2;
    bipodL.scale.set(0.018, 0.22, 0.018);
    bipodL.position.set(-0.042, -0.04, -0.45);
    group.add(bipodL);

    const bipodR = new THREE.Mesh(sharedGeo.cyl, gunSteel);
    bipodR.rotation.x = Math.PI / 2;
    bipodR.scale.set(0.018, 0.22, 0.018);
    bipodR.position.set(0.042, -0.04, -0.45);
    group.add(bipodR);

    // Box magazine & cheek riser stock
    const mag = new THREE.Mesh(sharedGeo.box, darkPolymer);
    mag.scale.set(0.042, 0.11, 0.095);
    mag.position.set(0, -0.08, -0.1);
    group.add(mag);

    const stock = new THREE.Mesh(sharedGeo.box, sniperChassisMat);
    stock.scale.set(0.06, 0.12, 0.28);
    stock.position.set(0, -0.008, 0.34);
    group.add(stock);
  }

  return group;
}

export function buildSoldierModel(
  teamColor: number,
  accentColor: number,
  initialWeapon: WeaponId,
  contactShadowTex: THREE.Texture,
): SoldierRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const hitFlashMeshes: THREE.Mesh[] = [];

  // Grounding contact shadow disc at y = 0.015
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(sharedGeo.shadowDisc, shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  // Realistic PBR material set: matte tactical cloth, carbon plate armor, natural skin, gunmetal buckles, specular visor
  const fatiguesMat = new THREE.MeshStandardMaterial({
    color: teamColor === 0x1d4ed8 ? 0x1e3a5f : 0x451a1a,
    roughness: 0.88,
    metalness: 0.05,
  });
  const teamPatchMat = new THREE.MeshStandardMaterial({
    color: teamColor,
    roughness: 0.62,
    metalness: 0.18,
  });
  const plateArmorMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.42,
    metalness: 0.55,
  });
  const buckleMetalMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.85,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd19f78,
    roughness: 0.72,
    metalness: 0.04,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.65,
    metalness: 0.15,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.45,
    roughness: 0.12,
    metalness: 0.92,
    side: THREE.DoubleSide,
  });

  // Articulated Legs (Hip -> Thigh -> Knee Pad -> Shin -> Tactical Boot)
  const makeLeg = (offsetX: number) => {
    const hip = new THREE.Group();
    hip.position.set(offsetX, 0.82, 0);

    const thigh = new THREE.Mesh(sharedGeo.capsule, fatiguesMat.clone());
    thigh.scale.set(0.165, 0.24, 0.175);
    thigh.position.y = -0.21;
    thigh.castShadow = true;
    hip.add(thigh);
    hitFlashMeshes.push(thigh);

    // Holster / Thigh tactical strap on right thigh
    const strap = new THREE.Mesh(sharedGeo.cyl, buckleMetalMat);
    strap.scale.set(0.175, 0.05, 0.185);
    strap.position.y = -0.22;
    hip.add(strap);

    const knee = new THREE.Group();
    knee.position.set(0, -0.41, 0);
    hip.add(knee);

    const kneePad = new THREE.Mesh(sharedGeo.box, plateArmorMat.clone());
    kneePad.scale.set(0.12, 0.11, 0.09);
    kneePad.position.set(0, 0, -0.075);
    knee.add(kneePad);
    hitFlashMeshes.push(kneePad);

    const shin = new THREE.Mesh(sharedGeo.capsule, fatiguesMat.clone());
    shin.scale.set(0.135, 0.21, 0.145);
    shin.position.y = -0.17;
    shin.castShadow = true;
    knee.add(shin);
    hitFlashMeshes.push(shin);

    const boot = new THREE.Mesh(sharedGeo.box, gloveMat);
    boot.scale.set(0.15, 0.13, 0.25);
    boot.position.set(0, -0.35, -0.045);
    boot.castShadow = true;
    knee.add(boot);

    return { hip, knee };
  };

  const leftLegObj = makeLeg(-0.135);
  const rightLegObj = makeLeg(0.135);
  const leftLeg = leftLegObj.hip;
  const rightLeg = rightLegObj.hip;
  const leftKnee = leftLegObj.knee;
  const rightKnee = rightLegObj.knee;
  bodyGroup.add(leftLeg, rightLeg);

  // Pelvis + Tactical Utility Belt + Mag Pouches
  const pelvis = new THREE.Mesh(sharedGeo.capsule, fatiguesMat.clone());
  pelvis.scale.set(0.36, 0.16, 0.24);
  pelvis.rotation.z = Math.PI / 2;
  pelvis.position.set(0, 0.84, 0);
  bodyGroup.add(pelvis);

  const belt = new THREE.Mesh(sharedGeo.box, buckleMetalMat);
  belt.scale.set(0.45, 0.075, 0.28);
  belt.position.set(0, 0.88, 0);
  bodyGroup.add(belt);

  // Waist side ammo pouches
  [-0.22, 0.22].forEach((px) => {
    const pouch = new THREE.Mesh(sharedGeo.box, plateArmorMat.clone());
    pouch.scale.set(0.08, 0.11, 0.13);
    pouch.position.set(px, 0.89, -0.02);
    bodyGroup.add(pouch);
  });

  // Tapered Torso + Sculpted Plate Carrier Armor Front/Back + Team Chest Chevron
  const torso = new THREE.Mesh(sharedGeo.capsule, fatiguesMat.clone());
  torso.scale.set(0.41, 0.36, 0.27);
  torso.position.set(0, 1.15, 0);
  torso.castShadow = true;
  bodyGroup.add(torso);
  hitFlashMeshes.push(torso);

  const frontPlate = new THREE.Mesh(sharedGeo.armorPlate, plateArmorMat.clone());
  frontPlate.position.set(0, 1.18, -0.125);
  frontPlate.castShadow = true;
  bodyGroup.add(frontPlate);
  hitFlashMeshes.push(frontPlate);

  const backPlate = new THREE.Mesh(sharedGeo.armorPlate, plateArmorMat.clone());
  backPlate.position.set(0, 1.18, 0.12);
  backPlate.castShadow = true;
  bodyGroup.add(backPlate);
  hitFlashMeshes.push(backPlate);

  // Team insignia chest band & shoulder pauldrons
  const teamBand = new THREE.Mesh(sharedGeo.box, teamPatchMat.clone());
  teamBand.scale.set(0.28, 0.048, 0.02);
  teamBand.position.set(0, 1.24, -0.17);
  bodyGroup.add(teamBand);

  [-0.24, 0.24].forEach((sx) => {
    const pauldron = new THREE.Mesh(sharedGeo.box, teamPatchMat.clone());
    pauldron.scale.set(0.11, 0.12, 0.2);
    pauldron.position.set(sx, 1.34, 0);
    pauldron.rotation.z = sx < 0 ? 0.22 : -0.22;
    bodyGroup.add(pauldron);
    hitFlashMeshes.push(pauldron);
  });

  // Tactical Radio Pack + Whip Antenna
  const pack = new THREE.Mesh(sharedGeo.box, plateArmorMat.clone());
  pack.scale.set(0.27, 0.32, 0.14);
  pack.position.set(0, 1.17, 0.21);
  pack.castShadow = true;
  bodyGroup.add(pack);
  hitFlashMeshes.push(pack);

  const antenna = new THREE.Mesh(sharedGeo.cyl, buckleMetalMat);
  antenna.scale.set(0.015, 0.36, 0.015);
  antenna.position.set(-0.1, 1.46, 0.24);
  bodyGroup.add(antenna);

  // Head + Tactical Balaclava + Ballistic Helmet + Rear Nape Guard + Comms Headset + Visor
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.46, 0);
  bodyGroup.add(headGroup);

  const neck = new THREE.Mesh(sharedGeo.cyl, gloveMat);
  neck.scale.set(0.12, 0.15, 0.12);
  neck.position.set(0, 0.02, 0);
  headGroup.add(neck);

  // Upper face/cheek subtle skin tone + lower tactical balaclava mask
  const head = new THREE.Mesh(sharedGeo.sphere, skinMat);
  head.scale.set(0.225, 0.255, 0.24);
  head.position.set(0, 0.14, -0.012);
  head.castShadow = true;
  headGroup.add(head);

  const balaclavaBack = new THREE.Mesh(sharedGeo.sphere, gloveMat);
  balaclavaBack.scale.set(0.236, 0.258, 0.245);
  balaclavaBack.position.set(0, 0.132, 0.014);
  balaclavaBack.castShadow = true;
  headGroup.add(balaclavaBack);

  const faceMask = new THREE.Mesh(sharedGeo.cyl, gloveMat);
  faceMask.scale.set(0.125, 0.095, 0.132);
  faceMask.position.set(0, 0.09, -0.005);
  headGroup.add(faceMask);

  // Tactical ballistic helmet shell (Kevlar dome + rear nape protector)
  const helmet = new THREE.Mesh(sharedGeo.helmet, plateArmorMat.clone());
  helmet.position.set(0, 0.19, 0.004);
  helmet.castShadow = true;
  headGroup.add(helmet);
  hitFlashMeshes.push(helmet);

  // Rear ballistic helmet counterweight / strobe pouch & team strip on back of helmet
  const rearStrobe = new THREE.Mesh(sharedGeo.box, teamPatchMat.clone());
  rearStrobe.scale.set(0.08, 0.045, 0.035);
  rearStrobe.position.set(0, 0.2, 0.17);
  headGroup.add(rearStrobe);

  // NVG front mount bracket
  const nvgMount = new THREE.Mesh(sharedGeo.box, buckleMetalMat);
  nvgMount.scale.set(0.075, 0.055, 0.045);
  nvgMount.position.set(0, 0.245, -0.165);
  headGroup.add(nvgMount);

  // Ear comms headset cups + headband arch
  [-0.138, 0.138].forEach((ex) => {
    const earCup = new THREE.Mesh(sharedGeo.cyl, buckleMetalMat);
    earCup.rotation.z = Math.PI / 2;
    earCup.scale.set(0.085, 0.048, 0.095);
    earCup.position.set(ex, 0.145, 0.01);
    headGroup.add(earCup);
  });

  // Curved ballistic wrap-around combat visor
  const visorMesh = new THREE.Mesh(sharedGeo.visorArc, visorMat);
  visorMesh.position.set(0, 0.165, -0.01);
  headGroup.add(visorMesh);

  // Articulated Right Shooting Arm + Shoulder + Forearm + Glove + Weapon Mount
  const rightArm = new THREE.Group();
  rightArm.position.set(0.27, 1.32, 0);
  bodyGroup.add(rightArm);

  const rUpper = new THREE.Mesh(sharedGeo.capsule, fatiguesMat.clone());
  rUpper.scale.set(0.115, 0.18, 0.115);
  rUpper.rotation.x = Math.PI * 0.42;
  rUpper.position.set(0, -0.06, -0.12);
  rUpper.castShadow = true;
  rightArm.add(rUpper);
  hitFlashMeshes.push(rUpper);

  const rForearm = new THREE.Mesh(sharedGeo.capsule, fatiguesMat.clone());
  rForearm.scale.set(0.1, 0.18, 0.1);
  rForearm.rotation.x = Math.PI * 0.5;
  rForearm.position.set(-0.04, -0.1, -0.32);
  rForearm.rotation.y = 0.2;
  rightArm.add(rForearm);
  hitFlashMeshes.push(rForearm);

  const rGlove = new THREE.Mesh(sharedGeo.box, gloveMat);
  rGlove.scale.set(0.07, 0.075, 0.085);
  rGlove.position.set(-0.06, -0.1, -0.44);
  rightArm.add(rGlove);

  const weaponMount = new THREE.Group();
  weaponMount.position.set(-0.06, -0.06, -0.5);
  rightArm.add(weaponMount);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.025, -0.72);
  weaponMount.add(muzzlePoint);

  const ejectPoint = new THREE.Object3D();
  ejectPoint.position.set(0.05, 0.03, -0.03);
  weaponMount.add(ejectPoint);

  // Articulated Left Support Arm reaching cleanly across chest onto rifle forend
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.27, 1.31, 0);
  bodyGroup.add(leftArm);

  const lUpper = new THREE.Mesh(sharedGeo.capsule, fatiguesMat.clone());
  lUpper.scale.set(0.11, 0.18, 0.11);
  lUpper.rotation.x = Math.PI * 0.36;
  lUpper.rotation.z = -0.25;
  lUpper.position.set(0.05, -0.08, -0.14);
  lUpper.castShadow = true;
  leftArm.add(lUpper);
  hitFlashMeshes.push(lUpper);

  const lForearm = new THREE.Mesh(sharedGeo.capsule, fatiguesMat.clone());
  lForearm.scale.set(0.095, 0.19, 0.095);
  lForearm.rotation.x = Math.PI * 0.48;
  lForearm.rotation.y = -0.62;
  lForearm.position.set(0.16, -0.11, -0.36);
  leftArm.add(lForearm);

  const lGlove = new THREE.Mesh(sharedGeo.box, gloveMat);
  lGlove.scale.set(0.068, 0.07, 0.08);
  lGlove.position.set(0.24, -0.1, -0.54);
  leftArm.add(lGlove);

  hitFlashMeshes.forEach((m) => {
    const mat = m.material as THREE.MeshStandardMaterial;
    m.userData.origEmissive = mat.emissive.getHex();
  });

  let activeWeaponMesh = buildWeaponMesh(initialWeapon);
  weaponMount.add(activeWeaponMesh);

  return {
    root,
    bodyGroup,
    leftLeg,
    rightLeg,
    leftKnee,
    rightKnee,
    rightArm,
    leftArm,
    headGroup,
    weaponMount,
    muzzlePoint,
    ejectPoint,
    visorMesh,
    hitFlashMeshes,
    setWeapon: (weaponId: WeaponId) => {
      weaponMount.remove(activeWeaponMesh);
      activeWeaponMesh = buildWeaponMesh(weaponId);
      weaponMount.add(activeWeaponMesh);
    },
    setHitFlash: (active: boolean) => {
      for (let i = 0; i < hitFlashMeshes.length; i++) {
        const m = hitFlashMeshes[i];
        const mat = m.material as THREE.MeshStandardMaterial;
        if (active) {
          mat.emissive.setHex(0xffffff);
          mat.emissiveIntensity = 0.72;
        } else {
          mat.emissive.setHex(m.userData.origEmissive ?? 0x000000);
          mat.emissiveIntensity = 0;
        }
      }
    },
  };
}

export function buildArenaObstacleMesh(
  obs: ArenaObstacle,
  containerBump: THREE.Texture,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(obs.x, obs.y, obs.z);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.7 });

  if (obs.kind === 'container') {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: obs.color,
      roughness: 0.65,
      metalness: 0.35,
      bumpMap: containerBump,
      bumpScale: 0.08,
    });
    const hull = new THREE.Mesh(sharedGeo.box, bodyMat);
    hull.scale.set(obs.w - 0.14, obs.h - 0.16, obs.d - 0.14);
    hull.position.y = obs.h * 0.5;
    hull.castShadow = true;
    hull.receiveShadow = true;
    group.add(hull);

    const postOffsets = [
      [-obs.w * 0.5 + 0.08, -obs.d * 0.5 + 0.08],
      [obs.w * 0.5 - 0.08, -obs.d * 0.5 + 0.08],
      [-obs.w * 0.5 + 0.08, obs.d * 0.5 - 0.08],
      [obs.w * 0.5 - 0.08, obs.d * 0.5 - 0.08],
    ];
    for (const [px, pz] of postOffsets) {
      const post = new THREE.Mesh(sharedGeo.box, frameMat);
      post.scale.set(0.18, obs.h, 0.18);
      post.position.set(px, obs.h * 0.5, pz);
      post.castShadow = true;
      group.add(post);
    }

    const topCap = new THREE.Mesh(sharedGeo.box, frameMat);
    topCap.scale.set(obs.w, 0.12, obs.d);
    topCap.position.y = obs.h - 0.06;
    group.add(topCap);
  } else if (obs.kind === 'bunker') {
    const bagMat = new THREE.MeshStandardMaterial({ color: obs.color, roughness: 0.92, metalness: 0.02 });
    const base = new THREE.Mesh(sharedGeo.box, frameMat);
    base.scale.set(obs.w, 0.25, obs.d);
    base.position.y = 0.125;
    base.receiveShadow = true;
    group.add(base);

    const cols = 4;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < cols; c++) {
        const bag = new THREE.Mesh(sharedGeo.box, bagMat);
        bag.scale.set(obs.w / cols - 0.08, 0.45, obs.d * 0.88);
        bag.position.set(
          -obs.w * 0.5 + (c + 0.5) * (obs.w / cols),
          0.46 + r * 0.44,
          r === 1 ? 0.04 : -0.04,
        );
        bag.castShadow = true;
        bag.receiveShadow = true;
        group.add(bag);
      }
    }
  } else if (obs.kind === 'tower') {
    const steelMat = new THREE.MeshStandardMaterial({ color: obs.color, roughness: 0.5, metalness: 0.72 });
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    const plinth = new THREE.Mesh(sharedGeo.box, frameMat);
    plinth.scale.set(obs.w, 0.4, obs.d);
    plinth.position.y = 0.2;
    plinth.receiveShadow = true;
    group.add(plinth);

    const core = new THREE.Mesh(sharedGeo.box, steelMat);
    core.scale.set(obs.w * 0.72, obs.h - 0.8, obs.d * 0.72);
    core.position.y = obs.h * 0.5;
    core.castShadow = true;
    core.receiveShadow = true;
    group.add(core);

    const deck = new THREE.Mesh(sharedGeo.box, frameMat);
    deck.scale.set(obs.w + 0.4, 0.28, obs.d + 0.4);
    deck.position.y = obs.h - 0.5;
    deck.castShadow = true;
    group.add(deck);

    const mast = new THREE.Mesh(sharedGeo.cyl, steelMat);
    mast.scale.set(0.16, 1.4, 0.16);
    mast.position.y = obs.h + 0.3;
    group.add(mast);

    const beacon = new THREE.Mesh(sharedGeo.sphere, beaconMat);
    beacon.scale.set(0.32, 0.32, 0.32);
    beacon.position.y = obs.h + 1.05;
    group.add(beacon);
  } else if (obs.kind === 'crate') {
    const woodMat = new THREE.MeshStandardMaterial({ color: obs.color, roughness: 0.88, metalness: 0.05 });
    const body = new THREE.Mesh(sharedGeo.box, woodMat);
    body.scale.set(obs.w - 0.08, obs.h - 0.08, obs.d - 0.08);
    body.position.y = obs.h * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const band = new THREE.Mesh(sharedGeo.box, frameMat);
    band.scale.set(obs.w, 0.2, obs.d);
    band.position.y = obs.h * 0.5;
    group.add(band);

    const lid = new THREE.Mesh(sharedGeo.box, frameMat);
    lid.scale.set(obs.w * 0.96, 0.12, obs.d * 0.96);
    lid.position.y = obs.h - 0.06;
    group.add(lid);
  } else {
    const concreteMat = new THREE.MeshStandardMaterial({ color: obs.color, roughness: 0.85, metalness: 0.1 });
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5, metalness: 0.2 });
    const base = new THREE.Mesh(sharedGeo.box, frameMat);
    base.scale.set(obs.w + 0.2, 0.35, obs.d + 0.2);
    base.position.y = 0.175;
    group.add(base);

    const col = new THREE.Mesh(sharedGeo.box, concreteMat);
    col.scale.set(obs.w, obs.h - 0.5, obs.d);
    col.position.y = obs.h * 0.5 + 0.1;
    col.castShadow = true;
    col.receiveShadow = true;
    group.add(col);

    const stripe = new THREE.Mesh(sharedGeo.box, hazardMat);
    stripe.scale.set(obs.w + 0.05, 0.26, obs.d + 0.05);
    stripe.position.y = 1.25;
    group.add(stripe);
  }

  return group;
}

export function buildGlooShieldMesh(teamColor: number): THREE.Group {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.8 });
  const shieldMat = new THREE.MeshStandardMaterial({
    color: teamColor,
    emissive: teamColor,
    emissiveIntensity: 0.35,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });

  const emitter = new THREE.Mesh(sharedGeo.box, baseMat);
  emitter.scale.set(3.2, 0.22, 0.45);
  emitter.position.y = 0.11;
  group.add(emitter);

  const wall = new THREE.Mesh(sharedGeo.box, shieldMat);
  wall.scale.set(3.1, 2.05, 0.24);
  wall.position.y = 1.2;
  group.add(wall);

  const leftFin = new THREE.Mesh(sharedGeo.box, baseMat);
  leftFin.scale.set(0.18, 2.1, 0.38);
  leftFin.position.set(-1.55, 1.05, 0);
  group.add(leftFin);

  const rightFin = new THREE.Mesh(sharedGeo.box, baseMat);
  rightFin.scale.set(0.18, 2.1, 0.38);
  rightFin.position.set(1.55, 1.05, 0);
  group.add(rightFin);

  return group;
}
