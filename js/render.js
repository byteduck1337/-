import { view } from './view.js';
import { S, D } from './state.js';
import { slotX, bDmg, bRate } from './game.js';
import { ENEMIES, BUILDINGS, WEAPONS, QUAL, SLOTS } from './config.js';
import { jit, rnd, TAU, lerp, clamp, easeOut } from './utils.js';
import { on } from './events.js';

const INK = '#f2f2ee', ACC = '#46f28e', GOLD = '#f5b942', RED = '#ff4b4b', BLUE = '#5db4ff';
let motes = [];
function makeMotes() {
  motes = [];
  const n = (QUAL[S.quality] || QUAL.high).motes;
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
  for (let x = -10; x <= view.W + 10; x += 26) { const y = view.ground + jit(7, x * .1, 1.2); x === -10 ? c.moveTo(x, y) : c.lineTo(x, y); }
  c.stroke();
}
function drawMotes(c, px) {
  for (const m of motes) { m.y -= m.v * .016; if (m.y < 0) m.y = 1; c.globalAlpha = m.a; c.fillStyle = INK; c.fillRect(m.x * view.W - px * .015, m.y * view.H, m.s, m.s); }
  c.globalAlpha = 1;
}
function drawWeapon(c, hx, hy, ang, id, tier, s) {
  c.save(); c.translate(hx, hy); c.rotate(ang);
  const L = s / 46, edge = tier >= 2 ? ACC : INK;
  c.lineCap = 'round';
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
    c.strokeStyle = edge; c.lineWidth = 2.2 * L; c.beginPath(); c.moveTo(40 * L, 0); c.quadraticCurveTo(52 * L, -16 * L, 34 * L, -22 * L); c.stroke();
  } else if (id === 'axe') {
    c.lineWidth = 3 * L; c.beginPath(); c.moveTo(0, 0); c.lineTo(34 * L, 0); c.stroke();
    c.strokeStyle = RED; c.lineWidth = 2.4 * L;
    c.beginPath(); c.moveTo(30 * L, -12 * L); c.quadraticCurveTo(44 * L, 0, 30 * L, 12 * L); c.stroke();
  } else if (id === 'spear') {
    c.lineWidth = 2 * L; c.beginPath(); c.moveTo(-8 * L, 0); c.lineTo(40 * L, 0); c.stroke();
    c.beginPath(); c.moveTo(40 * L, 0); c.lineTo(33 * L, -4 * L); c.moveTo(40 * L, 0); c.lineTo(33 * L, 4 * L); c.stroke();
  } else if (tier >= 2) { c.strokeStyle = edge; c.lineWidth = 1.4 * L; c.beginPath(); c.arc(2 * L, 0, 4 * L, 0, TAU); c.stroke(); }
  c.restore();
}
function figure(c, f) {
  const x = f.x, s = f.s, ph = f.ph, face = f.face || 1, seed = f.seed || 1;
  const gait = f.gait || 'walk', freq = f.freq || 1, asym = f.asym || 0, armAmp = f.armAmp || 1;
  let lean = f.lean || 0, bob = .05, legAmp = .5, legFreq = 1, hover = 0, armsLow = false;
  if (gait === 'run') { legFreq = 1.7; legAmp = .64; lean = .45; bob = .1; }
  else if (gait === 'stomp') { legFreq = .6; legAmp = .34; lean = .2; bob = .15; armsLow = true; }
  else if (gait === 'shuffle') { legFreq = 1.15; legAmp = .3; lean = .32; bob = .05; }
  else if (gait === 'march') { legFreq = .9; legAmp = .26; lean = .04; bob = .06; armsLow = true; }
  else if (gait === 'scurry') { legFreq = 2.3; legAmp = .3; lean = .5; bob = .07; }
  else if (gait === 'float') { hover = Math.sin(ph * .7 + seed) * 6; lean = .1; }
  else if (gait === 'fly') { hover = Math.sin(ph * 2 + seed) * 5; legAmp = .15; }
  const p = ph * legFreq * freq;
  const GY = f.gy - bob * s * Math.abs(Math.cos(p)) + hover;
  const hx = x + lean * s * .35, hy = GY - s * 1.02;
  const nx = x + lean * s * .5, ny = GY - s * 2.12;
  const hdx = nx + lean * s * .12 + (f.tilt || 0) * s, hdy = GY - s * 2.62, r = s * .4;
  const J = (i, a = 1.3) => jit(seed, i, a * (s / 32));
  c.strokeStyle = f.flash ? '#fff' : (f.col || INK);
  c.lineWidth = f.thick || 2; c.lineCap = 'round';
  c.globalAlpha = f.alpha !== undefined ? f.alpha : 1;
  if (f.hood) { c.beginPath(); c.moveTo(hdx - r * 1.2, hdy + r * .6); c.lineTo(hdx, hdy - r * 1.5); c.lineTo(hdx + r * 1.2, hdy + r * .6); c.stroke(); }
  c.beginPath(); c.arc(hdx + J(1), hdy + J(2), r, 0, TAU); c.stroke();
  if (f.spikes) for (let k = -1; k <= 1; k++) jline(c, hdx + k * r * .5, hdy - r * .85, hdx + k * r * .85, hdy - r * 1.55, seed, 20 + k * 2);
  if (f.titan) { jline(c, nx - s * .5, ny + s * .1, nx + s * .5, ny + s * .1, seed, 40, 2); jline(c, nx - s * .4, ny + s * .3, nx + s * .4, ny + s * .3, seed, 44, 2); }
  if (f.bomb) { c.fillStyle = RED; c.globalAlpha = (f.alpha === undefined ? 1 : f.alpha) * (.4 + .6 * Math.abs(Math.sin(ph * 4))); c.beginPath(); c.arc(hdx, hdy, r * .45, 0, TAU); c.fill(); c.globalAlpha = f.alpha === undefined ? 1 : f.alpha; }
  if (f.brood) { c.beginPath(); c.ellipse(hx, hy - s * .3, s * .55, s * .7, 0, 0, TAU); c.stroke(); }
  jline(c, nx, ny, hx, hy, seed, 3);
  if (gait === 'float') {
    c.beginPath(); c.moveTo(hx, hy);
    for (let k = 1; k <= 3; k++) c.quadraticCurveTo(hx + Math.sin(ph * 2 + k) * s * .3, hy + k * s * .3, hx + Math.sin(ph * 2.4 + k * 2) * s * .22, hy + k * s * .34);
    c.stroke();
  } else if (gait === 'fly') {
    const w = Math.sin(ph * 6) * s * .5;
    c.beginPath(); c.moveTo(nx, ny + s * .2); c.quadraticCurveTo(nx - s * .8, ny - s * .4 - w, nx - s * 1.1, ny + s * .1); c.stroke();
    c.beginPath(); c.moveTo(nx, ny + s * .2); c.quadraticCurveTo(nx + s * .8, ny - s * .4 + w, nx + s * 1.1, ny + s * .1); c.stroke();
    jline(c, hx, hy, hx - s * .2, GY, seed, 5); jline(c, hx, hy, hx + s * .2, GY, seed, 9);
  } else {
    for (let k = 0; k < 2; k++) {
      const phk = p + k * Math.PI, amp = legAmp * (k === 1 ? 1 + asym : 1);
      const fx = x + Math.sin(phk) * s * amp, fy = GY - Math.max(0, Math.cos(phk)) * s * .14;
      const kx = (hx + fx) / 2 + face * s * .13, ky = (hy + fy) / 2;
      c.beginPath(); c.moveTo(hx + J(5 + k * 4), hy + J(6 + k * 4)); c.lineTo(kx + J(7 + k * 4), ky + J(8 + k * 4)); c.lineTo(fx + J(9 + k * 4), fy + J(10 + k * 4)); c.stroke();
    }
  }
  const aph = p + Math.PI;
  const bhx = nx + Math.sin(aph) * s * .38 * armAmp - lean * s * .25, bhy = ny + s * (armsLow ? 1.05 : .92);
  c.beginPath(); c.moveTo(nx + J(14), ny + J(15)); c.lineTo((nx + bhx) / 2 - face * s * .08, (ny + bhy) / 2); c.lineTo(bhx + J(18), bhy + J(19)); c.stroke();
  let a = .95, ext = s * .8;
  const sw = f.swing;
  if (sw >= 0) {
    const t = clamp(sw, 0, 1), kind = f.swingKind || 'swing';
    if (kind === 'jab') { a = .1; ext = s * (.7 + .55 * Math.sin(Math.PI * t)); }
    else if (kind === 'swing') a = lerp(-2.3, .9, easeOut(t));
    else if (kind === 'slam') a = lerp(-2.7, .55, t * t);
    else if (kind === 'spin') a = -1.5 + t * TAU;
  }
  if (f.staff) a = -1.2;
  const dx = Math.cos(a) * face, dy = Math.sin(a);
  const fhx = nx + dx * ext, fhy = ny + dy * ext;
  c.beginPath(); c.moveTo(nx + J(24), ny + J(25)); c.lineTo((nx + fhx) / 2 - face * s * .06, (ny + fhy) / 2); c.lineTo(fhx + J(28), fhy + J(29)); c.stroke();
  if (f.enraged) { c.strokeStyle = RED; c.lineWidth = (f.thick || 2) + 1; c.beginPath(); c.moveTo(nx, ny); c.lineTo(fhx, fhy); c.stroke(); c.strokeStyle = f.col || INK; }
  if (f.shield) { c.save(); c.translate(fhx, fhy); c.lineWidth = 2.2; jrect(c, face > 0 ? 0 : -12, -16, 12, 32, seed + 5, 1); c.restore(); }
  else if (f.weapon) drawWeapon(c, fhx, fhy, Math.atan2(dy, dx), f.weapon, f.tier || 0, s);
  if (f.staff) { c.strokeStyle = ACC; c.lineWidth = 1.6; c.beginPath(); c.arc(fhx, fhy - 6, 5 + Math.sin(ph * 3) * 2, 0, TAU); c.stroke(); }
  if (f.armUp) { c.fillStyle = RED; c.beginPath(); c.arc(nx + face * s * .55, ny - s * .6, 2 + (f.wind || 0), 0, TAU); c.fill(); }
  c.globalAlpha = 1; c.shadowBlur = 0;
}
function drawBuilding(c, G, i) {
  const b = G.buildings[i], tx = slotX(i), gy = view.ground;
  if (!b) {
    /* пустой пост — только маленькая площадка на земле, без коробок и подписей:
       вся информация о посте живёт в доке, оверлеи не дублируются */
    const hov = G.hoverSlot === i;
    c.strokeStyle = hov ? 'rgba(70,242,142,.7)' : 'rgba(242,242,238,.22)';
    c.lineWidth = 1.5; c.setLineDash([3, 4]);
    c.beginPath(); c.moveTo(tx - 20, gy - 3); c.lineTo(tx + 20, gy - 3); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.moveTo(tx - 20, gy - 8); c.lineTo(tx - 20, gy); c.moveTo(tx + 20, gy - 8); c.lineTo(tx + 20, gy); c.stroke();
    if (hov) { c.fillStyle = ACC; c.font = '700 13px "JetBrains Mono",monospace'; c.textAlign = 'center'; c.fillText('+', tx, gy - 12); }
    return;
  }
  const def = BUILDINGS[b.type], lvl = b.lvl;
  c.strokeStyle = b.flash > 0 ? ACC : INK; c.lineWidth = 2; c.lineCap = 'round';
  if (b.type === 'spikes') {
    const n = 5 + Math.min(4, lvl);
    for (let k = 0; k < n; k++) {
      const x = tx - 34 + k * (68 / (n - 1));
      jline(c, x - 4, gy, x, gy - 12 - lvl, i * 97 + k * 13 + 5, k * 3, 1);
      jline(c, x, gy - 12 - lvl, x + 4, gy, i * 97 + k * 13 + 5, k * 3 + 1, 1);
    }
  } else if (b.type === 'wall') {
    const h = 60 + lvl * 4;
    jrect(c, tx - 14, gy - h, 28, h, i * 13 + 3, 1.4);
    jline(c, tx - 14, gy - h * .5, tx + 14, gy - h * .5, i * 13, 20, 1);
    jline(c, tx, gy - h, tx, gy - h * .5, i * 13, 24, 1);
    const pct = clamp(b.hp / b.maxHp, 0, 1);
    c.fillStyle = 'rgba(242,242,238,.15)'; c.fillRect(tx - 16, gy - h - 8, 32, 3);
    c.fillStyle = pct > .4 ? INK : RED; c.fillRect(tx - 16, gy - h - 8, 32 * pct, 3);
    if (pct < .5) jline(c, tx - 8, gy - h * .7, tx + 6, gy - h * .3, i * 13, 30, 2);
  } else if (b.type === 'gen') {
    jrect(c, tx - 22, gy - 40, 44, 40, i * 17 + 1, 1.4);
    c.save(); c.translate(tx, gy - 20); c.rotate(b.timer * 1.2);
    c.fillStyle = b.flash > 0 ? ACC : GOLD; c.font = '700 18px "JetBrains Mono",monospace'; c.textAlign = 'center'; c.fillText('¤', 0, 6); c.restore();
    c.strokeStyle = GOLD; c.globalAlpha = .4 + .3 * Math.sin(b.timer * 2); c.beginPath(); c.arc(tx, gy - 20, 26, 0, TAU); c.stroke(); c.globalAlpha = 1;
  } else if (b.type === 'fix') {
    jrect(c, tx - 22, gy - 40, 44, 40, i * 19 + 2, 1.4);
    c.strokeStyle = ACC; c.lineWidth = 3;
    c.beginPath(); c.moveTo(tx - 9, gy - 20); c.lineTo(tx + 9, gy - 20); c.moveTo(tx, gy - 29); c.lineTo(tx, gy - 11); c.stroke();
    if (b.flash > 0) { c.globalAlpha = b.flash * 3; c.beginPath(); c.arc(tx, gy - 20, 30, 0, TAU); c.stroke(); c.globalAlpha = 1; }
  } else if (b.type === 'totem') {
    jline(c, tx, gy, tx, gy - 64 - lvl * 3, i * 23 + 4, 0, 1.4);
    c.save(); c.translate(tx, gy - 70 - lvl * 3); c.rotate(Math.PI / 4);
    c.strokeStyle = ACC; c.strokeRect(-7, -7, 14, 14); c.restore();
    c.strokeStyle = 'rgba(70,242,142,.25)'; c.setLineDash([4, 6]); c.lineWidth = 1;
    c.beginPath(); c.arc(tx, gy - 30, 170, 0, TAU); c.stroke(); c.setLineDash([]);
    c.fillStyle = ACC; c.globalAlpha = .5 + .4 * Math.sin(b.timer * 3); c.beginPath(); c.arc(tx, gy - 70 - lvl * 3, 3, 0, TAU); c.fill(); c.globalAlpha = 1;
  } else {
    const bw = 72, bh = 40, x = tx - bw / 2, y = gy - bh;
    jrect(c, x, y, bw, bh, i * 31 + 7);
    c.save(); c.beginPath(); c.rect(x + 3, y + 3, bw - 6, bh - 6); c.clip();
    c.strokeStyle = 'rgba(70,242,142,.8)'; c.lineWidth = 1.1; c.beginPath();
    const n = b.trace.length;
    for (let k = 0; k < n; k++) { const v = b.trace[(b.ti + k) % n]; const px = x + 6 + (bw - 12) * k / (n - 1), py = y + bh / 2 - v * 10 + jit(i * 17, k, .7); k === 0 ? c.moveTo(px, py) : c.lineTo(px, py); }
    c.stroke(); c.restore();
    const topY = y - 2;
    c.strokeStyle = b.flash > 0 ? ACC : INK;
    if (b.type === 'mg') {
      const barrels = lvl >= 6 ? 3 : lvl >= 3 ? 2 : 1;
      c.save(); c.translate(tx, topY - 8); c.rotate(b.aim);
      const rec = b.recoil * 5;
      for (let q = 0; q < barrels; q++) { const off = (q - (barrels - 1) / 2) * 5; c.lineWidth = 3.4; c.beginPath(); c.moveTo(-rec, off); c.lineTo(24 + lvl * 1.5 - rec, off); c.stroke(); }
      c.lineWidth = 2; c.strokeRect(-10, -8, 14, 16);
      if (b.flash > 0) { c.fillStyle = ACC; c.beginPath(); c.arc(28 + lvl * 1.5, 0, 4, 0, TAU); c.fill(); }
      c.restore();
    } else if (b.type === 'rail') {
      const len = 40 + lvl * 4, coils = Math.min(5, 2 + Math.floor(lvl / 2));
      const charge = clamp(1 - b.cd * bRate(b), 0, 1);
      c.lineWidth = 3; c.beginPath(); c.moveTo(tx - len / 2, topY - 10); c.lineTo(tx + len / 2, topY - 10); c.stroke();
      c.lineWidth = 1.6; c.beginPath(); c.moveTo(tx, topY); c.lineTo(tx, topY - 10); c.stroke();
      for (let k = 0; k < coils; k++) {
        const cxp = tx - len / 2 + (k + .5) * len / coils;
        c.strokeStyle = charge > (k + 1) / coils ? ACC : 'rgba(242,242,238,.5)';
        c.beginPath(); c.arc(cxp, topY - 10, 4.5, 0, TAU); c.stroke();
      }
      if (charge > .85) { c.save(); c.shadowColor = ACC; c.shadowBlur = 12; c.fillStyle = ACC; c.beginPath(); c.arc(tx + len / 2, topY - 10, 3, 0, TAU); c.fill(); c.restore(); }
    } else if (b.type === 'mortar') {
      const rec = b.recoil * 6;
      c.save(); c.translate(tx, topY - 4); c.rotate(-.9 + b.recoil * .12);
      c.lineWidth = 7 + lvl * .5; c.beginPath(); c.moveTo(-rec, 0); c.lineTo(26 + lvl * 2 - rec, 0); c.stroke();
      if (lvl >= 5) { c.lineWidth = 6; c.beginPath(); c.moveTo(-rec, 8); c.lineTo(22 + lvl * 2 - rec, 8); c.stroke(); }
      c.restore();
      c.lineWidth = 2; c.beginPath(); c.moveTo(tx - 12, topY); c.lineTo(tx + 12, topY); c.stroke();
    } else if (b.type === 'tesla') {
      for (let k = 0; k < 3 + Math.min(2, Math.floor(lvl / 3)); k++) { c.lineWidth = 1.8; c.beginPath(); c.ellipse(tx, topY - 8 - k * 7, 12 - k, 4, 0, 0, TAU); c.stroke(); }
      c.fillStyle = b.flash > 0 ? ACC : BLUE; c.beginPath(); c.arc(tx, topY - 34 - Math.min(2, Math.floor(lvl / 3)) * 7, 5, 0, TAU); c.fill();
    }
  }
  c.fillStyle = 'rgba(242,242,238,.55)'; c.font = '600 7px "JetBrains Mono",monospace'; c.textAlign = 'center';
  c.fillText(def.name, tx, gy + 12);
  const pips = Math.min(lvl, 10);
  for (let k = 0; k < pips; k++) { c.fillStyle = k < 3 ? ACC : k < 6 ? GOLD : INK; c.fillRect(tx - pips * 3 + k * 6, gy + 16, 3.5, 3); }
}
function drawSlash(c, s) {
  const life = s.kind === 'spin' ? .34 : s.kind === 'slam' ? .3 : .2;
  const a = clamp(1 - s.t / life, 0, 1), tier = s.tier || 0;
  const col = tier >= 2 || s.whirl ? ACC : INK;
  c.strokeStyle = col; c.globalAlpha = a * .9;
  c.lineWidth = 2.5 + tier * .8 + (s.whirl ? 1 : 0) + Math.min(3, (s.str || 0) * .12); c.lineCap = 'round';
  if (tier >= 1) { c.shadowColor = col; c.shadowBlur = 6 + tier * 3; }
  const r = s.range * .8;
  c.beginPath();
  if (s.kind === 'jab') { const ext = r * (.6 + .5 * Math.sin(Math.PI * (s.t / life))); c.moveTo(s.x + s.face * 20, s.y); c.lineTo(s.x + s.face * (20 + ext), s.y - 4); }
  else if (s.kind === 'spin') c.arc(s.x, s.y, r * (.5 + .6 * (s.t / life)), 0, TAU);
  else if (s.kind === 'slam') c.arc(s.x, s.y, r, s.face > 0 ? -2.4 : Math.PI - .6, s.face > 0 ? .6 : Math.PI + 2.4);
  else c.arc(s.x, s.y, r, s.face > 0 ? -2.2 : Math.PI - .9, s.face > 0 ? .9 : Math.PI + 2.2);
  c.stroke();
  if (tier >= 4) { c.globalAlpha = a * .35; c.lineWidth = 1.5; c.beginPath(); c.arc(s.x, s.y, r * .82, 0, TAU); c.stroke(); }
  c.shadowBlur = 0; c.globalAlpha = 1;
}
export function drawBattle(c, G, now) {
  c.clearRect(0, 0, view.W, view.H);
  if (!G) return;
  const shx = G.shake ? rnd(-G.shake, G.shake) : 0, shy = G.shake ? rnd(-G.shake, G.shake) : 0;
  c.save(); c.translate(shx, shy);
  drawMotes(c, G.player.x);
  c.strokeStyle = 'rgba(70,242,142,.14)'; c.lineWidth = 1.5; c.setLineDash([4, 7]);
  c.beginPath(); c.moveTo(view.cx, view.ground - 170); c.lineTo(view.cx, view.ground + 10); c.stroke(); c.setLineDash([]);
  c.fillStyle = 'rgba(70,242,142,.35)'; c.font = '600 8px "JetBrains Mono",monospace'; c.textAlign = 'center';
  c.fillText('Ч Е Р Т А', view.cx, view.ground - 178);
  groundLine(c);
  for (const cr of G.craters) { c.globalAlpha = (1 - cr.t / 6) * .25; c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.arc(cr.x, view.ground, cr.r, Math.PI, 0); c.stroke(); }
  c.globalAlpha = 1;
  for (let i = 0; i < SLOTS; i++) {
    const b = G.buildings[i];
    if (b && G.hoverSlot === i && BUILDINGS[b.type].range) { c.strokeStyle = 'rgba(242,242,238,.15)'; c.setLineDash([5, 6]); c.lineWidth = 1; c.beginPath(); c.arc(slotX(i), view.ground - 34, BUILDINGS[b.type].range, 0, TAU); c.stroke(); c.setLineDash([]); }
    drawBuilding(c, G, i);
  }
  const sorted = [...G.enemies].sort((a, b) => a.gyOff - b.gyOff);
  for (const e of sorted) {
    const t = ENEMIES[e.type], gy = view.ground + e.gyOff;
    figure(c, {
      x: e.x, gy, s: e.s, ph: e.ph, face: e.face, seed: e.seed, gait: t.gait, freq: e.freq, asym: e.asym, armAmp: e.armAmp, tilt: e.tilt,
      flash: e.flash > 0, thick: t.titan ? 6 : t.boss ? 5 : e.type === 'brute' ? 3.4 : 2,
      spikes: t.spikes, shield: t.shield, bomb: t.bomb, hood: t.hood, brood: t.brood, titan: t.titan,
      weapon: t.axe ? 'axe' : t.reach ? 'spear' : null, staff: t.staff,
      enraged: t.rage && e.hp < e.maxHp * .5,
      alpha: t.ghost ? .55 : e.stun > 0 ? .6 : 1,
      armUp: t.ranged && e.wind > 1.4, wind: e.wind, lean: e.type === 'brute' ? .22 : 0,
    });
    if (e.hp < e.maxHp) { const w = e.s * 1.3, pct = clamp(e.hp / e.maxHp, 0, 1); c.fillStyle = 'rgba(242,242,238,.15)'; c.fillRect(e.x - w / 2, gy - e.s * 3.3, w, 2.5); c.fillStyle = t.boss ? RED : INK; c.fillRect(e.x - w / 2, gy - e.s * 3.3, w * pct, 2.5); }
  }
  drawPlayer(c, G, now);
  for (const s of G.shots) {
    if (s.kind === 'mg') { c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - (s.vx || 0) * 10, s.y - (s.vy || 0) * 10); c.stroke(); }
    else {
      const k = s.t / s.T, x = lerp(s.x0, s.tx, k), y = lerp(s.y0, view.ground, k) - Math.sin(Math.PI * k) * 140;
      c.fillStyle = INK; c.beginPath(); c.arc(x, y, 3.2, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(242,242,238,.2)'; c.setLineDash([2, 5]); c.lineWidth = 1;
      c.beginPath(); c.moveTo(s.tx, view.ground - 14); c.lineTo(s.tx, view.ground); c.stroke(); c.setLineDash([]);
    }
  }
  for (const s of G.eShots) { c.strokeStyle = RED; c.lineWidth = 1.6; c.beginPath(); c.arc(s.x, s.y, 3.4, 0, TAU); c.stroke(); c.globalAlpha = .35; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - s.vx * .04, s.y - s.vy * .04); c.stroke(); c.globalAlpha = 1; }
  for (const b of G.beams) { const a = 1 - b.t / b.life; c.save(); c.shadowColor = ACC; c.shadowBlur = 14; c.strokeStyle = `rgba(70,242,142,${a})`; c.lineWidth = 3.2 * a + 1; c.beginPath(); c.moveTo(b.x0, b.y + jit(3, 1, 2)); c.lineTo(b.x1, b.y + jit(3, 2, 2)); c.stroke(); c.restore(); }
  for (const z of G.zaps) {
    const a = 1 - z.t / z.life;
    c.save(); c.shadowColor = BLUE; c.shadowBlur = 10; c.strokeStyle = `rgba(93,180,255,${a})`; c.lineWidth = 2;
    c.beginPath();
    for (let k = 0; k < z.pts.length - 1; k++) {
      const p0 = z.pts[k], p1 = z.pts[k + 1];
      c.moveTo(p0.x, p0.y);
      for (let q = 1; q <= 4; q++) { const t = q / 4; c.lineTo(lerp(p0.x, p1.x, t) + (q < 4 ? jit(k * 31 + q, 1, 7) : 0), lerp(p0.y, p1.y, t) + (q < 4 ? jit(k * 31 + q, 2, 7) : 0)); }
    }
    c.stroke(); c.restore();
  }
  for (const s of G.slashes) drawSlash(c, s);
  for (const r of G.rings) { const k = r.t / r.life; c.strokeStyle = r.red ? `rgba(255,75,75,${1 - k})` : r.green ? `rgba(70,242,142,${1 - k})` : `rgba(242,242,238,${(1 - k) * .8})`; c.lineWidth = 2.5 * (1 - k) + 1; c.beginPath(); c.arc(r.x, r.y, lerp(16, r.r1, k), 0, TAU); c.stroke(); }
  for (const p of G.parts) {
    c.globalAlpha = 1 - p.t / p.life; c.fillStyle = p.col; c.strokeStyle = p.col;
    if (p.line) { c.lineWidth = 1.5; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.beginPath(); c.moveTo(-p.sz * 2.4, 0); c.lineTo(p.sz * 2.4, 0); c.stroke(); c.restore(); }
    else c.fillRect(p.x, p.y, p.sz, p.sz);
  }
  c.globalAlpha = 1;
  for (const p of G.pickups) { if (p.kind === 'gold') { c.save(); c.translate(p.x, p.y); c.rotate(p.t * 6); c.fillStyle = GOLD; c.fillRect(-3, -3, 6, 6); c.restore(); } else { c.fillStyle = ACC; c.beginPath(); c.arc(p.x, p.y, 2.6, 0, TAU); c.fill(); } }
  c.textAlign = 'center';
  for (const t of G.texts) { c.globalAlpha = 1 - t.t / t.life; c.font = `700 ${t.size}px "JetBrains Mono",monospace`; c.fillStyle = t.col; c.fillText(t.str, t.x, t.y); }
  c.globalAlpha = 1;
  c.restore();
}
function drawPlayer(c, G, now) {
  const p = G.player, gy = view.ground + 2;
  if (G.phase === 'dying' || G.phase === 'over') {
    const k = Math.min(1, p.deadT / .9);
    c.save(); c.translate(p.x, gy); c.rotate(k * Math.PI / 2 * (p.face || 1)); c.translate(-p.x, -gy);
    figure(c, { x: p.x, gy, s: 46, ph: 0, face: p.face, seed: p.seed, thick: 2.6, alpha: 1 - k * .5, weapon: S.weapon, tier: D.wLvl });
    c.restore(); return;
  }
  if (S.stats.agi >= 6 && p.moving) {
    for (let k = 1; k <= 2; k++) figure(c, { x: p.x - p.face * k * 14, gy, s: 46, ph: p.ph - k * .4, face: p.face, seed: p.seed, alpha: .12 / k, weapon: S.weapon, tier: 0, gait: 'run' });
  }
  if (G.rage > 0) { c.save(); c.shadowColor = ACC; c.shadowBlur = 18; c.strokeStyle = `rgba(70,242,142,${.25 + .15 * Math.sin(now * .02)})`; c.lineWidth = 2; c.beginPath(); c.arc(p.x, gy - 70, 86 + Math.sin(now * .01) * 5, 0, TAU); c.stroke(); c.restore(); }
  figure(c, { x: p.x, gy: gy + Math.sin(now * .0022) * 2, s: 46, ph: p.ph, face: p.face, seed: p.seed, swing: p.swing, swingKind: p.swingKind, weapon: S.weapon, tier: D.wLvl, thick: 2.6 + Math.min(1.6, S.stats.str * .06), col: G.rage > 0 ? '#d9ffe9' : INK, gait: p.moving ? 'run' : 'walk' });
  if (D.wLvl >= 5) { for (let k = 0; k < 3; k++) { const a = now * .003 + k * TAU / 3; c.fillStyle = ACC; c.globalAlpha = .7; c.beginPath(); c.arc(p.x + Math.cos(a) * 56, gy - 70 + Math.sin(a) * 26, 1.6, 0, TAU); c.fill(); } c.globalAlpha = 1; }
}

let menuSwing = -1, menuT = 0;
const idleEnemies = [];
['walk', 'run', 'stomp', 'shuffle', 'march', 'scurry', 'float', 'fly'].forEach((gait, i) => {
  idleEnemies.push({ side: i < 4 ? -1 : 1, k: i % 4, gait, seed: rnd(1000), ph: rnd(6), freq: rnd(.8, 1.2), asym: rnd(-.2, .2), armAmp: rnd(.6, 1.3), tilt: rnd(-.1, .1), s: rnd(24, 34) });
});
export function practice() { menuSwing = 0; }
export function drawMenu(c, now, dt) {
  menuT += dt;
  if (menuSwing >= 0) { menuSwing += dt / D.swingDur; if (menuSwing > 1) menuSwing = -1; }
  c.clearRect(0, 0, view.W, view.H);
  drawMotes(c, 0);
  groundLine(c, .22);
  const fx = view.W > 760 ? view.W * .62 : view.W * .5;
  c.strokeStyle = 'rgba(70,242,142,.12)'; c.setLineDash([4, 7]); c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(fx, view.ground - 150); c.lineTo(fx, view.ground + 16); c.stroke(); c.setLineDash([]);
  for (const e of idleEnemies) {
    e.ph += dt * 1.4 * e.freq;
    const base = e.side < 0 ? 40 + e.k * 34 : view.W - 40 - e.k * 34;
    figure(c, { x: base + Math.sin(menuT * .5 + e.seed) * 6, gy: view.ground + (e.k % 2) * 6 - (e.gait === 'fly' ? 50 : 0), s: e.s, ph: e.ph, face: e.side < 0 ? 1 : -1, seed: e.seed, gait: e.gait, freq: e.freq, asym: e.asym, armAmp: e.armAmp, tilt: e.tilt, alpha: .16, thick: e.gait === 'stomp' ? 3 : 1.8 });
  }
  if (menuSwing >= 0) drawSlash(c, { x: fx, y: view.ground - 60, t: menuSwing * D.swingDur, kind: D.kind, face: 1, tier: D.wLvl, range: D.range, str: S.stats.str });
  figure(c, { x: fx, gy: view.ground + Math.sin(menuT * 1.8) * 2, s: 48, ph: Math.sin(menuT * .9) * .25, face: 1, seed: 42, swing: menuSwing, swingKind: D.kind, weapon: S.weapon, tier: D.wLvl, thick: 2.6 + Math.min(1.6, S.stats.str * .06), gait: 'walk' });
  c.fillStyle = 'rgba(242,242,238,.4)'; c.font = '600 9px "JetBrains Mono",monospace'; c.textAlign = 'center';
  c.fillText(`${WEAPONS[S.weapon].name}${D.wLvl ? ' · УР.' + D.wLvl : ''} · УР. БОЙЦА ${S.level}`, fx, view.ground + 34);
  c.font = '600 15px Caveat,cursive'; c.fillStyle = 'rgba(70,242,142,.5)';
  c.fillText(' space — взмах ', fx, view.ground - 170);
}
