import { S, D, calc, gainGold, addStat, respec, buyWeapon, upgradeWeapon, equipWeapon, saveSoon, saveNow } from './state.js';
import { BAL, STATS, WEAPONS, WEAPON_ORDER, W_MAX, wUpCost, TOWERS, tUpCost, ENEMIES } from './config.js';
import { on, emit } from './events.js';
import { view } from './view.js';
import { G, startRun, endRun, pause, panelPause, buildTower, upgradeTower, sellTower, towerDmg, towerRate, whirl, rage } from './game.js';
import { play, setMuted, init as audioInit, weaponSound } from './audio.js';
import { fetchWorld, submit, recordLocal, apiBase, world, worldMeta, status, checkApi } from './net.js';
import { fmtN, fmtT, esc, NICK_RE, clamp } from './utils.js';

const $ = id => document.getElementById(id);
const SND_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SND_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';

let sheetName = null, boardTab = 'world', popSlot = -1, menuIdx = 0, lastSummary = null;
const MENU = [
  { id: 'fight', t: 'В БОЙ', s: () => `волна 1 · рекорд ${S.best}` },
  { id: 'arsenal', t: 'АРСЕНАЛ', s: () => `${WEAPONS[S.weapon].name}${D.wLvl ? ' ур.' + D.wLvl : ''} · ножи, биты, катаны` },
  { id: 'stats', t: 'ПРОКАЧКА', s: () => S.pts ? `+${S.pts} очка ждут` : `уровень ${S.level} · лимит ${D.cap}` },
  { id: 'records', t: 'РЕКОРДЫ', s: () => apiBase() ? 'мировая таблица · воркер' : 'локально · воркер не подключён' },
  { id: 'settings', t: 'НАСТРОЙКИ', s: () => 'звук · скорость · зерно · api' },
];

export function init() {
  buildMenu();
  $('sheetClose').addEventListener('click', () => { play('click'); closeSheet(); });
  $('mSound').addEventListener('click', () => { audioInit(); setMuted(S.sound); syncSound(); saveSoon(); });
  $('btnSound').addEventListener('click', () => { audioInit(); setMuted(S.sound); syncSound(); saveSoon(); });
  $('btnPause').addEventListener('click', () => { play('click'); pause(!G.paused); });
  $('btnResume').addEventListener('click', () => { play('click'); pause(false); });
  $('btnAbandon').addEventListener('click', () => { play('click'); pause(false); endRun('retreat'); });
  $('btnSpeed').addEventListener('click', () => setSpeed(S.speed === 1 ? 2 : 1));
  $('btnNext').addEventListener('click', () => { if (G?.phase === 'inter') { G.interT = 0; play('click'); } });
  $('ptsBtn').addEventListener('click', () => openSheet('stats'));
  $('ab1').addEventListener('click', whirl);
  $('ab2').addEventListener('click', rage);
  $('post0').addEventListener('click', () => openPop(0));
  $('post1').addEventListener('click', () => openPop(1));
  $('post0').addEventListener('mouseenter', () => { if (G) G.hoverTower = 0; });
  $('post1').addEventListener('mouseenter', () => { if (G) G.hoverTower = 1; });
  $('post0').addEventListener('mouseleave', () => { if (G) G.hoverTower = -1; });
  $('post1').addEventListener('mouseleave', () => { if (G) G.hoverTower = -1; });
  $('pop').addEventListener('click', onPopClick);
  document.addEventListener('pointerdown', e => {
    if (popSlot >= 0 && !e.target.closest('#pop') && !e.target.closest('.post')) closePop();
  });
  $('btnAgain').addEventListener('click', () => { play('click'); $('summary').classList.add('hidden'); startRun(); });
  $('btnMenu').addEventListener('click', () => { play('click'); $('summary').classList.add('hidden'); emit('screen', 'menu'); });
  $('btnSubmit').addEventListener('click', onSubmit);

  on('nav', d => { menuIdx = (menuIdx + d + MENU.length) % MENU.length; play('click'); renderMenuSel(); });
  on('navEnter', () => activate(MENU[menuIdx].id));
  on('key', k => {
    if (k === 'mute') { audioInit(); setMuted(S.sound); syncSound(); saveSoon(); }
    else if (k === 'pause' && view.screen === 'battle') pause(!G.paused);
    else if (k === 'stats') openSheet('stats');
    else if (k === 'escape') {
      if (popSlot >= 0) closePop();
      else if (sheetName) closeSheet();
      else if (view.screen === 'battle' && G && !G.over) pause(!G.paused);
    }
  });
  on('pause', on => { $('pauseVeil').classList.toggle('hidden', !on); $('btnPause').textContent = on ? '▶' : '⏸'; });
  on('panelPause', on => { /* чип не нужен: лист сам показывает паузу */ });
  on('banner', banner);
  on('toast', toast);
  on('gold', () => { refreshGold(); if (sheetName === 'arsenal') renderSheet(); if (popSlot >= 0) renderPop(popSlot); renderPosts(); });
  on('xp', refreshXp);
  on('level', () => { refreshXp(); refreshMenuMeta(); });
  on('stats', () => { refreshMenuMeta(); if (sheetName === 'stats') renderSheet(); });
  on('weapon', () => { refreshMenuMeta(); refreshWeaponHud(); if (sheetName === 'arsenal') renderSheet(); });
  on('towers', renderPosts);
  on('run:start', () => { $('pauseVeil').classList.add('hidden'); $('btnPause').textContent = '⏸'; renderPosts(); refreshWeaponHud(); refreshGold(); $('killVal').textContent = '0'; });
  on('run:end', showSummary);
  on('wave:inter', n => { $('btnNext').classList.remove('hidden'); $('btnNext').textContent = `ВОЛНА ${n} ▶`; });
  on('boss', e => { $('bossWrap').classList.toggle('hidden', !e); if (e) $('bossName').textContent = 'КОЛОСС · ВОЛНА ' + G.wave; });
  on('board', () => { if (sheetName === 'records') renderSheet(); refreshMenuMeta(); });
  on('screen', name => { if (name === 'menu') { closeSheet(); closePop(); refreshMenuMeta(); fetchWorld(); } });

  syncSound(); setSpeed(S.speed, true);
  $('grain').style.display = S.grain ? '' : 'none';
  refreshMenuMeta(); refreshGold(); refreshXp();
  fetchWorld();
}

/* ---- меню ---- */
function buildMenu() {
  const nav = $('mNav');
  nav.innerHTML = '';
  MENU.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'm-item'; b.innerHTML = `<span class="t">${m.t}</span><span class="s"></span>`;
    b.addEventListener('mouseenter', () => { menuIdx = i; renderMenuSel(); });
    b.addEventListener('click', () => { play('click'); activate(m.id); });
    nav.appendChild(b);
  });
  renderMenuSel();
}
function renderMenuSel() {
  [...$('mNav').children].forEach((el, i) => {
    el.classList.toggle('sel', i === menuIdx);
    el.querySelector('.s').textContent = MENU[i].s();
  });
}
function activate(id) {
  if (id === 'fight') { emit('screen', 'battle'); startRun(); }
  else openSheet(id);
}
function refreshMenuMeta() {
  $('mGold').textContent = '¤ ' + fmtN(S.gold);
  $('mLvl').textContent = 'УР. ' + S.level;
  const st = S.stats;
  $('mStats').innerHTML =
    `<b>${WEAPONS[S.weapon].name}</b>${D.wLvl ? ' ур.' + D.wLvl : ''} · СИЛ ${st.str} · ЛОВ ${st.agi} · СТК ${st.vit} · ТЧН ${st.pre} · ИНЖ ${st.eng} · УДЧ ${st.lck}` +
    (S.pts ? `<br><span class="pts">+${S.pts} ОЧКА НЕ РАСПРЕДЕЛЕНЫ — ПРОКАЧКА</span>` : '') +
    `<br>забегов ${S.runs} · убийств ${fmtN(S.kills)} · лучшая волна <b>${S.best}</b>`;
  renderMenuSel();
}
function refreshGold() {
  $('mGold').textContent = '¤ ' + fmtN(S.gold);
  $('goldVal').textContent = fmtN(S.gold);
  const gw = $('goldVal').parentElement;
  gw.classList.remove('pulse'); void gw.offsetWidth; gw.classList.add('pulse');
}
function refreshXp() {
  const need = BAL.xpNeed(S.level), pct = clamp(S.xp / need * 100, 0, 100);
  $('xpFill').style.width = pct + '%';
  $('xpText').textContent = `${Math.floor(S.xp)} / ${need} XP`;
  $('lvlNum').textContent = S.level;
  $('ptsBtn').classList.toggle('hidden', S.pts <= 0);
  $('ptsBtn').textContent = '+' + S.pts;
}
function refreshWeaponHud() {
  $('wName').textContent = WEAPONS[S.weapon].name + (D.wLvl ? ' · УР.' + D.wLvl : '');
}
function syncSound() {
  const html = S.sound ? SND_ON : SND_OFF;
  $('mSound').innerHTML = html; $('btnSound').innerHTML = html;
  $('mSound').style.color = S.sound ? '' : 'var(--red)';
  $('btnSound').style.color = S.sound ? '' : 'var(--red)';
}
function setSpeed(v, silent) {
  S.speed = v; $('btnSpeed').textContent = v + '×';
  if (!silent) { play('click'); saveSoon(); }
  if (sheetName === 'settings') renderSheet();
}

/* ---- лист ---- */
export function openSheet(name) {
  sheetName = name; play('click');
  $('sheet').classList.remove('hidden');
  renderSheet();
  if (view.screen === 'battle' && G && !G.over) panelPause(true);
}
export function closeSheet() {
  if (!sheetName) return;
  sheetName = null; $('sheet').classList.add('hidden');
  if (view.screen === 'battle') panelPause(false);
}
function renderSheet() {
  const b = $('sheetBody');
  if (sheetName === 'arsenal') b.innerHTML = arsenalHTML();
  else if (sheetName === 'stats') b.innerHTML = statsHTML();
  else if (sheetName === 'records') b.innerHTML = recordsHTML();
  else if (sheetName === 'settings') b.innerHTML = settingsHTML();
  bindSheet();
}
function tierPips(lvl) { return `<span class="tier">${Array.from({ length: W_MAX }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span>`; }
function arsenalHTML() {
  let h = `<h3>АРСЕНАЛ</h3><div class="sub">оружие остаётся с тобой между забегами. купи — и оно сразу в руке.</div>`;
  for (const id of WEAPON_ORDER) {
    const w = WEAPONS[id], rec = S.weapons[id], own = !!rec?.own, eq = S.weapon === id;
    const dmg = (10 * w.dmg * (1 + .2 * (rec?.lvl || 0))).toFixed(0);
    const feat = w.shock ? 'ударная волна' : w.steal ? 'вампиризм 5%' : w.pierce >= 99 ? 'игнорирует броню' : w.pierce ? `пробой ${w.pierce}` : w.kind === 'jab' ? 'быстрый тычок' : 'широкая дуга';
    h += `<div class="srow wrow">
      <div class="head"><span class="name ${eq ? 'eq' : ''}">${w.name}${own ? tierPips(rec.lvl) : ''}</span>
      <span class="gold">${own ? (eq ? 'В РУКАХ' : 'КУПЛЕНО') : '¤' + w.cost}</span></div>
      <div class="flavor">${w.flavor}</div>
      <div class="nums">урон <b>~${dmg}</b> · темп <b>${w.rate}/с</b> · дальность <b>${w.range}</b> · ${feat}</div>
      <div class="acts">
        ${!own ? `<button class="ibtn small ${S.gold >= w.cost ? 'fill' : ''}" data-buy="${id}" ${S.gold >= w.cost ? '' : 'disabled'}>КУПИТЬ ¤${w.cost}</button>` : ''}
        ${own && !eq ? `<button class="ibtn small" data-equip="${id}">ВЗЯТЬ</button>` : ''}
        ${own && rec.lvl < W_MAX ? `<button class="ibtn small" data-upw="${id}" ${S.gold >= wUpCost(id, rec.lvl) ? '' : 'disabled'}>УЛУЧШИТЬ ¤${wUpCost(id, rec.lvl)}</button>` : ''}
        ${own && rec.lvl >= W_MAX ? `<span class="dim" style="font-size:9px;letter-spacing:.14em">МАКСИМУМ</span>` : ''}
      </div></div>`;
  }
  h += `<div class="srow"><div class="nums" style="margin-bottom:8px"><b>БАШНИ</b> — строятся в бою кликом по посту:</div>`;
  for (const k in TOWERS) { const t = TOWERS[k]; h += `<div class="nums">¤${t.cost} · <b>${t.name}</b> — ${t.desc}</div>`; }
  h += `</div><div class="hintline">улучшение оружия: +20% урона, +4% темпа за уровень.<br>с 2 ур. — зелёная кромка, с 4 — двойной след, с 5 — искры.</div>`;
  return h;
}
function statsHTML() {
  let h = `<h3>ПРОКАЧКА</h3><div class="sub">очки не сгорают. смерть — просто повод вернуться сильнее.</div>
    <div class="ptsline">СВОБОДНО <b>${S.pts}</b> ОЧКОВ · УР. ${S.level}</div>
    <div class="bar sk xpline"><i class="xp" style="width:${clamp(S.xp / BAL.xpNeed(S.level) * 100, 0, 100)}%"></i></div>`;
  for (const d of STATS) {
    const v = S.stats[d.k], can = S.pts > 0 && v < D.cap;
    h += `<div class="srow statrow"><div><div class="n">${d.n}</div><div class="e">${d.eff(v)}</div></div>
      <div class="v">${v}<small>/ ${D.cap}</small></div>
      <button class="plus" data-stat="${d.k}" ${can ? '' : 'disabled'}>+</button></div>`;
  }
  const total = Object.values(S.stats).reduce((a, b) => a + b, 0);
  h += `<div class="srow"><button class="ibtn small red" id="respecBtn" ${total && S.gold >= BAL.respecCost(S.level) ? '' : 'disabled'}>СБРОС СТАТОВ · ¤${BAL.respecCost(S.level)}</button></div>
    <div class="hintline">SHIFT+КЛИК = +5 · лимит на стат растёт с уровнем.<br>сброс — только здесь, за золото. башни каждый забег строятся заново.</div>`;
  return h;
}
function recordsHTML() {
  let h = `<h3>РЕКОРДЫ</h3><div class="sub">лучший забег на позывной. одна отправка на забег.</div>
    <div class="nickrow"><label>ПОЗЫВНОЙ</label><div class="apirow"><input id="nickInput" maxlength="16" value="${esc(S.nick)}" spellcheck="false"></div></div>
    <div class="tabs"><button class="tab ${boardTab === 'world' ? 'on' : ''}" data-tab="world">МИР</button><button class="tab ${boardTab === 'local' ? 'on' : ''}" data-tab="local">ЛОКАЛЬНО</button><button class="ibtn small" id="boardRefresh">↻</button></div>`;
  if (boardTab === 'local') {
    h += S.board.length ? S.board.map((e, i) => brow(e, i)).join('') : `<div class="empty">пока пусто. первый забег ждёт.</div>`;
  } else if (!apiBase()) {
    h += `<div class="empty">мировая таблица живёт на cloudflare worker.<br>задеплой worker.js и вставь адрес в настройках.<br><button class="ibtn small" id="goSettings" style="margin-top:10px">НАСТРОЙКИ</button></div>`;
  } else if (status === 'load') {
    h += `<div class="empty">загрузка…</div>`;
  } else if (!world) {
    h += `<div class="empty">сервер не ответил. проверь адрес и связь.</div>`;
  } else {
    h += `<div class="hintline" style="margin:0 0 8px">${worldMeta?.total ?? world.length} бойцов · рекорд волна ${worldMeta?.top ?? 0}</div>`;
    h += world.length ? world.map((e, i) => brow(e, i)).join('') : `<div class="empty">таблица пуста. стань первым.</div>`;
  }
  return h;
}
function brow(e, i) {
  const me = e.nick?.toUpperCase() === S.nick.toUpperCase();
  return `<div class="brow r${i + 1} ${me ? 'me' : ''}"><span class="rk">${String(i + 1).padStart(2, '0')}</span>
    <span class="nk">${esc(e.nick)}<small>ур.${e.level | 0} · ✕${fmtN(e.kills | 0)} · ${fmtT(e.time | 0)}</small></span>
    <span class="wv">${e.wave | 0}</span></div>`;
}
function settingsHTML() {
  return `<h3>НАСТРОЙКИ</h3><div class="sub">всё применяется сразу.</div>
    <div class="setrow"><span>ЗВУК<small>M · синтез в реальном времени</small></span><button class="sw ${S.sound ? 'on' : ''}" id="setSound"></button></div>
    <div class="setrow"><span>СКОРОСТЬ</span><div class="seg"><button data-speed="1" class="${S.speed === 1 ? 'on' : ''}">1×</button><button data-speed="2" class="${S.speed === 2 ? 'on' : ''}">2×</button></div></div>
    <div class="setrow"><span>ТРЯСКА</span><button class="sw ${S.shake ? 'on' : ''}" id="setShake"></button></div>
    <div class="setrow"><span>ЗЕРНО</span><button class="sw ${S.grain ? 'on' : ''}" id="setGrain"></button></div>
    <div class="setrow"><span>ЧАСТИЦЫ</span><div class="seg">${['high', 'med', 'low'].map(q => `<button data-q="${q}" class="${S.quality === q ? 'on' : ''}">${{ high: 'ПОЛН', med: 'СРЕД', low: 'МИН' }[q]}</button>`).join('')}</div></div>
    <div class="setrow" style="display:block"><span>CLOUDFLARE WORKER<small>адрес api лидборда · пусто = локально</small></span>
      <div class="apirow"><input id="apiInput" value="${esc(S.api || '')}" placeholder="https://cherta-lb.имя.workers.dev" spellcheck="false"><button class="ibtn small" id="apiCheck">ПРОВЕРИТЬ</button></div>
      <div id="apiStatus"></div></div>
    <div class="setrow"><span class="red">СТЕРЕТЬ СОХРАНЕНИЕ<small>уровень, оружие, золото, рекорды</small></span><button class="ibtn small red" id="wipeBtn">СТЕРЕТЬ</button></div>`;
}
function bindSheet() {
  const b = $('sheetBody');
  b.querySelectorAll('[data-buy]').forEach(el => el.addEventListener('click', () => { if (buyWeapon(el.dataset.buy)) { play('up'); emit('menu:swing'); } else play('err'); }));
  b.querySelectorAll('[data-equip]').forEach(el => el.addEventListener('click', () => { if (equipWeapon(el.dataset.equip)) { play('click'); emit('menu:swing'); } }));
  b.querySelectorAll('[data-upw]').forEach(el => el.addEventListener('click', () => { if (upgradeWeapon(el.dataset.upw)) play('up'); else play('err'); }));
  b.querySelectorAll('[data-stat]').forEach(el => el.addEventListener('click', e => { if (addStat(el.dataset.stat, e.shiftKey ? 5 : 1)) play('up'); else play('err'); }));
  const rs = b.querySelector('#respecBtn');
  if (rs) rs.addEventListener('click', () => { if (respec()) { play('build'); toast('Статы сброшены. Очки возвращены.', 'gold'); } else play('err'); });
  b.querySelectorAll('[data-tab]').forEach(el => el.addEventListener('click', () => { boardTab = el.dataset.tab; play('click'); renderSheet(); if (boardTab === 'world') fetchWorld(); }));
  const rf = b.querySelector('#boardRefresh');
  if (rf) rf.addEventListener('click', () => { play('click'); boardTab === 'world' ? fetchWorld() : renderSheet(); });
  const gs = b.querySelector('#goSettings');
  if (gs) gs.addEventListener('click', () => openSheet('settings'));
  const ni = b.querySelector('#nickInput');
  if (ni) ni.addEventListener('change', () => {
    const v = ni.value.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!NICK_RE.test(v)) { toast('Позывной: 3–16 символов.', 'red'); ni.value = S.nick; play('err'); return; }
    S.nick = v; ni.value = v; saveSoon(); play('click');
  });
  const ss = b.querySelector('#setSound');
  if (ss) ss.addEventListener('click', () => { audioInit(); setMuted(S.sound); syncSound(); saveSoon(); renderSheet(); });
  b.querySelectorAll('[data-speed]').forEach(el => el.addEventListener('click', () => setSpeed(+el.dataset.speed)));
  const sh = b.querySelector('#setShake');
  if (sh) sh.addEventListener('click', () => { S.shake = !S.shake; saveSoon(); play('click'); renderSheet(); });
  const gr = b.querySelector('#setGrain');
  if (gr) gr.addEventListener('click', () => { S.grain = !S.grain; $('grain').style.display = S.grain ? '' : 'none'; saveSoon(); play('click'); renderSheet(); });
  b.querySelectorAll('[data-q]').forEach(el => el.addEventListener('click', () => { S.quality = el.dataset.q; saveSoon(); emit('quality'); play('click'); renderSheet(); }));
  const ac = b.querySelector('#apiCheck');
  if (ac) ac.addEventListener('click', async () => {
    const v = b.querySelector('#apiInput').value.trim().replace(/\/+$/, '');
    S.api = v; saveSoon();
    const st = b.querySelector('#apiStatus');
    if (!v) { st.textContent = 'локальный режим'; st.className = ''; fetchWorld(); return; }
    st.textContent = 'проверяю…'; st.className = '';
    try { const d = await checkApi(v); st.textContent = `✓ связь · ${d.players} бойцов · рекорд ${d.top}`; st.className = 'ok'; play('up'); fetchWorld(); }
    catch (e) { st.textContent = '✗ не удалось соединиться'; st.className = 'err'; play('err'); }
  });
  const wp = b.querySelector('#wipeBtn');
  if (wp) {
    let arm = false;
    wp.addEventListener('click', () => {
      if (!arm) { arm = true; wp.textContent = 'ТОЧНО?'; setTimeout(() => { arm = false; wp.textContent = 'СТЕРЕТЬ'; }, 3000); return; }
      localStorage.removeItem('cherta_save_v2'); localStorage.removeItem('cherta_save_v1'); location.reload();
    });
  }
}

/* ---- поп башни ---- */
function openPop(i) {
  if (popSlot === i) { closePop(); return; }
  popSlot = i; play('click'); renderPop(i);
  $('pop').classList.remove('hidden');
  const r = $('post' + i).getBoundingClientRect();
  $('pop').style.left = clamp(r.left + r.width / 2 - 131, 8, innerWidth - 270) + 'px';
  $('pop').style.bottom = innerHeight - r.top + 10 + 'px';
  $('pop').style.top = 'auto';
  if (G && !G.over) panelPause(true);
}
function closePop() {
  if (popSlot < 0) return;
  popSlot = -1; $('pop').classList.add('hidden');
  if (!sheetName && G) panelPause(false);
}
function renderPop(i) {
  const t = G?.towers[i];
  let h = `<h4>ПОСТ ${i + 1} ${t ? `<i>${TOWERS[t.type].name} УР.${t.lvl}</i>` : '<i>СВОБОДЕН</i>'}</h4>`;
  if (!t) {
    h += `<div class="ps">инженерия усиливает все башни.</div>`;
    for (const k in TOWERS) {
      const tw = TOWERS[k];
      h += `<button class="topt" data-act="build" data-type="${k}" ${S.gold >= tw.cost ? '' : 'disabled'}><b>${tw.name}</b><span class="cost">¤${tw.cost}</span><small>${tw.desc} · ${tw.dmg}×${tw.rate}/с</small></button>`;
    }
  } else {
    const cost = tUpCost(t.type, t.lvl), refund = Math.floor(t.spent * .5);
    h += `<div class="ps">${TOWERS[t.type].desc}<br>урон ${towerDmg(t).toFixed(1)} · темп ${towerRate(t).toFixed(2)}/с · <span class="acc">${Math.round(towerDmg(t) * towerRate(t))} DPS</span><br>след. ур.: +32% урона, +6% темпа, новый силуэт</div>
      <button class="topt" data-act="up" ${S.gold >= cost ? '' : 'disabled'}><b>УЛУЧШИТЬ → УР.${t.lvl + 1}</b><span class="cost">¤${cost}</span></button>
      <button class="topt" data-act="sell"><b class="red">СНЕСТИ</b><span class="cost">+¤${refund}</span></button>`;
  }
  $('pop').innerHTML = h;
}
function onPopClick(e) {
  const b = e.target.closest('[data-act]'); if (!b || popSlot < 0) return;
  const act = b.dataset.act;
  if (act === 'build') buildTower(popSlot, b.dataset.type);
  else if (act === 'up') upgradeTower(popSlot);
  else if (act === 'sell') sellTower(popSlot);
  renderPosts(); if (popSlot >= 0) renderPop(popSlot);
}
function renderPosts() {
  for (let i = 0; i < 2; i++) {
    const t = G?.towers[i], el = $('post' + i);
    if (!t) { el.className = 'post sk empty'; el.innerHTML = `<b>ПОСТ ${i + 1} +</b>построить башню`; }
    else {
      el.className = 'post sk';
      el.innerHTML = `<b>${TOWERS[t.type].name} · ${t.lvl}</b>${Math.round(towerDmg(t) * towerRate(t))} DPS${S.gold >= tUpCost(t.type, t.lvl) ? '<span class="up">↑</span>' : ''}`;
    }
  }
}

/* ---- баннер / тосты / итоги ---- */
let bannerTimer = null;
function banner(t, s, cls) {
  const b = $('banner'); $('bannerT').textContent = t; $('bannerS').textContent = s || '';
  b.className = cls || ''; void b.offsetWidth; b.classList.add('slam');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.add('hidden'), 1900);
}
function toast(msg, cls = '') {
  const t = document.createElement('div'); t.className = 'toast ' + cls; t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 3200);
}
function showSummary(d) {
  lastSummary = d;
  recordLocal({ nick: S.nick, wave: d.wave, kills: d.kills, level: d.level, time: d.time, date: Date.now() });
  $('sumTitle').textContent = d.reason === 'death' ? 'ЧЕРТА ПРОРВАНА' : 'ВЫЛАЗКА ЗАВЕРШЕНА';
  $('sumTitle').classList.toggle('red', d.reason === 'death');
  $('sumWave').textContent = d.wave;
  $('sumRecord').classList.toggle('hidden', !d.record);
  $('sumKills').textContent = fmtN(d.kills); $('sumTime').textContent = fmtT(d.time);
  $('sumLvl').textContent = '+' + d.lvl; $('sumGold').textContent = '+¤' + fmtN(d.gold);
  $('sumXp').textContent = '+' + fmtN(d.xp); $('sumLevel').textContent = d.level;
  $('sumNick').value = S.nick;
  const st = $('submitStatus'), btn = $('btnSubmit');
  st.textContent = ''; st.className = ''; btn.disabled = false; btn.textContent = 'ОТПРАВИТЬ РЕКОРД';
  if (!apiBase()) { btn.disabled = true; btn.textContent = 'ЛОКАЛЬНО ✓'; st.textContent = 'рекорд на устройстве · подключи воркер для мировой таблицы'; }
  $('summary').classList.remove('hidden');
  refreshMenuMeta();
}
async function onSubmit() {
  if (!lastSummary || G?.submitted) return;
  let nick = $('sumNick').value.trim().replace(/\s+/g, ' ').toUpperCase();
  if (!NICK_RE.test(nick)) { $('submitStatus').textContent = 'позывной: 3–16 символов'; $('submitStatus').className = 'err'; play('err'); return; }
  S.nick = nick; saveSoon();
  const btn = $('btnSubmit'), st = $('submitStatus');
  btn.disabled = true; btn.textContent = 'ОТПРАВКА…';
  try {
    const r = await submit({ nick, wave: lastSummary.wave, kills: lastSummary.kills, level: lastSummary.level, time: lastSummary.time, runId: lastSummary.runId });
    if (r.ok && r.data?.ok) {
      G.submitted = true; btn.textContent = 'ПРИНЯТО ✓';
      st.textContent = r.data.kept ? 'сервер оставил твой лучший результат' : '✓ рекорд в мировой таблице';
      st.className = 'ok'; play('up'); setTimeout(fetchWorld, 600);
    } else { btn.disabled = false; btn.textContent = 'ПОВТОРИТЬ'; st.textContent = '✗ ' + (r.data?.error || 'ошибка ' + r.status); st.className = 'err'; play('err'); }
  } catch (e) { btn.disabled = false; btn.textContent = 'ПОВТОРИТЬ'; st.textContent = '✗ воркер недоступен — сохранено локально'; st.className = 'err'; play('err'); }
}

/* ---- HUD каждый кадр ---- */
export function hudFrame() {
  if (!G) return;
  const hpPct = clamp(G.hp / G.maxHp * 100, 0, 100);
  $('hpFill').style.width = hpPct + '%';
  $('hpText').textContent = Math.ceil(G.hp) + ' / ' + G.maxHp;
  const low = hpPct < 30 && G.phase === 'wave';
  $('hpBar').classList.toggle('low', low);
  $('lowhp').classList.toggle('on', low);
  refreshXp();
  if (G.phase === 'wave') { $('waveNum').textContent = 'ВОЛНА ' + G.wave; $('waveSub').textContent = 'ОСТАЛОСЬ ' + (G.spawnQ.length + G.enemies.length); $('btnNext').classList.add('hidden'); }
  else if (G.phase === 'inter') { $('waveNum').textContent = G.wave ? 'ВОЛНА ' + G.wave + ' ✓' : 'ГОТОВЬСЯ'; $('waveSub').textContent = 'СЛЕДУЮЩАЯ ЧЕРЕЗ ' + Math.max(0, Math.ceil(G.interT)) + ' СЕК'; }
  else $('waveSub').textContent = G.phase === 'dying' ? 'ЧЕРТА ПРОРВАНА' : '';
  if (G.boss && !G.boss.dead) $('bossFill').style.width = clamp(G.boss.hp / G.boss.maxHp * 100, 0, 100) + '%';
  $('ab1cd').style.height = (G.ab1 / G.ab1Max * 100) + '%';
  $('ab1s').textContent = G.ab1 > 0 ? G.ab1.toFixed(1) : '';
  $('ab1').classList.toggle('ready', G.ab1 <= 0);
  const locked = S.level < 4;
  $('ab2').classList.toggle('locked', locked);
  $('ab2').classList.toggle('raging', G.rage > 0);
  $('ab2cd').style.height = (G.ab2 / G.ab2Max * 100) + '%';
  $('ab2s').textContent = locked ? 'ур.4' : G.rage > 0 ? G.rage.toFixed(1) : G.ab2 > 0 ? Math.ceil(G.ab2) : '';
  $('ab2').classList.toggle('ready', !locked && G.ab2 <= 0);
  $('killVal').textContent = fmtN(G.kills);
}
export function menuFrame() { /* подписи обновляются по событиям */ }