import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type {
  MatchRoomDoc,
  RoomEventDoc,
  RoomParticipantDoc,
} from '../firebase/matchService';
import { soundEngine } from '../audio/soundEngine';
import {
  applyDamage,
  ARENA_HALF_EXTENT,
  ARENA_OBSTACLES,
  getDangerZoneRadius,
  getSpawnPoint,
  PLAYER_MAX_ARMOR,
  PLAYER_MAX_HP,
  PLAYER_RADIUS,
  rayIntersectsBox,
  rayIntersectsTargetCylinder,
  resolveCircleBoxCollisions,
  resolveRoundOutcome,
  ROUND_DURATION_SEC,
  TARGET_ROUNDS,
  WEAPONS,
  type DynamicBox,
  type GameMode,
  type TeamId,
  type WeaponId,
} from '../game/rules';
import {
  buildArenaObstacleMesh,
  buildGlooShieldMesh,
  buildSoldierModel,
  createBulletProjectileGeometry,
  type SoldierRig,
} from './models';
import { createArenaTextures, type ArenaTextures } from './textures';

// Pre-allocated module-scope scratch objects (Zero GC inside render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _camGoal = new THREE.Vector3();
const _lookGoal = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export interface HudSnapshot {
  mode: 'tour' | 'offline' | 'online' | 'spectate';
  state: 'title' | 'lobby' | 'loadout' | 'playing' | 'round_end' | 'paused' | 'gameover';
  roundNumber: number;
  scoreA: number;
  scoreB: number;
  roundTimeLeft: number;
  roundWinner: '' | 'A' | 'B' | 'draw';
  matchWinner: '' | 'A' | 'B';
  myTeam: TeamId;
  hp: number;
  armor: number;
  weaponId: WeaponId;
  ammo: number;
  maxAmmo: number;
  reloading: boolean;
  glooCount: number;
  isAds: boolean;
  hitMarker: 'none' | 'body' | 'head';
  dangerZoneRadius: number;
  outsideZone: boolean;
  kills: number;
  damageDealt: number;
  spectateTargetName: string;
  spectateTargets: { id: string; name: string; team: TeamId; hp: number; alive: boolean }[];
  killFeed: { id: string; text: string; isHeadshot: boolean }[];
  pointerLocked: boolean;
}

interface ActorRuntime {
  id: string;
  name: string;
  tag4: string;
  team: TeamId;
  slot: number;
  isBot: boolean;
  isLocal: boolean;
  rig: SoldierRig;
  x: number;
  y: number;
  z: number;
  vy: number;
  vx: number;
  vz: number;
  yaw: number;
  pitch: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetYaw: number;
  hp: number;
  armor: number;
  alive: boolean;
  weaponId: WeaponId;
  ammo: number;
  reloadingUntilMs: number;
  lastFireMs: number;
  glooCount: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  walkPhase: number;
  hitFlashTimer: number;
  koTimer: number;
  botStrafeDir: number;
  botDecisionTimer: number;
}

interface GlooBarrier {
  id: string;
  mesh: THREE.Group;
  box: DynamicBox;
  expiresAtMs: number;
}

interface TracerSlot {
  active: boolean;
  life: number;
  maxLife: number;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  length: number;
}

interface ParticleSlot {
  active: boolean;
  life: number;
  maxLife: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  scale: number;
  color: THREE.Color;
}

interface BulletSlot {
  active: boolean;
  life: number;
  maxLife: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  quat: THREE.Quaternion;
}

interface ShellSlot {
  active: boolean;
  life: number;
  maxLife: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rotX: number;
  rotZ: number;
}

interface MuzzleFlashSlot {
  active: boolean;
  life: number;
  maxLife: number;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: number;
}

export interface OnlineNetworkBridge {
  sendTransform: (state: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    vx: number;
    vz: number;
    weaponId: WeaponId;
    glooCount: number;
  }) => void;
  sendShotEvent: (ev: {
    type: 'shot' | 'hit' | 'gloo' | 'kill' | 'round_win';
    actorId: string;
    targetId: string;
    weaponId: string;
    ox: number;
    oy: number;
    oz: number;
    dx: number;
    dy: number;
    dz: number;
    damage: number;
    isHeadshot: boolean;
    roundNumber: number;
  }) => void;
  sendDamageUpdate: (
    targetId: string,
    patch: { hp: number; armor: number; alive: boolean; deaths?: number },
    attackerKills?: number,
    attackerDamage?: number,
  ) => void;
  sendRoomAdvance: (
    patch: Pick<
      MatchRoomDoc,
      'status' | 'roundNumber' | 'scoreA' | 'scoreB' | 'roundWinner' | 'matchWinner' | 'roundStartedAtMs'
    >,
  ) => void;
  resetParticipantsForRound: (participants: { id: string; team: TeamId; slot: number }[]) => void;
}

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class ArenaEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: ArenaTextures;
  private isSoftwareGl: boolean;
  private disposed = false;
  private frameId = 0;
  private lastFrameTime = performance.now();

  // Simulation state
  private mode: 'tour' | 'offline' | 'online' | 'spectate' = 'tour';
  private simState: HudSnapshot['state'] = 'title';
  private paused = false;
  private localId = 'local_player';
  private localName = 'Wolf';
  private localTag4 = '0001';
  private matchMode: GameMode = '1v1';
  private isHost = true;

  private roundNumber = 1;
  private scoreA = 0;
  private scoreB = 0;
  private roundTimer = 0;
  private roundEndCooldown = 0;
  private roundWinner: '' | 'A' | 'B' | 'draw' = '';
  private matchWinner: '' | 'A' | 'B' = '';

  private actors = new Map<string, ActorRuntime>();
  private glooBarriers: GlooBarrier[] = [];
  private staticBoxes: DynamicBox[] = ARENA_OBSTACLES.map((o) => ({
    x: o.x,
    y: o.y,
    z: o.z,
    w: o.w,
    h: o.h,
    d: o.d,
  }));

  // Danger Zone ring mesh
  private dangerRingMesh: THREE.Mesh;

  // Pooled InstancedMesh tracers, sparks, 3D bullets, brass shells & muzzle flash
  private tracerMesh: THREE.InstancedMesh;
  private tracers: TracerSlot[] = [];
  private tracerCursor = 0;

  private bulletMesh: THREE.InstancedMesh;
  private bullets: BulletSlot[] = [];
  private bulletCursor = 0;

  private shellMesh: THREE.InstancedMesh;
  private shells: ShellSlot[] = [];
  private shellCursor = 0;

  private muzzleFlashMesh: THREE.InstancedMesh;
  private muzzleFlashes: MuzzleFlashSlot[] = [];
  private muzzleCursor = 0;

  private sparkMesh: THREE.InstancedMesh;
  private sparks: ParticleSlot[] = [];
  private sparkCursor = 0;

  // Camera & Feel
  private camPos = new THREE.Vector3(0, 14, 34);
  private camLook = new THREE.Vector3(0, 1.5, 0);
  private camTrauma = 0;
  private hitstopTimer = 0;
  private tourAngle = 0;
  private hitMarkerType: 'none' | 'body' | 'head' = 'none';
  private hitMarkerTimer = 0;
  private footstepAccum = 0;

  // Spectator
  private spectateTargetId = '';
  private spectateYawOffset = 0;
  private spectatePitchOffset = 0.25;

  // Input state (continuous held + mobile touch)
  private keys = new Set<string>();
  private mouseFireHeld = false;
  private mouseAdsHeld = false;
  private dragAimActive = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerLocked = false;
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchFireHeld = false;

  // Network throttle
  private lastNetSyncMs = 0;
  private seenEventIds = new Set<string>();
  private networkBridge: OnlineNetworkBridge | null = null;
  private killFeed: { id: string; text: string; isHeadshot: boolean }[] = [];

  private onHudUpdate: (snap: HudSnapshot) => void;
  private lastHudEmitMs = 0;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, onHudUpdate: (snap: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.isSoftwareGl = detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = Math.max(320, container.clientWidth || window.innerWidth);
    const h = Math.max(240, container.clientHeight || window.innerHeight);
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x1b2638);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2(0x1b2638, 0.0085);

    this.camera = new THREE.PerspectiveCamera(68, w / h, 0.1, 260);
    this.camera.position.copy(this.camPos);

    // Studio IBL environment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.textures = createArenaTextures(this.renderer);
    this.buildLighting();
    this.buildArenaEnvironment();

    // Danger zone shrink ring
    const ringGeo = new THREE.CylinderGeometry(1, 1, 16, 48, 1, true);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.dangerRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.dangerRingMesh.position.y = 8;
    this.dangerRingMesh.visible = false;
    this.scene.add(this.dangerRingMesh);

    // Pooled tracer InstancedMesh (64 tracers)
    const tracerGeo = new THREE.BoxGeometry(0.032, 0.032, 1);
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.72 });
    this.tracerMesh = new THREE.InstancedMesh(tracerGeo, tracerMat, 64);
    this.tracerMesh.frustumCulled = false;
    this.scene.add(this.tracerMesh);
    for (let i = 0; i < 64; i++) {
      this.tracers.push({
        active: false,
        life: 0,
        maxLife: 0.08,
        pos: new THREE.Vector3(),
        quat: new THREE.Quaternion(),
        length: 1,
      });
      _mat4.makeScale(0, 0, 0);
      this.tracerMesh.setMatrixAt(i, _mat4);
    }
    this.tracerMesh.instanceMatrix.needsUpdate = true;

    // Pooled physical 3D brass/copper-jacketed pointed bullets (64 slots)
    const bulletGeo = createBulletProjectileGeometry();
    const bulletMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.92,
    });
    this.bulletMesh = new THREE.InstancedMesh(bulletGeo, bulletMat, 64);
    this.bulletMesh.frustumCulled = false;
    this.scene.add(this.bulletMesh);
    for (let i = 0; i < 64; i++) {
      this.bullets.push({
        active: false,
        life: 0,
        maxLife: 0.14,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        quat: new THREE.Quaternion(),
      });
      _mat4.makeScale(0, 0, 0);
      this.bulletMesh.setMatrixAt(i, _mat4);
    }
    this.bulletMesh.instanceMatrix.needsUpdate = true;

    // Pooled spinning ejected brass shell casings (64 slots)
    const shellGeo = new THREE.CylinderGeometry(0.016, 0.018, 0.075, 8);
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.25,
      metalness: 0.95,
    });
    this.shellMesh = new THREE.InstancedMesh(shellGeo, shellMat, 64);
    this.shellMesh.frustumCulled = false;
    this.scene.add(this.shellMesh);
    for (let i = 0; i < 64; i++) {
      this.shells.push({
        active: false,
        life: 0,
        maxLife: 0.85,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rotX: 0,
        rotZ: 0,
      });
      _mat4.makeScale(0, 0, 0);
      this.shellMesh.setMatrixAt(i, _mat4);
    }
    this.shellMesh.instanceMatrix.needsUpdate = true;

    // Pooled 3D muzzle flash starburst cones (24 slots)
    const flashGeo = new THREE.ConeGeometry(0.16, 0.42, 6);
    flashGeo.rotateX(Math.PI / 2);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.9,
    });
    this.muzzleFlashMesh = new THREE.InstancedMesh(flashGeo, flashMat, 24);
    this.muzzleFlashMesh.frustumCulled = false;
    this.scene.add(this.muzzleFlashMesh);
    for (let i = 0; i < 24; i++) {
      this.muzzleFlashes.push({
        active: false,
        life: 0,
        maxLife: 0.055,
        pos: new THREE.Vector3(),
        quat: new THREE.Quaternion(),
        scale: 1,
      });
      _mat4.makeScale(0, 0, 0);
      this.muzzleFlashMesh.setMatrixAt(i, _mat4);
    }
    this.muzzleFlashMesh.instanceMatrix.needsUpdate = true;

    // Pooled spark InstancedMesh (96 sparks)
    const sparkGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, 96);
    this.sparkMesh.frustumCulled = false;
    this.scene.add(this.sparkMesh);
    for (let i = 0; i < 96; i++) {
      this.sparks.push({
        active: false,
        life: 0,
        maxLife: 0.3,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        scale: 1,
        color: new THREE.Color(0xf59e0b),
      });
      _mat4.makeScale(0, 0, 0);
      this.sparkMesh.setMatrixAt(i, _mat4);
      this.sparkMesh.setColorAt(i, this.sparks[i].color);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;

    // Spawn showcase idle actors for live world tour
    this.setupTourActors();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    this.lastFrameTime = performance.now();
    this.renderer.render(this.scene, this.camera);
    this.scheduleNextTick();
  }

  private buildLighting(): void {
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x451a03, 0.85);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff1d6, 2.2);
    key.position.set(28, 42, 22);
    key.castShadow = !this.isSoftwareGl;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 5;
    key.shadow.camera.far = 110;
    key.shadow.camera.left = -40;
    key.shadow.camera.right = 40;
    key.shadow.camera.top = 40;
    key.shadow.camera.bottom = -40;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rim.position.set(-28, 18, -26);
    this.scene.add(rim);
  }

  private buildArenaEnvironment(): void {
    // Extended outer desert basin (no floating box in void!)
    const outerGeo = new THREE.PlaneGeometry(320, 320);
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0x2d2a26,
      roughness: 0.96,
      metalness: 0.04,
    });
    const outerGround = new THREE.Mesh(outerGeo, outerMat);
    outerGround.rotation.x = -Math.PI / 2;
    outerGround.position.y = -0.025;
    outerGround.receiveShadow = true;
    this.scene.add(outerGround);

    // Main playable concrete tactical yard (64m x 64m)
    const yardGeo = new THREE.PlaneGeometry(ARENA_HALF_EXTENT * 2, ARENA_HALF_EXTENT * 2);
    const yardMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.textures.groundColor,
      bumpMap: this.textures.groundBump,
      bumpScale: 0.04,
      roughness: 0.85,
      metalness: 0.08,
    });
    const yard = new THREE.Mesh(yardGeo, yardMat);
    yard.rotation.x = -Math.PI / 2;
    yard.position.y = 0;
    yard.receiveShadow = true;
    this.scene.add(yard);

    // Center tactical duel ring decal (offset by +0.02 to avoid Z-fighting)
    const decalGeo = new THREE.RingGeometry(4.6, 5.1, 48);
    const decalMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.48,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const decal = new THREE.Mesh(decalGeo, decalMat);
    decal.rotation.x = -Math.PI / 2;
    decal.position.y = 0.02;
    this.scene.add(decal);

    // Perimeter low retaining walls + rocky outcrops via InstancedMesh
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8, metalness: 0.2 });
    const wallGeo = new THREE.BoxGeometry(1, 1, 1);
    const walls = [
      { x: 0, z: -ARENA_HALF_EXTENT - 0.6, w: ARENA_HALF_EXTENT * 2 + 2.4, h: 2.2, d: 1.2 },
      { x: 0, z: ARENA_HALF_EXTENT + 0.6, w: ARENA_HALF_EXTENT * 2 + 2.4, h: 2.2, d: 1.2 },
      { x: -ARENA_HALF_EXTENT - 0.6, z: 0, w: 1.2, h: 2.2, d: ARENA_HALF_EXTENT * 2 },
      { x: ARENA_HALF_EXTENT + 0.6, z: 0, w: 1.2, h: 2.2, d: ARENA_HALF_EXTENT * 2 },
    ];
    for (const w of walls) {
      const m = new THREE.Mesh(wallGeo, wallMat);
      m.scale.set(w.w, w.h, w.d);
      m.position.set(w.x, w.h * 0.5, w.z);
      m.receiveShadow = true;
      m.castShadow = true;
      this.scene.add(m);
    }

    // Outer natural cliff/rock outcrops beyond playable perimeter (40 instanced jagged cliffs)
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x57534e,
      roughness: 0.94,
      metalness: 0.05,
      flatShading: true,
    });
    const rockCount = 40;
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    const rockColor = new THREE.Color();
    for (let i = 0; i < rockCount; i++) {
      const angle = (i / rockCount) * Math.PI * 2;
      const radius = 46 + (i % 5) * 9;
      const s = 3.2 + (i % 4) * 1.6;
      _v1.set(Math.cos(angle) * radius, s * 0.42, Math.sin(angle) * radius);
      _quat.setFromEuler(new THREE.Euler(0.18 * i, angle + 0.4, 0.12 * i));
      _scale.set(s * 1.45, s * 1.25, s * 0.85);
      _mat4.compose(_v1, _quat, _scale);
      rocks.setMatrixAt(i, _mat4);
      rockColor.setHex(i % 2 === 0 ? 0x57534e : 0x3f3a36);
      rocks.setColorAt(i, rockColor);
    }
    rocks.computeBoundingSphere();
    this.scene.add(rocks);

    // Arena tactical obstacles
    for (const obs of ARENA_OBSTACLES) {
      const mesh = buildArenaObstacleMesh(obs, this.textures.containerBump);
      this.scene.add(mesh);
    }
  }

  private setupTourActors(): void {
    this.clearActors();
    const spawnA = getSpawnPoint('A', 0);
    const spawnB = getSpawnPoint('B', 0);
    this.spawnActor({
      id: 'tour_a',
      name: 'Alpha',
      tag4: '0001',
      team: 'A',
      slot: 0,
      isBot: true,
      isLocal: false,
      weaponId: 'ak47',
      x: spawnA.x,
      y: 0,
      z: -12,
      yaw: Math.PI,
    });
    this.spawnActor({
      id: 'tour_b',
      name: 'Viper',
      tag4: '0002',
      team: 'B',
      slot: 0,
      isBot: true,
      isLocal: false,
      weaponId: 'awm',
      x: spawnB.x,
      y: 0,
      z: 12,
      yaw: 0,
    });
  }

  private clearActors(): void {
    for (const actor of this.actors.values()) {
      this.scene.remove(actor.rig.root);
    }
    this.actors.clear();
    this.clearGlooBarriers();
  }

  private clearGlooBarriers(): void {
    for (const b of this.glooBarriers) {
      this.scene.remove(b.mesh);
    }
    this.glooBarriers = [];
  }

  private spawnActor(cfg: {
    id: string;
    name: string;
    tag4: string;
    team: TeamId;
    slot: number;
    isBot: boolean;
    isLocal: boolean;
    weaponId: WeaponId;
    x: number;
    y: number;
    z: number;
    yaw: number;
  }): ActorRuntime {
    const teamColor = cfg.team === 'A' ? 0x1d4ed8 : 0xb91c1c;
    const accentColor = cfg.team === 'A' ? 0x38bdf8 : 0xf59e0b;
    const rig = buildSoldierModel(teamColor, accentColor, cfg.weaponId, this.textures.contactShadow);
    rig.root.position.set(cfg.x, cfg.y, cfg.z);
    rig.root.rotation.y = cfg.yaw;
    this.scene.add(rig.root);

    const spec = WEAPONS[cfg.weaponId];
    const actor: ActorRuntime = {
      id: cfg.id,
      name: cfg.name,
      tag4: cfg.tag4,
      team: cfg.team,
      slot: cfg.slot,
      isBot: cfg.isBot,
      isLocal: cfg.isLocal,
      rig,
      x: cfg.x,
      y: cfg.y,
      z: cfg.z,
      vy: 0,
      vx: 0,
      vz: 0,
      yaw: cfg.yaw,
      pitch: 0,
      targetX: cfg.x,
      targetY: cfg.y,
      targetZ: cfg.z,
      targetYaw: cfg.yaw,
      hp: PLAYER_MAX_HP,
      armor: PLAYER_MAX_ARMOR,
      alive: true,
      weaponId: cfg.weaponId,
      ammo: spec.magSize,
      reloadingUntilMs: 0,
      lastFireMs: 0,
      glooCount: 2,
      kills: 0,
      deaths: 0,
      damageDealt: 0,
      walkPhase: 0,
      hitFlashTimer: 0,
      koTimer: 0,
      botStrafeDir: Math.random() > 0.5 ? 1 : -1,
      botDecisionTimer: 0.4 + Math.random() * 0.8,
    };
    this.actors.set(cfg.id, actor);
    return actor;
  }

  // --- Public Lifecycle & Mode Controls ---

  public startTour(state: 'title' | 'lobby' = 'title'): void {
    this.mode = 'tour';
    this.simState = state;
    this.paused = false;
    this.networkBridge = null;
    this.dangerRingMesh.visible = false;
    this.exitPointerLock();
    this.setupTourActors();
    this.emitHud(true);
  }

  public startOfflineMatch(params: {
    playerId: string;
    playerName: string;
    playerTag4: string;
    mode: GameMode;
    weaponId: WeaponId;
  }): void {
    this.mode = 'offline';
    this.matchMode = params.mode;
    this.localId = params.playerId;
    this.localName = params.playerName;
    this.localTag4 = params.playerTag4;
    this.isHost = true;
    this.networkBridge = null;
    this.paused = false;
    this.roundNumber = 1;
    this.scoreA = 0;
    this.scoreB = 0;
    this.roundWinner = '';
    this.matchWinner = '';
    this.killFeed = [];
    this.clearActors();

    const spawnA0 = getSpawnPoint('A', 0);
    this.spawnActor({
      id: params.playerId,
      name: params.playerName,
      tag4: params.playerTag4,
      team: 'A',
      slot: 0,
      isBot: false,
      isLocal: true,
      weaponId: params.weaponId,
      ...spawnA0,
    });

    const spawnB0 = getSpawnPoint('B', 0);
    this.spawnActor({
      id: 'bot_b0',
      name: 'ShadowWolf',
      tag4: '8801',
      team: 'B',
      slot: 0,
      isBot: true,
      isLocal: false,
      weaponId: 'ak47',
      ...spawnB0,
    });

    if (params.mode === '2v2') {
      const spawnA1 = getSpawnPoint('A', 1);
      this.spawnActor({
        id: 'bot_a1',
        name: 'AllyStriker',
        tag4: '7702',
        team: 'A',
        slot: 1,
        isBot: true,
        isLocal: false,
        weaponId: 'mp40',
        ...spawnA1,
      });
      const spawnB1 = getSpawnPoint('B', 1);
      this.spawnActor({
        id: 'bot_b1',
        name: 'CrimsonHawk',
        tag4: '8802',
        team: 'B',
        slot: 1,
        isBot: true,
        isLocal: false,
        weaponId: 'm1887',
        ...spawnB1,
      });
    }

    this.beginOfflineRound();
  }

  private beginOfflineRound(): void {
    this.simState = 'playing';
    this.roundTimer = 0;
    this.roundWinner = '';
    this.clearGlooBarriers();
    for (const actor of this.actors.values()) {
      const sp = getSpawnPoint(actor.team, actor.slot);
      actor.x = sp.x;
      actor.y = 0;
      actor.z = sp.z;
      actor.vy = 0;
      actor.vx = 0;
      actor.vz = 0;
      actor.yaw = sp.yaw;
      actor.pitch = 0;
      actor.hp = PLAYER_MAX_HP;
      actor.armor = PLAYER_MAX_ARMOR;
      actor.alive = true;
      actor.glooCount = 2;
      actor.ammo = WEAPONS[actor.weaponId].magSize;
      actor.reloadingUntilMs = 0;
      actor.koTimer = 0;
      actor.rig.bodyGroup.rotation.set(0, 0, 0);
      actor.rig.root.position.set(sp.x, 0, sp.z);
      actor.rig.root.rotation.y = sp.yaw;
    }
    this.snapCameraToLocal();
    this.renderer.render(this.scene, this.camera);
    this.emitHud(true);
  }

  public startOnlineMatch(params: {
    playerId: string;
    playerName: string;
    playerTag4: string;
    isHost: boolean;
    bridge: OnlineNetworkBridge;
  }): void {
    this.mode = 'online';
    this.localId = params.playerId;
    this.localName = params.playerName;
    this.localTag4 = params.playerTag4;
    this.isHost = params.isHost;
    this.networkBridge = params.bridge;
    this.paused = false;
    this.seenEventIds.clear();
    this.killFeed = [];
    this.clearActors();
    this.simState = 'playing';
    this.emitHud(true);
  }

  public startSpectating(room: MatchRoomDoc, participants: RoomParticipantDoc[]): void {
    this.mode = 'spectate';
    this.localId = '__spectator__';
    this.isHost = false;
    this.networkBridge = null;
    this.paused = false;
    this.seenEventIds.clear();
    this.killFeed = [];
    this.clearActors();
    this.syncOnlineState(room, participants, []);
    const first = participants.find((p) => p.alive) ?? participants[0];
    if (first) this.spectateTargetId = first.participantId;
    this.simState = room.status === 'finished' ? 'gameover' : 'playing';
    this.emitHud(true);
  }

  public cycleSpectateTarget(dir: 1 | -1): void {
    const list = Array.from(this.actors.values());
    if (list.length === 0) return;
    const idx = list.findIndex((a) => a.id === this.spectateTargetId);
    const nextIdx = idx < 0 ? 0 : (idx + dir + list.length) % list.length;
    this.spectateTargetId = list[nextIdx].id;
    this.emitHud(true);
  }

  public syncOnlineState(
    room: MatchRoomDoc,
    participants: RoomParticipantDoc[],
    events: RoomEventDoc[],
  ): void {
    if (this.mode !== 'online' && this.mode !== 'spectate') return;
    this.matchMode = room.mode;
    this.roundNumber = room.roundNumber;
    this.scoreA = room.scoreA;
    this.scoreB = room.scoreB;
    this.roundWinner = room.roundWinner;
    this.matchWinner = room.matchWinner;
    if (room.roundStartedAtMs > 0) {
      this.roundTimer = Math.max(0, (Date.now() - room.roundStartedAtMs) / 1000);
    }

    if (room.status === 'finished') {
      this.simState = 'gameover';
      this.exitPointerLock();
    } else if (room.status === 'round_end') {
      this.simState = 'round_end';
    } else if (room.status === 'loadout') {
      this.simState = 'loadout';
    } else if (room.status === 'playing') {
      if (this.simState !== 'paused') {
        this.simState = 'playing';
      }
    }

    const activeIds = new Set<string>();
    for (const p of participants) {
      activeIds.add(p.participantId);
      const existing = this.actors.get(p.participantId);
      if (!existing) {
        const isLocalHuman = this.mode === 'online' && p.participantId === this.localId;
        const actor = this.spawnActor({
          id: p.participantId,
          name: p.name,
          tag4: p.tag4,
          team: p.team,
          slot: p.slot,
          isBot: p.isBot,
          isLocal: isLocalHuman,
          weaponId: p.weaponId,
          x: p.x,
          y: p.y,
          z: p.z,
          yaw: p.yaw,
        });
        actor.hp = p.hp;
        actor.armor = p.armor;
        actor.alive = p.alive;
        actor.kills = p.kills;
        actor.deaths = p.deaths;
        actor.damageDealt = p.damageDealt;
        actor.glooCount = p.glooCount;
        if (isLocalHuman) this.snapCameraToLocal();
      } else {
        // Sync authoritative HP/Alive/Kills/Weapon
        if (p.hp < existing.hp) {
          existing.hitFlashTimer = 0.06;
          existing.rig.setHitFlash(true);
          if (existing.isLocal) {
            this.camTrauma = Math.min(1, this.camTrauma + 0.45);
            soundEngine.playHurt();
          }
        }
        existing.hp = p.hp;
        existing.armor = p.armor;
        if (existing.alive && !p.alive) {
          existing.koTimer = 0.4;
        }
        existing.alive = p.alive;
        if (!p.alive && existing.koTimer <= 0) {
          existing.rig.bodyGroup.rotation.x = Math.PI * 0.48;
        } else if (p.alive) {
          existing.rig.bodyGroup.rotation.set(0, 0, 0);
        }
        existing.kills = p.kills;
        existing.deaths = p.deaths;
        existing.damageDealt = p.damageDealt;

        if (existing.weaponId !== p.weaponId) {
          existing.weaponId = p.weaponId;
          existing.rig.setWeapon(p.weaponId);
          existing.ammo = WEAPONS[p.weaponId].magSize;
        }

        // For remote actors (or bots when not host), update target transform for smooth damping
        if (!existing.isLocal && !(existing.isBot && this.isHost)) {
          existing.targetX = p.x;
          existing.targetY = p.y;
          existing.targetZ = p.z;
          existing.targetYaw = p.yaw;
          existing.vx = p.vx;
          existing.vz = p.vz;
        }
      }
    }

    for (const id of this.actors.keys()) {
      if (!activeIds.has(id)) {
        const actor = this.actors.get(id)!;
        this.scene.remove(actor.rig.root);
        this.actors.delete(id);
      }
    }

    // Process new events (tracers, gloo shields, kill feed)
    const sortedEvents = [...events].sort((a, b) => a.createdAtMs - b.createdAtMs);
    for (const ev of sortedEvents) {
      if (this.seenEventIds.has(ev.eventId)) continue;
      this.seenEventIds.add(ev.eventId);
      if (ev.actorId === this.localId && (ev.type === 'shot' || ev.type === 'gloo')) continue;

      if (ev.type === 'shot') {
        this.spawnTracer(ev.ox, ev.oy, ev.oz, ev.dx, ev.dy, ev.dz, 26);
        this.spawnBullet(ev.ox, ev.oy, ev.oz, ev.dx, ev.dy, ev.dz, 26);
        this.spawnMuzzleFlash(ev.ox, ev.oy, ev.oz, ev.dx, ev.dy, ev.dz, 1.0);
        this.spawnSparkBurst(ev.ox, ev.oy, ev.oz, 3, 0xfef08a);
      } else if (ev.type === 'gloo') {
        const actor = this.actors.get(ev.actorId);
        this.placeGlooShield(ev.ox, ev.oz, ev.dx, actor?.team ?? 'A');
      } else if (ev.type === 'kill') {
        const killer = this.actors.get(ev.actorId)?.name ?? 'Player';
        const victim = this.actors.get(ev.targetId)?.name ?? 'Opponent';
        this.pushKillFeed(`${killer} eliminated ${victim}`, ev.isHeadshot);
      }
    }

    this.emitHud(true);
  }

  public setLocalWeapon(weaponId: WeaponId): void {
    const local = this.actors.get(this.localId);
    if (!local) return;
    local.weaponId = weaponId;
    local.ammo = WEAPONS[weaponId].magSize;
    local.reloadingUntilMs = 0;
    local.rig.setWeapon(weaponId);
    this.emitHud(true);
  }

  public setPaused(p: boolean): void {
    if (this.mode === 'tour') return;
    this.paused = p;
    if (p) {
      this.simState = 'paused';
      this.clearInputs();
      this.exitPointerLock();
    } else if (this.simState === 'paused') {
      this.simState = 'playing';
    }
    this.emitHud(true);
  }

  public restartOfflineMatch(): void {
    if (this.mode !== 'offline') return;
    const local = this.actors.get(this.localId);
    this.startOfflineMatch({
      playerId: this.localId,
      playerName: this.localName,
      playerTag4: this.localTag4,
      mode: this.matchMode,
      weaponId: local?.weaponId ?? 'ak47',
    });
  }

  // --- Mobile Touch Input Hooks ---
  public setTouchMove(nx: number, ny: number): void {
    this.touchMoveX = Math.max(-1, Math.min(1, nx));
    this.touchMoveY = Math.max(-1, Math.min(1, ny));
  }

  public addTouchLookDelta(dx: number, dy: number): void {
    const local = this.actors.get(this.localId);
    if (this.mode === 'spectate') {
      this.spectateYawOffset -= dx * 0.0055;
      this.spectatePitchOffset = Math.max(-0.4, Math.min(0.9, this.spectatePitchOffset + dy * 0.004));
      return;
    }
    if (!local || !local.alive || this.paused) return;
    local.yaw -= dx * 0.0045;
    local.pitch = Math.max(-0.85, Math.min(0.75, local.pitch - dy * 0.0038));
  }

  public setTouchFire(held: boolean): void {
    this.touchFireHeld = held;
  }

  public triggerJump(): void {
    const local = this.actors.get(this.localId);
    if (!local || !local.alive || this.paused || this.simState !== 'playing') return;
    if (local.y <= 0.02) {
      local.vy = 7.4;
      soundEngine.playFootstep();
    }
  }

  public triggerReload(): void {
    const local = this.actors.get(this.localId);
    if (!local || !local.alive || this.paused) return;
    const spec = WEAPONS[local.weaponId];
    if (local.ammo < spec.magSize && local.reloadingUntilMs === 0) {
      local.reloadingUntilMs = performance.now() + spec.reloadMs;
      soundEngine.playReload();
      this.emitHud(true);
    }
  }

  public triggerGlooShield(): void {
    const local = this.actors.get(this.localId);
    if (!local || !local.alive || this.paused || this.simState !== 'playing') return;
    if (local.glooCount <= 0) return;
    local.glooCount -= 1;
    const fx = -Math.sin(local.yaw);
    const fz = -Math.cos(local.yaw);
    const gx = local.x + fx * 2.5;
    const gz = local.z + fz * 2.5;
    this.placeGlooShield(gx, gz, local.yaw, local.team);
    soundEngine.playGlooDeploy();

    if (this.mode === 'online' && this.networkBridge) {
      this.networkBridge.sendShotEvent({
        type: 'gloo',
        actorId: local.id,
        targetId: '',
        weaponId: local.weaponId,
        ox: gx,
        oy: 0,
        oz: gz,
        dx: local.yaw,
        dy: 0,
        dz: 0,
        damage: 0,
        isHeadshot: false,
        roundNumber: this.roundNumber,
      });
    }
    this.emitHud(true);
  }

  public toggleAds(): void {
    this.mouseAdsHeld = !this.mouseAdsHeld;
    this.emitHud(true);
  }

  public cycleWeapon(): void {
    const order: WeaponId[] = ['mp40', 'ak47', 'm1887', 'awm'];
    const local = this.actors.get(this.localId);
    if (!local || !local.alive || this.paused) return;
    const idx = order.indexOf(local.weaponId);
    const next = order[(idx + 1) % order.length];
    this.setLocalWeapon(next);
  }

  // --- Event Listeners ---
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.keys.add(e.code);

    if (this.simState === 'playing' && !this.paused) {
      if (e.code === 'Space') {
        e.preventDefault();
        this.triggerJump();
      } else if (e.code === 'KeyR') {
        this.triggerReload();
      } else if (e.code === 'KeyE' || e.code === 'KeyG') {
        this.triggerGlooShield();
      } else if (e.code === 'KeyQ') {
        this.toggleAds();
      } else if (e.code === 'Tab') {
        e.preventDefault();
        this.cycleWeapon();
      } else if (e.code === 'Digit1') {
        this.setLocalWeapon('mp40');
      } else if (e.code === 'Digit2') {
        this.setLocalWeapon('ak47');
      } else if (e.code === 'Digit3') {
        this.setLocalWeapon('m1887');
      } else if (e.code === 'Digit4') {
        this.setLocalWeapon('awm');
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.clearInputs();
  };

  private onVisibilityChange = () => {
    if (document.hidden) this.clearInputs();
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitHud(true);
  };

  private onCanvasMouseDown = (e: MouseEvent) => {
    if (this.mode === 'tour') return;
    if (this.simState !== 'playing' || this.paused) return;
    this.renderer.domElement.focus();

    if (this.mode === 'spectate') {
      this.dragAimActive = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      return;
    }

    // Request PointerLock on desktop when clicking canvas; fallback to drag aim seamlessly
    if (e.button === 0) {
      if (!this.pointerLocked && this.renderer.domElement.requestPointerLock) {
        try {
          this.renderer.domElement.requestPointerLock();
        } catch {
          // Headless / iframe may ignore pointerlock; drag-aim still works
        }
      }
      this.mouseFireHeld = true;
      this.dragAimActive = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    } else if (e.button === 2) {
      this.mouseAdsHeld = true;
    }
  };

  private onCanvasMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.mouseFireHeld = false;
      this.dragAimActive = false;
    } else if (e.button === 2) {
      this.mouseAdsHeld = false;
    }
  };

  private onCanvasMouseMove = (e: MouseEvent) => {
    if (this.simState !== 'playing' || this.paused) return;
    if (this.pointerLocked) {
      this.addTouchLookDelta(e.movementX * 0.55, e.movementY * 0.55);
    } else if (this.dragAimActive) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.addTouchLookDelta(dx * 0.85, dy * 0.85);
    }
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private bindEvents(): void {
    const el = this.renderer.domElement;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    el.addEventListener('mousedown', this.onCanvasMouseDown);
    window.addEventListener('mouseup', this.onCanvasMouseUp);
    window.addEventListener('mousemove', this.onCanvasMouseMove);
    el.addEventListener('contextmenu', this.onContextMenu);
  }

  private clearInputs(): void {
    this.keys.clear();
    this.mouseFireHeld = false;
    this.mouseAdsHeld = false;
    this.touchFireHeld = false;
    this.dragAimActive = false;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
  }

  private exitPointerLock(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }

  private handleResize(): void {
    if (this.disposed) return;
    const w = Math.max(320, this.container.clientWidth || window.innerWidth);
    const h = Math.max(240, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.render(this.scene, this.camera);
  }

  // --- Loop Scheduling (Software WebGL vs GPU) ---
  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    this.updateVisualFX(dt);

    if (this.mode === 'tour') {
      this.updateTour(dt);
    } else if (!this.paused) {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      } else {
        this.updateCombatSimulation(dt, now);
      }
      this.updateCameraRig(dt);
    }

    this.renderer.render(this.scene, this.camera);
    this.emitHud(false);
    this.scheduleNextTick();
  }

  private updateTour(dt: number): void {
    this.tourAngle += dt * 0.18;
    const r = 34;
    this.camera.position.set(Math.sin(this.tourAngle) * r, 13.5, Math.cos(this.tourAngle) * r);
    this.camera.lookAt(0, 1.8, 0);
    for (const actor of this.actors.values()) {
      actor.walkPhase += dt * 2.2;
      actor.rig.bodyGroup.position.y = Math.sin(actor.walkPhase) * 0.03;
    }
  }

  private updateCombatSimulation(dt: number, nowMs: number): void {
    // Expire temporary Gloo Shields
    for (let i = this.glooBarriers.length - 1; i >= 0; i--) {
      if (nowMs >= this.glooBarriers[i].expiresAtMs) {
        this.scene.remove(this.glooBarriers[i].mesh);
        this.glooBarriers.splice(i, 1);
      }
    }

    if (this.simState === 'round_end') {
      if (this.mode === 'offline') {
        this.roundEndCooldown -= dt;
        if (this.roundEndCooldown <= 0) {
          this.roundNumber += 1;
          this.beginOfflineRound();
        }
      }
      return;
    }

    if (this.simState !== 'playing') return;

    this.roundTimer += dt;
    const zoneRadius = getDangerZoneRadius(this.roundTimer, ROUND_DURATION_SEC);
    if (this.roundTimer > 30) {
      this.dangerRingMesh.visible = true;
      this.dangerRingMesh.scale.set(zoneRadius, 1, zoneRadius);
    } else {
      this.dangerRingMesh.visible = false;
    }

    const allObstacles = this.getAllCollisionBoxes();

    // Update Local Human Player
    const local = this.actors.get(this.localId);
    if (local && local.alive && this.mode !== 'spectate') {
      this.stepLocalPlayer(local, dt, nowMs, allObstacles, zoneRadius);
    }

    // Update Tactical AI Bots ONLY in Offline Practice mode (NEVER in Online mode!)
    if (this.mode === 'offline' && this.isHost) {
      for (const actor of this.actors.values()) {
        if (actor.isBot && actor.alive) {
          this.stepBotAI(actor, dt, nowMs, allObstacles, zoneRadius);
        }
      }
    }

    // Interpolate Remote Actors & Animate All Rigs (with Knee Articulation + Recoil)
    for (const actor of this.actors.values()) {
      if (!actor.isLocal && !(actor.isBot && this.isHost)) {
        const k = 1 - Math.exp(-14 * dt);
        actor.x += (actor.targetX - actor.x) * k;
        actor.y += (actor.targetY - actor.y) * k;
        actor.z += (actor.targetZ - actor.z) * k;
        // Shortest-angle yaw interp
        let diff = actor.targetYaw - actor.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        actor.yaw += diff * k;
      }

      actor.rig.root.position.set(actor.x, actor.y, actor.z);
      actor.rig.root.rotation.y = actor.yaw;

      // Smooth recoil recovery on shooting arm
      actor.rig.rightArm.rotation.x *= Math.exp(-14 * dt);

      // Hit flash decay
      if (actor.hitFlashTimer > 0) {
        actor.hitFlashTimer -= dt;
        if (actor.hitFlashTimer <= 0) actor.rig.setHitFlash(false);
      }

      // KO Topple
      if (!actor.alive && actor.koTimer > 0) {
        actor.koTimer = Math.max(0, actor.koTimer - dt);
        const progress = 1 - actor.koTimer / 0.4;
        actor.rig.bodyGroup.rotation.x = progress * Math.PI * 0.48;
      }

      // Distance-synced gait swing + knee bend
      const speed = Math.hypot(actor.vx, actor.vz);
      if (actor.alive && speed > 0.35) {
        actor.walkPhase += speed * dt * 1.45;
        const swing = Math.sin(actor.walkPhase) * 0.56;
        actor.rig.leftLeg.rotation.x = swing;
        actor.rig.rightLeg.rotation.x = -swing;
        actor.rig.leftKnee.rotation.x = Math.max(0, -swing * 0.72);
        actor.rig.rightKnee.rotation.x = Math.max(0, swing * 0.72);
        actor.rig.bodyGroup.position.y = Math.abs(Math.sin(actor.walkPhase)) * 0.055;
      } else {
        actor.rig.leftLeg.rotation.x *= 0.8;
        actor.rig.rightLeg.rotation.x *= 0.8;
        actor.rig.leftKnee.rotation.x *= 0.8;
        actor.rig.rightKnee.rotation.x *= 0.8;
        actor.rig.bodyGroup.position.y *= 0.8;
      }
    }

    // Network Transform Sync (~12Hz)
    if (this.mode === 'online' && this.networkBridge && local && nowMs - this.lastNetSyncMs > 85) {
      this.lastNetSyncMs = nowMs;
      this.networkBridge.sendTransform({
        x: local.x,
        y: local.y,
        z: local.z,
        yaw: local.yaw,
        pitch: local.pitch,
        vx: local.vx,
        vz: local.vz,
        weaponId: local.weaponId,
        glooCount: local.glooCount,
      });
    }

    // Evaluate Round End (Authoritative on Host / Offline)
    if (this.isHost) {
      let aliveA = 0;
      let aliveB = 0;
      for (const a of this.actors.values()) {
        if (a.alive) {
          if (a.team === 'A') aliveA++;
          else aliveB++;
        }
      }
      const outcome = resolveRoundOutcome({
        scoreA: this.scoreA,
        scoreB: this.scoreB,
        teamAAlive: aliveA,
        teamBAlive: aliveB,
        elapsedSec: this.roundTimer,
        roundDurationSec: ROUND_DURATION_SEC,
        targetRounds: TARGET_ROUNDS,
      });

      if (outcome.roundEnded) {
        this.scoreA = outcome.newScoreA;
        this.scoreB = outcome.newScoreB;
        this.roundWinner = outcome.roundWinner;
        this.matchWinner = outcome.matchWinner;
        soundEngine.playRoundEnd(outcome.roundWinner === 'A');

        if (this.mode === 'offline') {
          if (outcome.matchEnded) {
            this.simState = 'gameover';
            this.exitPointerLock();
          } else {
            this.simState = 'round_end';
            this.roundEndCooldown = 2.6;
          }
          this.emitHud(true);
        } else if (this.networkBridge) {
          if (outcome.matchEnded) {
            this.simState = 'gameover';
            this.networkBridge.sendRoomAdvance({
              status: 'finished',
              roundNumber: this.roundNumber,
              scoreA: outcome.newScoreA,
              scoreB: outcome.newScoreB,
              roundWinner: outcome.roundWinner,
              matchWinner: outcome.matchWinner,
              roundStartedAtMs: Date.now(),
            });
          } else {
            this.simState = 'round_end';
            this.networkBridge.sendRoomAdvance({
              status: 'round_end',
              roundNumber: this.roundNumber,
              scoreA: outcome.newScoreA,
              scoreB: outcome.newScoreB,
              roundWinner: outcome.roundWinner,
              matchWinner: '',
              roundStartedAtMs: Date.now(),
            });
            window.setTimeout(() => {
              if (this.disposed || this.mode !== 'online' || !this.networkBridge) return;
              const nextRound = this.roundNumber + 1;
              const resetList = Array.from(this.actors.values()).map((a) => ({
                id: a.id,
                team: a.team,
                slot: a.slot,
              }));
              this.networkBridge.resetParticipantsForRound(resetList);
              this.networkBridge.sendRoomAdvance({
                status: 'playing',
                roundNumber: nextRound,
                scoreA: outcome.newScoreA,
                scoreB: outcome.newScoreB,
                roundWinner: '',
                matchWinner: '',
                roundStartedAtMs: Date.now(),
              });
            }, 2600);
          }
        }
      }
    }
  }

  private stepLocalPlayer(
    local: ActorRuntime,
    dt: number,
    nowMs: number,
    obstacles: DynamicBox[],
    zoneRadius: number,
  ): void {
    // Reload completion
    if (local.reloadingUntilMs > 0 && nowMs >= local.reloadingUntilMs) {
      local.reloadingUntilMs = 0;
      local.ammo = WEAPONS[local.weaponId].magSize;
      this.emitHud(true);
    }

    // Movement input vector relative to camera yaw
    let inForward = 0;
    let inRight = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) inForward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) inForward -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) inRight += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) inRight -= 1;

    inForward -= this.touchMoveY;
    inRight += this.touchMoveX;

    const len = Math.hypot(inForward, inRight);
    if (len > 1) {
      inForward /= len;
      inRight /= len;
    }

    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const moveSpeed = this.mouseAdsHeld ? 4.4 : sprint ? 8.8 : 6.7;

    const sinY = Math.sin(local.yaw);
    const cosY = Math.cos(local.yaw);
    // Forward direction in Three.js when yaw=0 is -Z: (-sin(yaw), -cos(yaw))
    const fwdX = -sinY;
    const fwdZ = -cosY;
    const rightX = cosY;
    const rightZ = -sinY;

    local.vx = (fwdX * inForward + rightX * inRight) * moveSpeed;
    local.vz = (fwdZ * inForward + rightZ * inRight) * moveSpeed;

    const nextPos = resolveCircleBoxCollisions(
      local.x + local.vx * dt,
      local.z + local.vz * dt,
      PLAYER_RADIUS,
      obstacles,
    );
    local.x = nextPos.x;
    local.z = nextPos.z;

    // Gravity & jump
    local.vy -= 21 * dt;
    local.y += local.vy * dt;
    if (local.y <= 0) {
      local.y = 0;
      local.vy = 0;
    }

    // Footstep sound
    const speed = Math.hypot(local.vx, local.vz);
    if (local.y <= 0.01 && speed > 1.2) {
      this.footstepAccum += speed * dt;
      if (this.footstepAccum >= 2.6) {
        this.footstepAccum = 0;
        soundEngine.playFootstep();
      }
    }

    // Danger zone shrink tick
    if (Math.hypot(local.x, local.z) > zoneRadius && Math.floor(this.roundTimer * 2) !== Math.floor((this.roundTimer - dt) * 2)) {
      this.applyDamageToActor(local, local, 6, false, 1);
    }

    // Firing
    if (this.mouseFireHeld || this.touchFireHeld || this.keys.has('KeyF')) {
      this.fireWeapon(local, nowMs, obstacles);
    }
  }

  private stepBotAI(
    bot: ActorRuntime,
    dt: number,
    nowMs: number,
    obstacles: DynamicBox[],
    zoneRadius: number,
  ): void {
    // Pick nearest alive enemy
    let target: ActorRuntime | null = null;
    let bestDist = Infinity;
    for (const other of this.actors.values()) {
      if (other.team !== bot.team && other.alive) {
        const d = Math.hypot(other.x - bot.x, other.z - bot.z);
        if (d < bestDist) {
          bestDist = d;
          target = other;
        }
      }
    }
    if (!target) return;

    const toX = target.x - bot.x;
    const toZ = target.z - bot.z;
    const dist = Math.max(0.01, Math.hypot(toX, toZ));
    const desiredYaw = Math.atan2(-toX, -toZ);

    let diff = desiredYaw - bot.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    bot.yaw += diff * (1 - Math.exp(-8 * dt));

    bot.botDecisionTimer -= dt;
    if (bot.botDecisionTimer <= 0) {
      bot.botDecisionTimer = 0.7 + Math.random() * 1.1;
      bot.botStrafeDir = Math.random() > 0.5 ? 1 : -1;
      if (bot.hp < 95 && bot.glooCount > 0 && Math.random() < 0.65) {
        bot.glooCount -= 1;
        this.placeGlooShield(bot.x + (toX / dist) * 2.2, bot.z + (toZ / dist) * 2.2, bot.yaw, bot.team);
        soundEngine.playGlooDeploy();
      }
    }

    // Distinct range policy by weapon
    const idealDist = bot.weaponId === 'awm' ? 24 : bot.weaponId === 'm1887' ? 8 : 15;
    let moveFwd = 0;
    if (dist > idealDist + 3) moveFwd = 1;
    else if (dist < idealDist - 3) moveFwd = -0.7;

    // Pull inward if near danger zone
    const distFromCenter = Math.hypot(bot.x, bot.z);
    if (distFromCenter > zoneRadius - 2) {
      const toCenterYaw = Math.atan2(bot.x, bot.z);
      bot.vx = -Math.sin(toCenterYaw) * 6.2;
      bot.vz = -Math.cos(toCenterYaw) * 6.2;
    } else {
      const fwdX = -Math.sin(bot.yaw);
      const fwdZ = -Math.cos(bot.yaw);
      const rightX = Math.cos(bot.yaw);
      const rightZ = -Math.sin(bot.yaw);
      const speed = 5.4;
      bot.vx = (fwdX * moveFwd + rightX * bot.botStrafeDir * 0.85) * speed;
      bot.vz = (fwdZ * moveFwd + rightZ * bot.botStrafeDir * 0.85) * speed;
    }

    const next = resolveCircleBoxCollisions(
      bot.x + bot.vx * dt,
      bot.z + bot.vz * dt,
      PLAYER_RADIUS,
      obstacles,
    );
    bot.x = next.x;
    bot.z = next.z;

    // Reload if empty
    if (bot.reloadingUntilMs > 0 && nowMs >= bot.reloadingUntilMs) {
      bot.reloadingUntilMs = 0;
      bot.ammo = WEAPONS[bot.weaponId].magSize;
    }
    if (bot.ammo <= 0 && bot.reloadingUntilMs === 0) {
      bot.reloadingUntilMs = nowMs + WEAPONS[bot.weaponId].reloadMs;
      return;
    }

    // Line-of-sight check before shooting
    const ox = bot.x;
    const oy = bot.y + 1.42;
    const oz = bot.z;
    const dx = toX / dist;
    const dy = (target.y + 1.25 - oy) / dist;
    const dz = toZ / dist;

    let blocked = false;
    for (let i = 0; i < obstacles.length; i++) {
      const hitWall = rayIntersectsBox(ox, oy, oz, dx, dy, dz, dist, obstacles[i]);
      if (hitWall !== null && hitWall < dist - 0.5) {
        blocked = true;
        break;
      }
    }

    if (!blocked && Math.abs(diff) < 0.25) {
      this.fireWeapon(bot, nowMs, obstacles, { dx, dy, dz });
    }
  }

  private fireWeapon(
    shooter: ActorRuntime,
    nowMs: number,
    obstacles: DynamicBox[],
    botAimDir?: { dx: number; dy: number; dz: number },
  ): void {
    const spec = WEAPONS[shooter.weaponId];
    if (shooter.reloadingUntilMs > 0) return;
    if (nowMs - shooter.lastFireMs < spec.fireRateMs) return;
    if (shooter.ammo <= 0) {
      shooter.reloadingUntilMs = nowMs + spec.reloadMs;
      if (shooter.isLocal) soundEngine.playReload();
      this.emitHud(true);
      return;
    }

    shooter.lastFireMs = nowMs;
    shooter.ammo -= 1;
    if (shooter.isLocal) {
      soundEngine.playGunshot(shooter.weaponId);
      this.camTrauma = Math.min(1, this.camTrauma + (shooter.weaponId === 'm1887' ? 0.35 : 0.16));
    }

    // Compute ray origin & aim vector
    let ox = shooter.x;
    let oy = shooter.y + 1.44;
    let oz = shooter.z;
    let baseDx = -Math.sin(shooter.yaw) * Math.cos(shooter.pitch);
    let baseDy = Math.sin(shooter.pitch);
    let baseDz = -Math.cos(shooter.yaw) * Math.cos(shooter.pitch);

    if (shooter.isLocal) {
      // Aim through screen center crosshair from camera for true TPP accuracy
      this.camera.getWorldDirection(_v1);
      _v2.copy(this.camera.position).addScaledVector(_v1, 2.2);
      // Raycast from camera forward to find convergence point
      let minWorldDist = spec.range;
      for (let i = 0; i < obstacles.length; i++) {
        const d = rayIntersectsBox(
          this.camera.position.x,
          this.camera.position.y,
          this.camera.position.z,
          _v1.x,
          _v1.y,
          _v1.z,
          minWorldDist,
          obstacles[i],
        );
        if (d !== null && d > 2.2 && d < minWorldDist) {
          minWorldDist = d;
        }
      }
      for (const other of this.actors.values()) {
        if (other.id === shooter.id || other.team === shooter.team || !other.alive) continue;
        const thit = rayIntersectsTargetCylinder(
          this.camera.position.x,
          this.camera.position.y,
          this.camera.position.z,
          _v1.x,
          _v1.y,
          _v1.z,
          minWorldDist,
          other.x,
          other.y,
          other.z,
        );
        if (thit && thit.dist < minWorldDist) {
          minWorldDist = thit.dist;
        }
      }
      _v3.copy(this.camera.position).addScaledVector(_v1, minWorldDist);
      const muzzlePos = _v2;
      shooter.rig.muzzlePoint.getWorldPosition(muzzlePos);
      ox = muzzlePos.x;
      oy = muzzlePos.y;
      oz = muzzlePos.z;
      _v3.sub(muzzlePos).normalize();
      baseDx = _v3.x;
      baseDy = _v3.y;
      baseDz = _v3.z;
    } else if (botAimDir) {
      baseDx = botAimDir.dx;
      baseDy = botAimDir.dy;
      baseDz = botAimDir.dz;
    }

    const spreadMult = shooter.isBot ? 2.4 : this.mouseAdsHeld ? 0.35 : 1.0;

    for (let p = 0; p < spec.pellets; p++) {
      const spread = spec.spread * spreadMult;
      const dx = baseDx + (Math.random() - 0.5) * spread * 2;
      const dy = baseDy + (Math.random() - 0.5) * spread * 2;
      const dz = baseDz + (Math.random() - 0.5) * spread * 2;
      const dLen = Math.hypot(dx, dy, dz) || 1;
      const ndx = dx / dLen;
      const ndy = dy / dLen;
      const ndz = dz / dLen;

      // Closest obstacle hit
      let closestWall = spec.range;
      for (let i = 0; i < obstacles.length; i++) {
        const t = rayIntersectsBox(ox, oy, oz, ndx, ndy, ndz, closestWall, obstacles[i]);
        if (t !== null && t < closestWall) {
          closestWall = t;
        }
      }

      // Closest enemy hit
      let hitTarget: ActorRuntime | null = null;
      let hitDist = closestWall;
      let isHeadshot = false;

      for (const other of this.actors.values()) {
        if (other.id === shooter.id || other.team === shooter.team || !other.alive) continue;
        const hit = rayIntersectsTargetCylinder(
          ox,
          oy,
          oz,
          ndx,
          ndy,
          ndz,
          hitDist,
          other.x,
          other.y,
          other.z,
        );
        if (hit && hit.dist < hitDist) {
          hitDist = hit.dist;
          hitTarget = other;
          isHeadshot = hit.isHeadshot;
        }
      }

      this.spawnTracer(ox, oy, oz, ndx, ndy, ndz, hitDist);
      this.spawnBullet(ox, oy, oz, ndx, ndy, ndz, hitDist);

      if (hitTarget) {
        const hx = ox + ndx * hitDist;
        const hy = oy + ndy * hitDist;
        const hz = oz + ndz * hitDist;
        this.spawnSparkBurst(hx, hy, hz, isHeadshot ? 16 : 8, isHeadshot ? 0xef4444 : 0xf59e0b);
        this.applyDamageToActor(shooter, hitTarget, spec.damage, isHeadshot, spec.headshotMult);
      } else if (closestWall < spec.range) {
        const hx = ox + ndx * closestWall;
        const hy = oy + ndy * closestWall;
        const hz = oz + ndz * closestWall;
        this.spawnSparkBurst(hx, hy, hz, 5, 0x94a3b8);
      }
    }

    // Visual recoil kick, 3D muzzle flash, and spinning brass shell casing ejection
    shooter.rig.rightArm.rotation.x = Math.max(-0.32, shooter.rig.rightArm.rotation.x - (shooter.weaponId === 'm1887' ? 0.24 : 0.11));
    this.spawnMuzzleFlash(ox, oy, oz, baseDx, baseDy, baseDz, shooter.weaponId === 'm1887' ? 1.5 : 1.0);
    shooter.rig.ejectPoint.getWorldPosition(_v3);
    this.spawnShellCasing(_v3.x, _v3.y, _v3.z, shooter.yaw);

    if (this.mode === 'online' && this.networkBridge && shooter.isLocal) {
      this.networkBridge.sendShotEvent({
        type: 'shot',
        actorId: shooter.id,
        targetId: '',
        weaponId: shooter.weaponId,
        ox,
        oy,
        oz,
        dx: baseDx,
        dy: baseDy,
        dz: baseDz,
        damage: 0,
        isHeadshot: false,
        roundNumber: this.roundNumber,
      });
    }

    if (shooter.ammo <= 0) {
      shooter.reloadingUntilMs = nowMs + spec.reloadMs;
      if (shooter.isLocal) soundEngine.playReload();
    }
    this.emitHud(true);
  }

  private applyDamageToActor(
    attacker: ActorRuntime,
    target: ActorRuntime,
    rawDamage: number,
    isHeadshot: boolean,
    headshotMult: number,
  ): void {
    if (!target.alive) return;
    const res = applyDamage({
      hp: target.hp,
      armor: target.armor,
      rawDamage,
      isHeadshot,
      headshotMult,
    });
    target.hp = res.hp;
    target.armor = res.armor;
    target.hitFlashTimer = 0.055;
    target.rig.setHitFlash(true);

    if (attacker.id !== target.id) {
      attacker.damageDealt += res.appliedDamage;
    }

    if (attacker.isLocal && attacker.id !== target.id) {
      this.hitMarkerType = isHeadshot ? 'head' : 'body';
      this.hitMarkerTimer = 0.16;
      soundEngine.playHitMarker(isHeadshot);
    }
    if (target.isLocal) {
      this.camTrauma = Math.min(1, this.camTrauma + 0.35);
      soundEngine.playHurt();
    }

    if (!res.alive) {
      target.alive = false;
      target.deaths += 1;
      target.koTimer = 0.4;
      if (attacker.id !== target.id) {
        attacker.kills += 1;
        this.hitstopTimer = 0.045;
        this.pushKillFeed(`${attacker.name} eliminated ${target.name}`, isHeadshot);
      } else {
        this.pushKillFeed(`${target.name} fell to Danger Zone`, false);
      }
    }

    if (this.mode === 'online' && this.networkBridge) {
      if (attacker.isLocal || (attacker.isBot && this.isHost)) {
        this.networkBridge.sendDamageUpdate(
          target.id,
          { hp: target.hp, armor: target.armor, alive: target.alive, deaths: target.deaths },
          attacker.id !== target.id ? attacker.kills : undefined,
          attacker.id !== target.id ? attacker.damageDealt : undefined,
        );
        if (!res.alive && attacker.id !== target.id) {
          this.networkBridge.sendShotEvent({
            type: 'kill',
            actorId: attacker.id,
            targetId: target.id,
            weaponId: attacker.weaponId,
            ox: target.x,
            oy: target.y,
            oz: target.z,
            dx: 0,
            dy: 1,
            dz: 0,
            damage: res.appliedDamage,
            isHeadshot,
            roundNumber: this.roundNumber,
          });
        }
      }
    }
  }

  private placeGlooShield(x: number, z: number, yaw: number, team: TeamId): void {
    const color = team === 'A' ? 0x38bdf8 : 0xf97316;
    const mesh = buildGlooShieldMesh(color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    this.scene.add(mesh);

    // Axis-aligned bounding approximation for fast collision
    const rotated = Math.abs(Math.sin(yaw)) > 0.707;
    const box: DynamicBox = {
      x,
      y: 0,
      z,
      w: rotated ? 0.55 : 3.2,
      h: 2.25,
      d: rotated ? 3.2 : 0.55,
    };
    this.glooBarriers.push({
      id: `gloo_${Date.now()}_${Math.random()}`,
      mesh,
      box,
      expiresAtMs: performance.now() + 8000,
    });
    this.spawnSparkBurst(x, 1.0, z, 12, color);
  }

  private getAllCollisionBoxes(): DynamicBox[] {
    if (this.glooBarriers.length === 0) return this.staticBoxes;
    const list = this.staticBoxes.slice();
    for (let i = 0; i < this.glooBarriers.length; i++) {
      list.push(this.glooBarriers[i].box);
    }
    return list;
  }

  private spawnTracer(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    dist: number,
  ): void {
    const slot = this.tracers[this.tracerCursor];
    this.tracerCursor = (this.tracerCursor + 1) % this.tracers.length;
    slot.active = true;
    slot.life = 0;
    slot.maxLife = 0.085;
    slot.length = Math.min(dist, 24);
    slot.pos.set(ox + dx * slot.length * 0.5, oy + dy * slot.length * 0.5, oz + dz * slot.length * 0.5);
    _v1.set(dx, dy, dz).normalize();
    slot.quat.setFromUnitVectors(_v2.set(0, 0, 1), _v1);
  }

  private spawnBullet(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    dist: number,
  ): void {
    const slot = this.bullets[this.bulletCursor];
    this.bulletCursor = (this.bulletCursor + 1) % this.bullets.length;
    const speed = 135;
    slot.active = true;
    slot.life = 0;
    slot.maxLife = Math.min(0.26, Math.max(0.04, dist / speed));
    slot.pos.set(ox, oy, oz);
    slot.vel.set(dx * speed, dy * speed, dz * speed);
    _v1.set(dx, dy, dz).normalize();
    slot.quat.setFromUnitVectors(_v2.set(0, 0, 1), _v1);
  }

  private spawnShellCasing(x: number, y: number, z: number, shooterYaw: number): void {
    const slot = this.shells[this.shellCursor];
    this.shellCursor = (this.shellCursor + 1) % this.shells.length;
    const rightX = Math.cos(shooterYaw);
    const rightZ = -Math.sin(shooterYaw);
    slot.active = true;
    slot.life = 0;
    slot.maxLife = 0.85;
    slot.pos.set(x, y, z);
    slot.vel.set(
      rightX * (2.2 + Math.random() * 1.4),
      2.4 + Math.random() * 1.1,
      rightZ * (2.2 + Math.random() * 1.4),
    );
    slot.rotX = Math.random() * Math.PI;
    slot.rotZ = Math.random() * Math.PI;
  }

  private spawnMuzzleFlash(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    scale: number,
  ): void {
    const slot = this.muzzleFlashes[this.muzzleCursor];
    this.muzzleCursor = (this.muzzleCursor + 1) % this.muzzleFlashes.length;
    slot.active = true;
    slot.life = 0;
    slot.maxLife = 0.055;
    slot.pos.set(ox + dx * 0.14, oy + dy * 0.14, oz + dz * 0.14);
    slot.scale = scale * (0.9 + Math.random() * 0.35);
    _v1.set(dx, dy, dz).normalize();
    slot.quat.setFromUnitVectors(_v2.set(0, 0, 1), _v1);
  }

  private spawnSparkBurst(x: number, y: number, z: number, count: number, hexColor: number): void {
    for (let i = 0; i < count; i++) {
      const slot = this.sparks[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % this.sparks.length;
      slot.active = true;
      slot.life = 0;
      slot.maxLife = 0.22 + Math.random() * 0.16;
      slot.pos.set(x, y, z);
      slot.vel.set(
        (Math.random() - 0.5) * 9,
        1.5 + Math.random() * 5,
        (Math.random() - 0.5) * 9,
      );
      slot.scale = 0.7 + Math.random() * 0.8;
      slot.color.setHex(hexColor);
    }
  }

  private updateVisualFX(dt: number): void {
    if (this.hitMarkerTimer > 0) {
      this.hitMarkerTimer -= dt;
      if (this.hitMarkerTimer <= 0) this.hitMarkerType = 'none';
    }
    this.camTrauma = Math.max(0, this.camTrauma - dt * 2.4);

    let tracerDirty = false;
    for (let i = 0; i < this.tracers.length; i++) {
      const t = this.tracers[i];
      if (!t.active) continue;
      tracerDirty = true;
      t.life += dt;
      if (t.life >= t.maxLife) {
        t.active = false;
        _mat4.makeScale(0, 0, 0);
      } else {
        const s = 1 - t.life / t.maxLife;
        _scale.set(s, s, t.length);
        _mat4.compose(t.pos, t.quat, _scale);
      }
      this.tracerMesh.setMatrixAt(i, _mat4);
    }
    if (tracerDirty) this.tracerMesh.instanceMatrix.needsUpdate = true;

    let bulletDirty = false;
    for (let i = 0; i < this.bullets.length; i++) {
      const b = this.bullets[i];
      if (!b.active) continue;
      bulletDirty = true;
      b.life += dt;
      if (b.life >= b.maxLife) {
        b.active = false;
        _mat4.makeScale(0, 0, 0);
      } else {
        b.pos.addScaledVector(b.vel, dt);
        _scale.set(1.6, 1.6, 2.6);
        _mat4.compose(b.pos, b.quat, _scale);
      }
      this.bulletMesh.setMatrixAt(i, _mat4);
    }
    if (bulletDirty) this.bulletMesh.instanceMatrix.needsUpdate = true;

    let shellDirty = false;
    for (let i = 0; i < this.shells.length; i++) {
      const s = this.shells[i];
      if (!s.active) continue;
      shellDirty = true;
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.active = false;
        _mat4.makeScale(0, 0, 0);
      } else {
        s.vel.y -= 14 * dt;
        s.pos.addScaledVector(s.vel, dt);
        if (s.pos.y < 0.03) {
          s.pos.y = 0.03;
          s.vel.y = Math.abs(s.vel.y) * 0.42;
          s.vel.x *= 0.7;
          s.vel.z *= 0.7;
        }
        s.rotX += 14 * dt;
        s.rotZ += 11 * dt;
        _euler.set(s.rotX, 0, s.rotZ);
        _quat.setFromEuler(_euler);
        _scale.set(1, 1, 1);
        _mat4.compose(s.pos, _quat, _scale);
      }
      this.shellMesh.setMatrixAt(i, _mat4);
    }
    if (shellDirty) this.shellMesh.instanceMatrix.needsUpdate = true;

    let flashDirty = false;
    for (let i = 0; i < this.muzzleFlashes.length; i++) {
      const f = this.muzzleFlashes[i];
      if (!f.active) continue;
      flashDirty = true;
      f.life += dt;
      if (f.life >= f.maxLife) {
        f.active = false;
        _mat4.makeScale(0, 0, 0);
      } else {
        const k = f.scale * (1 - f.life / f.maxLife);
        _scale.set(k, k, k * 1.4);
        _mat4.compose(f.pos, f.quat, _scale);
      }
      this.muzzleFlashMesh.setMatrixAt(i, _mat4);
    }
    if (flashDirty) this.muzzleFlashMesh.instanceMatrix.needsUpdate = true;

    let sparkDirty = false;
    for (let i = 0; i < this.sparks.length; i++) {
      const p = this.sparks[i];
      if (!p.active) continue;
      sparkDirty = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
      } else {
        p.vel.y -= 15 * dt;
        p.pos.addScaledVector(p.vel, dt);
        const s = p.scale * (1 - p.life / p.maxLife);
        _scale.set(s, s, s);
        _quat.identity();
        _mat4.compose(p.pos, _quat, _scale);
        this.sparkMesh.setColorAt(i, p.color);
      }
      this.sparkMesh.setMatrixAt(i, _mat4);
    }
    if (sparkDirty) {
      this.sparkMesh.instanceMatrix.needsUpdate = true;
      if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
    }
  }

  private snapCameraToLocal(): void {
    const local = this.actors.get(this.localId);
    if (!local) return;
    const sinY = Math.sin(local.yaw);
    const cosY = Math.cos(local.yaw);
    this.camPos.set(local.x + sinY * 4.2 + cosY * 0.72, local.y + 2.15, local.z + cosY * 4.2 - sinY * 0.72);
    this.camLook.set(local.x - sinY * 10, local.y + 1.5, local.z - cosY * 10);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  private updateCameraRig(dt: number): void {
    const targetActor =
      this.mode === 'spectate'
        ? this.actors.get(this.spectateTargetId) ?? Array.from(this.actors.values())[0]
        : this.actors.get(this.localId);

    if (!targetActor) return;

    const yaw = this.mode === 'spectate' ? targetActor.yaw + this.spectateYawOffset : targetActor.yaw;
    const pitch = this.mode === 'spectate' ? this.spectatePitchOffset : targetActor.pitch;

    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const adsActive = this.mode !== 'spectate' && this.mouseAdsHeld && targetActor.alive;
    const spec = WEAPONS[targetActor.weaponId];
    const targetFov = adsActive ? spec.adsFov : 68;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-14 * dt));
      this.camera.updateProjectionMatrix();
    }

    const shoulderRight = this.mode === 'spectate' ? 0 : adsActive ? 0.55 : 0.75;
    const backDist = this.mode === 'spectate' ? 5.6 : adsActive ? 2.15 : 4.1;
    const height = this.mode === 'spectate' ? 2.6 : 1.92;

    // Anchor at player shoulder
    const anchorX = targetActor.x + cosY * shoulderRight;
    const anchorY = targetActor.y + height;
    const anchorZ = targetActor.z - sinY * shoulderRight;

    const camDirX = sinY * Math.cos(pitch);
    const camDirY = -Math.sin(pitch) * 0.85 + 0.14;
    const camDirZ = cosY * Math.cos(pitch);
    const dirLen = Math.hypot(camDirX, camDirY, camDirZ) || 1;
    const ndx = camDirX / dirLen;
    const ndy = camDirY / dirLen;
    const ndz = camDirZ / dirLen;

    // Wall pull-in raycast so camera never clips inside containers
    let safeDist = backDist;
    for (let i = 0; i < this.staticBoxes.length; i++) {
      const hit = rayIntersectsBox(anchorX, anchorY, anchorZ, ndx, ndy, ndz, backDist, this.staticBoxes[i]);
      if (hit !== null && hit < safeDist) {
        safeDist = Math.max(0.75, hit - 0.25);
      }
    }

    _camGoal.set(anchorX + ndx * safeDist, Math.max(0.45, anchorY + ndy * safeDist), anchorZ + ndz * safeDist);
    _lookGoal.set(
      anchorX - sinY * 18,
      anchorY + Math.sin(pitch) * 14,
      anchorZ - cosY * 18,
    );

    const damp = 1 - Math.exp(-18 * dt);
    this.camPos.lerp(_camGoal, damp);
    this.camLook.lerp(_lookGoal, damp);

    const shake = this.camTrauma * this.camTrauma * 0.22;
    this.camera.position.set(
      this.camPos.x + (Math.random() - 0.5) * shake,
      this.camPos.y + (Math.random() - 0.5) * shake,
      this.camPos.z + (Math.random() - 0.5) * shake,
    );
    this.camera.lookAt(this.camLook);
  }

  private pushKillFeed(text: string, isHeadshot: boolean): void {
    this.killFeed.unshift({ id: `${Date.now()}_${Math.random()}`, text, isHeadshot });
    if (this.killFeed.length > 4) this.killFeed.length = 4;
  }

  private emitHud(force: boolean): void {
    const now = performance.now();
    if (!force && now - this.lastHudEmitMs < 100) return;
    this.lastHudEmitMs = now;

    const local = this.actors.get(this.localId);
    const spectated = this.actors.get(this.spectateTargetId);
    const active = this.mode === 'spectate' ? spectated : local;
    const weaponId = active?.weaponId ?? 'ak47';
    const spec = WEAPONS[weaponId];
    const zoneRadius = getDangerZoneRadius(this.roundTimer, ROUND_DURATION_SEC);

    this.onHudUpdate({
      mode: this.mode,
      state: this.simState,
      roundNumber: this.roundNumber,
      scoreA: this.scoreA,
      scoreB: this.scoreB,
      roundTimeLeft: Math.max(0, Math.ceil(ROUND_DURATION_SEC - this.roundTimer)),
      roundWinner: this.roundWinner,
      matchWinner: this.matchWinner,
      myTeam: active?.team ?? 'A',
      hp: Math.round(active?.hp ?? 0),
      armor: Math.round(active?.armor ?? 0),
      weaponId,
      ammo: active?.ammo ?? spec.magSize,
      maxAmmo: spec.magSize,
      reloading: (active?.reloadingUntilMs ?? 0) > now,
      glooCount: active?.glooCount ?? 0,
      isAds: this.mouseAdsHeld,
      hitMarker: this.hitMarkerType,
      dangerZoneRadius: Math.round(zoneRadius),
      outsideZone: active ? Math.hypot(active.x, active.z) > zoneRadius : false,
      kills: active?.kills ?? 0,
      damageDealt: Math.round(active?.damageDealt ?? 0),
      spectateTargetName: spectated ? `${spectated.name}#${spectated.tag4}` : 'Arena Cam',
      spectateTargets: Array.from(this.actors.values()).map((a) => ({
        id: a.id,
        name: `${a.name}#${a.tag4}`,
        team: a.team,
        hp: Math.round(a.hp),
        alive: a.alive,
      })),
      killFeed: [...this.killFeed],
      pointerLocked: this.pointerLocked,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.removeEventListener('mousedown', this.onCanvasMouseDown);
    window.removeEventListener('mouseup', this.onCanvasMouseUp);
    window.removeEventListener('mousemove', this.onCanvasMouseMove);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.exitPointerLock();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
