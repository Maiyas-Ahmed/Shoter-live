import React, { useState } from 'react';
import { ICON_IMAGES, LOCAL_IMAGES } from '../assets/iconImages';
import type {
  FriendRequestDoc,
  MatchRoomDoc,
  PlayerProfile,
  RoomParticipantDoc,
} from '../firebase/matchService';
import { WEAPON_LIST, type GameMode, type TeamId, type WeaponId } from '../game/rules';

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
  const [fillBots, setFillBots] = useState(true);
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

  // Active Custom / Waiting Room view
  if (activeRoom) {
    const isHost = activeRoom.hostId === player.playerId;
    const me = roomParticipants.find((p) => p.participantId === player.playerId);
    const teamA = roomParticipants.filter((p) => p.team === 'A');
    const teamB = roomParticipants.filter((p) => p.team === 'B');

    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center p-3 sm:p-6 pointer-events-none">
        <div className="w-full max-w-2xl rounded-2xl border border-amber-500/40 bg-slate-950/94 p-5 sm:p-6 shadow-2xl pointer-events-auto max-h-[92vh] overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
                {activeRoom.isPrivate ? 'Custom Room' : 'Online Matchmaking'} · {activeRoom.mode.toUpperCase()}
              </span>
              <h2 className="text-xl font-black text-white">Room {activeRoom.roomId}</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => copyText(activeRoom.roomId, 'room')}
                className="flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-slate-900 px-3 py-1.5 text-xs font-bold text-amber-300"
              >
                <img src={ICON_IMAGES.copy} alt="" className="h-4 w-4" />
                {copiedLabel === 'room' ? 'Copied!' : `Code: ${activeRoom.roomId}`}
              </button>
              <button
                type="button"
                onClick={() => copyText(activeRoom.spectatorCode, 'spec')}
                className="flex items-center gap-1.5 rounded-lg border border-sky-500/50 bg-slate-900 px-3 py-1.5 text-xs font-bold text-sky-300"
              >
                <img src={ICON_IMAGES.spectator} alt="" className="h-4 w-4" />
                {copiedLabel === 'spec' ? 'Copied!' : `Spec: ${activeRoom.spectatorCode}`}
              </button>
            </div>
          </div>

          {/* Teams Roster */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['A', 'B'] as TeamId[]).map((team) => {
              const list = team === 'A' ? teamA : teamB;
              return (
                <div
                  key={team}
                  className={`rounded-xl border p-3.5 ${
                    team === 'A' ? 'border-sky-500/40 bg-slate-900/90' : 'border-amber-500/40 bg-slate-900/90'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-black uppercase tracking-wider ${
                        team === 'A' ? 'text-sky-400' : 'text-amber-400'
                      }`}
                    >
                      Team {team}
                    </span>
                    {me && me.team !== team && (
                      <button
                        type="button"
                        onClick={() => onSwitchTeam(team)}
                        className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-200 hover:border-amber-400"
                      >
                        Join Team {team}
                      </button>
                    )}
                  </div>
                  <div className="mt-2.5 space-y-2">
                    {list.length === 0 && (
                      <div className="rounded-lg border border-dashed border-slate-700 p-3 text-center text-xs text-slate-500">
                        Waiting for player...
                      </div>
                    )}
                    {list.map((p) => (
                      <div
                        key={p.participantId}
                        className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2"
                      >
                        <div>
                          <div className="text-sm font-bold text-white">
                            {p.name}
                            <span className="ml-1 font-mono text-xs text-slate-400">#{p.tag4}</span>
                          </div>
                          <div className="text-[10px] uppercase text-slate-400">
                            {p.weaponId} {p.isBot ? '· BOT' : ''}
                          </div>
                        </div>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
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
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
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
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-bold text-slate-200 hover:border-amber-400"
                    >
                      + Invite {friendName}#{friendTag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onLeaveRoom}
              className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-2.5 text-xs font-bold uppercase text-red-300 hover:bg-red-900/50"
            >
              Leave Room
            </button>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onToggleReady}
                className={`rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider ${
                  me?.ready
                    ? 'border border-emerald-400 bg-emerald-500/20 text-emerald-300'
                    : 'border border-slate-600 bg-slate-800 text-white'
                }`}
              >
                {me?.ready ? 'Ready ✓' : 'Mark Ready'}
              </button>

              {isHost && (
                <button
                  type="button"
                  data-start="true"
                  onClick={onHostStartRoom}
                  className="rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-amber-400"
                >
                  Start Match
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
      <div className="w-full max-w-3xl rounded-2xl border border-amber-500/35 bg-slate-950/94 p-4 sm:p-6 shadow-2xl pointer-events-auto max-h-[92vh] overflow-y-auto">
        {/* Top Profile Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <img
              src={LOCAL_IMAGES.wolfEmblem}
              alt="Player Crest"
              className="h-12 w-12 rounded-xl border border-amber-500/40 object-cover"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-white">{player.name}</span>
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-amber-400">
                  #{player.tag4}
                </span>
                <button
                  type="button"
                  onClick={onEditIdentity}
                  className="text-[11px] font-semibold text-slate-400 underline hover:text-white"
                >
                  Edit
                </button>
              </div>
              <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-400">
                <span>Wins: <strong className="text-white tabular-nums">{player.wins}</strong></span>
                <span>Kills: <strong className="text-amber-400 tabular-nums">{player.kills}</strong></span>
                <span className={isOnlineAvailable ? 'text-emerald-400' : 'text-amber-400'}>
                  {isOnlineAvailable ? 'Firebase Sync Ready' : 'Offline Mode'}
                </span>
              </div>
            </div>
          </div>

          {isOnlineAvailable && !player.googleUid && (
            <button
              type="button"
              onClick={onLinkGoogle}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-amber-400"
            >
              Link Google Cloud Save (Optional)
            </button>
          )}
        </div>

        {statusMessage && (
          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
            {statusMessage}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {(
            [
              { id: 'play', label: 'Lone Wolf', icon: ICON_IMAGES.play },
              { id: 'custom', label: 'Custom Room', icon: ICON_IMAGES.customRoom },
              { id: 'spectate', label: 'Spectate', icon: ICON_IMAGES.spectator },
              {
                id: 'friends',
                label: `Friends${incomingRequests.length ? ` (${incomingRequests.length})` : ''}`,
                icon: ICON_IMAGES.friends,
              },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-2 text-xs font-black uppercase tracking-wide ${
                tab === item.id
                  ? 'border-amber-400 bg-amber-500 text-slate-950'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
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
            {/* Weapon Loadout Choice */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Starting Weapon Loadout
              </div>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {WEAPON_LIST.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onSelectWeapon(w.id)}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left ${
                      selectedWeapon === w.id
                        ? 'border-amber-400 bg-slate-900'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                    }`}
                  >
                    <img src={ICON_IMAGES[w.id]} alt={w.name} className="h-7 w-12 object-contain" />
                    <div className="mt-1.5 text-xs font-black text-white">{w.name}</div>
                    <div className="text-[10px] text-slate-400">{w.role}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Online Lone Wolf */}
              <div className="rounded-xl border border-amber-500/35 bg-slate-900 p-4">
                <div className="flex items-center gap-2">
                  <img src={ICON_IMAGES.trophy} alt="" className="h-5 w-5" />
                  <h3 className="text-sm font-black uppercase text-white">Online Lone Wolf (Race to 5)</h3>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Matchmake online 1v1 or 2v2 duo battles synced via Firebase.
                </p>
                <div className="mt-3.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!isOnlineAvailable}
                    onClick={() => onQuickMatch('1v1')}
                    className="rounded-lg bg-amber-500 py-2.5 text-xs font-black uppercase text-slate-950 hover:bg-amber-400 disabled:opacity-40"
                  >
                    1v1 Online
                  </button>
                  <button
                    type="button"
                    disabled={!isOnlineAvailable}
                    onClick={() => onQuickMatch('2v2')}
                    className="rounded-lg border border-amber-400/60 bg-slate-950 py-2.5 text-xs font-black uppercase text-amber-300 hover:bg-slate-800 disabled:opacity-40"
                  >
                    2v2 Online
                  </button>
                </div>
              </div>

              {/* Offline Practice */}
              <div className="rounded-xl border border-emerald-500/35 bg-slate-900 p-4">
                <div className="flex items-center gap-2">
                  <img src={ICON_IMAGES.bot} alt="" className="h-5 w-5" />
                  <h3 className="text-sm font-black uppercase text-white">Offline Practice Arena</h3>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Play 100% offline against tactical AI bots with full 5-round rules.
                </p>
                <div className="mt-3.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-start="true"
                    onClick={() => onStartOffline('1v1')}
                    className="rounded-lg bg-emerald-500 py-2.5 text-xs font-black uppercase text-slate-950 hover:bg-emerald-400"
                  >
                    1v1 Offline
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartOffline('2v2')}
                    className="rounded-lg border border-emerald-400/60 bg-slate-950 py-2.5 text-xs font-black uppercase text-emerald-300 hover:bg-slate-800"
                  >
                    2v2 Offline
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Custom Room */}
        {tab === 'custom' && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="text-sm font-black uppercase text-white">Create Custom Room</h3>
              <p className="mt-1 text-xs text-slate-400">
                Generate a private Room Code + Spectator Code for friends.
              </p>

              <div className="mt-3 flex gap-2">
                {(['1v1', '2v2'] as GameMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCustomMode(m)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-black uppercase ${
                      customMode === m
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-slate-700 bg-slate-950 text-slate-400'
                    }`}
                  >
                    {m} Duel
                  </button>
                ))}
              </div>

              <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={fillBots}
                  onChange={(e) => setFillBots(e.target.checked)}
                  className="h-4 w-4 accent-amber-500"
                />
                Fill empty slots with AI Bots on start
              </label>

              <button
                type="button"
                disabled={!isOnlineAvailable}
                onClick={() => onCreateCustomRoom(customMode, fillBots)}
                className="mt-4 w-full rounded-xl bg-amber-500 py-2.5 text-xs font-black uppercase text-slate-950 hover:bg-amber-400 disabled:opacity-40"
              >
                Create Room & Get Code
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="text-sm font-black uppercase text-white">Join by Room Code</h3>
              <p className="mt-1 text-xs text-slate-400">
                Enter your friend&apos;s room code (e.g. LW4829) to enter their squad.
              </p>

              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter Room Code (LW...)"
                maxLength={12}
                className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-sm font-bold uppercase tracking-widest text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
              <button
                type="button"
                disabled={!isOnlineAvailable || !joinCode.trim()}
                onClick={() => onJoinRoomCode(joinCode)}
                className="mt-3 w-full rounded-xl border border-amber-400 bg-slate-950 py-2.5 text-xs font-black uppercase text-amber-300 hover:bg-slate-800 disabled:opacity-40"
              >
                Join Custom Room
              </button>

              {pendingInvites.length > 0 && (
                <div className="mt-4 space-y-1.5 border-t border-slate-800 pt-3">
                  <div className="text-[11px] font-bold uppercase text-amber-400">Room Invites</div>
                  {pendingInvites.map((inv) => (
                    <button
                      key={inv.requestId}
                      type="button"
                      onClick={() => onJoinRoomCode(inv.roomInviteCode)}
                      className="flex w-full items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-xs text-white hover:border hover:border-amber-400"
                    >
                      <span>{inv.fromName} invited you</span>
                      <span className="font-mono font-bold text-amber-400">{inv.roomInviteCode}</span>
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
            <div className="rounded-xl border border-sky-500/35 bg-slate-900 p-4">
              <h3 className="text-sm font-black uppercase text-white">Spectate via Code</h3>
              <p className="mt-1 text-xs text-slate-400">
                Enter a Spectator Code (SP...) or Room Code (LW...) to watch live 3D gameplay.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={specCode}
                  onChange={(e) => setSpecCode(e.target.value.toUpperCase())}
                  placeholder="Enter Spectator or Room Code"
                  maxLength={12}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm font-bold uppercase text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!isOnlineAvailable || !specCode.trim()}
                  onClick={() => onSpectateCode(specCode)}
                  className="rounded-lg bg-sky-500 px-5 py-2 text-xs font-black uppercase text-slate-950 hover:bg-sky-400 disabled:opacity-40"
                >
                  Watch Live
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Active Arenas ({liveRooms.length})
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {liveRooms.length === 0 && (
                  <div className="col-span-full rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">
                    No active online matches right now. Create one or share a code!
                  </div>
                )}
                {liveRooms.map((r) => (
                  <div
                    key={r.roomId}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3"
                  >
                    <div>
                      <div className="text-xs font-black text-white">
                        {r.hostName}&apos;s {r.mode.toUpperCase()} · {r.roomId}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Score {r.scoreA}–{r.scoreB} · Spec: {r.spectatorCode}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSpectateCode(r.roomId)}
                      className="rounded-lg bg-sky-500/20 border border-sky-400/50 px-3 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-500 hover:text-slate-950"
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
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="text-sm font-black uppercase text-white">Find Players & Send Request</h3>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Name or 4-digit ID..."
                className="mt-2.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
              />
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                {filteredPlayers.length === 0 && (
                  <div className="text-xs text-slate-500">No matching players online yet.</div>
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
                      className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">
                          {p.name} <span className="font-mono text-amber-400">#{p.tag4}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Wins: {p.wins} · {p.status}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={alreadySent || !isOnlineAvailable}
                        onClick={() => onSendFriendRequest(p)}
                        className="rounded border border-amber-500/50 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-amber-300 disabled:opacity-40"
                      >
                        {alreadySent ? 'Sent / Friend' : 'Add Friend'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="text-sm font-black uppercase text-white">Requests & Friends</h3>

              {incomingRequests.length > 0 && (
                <div className="mt-2.5 space-y-2">
                  <div className="text-[10px] font-bold uppercase text-amber-400">Incoming Requests</div>
                  {incomingRequests.map((req) => (
                    <div
                      key={req.requestId}
                      className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2"
                    >
                      <span className="text-xs font-bold text-white">
                        {req.fromName}#{req.fromTag4}
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => onRespondFriendRequest(req.requestId, 'accepted')}
                          className="rounded bg-emerald-500 px-2 py-1 text-[10px] font-black text-slate-950"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => onRespondFriendRequest(req.requestId, 'declined')}
                          className="rounded bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-300"
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
                  <div className="text-xs text-slate-500">
                    Accept or send friend requests to squad up in 2v2 or Custom Rooms.
                  </div>
                )}
                {acceptedFriends.map((f) => {
                  const friendName = f.fromId === player.playerId ? f.toName : f.fromName;
                  const friendTag = f.fromId === player.playerId ? f.toTag4 : f.fromTag4;
                  return (
                    <div
                      key={f.requestId}
                      className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2"
                    >
                      <span className="text-xs font-bold text-white">
                        {friendName} <span className="font-mono text-sky-400">#{friendTag}</span>
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
