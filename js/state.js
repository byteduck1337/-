import { BAL, STATS, WEAPONS, W_MAX, wUpCost, BUILDINGS, CHAR_SKINS, WEAPON_SKINS, BOX_COST, DUP_REFUND, RARITY, PERKS, sealsFor } from './config.js?v=8';
import { emit } from './events.js?v=8';
import { uuid } from './utils.js?v=8';

const KEY = 'cherta_save_v10';
const LEGACY_KEYS = ['cherta_save_v9', 'cherta_save_v8', 'cherta_save_v7', 'cherta_save_v6', 'cherta_save_v5', 'cherta_save_v4', 'cherta_save_v3', 'cherta_save_v2', 'cherta_save_v1'];
const DEF = () => ({
  v: 10, nick: 'СТРАННИК', level: 1, xp: 0, pts: 0,
  stats: { str: 0, agi: 0, vit: 0, pre: 0, eng: 0, lck: 0 },
  gold: BAL.startGold, best: 0, runs: 0, kills: 0, askResume: true,
  sound: true, speed: 1, shake: !matchMedia('(prefers-reduced-motion: reduce)').matches,
  grain: true, quality: 'high', board: [], seenHint: false,
  weapon: 'fists', weapons: { fists: { own: true, lvl: 0 } },
  weaponKills: {},
  owned: { weapons: ['fists'] },
  ascensions: 0, seals: 0, shards: 0,
  perks: {}, challenges: {},
  skins: { char: 'default', weapon: 'ink' },
  ownedSkins: { char: ['default'], weapon: ['ink'] },
  playerId: '', playerToken: '', nickChangedAt: 0,
});
export let S = DEF();
try {
  let raw = localStorage.getItem(KEY);
  if (!raw) for (const k of LEGACY_KEYS) { raw = localStorage.getItem(k); if (raw) break; }
  if (raw) {
    const p = JSON.parse(raw);
    S = Object.assign(DEF(), p);
    S.stats = Object.assign(DEF().stats, p.stats || {});
    S.weapons = Object.assign({ fists: { own: true, lvl: 0 } }, p.weapons || {});
    if (!Array.isArray(S.board)) S.board = [];
    if (!S.owned || !Array.isArray(S.owned.weapons)) S.owned = { weapons: ['fists'] };
    if (!S.perks || typeof S.perks !== 'object') S.perks = {};
    if (!S.challenges || typeof S.challenges !== 'object') S.challenges = {};
    if (!S.weaponKills || typeof S.weaponKills !== 'object') S.weaponKills = {};
    if (!S.skins) S.skins = { char: 'default', weapon: 'ink' };
    if (!S.ownedSkins) S.ownedSkins = { char: ['default'], weapon: ['ink'] };
    if (!Array.isArray(S.ownedSkins.char)) S.ownedSkins.char = ['default'];
    if (!Array.isArray(S.ownedSkins.weapon)) S.ownedSkins.weapon = ['ink'];
    if (!S.ownedSkins.char.includes('default')) S.ownedSkins.char.push('default');
    if (!S.ownedSkins.weapon.includes('ink')) S.ownedSkins.weapon.push('ink');
    S.seals = Math.max(0, +S.seals || 0);
    S.shards = Math.max(0, +S.shards || 0);
    S.ascensions = Math.max(0, +S.ascensions || 0);
    for (const id of Object.keys(S.weapons)) if (S.weapons[id]?.own && !S.owned.weapons.includes(id)) S.owned.weapons.push(id);
    delete S.api;
  }
} catch (e) { console.warn('save reset', e); }
if (!S.owned.weapons.includes('fists')) S.owned.weapons.unshift('fists');
if (!WEAPONS[S.weapon] || !S.weapons[S.weapon]?.own) S.weapon = S.owned.weapons.find(id => S.weapons[id]?.own) || 'fists';
if (!S.weapons.fists) S.weapons.fists = { own: true, lvl: 0 };
S.level = Math.max(1, S.level | 0); S.gold = Math.max(0, +S.gold || 0);

let saveTimer = null;
export function saveNow() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
export function saveSoon() { if (!saveTimer) saveTimer = setTimeout(() => { saveTimer = null; saveNow(); }, 700); }
addEventListener('beforeunload', saveNow);

export function setIdentity(id, token) { S.playerId = id; S.playerToken = token; saveNow(); }
export function setNick(nick) { S.nick = nick; saveSoon(); emit('nick'); }

export let D = {};
export function calc() {
  const st = S.stats, lm = 1 + .04 * (S.level - 1);
  const w = WEAPONS[S.weapon] || WEAPONS.fists;
  const wl = Math.min(W_MAX, S.weapons[S.weapon]?.lvl || 0);
  const perkGold = 1 + (S.perks?.gold || 0) * .05;
  const perkXp = 1 + (S.perks?.xp || 0) * .05;
  const perkDmg = 1 + (S.perks?.dmg || 0) * .06;
  const perkHp = 1 + (S.perks?.hp || 0) * .06;
  const perktemp = 1 + (S.perks?.temp || 0) * .03;
  const perkStart = (S.perks?.start || 0) * 150;
  const charSkin = CHAR_SKINS.find(s => s.id === S.skins.char) || CHAR_SKINS[0];
  const wSkin = WEAPON_SKINS.find(s => s.id === S.skins.weapon) || WEAPON_SKINS[0];
  D = {
    wLvl: wl, kind: w.kind, kb: w.kb * (1 + .05 * st.str), pierce: w.pierce || 0, steal: w.steal || 0, shock: w.shock || 0,
    dmg: 10 * (1 + .18 * st.str) * lm * w.dmg * (1 + .2 * wl) * perkDmg,
    rate: Math.min(5, w.rate * (1 + .06 * st.agi) * (1 + .04 * wl) * perktemp),
    range: w.range + wl * 2,
    swingDur: (w.kind === 'slam' ? .3 : w.kind === 'spin' ? .34 : .2) / (1 + .05 * st.agi),
    maxHp: Math.round((100 + 22 * st.vit) * lm * perkHp),
    crit: Math.min(.7, .05 + .015 * st.pre + (w.crit || 0)),
    critM: 1.5 + .05 * st.pre,
    dodge: Math.min(.4, .01 * st.agi),
    regen: .35 * st.vit,
    move: 170 + 4 * st.agi,
    goldM: (1 + .06 * st.lck) * perkGold,
    xpM: (1 + .05 * st.lck) * perkXp,
    tDmg: 1 + .14 * st.eng, tRate: 1 + .05 * st.eng, supportM: 1 + .08 * st.eng,
    whirlCd: 7 * (1 - Math.min(.35, .012 * st.agi)),
    cap: BAL.statCap(S.level),
    startBonus: perkStart,
    skin: { col: charSkin.col, glow: charSkin.glow, alpha: charSkin.alpha || 1 },
    wSkin: { edge: wSkin.edge, glow: wSkin.glow },
  };
}
calc();

export function gainGold(v) { v = Math.round(v); S.gold += v; emit('gold', S.gold); saveSoon(); }
export function gainXp(v) {
  v = Math.round(v); S.xp += v;
  let leveled = false;
  while (S.xp >= BAL.xpNeed(S.level) && S.level < 999) { S.xp -= BAL.xpNeed(S.level); S.level++; S.pts += BAL.ptsPerLevel; leveled = true; }
  if (leveled) { calc(); emit('level', S.level); }
  emit('xp'); saveSoon();
}
export function gainWeaponKill(id) {
  S.weaponKills[id] = (S.weaponKills[id] || 0) + 1;
  if (S.weaponKills[id] === 1) emit('weaponKills');
}
export function addStat(k, n) {
  const room = Math.min(S.pts, D.cap - S.stats[k], n);
  if (room <= 0) return false;
  S.stats[k] += room; S.pts -= room;
  const om = D.maxHp; calc();
  emit('stats', { hpDelta: D.maxHp - om, k, n: room }); saveSoon(); return true;
}
export function respec() {
  const cost = BAL.respecCost(S.level), total = Object.values(S.stats).reduce((a, b) => a + b, 0);
  if (S.gold < cost || !total) return false;
  S.gold -= cost; S.pts += total;
  STATS.forEach(d => S.stats[d.k] = 0);
  calc(); emit('stats', { hpDelta: 0 }); emit('gold', S.gold); saveSoon(); return true;
}
export function weaponUnlocked(id) {
  const w = WEAPONS[id];
  if (!w) return false;
  const req = w.req || {};
  if (req.lvl && S.level < req.lvl) return false;
  if (req.asc && S.ascensions < req.asc) return false;
  if (req.kills) {
    const [wid, cnt] = req.kills;
    if ((S.weaponKills[wid] || 0) < cnt) return false;
  }
  return true;
}
export function buildingUnlocked(type) {
  const b = BUILDINGS[type];
  if (!b) return false;
  const req = b.req || {};
  if (req.lvl && S.level < req.lvl) return false;
  if (req.asc && S.ascensions < req.asc) return false;
  return true;
}
export function buyWeapon(id) {
  const w = WEAPONS[id];
  if (!w || S.weapons[id]?.own || S.gold < w.cost || !weaponUnlocked(id)) return false;
  S.gold -= w.cost; S.weapons[id] = { own: true, lvl: 0 }; S.weapon = id;
  if (!S.owned.weapons.includes(id)) S.owned.weapons.push(id);
  calc();
  emit('gold', S.gold); emit('weapon'); saveSoon(); return true;
}
export function upgradeWeapon(id) {
  const rec = S.weapons[id];
  if (!rec?.own || rec.lvl >= W_MAX) return false;
  const cost = wUpCost(id, rec.lvl);
  if (S.gold < cost) return false;
  S.gold -= cost; rec.lvl++;
  if (S.weapon === id) calc();
  emit('gold', S.gold); emit('weapon'); emit('weapon:up', { id, lvl: rec.lvl }); saveSoon(); return true;
}
export function equipWeapon(id) {
  if (!S.weapons[id]?.own || S.weapon === id) return false;
  S.weapon = id; calc(); emit('weapon'); saveSoon(); return true;
}
export function ascensionGain() {
  return Math.max(0, sealsFor(S.best, S.level));
}
export function ascend() {
  if (S.best < 15) return false;
  const gain = ascensionGain();
  if (gain <= 0) return false;
  S.seals += gain;
  S.ascensions += 1;
  S.best = 0;
  S.gold = BAL.startGold;
  S.weapons = { fists: { own: true, lvl: 0 } };
  S.owned = { weapons: ['fists'] };
  S.weapon = 'fists';
  S.stats = { str: 0, agi: 0, vit: 0, pre: 0, eng: 0, lck: 0 };
  S.level = 1; S.xp = 0; S.pts = 0;
  S.board = [];
  S.runs = 0; S.kills = 0;
  S.weaponKills = {};
  calc();
  emit('gold', S.gold); emit('weapon'); emit('stats', { hpDelta: 0 }); emit('level', 1); emit('ascension', gain);
  saveNow(); return true;
}
export function buyPerk(key) {
  const def = PERKS.find(p => p.k === key);
  if (!def) return false;
  const lvl = S.perks[key] || 0;
  if (lvl >= def.max) return false;
  const cost = def.cost(lvl);
  if (S.seals < cost) return false;
  S.seals -= cost;
  S.perks[key] = lvl + 1;
  calc();
  emit('perks'); saveSoon(); return true;
}
export function buyCharSkin(id) {
  const skin = CHAR_SKINS.find(s => s.id === id);
  if (!skin || S.ownedSkins.char.includes(id)) return false;
  if (S.gold < skin.cost) return false;
  S.gold -= skin.cost;
  S.ownedSkins.char.push(id);
  S.skins.char = id;
  calc();
  emit('gold', S.gold); emit('skins'); emit('weapon'); saveSoon(); return true;
}
export function buyWeaponSkin(id) {
  const skin = WEAPON_SKINS.find(s => s.id === id);
  if (!skin || S.ownedSkins.weapon.includes(id)) return false;
  const req = skin.req || {};
  if (req.kills && (S.weaponKills[S.weapon] || 0) + (Object.values(S.weaponKills).reduce((a, b) => a + b, 0)) < req.kills) {
    if ((Object.values(S.weaponKills).reduce((a, b) => a + b, 0)) < req.kills) return false;
  }
  if (req.own && !S.weapons[req.own]?.own) return false;
  if (S.gold < skin.cost) return false;
  S.gold -= skin.cost;
  S.ownedSkins.weapon.push(id);
  S.skins.weapon = id;
  calc();
  emit('gold', S.gold); emit('skins'); emit('weapon'); saveSoon(); return true;
}
export function equipCharSkin(id) {
  if (!S.ownedSkins.char.includes(id) || S.skins.char === id) return false;
  S.skins.char = id; calc(); emit('skins'); emit('weapon'); saveSoon(); return true;
}
export function equipWeaponSkin(id) {
  if (!S.ownedSkins.weapon.includes(id) || S.skins.weapon === id) return false;
  S.skins.weapon = id; calc(); emit('skins'); emit('weapon'); saveSoon(); return true;
}
export function openBox() {
  if (S.shards < BOX_COST) return null;
  S.shards -= BOX_COST;
  const roll = Math.random();
  let rarity = 'common';
  let acc = 0;
  for (const r of ['legend', 'epic', 'rare', 'common']) {
    acc += RARITY[r].w;
    if (roll < acc) { rarity = r; break; }
  }
  const pool = [];
  for (const s of CHAR_SKINS) if (s.rarity === rarity && !S.ownedSkins.char.includes(s.id)) pool.push({ kind: 'char', skin: s });
  for (const s of WEAPON_SKINS) if (s.rarity === rarity && !S.ownedSkins.weapon.includes(s.id)) pool.push({ kind: 'weapon', skin: s });
  if (!pool.length) {
    const refund = Math.round(BOX_COST * DUP_REFUND);
    S.shards += refund;
    saveSoon();
    return { dup: true, refund, rarity };
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (pick.kind === 'char') S.ownedSkins.char.push(pick.skin.id);
  else S.ownedSkins.weapon.push(pick.skin.id);
  saveNow();
  emit('shards'); emit('skins');
  return { kind: pick.kind, skin: pick.skin, rarity };
}
export function pushLocal(entry) {
  S.board.push(entry);
  S.board.sort((a, b) => b.wave - a.wave || b.kills - a.kills);
  S.board = S.board.slice(0, 12);
}
export const newRunId = uuid;