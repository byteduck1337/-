import { view } from './view.js';
import { S, D } from './state.js';
import { G, towerX, towerDmg, towerRate } from './game.js';
import { ENEMIES, TOWERS, WEAPONS, QUAL } from './config.js';
import { jit, rnd, TAU, lerp, clamp, easeOut, n1 } from './utils.js';
import { on } from './events.js';

const INK = '#f2f2ee', ACC = '#46f28e', GOLD = '#f5b942', RED = '#ff4b4b';
let motes = [];
function makeMotes() {
  motes = [];
  const n = QUAL[S.quality].motes;
  for (let i = 0; i < n; i++) motes.push({ x: Math.random(), y: Math.random(), s: rnd(.6, 1.8), v: rnd(.004, .014), a: rnd(.03, .09) });
}
makeMotes();
on('quality', makeMotes);

function jline(c, x0, y0, x1, y1, seed, i, a = 1.3) {
  c.beginPath();
  c.moveTo(x0 + jit(seed, i, a), y0 + jit(seed, i + 1, a));
  c.lineTo(x1 + jit(seed, i + 2, a), y1 + jit(seed, i + 3, a));
  c.stroke();
}
function jrect(c, x, y, w, h, seed, a = 1.6) {
  jline(c, x, y, x + w, y, seed, 0, a); jline(c, x + w, y, x + w, y + h, seed, 4, a);
  jline(c, x + w, y + h, x, y + h, seed, 8, a); jline(c, x, y + h, x, y, seed, 12, a);
}
function groundLine(c, alpha = .28) {
  c.strokeStyle = `rgba(242,242,238,${alpha})`; c.lineWidth = 2; c.beginPath();
  for (let x = -10; x <= view.W + 10; x += 26) {
    const y = view.ground + jit(7, x * .1, 1.2);
    x === -10 ? c.moveTo(x, y) : c.lineTo(x, y);
  }
  c.stroke();
}
function drawMotes(c, px) {
  for (const m of motes) {
    m.y -= m.v * .016; if (m.y < 0) m.y = 1;
    c.globalAlpha = m.a; c.fillStyle = INK;
    c.fillRect(m.x * view.W - px * .015, m.y * view.H, m.s, m.s);
  }
  c.globalAlpha = 1;
}

/* ---- оружие в руке ---- */
function drawWeapon(c, hx, hy, ang, id, tier, s) {
  c.save(); c.translate(hx, hy); c.rotate(ang);
  const L = s / 46;
  c.lineCap = 'round';
  const edge = tier >= 2 ? ACC : INK;
  if (tier >= 1) { c.shadowColor = tier >= 2 ? ACC : INK; c.shadowBlur = 4 + tier * 2; }
  c.strokeStyle = INK; c.lineWidth = 2.4 * L;
  if (id === 'knife') {
    c.beginPath(); c.moveTo(0, 0); c.lineTo(15 * L, 0); c.stroke();
    c.strokeStyle = edge; c.lineWidth = 1.2 * L; c.beginPath(); c.moveTo(3 * L, -1.5 * L); c.lineTo(15 * L, 0); c.stroke();
    c.strokeStyle = INK; c.beginPath(); c.moveTo(2 * L, -3 * L); c.lineTo(2 * L, 3 * L); c.stroke();
  } else if (id === 'bat') {
    c.lineWidth = 5 * L; c.beginPath(); c.moveTo(0, 0); c.lineTo(26 * L, 0); c.stroke();
    c.lineWidth = 7 * L; c.beginPath(); c.moveTo(16 * L, 0); c.lineTo(30 * L, 0); c.stroke();
    c.strokeStyle = edge; c.lineWidth = 1.2 * L; c.beginPath(); c.moveTo(16 * L, -3 * L); c.lineTo(30 * L, -3 * L); c.stroke();
  } else if (id === 'katana') {
    c.lineWidth = 2.2 * L; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(24 * L, -4 * L, 46 * L, -2 * L); c.stroke();
    c.strokeStyle = edge; c.lineWidth = 1.1 * L; c.beginPath(); c.moveTo(2 * L, -1 * L); c.quadraticCurveTo(24 * L, -5.5 * L, 46 * L, -3 * L); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 2.6 * L; c.beginPath(); c.moveTo(1 * L, -4 * L); c.lineTo(1 * L, 4 * L); c.stroke();
  } else if (id === 'hammer') {
    c.lineWidth = 3 * L; c.beginPath(); c.moveTo(0, 0); c.lineTo(30 * L, 0); c.stroke();
    c.strokeStyle = edge; c.lineWidth = 2 * L; c.strokeRect(28 * L, -8 * L, 13 * L, 16 * L);
    if (tier >= 3) { c.beginPath(); c.moveTo(30 * L, -8 * L); c.lineTo(39 * L, 8 * L); c.stroke(); }
  } else if (id === 'scythe') {
    c.lineWidth = 2.6 * L; c.beginPath(); c.moveTo(0, 0); c.lineTo(40 * L, 0); c.stroke();
    c.strokeStyle = edge; c.lineWidth = 2.2 * L;
    c.beginPath(); c.moveTo(40 * L, 0); c.quadraticCurveTo(52 * L, -16 * L, 34 * L, -22 * L); c.stroke();
  } else if (tier >= 2) {
    c.strokeStyle = edge; c.lineWidth = 1.4 * L;
    c.beginPath(); c.arc(2 * L, 0, 4 * L, 0, TAU); c.stroke();
  }
  c.restore();
}

/* ---- фигура: походки различаются per-type + per-seed ---- */
function figure(c, f) {
  const { x, s, ph, face, seed } = f;
  const gait = f.gait || 'walk';
  const freq = f.freq || 1, asym = f.asym || 0, armAmp = f.armAmp || 1;
  let lean = f.lean || 0, bob = 0, legAmp = .5, legFreq = 1, hover = 0, armsLow = false;
  if (gait === 'run') { legFreq = 1.7; legAmp = .64; lean = .45; bob = .1; }
  else if (gait === 'stomp') { legFreq = .6; legAmp = .34; lean = .2; bob = .15; armsLow = true; }
  else if (gait === 'shuffle') { legFreq = 1.15; legAmp = .3; lean = .32; bob = .05; }
  else if (gait === 'march') { legFreq = .9; legAmp = .26; lean = .04; bob = .06; armsLow = true; }
  else if (gait === 'scurry') { legFreq = 2.3; legAmp = .3; lean = .5; bob = .07; }
  else if (gait === 'float') { hover = Math.sin(ph * .7 + seed) * 6; lean = .1; }
  else { bob = .05; }
  const p = ph * legFreq * freq;
  const GY = f.gy - bob * s * Math.abs(Math.cos(p)) + hover;
  const hx = x + lean * s * .35, hy = GY - s * 1.02;
  const nx = x + lean * s * .5, ny = GY - s * 2.12;
  const hdx = nx + lean * s * .12 + (f.tilt || 0) * s, hdy = GY - s * 2.62, r = s * .4;
  const J = (i, a = 1.3) => jit(seed, i, a * (s / 32));
  c.strokeStyle = f.flash ? '#fff' : (f.col || INK);
  c.lineWidth = f.thick || 2; c.lineCap = 'round';
  c.globalAlpha = f.alpha !== undefined ? f.alpha : 1;
  c.beginPath(); c.arc(hdx + J(1), hdy + J(2), r, 0, TAU); c.stroke();
  if (f.spikes) for (let k = -1; k <= 1; k++) jline(c, hdx + k * r * .5, hdy - r * .85, hdx + k * r * .85, hdy - r * 1.55, seed, 20 + k * 2);
  if (f.bomb) { c.fillStyle = RED; c.globalAlpha = (f.alpha || 1) * (.4 + .6 * Math.abs(Math.sin(ph * 4))); c.beginPath(); c.arc(hdx, hdy, r * .45, 0, TAU); c.fill(); c.globalAlpha = f.alpha !== undefined ? f.alpha : 1; }
  jline(c, nx, ny, hx, hy, seed, 3);
  if (gait === 'float') {
    c.beginPath(); c.moveTo(hx, hy);
    for (let k = 1; k <= 3; k++) c.quadraticCurveTo(hx + Math.sin(ph * 2 + k) * s * .3, hy + k * s * .3, hx + Math.sin(ph * 2.4 + k * 2) * s * .22, hy + k * s * .34);
    c.stroke();
  } else {
    for (let k = 0; k < 2; k++) {
      const phk = p + k * Math.PI, amp = legAmp * (k === 1 ? 1 + asym : 1);
      const fx = x + Math.sin(phk) * s * amp, fy = GY - Math.max(0, Math.cos(phk)) * s * .14;
      const kx = (hx + fx) / 2 + face * s * .13, ky = (hy + fy) / 2;
      c.beginPath(); c.moveTo(hx + J(5 + k * 4), hy + J(6 + k * 4)); c.lineTo(kx + J(7 + k * 4), ky + J(8 + k * 4)); c.lineTo(fx + J(9 + k * 4), fy + J(10 + k * 4)); c.stroke();
    }
  }
  /* задняя рука */
  const aph = p + Math.PI;
  const bhx = nx + Math.sin(aph) * s * .38 * armAmp - lean * s * .25, bhy = ny + s * (armsLow ? 1.05 : .92);
  c.beginPath(); c.moveTo(nx + J(14), ny + J(15)); c.lineTo((nx + bhx) / 2 - face * s * .08, (ny + bhy) / 2); c.lineTo(bhx + J(18), bhy + J(19)); c.stroke();
  /* передняя рука с оружием / щитом */
  let a = .95, ext = s * .8;
  const sw = f.swing;
  if (sw >= 0) {
    const t = clamp(sw, 0, 1), kind = f.swingKind || 'swing';
    if (kind === 'jab') { a = .1; ext = s * (.7 + .55 * Math.sin(Math.PI * t)); }
    else if (kind === 'swing') { a = lerp(-2.3, .9, easeOut(t)); }
    else if (kind === 'slam') { a = lerp(-2.7, .55, t * t); }
    else if (kind === 'spin') { a = -1.5 + t * TAU; }
  }
  const dx = Math.cos(a) * face, dy = Math.sin(a);
  const fhx = nx + dx * ext, fhy = ny + dy * ext;
  c.beginPath(); c.moveTo(nx + J(24), ny + J(25)); c.lineTo((nx + fhx) / 2 - face * s * .06, (ny + fhy) / 2); c.lineTo(fhx + J(28), fhy + J(29)); c.stroke();
  if (f.shield) {
    c.save(); c.translate(fhx, fhy); c.strokeStyle = f.flash ? '#fff' : INK; c.lineWidth = 2.2;
    jrect(c, face > 0 ? 0 : -12, -16, 12, 32, seed + 5, 1);
    c.restore();
  } else if (f.weapon) {
    drawWeapon(c, fhx, fhy, Math.atan2(dy, dx), f.weapon, f.tier || 0, s);
  }
  if (f.armUp) { c.fillStyle = RED; c.beginPath(); c.arc(nx + face * s * .55, ny - s * .6, 2 + (f.wind || 0), 0, TAU); c.fill(); }
  c.globalAlpha = 1;
}

/* ---- башни: три разных силуэта ---- */
function drawTower(c, i, now) {
  const t = G.towers[i], tx = towerX(i), gy = view.ground;
  const bw = 84, bh = 46, x = tx - bw / 2, y = gy - bh;
  if (!t) {
    c.strokeStyle = 'rgba(242,242,238,.4)'; c.lineWidth = 1.5; c.setLineDash([6, 6]);
    c.strokeRect(x, y, bw, bh); c.setLineDash([]);
    c.fillStyle = 'rgba(242,242,238,.5)'; c.font = '700 18px "JetBrains Mono"'; c.textAlign = 'center';
    c.fillText('+', tx, y + bh / 2 + 6);
    c.font = '600 8px "JetBrains Mono"'; c.fillText('ПОСТ ' + (i + 1), tx, gy + 14);
    return;
  }
  const def = TOWERS[t.type];
  c.strokeStyle = t.flash > 0 ? ACC : INK; c.lineWidth = 2;
  jrect(c, x, y, bw, bh, i * 31 + 7);
  /* мини-осциллограф на базе */
  c.save(); c.beginPath(); c.rect(x + 3, y + 3, bw - 6, bh - 6); c.clip();
  c.strokeStyle = 'rgba(70,242,142,.8)'; c.lineWidth = 1.1; c.beginPath();
  const n = t.trace.length;
  for (let k = 0; k < n; k++) {
    const v = t.trace[(t.ti + k) % n];
    const px = x + 6 + (bw - 12) * k / (n - 1), py = y + bh / 2 - v * 12 + jit(i * 17, k, .7);
    k === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
  }
  c.stroke(); c.restore();
  const topY = y - 2, lvl = t.lvl;
  c.strokeStyle = t.flash > 0 ? ACC : INK; c.lineCap = 'round';
  if (t.type === 'mg') {
    const barrels = lvl >= 6 ? 3 : lvl >= 3 ? 2 : 1;
    c.save(); c.translate(tx, topY - 8); c.rotate(t.aim);
    const rec = t.recoil * 5;
    for (let b = 0; b < barrels; b++) {
      const off = (b - (barrels - 1) / 2) * 5;
      c.lineWidth = 3.4; c.beginPath(); c.moveTo(-rec, off); c.lineTo(24 + lvl * 1.5 - rec, off); c.stroke();
    }
    c.lineWidth = 2; c.strokeRect(-10, -8, 14, 16);
    if (t.flash > 0) { c.fillStyle = ACC; c.beginPath(); c.arc(28 + lvl * 1.5, 0, 4, 0, TAU); c.fill(); }
    c.restore();
  } else if (t.type === 'rail') {
    const len = 40 + lvl * 4, coils = Math.min(5, 2 + Math.floor(lvl / 2));
    const charge = clamp(1 - t.cd * towerRate(t), 0, 1);
    c.lineWidth = 3; c.beginPath(); c.moveTo(tx - len / 2, topY - 10); c.lineTo(tx + len / 2, topY - 10); c.stroke();
    c.lineWidth = 1.6; c.beginPath(); c.moveTo(tx, topY); c.lineTo(tx, topY - 10); c.stroke();
    for (let k = 0; k < coils; k++) {
      const cxp = tx - len / 2 + (k + .5) * len / coils;
      c.strokeStyle = charge > (k + 1) / coils ? ACC : 'rgba(242,242,238,.5)';
      c.beginPath(); c.arc(cxp, topY - 10, 4.5, 0, TAU); c.stroke();
    }
    if (charge > .85) { c.save(); c.shadowColor = ACC; c.shadowBlur = 12; c.fillStyle = ACC; c.beginPath(); c.arc(tx + len / 2, topY - 10, 3, 0, TAU); c.fill(); c.restore(); }
  } else {
    const twin = lvl >= 5;
    const rec = t.recoil * 6;
    c.save(); c.translate(tx, topY - 4); c.rotate(-.9 + t.recoil * .12);
    c.lineWidth = 7 + lvl * .5; c.beginPath(); c.moveTo(-rec, 0); c.lineTo(26 + lvl * 2 - rec, 0); c.stroke();
    if (twin) { c.lineWidth = 6; c.beginPath(); c.moveTo(-rec, 8); c.lineTo(22 + lvl * 2 - rec, 8); c.stroke(); }
    c.restore();
    c.lineWidth = 2; c.beginPath(); c.moveTo(tx - 12, topY); c.lineTo(tx + 12, topY); c.stroke();
  }
  c.fillStyle = 'rgba(242,242,238,.55)'; c.font = '600 8px "JetBrains Mono"'; c.textAlign = 'center';
  c.fillText(def.name, tx, gy + 13);
  const pips = Math.min(lvl, 10);
  for (let k = 0; k < pips; k++) { c.fillStyle = k < 3 ? ACC : k < 6 ? GOLD : INK; c.fillRect(tx - pips * 3.5 + k * 7, gy + 18, 4, 3); }
}

/* ---- следы ударов по типу оружия ---- */
function drawSlash(c, s) {
  const life = s.kind === 'spin' ? .34 : s.kind === 'slam' ? .3 : .2;
  const a = 1 - s.t / life, tier = s.tier || 0;
  const col = tier >= 2 || s.whirl ? ACC : INK;
  c.strokeStyle = col; c.globalAlpha = a * .9;
  c.lineWidth = 2.5 + tier * .8 + (s.whirl ? 1 : 0);
  c.lineCap = 'round';
  if (tier >= 1) { c.shadowColor = col; c.shadowBlur = 6 + tier * 3; }
  const r = s.range * .8;
  c.beginPath();
  if (s.kind === 'jab') {
    const ext = r * (.6 + .5 * Math.sin(Math.PI * (s.t / life)));
    c.moveTo(s.x + s.face * 20, s.y); c.lineTo(s.x + s.face * (20 + ext), s.y - 4);
  } else if (s.kind === 'spin') {
    c.arc(s.x, s.y, r * (.5 + .6 * (s.t / life)), 0, TAU);
  } else if (s.kind === 'slam') {
    c.arc(s.x, s.y, r, s.face > 0 ? -2.4 : Math.PI - .6, s.face > 0 ? .6 : Math.PI + 2.4);
  } else {
    c.arc(s.x, s.y, r, s.face > 0 ? -2.2 : Math.PI - .9, s.face > 0 ? .9 : Math.PI + 2.2);
  }
  c.stroke();
  if (tier >= 4) { c.globalAlpha = a * .35; c.lineWidth = 1.5; c.beginPath(); c.arc(s.x, s.y, r * .82, 0, TAU); c.stroke(); }
  c.shadowBlur = 0; c.globalAlpha = 1;
}

export function drawBattle(c, now) {
  c.clearRect(0, 0, view.W, view.H);
  const shx = G.shake ? rnd(-G.shake, G.shake) : 0, shy = G.shake ? rnd(-G.shake, G.shake) : 0;
  c.save(); c.translate(shx, shy);
  drawMotes(c, G.player.x);
  c.strokeStyle = 'rgba(70,242,142,.14)'; c.lineWidth = 1.5; c.setLineDash([4, 7]);
  c.beginPath(); c.moveTo(view.cx, view.ground - 170); c.lineTo(view.cx, view.ground + 18); c.stroke(); c.setLineDash([]);
  c.fillStyle = 'rgba(70,242,142,.35)'; c.font = '600 8px "JetBrains Mono"'; c.textAlign = 'center';
  c.fillText('Ч Е Р Т А', view.cx, view.ground + 30);
  groundLine(c);
  for (const cr of G.craters) { c.globalAlpha = (1 - cr.t / 6) * .25; c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.arc(cr.x, view.ground, cr.r, Math.PI, 0); c.stroke(); }
  c.globalAlpha = 1;
  for (let i = 0; i < 2; i++) {
    const t = G.towers[i];
    if (t && (G.hoverTower === i)) {
      c.strokeStyle = 'rgba(242,242,238,.15)'; c.setLineDash([5, 6]); c.lineWidth = 1;
      c.beginPath(); c.arc(towerX(i), view.ground - 34, TOWERS[t.type].range, 0, TAU); c.stroke(); c.setLineDash([]);
    }
    drawTower(c, i, now);
  }
  const sorted = [...G.enemies].sort((a, b) => a.gyOff - b.gyOff);
  for (const e of sorted) {
    const t = ENEMIES[e.type], gy = view.ground + e.gyOff;
    figure(c, {
      x: e.x, gy, s: e.s, ph: e.ph, face: e.face, seed: e.seed, gait: t.gait,
      freq: e.freq, asym: e.asym, armAmp: e.armAmp, tilt: e.tilt,
      flash: e.flash > 0, thick: t.boss ? 5 : e.type === 'brute' ? 3.4 : 2,
      spikes: t.boss, shield: t.shield, bomb: t.bomb, ghost: t.ghost,
      alpha: t.ghost ? .55 : e.stun > 0 ? .6 : 1,
      armUp: t.ranged && e.wind > 1.4, wind: e.wind,
      lean: e.type === 'brute' ? .22 : 0,
    });
    if (e.hp < e.maxHp) {
      const w = e.s * 1.3, pct = e.hp / e.maxHp;
      c.fillStyle = 'rgba(242,242,238,.15)'; c.fillRect(e.x - w / 2, gy - e.s * 3.3, w, 2.5);
      c.fillStyle = t.boss ? RED : INK; c.fillRect(e.x - w / 2, gy - e.s * 3.3, w * pct, 2.5);
    }
  }
  drawPlayer(c, now);
  for (const s of G.shots) {
    if (s.kind === 'mg') {
      c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - (s.vx || 0) * 10, s.y - (s.vy || 0) * 10); c.stroke();
    } else {
      const k = s.t / s.T, x = lerp(s.x0, s.tx, k), y = lerp(s.y0, view.ground, k) - Math.sin(Math.PI * k) * 140;
      c.fillStyle = INK; c.beginPath(); c.arc(x, y, 3.2, 0, TAU); c.fill();
      c.globalAlpha = .3; c.beginPath(); c.arc(x - (s.tx - s.x0) / s.T * .03, y + 6, 2, 0, TAU); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = 'rgba(242,242,238,.2)'; c.setLineDash([2, 5]); c.lineWidth = 1;
      c.beginPath(); c.moveTo(s.tx, view.ground - 14); c.lineTo(s.tx, view.ground); c.stroke(); c.setLineDash([]);
    }
  }
  for (const s of G.eShots) {
    c.strokeStyle = RED; c.lineWidth = 1.6; c.beginPath(); c.arc(s.x, s.y, 3.4, 0, TAU); c.stroke();
    c.globalAlpha = .35; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - s.vx * .04, s.y - s.vy * .04); c.stroke(); c.globalAlpha = 1;
  }
  for (const b of G.beams) {
    const a = 1 - b.t / b.life;
    c.save(); c.shadowColor = ACC; c.shadowBlur = 14;
    c.strokeStyle = `rgba(70,242,142,${a})`; c.lineWidth = 3.2 * a + 1;
    c.beginPath(); c.moveTo(b.x0, b.y + jit(3, 1, 2)); c.lineTo(b.x1, b.y + jit(3, 2, 2)); c.stroke(); c.restore();
  }
  for (const s of G.slashes) drawSlash(c, s);
  for (const r of G.rings) {
    const k = r.t / r.life;
    c.strokeStyle = r.red ? `rgba(255,75,75,${1 - k})` : r.green ? `rgba(70,242,142,${1 - k})` : `rgba(242,242,238,${(1 - k) * .8})`;
    c.lineWidth = 2.5 * (1 - k) + 1;
    c.beginPath(); c.arc(r.x, r.y, lerp(16, r.r1, k), 0, TAU); c.stroke();
  }
  for (const p of G.parts) {
    c.globalAlpha = 1 - p.t / p.life; c.fillStyle = p.col; c.strokeStyle = p.col;
    if (p.line) { c.lineWidth = 1.5; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.beginPath(); c.moveTo(-p.sz * 2.4, 0); c.lineTo(p.sz * 2.4, 0); c.stroke(); c.restore(); }
    else c.fillRect(p.x, p.y, p.sz, p.sz);
  }
  c.globalAlpha = 1;
  for (const p of G.pickups) {
    if (p.kind === 'gold') { c.save(); c.translate(p.x, p.y); c.rotate(p.t * 6); c.fillStyle = GOLD; c.fillRect(-3, -3, 6, 6); c.restore(); }
    else { c.fillStyle = ACC; c.beginPath(); c.arc(p.x, p.y, 2.6, 0, TAU); c.fill(); }
  }
  c.textAlign = 'center';
  for (const t of G.texts) { c.globalAlpha = 1 - t.t / t.life; c.font = `700 ${t.size}px "JetBrains Mono"`; c.fillStyle = t.col; c.fillText(t.str, t.x, t.y); }
  c.globalAlpha = 1;
  c.restore();
}
function drawPlayer(c, now) {
  const p = G.player, gy = view.ground + 2;
  if (G.phase === 'dying' || G.phase === 'over') {
    const k = Math.min(1, p.deadT / .9);
    c.save(); c.translate(p.x, gy); c.rotate(k * Math.PI / 2 * (p.face || 1)); c.translate(-p.x, -gy);
    figure(c, { x: p.x, gy, s: 46, ph: 0, face: p.face, seed: p.seed, thick: 2.6, alpha: 1 - k * .5, weapon: S.weapon, tier: D.wLvl });
    c.restore(); return;
  }
  if (G.rage > 0) {
    c.save(); c.shadowColor = ACC; c.shadowBlur = 18;
    c.strokeStyle = `rgba(70,242,142,${.25 + .15 * Math.sin(now * .02)})`; c.lineWidth = 2;
    c.beginPath(); c.arc(p.x, gy - 70, 86 + Math.sin(now * .01) * 5, 0, TAU); c.stroke(); c.restore();
  }
  const mass = 2.6 + Math.min(1.4, S.stats.str * .05);
  figure(c, {
    x: p.x, gy: gy + Math.sin(now * .0022) * 2, s: 46, ph: p.ph, face: p.face, seed: p.seed,
    swing: p.swing, swingKind: p.swingKind, weapon: S.weapon, tier: D.wLvl,
    thick: mass, col: G.rage > 0 ? '#d9ffe9' : INK, gait: 'walk', freq: 1,
  });
  if (D.wLvl >= 5) {
    for (let k = 0; k < 3; k++) {
      const a = now * .003 + k * TAU / 3;
      c.fillStyle = ACC; c.globalAlpha = .7;
      c.beginPath(); c.arc(p.x + Math.cos(a) * 56, gy - 70 + Math.sin(a) * 26, 1.6, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
  }
}

/* ---- сцена меню ---- */
let menuSwing = -1, menuT = 0;
const idleEnemies = [];
for (let i = 0; i < 8; i++) {
  const types = ['walk', 'run', 'brute', 'shuffle', 'march', 'scurry', 'float', 'walk'];
  const gait = ['walk', 'run', 'stomp', 'shuffle', 'march', 'scurry', 'float', 'walk'][i];
  idleEnemies.push({ side: i < 4 ? -1 : 1, k: i % 4, gait, seed: rnd(1000), ph: rnd(6), freq: rnd(.8, 1.2), asym: rnd(-.2, .2), armAmp: rnd(.6, 1.3), tilt: rnd(-.1, .1), s: rnd(24, 34) });
}
export function practice() { menuSwing = 0; }
export function drawMenu(c, now, dt) {
  menuT += dt;
  if (menuSwing >= 0) { menuSwing += dt / .3; if (menuSwing > 1) menuSwing = -1; }
  c.clearRect(0, 0, view.W, view.H);
  drawMotes(c, 0);
  groundLine(c, .22);
  const fx = view.W > 760 ? view.W * .62 : view.W * .5;
  c.strokeStyle = 'rgba(70,242,142,.12)'; c.setLineDash([4, 7]); c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(fx, view.ground - 150); c.lineTo(fx, view.ground + 16); c.stroke(); c.setLineDash([]);
  for (const e of idleEnemies) {
    e.ph += dt * 1.4 * e.freq;
    const base = e.side < 0 ? 40 + e.k * 34 : view.W - 40 - e.k * 34;
    const x = base + Math.sin(menuT * .5 + e.seed) * 6;
    figure(c, { x, gy: view.ground + rnd(-1, 1) * 0 + (e.k % 2) * 6, s: e.s, ph: e.ph, face: e.side < 0 ? 1 : -1, seed: e.seed, gait: e.gait, freq: e.freq, asym: e.asym, armAmp: e.armAmp, tilt: e.tilt, alpha: .16, thick: e.gait === 'stomp' ? 3 : 1.8, ghost: e.gait === 'float' });
  }
  if (menuSwing >= 0) {
    drawSlash(c, { x: fx, y: view.ground - 60, t: menuSwing * .3, kind: D.kind, face: 1, tier: D.wLvl, range: D.range });
  }
  figure(c, {
    x: fx, gy: view.ground + Math.sin(menuT * 1.8) * 2, s: 48, ph: Math.sin(menuT * .9) * .25, face: 1, seed: 42,
    swing: menuSwing, swingKind: D.kind, weapon: S.weapon, tier: D.wLvl, thick: 2.6 + Math.min(1.4, S.stats.str * .05), gait: 'walk',
  });
  c.fillStyle = 'rgba(242,242,238,.4)'; c.font = '600 9px "JetBrains Mono"'; c.textAlign = 'center';
  const w = WEAPONS[S.weapon];
  c.fillText(`${w.name}${D.wLvl ? ' · УР.' + D.wLvl : ''} · УР. БОЙЦА ${S.level}`, fx, view.ground + 34);
  c.font = '600 15px Caveat'; c.fillStyle = 'rgba(70,242,142,.5)';
  c.fillText(' space — взмах ', fx, view.ground - 170);
}