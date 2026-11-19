import React, { useRef, useState } from 'react';
import { ICON_IMAGES } from '../assets/iconImages';

interface TouchControlsProps {
  glooCount: number;
  isAds: boolean;
  onMove: (nx: number, ny: number) => void;
  onLookDelta: (dx: number, dy: number) => void;
  onFire: (held: boolean) => void;
  onJump: () => void;
  onReload: () => void;
  onGloo: () => void;
  onToggleAds: () => void;
  onSwapWeapon: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  glooCount,
  isAds,
  onMove,
  onLookDelta,
  onFire,
  onJump,
  onReload,
  onGloo,
  onToggleAds,
  onSwapWeapon,
}) => {
  const joyRef = useRef<HTMLDivElement | null>(null);
  const joyTouchId = useRef<number | null>(null);
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  const updateJoystick = (clientX: number, clientY: number) => {
    const el = joyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const maxR = rect.width * 0.42;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnobOffset({ x: dx, y: dy });
    onMove(dx / maxR, dy / maxR);
  };

  const handleJoyStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const t = e.changedTouches[0];
    joyTouchId.current = t.identifier;
    updateJoystick(t.clientX, t.clientY);
  };

  const handleJoyMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyTouchId.current) {
        updateJoystick(t.clientX, t.clientY);
      }
    }
  };

  const handleJoyEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId.current) {
        joyTouchId.current = null;
        setKnobOffset({ x: 0, y: 0 });
        onMove(0, 0);
      }
    }
  };

  const handleLookStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    if (lookTouchId.current === null) {
      lookTouchId.current = t.identifier;
      lastLookPos.current = { x: t.clientX, y: t.clientY };
    }
  };

  const handleLookMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchId.current) {
        const dx = t.clientX - lastLookPos.current.x;
        const dy = t.clientY - lastLookPos.current.y;
        lastLookPos.current = { x: t.clientX, y: t.clientY };
        onLookDelta(dx * 1.4, dy * 1.2);
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Right half invisible drag-to-aim touch surface */}
      <div
        className="absolute right-0 top-14 bottom-0 w-1/2 pointer-events-auto touch-none"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
      />

      {/* Left virtual analog joystick */}
      <div
        ref={joyRef}
        aria-label="Movement Joystick"
        onTouchStart={handleJoyStart}
        onTouchMove={handleJoyMove}
        onTouchEnd={handleJoyEnd}
        onTouchCancel={handleJoyEnd}
        className="absolute bottom-8 left-5 h-28 w-28 rounded-full border-2 border-slate-400/50 bg-slate-950/55 pointer-events-auto touch-none flex items-center justify-center"
      >
        <div
          style={{ transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)` }}
          className="h-12 w-12 rounded-full border border-amber-400 bg-amber-500/80 shadow-lg"
        />
      </div>

      {/* Right-side tactical action buttons (>= 48px tap targets) */}
      <div className="absolute bottom-8 right-5 flex flex-col items-end gap-3 pointer-events-auto">
        <div className="flex gap-2.5">
          <button
            type="button"
            aria-label="Swap Weapon"
            onClick={onSwapWeapon}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-500 bg-slate-950/85 active:scale-95"
          >
            <img src={ICON_IMAGES.swap} alt="" className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Scope ADS"
            onClick={onToggleAds}
            className={`flex h-12 w-12 items-center justify-center rounded-full border active:scale-95 ${
              isAds ? 'border-amber-400 bg-amber-500/35' : 'border-slate-500 bg-slate-950/85'
            }`}
          >
            <img src={ICON_IMAGES.crosshair} alt="" className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Reload Weapon"
            onClick={onReload}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-500 bg-slate-950/85 active:scale-95"
          >
            <img src={ICON_IMAGES.reload} alt="" className="h-6 w-6" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Deploy Gloo Shield"
            onClick={onGloo}
            className="relative flex h-13 w-13 items-center justify-center rounded-full border border-sky-400/70 bg-slate-950/85 active:scale-95"
          >
            <img src={ICON_IMAGES.shield} alt="" className="h-6 w-6" />
            <span className="absolute -right-1 -top-1 rounded-full bg-sky-500 px-1.5 text-[10px] font-black text-slate-950">
              {glooCount}
            </span>
          </button>

          <button
            type="button"
            aria-label="Jump"
            onClick={onJump}
            className="flex h-13 w-13 items-center justify-center rounded-full border border-slate-400 bg-slate-950/85 active:scale-95"
          >
            <img src={ICON_IMAGES.jump} alt="" className="h-6 w-6" />
          </button>

          <button
            type="button"
            aria-label="Fire Weapon"
            onTouchStart={(e) => {
              e.stopPropagation();
              onFire(true);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              onFire(false);
            }}
            onTouchCancel={() => onFire(false)}
            className="flex h-18 w-18 items-center justify-center rounded-full border-2 border-amber-300 bg-red-600/90 shadow-xl active:scale-95"
          >
            <img src={ICON_IMAGES.crosshair} alt="" className="h-8 w-8" />
          </button>
        </div>
      </div>
    </div>
  );
};
