import * as THREE from 'three';
import type { ArenaObstacle, WeaponId } from '../game/rules';

export interface SoldierRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  rightArm: THREE.Group;
  leftArm: THREE.Group;
  headGroup: THREE.Group;
  weaponMount: THREE.Group;
  muzzlePoint: THREE.Object3D;
  visorMesh: THREE.Mesh;
  hitFlashMeshes: THREE.Mesh[];
  setWeapon: (weaponId: WeaponId) => void;
  setHitFlash: (active: boolean) => void;
}

const sharedGeo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  sphere: new THREE.SphereGeometry(0.5, 12, 10),
  shadowDisc: new THREE.CircleGeometry(0.68, 20),
};

export function buildWeaponMesh(weaponId: WeaponId): THREE.Group {
  const group = new THREE.Group();
  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.85 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: weaponId === 'mp40' ? 0xf59e0b : weaponId === 'ak47' ? 0xb45309 : weaponId === 'm1887' ? 0x38bdf8 : 0x16a34a,
    roughness: 0.5,
    metalness: 0.4,
  });

  // 1. Receiver
  const receiver = new THREE.Mesh(sharedGeo.box, gunMetal);
  receiver.scale.set(0.08, 0.11, weaponId === 'awm' ? 0.56 : weaponId === 'mp40' ? 0.34 : 0.44);
  receiver.castShadow = true;
  group.add(receiver);

  // 2. Barrel
  const barrel = new THREE.Mesh(sharedGeo.cyl, gunMetal);
  barrel.rotation.x = Math.PI / 2;
  const barrelLen = weaponId === 'awm' ? 0.55 : weaponId === 'm1887' ? 0.42 : 0.32;
  barrel.scale.set(0.036, barrelLen, 0.036);
  barrel.position.set(0, 0.025, -(0.22 + barrelLen * 0.4));
  barrel.castShadow = true;
  group.add(barrel);

  // 3. Magazine / Foregrip accent
  const mag = new THREE.Mesh(sharedGeo.box, accentMat);
  mag.scale.set(0.055, weaponId === 'mp40' ? 0.22 : 0.16, 0.075);
  mag.position.set(0, -0.1, -0.05);
  mag.rotation.x = 0.22;
  group.add(mag);

  // 4. Stock or Scope
  if (weaponId === 'awm') {
    const scope = new THREE.Mesh(sharedGeo.cyl, accentMat);
    scope.rotation.x = Math.PI / 2;
    scope.scale.set(0.05, 0.26, 0.05);
    scope.position.set(0, 0.09, -0.02);
    group.add(scope);
  } else {
    const stock = new THREE.Mesh(sharedGeo.box, accentMat);
    stock.scale.set(0.065, 0.09, 0.22);
    stock.position.set(0, -0.01, 0.24);
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
    opacity: 0.55,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(sharedGeo.shadowDisc, shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  const suitMat = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.72, metalness: 0.12 });
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.65 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd6a57c, roughness: 0.8, metalness: 0.05 });
  const visorMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.85,
    roughness: 0.15,
    metalness: 0.9,
  });

  // Legs pivoted at hip y = 0.76
  const makeLeg = (offsetX: number) => {
    const hip = new THREE.Group();
    hip.position.set(offsetX, 0.76, 0);

    const thigh = new THREE.Mesh(sharedGeo.box, suitMat.clone());
    thigh.scale.set(0.18, 0.58, 0.2);
    thigh.position.y = -0.32;
    thigh.castShadow = true;
    hip.add(thigh);
    hitFlashMeshes.push(thigh);

    const boot = new THREE.Mesh(sharedGeo.box, armorMat.clone());
    boot.scale.set(0.2, 0.18, 0.28);
    boot.position.set(0, -0.67, -0.03);
    boot.castShadow = true;
    hip.add(boot);
    hitFlashMeshes.push(boot);

    return hip;
  };

  const leftLeg = makeLeg(-0.14);
  const rightLeg = makeLeg(0.14);
  bodyGroup.add(leftLeg, rightLeg);

  // Torso & armored vest
  const torso = new THREE.Mesh(sharedGeo.box, suitMat.clone());
  torso.scale.set(0.48, 0.58, 0.28);
  torso.position.set(0, 1.06, 0);
  torso.castShadow = true;
  bodyGroup.add(torso);
  hitFlashMeshes.push(torso);

  const vest = new THREE.Mesh(sharedGeo.box, armorMat.clone());
  vest.scale.set(0.52, 0.4, 0.33);
  vest.position.set(0, 1.1, 0);
  vest.castShadow = true;
  bodyGroup.add(vest);
  hitFlashMeshes.push(vest);

  // Tactical backpack
  const pack = new THREE.Mesh(sharedGeo.box, armorMat.clone());
  pack.scale.set(0.32, 0.36, 0.16);
  pack.position.set(0, 1.1, 0.22);
  pack.castShadow = true;
  bodyGroup.add(pack);

  // Head + tactical helmet + glowing visor
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.48, 0);
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(sharedGeo.sphere, skinMat);
  head.scale.set(0.29, 0.31, 0.29);
  head.castShadow = true;
  headGroup.add(head);

  const helmet = new THREE.Mesh(sharedGeo.sphere, armorMat.clone());
  helmet.scale.set(0.34, 0.28, 0.35);
  helmet.position.set(0, 0.05, 0.01);
  helmet.castShadow = true;
  headGroup.add(helmet);
  hitFlashMeshes.push(helmet);

  const visorMesh = new THREE.Mesh(sharedGeo.box, visorMat);
  visorMesh.scale.set(0.24, 0.08, 0.12);
  visorMesh.position.set(0, 0.02, -0.14);
  headGroup.add(visorMesh);

  // Arms + weapon mount
  const rightArm = new THREE.Group();
  rightArm.position.set(0.31, 1.28, 0);
  bodyGroup.add(rightArm);

  const rSleeve = new THREE.Mesh(sharedGeo.box, suitMat.clone());
  rSleeve.scale.set(0.14, 0.14, 0.44);
  rSleeve.position.set(0, -0.06, -0.18);
  rSleeve.castShadow = true;
  rightArm.add(rSleeve);
  hitFlashMeshes.push(rSleeve);

  const weaponMount = new THREE.Group();
  weaponMount.position.set(-0.04, -0.08, -0.44);
  rightArm.add(weaponMount);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.03, -0.52);
  weaponMount.add(muzzlePoint);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.31, 1.26, 0);
  bodyGroup.add(leftArm);
  const lSleeve = new THREE.Mesh(sharedGeo.box, suitMat.clone());
  lSleeve.scale.set(0.13, 0.13, 0.42);
  lSleeve.position.set(0.12, -0.1, -0.2);
  lSleeve.rotation.y = -0.45;
  lSleeve.castShadow = true;
  leftArm.add(lSleeve);

  // Store original emissive colors for hit flash
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
    rightArm,
    leftArm,
    headGroup,
    weaponMount,
    muzzlePoint,
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
          mat.emissiveIntensity = 0.75;
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

    // 4 Corner steel posts + roof/base rails
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
    // Pillar
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
