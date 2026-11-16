import { computeView, view } from './view.js';
import { S, saveNow } from './state.js';
import { on, emit } from './events.js';
import { init as inputInit } from './input.js';
import { init as audioInit, resume, play, weaponSound } from './audio.js';
import { G, startRun, step, pause } from './game.js';
import { drawBattle, drawMenu, practice } from './render.js';
import * as ui from './ui.js';
import { setBoil } from './utils.js';
import { D } from './state.js';

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');

function resize() {
  const oldCx = view.cx;
  computeView();
  canvas.width = view.W * view.DPR; canvas.height = view.H * view.DPR;
  ctx.setTransform(view.DPR, 0, 0, view.DPR, 0, 0);
  if (G && oldCx) {
    const d = view.cx - oldCx;
    G.player.x += d;
    G.enemies.forEach(e => e.x += d);
    G.shots = []; G.eShots = []; G.beams = []; G.parts = []; G.texts = []; G.craters = [];
  }
}
addEventListener('resize', resize);

function setScreen(name) {
  view.screen = name;
  document.getElementById('menu').classList.toggle('hidden', name !== 'menu');
  document.getElementById('battle').classList.toggle('hidden', name !== 'battle');
  document.getElementById('lowhp').classList.remove('on');
  emit('screen', name);
}
on('screen', setScreen);
on('menu:swing', () => { practice(); play(weaponSound(D.kind)); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden && view.screen === 'battle' && G && (G.phase === 'wave' || G.phase === 'inter')) pause(true);
});

ui.init();
inputInit(canvas);
resize();
setScreen('menu');

let last = 0, acc = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  const now = ts || 0;
  const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
  setBoil(Math.floor(now / 125));
  if (view.screen === 'battle' && G) {
    if (!G.paused && !G.panelPause) {
      acc += dt * S.speed;
      let n = 0;
      while (acc > 0 && n < 6) { const s = Math.min(acc, 1 / 60); step(s); acc -= s; n++; }
      if (n === 6) acc = 0;
    }
    drawBattle(ctx, now);
    ui.hudFrame();
  } else {
    drawMenu(ctx, now, dt);
  }
}
requestAnimationFrame(loop);