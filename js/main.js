import { computeView, view } from './view.js?v=8';
import { S, D } from './state.js?v=8';
import { on } from './events.js?v=8';
import { init as inputInit } from './input.js?v=8';
import { play, weaponSound, init as audioInit, resume as audioResume, setScene, duck } from './audio.js?v=8';
import { G, step, pause } from './game.js?v=8';
import { drawBattle, drawMenu, practice } from './render.js?v=8';
import { init as uiInit, hudFrame } from './ui.js?v=8';
import { initIdentity } from './net.js?v=8';
import { setBoil } from './utils.js?v=8';
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const dock = document.getElementById('dock');
let failed = false;
function resize() {
const oldCx = view.cx, oldGround = view.ground;
computeView();
const dh = dock && view.screen === 'battle' ? dock.getBoundingClientRect().height : 0;
view.dockH = dh;
view.ground = Math.max(170, view.H - dh - 30);
canvas.width = Math.max(1, Math.floor(view.W * view.DPR));
canvas.height = Math.max(1, Math.floor(view.H * view.DPR));
ctx.setTransform(view.DPR, 0, 0, view.DPR, 0, 0);
if (G && oldCx) {
const d = view.cx - oldCx;
G.player.x += d;
G.enemies.forEach(e => e.x += d);
if (oldGround !== view.ground) { G.shots = []; G.eShots = []; G.beams = []; G.zaps = []; G.parts = []; G.texts = []; G.craters = []; }
}
}
addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(dock);
on('layout', () => requestAnimationFrame(resize));
function setScreen(name) {
view.screen = name;
document.getElementById('menu').classList.toggle('hidden', name !== 'menu');
document.getElementById('battle').classList.toggle('hidden', name !== 'battle');
document.getElementById('lowhp').classList.remove('on');
setScene(name);
requestAnimationFrame(resize);
}
on('screen', setScreen);
on('menu:swing', () => { practice(); play(weaponSound(D.kind)); });
on('pause', on => duck(on));
on('panelPause', on => duck(on));
document.addEventListener('visibilitychange', () => {
if (document.hidden && view.screen === 'battle' && G && (G.phase === 'wave' || G.phase === 'inter')) pause(true);
});
/* музыка стартует с первого жеста — политика автоплея браузеров */
addEventListener('keydown', () => { audioInit(); audioResume(); }, { once: true });
uiInit();
inputInit(canvas);
resize();
setScreen('menu');
initIdentity();
window.__booted = true;
document.getElementById('boot').classList.add('hidden');
let last = 0, acc = 0;
function loop(ts) {
requestAnimationFrame(loop);
const now = ts || 0;
const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
setBoil(Math.floor(now / 125));
try {
if (view.screen === 'battle' && G) {
if (!G.paused && !G.panelPause) {
acc += dt * S.speed;
let n = 0;
while (acc > 0 && n < 6) { const s = Math.min(acc, 1 / 60); step(s); acc -= s; n++; }
if (n === 6) acc = 0;
}
drawBattle(ctx, G, now);
hudFrame(G);
} else {
acc = 0;
drawMenu(ctx, now, dt);
}
} catch (e) {
if (!failed) { failed = true; console.error(e); window.__bootFail && window.__bootFail('ошибка кадра: ' + e.message); }
}
}
requestAnimationFrame(loop);