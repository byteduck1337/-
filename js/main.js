import { rnd, reduced, WEAPONS, BAL } from './config.js';
import { S, saveNow, saveSoon, wipe } from './save.js';
import { audioInit, setMuted, SFX } from './audio.js';
import { $, initModals, openModal, closeModal, closeTop, openStack, toast, setModalHooks, ICON_SND_ON, ICON_SND_OFF } from './ui.js';
import { D, calc, buildStatList, refreshStats, addStat, setAddStatHook } from './stats.js';
import { renderWeaponShop } from './weapons.js';
import { boardTab, fetchWorld, renderBoard, fetchJSON, apiBase, pushLocal } from './board.js';
import { setCtx, resizeDims, setBoil, makeMotes, renderPreview, renderBattle } from './render.js';
import * as Game from './game.js';

const cv = $('game');
const ctx = cv.getContext('2d');
const pv = $('preview');
const pctx = pv.getContext('2d');

let W = innerWidth, H = innerHeight, DPR = 1, ground = 0, cx = 0;
let screen = 'hub';
let lastT = 0;
let boil = 0;

setAddStatHook((k, n) => {
  if (addStat(k, n)) {
    SFX.up();
    const g = Game.getG();
    if (g && screen === 'battle') {
      const oldMax = Game.getG().maxHp;
      calc();
      g.maxHp = D.maxHp;
      g.hp = Math.min(g.maxHp, g.hp + (D.maxHp - oldMax));
    }
    refreshStats();
  } else SFX.err();
});

function resize() {
  W = innerWidth;
  H = innerHeight;
  DPR = Math.min(2, devicePixelRatio || 1);
  cv.width = W * DPR; cv.height = H * DPR;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx = W / 2;
  ground = H - Math.max(90, H * .18);
  const r = pv.getBoundingClientRect();
  const pr = Math.min(2, devicePixelRatio || 1);
  pv.width = r.width * pr; pv.height = r.height * pr;
  pctx.setTransform(pr, 0, 0, pr, 0, 0);
  const dims = { W, H, ground, cx };
  setCtx(ctx, pctx, dims);
  resizeDims(dims);
  Game.setDims(dims);
}
addEventListener('resize', resize);

function showScreen(name) {
  screen = name;
  $('hub').classList.toggle('active', name === 'hub');
  $('battle').classList.toggle('active', name === 'battle');
  if (name === 'hub') { renderHub(); fetchWorld(); }
  resize();
}

function renderHub() {
  $('nick').value = S.nick;
  $('hubBest').textContent = S.best;
  $('hubGold').textContent = fmtN(S.gold);
  $('hubGold2').textContent = '¤' + fmtN(S.gold);
  $('hubRuns').textContent = S.runs;
  $('hubKills').textContent = fmtN(S.kills);
  refreshStats();
  renderWeaponShop();
  renderRules();
  renderBoard();
  syncSoundUI();
}

function fmtN(n) { return n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(Math.floor(n)); }

function renderRules() {
  const r = [
    `Опыт и золото с убийств <b>растут с каждой волной</b>. Босс каждые 5 волн: ×22 опыта, ×30 золота.`,
    `За уровень: <b>+${BAL.ptsPerLevel} очка статов</b>, +4% урона и HP. Уровень, статы, оружие и золото <b>сохраняются между забегами</b>.`,
    `Лимит на стат: <b>3 + ⌊0.8 × уровень⌋</b> (сейчас ${D.cap}). Собирай билд, а не качай всё в одно.`,
    `Сброс статов: <b>¤${BAL.respecCost(S.level)}</b> и только в штабе.`,
    `Рекорд: <b>1 отправка на забег</b>. Воркер проверяет правдоподобие и лимитирует по IP.`,
    `Арсенал: у каждого оружия свой <b>урон / темп / дальность / отброс</b>. Куплено — навсегда.`,
  ];
  $('rulesList').innerHTML = r.map(x => `<li>${x}</li>`).join('');
}

setModalHooks(
  () => {
    if (screen === 'battle') {
      const g = Game.getG();
      if (g && (g.phase === 'wave' || g.phase === 'inter')) {
        g.panelPause = true;
        $('pauseChip').classList.remove('hidden');
      }
    }
  },
  () => {
    if (!openStack.length) {
      const g = Game.getG();
      if (g) g.panelPause = false;
      $('pauseChip').classList.add('hidden');
    }
  }
);

initModals();
buildStatList($('statList'));
buildStatList($('mStatList'));
makeMotes();
resize();
renderHub();
syncSoundUI();
refreshStats();

function syncSoundUI() {
  const html = S.sound ? ICON_SND_ON : ICON_SND_OFF;
  $('btnMuteHub').innerHTML = html;
  $('btnMute').innerHTML = html;
  $('btnMuteHub').style.color = S.sound ? '' : 'var(--red)';
  $('btnMute').style.color = S.sound ? '' : 'var(--red)';
}

$('btnMuteHub').addEventListener('click', () => { audioInit(); setMuted(S.sound); syncSoundUI(); saveSoon(); });
$('btnMute').addEventListener('click', () => { audioInit(); setMuted(S.sound); syncSoundUI(); saveSoon(); });
$('btnSettingsHub').addEventListener('click', () => openSettings());
$('nick').addEventListener('change', e => {
  let v = e.target.value.trim().replace(/\s+/g, ' ');
  if (!/^[A-Za-zА-Яа-яЁё0-9_\- ]{3,16}$/.test(v)) {
    toast('Позывной: 3–16 символов', 'red');
    e.target.value = S.nick;
    SFX.err();
    return;
  }
  S.nick = v.toUpperCase();
  e.target.value = S.nick;
  saveSoon();
  renderBoard();
});

$('btnStart').addEventListener('click', () => {
  audioInit();
  Game.startRun();
  showScreen('battle');
  $('lowhp').classList.remove('on');
});

$('btnAgain').addEventListener('click', () => {
  SFX.click();
  closeModal($('summary'));
  Game.startRun();
  showScreen('battle');
});

$('btnToHub').addEventListener('click', () => {
  SFX.click();
  closeModal($('summary'));
  showScreen('hub');
});

$('hubPts').addEventListener('click', () => {
  SFX.click();
  openModal($('statsModal'));
  refreshStats();
});

$('ptsBadge').addEventListener('click', () => {
  SFX.click();
  openModal($('statsModal'));
  refreshStats();
});

$('btnRespec').addEventListener('click', () => {
  const cost = BAL.respecCost(S.level);
  if (S.gold < cost) { toast('Не хватает золота', 'red'); SFX.err(); return; }
  S.gold -= cost;
  S.pts += Object.values(S.stats).reduce((a, b) => a + b, 0);
  for (const k in S.stats) S.stats[k] = 0;
  calc();
  SFX.build();
  toast('Статы сброшены', 'gold');
  renderHub();
  saveSoon();
});

$('btnPause').addEventListener('click', () => {
  const g = Game.getG();
  if (g) Game.userPause(!g.paused);
});
$('btnResume').addEventListener('click', () => Game.userPause(false));
$('btnAbandon').addEventListener('click', () => { Game.userPause(false); Game.endRun('retreat'); });
$('btnNext').addEventListener('click', () => {
  const g = Game.getG();
  if (g && g.phase === 'inter') { g.interT = 0; SFX.click(); }
});
$('btnAb1').addEventListener('click', () => Game.whirl());
$('btnAb2').addEventListener('click', () => Game.rage());
$('btnSpeed').addEventListener('click', () => setSpeed(S.speed === 1 ? 2 : 1));

$('tcard0').addEventListener('click', () => Game.openPop(0));
$('tcard1').addEventListener('click', () => Game.openPop(1));
$('tcard0').addEventListener('mouseenter', () => { const g = Game.getG(); if (g) g.hoverTower = 0; });
$('tcard1').addEventListener('mouseenter', () => { const g = Game.getG(); if (g) g.hoverTower = 1; });
$('tcard0').addEventListener('mouseleave', () => { const g = Game.getG(); if (g) g.hoverTower = -1; });
$('tcard1').addEventListener('mouseleave', () => { const g = Game.getG(); if (g) g.hoverTower = -1; });
$('towerPop').addEventListener('click', e => {
  Game.handlePopClick(e);
});
document.addEventListener('pointerdown', e => {
  if (Game.getPopSlot() >= 0 && !e.target.closest('#towerPop') && !e.target.closest('.tcard')) Game.closePop();
});

function openSettings() {
  SFX.click();
  $('setSound').classList.toggle('on', S.sound);
  $('setShake').classList.toggle('on', S.shake);
  $('setGrain').classList.toggle('on', S.grain);
  $('setQuality').value = S.quality;
  document.querySelectorAll('#setSpeed button').forEach(b => b.classList.toggle('on', +b.dataset.speed === S.speed));
  $('apiInput').value = S.api || '';
  $('apiStatus').textContent = apiBase() ? '' : 'локальный режим';
  $('apiStatus').className = '';
  openModal($('settingsModal'));
}
$('setSound').addEventListener('click', () => { audioInit(); setMuted(S.sound); $('setSound').classList.toggle('on', S.sound); syncSoundUI(); });
$('setShake').addEventListener('click', () => { S.shake = !S.shake; $('setShake').classList.toggle('on', S.shake); SFX.click(); saveSoon(); });
$('setGrain').addEventListener('click', () => { S.grain = !S.grain; $('setGrain').classList.toggle('on', S.grain); $('grain').style.display = S.grain ? '' : 'none'; SFX.click(); saveSoon(); });
$('setQuality').addEventListener('change', e => { S.quality = e.target.value; SFX.click(); saveSoon(); makeMotes(); });
document.querySelectorAll('#setSpeed button').forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));

function setSpeed(v) {
  S.speed = v;
  $('btnSpeed').textContent = v + '×';
  document.querySelectorAll('#setSpeed button').forEach(b => b.classList.toggle('on', +b.dataset.speed === v));
  SFX.click();
  saveSoon();
}

$('btnApi').addEventListener('click', async () => {
  const v = $('apiInput').value.trim().replace(/\/+$/, '');
  S.api = v;
  saveSoon();
  if (!v) {
    $('apiStatus').textContent = 'локальный режим';
    $('apiStatus').className = '';
    return;
  }
  $('apiStatus').textContent = 'проверяю…';
  $('apiStatus').className = '';
  try {
    const r = await fetchJSON(v + '/api/stats');
    if (r.ok && r.data && r.data.ok) {
      $('apiStatus').textContent = `✓ ${r.data.players} бойцов · рекорд волна ${r.data.top}`;
      $('apiStatus').className = 'ok';
      SFX.up();
      fetchWorld();
    } else {
      $('apiStatus').textContent = '✗ ошибка ' + (r.status || '');
      $('apiStatus').className = 'err';
      SFX.err();
    }
  } catch (e) {
    $('apiStatus').textContent = '✗ не удалось соединиться';
    $('apiStatus').className = 'err';
    SFX.err();
  }
});

let wipeArm = false;
$('btnWipe').addEventListener('click', () => {
  if (!wipeArm) {
    wipeArm = true;
    $('btnWipe').textContent = 'ТОЧНО?';
    setTimeout(() => { wipeArm = false; $('btnWipe').textContent = 'СТЕРЕТЬ'; }, 3000);
    return;
  }
  wipe();
});

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  SFX.click();
  import('./board.js').then(m => {
    const mod = m;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
  });
  const url = t.dataset.tab;
  if (url === 'world') { renderBoard(); fetchWorld(); }
  else { renderBoard(); }
}));

$('btnBoardRefresh').addEventListener('click', () => {
  SFX.click();
  fetchWorld();
});

$('btnSubmit').addEventListener('click', async () => {
  const g = Game.getG();
  if (!g || g.submitted) return;
  let nick = $('sumNick').value.trim().replace(/\s+/g, ' ').toUpperCase();
  if (!/^[A-Za-zА-Яа-яЁё0-9_\- ]{3,16}$/.test(nick)) {
    $('submitStatus').textContent = 'позывной 3–16 символов';
    $('submitStatus').className = 'err';
    SFX.err();
    return;
  }
  S.nick = nick;
  $('nick').value = nick;
  saveSoon();
  const btn = $('btnSubmit'), st = $('submitStatus');
  btn.disabled = true;
  btn.textContent = 'ОТПРАВКА…';
  st.textContent = '';
  st.className = '';
  try {
    const r = await fetchJSON(apiBase() + '/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nick, wave: g.wave, kills: g.kills, level: S.level, time: Math.floor(g.t), runId: g.runId }),
    });
    if (r.ok && r.data && r.data.ok) {
      g.submitted = true;
      btn.textContent = 'ПРИНЯТО ✓';
      st.textContent = r.data.kept ? 'сервер оставил твой лучший результат' : '✓ рекорд в мировой таблице';
      st.className = 'ok';
      SFX.up();
      setTimeout(fetchWorld, 600);
    } else {
      btn.disabled = false;
      btn.textContent = 'ПОВТОРИТЬ';
      st.textContent = '✗ ' + ((r.data && r.data.error) || ('ошибка ' + r.status));
      st.className = 'err';
      SFX.err();
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'ПОВТОРИТЬ';
    st.textContent = '✗ воркер недоступен';
    st.className = 'err';
    SFX.err();
  }
});

document.addEventListener('keydown', e => {
  if (e.repeat) return;
  const g = Game.getG();
  if (e.code === 'Space') {
    e.preventDefault();
    if (screen === 'battle') Game.whirl();
  }
  if (e.code === 'KeyE' && screen === 'battle') Game.rage();
  if (e.code === 'KeyN' && screen === 'battle' && g && g.phase === 'inter') g.interT = 0;
  if (e.code === 'KeyC' && screen === 'battle') {
    openModal($('statsModal'));
    refreshStats();
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (openStack.length) { closeTop(); return; }
    if (screen === 'battle' && g) Game.userPause(!g.paused);
  }
  if (e.code === 'KeyM') { audioInit(); setMuted(S.sound); syncSoundUI(); }
  if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code) && screen === 'battle') {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('game-key', { detail: { code: e.code, down: true } }));
  }
});

document.addEventListener('keyup', e => {
  if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
    document.dispatchEvent(new CustomEvent('game-key', { detail: { code: e.code, down: false } }));
  }
});

document.addEventListener('visibilitychange', () => {
  const g = Game.getG();
  if (document.hidden && g && screen === 'battle' && (g.phase === 'wave' || g.phase === 'inter')) Game.userPause(true);
});

cv.addEventListener('pointerdown', e => {
  const g = Game.getG();
  if (!g || g.phase === 'over' || g.phase === 'dying') return;
  g.dragX = e.clientX;
});
addEventListener('pointermove', e => {
  const g = Game.getG();
  if (g && g.dragX !== null) g.dragX = e.clientX;
});
addEventListener('pointerup', () => {
  const g = Game.getG();
  if (g) g.dragX = null;
});

const keys = new Set();
document.addEventListener('game-key', e => {
  const { code, down } = e.detail;
  if (down) keys.add(code); else keys.delete(code);
  Game.setKeys(keys);
});

function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (t - lastT) / 1000 || 0);
  lastT = t;
  boil += dt * 14;
  setBoil(boil);
  if (screen === 'hub') {
    renderPreview(t);
  } else if (screen === 'battle') {
    const g = Game.getG();
    if (!g) return;
    if (!g.paused && !g.panelPause) {
      const speed = S.speed;
      const sub = Math.min(4, Math.ceil(speed));
      const stepDt = dt * speed / sub;
      for (let i = 0; i < sub; i++) Game.step(stepDt);
    }
    renderBattle(g, () => t);
    Game.updateHud();
  }
}
requestAnimationFrame(frame);