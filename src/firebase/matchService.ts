import { signInWithPopup } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  generateRoomCode,
  generateSpectatorCode,
  getSpawnPoint,
  ROUND_DURATION_SEC,
  TARGET_ROUNDS,
  type GameMode,
  type TeamId,
  type WeaponId,
} from '../game/rules';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './client';

export interface PlayerProfile {
  playerId: string;
  name: string;
  tag4: string;
  googleUid: string;
  wins: number;
  matches: number;
  kills: number;
  status: 'online' | 'in_lobby' | 'in_match' | 'offline';
  currentRoomId: string;
}

export interface FriendRequestDoc {
  requestId: string;
  fromId: string;
  fromName: string;
  fromTag4: string;
  toId: string;
  toName: string;
  toTag4: string;
  status: 'pending' | 'accepted' | 'declined';
  roomInviteCode: string;
}

export interface MatchRoomDoc {
  roomId: string;
  spectatorCode: string;
  mode: GameMode;
  isPrivate: boolean;
  hostId: string;
  hostName: string;
  status: 'waiting' | 'loadout' | 'playing' | 'round_end' | 'finished';
  targetRounds: number;
  roundNumber: number;
  scoreA: number;
  scoreB: number;
  roundWinner: '' | 'A' | 'B' | 'draw';
  matchWinner: '' | 'A' | 'B';
  roundStartedAtMs: number;
  roundDurationSec: number;
  fillWithBots: boolean;
  spectatorCount: number;
}

export interface RoomParticipantDoc {
  participantId: string;
  roomId: string;
  name: string;
  tag4: string;
  team: TeamId;
  slot: number;
  isBot: boolean;
  ready: boolean;
  weaponId: WeaponId;
  hp: number;
  armor: number;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vz: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  glooCount: number;
}

export interface RoomEventDoc {
  eventId: string;
  roomId: string;
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
  createdAtMs: number;
}

function isOfflineError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return msg.includes('offline') || msg.includes('unavailable') || msg.includes('network');
}

export async function upsertPlayerProfile(profile: PlayerProfile): Promise<void> {
  const path = `players/${profile.playerId}`;
  const ref = doc(db, 'players', profile.playerId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        playerId: profile.playerId,
        name: profile.name.slice(0, 24),
        tag4: profile.tag4,
        googleUid: profile.googleUid || '',
        wins: Math.max(0, Math.floor(profile.wins)),
        matches: Math.max(0, Math.floor(profile.matches)),
        kills: Math.max(0, Math.floor(profile.kills)),
        status: profile.status,
        currentRoomId: profile.currentRoomId.slice(0, 32),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: profile.name.slice(0, 24),
        tag4: profile.tag4,
        status: profile.status,
        currentRoomId: profile.currentRoomId.slice(0, 32),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    if (isOfflineError(err)) return;
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function linkGoogleAccount(profile: PlayerProfile): Promise<PlayerProfile | null> {
  const result = await signInWithPopup(auth, googleProvider);
  const uid = result.user?.uid;
  if (!uid) return null;
  const path = `players/${profile.playerId}`;
  try {
    await updateDoc(doc(db, 'players', profile.playerId), {
      googleUid: uid,
      updatedAt: serverTimestamp(),
    });
    return { ...profile, googleUid: uid };
  } catch (err) {
    if (isOfflineError(err)) return null;
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function incrementPlayerStats(
  player: PlayerProfile,
  won: boolean,
  killsAdded: number,
): Promise<void> {
  const path = `players/${player.playerId}`;
  try {
    const snap = await getDoc(doc(db, 'players', player.playerId));
    const data = snap.exists() ? (snap.data() as Partial<PlayerProfile>) : {};
    const curWins = Math.max(player.wins, Number(data.wins || 0));
    const curMatches = Math.max(player.matches, Number(data.matches || 0));
    const curKills = Math.max(player.kills, Number(data.kills || 0));
    await updateDoc(doc(db, 'players', player.playerId), {
      wins: curWins + (won ? 1 : 0),
      matches: curMatches + 1,
      kills: curKills + Math.max(0, Math.floor(killsAdded)),
      status: 'in_lobby',
      currentRoomId: '',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (isOfflineError(err)) return;
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeOnlinePlayers(
  onUpdate: (players: PlayerProfile[]) => void,
): Unsubscribe {
  const path = 'players';
  const q = query(
    collection(db, 'players'),
    where('status', 'in', ['online', 'in_lobby', 'in_match', 'offline']),
    limit(30),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: PlayerProfile[] = [];
      snap.forEach((d) => {
        const data = d.data() as PlayerProfile;
        list.push(data);
      });
      onUpdate(list);
    },
    (err) => {
      if (isOfflineError(err)) return;
      handleFirestoreError(err, OperationType.LIST, path);
    },
  );
}

export async function sendFriendRequest(
  from: PlayerProfile,
  to: PlayerProfile,
): Promise<void> {
  const requestId = `${from.playerId}__${to.playerId}`.slice(0, 128);
  const path = `friendRequests/${requestId}`;
  try {
    await setDoc(doc(db, 'friendRequests', requestId), {
      requestId,
      fromId: from.playerId,
      fromName: from.name.slice(0, 24),
      fromTag4: from.tag4,
      toId: to.playerId,
      toName: to.name.slice(0, 24),
      toTag4: to.tag4,
      status: 'pending',
      roomInviteCode: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (isOfflineError(err)) return;
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function respondFriendRequest(
  requestId: string,
  status: 'accepted' | 'declined',
): Promise<void> {
  const path = `friendRequests/${requestId}`;
  try {
    await updateDoc(doc(db, 'friendRequests', requestId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (isOfflineError(err)) return;
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function sendRoomInvite(requestId: string, roomCode: string): Promise<void> {
  const path = `friendRequests/${requestId}`;
  try {
    await updateDoc(doc(db, 'friendRequests', requestId), {
      roomInviteCode: roomCode.slice(0, 16),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (isOfflineError(err)) return;
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeFriendRequests(
  playerId: string,
  onUpdate: (requests: FriendRequestDoc[]) => void,
): Unsubscribe {
  const path = 'friendRequests';
  const q = query(
    collection(db, 'friendRequests'),
    where('status', 'in', ['pending', 'accepted']),
    limit(50),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: FriendRequestDoc[] = [];
      snap.forEach((d) => {
        const item = d.data() as FriendRequestDoc;
        if (item.fromId === playerId || item.toId === playerId) {
          list.push(item);
        }
      });
      onUpdate(list);
    },
    (err) => {
      if (isOfflineError(err)) return;
      handleFirestoreError(err, OperationType.LIST, path);
    },
  );
}

export async function createMatchRoom(params: {
  host: PlayerProfile;
  mode: GameMode;
  isPrivate: boolean;
  fillWithBots: boolean;
}): Promise<MatchRoomDoc> {
  const roomId = generateRoomCode('LW');
  const spectatorCode = generateSpectatorCode();
  const roomData: MatchRoomDoc = {
    roomId,
    spectatorCode,
    mode: params.mode,
    isPrivate: params.isPrivate,
    hostId: params.host.playerId,
    hostName: params.host.name.slice(0, 24),
    status: 'waiting',
    targetRounds: TARGET_ROUNDS,
    roundNumber: 1,
    scoreA: 0,
    scoreB: 0,
    roundWinner: '',
    matchWinner: '',
    roundStartedAtMs: 0,
    roundDurationSec: ROUND_DURATION_SEC,
    fillWithBots: params.fillWithBots,
    spectatorCount: 0,
  };

  const roomPath = `rooms/${roomId}`;
  try {
    await setDoc(doc(db, 'rooms', roomId), {
      ...roomData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, roomPath);
  }

  await joinParticipant(roomId, params.host, 'A', 0, false);
  return roomData;
}

export async function joinParticipant(
  roomId: string,
  player: { playerId: string; name: string; tag4: string },
  team: TeamId,
  slot: number,
  isBot: boolean,
): Promise<void> {
  const spawn = getSpawnPoint(team, slot);
  const path = `rooms/${roomId}/participants/${player.playerId}`;
  try {
    await setDoc(doc(db, 'rooms', roomId, 'participants', player.playerId), {
      participantId: player.playerId,
      roomId,
      name: player.name.slice(0, 24),
      tag4: player.tag4,
      team,
      slot,
      isBot,
      ready: isBot,
      weaponId: 'ak47' as WeaponId,
      hp: 200,
      armor: 100,
      alive: true,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      yaw: spawn.yaw,
      pitch: 0,
      vx: 0,
      vz: 0,
      kills: 0,
      deaths: 0,
      damageDealt: 0,
      glooCount: 2,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function findOrCreateQuickRoom(
  player: PlayerProfile,
  mode: GameMode,
): Promise<MatchRoomDoc> {
  const path = 'rooms';
  try {
    const q = query(
      collection(db, 'rooms'),
      where('isPrivate', '==', false),
      where('mode', '==', mode),
      where('status', '==', 'waiting'),
      limit(10),
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const room = d.data() as MatchRoomDoc;
      const partsQ = query(
        collection(db, 'rooms', room.roomId, 'participants'),
        where('roomId', '==', room.roomId),
      );
      const partsSnap = await getDocs(partsQ);
      const parts = partsSnap.docs.map((p) => p.data() as RoomParticipantDoc);
      const realParts = parts.filter((p) => !p.isBot);
      // Skip abandoned waiting rooms with no real players
      if (realParts.length === 0) continue;

      const existing = realParts.find((p) => p.participantId === player.playerId);
      if (existing) return room;

      const maxPerTeam = mode === '1v1' ? 1 : 2;
      const teamACount = realParts.filter((p) => p.team === 'A').length;
      const teamBCount = realParts.filter((p) => p.team === 'B').length;

      if (teamBCount < maxPerTeam) {
        await joinParticipant(room.roomId, player, 'B', teamBCount, false);
        return room;
      }
      if (teamACount < maxPerTeam) {
        await joinParticipant(room.roomId, player, 'A', teamACount, false);
        return room;
      }
    }
  } catch (err) {
    if (!isOfflineError(err)) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  }

  return createMatchRoom({
    host: player,
    mode,
    isPrivate: false,
    fillWithBots: false,
  });
}

export async function joinRoomByCode(
  rawCode: string,
  player: PlayerProfile,
): Promise<MatchRoomDoc | null> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  const path = `rooms/${code}`;
  try {
    const snap = await getDoc(doc(db, 'rooms', code));
    if (!snap.exists()) return null;
    const room = snap.data() as MatchRoomDoc;
    if (room.status === 'finished') return null;

    const partsQ = query(
      collection(db, 'rooms', code, 'participants'),
      where('roomId', '==', code),
    );
    const partsSnap = await getDocs(partsQ);
    const parts = partsSnap.docs.map((p) => p.data() as RoomParticipantDoc);
    const existing = parts.find((p) => p.participantId === player.playerId);
    if (existing) return room;

    const maxPerTeam = room.mode === '1v1' ? 1 : 2;
    const teamA = parts.filter((p) => p.team === 'A' && !p.isBot);
    const teamB = parts.filter((p) => p.team === 'B' && !p.isBot);

    if (teamB.length < maxPerTeam) {
      await joinParticipant(code, player, 'B', teamB.length, false);
      return room;
    }
    if (teamA.length < maxPerTeam) {
      await joinParticipant(code, player, 'A', teamA.length, false);
      return room;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function findRoomForSpectate(rawCode: string): Promise<MatchRoomDoc | null> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  const path = 'rooms';
  try {
    // Allow entering either the Room Code (LWxxxx) or Spectator Code (SPxxxx)
    const directSnap = await getDoc(doc(db, 'rooms', code));
    if (directSnap.exists()) {
      return directSnap.data() as MatchRoomDoc;
    }
    const q = query(collection(db, 'rooms'), where('spectatorCode', '==', code), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as MatchRoomDoc;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export function subscribeLiveRooms(onUpdate: (rooms: MatchRoomDoc[]) => void): Unsubscribe {
  const q = query(
    collection(db, 'rooms'),
    where('status', 'in', ['waiting', 'loadout', 'playing', 'round_end']),
    limit(12),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: MatchRoomDoc[] = [];
      snap.forEach((d) => {
        const r = d.data() as MatchRoomDoc;
        list.push(r);
      });
      onUpdate(list);
    },
    (err) => {
      if (isOfflineError(err)) return;
      handleFirestoreError(err, OperationType.LIST, 'rooms');
    },
  );
}

export function subscribeRoom(
  roomId: string,
  onRoom: (room: MatchRoomDoc | null) => void,
  onParticipants: (participants: RoomParticipantDoc[]) => void,
  onEvents: (events: RoomEventDoc[]) => void,
): Unsubscribe {
  const unsubRoom = onSnapshot(
    doc(db, 'rooms', roomId),
    (snap) => {
      onRoom(snap.exists() ? (snap.data() as MatchRoomDoc) : null);
    },
    (err) => {
      if (isOfflineError(err)) return;
      handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`);
    },
  );

  const partsQ = query(
    collection(db, 'rooms', roomId, 'participants'),
    where('roomId', '==', roomId),
  );
  const unsubParts = onSnapshot(
    partsQ,
    (snap) => {
      const list: RoomParticipantDoc[] = [];
      snap.forEach((d) => list.push(d.data() as RoomParticipantDoc));
      onParticipants(list);
    },
    (err) => {
      if (isOfflineError(err)) return;
      handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/participants`);
    },
  );

  const eventsQ = query(
    collection(db, 'rooms', roomId, 'events'),
    where('createdAtMs', '>=', 0),
    orderBy('createdAtMs', 'desc'),
    limit(20),
  );
  const unsubEvents = onSnapshot(
    eventsQ,
    (snap) => {
      const list: RoomEventDoc[] = [];
      snap.forEach((d) => list.push(d.data() as RoomEventDoc));
      onEvents(list);
    },
    (err) => {
      if (isOfflineError(err)) return;
      handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/events`);
    },
  );

  return () => {
    unsubRoom();
    unsubParts();
    unsubEvents();
  };
}

export async function updateParticipantLoadout(
  roomId: string,
  participantId: string,
  patch: { ready?: boolean; weaponId?: WeaponId; team?: TeamId; slot?: number },
): Promise<void> {
  const path = `rooms/${roomId}/participants/${participantId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId, 'participants', participantId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (isOfflineError(err)) return;
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateParticipantTransform(
  roomId: string,
  participantId: string,
  state: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    vx: number;
    vz: number;
    weaponId: WeaponId;
    glooCount: number;
  },
): Promise<void> {
  const path = `rooms/${roomId}/participants/${participantId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId, 'participants', participantId), {
      x: Math.max(-99, Math.min(99, state.x)),
      y: Math.max(-5, Math.min(45, state.y)),
      z: Math.max(-99, Math.min(99, state.z)),
      yaw: state.yaw,
      pitch: Math.max(-3.5, Math.min(3.5, state.pitch)),
      vx: Math.max(-45, Math.min(45, state.vx)),
      vz: Math.max(-45, Math.min(45, state.vz)),
      weaponId: state.weaponId,
      glooCount: Math.max(0, Math.min(2, state.glooCount)),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (isOfflineError(err)) return;
    // Ignore benign errors if room finished mid-frame
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('PERMISSION_DENIED')) return;
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateParticipantCombatState(
  roomId: string,
  participantId: string,
  patch: Partial<
    Pick<
      RoomParticipantDoc,
      | 'hp'
      | 'armor'
      | 'alive'
      | 'x'
      | 'y'
      | 'z'
      | 'yaw'
      | 'pitch'
      | 'vx'
      | 'vz'
      | 'kills'
      | 'deaths'
      | 'damageDealt'
      | 'glooCount'
      | 'weaponId'
      | 'ready'
    >
  >,
): Promise<void> {
  const path = `rooms/${roomId}/participants/${participantId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId, 'participants', participantId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (isOfflineError(err)) return;
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('PERMISSION_DENIED')) return;
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateRoomState(
  roomId: string,
  patch: Pick<
    MatchRoomDoc,
    'status' | 'roundNumber' | 'scoreA' | 'scoreB' | 'roundWinner' | 'matchWinner' | 'roundStartedAtMs'
  >,
): Promise<void> {
  const path = `rooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (isOfflineError(err)) return;
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('PERMISSION_DENIED')) return;
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function publishRoomEvent(
  roomId: string,
  event: Omit<RoomEventDoc, 'eventId' | 'roomId'>,
): Promise<void> {
  const eventId = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `rooms/${roomId}/events/${eventId}`;
  try {
    await setDoc(doc(db, 'rooms', roomId, 'events', eventId), {
      ...event,
      eventId,
      roomId,
    });
  } catch (err) {
    if (isOfflineError(err)) return;
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('PERMISSION_DENIED')) return;
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function adjustSpectatorCount(roomId: string, delta: number): Promise<void> {
  const path = `rooms/${roomId}`;
  try {
    const snap = await getDoc(doc(db, 'rooms', roomId));
    if (!snap.exists()) return;
    const cur = Number((snap.data() as MatchRoomDoc).spectatorCount || 0);
    await updateDoc(doc(db, 'rooms', roomId), {
      spectatorCount: Math.max(0, Math.min(500, cur + delta)),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Spectator counter adjustment is non-critical
  }
}

export async function leaveRoomParticipant(
  roomId: string,
  participantId: string,
  isHost = false,
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'rooms', roomId, 'participants', participantId));
    if (isHost) {
      const roomSnap = await getDoc(doc(db, 'rooms', roomId));
      if (roomSnap.exists() && (roomSnap.data() as MatchRoomDoc).status === 'waiting') {
        await deleteDoc(doc(db, 'rooms', roomId));
      }
    }
  } catch {
    // Non-critical cleanup on leave
  }
}
