import { TAU, clamp, lerp, rnd, fmtT, fmtN, uuid, BAL, TYPES, TOWERS, WEAPONS, upCost } from './config.js';
import { S, saveNow, saveSoon } from './save.js';
import { SFX } from './audio.js';
import { $, toast, banner, openModal, closeModal, openStack } from './ui.js';
import { D, calc, refreshStats } from './stats.js';
import { pushLocal, fetchWorld, renderBoard } from './board.js';

export const G = { value: null };
export const getG = () => G.value;
export const setG = v => { G.value = v; window.G = v; };

const keys = new Set();
let W = 0, H = 0, ground = 0, cx = 0;
let popSlot = -1;
export const setDims = d => { W = d.W; H = d.H; ground = d.ground; cx = d.cx; };
export const getPopSlot = () => popSlot;
export const setPopSlot = v => { popSlot = v; };

export function startRun() {
  calc();
  const Gv = {
    t: 0, wave: 0, cleared: 0, phase: 'inter', interT: 6, waveT: 0,
    player: { x: cx, face: 1, ph: 0, atkCd: 0, swing: -1, deadT: 0, seed: rnd(1000) },
    hp: D.maxHp, maxHp: D.maxHp,
    ab1: 0, ab1Max: D.whirlCd, ab2: 0, ab2Max: 22, rage: 0,
    towers: [null, null], enemies: [], spawnQ: [], shots: [], eShots: [], beams: [], parts: [], texts: [],
    pickups: [], rings: [], craters: [], slashes: [],
    kills: 0, goldEarned: 0, xpEarned: 0, lvlGained: 0, runId: uuid(), submitted: false,
    shake: 0, paused: false, panelPause: false, over: false, deathDone: false, prevBest: S.best,
    dragX: null, hoverTower: -1, boss: null, popSlot: -1,
  };
  setG(Gv);
  $('pauseVeil').classList.add('hidden');
  $('btnPause').textContent = '⏸';
  $('goldVal').textContent = fmtN(S.gold);
  $('killVal').textContent = '0';
  $('lowhp').classList.remove('on');
  renderDock();
  refreshStats();
  banner('ГОТОВЬСЯ', 'ВОЛНА 1 ЧЕРЕЗ 6 СЕК · N — РАНЬШЕ');
  $('btnNext').classList.remove('hidden');
  $('btnNext').innerHTML = 'ВОЛНА 1 ▶&nbsp;<kbd>N</kbd>';
  SFX.horn();
  if (!S.seenHint) {
    S.seenHint = true;
    saveSoon();
    setTimeout(() => toast('Кликни по посту внизу — построй башню.', 'gold'), 1200);
  }
}

export function beginWave(n) {
  const Gv = getG();
  Gv.wave = n; Gv.waveT = 0; Gv.phase = 'wave'; Gv.boss = null;
  $('btnNext').classList.add('hidden');
  const bossWave = n % 5 === 0;
  let count = BAL.count(n);
  if (bossWave) count = Math.ceil(count * .55);
  const pool = Object.keys(TYPES).filter(k => k !== 'boss' && TYPES[k].from <= n);
  const q = [];
  let d = 0.5;
  for (let i = 0; i < count; i++) {
    let type = 'walk';
    if (pool.length > 1 && Math.random() < .55) {
      const alt = pool.filter(k => k !== 'walk');
      type = alt[Math.floor(rnd(alt.length))];
    }
    d += BAL.interval(n) * rnd(.7, 1.3);
    q.push({ type, side: Math.random() < .5 ? -1 : 1, at: d });
  }
  if (bossWave) q.splice(Math.floor(q.length / 2), 0, { type: 'boss', side: Math.random() < .5 ? -1 : 1, at: d + BAL.interval(n) });
  Gv.spawnQ = q;
  banner('ВОЛНА ' + n, bossWave ? '⚠ КОЛОСС ИДЁТ ⚠' : q.length + ' ВРАГОВ', bossWave ? 'red' : '');
  SFX.horn();
}

function spawnEnemy(spec) {
  const Gv = getG();
  const t = TYPES[spec.type], w = Gv.wave;
  const e = {
    type: spec.type, x: spec.side < 0 ? -40 : W + 40, gyOff: rnd(-12, 8),
    s: t.s * rnd(.94, 1.06), hp: BAL.eHp(w) * t.hp, spd: BAL.eSpd(w) * t.spd * rnd(.9, 1.1),
    dmg: BAL.eDmg(w) * t.dmg, ph: rnd(6), seed: rnd(1000), stop: spec.type === 'boss' ? 70 : 30 + rnd(26),
    atkCd: rnd(.4, 1), wind: 0, flash: 0, stun: 0, face: spec.side < 0 ? 1 : -1, dead: false, lastStep: 0,
    healCd: 2.5,
  };
  e.maxHp = e.hp;
  Gv.enemies.push(e);
  if (spec.type === 'boss') {
    Gv.boss = e;
    $('bossWrap').classList.remove('hidden');
    $('bossName').textContent = 'КОЛОСС · ВОЛНА ' + w;
  }
}

function onClear() {
  const Gv = getG();
  Gv.cleared = Gv.wave;
  const bossWave = Gv.wave % 5 === 0;
  const g = Math.round(BAL.waveGold(Gv.wave) * (bossWave ? 2 : 1) * D.goldM);
  const x = Math.round(BAL.waveXp(Gv.wave) * D.xpM);
  gainGold(g, true);
  gainXp(x);
  const heal = Math.min(Gv.maxHp * .5, Gv.maxHp * (.22 + .02 * S.stats.vit));
  Gv.hp = Math.min(Gv.maxHp, Gv.hp + heal);
  banner('ВОЛНА ' + Gv.wave + ' ЗАЧИЩЕНА', `+¤${g} · +${x} XP · +${Math.round(heal)} HP`, 'green');
  SFX.clear();
  Gv.phase = 'inter';
  Gv.interT = Gv.wave < 3 ? 6 : 9;
  $('btnNext').classList.remove('hidden');
  $('btnNext').innerHTML = `ВОЛНА ${Gv.wave + 1} ▶&nbsp;<kbd>N</kbd>`;
  $('bossWrap').classList.add('hidden');
}

function addText(x, y, str, col = '#fff', size = 12) {
  const Gv = getG();
  if (Gv.texts.length > 60) Gv.texts.shift();
  Gv.texts.push({ x, y, str, col, size, t: 0, life: .9 });
}

function addParts(x, y, n, col, spd = 160, grav = 380, life = .6) {
  const Gv = getG();
  const cap = { high: 520, med: 260, low: 120 }[S.quality];
  for (let i = 0; i < n; i++) {
    if (Gv.parts.length >= cap) return;
    const a = rnd(TAU), v = rnd(.3, 1) * spd;
    Gv.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * .4, g: grav, t: 0, life: life * rnd(.6, 1.2), col, sz: rnd(1, 2.6), line: Math.random() < .4 });
  }
}

function shake(v) { const Gv = getG(); if (S.shake) Gv.shake = Math.max(Gv.shake, v); }

function dealDamage(e, dmg, opts = {}) {
  if (e.dead) return;
  let crit = false;
  if (opts.canCrit && Math.random() < D.crit) { dmg *= D.critM; crit = true; }
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg;
  e.flash = .09;
  const Gv = getG();
  addText(e.x + rnd(-6, 6), ground + e.gyOff - e.s * 3.1, String(dmg) + (crit ? '!' : ''), crit ? '#ffc24b' : '#f4f4f2', crit ? 15 : 11);
  if (crit) SFX.crit();
  if (e.hp <= 0) kill(e);
}

function kill(e) {
  const Gv = getG();
  e.dead = true;
  Gv.kills++;
  S.kills++;
  $('killVal').textContent = fmtN(Gv.kills);
  const t = TYPES[e.type], w = Gv.wave;
  const gy = ground + e.gyOff;
  addParts(e.x, gy - e.s * 1.4, e.type === 'boss' ? 26 : 9, '#f4f4f2', e.type === 'boss' ? 260 : 170);
  const goldVal = Math.round(BAL.killGold(w) * t.gold * D.goldM * rnd(.9, 1.2));
  const xpVal = Math.round(BAL.killXp(w) * t.xp * D.xpM);
  const coins = e.type === 'boss' ? 5 : goldVal > 6 ? 2 : 1;
  for (let i = 0; i < coins; i++) Gv.pickups.push({ kind: 'gold', x: e.x, y: gy - e.s, vx: rnd(-90, 90), vy: rnd(-220, -120), val: Math.ceil(goldVal / coins), t: 0, ph: 0 });
  const motes = e.type === 'boss' ? 3 : 1;
  for (let i = 0; i < motes; i++) Gv.pickups.push({ kind: 'xp', x: e.x, y: gy - e.s * 1.6, vx: rnd(-70, 70), vy: rnd(-190, -100), val: Math.ceil(xpVal / motes), t: 0, ph: 0 });
  if (e.type === 'bomber') {
    Gv.rings.push({ x: e.x, y: ground, t: 0, life: .3, r1: 90, red: true });
    if (Math.abs(e.x - Gv.player.x) < 90) hurtPlayer(e.dmg * 2);
    addParts(e.x, ground - 20, 15, '#ff4d4d', 220);
    SFX.boom();
  } else if (e.type === 'boss') {
    SFX.boom();
    shake(9);
    Gv.boss = null;
    $('bossWrap').classList.add('hidden');
    banner('КОЛОСС ПОВЕРЖЕН', '+¤' + goldVal + ' · +' + xpVal + ' XP', 'green');
    Gv.craters.push({ x: e.x, t: 0, r: 34 });
  } else SFX.kill();
  saveSoon();
}

function hurtPlayer(dmg) {
  const Gv = getG();
  if (Gv.phase !== 'wave') return;
  if (Math.random() < D.dodge) {
    addText(Gv.player.x, ground - 140, 'УКЛОН', '#3ef08c', 12);
    SFX.dodge();
    return;
  }
  dmg = Math.max(1, Math.round(dmg));
  Gv.hp -= dmg;
  shake(3);
  SFX.hurt();
  addText(Gv.player.x + rnd(-14, 14), ground - 150, '-' + dmg, '#ff4d4d', 13);
  addParts(Gv.player.x, ground - 80, 4, '#ff4d4d', 120);
  if (Gv.hp <= 0) { Gv.hp = 0; startDying(); }
}

function startDying() {
  const Gv = getG();
  Gv.phase = 'dying';
  Gv.player.deadT = 0;
  SFX.death();
  shake(10);
  addParts(Gv.player.x, ground - 70, 18, '#f4f4f2', 240);
  $('lowhp').classList.remove('on');
}

export function endRun(reason) {
  const Gv = getG();
  if (!Gv || Gv.over) return;
  Gv.over = true;
  Gv.phase = 'over';
  S.runs++;
  const record = Gv.wave > Gv.prevBest;
  if (Gv.wave > S.best) S.best = Gv.wave;
  const entry = { nick: S.nick, wave: Gv.wave, kills: Gv.kills, level: S.level, time: Math.floor(Gv.t), date: Date.now() };
  pushLocal(entry);
  saveNow();
  $('sumTitle').textContent = reason === 'death' ? 'ЧЕРТА ПРОРВАНА' : 'ВЫЛАЗКА ЗАВЕРШЕНА';
  $('sumTitle').classList.toggle('red', reason === 'death');
  $('sumWave').textContent = Gv.wave;
  $('sumRecord').classList.toggle('hidden', !record);
  $('sumKills').textContent = fmtN(Gv.kills);
  $('sumTime').textContent = fmtT(Gv.t);
  $('sumGold').textContent = '+¤' + fmtN(Gv.goldEarned);
  $('sumXp').textContent = '+' + fmtN(Gv.xpEarned);
  $('sumLvl').textContent = '+' + Gv.lvlGained;
  $('sumLevel').textContent = S.level;
  $('sumNick').value = S.nick;
  const st = $('submitStatus');
  st.className = ''; st.textContent = '';
  const btn = $('btnSubmit');
  btn.disabled = false; btn.textContent = 'ОТПРАВИТЬ';
  if (!(S.api || '').trim()) {
    btn.disabled = true;
    btn.textContent = 'ЛОКАЛЬНО ✓';
    st.textContent = 'рекорд сохранён на устройстве · подключи воркер в настройках';
  }
  if (reason !== 'death') SFX.clear();
  openModal($('summary'));
  renderBoard();
}

export function userPause(on) {
  const Gv = getG();
  if (!Gv || Gv.phase === 'over' || Gv.phase === 'dying') return;
  Gv.paused = on;
  $('pauseVeil').classList.toggle('hidden', !on);
  $('btnPause').textContent = on ? '▶' : '⏸';
}

export function whirl() {
  const Gv = getG();
  if (!Gv || Gv.ab1 > 0 || (Gv.phase !== 'wave' && Gv.phase !== 'inter')) return;
  Gv.ab1 = Gv.ab1Max = D.whirlCd;
  const px = Gv.player.x;
  Gv.rings.push({ x: px, y: ground - 40, t: 0, life: .24, r1: 118 });
  Gv.slashes.push({ x: px, y: ground - 60, t: 0, full: true, face: 1 });
  Gv.enemies.forEach(e => {
    if (Math.abs(e.x - px) < 118) {
      const dir = Math.sign(e.x - px) || 1;
      dealDamage(e, D.dmg * 2.6 * (Gv.rage > 0 ? 1.4 : 1), { canCrit: true });
      if (!e.dead) { e.x += dir * (e.type === 'boss' ? 18 : 74); e.stun = Math.max(e.stun, .4); }
    }
  });
  Gv.eShots = Gv.eShots.filter(s => Math.abs(s.x - px) > 118);
  shake(5);
  SFX.whirl();
}

export function rage() {
  const Gv = getG();
  if (!Gv || S.level < 4 || Gv.ab2 > 0 || (Gv.phase !== 'wave' && Gv.phase !== 'inter')) return;
  Gv.ab2 = Gv.ab2Max = 22;
  Gv.rage = 6;
  SFX.rage();
  banner('ЯРОСТЬ', '+60% ТЕМП · +40% УРОН · 6 СЕК', 'green');
  addParts(Gv.player.x, ground - 80, 14, '#3ef08c', 200, 100);
}

export function gainXp(v) {
  const Gv = getG();
  v = Math.round(v);
  S.xp += v;
  if (Gv) Gv.xpEarned += v;
  let leveled = false;
  while (S.xp >= BAL.xpNeed(S.level) && S.level < 999) {
    S.xp -= BAL.xpNeed(S.level);
    S.level++;
    S.pts += BAL.ptsPerLevel;
    leveled = true;
    if (Gv) {
      Gv.lvlGained++;
      const om = D.maxHp;
      calc();
      Gv.maxHp = D.maxHp;
      Gv.hp = Math.min(Gv.maxHp, Gv.hp + (D.maxHp - om) + Gv.maxHp * .3);
    }
  }
  if (leveled) {
    calc();
    SFX.level();
    banner('УРОВЕНЬ ' + S.level, '+' + BAL.ptsPerLevel + ' ОЧКА · C — РАСПРЕДЕЛИТЬ', 'green');
    if (Gv) addText(Gv.player.x, ground - 150, 'УРОВЕНЬ ' + S.level + '!', '#3ef08c', 18);
  }
  refreshStats();
  saveSoon();
}

export function gainGold(v, quiet) {
  const Gv = getG();
  v = Math.round(v);
  S.gold += v;
  if (Gv) Gv.goldEarned += v;
  $('goldVal').textContent = fmtN(S.gold);
  const gw = $('goldWrap');
  gw.classList.remove('pulse');
  void gw.offsetWidth;
  gw.classList.add('pulse');
  if (!quiet) SFX.coin();
  saveSoon();
}

export function towerDmg(t) { return TOWERS[t.type].dmg * Math.pow(1.32, t.lvl - 1) * D.tDmg; }
export function towerRate(t) { return Math.min(6, TOWERS[t.type].rate * (1 + .06 * (t.lvl - 1)) * D.tRate); }
export function towerX(i) { return cx + (i === 0 ? -1 : 1) * Math.min(200, W * .26); }

export function renderDock() {
  const Gv = getG();
  for (let i = 0; i < 2; i++) {
    const card = $('tcard' + i), t = Gv ? Gv.towers[i] : null;
    if (!t) {
      card.className = 'tcard empty';
      card.innerHTML = `<div class="tn">ПОСТ ${i + 1} <i>+</i></div><div class="ts">построить башню</div>`;
    } else {
      const dps = Math.round(towerDmg(t) * towerRate(t));
      const canUp = S.gold >= upCost(t.type, t.lvl);
      card.className = 'tcard';
      card.innerHTML = `<div class="tn">${TOWERS[t.type].name} <i>LV.${t.lvl}</i></div><div class="ts">${dps} DPS · ${TOWERS[t.type].range} RNG</div>${canUp ? '<span class="up">↑</span>' : ''}`;
    }
  }
}

export function renderPop(i) {
  const Gv = getG();
  const pop = $('towerPop');
  const t = Gv.towers[i];
  let html = `<h4>ПОСТ ${i + 1} ${t ? '<i>' + TOWERS[t.type].name + ' LV.' + t.lvl + '</i>' : '<i>СВОБОДЕН</i>'}</h4>`;
  if (!t) {
    html += '<div class="ps">Выбери башню. Инженерия усиливает урон и темп.</div><div class="prow">';
    for (const k in TOWERS) {
      const tw = TOWERS[k], afford = S.gold >= tw.cost;
      html += `<button class="topt" data-act="build" data-type="${k}" ${afford ? '' : 'disabled'}>
        <b>${tw.name}</b><span class="cost">¤${tw.cost}</span>
        <small>${tw.desc} · ${tw.dmg}×${tw.rate}/с · RNG ${tw.range}</small></button>`;
    }
    html += '</div>';
  } else {
    const dmg = towerDmg(t), rate = towerRate(t), cost = upCost(t.type, t.lvl), refund = Math.floor(t.spent * .5);
    html += `<div class="ps">${TOWERS[t.type].desc}<br>урон ${dmg.toFixed(1)} · темп ${rate.toFixed(2)}/с · <b style="color:var(--acc)">${Math.round(dmg * rate)} DPS</b><br>следующий: +32% урон · +6% темп</div>
      <div class="prow">
      <button class="topt" data-act="up" ${S.gold >= cost ? '' : 'disabled'}><b>УЛУЧШИТЬ → LV.${t.lvl + 1}</b><span class="cost">¤${cost}</span></button>
      <button class="topt" data-act="sell"><b style="color:var(--red)">СНЕСТИ ПОСТ</b><span class="cost">+¤${refund}</span></button>
      </div>`;
  }
  pop.innerHTML = html;
  const card = $('tcard' + i), r = card.getBoundingClientRect();
  pop.classList.remove('hidden');
  const pw = 264;
  let left = clamp(r.left + r.width / 2 - pw / 2, 8, innerWidth - pw - 8);
  pop.style.left = left + 'px';
  pop.style.top = 'auto';
  pop.style.bottom = (innerHeight - r.top + 10) + 'px';
}

export function handlePopClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || popSlot < 0) return;
  const Gv = getG();
  if (!Gv) return;
  const i = popSlot, act = b.dataset.act;
  if (act === 'build') {
    const type = b.dataset.type, cost = TOWERS[type].cost;
    if (S.gold < cost) { SFX.err(); return; }
    S.gold -= cost;
    Gv.towers[i] = { type, lvl: 1, cd: rnd(.2, .6), spent: cost, flash: 0, sweep: rnd(TAU) };
    SFX.build();
    addParts(towerX(i), ground - 40, 10, '#3ef08c', 140, 200);
    toast(TOWERS[type].name + ' построен', 'gold');
  } else if (act === 'up') {
    const t = Gv.towers[i];
    if (!t) return;
    const cost = upCost(t.type, t.lvl);
    if (S.gold < cost) { SFX.err(); return; }
    S.gold -= cost;
    t.lvl++;
    t.spent += cost;
    t.flash = .15;
    SFX.up();
    addParts(towerX(i), ground - 40, 8, '#ffc24b', 120, 200);
  } else if (act === 'sell') {
    const t = Gv.towers[i];
    if (!t) return;
    const refund = Math.floor(t.spent * .5);
    Gv.towers[i] = null;
    gainGold(refund, true);
    SFX.build();
    addParts(towerX(i), ground - 40, 8, '#f4f4f2', 120);
  }
  $('goldVal').textContent = fmtN(S.gold);
  renderDock();
  renderPop(i);
  saveSoon();
}

export function openPop(i) {
  if (popSlot === i) { closeModal($('towerPop')); setPopSlot(-1); return; }
  if (popSlot >= 0) closeModal($('towerPop'));
  setPopSlot(i);
  if (getG()) getG().popSlot = i;
  SFX.click();
  renderPop(i);
  openModal($('towerPop'));
}

export function closePop() {
  if (popSlot >= 0) {
    closeModal($('towerPop'));
    setPopSlot(-1);
    if (getG()) getG().popSlot = -1;
  }
}

function updPlayer(dt) {
  const Gv = getG();
  const p = Gv.player;
  let mv = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mv -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mv += 1;
  const zone = Math.min(140, W * .18);
  if (Gv.dragX !== null) {
    const target = clamp(Gv.dragX, cx - zone, cx + zone);
    const d = target - p.x;
    if (Math.abs(d) > 4) { mv = Math.sign(d); p.x += clamp(d, -D.move * dt, D.move * dt); }
  } else if (mv) {
    p.x += mv * D.move * dt;
    p.face = mv;
  }
  p.x = clamp(p.x, cx - zone, cx + zone);
  p.ph += Math.abs(mv) * dt * 9;
  if (p.swing >= 0) { p.swing += dt / .18; if (p.swing > 1) p.swing = -1; }
  p.atkCd -= dt * (Gv.rage > 0 ? 1.6 : 1);
  if (p.atkCd <= 0) {
    let best = null, bd = 1e9;
    for (const e of Gv.enemies) {
      const d = Math.abs(e.x - p.x);
      if (d < D.range + e.s * .4 && d < bd) { bd = d; best = e; }
    }
    if (best) {
      p.atkCd = 1 / D.rate;
      p.swing = 0;
      p.face = Math.sign(best.x - p.x) || p.face;
      Gv.slashes.push({ x: p.x, y: ground - 60, t: 0, face: p.face, full: false });
      SFX.swing();
      const dmg = D.dmg * (Gv.rage > 0 ? 1.4 : 1);
      for (const e of Gv.enemies) {
        const dx = e.x - p.x;
        if (Math.abs(dx) < D.range + e.s * .4 && (Math.sign(dx) === p.face || Math.abs(dx) < 40)) {
          dealDamage(e, dmg, { canCrit: true });
          SFX.hit();
          addParts(e.x, ground + e.gyOff - e.s * 1.5, 3, '#f4f4f2', 110);
          if (D.knock > 1.5 && !e.dead && e.type !== 'boss') e.x += Math.sign(dx) * (D.knock - 1) * 20;
        }
      }
    }
  }
}

function updTowers(dt) {
  const Gv = getG();
  for (let i = 0; i < 2; i++) {
    const t = Gv.towers[i];
    if (!t) continue;
    t.flash = Math.max(0, t.flash - dt);
    t.sweep += dt * 1.4;
    t.cd -= dt;
    if (t.cd > 0 || Gv.phase !== 'wave' || !Gv.enemies.length) continue;
    const tx = towerX(i), def = TOWERS[t.type];
    let target = null, bd = 1e9;
    for (const e of Gv.enemies) {
      if (Math.abs(e.x - tx) > def.range) continue;
      const threat = Math.abs(e.x - Gv.player.x);
      if (threat < bd) { bd = threat; target = e; }
    }
    if (!target) continue;
    t.cd = 1 / towerRate(t);
    t.flash = .08;
    const dmg = towerDmg(t);
    if (t.type === 'mg') {
      Gv.shots.push({ kind: 'mg', x: tx, y: ground - 66, tgt: target, lx: target.x, ly: ground + target.gyOff - target.s * 1.5, dmg, spd: 640 });
      SFX.mg();
    } else if (t.type === 'rail') {
      const dir = Math.sign(target.x - tx) || 1;
      const x1 = target.x + dir * 50, lo = Math.min(tx, x1), hi = Math.max(tx, x1);
      Gv.beams.push({ x0: tx, x1, y: ground - 34, t: 0, life: .14 });
      for (const e of Gv.enemies) if (e.x >= lo - 10 && e.x <= hi + 10) dealDamage(e, dmg, {});
      shake(2);
      SFX.rail();
    } else if (t.type === 'mortar') {
      let lead = target.x;
      if (!target.dead) { const dir = Math.sign(Gv.player.x - target.x) || 1; lead = target.x + dir * target.spd * .7; }
      lead = clamp(lead, 20, W - 20);
      Gv.shots.push({ kind: 'mt', x0: tx, y0: ground - 66, tx: lead, t: 0, T: .75, dmg, r: 78 });
      SFX.mortar();
    } else if (t.type === 'laser') {
      Gv.beams.push({ x0: tx, x1: target.x, y: ground - 40, t: 0, life: .3 });
      dealDamage(target, dmg, {});
      SFX.rail();
    }
  }
}

function updEnemies(dt) {
  const Gv = getG();
  const px = Gv.player.x;
  for (const e of Gv.enemies) {
    if (e.dead) continue;
    e.flash = Math.max(0, e.flash - dt);
    if (e.type === 'shaman') {
      e.healCd -= dt;
      if (e.healCd <= 0) {
        e.healCd = 2.5;
        for (const other of Gv.enemies) {
          if (other !== e && !other.dead && Math.abs(other.x - e.x) < 180 && other.hp < other.maxHp) {
            other.hp = Math.min(other.maxHp, other.hp + other.maxHp * 0.2);
            addText(other.x, ground + other.gyOff - other.s * 3.1, '+', '#3ef08c', 11);
          }
        }
      }
    }
    if (e.stun > 0) { e.stun -= dt; continue; }
    const dx = px - e.x, dist = Math.abs(dx), dir = Math.sign(dx) || 1;
    e.face = dir;
    if (e.type === 'spit' && dist < 260 && dist > e.stop) {
      e.wind += dt;
      if (e.wind > 2.4) {
        e.wind = 0;
        const T = .9, gx = 520;
        const sx = e.x, sy = ground + e.gyOff - e.s * 2.2;
        const vx = (px - sx) / T, vy = (ground - 60 - sy - .5 * gx * T * T) / T;
        Gv.eShots.push({ x: sx, y: sy, vx, vy, dmg: e.dmg });
        SFX.spit();
      }
      continue;
    }
    if (dist > e.stop) {
      e.x += dir * e.spd * dt;
      e.ph += e.spd * dt * .09;
      if (e.type === 'boss') {
        const stepN = Math.floor(e.ph / Math.PI);
        if (stepN !== e.lastStep) { e.lastStep = stepN; shake(1.6); SFX.step(); }
      }
    } else {
      e.atkCd -= dt;
      if (e.atkCd <= 0) {
        e.atkCd = e.type === 'boss' ? 1.4 : 1.15;
        hurtPlayer(e.dmg);
        if (e.type === 'boss') { Gv.rings.push({ x: px, y: ground - 30, t: 0, life: .3, r1: 70, red: true }); shake(6); }
        addParts(px, ground - 70, 3, '#f4f4f2', 100);
      }
    }
  }
  Gv.enemies = Gv.enemies.filter(e => !e.dead);
}

function updShots(dt) {
  const Gv = getG();
  for (const s of Gv.shots) {
    if (s.kind === 'mg') {
      if (s.tgt && !s.tgt.dead) { s.lx = s.tgt.x; s.ly = ground + s.tgt.gyOff - s.tgt.s * 1.5; }
      const dx = s.lx - s.x, dy = s.ly - s.y, d = Math.hypot(dx, dy);
      if (d < 14) {
        s.done = true;
        if (s.tgt && !s.tgt.dead) dealDamage(s.tgt, s.dmg, {});
        addParts(s.lx, s.ly, 2, '#f4f4f2', 80);
      } else {
        const v = s.spd * dt / d;
        s.x += dx * v;
        s.y += dy * v;
        s.vx = dx / d;
        s.vy = dy / d;
      }
    } else {
      s.t += dt;
      if (s.t >= s.T) {
        s.done = true;
        Gv.craters.push({ x: s.tx, t: 0, r: 16 });
        Gv.rings.push({ x: s.tx, y: ground - 8, t: 0, life: .3, r1: s.r });
        addParts(s.tx, ground - 10, 12, '#ffc24b', 200);
        shake(4);
        SFX.boom();
        for (const e of Gv.enemies) {
          const d = Math.abs(e.x - s.tx);
          if (d < s.r) dealDamage(e, s.dmg * (1 - .5 * d / s.r), {});
        }
      }
    }
  }
  Gv.shots = Gv.shots.filter(s => !s.done);
  for (const s of Gv.eShots) {
    s.vy += 520 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (Math.abs(s.x - Gv.player.x) < 20 && s.y > ground - 130 && s.y < ground + 6) {
      s.done = true;
      hurtPlayer(s.dmg);
    } else if (s.y > ground + 4) {
      s.done = true;
      addParts(s.x, ground, 3, '#ff4d4d', 70);
    }
  }
  Gv.eShots = Gv.eShots.filter(s => !s.done);
  for (const b of Gv.beams) b.t += dt;
  Gv.beams = Gv.beams.filter(b => b.t < b.life);
}

function updFx(dt) {
  const Gv = getG();
  for (const p of Gv.parts) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  Gv.parts = Gv.parts.filter(p => p.t < p.life);
  for (const t of Gv.texts) { t.t += dt; t.y -= 36 * dt; }
  Gv.texts = Gv.texts.filter(t => t.t < t.life);
  for (const r of Gv.rings) r.t += dt;
  Gv.rings = Gv.rings.filter(r => r.t < r.life);
  for (const s of Gv.slashes) s.t += dt;
  Gv.slashes = Gv.slashes.filter(s => s.t < .18);
  for (const c of Gv.craters) c.t += dt;
  Gv.craters = Gv.craters.filter(c => c.t < 6);
  if (Gv.craters.length > 20) Gv.craters.shift();
  const goldT = { x: 110, y: H - 52 }, xpT = { x: W - 140, y: 34 };
  for (const p of Gv.pickups) {
    p.t += dt;
    if (p.ph === 0) {
      p.vy += 420 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.t > .32) p.ph = 1;
    } else {
      const tgt = p.kind === 'gold' ? goldT : xpT;
      const dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy);
      const sp = Math.min(1400, 340 + p.t * 900);
      if (d < 18) {
        p.done = true;
        if (p.kind === 'gold') gainGold(p.val); else { gainXp(p.val); SFX.xp(); }
      } else {
        p.x += dx / d * sp * dt;
        p.y += dy / d * sp * dt;
      }
    }
  }
  Gv.pickups = Gv.pickups.filter(p => !p.done);
}

export function step(dt) {
  const Gv = getG();
  if (!Gv) return;
  Gv.t += dt;
  if (Gv.phase === 'dying') {
    Gv.player.deadT += dt;
    updFx(dt);
    if (Gv.player.deadT > 1.6 && !Gv.deathDone) {
      Gv.deathDone = true;
      endRun('death');
    }
    return;
  }
  if (Gv.phase === 'over') { updFx(dt); return; }
  Gv.shake = Math.max(0, Gv.shake - dt * 22);
  Gv.ab1 = Math.max(0, Gv.ab1 - dt);
  Gv.ab2 = Math.max(0, Gv.ab2 - dt);
  Gv.rage = Math.max(0, Gv.rage - dt);
  Gv.hp = Math.min(Gv.maxHp, Gv.hp + D.regen * dt);
  if (Gv.phase === 'inter') {
    Gv.interT -= dt;
    if (Gv.interT <= 0) beginWave(Gv.wave + 1);
  } else if (Gv.phase === 'wave') {
    Gv.waveT += dt;
    while (Gv.spawnQ.length && Gv.spawnQ[0].at <= Gv.waveT && Gv.enemies.length < 44) {
      spawnEnemy(Gv.spawnQ.shift());
    }
  }
  updPlayer(dt);
  updTowers(dt);
  updEnemies(dt);
  updShots(dt);
  updFx(dt);
  if (Gv.phase === 'wave' && !Gv.spawnQ.length && !Gv.enemies.length) onClear();
}

export function updateHud() {
  const Gv = getG();
  if (!Gv) return;
  const hpPct = Math.max(0, Gv.hp / Gv.maxHp) * 100;
  $('hpFill').style.width = hpPct + '%';
  $('hpBar').classList.toggle('low', hpPct < 30);
  $('hpText').textContent = Math.ceil(Gv.hp) + ' / ' + Gv.maxHp;
  $('lowhp').classList.toggle('on', hpPct > 0 && hpPct < 30);
  const need = BAL.xpNeed(S.level);
  $('xpFill').style.width = Math.min(100, S.xp / need * 100) + '%';
  $('xpText').textContent = Math.floor(S.xp) + ' / ' + need;
  $('lvlNum').textContent = S.level;
  if (Gv.phase === 'inter') {
    $('waveNum').textContent = 'ПЕРЕДЫШКА';
    $('waveSub').textContent = 'ВОЛНА ' + (Gv.wave + 1) + ' ЧЕРЕЗ ' + Math.ceil(Gv.interT) + ' С';
  } else if (Gv.phase === 'wave') {
    $('waveNum').textContent = 'ВОЛНА ' + Gv.wave;
    $('waveSub').textContent = Gv.enemies.length + ' НА ПОЛЕ' + (Gv.spawnQ.length ? ' · ' + Gv.spawnQ.length + ' В ОЧЕРЕДИ' : '');
  } else if (Gv.phase === 'dying' || Gv.phase === 'over') {
    $('waveNum').textContent = 'КОНЕЦ';
    $('waveSub').textContent = 'ВОЛНА ' + Gv.wave;
  }
  if (Gv.boss && !Gv.boss.dead) $('bossFill').style.width = (Gv.boss.hp / Gv.boss.maxHp * 100) + '%';
  $('ab1cd').style.height = (Gv.ab1 / Gv.ab1Max * 100) + '%';
  $('ab1s').textContent = Gv.ab1 > 0 ? Math.ceil(Gv.ab1) : '';
  $('btnAb1').classList.toggle('ready', Gv.ab1 <= 0);
  const locked = S.level < 4;
  $('btnAb2').classList.toggle('locked', locked);
  $('ab2cd').style.height = (Gv.ab2 / Gv.ab2Max * 100) + '%';
  $('ab2s').textContent = locked ? '' : Gv.ab2 > 0 ? Math.ceil(Gv.ab2) : '';
  $('btnAb2').classList.toggle('ready', !locked && Gv.ab2 <= 0);
  $('btnAb2').classList.toggle('raging', Gv.rage > 0);
}

export function setKeys(set) { keys.clear(); set.forEach(k => keys.add(k)); return keys; }

export function bindGameInput(cv) {
  const Gv = getG();
  cv.addEventListener('pointerdown', e => {
    const g = getG();
    if (!g || g.phase === 'over') return;
    g.dragX = e.clientX;
  });
  addEventListener('pointermove', e => {
    const g = getG();
    if (g && g.dragX !== null) g.dragX = e.clientX;
  });
  addEventListener('pointerup', () => {
    const g = getG();
    if (g) g.dragX = null;
  });
}