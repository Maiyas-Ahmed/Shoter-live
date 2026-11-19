import wolfEmblemUrl from './images/wolf_emblem_1795080813352.jpg';
import tacticalShieldUrl from './images/tactical_icons_sheet_1795080814121.jpg';
import arenaGroundTileUrl from './images/arena_ground_tile_1795080814560.jpg';

function svgDataUri(svgInner: string, viewBox = '0 0 32 32'): string {
  const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none">${svgInner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(full)}`;
}

export const LOCAL_IMAGES = {
  wolfEmblem: wolfEmblemUrl,
  tacticalShield: tacticalShieldUrl,
  arenaGroundTile: arenaGroundTileUrl,
};

// All UI/HUD icons are local offline data-URI images (zero external links).
export const ICON_IMAGES = {
  play: svgDataUri(
    `<circle cx="16" cy="16" r="14" fill="#1e293b" stroke="#f59e0b" stroke-width="2"/>
     <polygon points="13,10 23,16 13,22" fill="#f59e0b"/>`,
  ),
  pause: svgDataUri(
    `<rect x="2" y="2" width="28" height="28" rx="6" fill="#0f172a" stroke="#64748b" stroke-width="1.5"/>
     <rect x="10" y="9" width="4" height="14" rx="1" fill="#f8fafc"/>
     <rect x="18" y="9" width="4" height="14" rx="1" fill="#f8fafc"/>`,
  ),
  audioOn: svgDataUri(
    `<rect x="2" y="2" width="28" height="28" rx="6" fill="#0f172a" stroke="#64748b" stroke-width="1.5"/>
     <path d="M8 13h4l5-4v14l-5-4H8v-6z" fill="#f59e0b"/>
     <path d="M20 11c1.8 1.4 2.5 3.1 2.5 5s-.7 3.6-2.5 5" stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/>
     <path d="M23 8.5c2.6 2 3.8 4.6 3.8 7.5s-1.2 5.5-3.8 7.5" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round"/>`,
  ),
  audioOff: svgDataUri(
    `<rect x="2" y="2" width="28" height="28" rx="6" fill="#0f172a" stroke="#64748b" stroke-width="1.5"/>
     <path d="M8 13h4l5-4v14l-5-4H8v-6z" fill="#64748b"/>
     <path d="M20 12l6 8M26 12l-6 8" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round"/>`,
  ),
  crosshair: svgDataUri(
    `<circle cx="16" cy="16" r="9" stroke="#f59e0b" stroke-width="2"/>
     <circle cx="16" cy="16" r="2.2" fill="#ef4444"/>
     <path d="M16 3v5M16 24v5M3 16h5M24 16h5" stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/>`,
  ),
  shield: svgDataUri(
    `<path d="M16 3L5 7.5v8.2c0 6.5 4.7 11.4 11 13.3 6.3-1.9 11-6.8 11-13.3V7.5L16 3z" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
     <path d="M16 7l-7 2.8v5.5c0 4.5 3 8 7 9.4V7z" fill="#38bdf8" opacity="0.35"/>
     <path d="M12 15.5l3 3 5.5-6" stroke="#f8fafc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  friends: svgDataUri(
    `<circle cx="12" cy="11" r="4" fill="#f59e0b"/>
     <path d="M5 24c0-3.8 3.1-6.5 7-6.5s7 2.7 7 6.5" stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/>
     <circle cx="22" cy="12" r="3" fill="#38bdf8"/>
     <path d="M20 23.5c.8-2.6 2.8-4.2 5.2-4.2 1.8 0 3.2.8 3.8 2.2" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>`,
  ),
  spectator: svgDataUri(
    `<path d="M3 16s4.8-7.5 13-7.5S29 16 29 16s-4.8 7.5-13 7.5S3 16 3 16z" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
     <circle cx="16" cy="16" r="4" fill="#38bdf8"/>
     <circle cx="16" cy="16" r="1.6" fill="#0f172a"/>`,
  ),
  trophy: svgDataUri(
    `<path d="M9 5h14v7c0 4-3 7.2-7 7.2S9 16 9 12V5z" fill="#f59e0b" stroke="#fde68a" stroke-width="1.5"/>
     <path d="M9 7H5.5c0 3.5 1.4 5.5 3.5 6M23 7h3.5c0 3.5-1.4 5.5-3.5 6" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
     <path d="M16 19.2V25M11 26h10" stroke="#fde68a" stroke-width="2.4" stroke-linecap="round"/>`,
  ),
  customRoom: svgDataUri(
    `<rect x="4" y="6" width="24" height="20" rx="3" fill="#1e293b" stroke="#f59e0b" stroke-width="2"/>
     <path d="M10 14h12M10 19h8" stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/>
     <circle cx="23" cy="21" r="2.2" fill="#22c55e"/>`,
  ),
  bot: svgDataUri(
    `<rect x="6" y="8" width="20" height="16" rx="4" fill="#1e293b" stroke="#22c55e" stroke-width="2"/>
     <path d="M16 4v4" stroke="#22c55e" stroke-width="2" stroke-linecap="round"/>
     <circle cx="12" cy="15" r="2" fill="#22c55e"/>
     <circle cx="20" cy="15" r="2" fill="#22c55e"/>
     <path d="M11 20h10" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>`,
  ),
  reload: svgDataUri(
    `<path d="M23 11a8 8 0 1 0 1.4 7.8" stroke="#f8fafc" stroke-width="2.4" stroke-linecap="round"/>
     <polygon points="24,6 26,12 20,11" fill="#f59e0b"/>`,
  ),
  jump: svgDataUri(
    `<path d="M16 24V9M10 14l6-6 6 6" stroke="#f8fafc" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
     <path d="M8 26h16" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round"/>`,
  ),
  swap: svgDataUri(
    `<path d="M6 12h18M19 7l5 5-5 5M26 21H8M13 16l-5 5 5 5" stroke="#f8fafc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  copy: svgDataUri(
    `<rect x="10" y="9" width="14" height="16" rx="2" fill="#0f172a" stroke="#f59e0b" stroke-width="2"/>
     <path d="M7 20V6h12" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>`,
  ),
  mobilePad: svgDataUri(
    `<rect x="8" y="4" width="16" height="24" rx="3" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
     <circle cx="16" cy="23" r="1.5" fill="#38bdf8"/>
     <path d="M12 10h8M12 14h8" stroke="#94a3b8" stroke-width="1.6" stroke-linecap="round"/>`,
  ),
  mp40: svgDataUri(
    `<path d="M4 14h18l3-2h3v3l-4 1-2 5h-3l1-5h-5l-2 7H9l2-7H4v-2z" fill="#f59e0b" stroke="#0f172a" stroke-width="1.2"/>`,
  ),
  ak47: svgDataUri(
    `<path d="M2 15h17l4-2h6v2l-5 1-2 2-3 6h-3l2-6h-5l-2 4H7l1-4-6 2v-5z" fill="#ef4444" stroke="#0f172a" stroke-width="1.2"/>`,
  ),
  m1887: svgDataUri(
    `<path d="M3 16h24v2H13l-2 4H5l2-4H3v-2z" fill="#38bdf8" stroke="#0f172a" stroke-width="1.2"/>
     <rect x="3" y="13.5" width="24" height="2" fill="#e2e8f0"/>`,
  ),
  awm: svgDataUri(
    `<path d="M2 16h26v2H15l-2 4H6l2-4H2v-2z" fill="#22c55e" stroke="#0f172a" stroke-width="1.2"/>
     <rect x="10" y="11" width="9" height="2.4" rx="1" fill="#e2e8f0"/>`,
  ),
};
