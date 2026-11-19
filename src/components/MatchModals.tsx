import React from 'react';
import { ICON_IMAGES, LOCAL_IMAGES } from '../assets/iconImages';
import type { HudSnapshot } from '../three/ArenaEngine';

interface MatchModalsProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onExitToLobby: () => void;
}

export const MatchModals: React.FC<MatchModalsProps> = ({
  hud,
  onResume,
  onRestart,
  onExitToLobby,
}) => {
  if (hud.state === 'paused') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#060911]/80 p-4">
        <div className="w-full max-w-sm rounded-md border border-white/15 border-t-2 border-t-amber-500 bg-[#090e1a] p-6 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <img src={ICON_IMAGES.pause} alt="" className="h-8 w-8" />
            <div>
              <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-white">
                Match Paused
              </h2>
              <p className="font-mono-tech text-xs text-slate-400">
                Score {hud.scoreA} – {hud.scoreB} · Round {hud.roundNumber}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="w-full rounded-sm bg-amber-500 py-3 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-400"
            >
              Resume Match
            </button>
            {hud.mode === 'offline' && (
              <button
                type="button"
                onClick={onRestart}
                className="w-full rounded-sm border border-white/15 bg-[#101829] py-2.5 text-xs font-bold uppercase tracking-wider text-slate-100 hover:border-amber-500/60"
              >
                Restart Match
              </button>
            )}
            <button
              type="button"
              onClick={onExitToLobby}
              className="w-full rounded-sm border border-red-500/40 bg-red-950/40 py-2.5 text-xs font-bold uppercase tracking-wider text-red-300 hover:bg-red-900/50"
            >
              Exit to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (hud.state === 'gameover') {
    const isSpectator = hud.mode === 'spectate';
    const won = isSpectator ? true : hud.matchWinner === hud.myTeam;

    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#060911]/85 p-4">
        <div className="w-full max-w-md rounded-md border border-white/15 border-t-2 border-t-amber-500 bg-[#090e1a] p-6 text-center shadow-2xl">
          <img
            src={won ? LOCAL_IMAGES.tacticalShield : LOCAL_IMAGES.wolfEmblem}
            alt="Outcome Crest"
            className="mx-auto h-20 w-20 rounded-sm border border-amber-500/45 object-cover"
          />
          <div className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-400">
            First to 5 Rounds · Match Complete
          </div>
          <h2 className="mt-1 font-display text-4xl font-extrabold uppercase tracking-wide text-white">
            {isSpectator
              ? `Team ${hud.matchWinner} Wins`
              : won
              ? 'Booyah · Victory'
              : 'Match Defeat'}
          </h2>

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <div className="rounded-sm border border-white/10 bg-[#0e1525] p-3">
              <div className="text-[10px] font-bold uppercase text-slate-400">Final Score</div>
              <div className="mt-1 font-mono-tech text-xl font-extrabold tabular-nums text-white">
                {hud.scoreA} – {hud.scoreB}
              </div>
            </div>
            <div className="rounded-sm border border-white/10 bg-[#0e1525] p-3">
              <div className="text-[10px] font-bold uppercase text-slate-400">Eliminations</div>
              <div className="mt-1 font-mono-tech text-xl font-extrabold tabular-nums text-amber-400">
                {hud.kills}
              </div>
            </div>
            <div className="rounded-sm border border-white/10 bg-[#0e1525] p-3">
              <div className="text-[10px] font-bold uppercase text-slate-400">Damage</div>
              <div className="mt-1 font-mono-tech text-xl font-extrabold tabular-nums text-sky-400">
                {hud.damageDealt}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            {hud.mode === 'offline' && (
              <button
                type="button"
                data-start="true"
                onClick={onRestart}
                className="w-full rounded-sm bg-amber-500 py-3 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-400"
              >
                Play Again
              </button>
            )}
            <button
              type="button"
              data-start={hud.mode !== 'offline' ? 'true' : undefined}
              onClick={onExitToLobby}
              className={`w-full rounded-sm py-3 text-xs font-extrabold uppercase tracking-[0.16em] ${
                hud.mode === 'offline'
                  ? 'border border-white/15 bg-[#101829] text-white hover:border-amber-500/60'
                  : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
              }`}
            >
              Return to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
