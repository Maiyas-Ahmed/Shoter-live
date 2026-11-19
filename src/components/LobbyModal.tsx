import React, { useState } from 'react';
import { ICON_IMAGES, LOCAL_IMAGES } from '../assets/iconImages';
import type {
  FriendRequestDoc,
  MatchRoomDoc,
  PlayerProfile,
  RoomParticipantDoc,
} from '../firebase/matchService';
import {
  evaluateOnlineRoomReadiness,
  WEAPON_LIST,
  type GameMode,
  type TeamId,
  type WeaponId,
} from '../game/rules';

type LobbyTab = 'play' | 'custom' | 'spectate' | 'friends';

interface LobbyModalProps {
  player: PlayerProfile;
  isOnlineAvailable: boolean;
  selectedWeapon: WeaponId;
  activeRoom: MatchRoomDoc | null;
  roomParticipants: RoomParticipantDoc[];
  liveRooms: MatchRoomDoc[];
  onlinePlayers: PlayerProfile[];
  friendRequests: FriendRequestDoc[];
  statusMessage: string;
  onSelectWeapon: (id: WeaponId) => void;
  onStartOffline: (mode: GameMode) => void;
  onQuickMatch: (mode: GameMode) => void;
  onCreateCustomRoom: (mode: GameMode, fillWithBots: boolean) => void;
  onJoinRoomCode: (code: string) => void;
  onSpectateCode: (code: string) => void;
  onLeaveRoom: () => void;
  onToggleReady: () => void;
  onSwitchTeam: (team: TeamId) => void;
  onHostStartRoom: () => void;
  onSendFriendRequest: (target: PlayerProfile) => void;
  onRespondFriendRequest: (reqId: string, status: 'accepted' | 'declined') => void;
  onInviteFriendToRoom: (reqId: string) => void;
  onLinkGoogle: () => void;
  onEditIdentity: () => void;
}

export const LobbyModal: React.FC<LobbyModalProps> = ({
  player,
  isOnlineAvailable,
  selectedWeapon,
  activeRoom,
  roomParticipants,
  liveRooms,
  onlinePlayers,
  friendRequests,
  statusMessage,
  onSelectWeapon,
  onStartOffline,
  onQuickMatch,
  onCreateCustomRoom,
  onJoinRoomCode,
  onSpectateCode,
  onLeaveRoom,
  onToggleReady,
  onSwitchTeam,
  onHostStartRoom,
  onSendFriendRequest,
  onRespondFriendRequest,
  onInviteFriendToRoom,
  onLinkGoogle,
  onEditIdentity,
}) => {
  const [tab, setTab] = useState<LobbyTab>('play');
  const [customMode, setCustomMode] = useState<GameMode>('1v1');
  const [joinCode, setJoinCode] = useState('');
  const [specCode, setSpecCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLabel, setCopiedLabel] = useState('');

  const copyText = (txt: string, label: string) => {
    navigator.clipboard?.writeText(txt).catch(() => {});
    setCopiedLabel(label);
    window.setTimeout(() => setCopiedLabel(''), 1500);
  };

  const acceptedFriends = friendRequests.filter((r) => r.status === 'accepted');
  const incomingRequests = friendRequests.filter(
    (r) => r.status === 'pending' && r.toId === player.playerId,
  );
  const pendingInvites = friendRequests.filter(
    (r) => r.status === 'accepted' && r.roomInviteCode && r.toId === player.playerId,
  );

  const filteredPlayers = onlinePlayers.filter((p) => {
    if (p.playerId === player.playerId) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.tag4.includes(q);
  });

  // Active Online / Custom Waiting Room view (100% real players only — bots disabled)
  if (activeRoom) {
    const isHost = activeRoom.hostId === player.playerId;
    const me = roomParticipants.find((p) => p.participantId === player.playerId);
    const teamA = roomParticipants.filter((p) => p.team === 'A' && !p.isBot);
    const teamB = roomParticipants.filter((p) => p.team === 'B' && !p.isBot);
    const readiness = evaluateOnlineRoomReadiness({
      mode: activeRoom.mode,
      isPrivate: activeRoom.isPrivate,
      participants: roomParticipants,
    });

    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center p-3 sm:p-6 pointer-events-none">
        <div className="w-full max-w-2xl rounded-md border border-white/15 border-t-2 border-t-amber-500 bg-[#090e1a]/96 p-5 sm:p-6 shadow-2xl pointer-events-auto max-h-[92vh] overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-400">
                {activeRoom.isPrivate ? 'Private Custom Match' : 'Online Matchmaking'} · {activeRoom.mode.toUpperCase()}
              </span>
              <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-white">
                Room {activeRoom.roomId}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => copyText(activeRoom.roomId, 'room')}
                className="flex items-center gap-1.5 rounded-sm border border-amber-500/50 bg-[#101829] px-3 py-1.5 text-xs font-bold text-amber-300 hover:border-amber-400"
              >
                <img src={ICON_IMAGES.copy} alt="" className="h-4 w-4" />
                {copiedLabel === 'room' ? 'Copied!' : `Code: ${activeRoom.roomId}`}
              </button>
              <button
                type="button"
                onClick={() => copyText(activeRoom.spectatorCode, 'spec')}
                className="flex items-center gap-1.5 rounded-sm border border-sky-500/50 bg-[#101829] px-3 py-1.5 text-xs font-bold text-sky-300 hover:border-sky-400"
              >
                <img src={ICON_IMAGES.spectator} alt="" className="h-4 w-4" />
                {copiedLabel === 'spec' ? 'Copied!' : `Spec: ${activeRoom.spectatorCode}`}
              </button>
            </div>
          </div>

          {/* Real-Player-Only Readiness Status Banner */}
          <div
            data-testid="room-readiness-banner"
            className={`mt-4 flex items-center justify-between gap-3 rounded-sm border px-3.5 py-2.5 text-xs font-semibold ${
              readiness.canStart
                ? 'border-emerald-500/40 bg-emerald-950/35 text-emerald-300'
                : 'border-amber-500/40 bg-amber-950/30 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  readiness.canStart ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span>{readiness.reason}</span>
            </div>
            <span className="font-mono-tech text-[11px] font-bold uppercase text-slate-300">
              REAL PLAYERS ONLY · NO BOTS
            </span>
          </div>

          {/* Teams Roster */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['A', 'B'] as TeamId[]).map((team) => {
              const list = team === 'A' ? teamA : teamB;
              return (
                <div
                  key={team}
                  className={`rounded-sm border p-3.5 bg-[#0e1525] ${
                    team === 'A' ? 'border-sky-500/40' : 'border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span
                      className={`text-xs font-extrabold uppercase tracking-wider ${
                        team === 'A' ? 'text-sky-400' : 'text-amber-400'
                      }`}
                    >
                      Team {team} ({list.length}/{readiness.requiredPerTeam})
                    </span>
                    {me && me.team !== team && (
                      <button
                        type="button"
                        onClick={() => onSwitchTeam(team)}
                        className="rounded-sm border border-white/15 bg-[#152036] px-2 py-0.5 text-[11px] font-bold text-slate-200 hover:border-amber-400"
                      >
                        Switch to {team}
                      </button>
                    )}
                  </div>
                  <div className="mt-2.5 space-y-2">
                    {list.length === 0 && (
                      <div className="rounded-sm border border-dashed border-white/15 p-3 text-center text-xs text-slate-400">
                        Waiting for real online opponent...
                      </div>
                    )}
                    {list.map((p) => (
                      <div
                        key={p.participantId}
                        className="flex items-center justify-between rounded-sm border border-white/10 bg-[#080d17] px-3 py-2"
                      >
                        <div>
                          <div className="text-sm font-bold text-white">
                            {p.name}
                            <span className="ml-1.5 font-mono-tech text-xs text-slate-400">#{p.tag4}</span>
                          </div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {p.weaponId}
                          </div>
                        </div>
                        <span
                          className={`rounded-sm px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                            p.ready
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {p.ready ? 'READY' : 'WAIT'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Invite Accepted Friends */}
          {acceptedFriends.length > 0 && (
            <div className="mt-4 rounded-sm border border-white/10 bg-[#0e1525] p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Invite Friends to Room {activeRoom.roomId}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {acceptedFriends.map((f) => {
                  const friendName = f.fromId === player.playerId ? f.toName : f.fromName;
                  const friendTag = f.fromId === player.playerId ? f.toTag4 : f.fromTag4;
                  return (
                    <button
                      key={f.requestId}
                      type="button"
                      onClick={() => onInviteFriendToRoom(f.requestId)}
                      className="rounded-sm border border-white/15 bg-[#080d17] px-3 py-1 text-xs font-bold text-slate-200 hover:border-amber-400"
                    >
                      + Invite {friendName}#{friendTag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {statusMessage && (
            <div className="mt-3 rounded-sm border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
              {statusMessage}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onLeaveRoom}
              className="rounded-sm border border-red-500/40 bg-red-950/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-red-300 hover:bg-red-900/50"
            >
              Leave Room
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onToggleReady}
                className={`rounded-sm px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider ${
                  me?.ready
                    ? 'border border-emerald-400 bg-emerald-500/20 text-emerald-300'
                    : 'border border-white/20 bg-[#121b2e] text-white'
                }`}
              >
                {me?.ready ? 'Ready' : 'Mark Ready'}
              </button>

              {isHost && (
                <button
                  type="button"
                  data-start="true"
                  disabled={!readiness.canStart}
                  onClick={onHostStartRoom}
                  title={readiness.reason}
                  className="rounded-sm bg-amber-500 px-6 py-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {readiness.canStart ? 'Start Match' : 'Waiting for Opponent'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-3 sm:p-6 pointer-events-none">
      <div className="w-full max-w-4xl rounded-md border border-white/15 border-t-2 border-t-amber-500 bg-[#090e1a]/96 p-4 sm:p-6 shadow-2xl pointer-events-auto max-h-[92vh] overflow-y-auto">
        {/* Top Operator Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3.5">
            <img
              src={LOCAL_IMAGES.wolfEmblem}
              alt="Player Crest"
              className="h-12 w-12 rounded-sm border border-amber-500/45 object-cover"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl font-extrabold uppercase tracking-wide text-white">
                  {player.name}
                </span>
                <span className="rounded-sm border border-white/10 bg-[#121b2e] px-2 py-0.5 font-mono-tech text-xs font-bold text-amber-400">
                  #{player.tag4}
                </span>
                <button
                  type="button"
                  onClick={onEditIdentity}
                  className="text-[11px] font-bold uppercase tracking-wider text-slate-400 underline hover:text-white"
                >
                  Change
                </button>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <span>
                  Wins <strong className="font-mono-tech text-white tabular-nums">{player.wins}</strong>
                </span>
                <span>
                  Kills <strong className="font-mono-tech text-amber-400 tabular-nums">{player.kills}</strong>
                </span>
                <span className={isOnlineAvailable ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                  {isOnlineAvailable ? 'Realtime Network Ready' : 'Offline Mode'}
                </span>
              </div>
            </div>
          </div>

          {isOnlineAvailable && !player.googleUid && (
            <button
              type="button"
              onClick={onLinkGoogle}
              className="rounded-sm border border-white/15 bg-[#101829] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-200 hover:border-amber-400"
            >
              Link Cloud Profile
            </button>
          )}
        </div>

        {statusMessage && (
          <div className="mt-3 rounded-sm border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
            {statusMessage}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(
            [
              { id: 'play', label: 'Deploy Match', icon: ICON_IMAGES.play },
              { id: 'custom', label: 'Custom Room', icon: ICON_IMAGES.customRoom },
              { id: 'spectate', label: 'Spectate', icon: ICON_IMAGES.spectator },
              {
                id: 'friends',
                label: `Squad${incomingRequests.length ? ` (${incomingRequests.length})` : ''}`,
                icon: ICON_IMAGES.friends,
              },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex items-center justify-center gap-2 rounded-sm border py-2.5 px-3 text-xs font-extrabold uppercase tracking-wider ${
                tab === item.id
                  ? 'border-amber-400 bg-amber-500 text-slate-950'
                  : 'border-white/10 bg-[#0e1525] text-slate-300 hover:border-white/25'
              }`}
            >
              <img src={item.icon} alt="" className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Quick Play & Offline */}
        {tab === 'play' && (
          <div className="mt-5 space-y-5">
            {/* Weapon Loadout Choice with realistic telemetry bars */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                <span>Primary Arsenal</span>
                <span>Press [1–4] In Match To Swap</span>
              </div>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {WEAPON_LIST.map((w) => {
                  const active = selectedWeapon === w.id;
                  const dmgBar = Math.min(100, Math.round(((w.damage * w.pellets) / 120) * 100));
                  const rngBar = Math.min(100, Math.round((w.range / 110) * 100));
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => onSelectWeapon(w.id)}
                      className={`flex flex-col items-start rounded-sm border p-3 text-left transition-colors ${
                        active
                          ? 'border-amber-400 bg-[#131d33]'
                          : 'border-white/10 bg-[#0d1422] hover:border-white/25'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <img src={ICON_IMAGES[w.id]} alt={w.name} className="h-7 w-12 object-contain" />
                        {active && (
                          <span className="rounded-sm bg-amber-500 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-slate-950">
                            Equipped
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs font-extrabold uppercase tracking-wide text-white">
                        {w.name}
                      </div>
                      <div className="text-[10px] text-slate-400">{w.role}</div>
                      <div className="mt-2.5 w-full space-y-1 text-[9px] font-mono-tech text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <span className="w-7">DMG</span>
                          <div className="h-1 flex-1 bg-slate-800">
                            <div className="h-full bg-amber-400" style={{ width: `${dmgBar}%` }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-7">RNG</span>
                          <div className="h-1 flex-1 bg-slate-800">
                            <div className="h-full bg-sky-400" style={{ width: `${rngBar}%` }} />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* 100% Pure Online Matchmaking */}
              <div className="rounded-sm border border-white/15 border-l-2 border-l-amber-500 bg-[#0d1422] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={ICON_IMAGES.trophy} alt="" className="h-4 w-4" />
                    <h3 className="text-sm font-extrabold uppercase tracking-wide text-white">
                      Online Duel · Race to 5
                    </h3>
                  </div>
                  <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-amber-300">
                    Real Players Only
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Match exclusively against live online players. Never auto-filled with bots.
                </p>
                <div className="mt-3.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!isOnlineAvailable}
                    onClick={() => onQuickMatch('1v1')}
                    className="rounded-sm bg-amber-500 py-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-amber-400 disabled:opacity-40"
                  >
                    1v1 Online
                  </button>
                  <button
                    type="button"
                    disabled={!isOnlineAvailable}
                    onClick={() => onQuickMatch('2v2')}
                    className="rounded-sm border border-amber-500/50 bg-[#080d17] py-2.5 text-xs font-extrabold uppercase tracking-wider text-amber-300 hover:bg-[#131d33] disabled:opacity-40"
                  >
                    2v2 Online
                  </button>
                </div>
              </div>

              {/* Dedicated Offline AI Practice */}
              <div className="rounded-sm border border-white/15 border-l-2 border-l-emerald-500 bg-[#0d1422] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={ICON_IMAGES.bot} alt="" className="h-4 w-4" />
                    <h3 className="text-sm font-extrabold uppercase tracking-wide text-white">
                      Offline Practice
                    </h3>
                  </div>
                  <span className="rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-emerald-300">
                    AI Bots
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Train 100% offline against tactical AI opponents using full 5-round rules.
                </p>
                <div className="mt-3.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-start="true"
                    onClick={() => onStartOffline('1v1')}
                    className="rounded-sm bg-emerald-500 py-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-emerald-400"
                  >
                    1v1 Offline
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartOffline('2v2')}
                    className="rounded-sm border border-emerald-500/50 bg-[#080d17] py-2.5 text-xs font-extrabold uppercase tracking-wider text-emerald-300 hover:bg-[#131d33]"
                  >
                    2v2 Offline
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Custom Room (100% Real Players Only) */}
        {tab === 'custom' && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-sm border border-white/15 bg-[#0d1422] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold uppercase tracking-wide text-white">
                  Create Private Room
                </h3>
                <span className="text-[10px] font-bold uppercase text-amber-400">No Bots</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Create a private lobby code and share it with specific friends for real 1v1 or 2v2 duels.
              </p>

              <div className="mt-4 flex gap-2">
                {(['1v1', '2v2'] as GameMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCustomMode(m)}
                    className={`flex-1 rounded-sm border py-2 text-xs font-extrabold uppercase ${
                      customMode === m
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-white/10 bg-[#080d17] text-slate-400'
                    }`}
                  >
                    {m} Duel
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={!isOnlineAvailable}
                onClick={() => onCreateCustomRoom(customMode, false)}
                className="mt-4 w-full rounded-sm bg-amber-500 py-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-amber-400 disabled:opacity-40"
              >
                Create Room &amp; Get Code
              </button>
            </div>

            <div className="rounded-sm border border-white/15 bg-[#0d1422] p-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-white">
                Join by Room Code
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Enter a friend&apos;s room code (e.g. LW4829) to enter their squad.
              </p>

              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter Room Code (LW...)"
                maxLength={12}
                className="mt-3 w-full rounded-sm border border-white/15 bg-[#080d17] px-3 py-2.5 font-mono-tech text-sm font-bold uppercase tracking-widest text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
              <button
                type="button"
                disabled={!isOnlineAvailable || !joinCode.trim()}
                onClick={() => onJoinRoomCode(joinCode)}
                className="mt-3 w-full rounded-sm border border-amber-400 bg-[#080d17] py-2.5 text-xs font-extrabold uppercase tracking-wider text-amber-300 hover:bg-[#131d33] disabled:opacity-40"
              >
                Join Custom Room
              </button>

              {pendingInvites.length > 0 && (
                <div className="mt-4 space-y-1.5 border-t border-white/10 pt-3">
                  <div className="text-[11px] font-bold uppercase text-amber-400">Room Invites</div>
                  {pendingInvites.map((inv) => (
                    <button
                      key={inv.requestId}
                      type="button"
                      onClick={() => onJoinRoomCode(inv.roomInviteCode)}
                      className="flex w-full items-center justify-between rounded-sm border border-white/10 bg-[#080d17] px-3 py-2 text-xs text-white hover:border-amber-400"
                    >
                      <span>{inv.fromName} invited you</span>
                      <span className="font-mono-tech font-bold text-amber-400">{inv.roomInviteCode}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Spectator Mode */}
        {tab === 'spectate' && (
          <div className="mt-5 space-y-4">
            <div className="rounded-sm border border-sky-500/35 bg-[#0d1422] p-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-white">
                Spectate Live Match
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Enter a Spectator Code (SP...) or Room Code (LW...) to watch live 3D combat.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={specCode}
                  onChange={(e) => setSpecCode(e.target.value.toUpperCase())}
                  placeholder="Enter Spectator or Room Code"
                  maxLength={12}
                  className="flex-1 rounded-sm border border-white/15 bg-[#080d17] px-3 py-2 font-mono-tech text-sm font-bold uppercase text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!isOnlineAvailable || !specCode.trim()}
                  onClick={() => onSpectateCode(specCode)}
                  className="rounded-sm bg-sky-500 px-5 py-2 text-xs font-extrabold uppercase text-slate-950 hover:bg-sky-400 disabled:opacity-40"
                >
                  Watch Live
                </button>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Active Arenas ({liveRooms.length})
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {liveRooms.length === 0 && (
                  <div className="col-span-full rounded-sm border border-dashed border-white/15 p-4 text-center text-xs text-slate-400">
                    No active online matches right now.
                  </div>
                )}
                {liveRooms.map((r) => (
                  <div
                    key={r.roomId}
                    className="flex items-center justify-between rounded-sm border border-white/10 bg-[#0d1422] p-3"
                  >
                    <div>
                      <div className="text-xs font-extrabold text-white">
                        {r.hostName}&apos;s {r.mode.toUpperCase()} · {r.roomId}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Score {r.scoreA}–{r.scoreB} · Spec: {r.spectatorCode}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSpectateCode(r.roomId)}
                      className="rounded-sm border border-sky-400/50 bg-sky-500/15 px-3 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-500 hover:text-slate-950"
                    >
                      Spectate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Friends & Online Players */}
        {tab === 'friends' && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-sm border border-white/15 bg-[#0d1422] p-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-white">
                Find Online Players
              </h3>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Name or 4-digit ID..."
                className="mt-2.5 w-full rounded-sm border border-white/15 bg-[#080d17] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
              />
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                {filteredPlayers.length === 0 && (
                  <div className="text-xs text-slate-400">No matching players online yet.</div>
                )}
                {filteredPlayers.map((p) => {
                  const alreadySent = friendRequests.some(
                    (r) =>
                      (r.fromId === player.playerId && r.toId === p.playerId) ||
                      (r.toId === player.playerId && r.fromId === p.playerId),
                  );
                  return (
                    <div
                      key={p.playerId}
                      className="flex items-center justify-between rounded-sm border border-white/10 bg-[#080d17] px-3 py-2"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">
                          {p.name} <span className="font-mono-tech text-amber-400">#{p.tag4}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Wins: {p.wins} · {p.status}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={alreadySent || !isOnlineAvailable}
                        onClick={() => onSendFriendRequest(p)}
                        className="rounded-sm border border-amber-500/50 bg-[#101829] px-2.5 py-1 text-[11px] font-bold text-amber-300 disabled:opacity-40"
                      >
                        {alreadySent ? 'Sent / Friend' : 'Add Friend'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-sm border border-white/15 bg-[#0d1422] p-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-white">
                Squad &amp; Requests
              </h3>

              {incomingRequests.length > 0 && (
                <div className="mt-2.5 space-y-2">
                  <div className="text-[10px] font-bold uppercase text-amber-400">Incoming Requests</div>
                  {incomingRequests.map((req) => (
                    <div
                      key={req.requestId}
                      className="flex items-center justify-between rounded-sm border border-white/10 bg-[#080d17] px-3 py-2"
                    >
                      <span className="text-xs font-bold text-white">
                        {req.fromName}#{req.fromTag4}
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => onRespondFriendRequest(req.requestId, 'accepted')}
                          className="rounded-sm bg-emerald-500 px-2 py-1 text-[10px] font-extrabold text-slate-950"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => onRespondFriendRequest(req.requestId, 'declined')}
                          className="rounded-sm bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-300"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 space-y-2">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Friends ({acceptedFriends.length})
                </div>
                {acceptedFriends.length === 0 && (
                  <div className="text-xs text-slate-400">
                    Add friends to team up in 2v2 or private custom rooms.
                  </div>
                )}
                {acceptedFriends.map((f) => {
                  const friendName = f.fromId === player.playerId ? f.toName : f.fromName;
                  const friendTag = f.fromId === player.playerId ? f.toTag4 : f.fromTag4;
                  return (
                    <div
                      key={f.requestId}
                      className="flex items-center justify-between rounded-sm border border-white/10 bg-[#080d17] px-3 py-2"
                    >
                      <span className="text-xs font-bold text-white">
                        {friendName} <span className="font-mono-tech text-sky-400">#{friendTag}</span>
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-400">Friend</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
