import { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GameHUD } from './components/GameHUD';
import { LobbyModal } from './components/LobbyModal';
import { MatchModals } from './components/MatchModals';
import { TitleScreen } from './components/TitleScreen';
import { TouchControls } from './components/TouchControls';
import { testConnection } from './firebase/client';
import {
  adjustSpectatorCount,
  createMatchRoom,
  findOrCreateQuickRoom,
  findRoomForSpectate,
  incrementPlayerStats,
  joinRoomByCode,
  leaveRoomParticipant,
  linkGoogleAccount,
  publishRoomEvent,
  respondFriendRequest,
  sendFriendRequest,
  sendRoomInvite,
  subscribeFriendRequests,
  subscribeLiveRooms,
  subscribeOnlinePlayers,
  subscribeRoom,
  updateParticipantCombatState,
  updateParticipantLoadout,
  updateParticipantTransform,
  updateRoomState,
  upsertPlayerProfile,
  type FriendRequestDoc,
  type MatchRoomDoc,
  type PlayerProfile,
  type RoomEventDoc,
  type RoomParticipantDoc,
} from './firebase/matchService';
import {
  buildPlayerId,
  evaluateOnlineRoomReadiness,
  getSpawnPoint,
  normalizeTag4,
  PLAYER_MAX_ARMOR,
  PLAYER_MAX_HP,
  sanitizePlayerName,
  type GameMode,
  type WeaponId,
} from './game/rules';
import { ArenaEngine, type HudSnapshot } from './three/ArenaEngine';

const STORAGE_KEY = 'lone_wolf_3d_profile_v1';

function loadStoredProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
      if (parsed.playerId && parsed.name && parsed.tag4) {
        return {
          playerId: parsed.playerId,
          name: parsed.name,
          tag4: parsed.tag4,
          googleUid: parsed.googleUid || '',
          wins: Number(parsed.wins || 0),
          matches: Number(parsed.matches || 0),
          kills: Number(parsed.kills || 0),
          status: 'online',
          currentRoomId: '',
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  const tag4 = normalizeTag4('');
  const name = 'WolfPlayer';
  return {
    playerId: buildPlayerId(name, tag4),
    name,
    tag4,
    googleUid: '',
    wins: 0,
    matches: 0,
    kills: 0,
    status: 'online',
    currentRoomId: '',
  };
}

function saveStoredProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

const INITIAL_HUD: HudSnapshot = {
  mode: 'tour',
  state: 'title',
  roundNumber: 1,
  scoreA: 0,
  scoreB: 0,
  roundTimeLeft: 60,
  roundWinner: '',
  matchWinner: '',
  myTeam: 'A',
  hp: PLAYER_MAX_HP,
  armor: PLAYER_MAX_ARMOR,
  weaponId: 'ak47',
  ammo: 24,
  maxAmmo: 24,
  reloading: false,
  glooCount: 2,
  isAds: false,
  hitMarker: 'none',
  dangerZoneRadius: 36,
  outsideZone: false,
  kills: 0,
  damageDealt: 0,
  spectateTargetName: '',
  spectateTargets: [],
  killFeed: [],
  pointerLocked: false,
};

function AppContent() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ArenaEngine | null>(null);

  const [profile, setProfile] = useState<PlayerProfile>(() => loadStoredProfile());
  const [screen, setScreen] = useState<'title' | 'lobby' | 'playing' | 'spectate'>('title');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponId>('ak47');
  const [muted, setMuted] = useState(false);
  const [mobileControls, setMobileControls] = useState(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 820;
  });
  const manualMobileOverrideRef = useRef(false);

  useEffect(() => {
    const onResize = () => {
      if (manualMobileOverrideRef.current) return;
      setMobileControls(
        'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 820,
      );
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Firebase Live State
  const [onlineReady, setOnlineReady] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState<PlayerProfile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequestDoc[]>([]);
  const [liveRooms, setLiveRooms] = useState<MatchRoomDoc[]>([]);
  const [activeRoom, setActiveRoom] = useState<MatchRoomDoc | null>(null);
  const [roomParticipants, setRoomParticipants] = useState<RoomParticipantDoc[]>([]);
  const [statusMessage, setStatusMessage] = useState('');

  const activeRoomRef = useRef<MatchRoomDoc | null>(null);
  const participantsRef = useRef<RoomParticipantDoc[]>([]);
  const profileRef = useRef<PlayerProfile>(profile);
  const screenRef = useRef(screen);
  const matchRecordedRef = useRef(false);

  profileRef.current = profile;
  screenRef.current = screen;

  // Sync body dataset state for testing & accessibility
  useEffect(() => {
    let ds: string = screen;
    if (screen === 'playing' || screen === 'spectate') {
      if (hud.state === 'paused') ds = 'paused';
      else if (hud.state === 'gameover') ds = 'gameover';
      else ds = 'playing';
    }
    document.body.dataset.state = ds;
  }, [screen, hud.state]);

  // Mount Three.js ArenaEngine ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new ArenaEngine(container, (snap) => {
      setHud(snap);
    });
    engineRef.current = engine;

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const p = profileRef.current;
      setScreen('playing');
      engine.startOfflineMatch({
        playerId: p.playerId,
        playerName: p.name,
        playerTag4: p.tag4,
        mode: '1v1',
        weaponId: 'ak47',
      });
    } else {
      engine.startTour('title');
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Check Firestore connectivity & subscribe to lobby feeds
  useEffect(() => {
    let unsubPlayers: (() => void) | undefined;
    let unsubFriends: (() => void) | undefined;
    let unsubRooms: (() => void) | undefined;

    testConnection().then((ok) => {
      setOnlineReady(ok);
      if (ok) {
        upsertPlayerProfile(profileRef.current).catch(() => {});
        unsubPlayers = subscribeOnlinePlayers(setOnlinePlayers);
        unsubFriends = subscribeFriendRequests(profileRef.current.playerId, setFriendRequests);
        unsubRooms = subscribeLiveRooms(setLiveRooms);
      }
    });

    return () => {
      unsubPlayers?.();
      unsubFriends?.();
      unsubRooms?.();
    };
  }, [profile.playerId]);

  // Subscribe to Active Room (waiting, online combat, or spectating)
  useEffect(() => {
    if (!activeRoom) return;
    const roomId = activeRoom.roomId;
    const isSpectator = screenRef.current === 'spectate';

    const unsub = subscribeRoom(
      roomId,
      (room) => {
        activeRoomRef.current = room;
        setActiveRoom(room);
        if (!room) return;

        if (room.status === 'playing' && screenRef.current === 'lobby') {
          // Match started by host! Launch 3D online arena
          matchRecordedRef.current = false;
          setScreen('playing');
          const p = profileRef.current;
          const isHost = room.hostId === p.playerId;
          engineRef.current?.startOnlineMatch({
            playerId: p.playerId,
            playerName: p.name,
            playerTag4: p.tag4,
            isHost,
            bridge: {
              sendTransform: (st) => updateParticipantTransform(roomId, p.playerId, st),
              sendShotEvent: (ev) =>
                publishRoomEvent(roomId, { ...ev, createdAtMs: Date.now() }),
              sendDamageUpdate: (targetId, patch, attackerKills, attackerDamage) => {
                updateParticipantCombatState(roomId, targetId, patch);
                if (attackerKills !== undefined || attackerDamage !== undefined) {
                  updateParticipantCombatState(roomId, p.playerId, {
                    kills: attackerKills,
                    damageDealt: attackerDamage,
                  });
                }
              },
              sendRoomAdvance: (patch) => updateRoomState(roomId, patch),
              resetParticipantsForRound: (list) => {
                list.forEach((item) => {
                  const sp = getSpawnPoint(item.team, item.slot);
                  updateParticipantCombatState(roomId, item.id, {
                    hp: PLAYER_MAX_HP,
                    armor: PLAYER_MAX_ARMOR,
                    alive: true,
                    x: sp.x,
                    y: 0,
                    z: sp.z,
                    yaw: sp.yaw,
                    pitch: 0,
                    vx: 0,
                    vz: 0,
                    glooCount: 2,
                  });
                });
              },
            },
          });
        }

        if (room.status !== 'waiting' && (screenRef.current === 'playing' || screenRef.current === 'spectate')) {
          engineRef.current?.syncOnlineState(room, participantsRef.current, []);
        }
      },
      (parts) => {
        participantsRef.current = parts;
        setRoomParticipants(parts);
        if (activeRoomRef.current && (screenRef.current === 'playing' || screenRef.current === 'spectate')) {
          engineRef.current?.syncOnlineState(activeRoomRef.current, parts, []);
        }
      },
      (events: RoomEventDoc[]) => {
        if (activeRoomRef.current && (screenRef.current === 'playing' || screenRef.current === 'spectate')) {
          engineRef.current?.syncOnlineState(activeRoomRef.current, participantsRef.current, events);
        }
      },
    );

    return () => {
      unsub();
      if (isSpectator) {
        adjustSpectatorCount(roomId, -1).catch(() => {});
      }
    };
  }, [activeRoom?.roomId]);

  // Persist stats when match ends
  useEffect(() => {
    if (hud.state === 'gameover' && hud.mode !== 'spectate' && !matchRecordedRef.current) {
      matchRecordedRef.current = true;
      const won = hud.matchWinner === hud.myTeam;
      const updated: PlayerProfile = {
        ...profileRef.current,
        wins: profileRef.current.wins + (won ? 1 : 0),
        matches: profileRef.current.matches + 1,
        kills: profileRef.current.kills + hud.kills,
        status: 'in_lobby',
        currentRoomId: '',
      };
      setProfile(updated);
      saveStoredProfile(updated);
      if (onlineReady) {
        incrementPlayerStats(profileRef.current, won, hud.kills).catch(() => {});
      }
    }
  }, [hud.state, hud.mode, hud.matchWinner, hud.myTeam, hud.kills, onlineReady]);

  // Global keyboard shortcuts (Title Enter/Space, Pause Esc/P, Mute M)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Enter' && screenRef.current === 'title') {
          // Form submit handles Enter inside inputs naturally
        }
        return;
      }
      if (screenRef.current === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        const startBtn = document.querySelector<HTMLButtonElement>('[data-start="true"]');
        startBtn?.click();
        return;
      }
      if ((screenRef.current === 'playing' || screenRef.current === 'spectate') && (e.key === 'Escape' || e.code === 'KeyP')) {
        if (hud.state === 'playing') {
          engineRef.current?.setPaused(true);
        } else if (hud.state === 'paused') {
          engineRef.current?.setPaused(false);
        }
      }
      if (e.code === 'KeyM' && (screenRef.current === 'playing' || screenRef.current === 'spectate')) {
        const nextMuted = soundEngine.toggleMute();
        setMuted(nextMuted);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hud.state]);

  const handleEnterLobby = useCallback(
    (rawName: string, rawTag4: string) => {
      const cleanName = sanitizePlayerName(rawName);
      const cleanTag = normalizeTag4(rawTag4);
      const next: PlayerProfile = {
        ...profile,
        playerId:
          profile.name === cleanName && profile.tag4 === cleanTag
            ? profile.playerId
            : buildPlayerId(cleanName, cleanTag),
        name: cleanName,
        tag4: cleanTag,
        status: 'in_lobby',
      };
      setProfile(next);
      saveStoredProfile(next);
      if (onlineReady) upsertPlayerProfile(next).catch(() => {});
      setScreen('lobby');
      engineRef.current?.startTour('lobby');
    },
    [profile, onlineReady],
  );

  const handleQuickOffline = useCallback(
    (rawName: string, rawTag4: string) => {
      const cleanName = sanitizePlayerName(rawName);
      const cleanTag = normalizeTag4(rawTag4);
      const next: PlayerProfile = {
        ...profile,
        name: cleanName,
        tag4: cleanTag,
        status: 'in_match',
      };
      setProfile(next);
      saveStoredProfile(next);
      matchRecordedRef.current = false;
      setScreen('playing');
      engineRef.current?.startOfflineMatch({
        playerId: next.playerId,
        playerName: next.name,
        playerTag4: next.tag4,
        mode: '1v1',
        weaponId: selectedWeapon,
      });
    },
    [profile, selectedWeapon],
  );

  const handleStartOffline = (mode: GameMode) => {
    matchRecordedRef.current = false;
    setScreen('playing');
    engineRef.current?.startOfflineMatch({
      playerId: profile.playerId,
      playerName: profile.name,
      playerTag4: profile.tag4,
      mode,
      weaponId: selectedWeapon,
    });
  };

  const handleQuickMatch = async (mode: GameMode) => {
    setStatusMessage('Searching Lone Wolf arena...');
    try {
      const room = await findOrCreateQuickRoom(profile, mode);
      setActiveRoom(room);
      setStatusMessage('');
    } catch {
      setStatusMessage('Unable to reach online matchmaking — try Offline Practice.');
    }
  };

  const handleCreateCustomRoom = async (mode: GameMode, fillWithBots: boolean) => {
    setStatusMessage('Creating custom room...');
    try {
      const room = await createMatchRoom({
        host: profile,
        mode,
        isPrivate: true,
        fillWithBots,
      });
      setActiveRoom(room);
      setStatusMessage('');
    } catch {
      setStatusMessage('Could not create room.');
    }
  };

  const handleJoinRoomCode = async (code: string) => {
    setStatusMessage(`Joining room ${code}...`);
    try {
      const room = await joinRoomByCode(code, profile);
      if (!room) {
        setStatusMessage(`Room "${code}" not found, full, or already finished.`);
        return;
      }
      setActiveRoom(room);
      setStatusMessage('');
    } catch {
      setStatusMessage('Failed to join room.');
    }
  };

  const handleSpectateCode = async (code: string) => {
    setStatusMessage(`Connecting spectator feed ${code}...`);
    try {
      const room = await findRoomForSpectate(code);
      if (!room) {
        setStatusMessage(`No live match found for code "${code}".`);
        return;
      }
      await adjustSpectatorCount(room.roomId, 1);
      setActiveRoom(room);
      setScreen('spectate');
      engineRef.current?.startSpectating(room, []);
      setStatusMessage('');
    } catch {
      setStatusMessage('Failed to open spectator feed.');
    }
  };

  const handleHostStartRoom = async () => {
    if (!activeRoom) return;
    const readiness = evaluateOnlineRoomReadiness({
      mode: activeRoom.mode,
      isPrivate: activeRoom.isPrivate,
      participants: roomParticipants,
    });
    if (!readiness.canStart) {
      setStatusMessage(readiness.reason);
      return;
    }

    setStatusMessage('');
    await updateRoomState(activeRoom.roomId, {
      status: 'playing',
      roundNumber: 1,
      scoreA: 0,
      scoreB: 0,
      roundWinner: '',
      matchWinner: '',
      roundStartedAtMs: Date.now(),
    });
  };

  const handleExitToLobby = () => {
    if (activeRoom && screen === 'playing') {
      leaveRoomParticipant(
        activeRoom.roomId,
        profile.playerId,
        activeRoom.hostId === profile.playerId,
      ).catch(() => {});
    }
    setActiveRoom(null);
    setRoomParticipants([]);
    setScreen('lobby');
    engineRef.current?.startTour('lobby');
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 select-none">
      {/* Isolated WebGL mount container */}
      <div ref={mountRef} data-testid="arena-viewport" className="fixed inset-0" />

      {screen === 'title' && (
        <TitleScreen
          initialName={profile.name}
          initialTag4={profile.tag4}
          onEnterLobby={handleEnterLobby}
          onQuickOffline={handleQuickOffline}
        />
      )}

      {screen === 'lobby' && (
        <LobbyModal
          player={profile}
          isOnlineAvailable={onlineReady}
          selectedWeapon={selectedWeapon}
          activeRoom={activeRoom}
          roomParticipants={roomParticipants}
          liveRooms={liveRooms}
          onlinePlayers={onlinePlayers}
          friendRequests={friendRequests}
          statusMessage={statusMessage}
          onSelectWeapon={(w) => {
            setSelectedWeapon(w);
            if (activeRoom) updateParticipantLoadout(activeRoom.roomId, profile.playerId, { weaponId: w });
          }}
          onStartOffline={handleStartOffline}
          onQuickMatch={handleQuickMatch}
          onCreateCustomRoom={handleCreateCustomRoom}
          onJoinRoomCode={handleJoinRoomCode}
          onSpectateCode={handleSpectateCode}
          onLeaveRoom={() => {
            if (activeRoom) {
              leaveRoomParticipant(
                activeRoom.roomId,
                profile.playerId,
                activeRoom.hostId === profile.playerId,
              ).catch(() => {});
            }
            setActiveRoom(null);
            setRoomParticipants([]);
            setStatusMessage('');
          }}
          onToggleReady={() => {
            if (!activeRoom) return;
            const me = roomParticipants.find((p) => p.participantId === profile.playerId);
            updateParticipantLoadout(activeRoom.roomId, profile.playerId, {
              ready: !me?.ready,
              weaponId: selectedWeapon,
            });
          }}
          onSwitchTeam={(team) => {
            if (!activeRoom) return;
            const count = roomParticipants.filter((p) => p.team === team).length;
            updateParticipantLoadout(activeRoom.roomId, profile.playerId, { team, slot: count });
          }}
          onHostStartRoom={handleHostStartRoom}
          onSendFriendRequest={async (target) => {
            await sendFriendRequest(profile, target);
            setStatusMessage(`Friend request sent to ${target.name}#${target.tag4}`);
          }}
          onRespondFriendRequest={async (reqId, status) => {
            await respondFriendRequest(reqId, status);
          }}
          onInviteFriendToRoom={async (reqId) => {
            if (!activeRoom) return;
            await sendRoomInvite(reqId, activeRoom.roomId);
            setStatusMessage(`Invite sent with room code ${activeRoom.roomId}`);
          }}
          onLinkGoogle={async () => {
            try {
              const linked = await linkGoogleAccount(profile);
              if (linked) {
                setProfile(linked);
                saveStoredProfile(linked);
                setStatusMessage('Google Cloud Save linked!');
              }
            } catch {
              setStatusMessage('Google link cancelled.');
            }
          }}
          onEditIdentity={() => {
            setScreen('title');
            engineRef.current?.startTour('title');
          }}
        />
      )}

      {(screen === 'playing' || screen === 'spectate') && (
        <>
          <GameHUD
            hud={hud}
            muted={muted}
            mobileControlsEnabled={mobileControls}
            roomCode={activeRoom?.roomId}
            spectatorCode={activeRoom?.spectatorCode}
            onToggleMute={() => setMuted(soundEngine.toggleMute())}
            onToggleMobileControls={() => {
              manualMobileOverrideRef.current = true;
              setMobileControls((v) => !v);
            }}
            onPause={() => engineRef.current?.setPaused(hud.state !== 'paused')}
            onSelectWeapon={(w) => {
              setSelectedWeapon(w);
              engineRef.current?.setLocalWeapon(w);
              if (activeRoom && hud.mode === 'online') {
                updateParticipantLoadout(activeRoom.roomId, profile.playerId, { weaponId: w });
              }
            }}
            onCycleSpectate={(dir) => engineRef.current?.cycleSpectateTarget(dir)}
            onExitSpectate={handleExitToLobby}
          />

          {screen === 'playing' && mobileControls && hud.state === 'playing' && (
            <TouchControls
              glooCount={hud.glooCount}
              isAds={hud.isAds}
              onMove={(nx, ny) => engineRef.current?.setTouchMove(nx, ny)}
              onLookDelta={(dx, dy) => engineRef.current?.addTouchLookDelta(dx, dy)}
              onFire={(held) => engineRef.current?.setTouchFire(held)}
              onJump={() => engineRef.current?.triggerJump()}
              onReload={() => engineRef.current?.triggerReload()}
              onGloo={() => engineRef.current?.triggerGlooShield()}
              onToggleAds={() => engineRef.current?.toggleAds()}
              onSwapWeapon={() => engineRef.current?.cycleWeapon()}
            />
          )}

          <MatchModals
            hud={hud}
            onResume={() => engineRef.current?.setPaused(false)}
            onRestart={() => {
              matchRecordedRef.current = false;
              engineRef.current?.restartOfflineMatch();
            }}
            onExitToLobby={handleExitToLobby}
          />
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
