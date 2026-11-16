import { BAL, DEFAULT_API } from './config.js';

const KEY = 'cherta_save_v2';
const OLD = 'cherta_save_v1';

export const DEF = () => ({
  v: 2, nick: 'СТРАННИК', level: 1, xp: 0, pts: 0,
  stats: { str: 0, agi: 0, vit: 0, pre: 0, eng: 0, lck: 0 },
  gold: BAL.startGold, best: 0, runs: 0, kills: 0,
  weapon: 'fists', owned: ['fists'],
  sound: true, speed: 1, shake: true, grain: true, quality: 'high', api: DEFAULT_API,
  board: [], seenHint: false,
});

export let S = DEF();
try {
  const raw = localStorage.getItem(KEY) || localStorage.getItem(OLD);
  if (raw) {
    const p = JSON.parse(raw);
    S = Object.assign(DEF(), p);
    S.stats = Object.assign(DEF().stats, p.stats || {});
    S.owned = Array.isArray(p.owned) ? p.owned : ['fists'];
    if (!S.owned.includes(S.weapon)) S.owned.push(S.weapon || 'fists');
    if (!Array.isArray(S.board)) S.board = [];
  }
} catch (e) {}

let timer = null;
export function saveNow() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
export function saveSoon() { if (timer) return; timer = setTimeout(() => { timer = null; saveNow(); }, 700); }
addEventListener('beforeunload', saveNow);
export function wipe() { localStorage.removeItem(KEY); localStorage.removeItem(OLD); location.reload(); }