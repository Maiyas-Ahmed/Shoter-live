export type WeaponId = 'mp40' | 'ak47' | 'm1887' | 'awm';
export type TeamId = 'A' | 'B';
export type GameMode = '1v1' | '2v2';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  role: string;
  damage: number;
  headshotMult: number;
  fireRateMs: number;
  magSize: number;
  reloadMs: number;
  spread: number;
  pellets: number;
  range: number;
  adsFov: number;
  color: number;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  mp40: {
    id: 'mp40',
    name: 'MP40 Viper',
    role: 'Rapid SMG · Close Range',
    damage: 19,
    headshotMult: 2.1,
    fireRateMs: 95,
    magSize: 28,
    reloadMs: 1350,
    spread: 0.032,
    pellets: 1,
    range: 46,
    adsFov: 56,
    color: 0xf59e0b,
  },
  ak47: {
    id: 'ak47',
    name: 'AK-47 Inferno',
    role: 'Heavy AR · All-Range',
    damage: 32,
    headshotMult: 2.35,
    fireRateMs: 155,
    magSize: 24,
    reloadMs: 1650,
    spread: 0.02,
    pellets: 1,
    range: 75,
    adsFov: 50,
    color: 0xef4444,
  },
  m1887: {
    id: 'm1887',
    name: 'M1887 Breaker',
    role: 'Double-Barrel · Burst',
    damage: 20,
    headshotMult: 1.75,
    fireRateMs: 680,
    magSize: 2,
    reloadMs: 1450,
    spread: 0.068,
    pellets: 6,
    range: 28,
    adsFov: 58,
    color: 0x38bdf8,
  },
  awm: {
    id: 'awm',
    name: 'AWM Striker',
    role: 'Precision Sniper · Lethal',
    damage: 98,
    headshotMult: 2.2,
    fireRateMs: 1150,
    magSize: 5,
    reloadMs: 2100,
    spread: 0.002,
    pellets: 1,
    range: 110,
    adsFov: 28,
    color: 0x22c55e,
  },
};

export const WEAPON_LIST: WeaponSpec[] = [
  WEAPONS.mp40,
  WEAPONS.ak47,
  WEAPONS.m1887,
  WEAPONS.awm,
];

export const ARENA_HALF_EXTENT = 32; // 64m x 64m playable Lone Wolf yard
export const TARGET_ROUNDS = 5; // First to 5 rounds wins
export const ROUND_DURATION_SEC = 60;
export const PLAYER_MAX_HP = 200;
export const PLAYER_MAX_ARMOR = 100;
export const PLAYER_RADIUS = 0.55;
export const PLAYER_HEIGHT = 1.85;

export interface ArenaObstacle {
  id: string;
  kind: 'container' | 'bunker' | 'pillar' | 'tower' | 'crate';
  x: number;
  y: number; // bottom center Y
  z: number;
  w: number;
  h: number;
  d: number;
  color: number;
}

// Symmetric Lone Wolf tactical arena layout with clear center lanes and flanking covers
export const ARENA_OBSTACLES: ArenaObstacle[] = [
  // Center dual shipping containers creating a central cross-alley
  { id: 'c_center_w', kind: 'container', x: -7.5, y: 0, z: 0, w: 3.2, h: 3.1, d: 8.5, color: 0x9a3412 },
  { id: 'c_center_e', kind: 'container', x: 7.5, y: 0, z: 0, w: 3.2, h: 3.1, d: 8.5, color: 0x1e40af },

  // Midfield sandbag bunkers for peek-shooting
  { id: 'b_mid_n', kind: 'bunker', x: 0, y: 0, z: -7.5, w: 4.8, h: 1.25, d: 1.3, color: 0x927958 },
  { id: 'b_mid_s', kind: 'bunker', x: 0, y: 0, z: 7.5, w: 4.8, h: 1.25, d: 1.3, color: 0x927958 },

  // Wing shipping containers (diagonal cover)
  { id: 'c_nw', kind: 'container', x: -17, y: 0, z: -10, w: 7.5, h: 3.1, d: 3.0, color: 0x334155 },
  { id: 'c_ne', kind: 'container', x: 17, y: 0, z: -10, w: 7.5, h: 3.1, d: 3.0, color: 0x3f6212 },
  { id: 'c_sw', kind: 'container', x: -17, y: 0, z: 10, w: 7.5, h: 3.1, d: 3.0, color: 0x3f6212 },
  { id: 'c_se', kind: 'container', x: 17, y: 0, z: 10, w: 7.5, h: 3.1, d: 3.0, color: 0x334155 },

  // Corner watchtowers (tall silhouette landmarks)
  { id: 't_nw', kind: 'tower', x: -24, y: 0, z: -22, w: 3.4, h: 6.4, d: 3.4, color: 0x475569 },
  { id: 't_se', kind: 'tower', x: 24, y: 0, z: 22, w: 3.4, h: 6.4, d: 3.4, color: 0x475569 },

  // Spawn protection crates (offset so spawn line-of-sight stays open!)
  { id: 'k_na', kind: 'crate', x: -5.5, y: 0, z: -18, w: 2.2, h: 1.7, d: 2.2, color: 0x78553a },
  { id: 'k_nb', kind: 'crate', x: 5.5, y: 0, z: -18, w: 2.2, h: 1.7, d: 2.2, color: 0x78553a },
  { id: 'k_sa', kind: 'crate', x: -5.5, y: 0, z: 18, w: 2.2, h: 1.7, d: 2.2, color: 0x78553a },
  { id: 'k_sb', kind: 'crate', x: 5.5, y: 0, z: 18, w: 2.2, h: 1.7, d: 2.2, color: 0x78553a },

  // Outer wing pillars
  { id: 'p_w', kind: 'pillar', x: -23, y: 0, z: 0, w: 2.4, h: 4.2, d: 2.4, color: 0x334155 },
  { id: 'p_e', kind: 'pillar', x: 23, y: 0, z: 0, w: 2.4, h: 4.2, d: 2.4, color: 0x334155 },
];

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export function getSpawnPoint(team: TeamId, slot: number): SpawnPoint {
  // Team A spawns at Z = -25 facing +Z (yaw = Math.PI)
  // Team B spawns at Z = +25 facing -Z (yaw = 0)
  const offsetX = slot === 0 ? -2.2 : 2.2;
  if (team === 'A') {
    return { x: offsetX, y: 0, z: -25, yaw: Math.PI };
  }
  return { x: -offsetX, y: 0, z: 25, yaw: 0 };
}

export interface DamageInput {
  hp: number;
  armor: number;
  rawDamage: number;
  isHeadshot: boolean;
  headshotMult: number;
}

export interface DamageResult {
  hp: number;
  armor: number;
  appliedDamage: number;
  alive: boolean;
}

export function applyDamage(input: DamageInput): DamageResult {
  const scaled = input.isHeadshot
    ? Math.round(input.rawDamage * input.headshotMult)
    : Math.round(input.rawDamage);

  let remainingArmor = Math.max(0, input.armor);
  let hpDamage = scaled;

  if (remainingArmor > 0) {
    // Vest absorbs 35% of body damage or 20% of headshot damage
    const absorbRatio = input.isHeadshot ? 0.2 : 0.35;
    const absorbed = Math.min(remainingArmor, Math.round(scaled * absorbRatio));
    remainingArmor = Math.max(0, remainingArmor - absorbed);
    hpDamage = Math.max(1, scaled - absorbed);
  }

  const nextHp = Math.max(0, Math.round(input.hp - hpDamage));
  return {
    hp: nextHp,
    armor: remainingArmor,
    appliedDamage: Math.min(input.hp, hpDamage),
    alive: nextHp > 0,
  };
}

export interface RoundEvaluationInput {
  scoreA: number;
  scoreB: number;
  teamAAlive: number;
  teamBAlive: number;
  elapsedSec: number;
  roundDurationSec?: number;
  targetRounds?: number;
}

export interface RoundEvaluationResult {
  roundEnded: boolean;
  roundWinner: 'A' | 'B' | 'draw' | '';
  newScoreA: number;
  newScoreB: number;
  matchEnded: boolean;
  matchWinner: '' | 'A' | 'B';
}

/**
 * First-to-5 Lone Wolf Round Rule:
 * Even if Team A leads 4-0, Team B wins the match if Team B wins 5 rounds (4-5).
 * Whichever team reaches targetRounds (5) first wins the match.
 */
export function resolveRoundOutcome(input: RoundEvaluationInput): RoundEvaluationResult {
  const target = input.targetRounds ?? TARGET_ROUNDS;
  const maxSec = input.roundDurationSec ?? ROUND_DURATION_SEC;

  let roundWinner: 'A' | 'B' | 'draw' | '' = '';
  if (input.teamAAlive <= 0 && input.teamBAlive <= 0) {
    roundWinner = 'draw';
  } else if (input.teamBAlive <= 0) {
    roundWinner = 'A';
  } else if (input.teamAAlive <= 0) {
    roundWinner = 'B';
  } else if (input.elapsedSec >= maxSec) {
    // Time expired: team with more alive players wins, else draw
    if (input.teamAAlive > input.teamBAlive) {
      roundWinner = 'A';
    } else if (input.teamBAlive > input.teamAAlive) {
      roundWinner = 'B';
    } else {
      roundWinner = 'draw';
    }
  }

  if (roundWinner === '') {
    return {
      roundEnded: false,
      roundWinner: '',
      newScoreA: input.scoreA,
      newScoreB: input.scoreB,
      matchEnded: false,
      matchWinner: '',
    };
  }

  const newScoreA = roundWinner === 'A' ? Math.min(target, input.scoreA + 1) : input.scoreA;
  const newScoreB = roundWinner === 'B' ? Math.min(target, input.scoreB + 1) : input.scoreB;

  let matchWinner: '' | 'A' | 'B' = '';
  if (newScoreA >= target) {
    matchWinner = 'A';
  } else if (newScoreB >= target) {
    matchWinner = 'B';
  }

  return {
    roundEnded: true,
    roundWinner,
    newScoreA,
    newScoreB,
    matchEnded: matchWinner !== '',
    matchWinner,
  };
}

export interface DynamicBox {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
}

export function clampToArena(x: number, z: number, radius = PLAYER_RADIUS): { x: number; z: number } {
  const limit = ARENA_HALF_EXTENT - radius;
  return {
    x: Math.max(-limit, Math.min(limit, x)),
    z: Math.max(-limit, Math.min(limit, z)),
  };
}

export function resolveCircleBoxCollisions(
  x: number,
  z: number,
  radius: number,
  boxes: readonly DynamicBox[],
): { x: number; z: number } {
  let nx = x;
  let nz = z;

  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const halfW = b.w * 0.5;
    const halfD = b.d * 0.5;
    const minX = b.x - halfW;
    const maxX = b.x + halfW;
    const minZ = b.z - halfD;
    const maxZ = b.z + halfD;

    const closestX = Math.max(minX, Math.min(nx, maxX));
    const closestZ = Math.max(minZ, Math.min(nz, maxZ));
    const dx = nx - closestX;
    const dz = nz - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      if (distSq > 1e-8) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        nx += (dx / dist) * push;
        nz += (dz / dist) * push;
      } else {
        // Inside AABB: push out along shallowest axis
        const penLeft = nx - minX;
        const penRight = maxX - nx;
        const penTop = nz - minZ;
        const penBottom = maxZ - nz;
        const minPen = Math.min(penLeft, penRight, penTop, penBottom);
        if (minPen === penLeft) nx = minX - radius;
        else if (minPen === penRight) nx = maxX + radius;
        else if (minPen === penTop) nz = minZ - radius;
        else nz = maxZ + radius;
      }
    }
  }

  return clampToArena(nx, nz, radius);
}

/**
 * Slab method ray-AABB intersection. Returns hit distance >= 0 or null if no hit within maxDist.
 */
export function rayIntersectsBox(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  box: DynamicBox,
): number | null {
  const minX = box.x - box.w * 0.5;
  const maxX = box.x + box.w * 0.5;
  const minY = box.y;
  const maxY = box.y + box.h;
  const minZ = box.z - box.d * 0.5;
  const maxZ = box.z + box.d * 0.5;

  let tmin = 0;
  let tmax = maxDist;

  const invX = Math.abs(dx) > 1e-8 ? 1 / dx : 1e8;
  let t1 = (minX - ox) * invX;
  let t2 = (maxX - ox) * invX;
  if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
  tmin = Math.max(tmin, t1);
  tmax = Math.min(tmax, t2);
  if (tmin > tmax) return null;

  const invY = Math.abs(dy) > 1e-8 ? 1 / dy : 1e8;
  t1 = (minY - oy) * invY;
  t2 = (maxY - oy) * invY;
  if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
  tmin = Math.max(tmin, t1);
  tmax = Math.min(tmax, t2);
  if (tmin > tmax) return null;

  const invZ = Math.abs(dz) > 1e-8 ? 1 / dz : 1e8;
  t1 = (minZ - oz) * invZ;
  t2 = (maxZ - oz) * invZ;
  if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
  tmin = Math.max(tmin, t1);
  tmax = Math.min(tmax, t2);
  if (tmin > tmax) return null;

  return tmin >= 0 && tmin <= maxDist ? tmin : null;
}

export function rayIntersectsTargetCylinder(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  tx: number,
  ty: number,
  tz: number,
): { dist: number; isHeadshot: boolean } | null {
  // Check head sphere first (y = ty + 1.56, r = 0.28)
  const headY = ty + 1.56;
  const headR = 0.3;
  const hcx = ox - tx;
  const hcy = oy - headY;
  const hcz = oz - tz;
  const bHead = hcx * dx + hcy * dy + hcz * dz;
  const cHead = hcx * hcx + hcy * hcy + hcz * hcz - headR * headR;
  const discHead = bHead * bHead - cHead;
  if (discHead >= 0) {
    const tHead = -bHead - Math.sqrt(discHead);
    if (tHead >= 0 && tHead <= maxDist) {
      return { dist: tHead, isHeadshot: true };
    }
  }

  // Check torso capsule/box (y in [ty + 0.1, ty + 1.4], radius = 0.44)
  const bodyBox: DynamicBox = { x: tx, y: ty + 0.05, z: tz, w: 0.88, h: 1.38, d: 0.88 };
  const tBody = rayIntersectsBox(ox, oy, oz, dx, dy, dz, maxDist, bodyBox);
  if (tBody !== null) {
    return { dist: tBody, isHeadshot: false };
  }

  return null;
}

export function normalizeTag4(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length === 4) return digits;
  if (digits.length === 0) {
    return String(1000 + Math.floor(Math.random() * 9000));
  }
  return digits.padEnd(4, '0');
}

export function sanitizePlayerName(raw: string): string {
  const trimmed = raw.trim().slice(0, 24);
  return trimmed.length > 0 ? trimmed : 'WolfPlayer';
}

export function buildPlayerId(name: string, tag4: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 16) || 'wolf';
  const randSuffix = Math.random().toString(36).slice(2, 6);
  return `${slug}_${tag4}_${randSuffix}`;
}

export function generateRoomCode(prefix = 'LW'): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = prefix;
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateSpectatorCode(): string {
  return generateRoomCode('SP');
}

export function getDangerZoneRadius(elapsedSec: number, roundDurationSec = ROUND_DURATION_SEC): number {
  if (elapsedSec <= 30) return ARENA_HALF_EXTENT + 4;
  const t = Math.min(1, (elapsedSec - 30) / Math.max(1, roundDurationSec - 30));
  return (ARENA_HALF_EXTENT + 4) * (1 - t) + 5 * t;
}

export interface RoomReadinessInput {
  mode: GameMode;
  isPrivate: boolean;
  participants: readonly { team: TeamId; isBot: boolean }[];
}

export interface RoomReadinessResult {
  canStart: boolean;
  realA: number;
  realB: number;
  requiredPerTeam: number;
  reason: string;
}

/**
 * Pure Online Rule: Online matches & custom rooms NEVER auto-fill with bots.
 * Quick Online requires full real teams (1v1 = 1+1, 2v2 = 2+2).
 * Custom Rooms require at least 1 real human player on both Team A and Team B.
 */
export function evaluateOnlineRoomReadiness(input: RoomReadinessInput): RoomReadinessResult {
  const realA = input.participants.filter((p) => p.team === 'A' && !p.isBot).length;
  const realB = input.participants.filter((p) => p.team === 'B' && !p.isBot).length;
  const requiredPerTeam = input.mode === '1v1' ? 1 : 2;

  if (input.isPrivate) {
    if (realA < 1 || realB < 1) {
      return {
        canStart: false,
        realA,
        realB,
        requiredPerTeam,
        reason:
          realB < 1
            ? 'Waiting for a real player to join Team B (share Room Code).'
            : 'Waiting for a real player on Team A.',
      };
    }
    return { canStart: true, realA, realB, requiredPerTeam, reason: 'Ready to launch' };
  }

  if (realA < requiredPerTeam || realB < requiredPerTeam) {
    const totalNow = realA + realB;
    const totalNeeded = requiredPerTeam * 2;
    return {
      canStart: false,
      realA,
      realB,
      requiredPerTeam,
      reason: `Searching for real online players (${totalNow}/${totalNeeded} joined)...`,
    };
  }

  return { canStart: true, realA, realB, requiredPerTeam, reason: 'All real players matched!' };
}

