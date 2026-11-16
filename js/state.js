import { BAL, STATS, WEAPONS, W_MAX, wUpCost, DEFAULT_API } from './config.js';
import { emit } from './events.js';
import { uuid } from './utils.js';

const KEY = 'cherta_save_v2';
const DEF = () => ({
  v: 2, nick: 'СТРАННИК', level: 1, xp: 0, pts: 0,
  stats: { str: 0, agi: 0, vit: 0, pre: 0, eng: 0, lck: 0 },
  gold: BAL.startGold, best: 0, runs: 0, kills: 0,
  sound: true, speed: 1, shake: !matchMedia('(prefers-reduced-motion: reduce)').matches,
  grain: true, quality: 'high', api: DEFAULT_API, board: [], seenHint: false,
  weapon: 'fists', weapons: { fists: { own: true, lvl: 0 } },
});
export let S = DEF();
try {
  const raw = localStorage.getItem(KEY) || localStorage.getItem('cherta_save_v1');
  if (raw) {
    const p = JSON.parse(raw);
    S = Object.assign(DEF(), p);
    S.stats = Object.assign(DEF().stats, p.stats || {});
    S.weapons = Object.assign({ fists: { own: true, lvl: 0 } }, p.weapons || {});
    if (!WEAPONS[S.weapon] || !S.weapons[S.weapon]?.own) S.weapon = 'fists';
    if (!Array.isArray(S.board)) S.board = [];
  }
} catch (e) {}

let saveTimer = null;
export function saveNow() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
export function saveSoon() { if (!saveTimer) saveTimer = setTimeout(() => { saveTimer = null; saveNow(); }, 700); }
addEventListener('beforeunload', saveNow);

export let D = {};
export function calc() {
  const st = S.stats, lm = 1 + .04 * (S.level - 1);
  const w = WEAPONS[S.weapon], wl = S.weapons[S.weapon]?.lvl || 0;
  D = {
    wLvl: wl, kind: w.kind, arc: w.arc, kb: w.kb, pierce: w.pierce || 0, steal: w.steal || 0, shock: w.shock || 0,
    dmg: 10 * (1 + .14 * st.str) * lm * w.dmg * (1 + .2 * wl),
    rate: Math.min(4.5, w.rate * (1 + .03 * st.agi) * (1 + .04 * wl)),
    range: w.range + wl * 2,
    maxHp: Math.round((100 + 18 * st.vit) * lm),
    crit: Math.min(.65, .05 + .012 * st.pre + (w.crit || 0)),
    critM: 1.5 + .04 * st.pre,
    dodge: Math.min(.3, .005 * st.agi),
    regen: .25 * st.vit,
    move: 170 + 2 * st.agi,
    goldM: 1 + .05 * st.lck, xpM: 1 + .04 * st.lck,
    tDmg: 1 + .12 * st.eng, tRate: 1 + .04 * st.eng,
    whirlCd: 7 * (1 - Math.min(.35, .01 * st.agi)),
    cap: BAL.statCap(S.level),
  };
}
calc();

export function gainGold(v) {
  v = Math.round(v); S.gold += v; emit('gold', S.gold); saveSoon();
}
export function gainXp(v) {
  v = Math.round(v); S.xp += v;
  let leveled = false;
  while (S.xp >= BAL.xpNeed(S.level) && S.level < 999) {
    S.xp -= BAL.xpNeed(S.level); S.level++; S.pts += BAL.ptsPerLevel; leveled = true;
  }
  if (leveled) { calc(); emit('level', S.level); }
  emit('xp'); saveSoon();
}
export function addStat(k, n) {
  const room = Math.min(S.pts, D.cap - S.stats[k], n);
  if (room <= 0) return false;
  S.stats[k] += room; S.pts -= room;
  const om = D.maxHp; calc();
  emit('stats', { hpDelta: D.maxHp - om });
  saveSoon(); return true;
}
export function respec() {
  const cost = BAL.respecCost(S.level);
  const total = Object.values(S.stats).reduce((a, b) => a + b, 0);
  if (S.gold < cost || !total) return false;
  S.gold -= cost; S.pts += total;
  STATS.forEach(d => S.stats[d.k] = 0);
  calc(); emit('stats', { hpDelta: 0 }); emit('gold', S.gold); saveSoon(); return true;
}
export function buyWeapon(id) {
  const w = WEAPONS[id];
  if (S.weapons[id]?.own || S.gold < w.cost) return false;
  S.gold -= w.cost; S.weapons[id] = { own: true, lvl: 0 };
  S.weapon = id; calc();
  emit('gold', S.gold); emit('weapon'); saveSoon(); return true;
}
export function upgradeWeapon(id) {
  const rec = S.weapons[id];
  if (!rec?.own || rec.lvl >= W_MAX) return false;
  const cost = wUpCost(id, rec.lvl);
  if (S.gold < cost) return false;
  S.gold -= cost; rec.lvl++;
  if (S.weapon === id) calc();
  emit('gold', S.gold); emit('weapon'); saveSoon(); return true;
}
export function equipWeapon(id) {
  if (!S.weapons[id]?.own || S.weapon === id) return false;
  S.weapon = id; calc(); emit('weapon'); saveSoon(); return true;
}
export function pushLocal(entry) {
  S.board.push(entry);
  S.board.sort((a, b) => b.wave - a.wave || b.kills - a.kills);
  S.board = S.board.slice(0, 12);
}
export const newRunId = uuid;