import React from 'react';
import { ICON_IMAGES } from '../assets/iconImages';
import { PLAYER_MAX_ARMOR, PLAYER_MAX_HP, TARGET_ROUNDS, WEAPON_LIST, WEAPONS, type WeaponId } from '../game/rules';
import type { HudSnapshot } from '../three/ArenaEngine';

interface GameHUDProps {
  hud: HudSnapshot;
  muted: boolean;
  mobileControlsEnabled: boolean;
  roomCode?: string;
  spectatorCode?: string;
  onToggleMute: () => void;
  onToggleMobileControls: () => void;
  onPause: () => void;
  onSelectWeapon: (id: WeaponId) => void;
  onCycleSpectate: (dir: 1 | -1) => void;
  onExitSpectate: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  muted,
  mobileControlsEnabled,
  roomCode,
  spectatorCode,
  onToggleMute,
  onToggleMobileControls,
  onPause,
  onSelectWeapon,
  onCycleSpectate,
  onExitSpectate,
}) => {
  const isSpectating = hud.mode === 'spectate';
  const hpPct = Math.max(0, Math.min(100, (hud.hp / PLAYER_MAX_HP) * 100));
  const armorPct = Math.max(0, Math.min(100, (hud.armor / PLAYER_MAX_ARMOR) * 100));
  const weapon = WEAPONS[hud.weaponId];

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Danger zone peripheral warning */}
      {hud.outsideZone && !isSpectating && (
        <div
          className="fixed inset-0 border-8 border-red-600/75"
          style={{ boxShadow: 'inset 0 0 70px rgba(220,38,38,0.55)' }}
        />
      )}

      {/* TOP HEADER BAR: Scoreboard + Utility Buttons (Non-overlapping on Mobile & Desktop) */}
      <div className="flex items-start justify-between gap-2 px-2.5 pt-2.5 sm:px-4 sm:pt-3">
        {/* Top-Left Spacer / Room Badge */}
        <div className="hidden sm:flex flex-col gap-1.5 min-w-[140px]">
          {roomCode && (
            <div className="rounded-lg border border-slate-700 bg-slate-950/88 px-2.5 py-1 text-[11px] font-bold text-slate-200">
              ROOM <span className="font-mono text-amber-400">{roomCode}</span>
              {spectatorCode && (
                <span className="ml-2 text-slate-400">
                  SPEC <span className="font-mono text-sky-400">{spectatorCode}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Center Scoreboard */}
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-slate-700/80 bg-slate-950/90 px-2.5 sm:px-4 py-1.5 sm:py-2 shadow-lg">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-sky-400">
              {hud.myTeam === 'A' && !isSpectating ? 'YOU' : 'A'}
            </span>
            <div className="hidden sm:flex gap-1">
              {Array.from({ length: TARGET_ROUNDS }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-2.5 rounded-sm border ${
                    i < hud.scoreA
                      ? 'border-sky-300 bg-sky-400'
                      : 'border-slate-600 bg-slate-800'
                  }`}
                />
              ))}
            </div>
            <span className="font-mono text-base sm:text-xl font-black tabular-nums text-white">
              {hud.scoreA}
            </span>
          </div>

          <div className="flex flex-col items-center border-x border-slate-700 px-2 sm:px-3">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-amber-400">
              R{hud.roundNumber} · 1ST/{TARGET_ROUNDS}
            </span>
            <span
              className={`font-mono text-sm sm:text-lg font-black tabular-nums ${
                hud.roundTimeLeft <= 15 ? 'text-red-400' : 'text-slate-100'
              }`}
            >
              {hud.roundTimeLeft}s
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-mono text-base sm:text-xl font-black tabular-nums text-white">
              {hud.scoreB}
            </span>
            <div className="hidden sm:flex gap-1">
              {Array.from({ length: TARGET_ROUNDS }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-2.5 rounded-sm border ${
                    i < hud.scoreB
                      ? 'border-amber-300 bg-amber-500'
                      : 'border-slate-600 bg-slate-800'
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-400">
              {hud.myTeam === 'B' && !isSpectating ? 'YOU' : 'B'}
            </span>
          </div>
        </div>

        {/* Top-Right Compact Utility Icon Buttons */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 pointer-events-auto sm:min-w-[140px]">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Toggle Sound"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/90 hover:border-amber-500/60"
          >
            <img src={muted ? ICON_IMAGES.audioOff : ICON_IMAGES.audioOn} alt="" className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {!isSpectating && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Toggle Mobile Touch Controls"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMobileControls();
              }}
              className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border ${
                mobileControlsEnabled
                  ? 'border-sky-400 bg-sky-950/90'
                  : 'border-slate-700 bg-slate-950/90'
              }`}
            >
              <img src={ICON_IMAGES.mobilePad} alt="" className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            aria-label="Pause Game"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/90 hover:border-amber-500/60"
          >
            <img src={ICON_IMAGES.pause} alt="" className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>

      {/* Kill Feed */}
      <div className="fixed right-2.5 top-14 sm:right-auto sm:left-3 sm:top-16 flex flex-col items-end sm:items-start gap-1">
        {hud.killFeed.map((k) => (
          <div
            key={k.id}
            className="rounded bg-slate-950/85 px-2.5 py-1 text-[11px] font-semibold text-slate-200 border-l-2 border-amber-500"
          >
            {k.text} {k.isHeadshot && <span className="ml-1 font-black text-red-400">HEADSHOT</span>}
          </div>
        ))}
      </div>

      {/* EXACT CENTER (0, 0) DYNAMIC RETICLE + HITMARKER */}
      {!isSpectating && hud.state === 'playing' && (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className={`relative flex items-center justify-center ${hud.isAds ? 'scale-75' : 'scale-100'}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow" />
            <span className="absolute -top-3 h-2 w-0.5 bg-white/90" />
            <span className="absolute -bottom-3 h-2 w-0.5 bg-white/90" />
            <span className="absolute -left-3 h-0.5 w-2 bg-white/90" />
            <span className="absolute -right-3 h-0.5 w-2 bg-white/90" />
            {hud.hitMarker !== 'none' && (
              <svg viewBox="0 0 28 28" className="absolute h-7 w-7">
                <path
                  d="M4 4L10 10M24 4L18 10M4 24L10 18M24 24L18 18"
                  stroke={hud.hitMarker === 'head' ? '#ef4444' : '#ffffff'}
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
          {hud.reloading && (
            <div className="mt-5 rounded bg-slate-950/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
              RELOADING
            </div>
          )}
        </div>
      )}

      {/* ROUND END BANNER */}
      {hud.state === 'round_end' && (
        <div className="fixed inset-x-0 top-24 flex justify-center">
          <div className="rounded-xl border border-amber-500/50 bg-slate-950/95 px-6 py-3 text-center shadow-2xl">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Round {hud.roundNumber} Complete
            </div>
            <div className="mt-0.5 text-xl font-black text-white">
              {hud.roundWinner === 'draw'
                ? 'Round Draw'
                : hud.roundWinner === hud.myTeam && !isSpectating
                ? 'ROUND VICTORY'
                : `TEAM ${hud.roundWinner} TAKES ROUND`}
            </div>
          </div>
        </div>
      )}

      {/* VITALITY & WEAPON CLUSTER: Top-Left under header on Mobile, Bottom-Left on Desktop */}
      {!isSpectating && (
        <div
          className={`fixed rounded-xl border border-slate-700/80 bg-slate-950/90 shadow-lg ${
            mobileControlsEnabled
              ? 'left-2.5 top-14 w-44 p-2.5'
              : 'left-2.5 top-14 w-44 p-2.5 sm:top-auto sm:bottom-4 sm:left-4 sm:w-56 sm:p-3'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-slate-300">
            <span>ARMOR {hud.armor}</span>
            <span className="font-mono tabular-nums text-amber-400">KILLS {hud.kills}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-slate-800">
            <div
              className="h-full bg-sky-400 transition-transform duration-150"
              style={{ width: `${armorPct}%` }}
            />
          </div>

          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">HP</span>
            <span className="font-mono text-base sm:text-xl font-black tabular-nums text-white">
              {hud.hp}
              <span className="text-[11px] text-slate-400">/{PLAYER_MAX_HP}</span>
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded bg-slate-800">
            <div
              className={`h-full transition-all duration-150 ${
                hpPct > 45 ? 'bg-emerald-500' : hpPct > 20 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${hpPct}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-1.5">
            <div className="flex items-center gap-1.5">
              <img src={ICON_IMAGES[hud.weaponId]} alt={weapon.name} className="h-5 w-8 object-contain" />
              <div>
                <div className="text-[11px] font-black text-white leading-tight">{weapon.name}</div>
                <div className="text-[9px] text-slate-400">Gloo: {hud.glooCount}</div>
              </div>
            </div>
            <div className="font-mono text-sm sm:text-lg font-black tabular-nums text-amber-400">
              {hud.ammo}
              <span className="text-[11px] text-slate-500">/{hud.maxAmmo}</span>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM RIGHT: Weapon Loadout Switcher (Desktop & Quick Tap) */}
      {!isSpectating && !mobileControlsEnabled && (
        <div className="fixed bottom-4 right-4 flex gap-1.5 pointer-events-auto">
          {WEAPON_LIST.map((w, idx) => (
            <button
              key={w.id}
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onSelectWeapon(w.id);
              }}
              className={`flex flex-col items-center rounded-lg border px-2.5 py-1.5 text-left ${
                hud.weaponId === w.id
                  ? 'border-amber-400 bg-slate-900 text-white'
                  : 'border-slate-700 bg-slate-950/88 text-slate-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] font-bold text-amber-400">[{idx + 1}]</span>
                <img src={ICON_IMAGES[w.id]} alt="" className="h-4 w-7 object-contain" />
              </div>
              <span className="mt-0.5 text-[10px] font-bold">{w.id.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}

      {/* SPECTATOR CONTROL DOCK */}
      {isSpectating && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-sky-500/50 bg-slate-950/95 px-4 py-2.5 shadow-xl pointer-events-auto">
          <img src={ICON_IMAGES.spectator} alt="" className="h-5 w-5" />
          <button
            type="button"
            onClick={() => onCycleSpectate(-1)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-200 hover:border-sky-400"
          >
            Prev
          </button>
          <div className="min-w-36 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Spectating</div>
            <div className="text-sm font-black text-white">{hud.spectateTargetName}</div>
          </div>
          <button
            type="button"
            onClick={() => onCycleSpectate(1)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-200 hover:border-sky-400"
          >
            Next
          </button>
          <button
            type="button"
            onClick={onExitSpectate}
            className="ml-2 rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-500"
          >
            Exit
          </button>
        </div>
      )}
    </div>
  );
};
