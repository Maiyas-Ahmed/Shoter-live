import React, { useState } from 'react';
import { ICON_IMAGES, LOCAL_IMAGES } from '../assets/iconImages';
import { normalizeTag4, sanitizePlayerName } from '../game/rules';

interface TitleScreenProps {
  initialName: string;
  initialTag4: string;
  onEnterLobby: (name: string, tag4: string) => void;
  onQuickOffline: (name: string, tag4: string) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  initialName,
  initialTag4,
  onEnterLobby,
  onQuickOffline,
}) => {
  const [name, setName] = useState(initialName);
  const [tag4, setTag4] = useState(initialTag4);
  const [error, setError] = useState('');

  const handleRandomTag = () => {
    setTag4(String(1000 + Math.floor(Math.random() * 9000)));
  };

  const submitLobby = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanName = sanitizePlayerName(name);
    if (!name.trim()) {
      setError('Enter your operator callsign to continue.');
      return;
    }
    const cleanTag = normalizeTag4(tag4);
    setError('');
    onEnterLobby(cleanName, cleanTag);
  };

  const submitOffline = () => {
    const cleanName = sanitizePlayerName(name || 'LoneWolf');
    const cleanTag = normalizeTag4(tag4);
    onQuickOffline(cleanName, cleanTag);
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-8 lg:p-12 pointer-events-none">
      {/* Top subtle tactical header bar */}
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300/90">
        <div className="inline-flex items-center gap-2 bg-[#080d17]/90 border border-white/10 px-3 py-1.5 rounded-sm">
          <span className="h-1.5 w-1.5 bg-amber-500" />
          <span>FIRST TO 5 ROUNDS · 1V1 &amp; 2V2 ARENA</span>
        </div>
        <div className="hidden sm:inline-flex items-center gap-2 bg-[#080d17]/90 border border-white/10 px-3 py-1.5 rounded-sm font-mono-tech text-slate-400">
          <span>DIRECT ENTRY · ZERO LOGIN REQUIRED</span>
        </div>
      </div>

      {/* Left-third negative-space tactical deployment console leaving 3D arena clear on the right */}
      <div className="my-auto w-full max-w-[420px] rounded-md border border-white/15 border-t-2 border-t-amber-500 bg-[#080d17]/94 p-6 sm:p-7 shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-4 border-b border-white/10 pb-5">
          <img
            src={LOCAL_IMAGES.wolfEmblem}
            alt="Lone Wolf Crest"
            className="h-14 w-14 rounded-sm border border-amber-500/50 object-cover"
          />
          <div className="min-w-0">
            <h1 className="font-display text-4xl font-extrabold uppercase leading-none tracking-wider text-white">
              LONE WOLF
            </h1>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="h-[3px] w-10 bg-amber-500" />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-400">
                TPP DUEL ARENA
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={submitLobby} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="player-name-input"
              className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300"
            >
              Operator Callsign
            </label>
            <input
              id="player-name-input"
              type="text"
              maxLength={24}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter callsign (e.g. Rafi)"
              className="mt-1.5 w-full rounded-sm border border-white/15 bg-[#0e1525] px-3.5 py-2.5 text-sm font-semibold text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="player-tag-input"
              className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300"
            >
              4-Digit Tactical ID
            </label>
            <div className="mt-1.5 flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono-tech text-sm font-bold text-amber-400">
                  #
                </span>
                <input
                  id="player-tag-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={tag4}
                  onChange={(e) => setTag4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="4729"
                  className="w-full rounded-sm border border-white/15 bg-[#0e1525] py-2.5 pl-8 pr-3 font-mono-tech text-sm font-bold tracking-[0.22em] text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleRandomTag}
                className="rounded-sm border border-white/15 bg-[#121b2e] px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-200 hover:border-amber-500/70 hover:text-amber-300"
              >
                Roll ID
              </button>
            </div>
          </div>

          {error && <p className="text-xs font-semibold text-red-400">{error}</p>}

          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="submit"
              data-start="true"
              className="flex w-full items-center justify-center gap-2.5 rounded-sm bg-amber-500 px-5 py-3.5 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-950 shadow-lg hover:bg-amber-400 active:scale-[0.99]"
            >
              <img src={ICON_IMAGES.play} alt="" className="h-4 w-4" />
              Enter Online Lobby
            </button>
            <button
              type="button"
              onClick={submitOffline}
              className="flex w-full items-center justify-center gap-2 rounded-sm border border-white/15 bg-[#101829] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-200 hover:border-emerald-400/70 hover:text-emerald-300"
            >
              <img src={ICON_IMAGES.bot} alt="" className="h-4 w-4" />
              Offline Practice · 1v1 vs AI
            </button>
          </div>
        </form>
      </div>

      {/* Single flat control-hint line in bottom safe margin */}
      <div className="text-center sm:text-left">
        <p className="inline-block rounded-sm border border-white/10 bg-[#080d17]/90 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-slate-300">
          WASD Move · Mouse Aim &amp; Fire · Q Scope · E Gloo Shield · Space Jump · R Reload · Esc Pause
        </p>
      </div>
    </div>
  );
};
