export const API_BASE = 'https://g3g.okeysexsex.workers.dev';

export const BAL = {
  startGold: 120, ptsPerLevel: 3,
  xpNeed: l => Math.round(60 * Math.pow(l, 1.65)),
  statCap: l => 3 + Math.floor(l * .7),
  respecCost: l => 200 + 80 * l,
  eHp: w => 24 * Math.pow(1.18, w - 1),
  eDmg: w => 5 * Math.pow(1.12, w - 1),
  eSpd: w => Math.min(96, 44 + w * .9),
  count: w => Math.min(30, 5 + Math.floor(w * 1.3)),
  interval: w => Math.max(.32, 1.3 - w * .04),
  killGold: w => Math.round(1.5 * Math.pow(1.09, w - 1)),
  killXp: w => Math.ceil(3 * Math.pow(1.1, w - 1)),
  waveGold: w => Math.round(10 * Math.pow(1.07, w - 1)),
  waveXp: w => Math.round(12 * Math.pow(1.08, w - 1)),
  armor: w => 2 + w * .35,
};

export const skipCost = (gold, n) => Math.max(n === 5 ? 100 : 200, Math.ceil(gold * (n === 5 ? .5 : .75)));

export const STATS = [
  { k: 'str', n: 'СИЛА', eff: s => `урон ×${(1 + .18 * s).toFixed(2)} · отброс +${s * 5}% · толще рука и след` },
  { k: 'agi', n: 'ЛОВКОСТЬ', eff: s => `темп +${s * 6}% · уклон ${Math.min(40, s).toFixed(0)}% · быстрее взмах и бег` },
  { k: 'vit', n: 'СТОЙКОСТЬ', eff: s => `+${s * 22} HP · реген ${(s * .35).toFixed(2)}/с` },
  { k: 'pre', n: 'ТОЧНОСТЬ', eff: s => `крит ${Math.min(70, 5 + s * 1.5).toFixed(1)}% · ×${(1.5 + s * .05).toFixed(2)}` },
  { k: 'eng', n: 'ИНЖЕНЕРИЯ', eff: s => `постройки: урон +${s * 14}% · темп +${s * 5}% · поддержка +${s * 8}%` },
  { k: 'lck', n: 'УДАЧА', eff: s => `золото +${s * 6}% · опыт +${s * 5}%` },
];

export const WEAPONS = {
  fists:  { name: 'КУЛАКИ', flavor: 'то, с чего все начинают', cost: 0, dmg: 1, rate: 1.15, range: 62, kb: 6, kind: 'jab', crit: 0, pierce: 0, steal: 0, unlock: 0 },
  knife:  { name: 'НОЖ', flavor: 'быстрый. тихий. свой.', cost: 150, dmg: 1.2, rate: 1.7, range: 74, kb: 8, kind: 'jab', crit: .06, pierce: 0, steal: 0, unlock: 0 },
  bat:    { name: 'БИТА', flavor: 'убеждает с одного раза', cost: 600, dmg: 1.8, rate: .95, range: 96, kb: 46, kind: 'swing', crit: 0, pierce: 2, steal: 0, unlock: 4 },
  katana: { name: 'КАТАНА', flavor: 'режет строй, а не бойца', cost: 1600, dmg: 2.3, rate: 1.25, range: 122, kb: 14, kind: 'swing', crit: .1, pierce: 5, steal: 0, unlock: 8 },
  hammer: { name: 'МОЛОТ', flavor: 'аргумент против брони', cost: 3800, dmg: 3.8, rate: .55, range: 104, kb: 96, kind: 'slam', crit: 0, pierce: 99, steal: 0, shock: 82, unlock: 12 },
  scythe: { name: 'КОСА', flavor: 'круг замкнулся', cost: 9000, dmg: 3, rate: .8, range: 150, kb: 30, kind: 'spin', crit: .04, pierce: 99, steal: .05, unlock: 18 },
};
export const WEAPON_ORDER = ['fists', 'knife', 'bat', 'katana', 'hammer', 'scythe'];
export const W_MAX = 5;
export const wUpCost = (id, lvl) => Math.round(Math.max(80, WEAPONS[id].cost * .5) * Math.pow(1.9, lvl));

export const SLOTS = 4;
export const BUILDINGS = {
  mg:     { name: 'ПУЛЕМЁТ', cost: 90, dmg: 6, rate: 3, range: 260, kind: 'attack', tag: 'АТАКА', desc: 'трассеры по одной цели · ствол крутится к врагу', unlock: 0 },
  rail:   { name: 'РЕЛЬСА', cost: 260, dmg: 30, rate: .55, range: 340, kind: 'attack', tag: 'АТАКА', desc: 'заряжается и прошивает всех на линии', unlock: 11 },
  mortar: { name: 'МОРТИРА', cost: 180, dmg: 22, rate: .8, range: 300, kind: 'attack', tag: 'АТАКА', desc: 'навесной снаряд · взрыв и воронка', unlock: 5 },
  tesla:  { name: 'КАТУШКА', cost: 320, dmg: 15, rate: 1.1, range: 230, kind: 'attack', tag: 'АТАКА', desc: 'молния перескакивает на 3+ целей', unlock: 13 },
  spikes: { name: 'ШИПЫ', cost: 60, dmg: 9, rate: 2, range: 74, kind: 'trap', tag: 'ЛОВУШКА', desc: 'режет каждого, кто проходит по земле', unlock: 0 },
  wall:   { name: 'СТЕНА', cost: 110, hp: 150, kind: 'wall', tag: 'ОБОРОНА', desc: 'враги ломают её вместо героя · есть прочность', unlock: 3 },
  gen:    { name: 'ГЕНЕРАТОР', cost: 220, kind: 'econ', tag: 'ЭКОНОМИКА', desc: '+золото каждые 5с · окупается за забег', unlock: 7 },
  fix:    { name: 'РЕМСТАНЦИЯ', cost: 180, kind: 'support', tag: 'ПОДДЕРЖКА', desc: 'лечит героя импульсом каждые 4с', unlock: 9 },
  totem:  { name: 'ТОТЕМ', cost: 300, kind: 'aura', tag: 'АУРА', desc: '+урон и темп герою, пока он в радиусе', unlock: 16 },
};
export const B_ORDER = ['mg', 'rail', 'mortar', 'tesla', 'spikes', 'wall', 'gen', 'fix', 'totem'];
export const bUpCost = (type, lvl) => Math.round(BUILDINGS[type].cost * .7 * Math.pow(1.7, lvl));

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