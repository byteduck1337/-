import { BAL, ENEMIES, BUILDINGS, bUpCost, SLOTS, BOSS_ORDER, skipCost } from './config.js';
import { S, D, calc, gainGold, gainXp, saveNow, saveSoon, newRunId } from './state.js';
import { on, emit } from './events.js';
import { view } from './view.js';
import { clamp, rnd, TAU } from './utils.js';
import { play, weaponSound } from './audio.js';
import { keys, pointer } from './input.js';

export let G = null;

export function startRun(startWave = 1) {
  calc();
  startWave = Math.max(1, Math.floor(startWave));
  G = {
    t: 0, wave: startWave - 1, cleared: startWave - 1, startWave, skipped: 0,
    phase: 'inter', interT: startWave > 1 ? 4 : 6, waveT: 0,
    player: { x: view.cx || innerWidth / 2, face: 1, ph: 0, atkCd: 0, swing: -1, swingKind: D.kind, deadT: 0, seed: rnd(1000), moving: false },
    hp: D.maxHp, maxHp: D.maxHp,
    ab1: 0, ab1Max: D.whirlCd, ab2: 0, ab2Max: 22, rage: 0,
    buildings: Array(SLOTS).fill(null), enemies: [], spawnQ: [], shots: [], eShots: [], beams: [], zaps: [],
    parts: [], texts: [], pickups: [], rings: [], craters: [], slashes: [],
    kills: 0, goldEarned: 0, xpEarned: 0, lvlGained: 0, runId: newRunId(), submitted: false,
    shake: 0, paused: false, panelPause: false, over: false, deathDone: false, prevBest: S.best,
    boss: null, hoverSlot: -1,
  };
  emit('run:start', G);
  emit('banner', startWave > 1 ? 'ВОЗВРАТ К ЧЕРТЕ' : 'ГОТОВЬСЯ', `ВОЛНА ${startWave} ЧЕРЕЗ ${G.interT} СЕК · N — РАНЬШЕ`, startWave > 1 ? 'green' : '');
  emit('wave:inter', startWave);
  play(startWave > 1 ? 'warp' : 'horn');
  if (!S.seenHint) { S.seenHint = true; saveSoon(); setTimeout(() => emit('toast', '4 поста внизу. Строй башни, шипы, стену, генератор — золото уже есть.', 'gold'), 1200); }
  return G;
}
export function skipWaves(n) {
  if (!G || G.phase !== 'inter' || G.over) return false;
  const cost = skipCost(S.gold, n);
  if (S.gold < cost) return false;
  S.gold -= cost;
  G.wave += n; G.skipped += n;
  G.interT = Math.max(G.interT, 4);
  if (G.wave > S.best) S.best = G.wave;
  emit('gold', S.gold);
  emit('banner', `ПРОПУЩЕНО ${n} ВОЛН`, `−¤${cost} · следующая волна ${G.wave + 1} · наград за пропуск нет`, 'gold');
  emit('wave:inter', G.wave + 1);
  play('warp'); saveSoon();
  return true;
}
export function pause(on) { if (!G || G.phase === 'over' || G.phase === 'dying') return; G.paused = on; emit('pause', on); }
export function panelPause(on) { if (G) { G.panelPause = on; emit('panelPause', on); } }

export function slotX(i) { const spread = Math.min(300, view.W * .34); return view.cx + [-1, -.5, .5, 1][i] * spread; }
export function bDmg(b) { return (BUILDINGS[b.type].dmg || 0) * Math.pow(1.32, b.lvl - 1) * D.tDmg; }
export function bRate(b) { return Math.min(6, (BUILDINGS[b.type].rate || 1) * (1 + .06 * (b.lvl - 1)) * D.tRate); }
export function buildBuilding(i, type) {
  const def = BUILDINGS[type];
  if (!G || G.buildings[i] || !def || S.gold < def.cost) return false;
  S.gold -= def.cost;
  const b = { type, lvl: 1, cd: rnd(.2, .6), spent: def.cost, trace: new Array(32).fill(0), ti: 0, flash: 0, aim: 0, recoil: 0, timer: 0 };
  if (type === 'wall') { b.maxHp = def.hp * (1 + .08 * S.stats.eng); b.hp = b.maxHp; }
  G.buildings[i] = b;
  play('build'); emit('gold', S.gold); emit('buildings'); saveSoon();
  burst(slotX(i), view.ground - 40, 10, '#46f28e', 140, 200);
  return true;
}
export function upgradeBuilding(i) {
  const b = G?.buildings[i]; if (!b) return false;
  const cost = bUpCost(b.type, b.lvl);
  if (S.gold < cost) return false;
  S.gold -= cost; b.lvl++; b.spent += cost; b.flash = .15;
  if (b.type === 'wall') { b.maxHp = BUILDINGS.wall.hp * Math.pow(1.55, b.lvl - 1) * (1 + .08 * S.stats.eng); b.hp = b.maxHp; }
  play('up'); emit('gold', S.gold); emit('buildings'); saveSoon();
  burst(slotX(i), view.ground - 40, 8, '#f5b942', 120, 200);
  return true;
}
export function sellBuilding(i) {
  const b = G?.buildings[i]; if (!b) return false;
  G.buildings[i] = null; gainGold(Math.floor(b.spent * .5));
  play('build'); emit('buildings');
  burst(slotX(i), view.ground - 40, 8, '#f2f2ee', 120);
  return true;
}

function beginWave(n) {
  G.wave = n; G.waveT = 0; G.phase = 'wave'; G.boss = null;
  const bossWave = n % 5 === 0;
  let count = BAL.count(n); if (bossWave) count = Math.ceil(count * .6);
  const pool = Object.keys(ENEMIES).filter(k => !ENEMIES[k].boss && ENEMIES[k].from <= n);
  const q = []; let d = .5;
  for (let i = 0; i < count; i++) {
    let type = 'walk';
    if (pool.length > 1 && Math.random() < .66) { const alt = pool.filter(k => k !== 'walk'); type = alt[Math.floor(rnd(alt.length))]; }
    d += BAL.interval(n) * rnd(.7, 1.3);
    q.push({ type, side: Math.random() < .5 ? -1 : 1, at: d });
  }
  if (bossWave) {
    const id = BOSS_ORDER[Math.floor(n / 5 - 1) % BOSS_ORDER.length];
    q.splice(Math.floor(q.length / 2), 0, { type: id, side: Math.random() < .5 ? -1 : 1, at: d + BAL.interval(n) });
  }
  G.spawnQ = q;
  emit('banner', 'ВОЛНА ' + n, bossWave ? '⚠ ' + ENEMIES[BOSS_ORDER[Math.floor(n / 5 - 1) % BOSS_ORDER.length]].name + ' ИДЁТ ⚠' : q.length + ' ВРАГОВ', bossWave ? 'red' : '');
  play('horn');
}
function makeEnemy(type, x, hpMul = 1) {
  const t = ENEMIES[type], w = G.wave;
  const e = {
    type, x, gyOff: t.fly ? -70 : rnd(-12, 8),
    s: t.s * rnd(.92, 1.08), hp: BAL.eHp(w) * t.hp * hpMul, spd: BAL.eSpd(w) * t.spd * rnd(.88, 1.14),
    dmg: BAL.eDmg(w) * t.dmg, ph: rnd(6), seed: rnd(1000), stop: t.boss ? 70 : (t.reach || 30 + rnd(26)),
    atkCd: rnd(.4, 1), wind: 0, flash: 0, stun: 0, face: x < G.player.x ? 1 : -1, dead: false, lastStep: 0,
    freq: rnd(.82, 1.22), asym: rnd(-.2, .2), armAmp: rnd(.6, 1.35), tilt: rnd(-.12, .12),
    fuse: 0, sumCd: rnd(2, 5), chargeCd: rnd(3, 6), charge: 0, high: !!t.fly,
  };
  e.maxHp = e.hp; G.enemies.push(e);
  if (t.boss) { G.boss = e; emit('boss', e); }
  return e;
}
function spawnEnemy(spec) { makeEnemy(spec.type, spec.side < 0 ? -40 : view.W + 40); }
function onClear() {
  G.cleared = G.wave;
  const bossWave = G.wave % 5 === 0;
  const g = Math.round(BAL.waveGold(G.wave) * (bossWave ? 2 : 1) * D.goldM);
  const x = Math.round(BAL.waveXp(G.wave) * D.xpM);
  G.goldEarned += g; G.xpEarned += x;
  gainGold(g); gainXp(x);
  const heal = Math.min(G.maxHp * .5, G.maxHp * (.2 + .02 * S.stats.vit));
  G.hp = Math.min(G.maxHp, G.hp + heal);
  G.buildings.forEach(b => { if (b?.type === 'wall') b.hp = Math.min(b.maxHp, b.hp + b.maxHp * .35); });
  emit('banner', 'ВОЛНА ' + G.wave + ' ЗАЧИЩЕНА', `+¤${g} · +${x} XP · стены починены`, 'green');
  play('clear');
  G.phase = 'inter'; G.interT = G.wave < 3 ? 6 : 9;
  emit('wave:inter', G.wave + 1); emit('boss', null);
}

function addText(x, y, str, col = '#f2f2ee', size = 11) {
  if (G.texts.length > 60) G.texts.shift();
  G.texts.push({ x, y, str, col, size, t: 0, life: .9 });
}
function burst(x, y, n, col, spd = 160, grav = 380, life = .6) {
  const cap = { high: 520, med: 260, low: 120 }[S.quality] || 520;
  for (let i = 0; i < n; i++) {
    if (G.parts.length >= cap) return;
    const a = rnd(TAU), v = rnd(.3, 1) * spd;
    G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * .4, g: grav, t: 0, life: life * rnd(.6, 1.2), col, sz: rnd(1, 2.6), line: Math.random() < .4, rot: rnd(TAU), vr: rnd(-6, 6) });
  }
}
function shake(v) { if (S.shake) G.shake = Math.max(G.shake, v); }
function meleeDamage(e, dmg, opts = {}) {
  const t = ENEMIES[e.type];
  if (t.ghost && !opts.force && Math.random() < .3) { addText(e.x, view.ground + e.gyOff - e.s * 3, 'МИМО', '#8a8a86', 10); play('miss'); return 0; }
  const front = Math.sign(G.player.x - e.x) === e.face;
  if (t.shield && front && !opts.force) dmg *= .45;
  const armor = BAL.armor(G.wave) * (t.armor || 0);
  dmg = Math.max(1, dmg - Math.max(0, armor - D.pierce));
  return applyDamage(e, dmg, opts);
}
function applyDamage(e, dmg, opts = {}) {
  if (e.dead) return 0;
  let crit = false;
  if (opts.canCrit && Math.random() < D.crit) { dmg *= D.critM; crit = true; }
  dmg = Math.max(1, Math.round(dmg));
  const over = dmg / e.maxHp;
  e.hp -= dmg; e.flash = .09;
  const size = 10 + Math.min(11, Math.log2(dmg + 1) * 1.7);
  addText(e.x + rnd(-6, 6), view.ground + e.gyOff - e.s * 3.1, String(dmg) + (crit ? '!' : ''), crit ? '#f5b942' : '#f2f2ee', crit ? size + 3 : size);
  if (crit) play('crit');
  if (D.steal && opts.melee) G.hp = Math.min(G.maxHp, G.hp + dmg * D.steal);
  if (e.hp <= 0) kill(e, over);
  return dmg;
}
function kill(e, over = 0) {
  e.dead = true; G.kills++; S.kills++;
  const t = ENEMIES[e.type], w = G.wave, gy = view.ground + e.gyOff;
  burst(e.x, gy - e.s * 1.4, Math.round((t.boss ? 26 : 8) * (1 + Math.min(1.5, over))), t.boss ? '#ff4b4b' : '#f2f2ee', t.boss ? 260 : 170);
  const goldVal = Math.round(BAL.killGold(w) * t.gold * D.goldM * rnd(.9, 1.2));
  const xpVal = Math.round(BAL.killXp(w) * t.xp * D.xpM);
  const coins = t.boss ? 5 : goldVal > 6 ? 2 : 1;
  for (let i = 0; i < coins; i++) G.pickups.push({ kind: 'gold', x: e.x, y: gy - e.s, vx: rnd(-90, 90), vy: rnd(-220, -120), val: Math.ceil(goldVal / coins), t: 0, ph: 0 });
  const motes = t.boss ? 3 : 1;
  for (let i = 0; i < motes; i++) G.pickups.push({ kind: 'xp', x: e.x, y: gy - e.s * 1.6, vx: rnd(-70, 70), vy: rnd(-190, -100), val: Math.ceil(xpVal / motes), t: 0, ph: 0 });
  if (t.boss) { play('boom'); shake(9); G.boss = null; emit('boss', null); emit('banner', t.name + ' ПОВЕРЖЕН', `+¤${goldVal} · +${xpVal} XP`, 'green'); G.craters.push({ x: e.x, t: 0, r: 34 }); }
  else play('kill');
  saveSoon();
}
function hurtPlayer(dmg) {
  if (G.phase !== 'wave') return;
  if (Math.random() < D.dodge) { addText(G.player.x, view.ground - 140, 'УКЛОН', '#46f28e', 11); play('dodge'); return; }
  dmg = Math.max(1, Math.round(dmg));
  G.hp -= dmg; shake(3); play('hurt');
  addText(G.player.x + rnd(-14, 14), view.ground - 150, '-' + dmg, '#ff4b4b', 13);
  burst(G.player.x, view.ground - 80, 4, '#ff4b4b', 120);
  if (G.hp <= 0) { G.hp = 0; G.phase = 'dying'; G.player.deadT = 0; play('death'); shake(10); burst(G.player.x, view.ground - 70, 18, '#f2f2ee', 240); }
}
export function endRun(reason) {
  if (!G || G.over) return;
  G.over = true; G.phase = 'over';
  S.runs++;
  const record = G.wave > S.prevBest;
  if (G.wave > S.best) S.best = G.wave;
  saveNow();
  emit('run:end', { reason, wave: G.wave, cleared: G.cleared, startWave: G.startWave, skipped: G.skipped, kills: G.kills, time: Math.floor(G.t), gold: G.goldEarned, xp: G.xpEarned, lvl: G.lvlGained, level: S.level, record, runId: G.runId });
}
export function whirl() {
  if (!G || G.ab1 > 0 || (G.phase !== 'wave' && G.phase !== 'inter')) return;
  G.ab1 = G.ab1Max = D.whirlCd;
  const px = G.player.x;
  G.rings.push({ x: px, y: view.ground - 40, t: 0, life: .24, r1: 118 });
  G.slashes.push({ x: px, y: view.ground - 60, t: 0, kind: 'spin', face: 1, tier: D.wLvl, range: 118, whirl: true });
  G.enemies.forEach(e => {
    if (Math.abs(e.x - px) < 118) {
      const dir = Math.sign(e.x - px) || 1;
      meleeDamage(e, D.dmg * 2.6 * (G.rage > 0 ? 1.4 : 1), { canCrit: true, melee: true, force: true });
      if (!e.dead) { e.x += dir * (ENEMIES[e.type].boss ? 18 : 74); e.stun = Math.max(e.stun, .4); }
    }
  });
  G.eShots = G.eShots.filter(s => Math.abs(s.x - px) > 118);
  shake(5); play('whirl');
}
export function rage() {
  if (!G || S.level < 4 || G.ab2 > 0 || (G.phase !== 'wave' && G.phase !== 'inter')) return;
  G.ab2 = G.ab2Max = 22; G.rage = 6;
  play('rage'); emit('banner', 'ЯРОСТЬ', '+60% ТЕМП · +40% УРОН · 6 СЕК', 'green');
  burst(G.player.x, view.ground - 80, 14, '#46f28e', 200, 100);
}
function auraMult() {
  let dmg = 1, rate = 1;
  for (let i = 0; i < SLOTS; i++) {
    const b = G.buildings[i];
    if (b?.type === 'totem' && Math.abs(G.player.x - slotX(i)) < 170) { dmg *= 1.12 + .05 * b.lvl; rate *= 1.1 + .04 * b.lvl; }
  }
  return { dmg, rate };
}

export function step(dt) {
  if (!G) return;
  G.t += dt;
  if (G.phase === 'dying') { G.player.deadT += dt; updFx(dt); if (G.player.deadT > 1.6 && !G.deathDone) { G.deathDone = true; endRun('death'); } return; }
  if (G.phase === 'over') { updFx(dt); return; }
  G.shake = Math.max(0, G.shake - dt * 22);
  G.ab1 = Math.max(0, G.ab1 - dt); G.ab2 = Math.max(0, G.ab2 - dt); G.rage = Math.max(0, G.rage - dt);
  G.hp = Math.min(G.maxHp, G.hp + D.regen * dt);
  if (G.phase === 'inter') { G.interT -= dt; if (G.interT <= 0) beginWave(G.wave + 1); }
  else if (G.phase === 'wave') { G.waveT += dt; while (G.spawnQ.length && G.spawnQ[0].at <= G.waveT && G.enemies.length < 42) spawnEnemy(G.spawnQ.shift()); }
  updPlayer(dt); updBuildings(dt); updEnemies(dt); updShots(dt); updFx(dt);
  if (G.phase === 'wave' && !G.spawnQ.length && !G.enemies.length) onClear();
}
function updPlayer(dt) {
  const p = G.player, aura = auraMult();
  let mv = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mv -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mv += 1;
  const zone = Math.min(120, view.W * .13);
  if (pointer.dragX !== null) {
    const target = clamp(pointer.dragX, view.cx - zone, view.cx + zone), d = target - p.x;
    if (Math.abs(d) > 4) { mv = Math.sign(d); p.x += clamp(d, -D.move * dt, D.move * dt); }
  } else if (mv) { p.x += mv * D.move * dt; p.face = mv; }
  p.moving = !!mv;
  p.x = clamp(p.x, view.cx - zone, view.cx + zone);
  p.ph += Math.abs(mv) * dt * 9;
  if (p.swing >= 0) { p.swing += dt / D.swingDur; if (p.swing > 1) p.swing = -1; }
  p.atkCd -= dt * (G.rage > 0 ? 1.6 : 1) * aura.rate;
  if (p.atkCd <= 0) {
    let best = null, bd = 1e9;
    for (const e of G.enemies) {
      if (e.high) continue;
      const d = Math.abs(e.x - p.x);
      if (d < D.range + e.s * .4 && d < bd) { bd = d; best = e; }
    }
    if (best) {
      p.atkCd = 1 / (D.rate * aura.rate); p.swing = 0; p.swingKind = D.kind; p.face = Math.sign(best.x - p.x) || p.face;
      G.slashes.push({ x: p.x, y: view.ground - 60, t: 0, kind: D.kind, face: p.face, tier: D.wLvl, range: D.range, str: S.stats.str });
      play(weaponSound(D.kind));
      const dmg = D.dmg * aura.dmg * (G.rage > 0 ? 1.4 : 1);
      const hit = e => meleeDamage(e, dmg, { canCrit: true, melee: true });
      if (D.kind === 'spin') { for (const e of G.enemies) if (Math.abs(e.x - p.x) < D.range) { hit(e); kb(e, D.kb); } }
      else if (D.kind === 'slam') {
        const ix = p.x + p.face * D.range * .6;
        for (const e of G.enemies) if (!e.high && Math.abs(e.x - p.x) < D.range && (Math.sign(e.x - p.x) === p.face || Math.abs(e.x - p.x) < 40)) { hit(e); kb(e, D.kb); }
        G.rings.push({ x: ix, y: view.ground - 6, t: 0, life: .3, r1: D.shock });
        G.craters.push({ x: ix, t: 0, r: 14 });
        for (const e of G.enemies) if (Math.abs(e.x - ix) < D.shock && !e.dead) applyDamage(e, dmg * .5, { force: true });
        shake(6);
      } else {
        let hits = 0; const maxHits = D.kind === 'jab' ? 1 : 3;
        for (const e of G.enemies) {
          if (e.high) continue;
          const dx = e.x - p.x;
          if (Math.abs(dx) < D.range + e.s * .4 && (Math.sign(dx) === p.face || Math.abs(dx) < 40) && hits < maxHits) {
            hit(e); kb(e, D.kb); hits++;
            burst(e.x, view.ground + e.gyOff - e.s * 1.5, 3, '#f2f2ee', 110);
          }
        }
        if (hits) play('hit');
      }
    }
  }
}
function kb(e, force) {
  if (e.dead || !force) return;
  const dir = Math.sign(e.x - G.player.x) || 1;
  e.x += dir * force * (ENEMIES[e.type].boss ? .2 : 1);
  if (force > 30) e.stun = Math.max(e.stun, .22);
}
function updBuildings(dt) {
  for (let i = 0; i < SLOTS; i++) {
    const b = G.buildings[i]; if (!b) continue;
    b.flash = Math.max(0, b.flash - dt); b.recoil = Math.max(0, b.recoil - dt * 4);
    for (let k = 0; k < b.trace.length; k++) b.trace[k] *= Math.pow(.05, dt);
    const tx = slotX(i), def = BUILDINGS[b.type];
    if (b.type === 'wall') continue;
    if (b.type === 'gen') {
      b.timer += dt;
      if (b.timer >= 5) {
        b.timer = 0; b.flash = .2;
        const val = Math.round((4 + b.lvl * 2 + Math.floor(G.wave * .4)) * D.supportM * D.goldM);
        G.pickups.push({ kind: 'gold', x: tx, y: view.ground - 50, vx: rnd(-40, 40), vy: -160, val, t: 0, ph: 0 });
        play('coin');
      }
      continue;
    }
    if (b.type === 'fix') {
      b.timer += dt;
      if (b.timer >= 4 && G.hp < G.maxHp) {
        b.timer = 0; b.flash = .25;
        const heal = Math.round((8 + b.lvl * 4) * D.supportM);
        G.hp = Math.min(G.maxHp, G.hp + heal);
        G.rings.push({ x: G.player.x, y: view.ground - 60, t: 0, life: .4, r1: 60, green: true });
        addText(G.player.x, view.ground - 150, '+' + heal, '#46f28e', 13);
        play('heal');
      }
      continue;
    }
    if (b.type === 'totem') { b.timer += dt; continue; }
    b.cd -= dt;
    if (b.type === 'spikes') {
      if (b.cd <= 0) {
        const hitAny = G.enemies.some(e => !e.high && Math.abs(e.x - tx) < def.range);
        if (hitAny) {
          b.cd = 1 / bRate(b); b.flash = .1;
          for (const e of G.enemies) if (!e.high && Math.abs(e.x - tx) < def.range) applyDamage(e, bDmg(b), {});
          play('hit');
        }
      }
      continue;
    }
    let target = null, bd = 1e9;
    for (const e of G.enemies) { if (Math.abs(e.x - tx) > def.range) continue; const th = Math.abs(e.x - G.player.x); if (th < bd) { bd = th; target = e; } }
    if (target) { const want = Math.atan2((view.ground + target.gyOff - target.s * 1.5) - (view.ground - 70), target.x - tx); b.aim += (want - b.aim) * Math.min(1, dt * 10); }
    if (b.cd > 0 || G.phase !== 'wave' || !target) continue;
    b.cd = 1 / bRate(b); b.flash = .08; b.recoil = 1;
    b.trace[b.ti % b.trace.length] = 1; b.ti++;
    const dmg = bDmg(b);
    if (b.type === 'mg') { G.shots.push({ kind: 'mg', x: tx, y: view.ground - 70, tgt: target, lx: target.x, ly: view.ground + target.gyOff - target.s * 1.5, dmg, spd: 660 }); play('mg'); }
    else if (b.type === 'rail') {
      const dir = Math.sign(target.x - tx) || 1, x1 = target.x + dir * 50, lo = Math.min(tx, x1), hi = Math.max(tx, x1);
      G.beams.push({ x0: tx, x1, y: view.ground - 34, t: 0, life: .14 });
      for (const e of G.enemies) if (e.x >= lo - 10 && e.x <= hi + 10) applyDamage(e, dmg, {});
      shake(2); play('rail');
    } else if (b.type === 'mortar') {
      const dir = Math.sign(G.player.x - target.x) || 1;
      const lead = clamp(target.x + dir * target.spd * .7, 20, view.W - 20);
      G.shots.push({ kind: 'mt', x0: tx, y0: view.ground - 70, tx: lead, t: 0, T: .75, dmg, r: 80 });
      play('mortar');
    } else if (b.type === 'tesla') {
      const chains = 2 + Math.floor(b.lvl / 2);
      const pts = [{ x: tx, y: view.ground - 78 }];
      let cur = target, d = dmg;
      const hitSet = new Set();
      for (let c = 0; c < chains && cur; c++) {
        hitSet.add(cur);
        pts.push({ x: cur.x, y: view.ground + cur.gyOff - cur.s * 1.6 });
        applyDamage(cur, d, {});
        d *= .8;
        let nxt = null, nd = 1e9;
        for (const e of G.enemies) { if (hitSet.has(e) || e.dead) continue; const dd = Math.abs(e.x - cur.x); if (dd < 130 && dd < nd) { nd = dd; nxt = e; } }
        cur = nxt;
      }
      G.zaps.push({ pts, t: 0, life: .16 });
      play('zap'); shake(1.5);
    }
  }
}
function blockingWall(e) {
  for (let i = 0; i < SLOTS; i++) {
    const b = G.buildings[i]; if (!b || b.type !== 'wall') continue;
    const x = slotX(i);
    if (((e.x < x && x < G.player.x) || (e.x > x && x > G.player.x)) && Math.abs(e.x - x) < 240) return { b, x, i };
  }
  return null;
}
function updEnemies(dt) {
  const px = G.player.x;
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.flash = Math.max(0, e.flash - dt);
    if (e.stun > 0) { e.stun -= dt; continue; }
    const t = ENEMIES[e.type];
    if (t.fly) { e.high = Math.abs(px - e.x) > 150; e.gyOff += ((e.high ? -70 : -6) - e.gyOff) * Math.min(1, dt * 3); }
    const rageMul = t.rage ? 1 + (1 - e.hp / e.maxHp) * 1.1 : 1;
    const wall = blockingWall(e);
    const tx = wall ? wall.x : px;
    const dx = tx - e.x, dist = Math.abs(dx), dir = Math.sign(dx) || 1;
    e.face = Math.sign(px - e.x) || e.face;
    if (t.bomb && !wall && dist < e.stop + 14) {
      e.fuse += dt;
      if (e.fuse > .5) {
        e.dead = true; play('boom'); shake(7);
        G.rings.push({ x: e.x, y: view.ground - 20, t: 0, life: .35, r1: 90, red: true });
        burst(e.x, view.ground - 30, 16, '#ff4b4b', 240);
        hurtPlayer(e.dmg * 1.6);
        continue;
      }
    }
    if (t.summon && dist < 340 && !wall) {
      e.sumCd -= dt;
      if (e.sumCd <= 0 && G.enemies.length < 40) {
        e.sumCd = t.boss ? 6 : 7;
        makeEnemy(t.boss ? 'ghost' : 'walk', e.x + rnd(-24, 24), t.boss ? .8 : .6);
        G.rings.push({ x: e.x, y: view.ground - 30, t: 0, life: .4, r1: 50, green: true });
        play('summon');
      }
    }
    if (t.brood && !wall) {
      e.sumCd -= dt;
      if (e.sumCd <= 0 && G.enemies.length < 40) { e.sumCd = 5; makeEnemy('run', e.x - 20, .5); makeEnemy('run', e.x + 20, .5); play('summon'); }
    }
    if (t.charge && !wall) {
      e.chargeCd -= dt;
      if (e.chargeCd <= 0 && dist > 120) { e.charge = 1.1; e.chargeCd = 7; play('rage'); }
      if (e.charge > 0) e.charge -= dt;
    }
    if (t.ranged && !wall && dist < 260 && dist > e.stop) {
      e.wind += dt;
      if (e.wind > 2.4) {
        e.wind = 0;
        const T = .9, gx = 520, sx = e.x, sy = view.ground + e.gyOff - e.s * 2.2;
        G.eShots.push({ x: sx, y: sy, vx: (px - sx) / T, vy: (view.ground - 60 - sy - .5 * gx * T * T) / T, dmg: e.dmg });
        play('spit');
      }
      continue;
    }
    const stop = wall ? 46 : e.stop;
    if (dist > stop) {
      const spd = e.spd * rageMul * (e.charge > 0 ? 4 : 1);
      e.x += dir * spd * dt; e.ph += spd * dt * .09;
      if (t.boss || t.gait === 'stomp') {
        const sn = Math.floor(e.ph / Math.PI);
        if (sn !== e.lastStep) {
          e.lastStep = sn; shake(t.titan ? 3 : t.boss ? 1.6 : .5);
          if (t.boss) play('step');
          if (t.titan) { G.rings.push({ x: e.x, y: view.ground - 4, t: 0, life: .4, r1: 130, red: true }); if (Math.abs(px - e.x) < 130) hurtPlayer(e.dmg * .45); }
        }
      }
    } else {
      e.atkCd -= dt;
      if (e.atkCd <= 0) {
        e.atkCd = t.boss ? 1.4 : 1;
        if (wall) {
          wall.b.hp -= e.dmg * rageMul; wall.b.flash = .12;
          burst(wall.x, view.ground - 40, 3, '#f2f2ee', 90);
          if (wall.b.hp <= 0) { G.buildings[wall.i] = null; burst(wall.x, view.ground - 40, 14, '#f2f2ee', 180); emit('buildings'); emit('toast', 'Стена пала!', 'red'); play('boom'); }
        } else {
          hurtPlayer(e.dmg * rageMul * (e.charge > 0 ? 1.5 : 1));
          if (t.boss) { G.rings.push({ x: px, y: view.ground - 30, t: 0, life: .3, r1: 70, red: true }); shake(6); }
          burst(px, view.ground - 70, 3, '#f2f2ee', 100);
        }
      }
    }
  }
  G.enemies = G.enemies.filter(e => !e.dead);
}
function updShots(dt) {
  for (const s of G.shots) {
    if (s.kind === 'mg') {
      if (s.tgt && !s.tgt.dead) { s.lx = s.tgt.x; s.ly = view.ground + s.tgt.gyOff - s.tgt.s * 1.5; }
      const dx = s.lx - s.x, dy = s.ly - s.y, d = Math.hypot(dx, dy);
      if (d < 14) { s.done = true; if (s.tgt && !s.tgt.dead) applyDamage(s.tgt, s.dmg, {}); burst(s.lx, s.ly, 2, '#f2f2ee', 80); }
      else { const v = s.spd * dt / d; s.x += dx * v; s.y += dy * v; s.vx = dx / d; s.vy = dy / d; }
    } else {
      s.t += dt;
      if (s.t >= s.T) {
        s.done = true;
        G.craters.push({ x: s.tx, t: 0, r: 16 });
        G.rings.push({ x: s.tx, y: view.ground - 8, t: 0, life: .3, r1: s.r });
        burst(s.tx, view.ground - 10, 12, '#f2f2ee', 200);
        shake(4); play('boom');
        for (const e of G.enemies) { const d = Math.abs(e.x - s.tx); if (d < s.r) applyDamage(e, s.dmg * (1 - .5 * d / s.r), {}); }
      }
    }
  }
  G.shots = G.shots.filter(s => !s.done);
  for (const s of G.eShots) {
    s.vy += 520 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
    if (Math.abs(s.x - G.player.x) < 20 && s.y > view.ground - 130 && s.y < view.ground + 6) { s.done = true; hurtPlayer(s.dmg); }
    else if (s.y > view.ground + 4) { s.done = true; burst(s.x, view.ground, 3, '#ff4b4b', 70); }
  }
  G.eShots = G.eShots.filter(s => !s.done);
  for (const b of G.beams) b.t += dt;
  G.beams = G.beams.filter(b => b.t < b.life);
  for (const z of G.zaps) z.t += dt;
  G.zaps = G.zaps.filter(z => z.t < z.life);
}
function updFx(dt) {
  for (const p of G.parts) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
  G.parts = G.parts.filter(p => p.t < p.life);
  for (const t of G.texts) { t.t += dt; t.y -= 36 * dt; }
  G.texts = G.texts.filter(t => t.t < t.life);
  for (const r of G.rings) r.t += dt;
  G.rings = G.rings.filter(r => r.t < r.life);
  for (const s of G.slashes) s.t += dt;
  G.slashes = G.slashes.filter(s => s.t < (s.kind === 'spin' ? .34 : s.kind === 'slam' ? .3 : .2));
  for (const c of G.craters) c.t += dt;
  G.craters = G.craters.filter(c => c.t < 6);
  if (G.craters.length > 20) G.craters.shift();
  const goldT = { x: 110, y: view.H - 52 }, xpT = { x: view.W - 140, y: 34 };
  for (const p of G.pickups) {
    p.t += dt;
    if (p.ph === 0) { p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t > .32) p.ph = 1; }
    else {
      const tgt = p.kind === 'gold' ? goldT : xpT;
      const dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(1400, 340 + p.t * 900);
      if (d < 18) {
        p.done = true;
        if (p.kind === 'gold') { gainGold(p.val); G.goldEarned += p.val; play('coin'); }
        else { gainXp(p.val); G.xpEarned += p.val; play('xp'); }
      } else { p.x += dx / d * sp * dt; p.y += dy / d * sp * dt; }
    }
  }
  G.pickups = G.pickups.filter(p => !p.done);
}

on('level', lvl => {
  if (!G || view.screen !== 'battle') return;
  G.lvlGained++;
  const om = G.maxHp; calc(); G.maxHp = D.maxHp;
  G.hp = Math.min(G.maxHp, G.hp + (D.maxHp - om) + G.maxHp * .3);
  play('level');
  emit('banner', 'УРОВЕНЬ ' + lvl, '+3 ОЧКА · C — РАСПРЕДЕЛИТЬ', 'green');
  G.rings.push({ x: G.player.x, y: view.ground - 60, t: 0, life: .4, r1: 120, green: true });
});
on('stats', ({ hpDelta, k, n }) => {
  if (!G || view.screen !== 'battle') return;
  G.maxHp = D.maxHp; G.hp = Math.min(G.maxHp, G.hp + Math.max(0, hpDelta));
  if (k) {
    const label = { str: 'СИЛА', agi: 'ЛОВКОСТЬ', vit: 'СТОЙКОСТЬ', pre: 'ТОЧНОСТЬ', eng: 'ИНЖЕНЕРИЯ', lck: 'УДАЧА' }[k];
    addText(G.player.x, view.ground - 170, `${label} +${n}`, '#46f28e', 14);
    G.rings.push({ x: G.player.x, y: view.ground - 60, t: 0, life: .35, r1: 90, green: true });
    G.player.swing = 0; G.player.swingKind = D.kind;
  }
});
on('weapon', () => { if (G) G.player.swing = -1; });
on('key', k => {
  if (view.screen !== 'battle' || !G || G.paused || G.panelPause || G.over) return;
  if (k === 'whirl') whirl();
  else if (k === 'rage') rage();
  else if (k === 'next' && G.phase === 'inter') G.interT = 0;
});
on('tap', () => { if (view.screen === 'battle' && G && !G.paused && !G.panelPause && !G.over) whirl(); });
