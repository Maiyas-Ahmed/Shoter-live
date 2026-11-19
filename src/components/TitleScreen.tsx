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
      setError('Please enter your tactical name.');
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
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-10 pointer-events-none">
      {/* Left-third negative-space panel leaving 3D arena clear on the right */}
      <div className="my-auto w-full max-w-md rounded-2xl border border-amber-500/30 bg-slate-950/92 p-6 sm:p-7 shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-4">
          <img
            src={LOCAL_IMAGES.wolfEmblem}
            alt="Lone Wolf Crest"
            className="h-16 w-16 rounded-xl border border-amber-500/40 object-cover"
          />
          <div>
            <svg viewBox="0 0 320 46" className="h-9 w-full max-w-[260px]" aria-label="LONE WOLF 3D">
              <text
                x="0"
                y="24"
                fill="#f8fafc"
                fontSize="26"
                fontWeight="900"
                letterSpacing="2.5"
                fontFamily="system-ui, sans-serif"
              >
                LONE WOLF
              </text>
              <rect x="0" y="32" width="102" height="3" fill="#f59e0b" />
              <text
                x="110"
                y="38"
                fill="#f59e0b"
                fontSize="11.5"
                fontWeight="800"
                letterSpacing="2.2"
                fontFamily="system-ui, sans-serif"
              >
                TPP ARENA · RACE TO 5
              </text>
            </svg>
          </div>
        </div>

        <form onSubmit={submitLobby} className="mt-6 space-y-4">
          <div>
            <label htmlFor="player-name-input" className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Player Name (কোনো লগইন লাগবে না)
            </label>
            <input
              id="player-name-input"
              type="text"
              maxLength={24}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name (e.g. Rafi)"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm font-semibold text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="player-tag-input" className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              4-Digit Tactical ID
            </label>
            <div className="mt-1.5 flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-amber-400">
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
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2.5 pl-8 pr-3 font-mono text-sm font-bold tracking-widest text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleRandomTag}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 hover:border-amber-500/60 hover:text-amber-300"
              >
                Auto ID
              </button>
            </div>
          </div>

          {error && <p className="text-xs font-semibold text-red-400">{error}</p>}

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              type="submit"
              data-start="true"
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-amber-500 px-5 py-3.5 text-sm font-black uppercase tracking-wider text-slate-950 shadow-lg hover:bg-amber-400 active:scale-[0.99]"
            >
              <img src={ICON_IMAGES.play} alt="" className="h-5 w-5" />
              Enter Tactical Lobby
            </button>
            <button
              type="button"
              onClick={submitOffline}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-200 hover:border-emerald-500/60 hover:text-emerald-300"
            >
              <img src={ICON_IMAGES.bot} alt="" className="h-4 w-4" />
              Instant Offline 1v1 (vs Bot)
            </button>
          </div>
        </form>
      </div>

      {/* Single flat control-hint line in bottom safe margin */}
      <div className="text-center sm:text-left">
        <p className="inline-block rounded-md bg-slate-950/85 px-3 py-1 text-xs font-semibold tracking-wide text-slate-300">
          WASD Move · Mouse Aim & Fire · Q Scope · E Gloo Shield · Space Jump · R Reload · Esc Pause
        </p>
      </div>
    </div>
  );
};
