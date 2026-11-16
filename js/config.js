export const DEFAULT_API = '';

export const BAL = {
  startGold: 160, ptsPerLevel: 3,
  xpNeed: l => Math.round(50 * Math.pow(l, 1.6)),
  statCap: l => 3 + Math.floor(l * .8),
  respecCost: l => 100 + 40 * l,
  eHp: w => 22 * Math.pow(1.17, w - 1),
  eDmg: w => 5 * Math.pow(1.11, w - 1),
  eSpd: w => Math.min(96, 44 + w * .9),
  count: w => Math.min(36, 6 + Math.floor(w * 1.5)),
  interval: w => Math.max(.38, 1.45 - w * .045),
  killGold: w => 1 + Math.floor(w * .65),
  killXp: w => Math.ceil(2.4 * Math.pow(1.12, w - 1)),
  waveGold: w => 6 + 2 * w,
  waveXp: w => 8 + 3 * w,
  armor: w => 2 + w * .35,
};

export const STATS = [
  { k: 'str', n: 'СИЛА', eff: s => `урон ×${(1 + .14 * s).toFixed(2)} · тяжелее след удара` },
  { k: 'agi', n: 'ЛОВКОСТЬ', eff: s => `темп +${s * 3}% · уклон ${Math.min(30, s * .5).toFixed(1)}%` },
  { k: 'vit', n: 'СТОЙКОСТЬ', eff: s => `+${s * 18} HP · реген ${(s * .25).toFixed(2)}/с` },
  { k: 'pre', n: 'ТОЧНОСТЬ', eff: s => `крит ${Math.min(65, 5 + s * 1.2).toFixed(1)}% · ×${(1.5 + s * .04).toFixed(2)}` },
  { k: 'eng', n: 'ИНЖЕНЕРИЯ', eff: s => `башни: урон +${s * 12}% · темп +${s * 4}%` },
  { k: 'lck', n: 'УДАЧА', eff: s => `золото +${s * 5}% · опыт +${s * 4}%` },
];

export const WEAPONS = {
  fists:  { name: 'КУЛАКИ', flavor: 'то, с чего все начинают', cost: 0, dmg: 1, rate: 1.15, range: 62, arc: .7, kb: 6, kind: 'jab', crit: 0, pierce: 0, steal: 0 },
  knife:  { name: 'НОЖ', flavor: 'быстрый. тихий. свой.', cost: 80, dmg: 1.2, rate: 1.7, range: 74, arc: .5, kb: 8, kind: 'jab', crit: .06, pierce: 0, steal: 0 },
  bat:    { name: 'БИТА', flavor: 'убеждает с одного раза', cost: 240, dmg: 1.8, rate: .95, range: 96, arc: 1.15, kb: 46, kind: 'swing', crit: 0, pierce: 2, steal: 0 },
  katana: { name: 'КАТАНА', flavor: 'режет строй, а не бойца', cost: 560, dmg: 2.3, rate: 1.25, range: 122, arc: 1, kb: 14, kind: 'swing', crit: .1, pierce: 5, steal: 0 },
  hammer: { name: 'МОЛОТ', flavor: 'аргумент против брони', cost: 1250, dmg: 3.8, rate: .55, range: 104, arc: .9, kb: 96, kind: 'slam', crit: 0, pierce: 99, steal: 0, shock: 82 },
  scythe: { name: 'КОСА', flavor: 'круг замкнулся', cost: 2600, dmg: 3, rate: .8, range: 150, arc: Math.PI, kb: 30, kind: 'spin', crit: .04, pierce: 99, steal: .05 },
};
export const WEAPON_ORDER = ['fists', 'knife', 'bat', 'katana', 'hammer', 'scythe'];
export const W_MAX = 5;
export const wUpCost = (id, lvl) => Math.round(Math.max(60, WEAPONS[id].cost * .45) * Math.pow(1.75, lvl));

export const TOWERS = {
  mg:     { name: 'ПУЛЕМЁТ', cost: 60, dmg: 6, rate: 3, range: 260, desc: 'трассеры по одной цели · ствол крутится к врагу' },
  rail:   { name: 'РЕЛЬСА', cost: 110, dmg: 30, rate: .55, range: 340, desc: 'заряжается и прошивает всех на линии' },
  mortar: { name: 'МОРТИРА', cost: 90, dmg: 22, rate: .8, range: 300, desc: 'навесной снаряд · взрыв и воронка' },
};
export const tUpCost = (type, lvl) => Math.round(TOWERS[type].cost * .65 * Math.pow(1.55, lvl));

export const ENEMIES = {
  walk:   { name: 'ШАГУН', hp: 1, dmg: 1, spd: 1, xp: 1, gold: 1, s: 30, from: 1, armor: 0, gait: 'walk' },
  run:    { name: 'БЕГУН', hp: .5, dmg: .7, spd: 1.9, xp: .9, gold: .9, s: 26, from: 2, armor: 0, gait: 'run' },
  brute:  { name: 'ГРОМИЛА', hp: 3.1, dmg: 1.9, spd: .55, xp: 2.4, gold: 2.4, s: 42, from: 4, armor: 1, gait: 'stomp' },
  spit:   { name: 'ПЛЕВАЛЬЩИК', hp: .85, dmg: 1.25, spd: .85, xp: 1.5, gold: 1.5, s: 30, from: 6, armor: 0, gait: 'shuffle', ranged: true },
  shield: { name: 'ЩИТНИК', hp: 1.7, dmg: 1.3, spd: .7, xp: 2, gold: 2, s: 33, from: 8, armor: .5, gait: 'march', shield: true },
  bomb:   { name: 'ПОДРЫВНИК', hp: .6, dmg: 2.6, spd: 1.55, xp: 1.6, gold: 1.7, s: 27, from: 9, armor: 0, gait: 'scurry', bomb: true },
  ghost:  { name: 'ПРИЗРАК', hp: 1.15, dmg: 1.1, spd: 1.25, xp: 2.2, gold: 2.2, s: 31, from: 11, armor: 0, gait: 'float', ghost: true },
  boss:   { name: 'КОЛОСС', hp: 30, dmg: 3.2, spd: .48, xp: 22, gold: 26, s: 88, from: 999, armor: 1, gait: 'stomp', boss: true },
};

export const QUAL = { high: { parts: 520, motes: 42 }, med: { parts: 260, motes: 24 }, low: { parts: 120, motes: 12 } };
