import { TAU, clamp, lerp, rnd, n1, WEAPONS, TOWERS, QUAL } from './config.js';
import { S } from './save.js';
import { D } from './stats.js';

let ctx = null, pctx = null, W = 0, H = 0, ground = 0, cx = 0;
let boil = 0;
let motes = [];

export function setCtx(game, preview, dims) {
  ctx = game;
  pctx = preview;
  W = dims.W; H = dims.H; ground = dims.ground; cx = dims.cx;
}

export function resizeDims(dims) {
  W = dims.W; H = dims.H; ground = dims.ground; cx = dims.cx;
}

export function setBoil(v) { boil = v; }

const jit = (seed, i, a) => (n1(seed * 13.37 + i * 7.77 + boil * 3.1) - .5) * 2 * a;

export function makeMotes() {
  motes = [];
  const n = QUAL[S.quality].motes;
  for (let i = 0; i < n; i++) motes.push({ x: Math.random(), y: Math.random(), s: rnd(.6, 1.8), v: rnd(.004, .014), a: rnd(.03, .09) });
}

function jline2(c, x0, y0, x1, y1, seed, i, a = 1.3) {
  c.beginPath();
  c.moveTo(x0 + jit(seed, i, a), y0 + jit(seed, i + 1, a));
  c.lineTo(x1 + jit(seed, i + 2, a), y1 + jit(seed, i + 3, a));
  c.stroke();
}

function drawWeapon(c, hx, hy, ang, weapon, face, s) {
  if (!weapon || weapon === 'fists') return;
  const w = WEAPONS[weapon];
  if (!w) return;
  const len = s * (0.8 + w.range / 180);
  const ex = hx + Math.cos(ang) * len * face;
  const ey = hy + Math.sin(ang) * len;
  c.save();
  c.shadowColor = w.color;
  c.shadowBlur = 14;
  c.strokeStyle = w.color;
  c.lineCap = 'round';
  c.lineWidth = weapon === 'axe' ? 4.5 : weapon === 'bat' ? 3.6 : weapon === 'scythe' ? 2.4 : 2.4;
  c.beginPath();
  c.moveTo(hx, hy);
  c.lineTo(ex, ey);
  c.stroke();
  if (weapon === 'axe') {
    c.beginPath();
    c.arc(ex - 3, ey - 3, 6, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
  } else if (weapon === 'machete' || weapon === 'knife') {
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(ex, ey);
    c.lineTo(ex - 6 * face, ey - 4);
    c.stroke();
  } else if (weapon === 'scythe') {
    c.beginPath();
    c.arc(ex - 5 * face, ey + 4, 8, Math.PI * 1.2, Math.PI * 1.9);
    c.stroke();
  } else if (weapon === 'bat') {
    c.fillStyle = w.color;
    c.beginPath();
    c.arc(ex, ey, 3.5, 0, TAU);
    c.fill();
  }
  c.restore();
}

export function drawStick(c, x, gy, s, ph, o) {
  const seed = o.seed || 1, face = o.face || 1, lean = o.lean || 0;
  const J = (i, a = 1.3) => jit(seed, i, a * (s / 32));
  const hx = x + lean * s * .35, hy = gy - s * 1.02;
  const nx = x + lean * s * .5, ny = gy - s * 2.12;
  const hdx = nx + lean * s * .12, hdy = gy - s * 2.62, r = s * .4;

  c.strokeStyle = o.flash ? '#ffffff' : (o.col || '#f4f4f2');
  c.lineWidth = o.thick || 2;
  c.lineCap = 'round';
  c.globalAlpha = o.alpha !== undefined ? o.alpha : 1;

  c.beginPath(); c.arc(hdx + J(1), hdy + J(2), r, 0, TAU); c.stroke();

  if (o.spikes) {
    for (let k = -1; k <= 1; k++) jline2(c, hdx + k * r * .5, hdy - r * .85, hdx + k * r * .8, hdy - r * 1.5, seed, 20 + k * 2);
  }
  if (o.helmet) {
    c.beginPath();
    c.arc(hdx, hdy, r + 2, Math.PI * 1.05, Math.PI * 1.95);
    c.stroke();
  }
  if (o.robe) {
    c.beginPath();
    c.moveTo(nx - s * .35, ny + s * .15);
    c.lineTo(hx - s * .5, hy);
    c.lineTo(hx + s * .5, hy);
    c.lineTo(nx + s * .35, ny + s * .15);
    c.stroke();
  }

  jline2(c, nx, ny, hx, hy, seed, 3);

  for (let k = 0; k < 2; k++) {
    const phk = ph + k * Math.PI;
    const fx = x + Math.sin(phk) * s * .52 * face;
    const fy = gy - Math.max(0, Math.cos(phk)) * s * .14;
    const kx = (hx + fx) / 2 + face * s * .13, ky = (hy + fy) / 2;
    c.beginPath();
    c.moveTo(hx + J(5 + k * 4), hy + J(6 + k * 4));
    c.lineTo(kx + J(7 + k * 4), ky + J(8 + k * 4));
    c.lineTo(fx + J(9 + k * 4), fy + J(10 + k * 4));
    c.stroke();
  }

  let weaponHand = null;
  for (let k = 0; k < 2; k++) {
    let handX, handY;
    if (o.swing >= 0 && k === 1) {
      const a = lerp(-2.3, 0.35, o.swing);
      handX = nx + Math.cos(a) * s * .95 * face;
      handY = ny + Math.sin(a) * s * .95;
    } else if (o.armUp && k === 1) {
      handX = nx + face * s * .55;
      handY = ny - s * .6;
    } else {
      const aph = ph + k * Math.PI + Math.PI;
      handX = nx + Math.sin(aph) * s * .38 * face - lean * s * .25;
      handY = ny + s * .92;
    }
    const ex = (nx + handX) / 2 - face * s * .08, ey = (ny + handY) / 2;
    c.beginPath();
    c.moveTo(nx + J(14 + k * 4), ny + J(15 + k * 4));
    c.lineTo(ex + J(16 + k * 4), ey + J(17 + k * 4));
    c.lineTo(handX + J(18 + k * 4), handY + J(19 + k * 4));
    c.stroke();
    if (k === 1) weaponHand = { x: handX, y: handY };
  }

  if (o.weapon && weaponHand) {
    let ang;
    if (o.swing >= 0) ang = lerp(-2.3, 0.35, o.swing);
    else if (o.armUp) ang = -1.1;
    else ang = 1.4;
    drawWeapon(c, weaponHand.x, weaponHand.y, ang, o.weapon, face, s);
  }
  if (o.staff) {
    c.beginPath();
    c.moveTo(nx + face * s * .55, ny - s * .6);
    c.lineTo(nx + face * s * .55, ny + s * .9);
    c.stroke();
    c.fillStyle = '#a06bff';
    c.beginPath();
    c.arc(nx + face * s * .55, ny - s * .7, 3, 0, TAU);
    c.fill();
  }
  c.globalAlpha = 1;
}

export function drawPlayer(now) {
  if (!window.G) return;
  const G = window.G;
  const p = G.player;
  if (G.phase === 'dying') {
    const a = 1 - Math.min(1, p.deadT / 1.4);
    drawStick(ctx, p.x, ground + (p.deadT * 40), 32, 0, { seed: p.seed, face: p.face, swing: -1, alpha: a, thick: 2, weapon: S.weapon });
    return;
  }
  const glow = G.rage > 0 ? 1 : 0;
  if (glow) {
    ctx.save();
    ctx.shadowColor = '#3ef08c';
    ctx.shadowBlur = 20;
    drawStick(ctx, p.x, ground, 32, p.ph, { seed: p.seed, face: p.face, swing: p.swing, thick: 2, weapon: S.weapon });
    ctx.restore();
  } else {
    drawStick(ctx, p.x, ground, 32, p.ph, { seed: p.seed, face: p.face, swing: p.swing, thick: 2, weapon: S.weapon });
  }
}

export function drawEnemy(e) {
  const gy = ground + e.gyOff;
  const base = { seed: e.seed, face: e.face, flash: e.flash > 0, alpha: e.stun > 0 ? .6 : 1 };
  switch (e.type) {
    case 'walk': drawStick(ctx, e.x, gy, e.s, e.ph, { ...base, thick: 2 }); break;
    case 'run': drawStick(ctx, e.x, gy, e.s, e.ph, { ...base, thick: 2, lean: .4 }); break;
    case 'brute': drawStick(ctx, e.x, gy, e.s, e.ph, { ...base, thick: 3.6, lean: .22, spikes: true }); break;
    case 'spit': drawStick(ctx, e.x, gy, e.s, e.ph, { ...base, thick: 2, armUp: e.wind > 1.4 }); break;
    case 'swarm': drawStick(ctx, e.x, gy, e.s, e.ph, { ...base, thick: 1.4 }); break;
    case 'tank': drawStick(ctx, e.x, gy, e.s, e.ph, { ...base, thick: 4.2, helmet: true }); break;
    case 'shaman': drawStick(ctx, e.x, gy, e.s, e.ph, { ...base, thick: 2, robe: true, staff: true }); break;
    case 'bomber': drawStick(ctx, e.x, gy, e.s, e.ph, { ...base, thick: 2.6 }); break;
    case 'boss': drawStick(ctx, e.x, gy, e.s, e.ph, { ...base, thick: 5, spikes: true }); break;
  }
  if (e.type === 'bomber') {
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(e.x, gy - e.s * 1.9, 4 + Math.sin(now() / 100) * 1.5, 0, TAU);
    ctx.fill();
  }
  if (e.type === 'shaman') {
    ctx.strokeStyle = 'rgba(160,107,255,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(e.x, gy - e.s * 1.5, 22 + Math.sin(now() / 300) * 4, 0, TAU);
    ctx.stroke();
  }
  if (e.type === 'spit' && e.wind > 1.4) {
    ctx.fillStyle = '#ff4d4d';
    ctx.globalAlpha = .8;
    ctx.beginPath();
    ctx.arc(e.x + e.face * e.s * .55, gy - e.s * 2.72, 2 + e.wind, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (e.hp < e.maxHp) {
    const w = e.s * 1.3, pct = e.hp / e.maxHp;
    ctx.fillStyle = 'rgba(244,244,242,.15)';
    ctx.fillRect(e.x - w / 2, gy - e.s * 3.3, w, 2.5);
    ctx.fillStyle = e.type === 'boss' ? '#ff4d4d' : '#f4f4f2';
    ctx.fillRect(e.x - w / 2, gy - e.s * 3.3, w * pct, 2.5);
  }
}

export function drawTower(tx, t, i, now) {
  const baseY = ground;
  const lv = t ? t.lvl : 0;
  const color = t ? TOWERS[t.type].color : 'rgba(244,244,242,.3)';
  const grow = t ? Math.min(14, lv * 3.5) : 0;
  const height = 44 + grow;
  if (t) {
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.strokeStyle = 'rgba(255,255,255,.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(tx - 14, baseY - height, 28, height);
    ctx.fill();
    ctx.stroke();
    for (let r = 0; r < lv; r++) {
      const y = baseY - 12 - r * 6;
      ctx.strokeStyle = color;
      ctx.globalAlpha = .35 + r * .1;
      ctx.beginPath();
      ctx.moveTo(tx - 12, y);
      ctx.lineTo(tx + 12, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(244,244,242,.3)';
    ctx.beginPath();
    ctx.moveTo(tx, baseY - height);
    ctx.lineTo(tx, baseY - height - 4);
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = t.flash > 0 ? 22 : 10;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    if (t.type === 'mg') {
      ctx.beginPath();
      ctx.moveTo(tx, baseY - height);
      ctx.lineTo(tx - 10, baseY - height - 8);
      ctx.moveTo(tx, baseY - height);
      ctx.lineTo(tx + 10, baseY - height - 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, baseY - height, 3, 0, TAU);
      ctx.fill();
      for (let k = 0; k < lv; k++) {
        ctx.beginPath();
        ctx.arc(tx - 10 + k * 2, baseY - height - 10 - k * 1.5, 1.2, 0, TAU);
        ctx.fill();
      }
    } else if (t.type === 'rail') {
      ctx.beginPath();
      ctx.moveTo(tx, baseY - height);
      ctx.lineTo(tx, baseY - height - 22 - lv * 2);
      ctx.stroke();
      const pulse = (now() / 400) % 1;
      ctx.globalAlpha = .3 + pulse * .7;
      ctx.beginPath();
      ctx.arc(tx, baseY - height - 24 - lv * 2, 3, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(tx - 6, baseY - height);
      ctx.lineTo(tx + 6, baseY - height);
      ctx.stroke();
    } else if (t.type === 'mortar') {
      const ang = -Math.PI / 2 + (t.sweep || 0) * 0.2;
      ctx.beginPath();
      ctx.moveTo(tx, baseY - height);
      ctx.lineTo(tx + Math.cos(ang) * 16, baseY - height + Math.sin(ang) * 16);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, baseY - height, 7, 0, TAU);
      ctx.stroke();
      for (let k = 0; k < lv; k++) {
        ctx.beginPath();
        ctx.arc(tx + (k % 2 ? -1 : 1) * 6, baseY - height + 8 + k * 2, 1.5, 0, TAU);
        ctx.fill();
      }
    } else if (t.type === 'laser') {
      ctx.beginPath();
      ctx.moveTo(tx, baseY - height);
      ctx.lineTo(tx, baseY - height - 16 - lv * 2);
      ctx.stroke();
      const pulse = 2 + Math.sin(now() / 200) * 1.5;
      ctx.beginPath();
      ctx.arc(tx, baseY - height - 18 - lv * 2, pulse + 2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,77,77,.4)';
      ctx.beginPath();
      ctx.arc(tx, baseY - height - 18 - lv * 2, 6, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    ctx.strokeStyle = 'rgba(244,244,242,.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(tx, baseY);
    ctx.lineTo(tx, baseY - 18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(244,244,242,.1)';
    ctx.beginPath();
    ctx.arc(tx, baseY - 20, 3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(244,244,242,.5)';
    ctx.font = '600 9px "JetBrains Mono",monospace';
    ctx.textAlign = 'center';
    ctx.fillText('+', tx, baseY - 17);
  }
}

export function renderBattle(G, now) {
  ctx.clearRect(0, 0, W, H);
  const shx = G.shake ? rnd(-G.shake, G.shake) : 0;
  const shy = G.shake ? rnd(-G.shake, G.shake) : 0;
  ctx.save();
  ctx.translate(shx, shy);
  for (const m of motes) {
    m.y -= m.v * 0.016;
    if (m.y < 0) m.y = 1;
    ctx.globalAlpha = m.a;
    ctx.fillStyle = '#f4f4f2';
    ctx.fillRect(m.x * W - G.player.x * .015, m.y * H, m.s, m.s);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(62,240,140,.14)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 7]);
  ctx.beginPath();
  ctx.moveTo(cx, ground - 170);
  ctx.lineTo(cx, ground + 18);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(62,240,140,.35)';
  ctx.font = '600 8px "JetBrains Mono",monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Ч Е Р Т А', cx, ground + 30);
  ctx.strokeStyle = 'rgba(244,244,242,.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -10; x <= W + 10; x += 26) {
    const y = ground + jit(7, x * .1, 1.2);
    x === -10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  for (const c of G.craters) {
    ctx.globalAlpha = (1 - c.t / 6) * .25;
    ctx.strokeStyle = '#f4f4f2';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c.x, ground, c.r, Math.PI, 0);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 2; i++) {
    const t = G.towers[i], tx = cx + (i === 0 ? -1 : 1) * Math.min(200, W * .26);
    if (t && (G.popSlot === i || G.hoverTower === i)) {
      ctx.strokeStyle = 'rgba(244,244,242,.15)';
      ctx.fillStyle = 'rgba(244,244,242,.02)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.arc(tx, ground - 34, TOWERS[t.type].range, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }
    drawTower(tx, t, i, now);
  }
  const sorted = [...G.enemies].sort((a, b) => a.gyOff - b.gyOff);
  for (const e of sorted) drawEnemy(e, now);
  drawPlayer(now);
  for (const s of G.shots) {
    if (s.kind === 'mg') {
      ctx.strokeStyle = '#f4f4f2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - (s.vx || 0) * 10, s.y - (s.vy || 0) * 10);
      ctx.stroke();
    } else {
      const k = s.t / s.T;
      const x = lerp(s.x0, s.tx, k);
      const y = lerp(s.y0, ground, k) - Math.sin(Math.PI * k) * 140;
      ctx.fillStyle = '#ffc24b';
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,194,75,.2)';
      ctx.setLineDash([2, 5]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.tx, ground - 14);
      ctx.lineTo(s.tx, ground);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  for (const s of G.eShots) {
    ctx.strokeStyle = '#ff4d4d';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3.4, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = .35;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx * .04, s.y - s.vy * .04);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const b of G.beams) {
    const a = 1 - b.t / b.life;
    ctx.save();
    ctx.shadowColor = '#3ef08c';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = `rgba(62,240,140,${a})`;
    ctx.lineWidth = 3.2 * a + 1;
    ctx.beginPath();
    ctx.moveTo(b.x0, b.y + jit(1, 1, 1));
    ctx.lineTo(b.x1, b.y + jit(2, 2, 1));
    ctx.stroke();
    ctx.restore();
  }
  for (const r of G.rings) {
    const k = r.t / r.life;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = r.red ? '#ff4d4d' : '#3ef08c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.r1 * k, r.r1 * k * .3, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const s of G.slashes) {
    const k = s.t / .18;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = '#f4f4f2';
    ctx.lineWidth = 2;
    const baseY = s.y;
    const r = s.full ? 60 : 46;
    const a0 = s.full ? 0 : (s.face > 0 ? -1.2 : Math.PI + 1.2);
    const a1 = s.full ? TAU : (s.face > 0 ? 1.2 : Math.PI - 1.2);
    ctx.beginPath();
    ctx.arc(s.x, baseY, r * (0.6 + k * .6), a0, a1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of G.pickups) {
    if (p.kind === 'gold') {
      ctx.fillStyle = '#ffc24b';
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.t * 6);
      ctx.fillRect(-2, -3, 4, 6);
      ctx.restore();
    } else {
      ctx.fillStyle = '#3ef08c';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4, 0, TAU);
      ctx.fill();
    }
  }
  for (const p of G.parts) {
    const k = 1 - p.t / p.life;
    ctx.globalAlpha = k;
    ctx.strokeStyle = p.col;
    ctx.fillStyle = p.col;
    if (p.line) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * .02, p.y - p.vy * .02);
      ctx.lineWidth = p.sz;
      ctx.stroke();
    } else {
      ctx.fillRect(p.x, p.y, p.sz, p.sz);
    }
  }
  ctx.globalAlpha = 1;
  for (const t of G.texts) {
    const k = 1 - t.t / t.life;
    ctx.globalAlpha = k;
    ctx.fillStyle = t.col;
    ctx.font = `700 ${t.size}px "JetBrains Mono",monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(t.str, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function renderPreview(nowMs) {
  if (!pctx) return;
  const r = pctx.canvas.getBoundingClientRect();
  if (!r.width) return;
  pctx.clearRect(0, 0, r.width, r.height);
  const px = r.width / 2, py = r.height - 24;
  const s = Math.min(r.width, r.height) * 0.34;
  const ph = nowMs / 260;
  pctx.strokeStyle = 'rgba(62,240,140,.15)';
  pctx.lineWidth = 1;
  pctx.setLineDash([4, 6]);
  pctx.beginPath();
  pctx.moveTo(0, py);
  pctx.lineTo(r.width, py);
  pctx.stroke();
  pctx.setLineDash([]);
  drawStick(pctx, px, py, s, ph, { seed: 7, face: 1, thick: 2, weapon: S.weapon, swing: -1 });
}