export const START_HOUR = 6;
export const END_HOUR = 27; // 27 = 03:00 next day
export const TOTAL_HOURS = END_HOUR - START_HOUR;

export const DAYS = ['Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota', 'Nedjelja'];
export const SHORT_DAYS = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];

export const LOCATION_THEMES = {
  blue: {
    id: 'blue',
    name: 'Plava',
    bgHeader: 'from-blue-950/80 via-slate-900 to-slate-900',
    border: 'border-blue-500/40',
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25',
    bar: 'from-blue-600 to-indigo-600 border-blue-400/50',
    accent: 'text-blue-400',
    dot: 'bg-blue-500',
    printBg: '#eff6ff',
    printBorder: '#3b82f6',
    printText: '#1e3a8a'
  },
  emerald: {
    id: 'emerald',
    name: 'Zelena',
    bgHeader: 'from-emerald-950/80 via-slate-900 to-slate-900',
    border: 'border-emerald-500/40',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25',
    bar: 'from-emerald-600 to-teal-600 border-emerald-400/50',
    accent: 'text-emerald-400',
    dot: 'bg-emerald-500',
    printBg: '#ecfdf5',
    printBorder: '#10b981',
    printText: '#064e3b'
  },
  purple: {
    id: 'purple',
    name: 'Ljubičasta',
    bgHeader: 'from-purple-950/80 via-slate-900 to-slate-900',
    border: 'border-purple-500/40',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25',
    bar: 'from-purple-600 to-fuchsia-600 border-purple-400/50',
    accent: 'text-purple-400',
    dot: 'bg-purple-500',
    printBg: '#faf5ff',
    printBorder: '#8b5cf6',
    printText: '#581c87'
  },
  amber: {
    id: 'amber',
    name: 'Zlatna / Narančasta',
    bgHeader: 'from-amber-950/80 via-slate-900 to-slate-900',
    border: 'border-amber-500/40',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25',
    bar: 'from-amber-500 to-orange-600 border-amber-400/50',
    accent: 'text-amber-400',
    dot: 'bg-amber-500',
    printBg: '#fffbeb',
    printBorder: '#f59e0b',
    printText: '#78350f'
  },
  rose: {
    id: 'rose',
    name: 'Crvena / Koraljna',
    bgHeader: 'from-rose-950/80 via-slate-900 to-slate-900',
    border: 'border-rose-500/40',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25',
    bar: 'from-rose-600 to-pink-600 border-rose-400/50',
    accent: 'text-rose-400',
    dot: 'bg-rose-500',
    printBg: '#fff1f2',
    printBorder: '#f43f5e',
    printText: '#881337'
  }
};

export function formatTime(val) {
  const norm = ((val % 24) + 24) % 24;
  const h = Math.floor(norm);
  const m = Math.round((norm - h) * 60);
  return `${String(h).padStart(2, '0')}:${m === 30 ? '30' : '00'}`;
}

export function sortLocations(locs) {
  if (!Array.isArray(locs)) return [];
  return [...locs].sort((a, b) => {
    const aIsTrub = a.id === 'loc_trubarjeva' || (a.name && a.name.toLowerCase().includes('trubarjeva'));
    const bIsTrub = b.id === 'loc_trubarjeva' || (b.name && b.name.toLowerCase().includes('trubarjeva'));
    if (aIsTrub && !bIsTrub) return -1;
    if (!aIsTrub && bIsTrub) return 1;

    const aIsBav = a.id === 'loc_bavarski' || (a.name && a.name.toLowerCase().includes('bavarski'));
    const bIsBav = b.id === 'loc_bavarski' || (b.name && b.name.toLowerCase().includes('bavarski'));
    if (aIsBav && !bIsBav) return 1;
    if (!aIsBav && bIsBav) return -1;

    return (a.name || '').localeCompare(b.name || '');
  });
}

export function formatWeekRangeFromMonday(mondayDate) {
  const sunday = new Date(mondayDate);
  sunday.setDate(mondayDate.getDate() + 6);
  const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
  return `${fmt(mondayDate)} - ${fmt(sunday)}${sunday.getFullYear()}.`;
}

export function getDayDateLabel(weekObj, dayIdx) {
  if (!weekObj || !weekObj.startDateISO) return '';
  const d = new Date(weekObj.startDateISO);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + dayIdx);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}

export const SHIFT_PRESETS = [
  { label: '07:00 - 15:00 (Jutro 8h)', start: 7, end: 15 },
  { label: '08:00 - 16:00 (Jutro 8h)', start: 8, end: 16 },
  { label: '10:00 - 18:00 (Među 8h)', start: 10, end: 18 },
  { label: '10:00 - 20:00 (Džoker 10h)', start: 10, end: 20 },
  { label: '11:00 - 21:00 (Ispomoć 10h)', start: 11, end: 21 },
  { label: '14:00 - 22:00 (Popodne 8h)', start: 14, end: 22 },
  { label: '14:00 - 24:00 (Noćna 10h)', start: 14, end: 24 },
  { label: '15:00 - 01:00 (Zatvaranje 10h)', start: 15, end: 25 },
  { label: '16:00 - 02:00 (Vikend noć 10h)', start: 16, end: 26 },
  { label: '07:00 - 17:00 (Cijeli dan 10h)', start: 7, end: 17 },
  { label: '09:00 - 25:00 (Vikend Bavarski 16h)', start: 9, end: 25 }
];

