export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const n1 = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const fmtT = s => { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export const fmtN = n => n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(Math.floor(n));
export const uuid = () => crypto.randomUUID ? crypto.randomUUID() : 'r' + Date.now() + Math.random().toString(36).slice(2);
export const NICK_RE = /^[A-Za-zА-Яа-яЁё0-9_\- ]{3,16}$/;
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const DEFAULT_API = '';

export const BAL = {
  startGold: 160,
  ptsPerLevel: 3,
  xpNeed: l => Math.round(50 * Math.pow(l, 1.6)),
  statCap: l => 3 + Math.floor(l * 0.8),
  respecCost: l => 100 + 40 * l,
  eHp: w => 16 * Math.pow(1.18, w - 1),
  eDmg: w => 4 * Math.pow(1.11, w - 1),
  eSpd: w => Math.min(92, 42 + w * 0.9),
  count: w => Math.min(36, 5 + Math.floor(w * 1.6)),
  interval: w => Math.max(0.35, 1.5 - w * 0.05),
  killGold: w => 1 + Math.floor(w * 0.6),
  killXp: w => Math.ceil(2 * Math.pow(1.12, w - 1)),
  waveGold: w => 5 + 2 * w,
  waveXp: w => 6 + 3 * w,
};

export const TYPES = {
  walk:   { hp: 1.2, dmg: 1.1, spd: 1.0, xp: 1.0, gold: 1.0, s: 30, from: 1 },
  run:    { hp: 0.7, dmg: 0.9, spd: 1.8, xp: 0.9, gold: 0.9, s: 26, from: 3 },
  brute:  { hp: 3.4, dmg: 2.0, spd: 0.6, xp: 2.6, gold: 2.6, s: 40, from: 5 },
  swarm:  { hp: 0.4, dmg: 0.5, spd: 1.5, xp: 0.5, gold: 0.4, s: 20, from: 6 },
  spit:   { hp: 1.0, dmg: 1.3, spd: 0.9, xp: 1.5, gold: 1.6, s: 30, from: 8 },
  bomber: { hp: 0.9, dmg: 0.8, spd: 1.2, xp: 1.8, gold: 1.8, s: 28, from: 9 },
  tank:   { hp: 5.0, dmg: 1.5, spd: 0.4, xp: 4.0, gold: 4.0, s: 46, from: 10 },
  shaman: { hp: 1.5, dmg: 0.8, spd: 0.7, xp: 3.0, gold: 3.0, s: 32, from: 12 },
  boss:   { hp: 34, dmg: 3.5, spd: 0.5, xp: 22, gold: 30, s: 86, from: 999 },
};

export const TOWERS = {
  mg:     { name: 'ПУЛЕМЁТ', cost: 60,  dmg: 5,  rate: 3.0, range: 260, desc: 'частые трассеры · одиночная цель', color: '#f4f4f2', shape: 'mg' },
  rail:   { name: 'РЕЛЬСА',  cost: 110, dmg: 26, rate: 0.55, range: 340, desc: 'луч сквозь всех врагов',          color: '#3ef08c', shape: 'rail' },
  mortar: { name: 'МОРТИРА', cost: 90,  dmg: 18, rate: 0.8, range: 300, desc: 'навесной · взрыв по площади',    color: '#ffc24b', shape: 'mortar' },
  laser:  { name: 'ЛАЗЕР',   cost: 140, dmg: 8,  rate: 2.5, range: 280, desc: 'непрерывный красный луч',       color: '#ff4d4d', shape: 'laser' },
};

export const WEAPONS = {
  fists:   { name: 'КУЛАКИ', cost: 0,   dmg: 1.0, rate: 1.0,  range: 82,  knock: 1.4, desc: 'базовый удар',         color: '#f4f4f2' },
  knife:   { name: 'НОЖ',    cost: 80,  dmg: 0.7, rate: 1.6,  range: 72,  knock: 0.8, desc: 'быстрые удары',        color: '#5db4ff' },
  bat:     { name: 'БИТА',   cost: 120, dmg: 1.4, rate: 0.9,  range: 96,  knock: 2.5, desc: 'сильный отброс',       color: '#ffc24b' },
  machete: { name: 'МАЧЕТЕ', cost: 180, dmg: 1.8, rate: 0.85, range: 92,  knock: 1.6, desc: 'рубящий удар',         color: '#ff8a3e' },
  axe:     { name: 'ТОПОР',  cost: 260, dmg: 2.6, rate: 0.55, range: 100, knock: 2.0, desc: 'пробивает строй',      color: '#ff4d4d' },
  katana:  { name: 'КАТАНА', cost: 360, dmg: 2.2, rate: 1.1,  range: 110, knock: 1.0, desc: 'критический удар',     color: '#3ef08c', critBonus: 0.2 },
  scythe:  { name: 'КОСА',   cost: 500, dmg: 3.0, rate: 0.7,  range: 130, knock: 1.5, desc: 'широкий замах',        color: '#a06bff' },
};

export const upCost = (type, lvl) => Math.round(TOWERS[type].cost * 0.65 * Math.pow(1.55, lvl));

export const STAT_DEFS = [
  { k: 'str', n: 'СИЛА',      eff: s => `урон ×${(1 + .14 * s).toFixed(2)}`, icon: '<path d="M4 20 L15 9 M13 4 l7 7 -3 3 -7 -7 z M4 20 l3 -1 -2 -2 z"/>' },
  { k: 'agi', n: 'ЛОВКОСТЬ',  eff: s => `темп +${(s * 3)}% · уклон ${(Math.min(30, s * .5)).toFixed(1)}%`, icon: '<path d="M3 8 h11 a3 3 0 1 0 -3 -3 M3 13 h15 a3 3 0 1 1 -3 3 M3 18 h7"/>' },
  { k: 'vit', n: 'СТОЙКОСТЬ', eff: s => `+${s * 18} HP · реген ${(s * .25).toFixed(2)}/с`, icon: '<path d="M12 20 C5 14 3 9 6.5 6.5 C9 5 12 7 12 9 C12 7 15 5 17.5 6.5 C21 9 19 14 12 20 z"/>' },
  { k: 'pre', n: 'ТОЧНОСТЬ',  eff: s => `крит ${(Math.min(60, 5 + s * 1.2)).toFixed(1)}% · ×${(1.5 + s * .04).toFixed(2)}`, icon: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>' },
  { k: 'eng', n: 'ИНЖЕНЕРИЯ', eff: s => `башни: урон +${s * 12}% · темп +${s * 4}%`, icon: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.2 2.2M16.2 16.2l2.2 2.2M18.4 5.6l-2.2 2.2M7.8 16.2l-2.2 2.2"/>' },
  { k: 'lck', n: 'УДАЧА',     eff: s => `золото +${s * 5}% · опыт +${s * 4}%`, icon: '<path d="M12 3 l3 6 6 1 -4.5 4.5 1 6.5 -5.5 -3 -5.5 3 1 -6.5 L3 10 l6 -1 z"/>' },
];

export const QUAL = { high: { parts: 520, motes: 42 }, med: { parts: 260, motes: 24 }, low: { parts: 120, motes: 12 } };