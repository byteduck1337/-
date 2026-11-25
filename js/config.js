export const API_BASE = 'https://g3g.okeysexsex.workers.dev';
export const BAL = {
  startGold: 200, ptsPerLevel: 3,
  xpNeed: l => Math.round(50 * Math.pow(l, 1.6)),
  statCap: l => 4 + Math.floor(l * .9),
  respecCost: l => 100 + 40 * l,
  eHp: w => 22 * Math.pow(1.17, w - 1),
  eDmg: w => 5 * Math.pow(1.11, w - 1),
  eSpd: w => Math.min(96, 44 + w * .9),
  count: w => Math.min(36, 6 + Math.floor(w * 1.5)),
  interval: w => Math.max(.38, 1.45 - w * .045),
  killGold: w => 1 + Math.floor(w * .5),
  killXp: w => Math.ceil(2.4 * Math.pow(1.12, w - 1)),
  waveGold: w => 5 + Math.round(w * 1.6),
  waveXp: w => 8 + 3 * w,
  armor: w => 2 + w * .35,
};
export const SPEEDS = [1, 2, 5];
export const skipCost = (wave, n) => Math.round((14 + wave * 3.2) * n * (n === 10 ? .85 : 1));
export const STATS = [
  { k: 'str', n: 'СИЛА', eff: s => `урон ×${(1 + .18 * s).toFixed(2)} · отброс +${s * 5}%` },
  { k: 'agi', n: 'ЛОВКОСТЬ', eff: s => `темп +${s * 6}% · уклон ${Math.min(40, s)}% · быстрее бег` },
  { k: 'vit', n: 'СТОЙКОСТЬ', eff: s => `+${s * 22} HP · реген ${(s * .35).toFixed(2)}/с` },
  { k: 'pre', n: 'ТОЧНОСТЬ', eff: s => `крит ${Math.min(70, 5 + s * 1.5).toFixed(1)}% · ×${(1.5 + s * .05).toFixed(2)}` },
  { k: 'eng', n: 'ИНЖЕНЕРИЯ', eff: s => `постройки: урон +${s * 14}% · темп +${s * 5}% · поддержка +${s * 8}%` },
  { k: 'lck', n: 'УДАЧА', eff: s => `золото +${s * 6}% · опыт +${s * 5}%` },
];
export const WEAPONS = {
  fists:  { name: 'КУЛАКИ', flavor: 'то, с чего все начинают', cost: 0, req: {}, dmg: 1, rate: 1.15, range: 62, kb: 6, kind: 'jab', crit: 0, pierce: 0, steal: 0 },
  knife:  { name: 'НОЖ', flavor: 'быстрый. тихий. свой.', cost: 180, req: { lvl: 3, kills: ['fists', 60] }, dmg: 1.2, rate: 1.7, range: 74, kb: 8, kind: 'jab', crit: .06, pierce: 0, steal: 0 },
  bat:    { name: 'БИТА', flavor: 'убеждает с одного раза', cost: 900, req: { lvl: 6, kills: ['knife', 150] }, dmg: 1.8, rate: .95, range: 96, kb: 46, kind: 'swing', crit: 0, pierce: 2, steal: 0 },
  katana: { name: 'КАТАНА', flavor: 'режет строй, а не бойца', cost: 3800, req: { lvl: 8, asc: 1, kills: ['bat', 300] }, dmg: 2.3, rate: 1.25, range: 122, kb: 14, kind: 'swing', crit: .1, pierce: 5, steal: 0 },
  hammer: { name: 'МОЛОТ', flavor: 'аргумент против брони', cost: 14000, req: { lvl: 10, asc: 2, kills: ['katana', 450] }, dmg: 3.8, rate: .55, range: 104, kb: 96, kind: 'slam', crit: 0, pierce: 99, steal: 0, shock: 82 },
  scythe: { name: 'КОСА', flavor: 'круг замкнулся', cost: 42000, req: { lvl: 14, asc: 3, kills: ['hammer', 600] }, dmg: 3, rate: .8, range: 150, kb: 30, kind: 'spin', crit: .04, pierce: 99, steal: .05 },
};
export const WEAPON_ORDER = ['fists', 'knife', 'bat', 'katana', 'hammer', 'scythe'];
export const W_MAX = 5;
export const wUpCost = (id, lvl) => Math.round(Math.max(90, WEAPONS[id].cost * .55) * Math.pow(1.75, lvl));
export const SLOTS = 4;
export const BUILDINGS = {
  mg:     { name: 'ПУЛЕМЁТ', cost: 70, req: {}, dmg: 6, rate: 3, range: 260, kind: 'attack', tag: 'АТАКА', desc: 'трассеры по одной цели' },
  spikes: { name: 'ШИПЫ', cost: 45, req: {}, dmg: 9, rate: 2, range: 74, kind: 'trap', tag: 'ЛОВУШКА', desc: 'режет каждого на земле' },
  wall:   { name: 'СТЕНА', cost: 70, req: { lvl: 4 }, hp: 150, kind: 'wall', tag: 'ОБОРОНА', desc: 'враги ломают её вместо героя' },
  gen:    { name: 'ГЕНЕРАТОР', cost: 120, req: { lvl: 6 }, kind: 'econ', tag: 'ЭКОНОМИКА', desc: '+золото каждые 5с' },
  mortar: { name: 'МОРТИРА', cost: 110, req: { lvl: 8, asc: 1 }, dmg: 22, rate: .8, range: 300, kind: 'attack', tag: 'АТАКА', desc: 'навесной снаряд · взрыв' },
  fix:    { name: 'РЕМСТАНЦИЯ', cost: 100, req: { lvl: 10 }, kind: 'support', tag: 'ПОДДЕРЖКА', desc: 'лечит героя каждые 4с' },
  totem:  { name: 'ТОТЕМ', cost: 190, req: { lvl: 12, asc: 1 }, kind: 'aura', tag: 'АУРА', desc: '+урон и темп в радиусе' },
  tesla:  { name: 'КАТУШКА', cost: 180, req: { lvl: 14, asc: 2 }, dmg: 15, rate: 1.1, range: 230, kind: 'attack', tag: 'АТАКА', desc: 'молния на 3+ целей' },
  rail:   { name: 'РЕЛЬСА', cost: 140, req: { lvl: 16, asc: 3 }, dmg: 30, rate: .55, range: 340, kind: 'attack', tag: 'АТАКА', desc: 'прошивает всех на линии' },
};
export const B_ORDER = ['mg', 'spikes', 'wall', 'gen', 'mortar', 'fix', 'totem', 'tesla', 'rail'];
export const bUpCost = (type, lvl) => Math.round(BUILDINGS[type].cost * .65 * Math.pow(1.55, lvl));
export const B_MAX = 5;
export const bPermCost = (type, lvl) => Math.round(BUILDINGS[type].cost * 1.2 * Math.pow(1.9, lvl));
export const ASC_NEED = a => 20 + a * 5;
export const sealsFor = (wave, level) => Math.floor(wave * .6) + Math.floor(level * .4) + (wave >= 30 ? 10 : 0);
export const PERKS = [
  { k: 'dmg', n: 'КЛИНОК ЭХА', d: '+6% урона за уровень', max: 10, cost: l => 2 + l * 2 },
  { k: 'gold', n: 'ЖИЛА ЭХА', d: '+5% золота за уровень', max: 10, cost: l => 2 + l * 2 },
  { k: 'xp', n: 'ПАМЯТЬ ЭХА', d: '+5% опыта за уровень', max: 10, cost: l => 2 + l * 2 },
  { k: 'hp', n: 'КОСТЬ ЭХА', d: '+6% HP за уровень', max: 10, cost: l => 2 + l * 2 },
  { k: 'start', n: 'ЗАПАС ЭХА', d: '+150 стартового золота', max: 8, cost: l => 3 + l * 3 },
  { k: 'temp', n: 'ПУЛЬС ЭХА', d: '+3% темпа за уровень', max: 8, cost: l => 3 + l * 3 },
];
export const CHALLENGES = [
  { id: 'glass', n: 'СТЕКЛЯННАЯ ЧЕРТА', d: 'HP врагов ×0.5 · урон врагов ×1.6', target: 8, mod: { hpM: .5, dmgM: 1.6 }, reward: { shards: 60, seals: 2 } },
  { id: 'swarm', n: 'РОЙ', d: 'вдвое больше врагов · HP ×0.55', target: 10, mod: { countM: 2, hpM: .55 }, reward: { shards: 80, seals: 3 } },
  { id: 'armor', n: 'ПАНЦИРЬ', d: 'броня врагов ×2.2', target: 10, mod: { armorM: 2.2 }, reward: { shards: 90, seals: 3 } },
  { id: 'storm', n: 'БУРЯ', d: 'скорость врагов ×1.6', target: 12, mod: { spdM: 1.6 }, reward: { shards: 100, seals: 4 } },
  { id: 'shadow', n: 'ТЕНЬ', d: '35% врагов — призраки', target: 12, mod: { ghostP: .35 }, reward: { shards: 120, seals: 4 } },
  { id: 'siege', n: 'ОСАДА', d: 'постройки запрещены · урон ×1.3', target: 10, mod: { noBuild: true, dmgM: 1.3 }, reward: { shards: 150, seals: 5 } },
];
export function dailyChallenge(date = new Date()) {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const r = mulberry(seed);
  const pool = [{ hpM: .6 }, { dmgM: 1.5 }, { spdM: 1.4 }, { countM: 1.6 }, { armorM: 1.8 }, { goldM: 1.5 }, { ghostP: .25 }];
  const a = pool[Math.floor(r() * pool.length)], b = pool[Math.floor(r() * pool.length)];
  return { id: 'daily', n: 'РАЗЛОМ ДНЯ', d: 'модификаторы меняются каждый день · сид ' + seed, target: 15, mod: Object.assign({ goldM: 1.4 }, a, b), reward: { shards: 200, seals: 6 }, seed };
}
export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const RARITY = {
  common: { n: 'ОБЫЧНЫЙ', col: '#f2f2ee', w: .55 },
  rare: { n: 'РЕДКИЙ', col: '#5db4ff', w: .3 },
  epic: { n: 'ЭПИЧЕСКИЙ', col: '#c05dff', w: .12 },
  legend: { n: 'ЛЕГЕНДАРНЫЙ', col: '#f5b942', w: .03 },
};
export const CHAR_SKINS = [
  { id: 'default', n: 'ИНК', rarity: 'common', cost: 0, col: '#f2f2ee', glow: '#46f28e' },
  { id: 'ash', n: 'ПЕПЕЛ', rarity: 'common', cost: 80, col: '#b9b9b4', glow: '#b9b9b4' },
  { id: 'ember', n: 'УГОЛЬ', rarity: 'rare', cost: 140, col: '#f5b942', glow: '#ff8a3d' },
  { id: 'tide', n: 'ПРИЛИВ', rarity: 'rare', cost: 140, col: '#5db4ff', glow: '#5db4ff' },
  { id: 'acid', n: 'КИСЛОТА', rarity: 'rare', cost: 140, col: '#46f28e', glow: '#46f28e' },
  { id: 'blood', n: 'БАГРЕЦ', rarity: 'epic', cost: 220, col: '#ff4b4b', glow: '#ff4b4b' },
  { id: 'phantom', n: 'ФАНТОМ', rarity: 'epic', cost: 300, col: '#e8e8ff', glow: '#c05dff', alpha: .72 },
  { id: 'gilded', n: 'ЗОЛОЧЁНЫЙ', rarity: 'legend', cost: 420, col: '#f5b942', glow: '#ffe08a' },
];
export const WEAPON_SKINS = [
  { id: 'ink', n: 'СТАЛЬ', rarity: 'common', cost: 0, edge: '#f2f2ee', glow: '#f2f2ee', req: {} },
  { id: 'rust', n: 'РЖАВЧИНА', rarity: 'common', cost: 100, edge: '#c97b4a', glow: '#ff8a3d', req: { kills: 200 } },
  { id: 'neon', n: 'НЕОН', rarity: 'rare', cost: 180, edge: '#46f28e', glow: '#46f28e', req: { own: 'bat', kills: 150 } },
  { id: 'void', n: 'ПУСТОТА', rarity: 'epic', cost: 240, edge: '#c05dff', glow: '#c05dff', req: { own: 'katana', kills: 300 } },
  { id: 'solar', n: 'СОЛЯРИЙ', rarity: 'epic', cost: 400, edge: '#f5b942', glow: '#ffe08a', req: { own: 'hammer', kills: 450 } },
  { id: 'reaper', n: 'ЖНЕЦ', rarity: 'legend', cost: 600, edge: '#ff4b4b', glow: '#ff4b4b', req: { own: 'scythe', kills: 600 } },
];
export const BOX_COST = 120;
export const BOX3_COST = 320;
export const DUP_REFUND = .4;
export const ENEMIES = {
  walk:   { name: 'ШАГУН', hp: 1, dmg: 1, spd: 1, xp: 1, gold: 1, s: 30, from: 1, armor: 0, gait: 'walk' },
  run:    { name: 'БЕГУН', hp: .5, dmg: .7, spd: 1.9, xp: .9, gold: .9, s: 26, from: 2, armor: 0, gait: 'run' },
  brute:  { name: 'ГРОМИЛА', hp: 3.1, dmg: 1.9, spd: .55, xp: 2.4, gold: 2.4, s: 42, from: 4, armor: 1, gait: 'stomp' },
  spit:   { name: 'ПЛЕВАЛЬЩИК', hp: .85, dmg: 1.25, spd: .85, xp: 1.5, gold: 1.5, s: 30, from: 6, armor: 0, gait: 'shuffle', ranged: true },
  spear:  { name: 'КОПЬЕНОСЕЦ', hp: 1.3, dmg: 1.5, spd: .8, xp: 1.8, gold: 1.8, s: 32, from: 7, armor: .2, gait: 'march', reach: 96 },
  shield: { name: 'ЩИТНИК', hp: 1.7, dmg: 1.3, spd: .7, xp: 2, gold: 2, s: 33, from: 8, armor: .5, gait: 'march', shield: true },
  bomb:   { name: 'ПОДРЫВНИК', hp: .6, dmg: 2.6, spd: 1.55, xp: 1.6, gold: 1.7, s: 27, from: 9, armor: 0, gait: 'scurry', bomb: true },
  flyer:  { name: 'ЛЕТУН', hp: .7, dmg: .9, spd: 1.6, xp: 1.7, gold: 1.7, s: 24, from: 10, armor: 0, gait: 'fly', fly: true },
  ghost:  { name: 'ПРИЗРАК', hp: 1.15, dmg: 1.1, spd: 1.25, xp: 2.2, gold: 2.2, s: 31, from: 11, armor: 0, gait: 'float', ghost: true },
  berserk:{ name: 'БЕРСЕРК', hp: 1.9, dmg: 1.6, spd: 1.05, xp: 2.4, gold: 2.4, s: 34, from: 12, armor: .1, gait: 'run', rage: true },
  necro:  { name: 'НЕКРОМАНТ', hp: 1.4, dmg: 1, spd: .6, xp: 3, gold: 3, s: 34, from: 14, armor: .2, gait: 'shuffle', summon: true, hood: true },
  colossus:   { name: 'КОЛОСС', hp: 30, dmg: 3.2, spd: .48, xp: 22, gold: 26, s: 88, from: 999, armor: 1, gait: 'stomp', boss: true, spikes: true },
  brood:      { name: 'МАТКА РОЯ', hp: 24, dmg: 2.2, spd: .55, xp: 24, gold: 28, s: 74, from: 999, armor: .3, gait: 'stomp', boss: true, brood: true },
  executioner:{ name: 'ПАЛАЧ', hp: 28, dmg: 3.6, spd: .6, xp: 26, gold: 30, s: 80, from: 999, armor: .6, gait: 'march', boss: true, axe: true, charge: true },
  necrolord:  { name: 'НЕКРОПОЛЬ', hp: 22, dmg: 2.4, spd: .5, xp: 28, gold: 32, s: 78, from: 999, armor: .4, gait: 'shuffle', boss: true, summon: true, hood: true, staff: true },
  titan:      { name: 'ТИТАН', hp: 42, dmg: 4, spd: .4, xp: 34, gold: 38, s: 110, from: 999, armor: 1.6, gait: 'stomp', boss: true, titan: true, spikes: true },
};
export const BOSS_ORDER = ['colossus', 'brood', 'executioner', 'necrolord', 'titan'];
export const QUAL = { high: { parts: 520, motes: 42 }, med: { parts: 260, motes: 24 }, low: { parts: 120, motes: 12 } };
