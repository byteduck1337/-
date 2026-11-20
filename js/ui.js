import { S, D, addStat, respec, buyWeapon, upgradeWeapon, equipWeapon, saveSoon } from './state.js';
import { BAL, STATS, WEAPONS, WEAPON_ORDER, W_MAX, wUpCost, BUILDINGS, B_ORDER, bUpCost, SLOTS, ENEMIES, skipCost } from './config.js';
import { on, emit } from './events.js';
import { view } from './view.js';
import { G, endRun, pause, panelPause, buildBuilding, upgradeBuilding, sellBuilding, bDmg, bRate, whirl, rage, startRun, skipWaves } from './game.js';
import { play, setMuted, init as audioInit } from './audio.js';
import * as net from './net.js';
import { fmtN, fmtT, esc, NICK_RE, clamp } from './utils.js';

const $ = id => document.getElementById(id);
const SND_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SND_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
let sheetName = null, boardTab = 'world', popSlot = -1, menuIdx = 0, lastSummary = null;
let skipArm = { 5: false, 10: false }, skipTimers = { 5: null, 10: null };
const MENU = [
  { id: 'fight', t: 'В БОЙ', s: () => `волна 1 · рекорд ${S.best}` },
  { id: 'arsenal', t: 'АРСЕНАЛ', s: () => `${WEAPONS[S.weapon].name}${D.wLvl ? ' ур.' + D.wLvl : ''} · оружие и постройки` },
  { id: 'stats', t: 'ПРОКАЧКА', s: () => S.pts ? `+${S.pts} очка ждут` : `уровень ${S.level} · лимит ${D.cap}` },
  { id: 'records', t: 'РЕКОРДЫ', s: () => net.apiBase() ? 'мировая таблица · воркер' : 'локально · воркер не подключён' },
  { id: 'settings', t: 'НАСТРОЙКИ', s: () => 'звук · скорость · зерно · api' },
];
const derivedText = () => `УРОН <b>${Math.round(D.dmg)}</b> · ТЕМП <b>${D.rate.toFixed(2)}/с</b> · HP <b>${D.maxHp}</b> · КРИТ <b>${Math.round(D.crit * 100)}%</b> · УКЛОН <b>${Math.round(D.dodge * 100)}%</b>`;

export function init() {
  buildMenu();
  $('sheetClose').addEventListener('click', () => { play('click'); closeSheet(); });
  $('mSound').addEventListener('click', toggleSound);
  $('btnSound').addEventListener('click', toggleSound);
  $('btnPause').addEventListener('click', () => { play('click'); if (G) pause(!G.paused); });
  $('btnResume').addEventListener('click', () => { play('click'); pause(false); });
  $('btnAbandon').addEventListener('click', () => { play('click'); pause(false); endRun('retreat'); });
  $('btnSpeed').addEventListener('click', () => setSpeed(S.speed === 1 ? 2 : 1));
  $('btnNext').addEventListener('click', () => { if (G?.phase === 'inter') { G.interT = 0; play('click'); } });
  $('ptsBtn').addEventListener('click', () => openSheet('stats'));
  $('ab1').addEventListener('click', whirl);
  $('ab2').addEventListener('click', rage);
  $('skip5').addEventListener('click', () => onSkip(5));
  $('skip10').addEventListener('click', () => onSkip(10));
  for (let i = 0; i < SLOTS; i++) {
    $('post' + i).addEventListener('click', () => openPop(i));
    $('post' + i).addEventListener('mouseenter', () => { if (G) G.hoverSlot = i; });
    $('post' + i).addEventListener('mouseleave', () => { if (G) G.hoverSlot = -1; });
  }
  $('pop').addEventListener('click', onPopClick);
  document.addEventListener('pointerdown', e => { if (popSlot >= 0 && !e.target.closest('#pop') && !e.target.closest('.post')) closePop(); });
  $('btnAgain').addEventListener('click', () => { play('click'); $('summary').classList.add('hidden'); requestRun(); });
  $('btnMenu').addEventListener('click', () => { play('click'); $('summary').classList.add('hidden'); emit('screen', 'menu'); });
  $('btnSubmit').addEventListener('click', onSubmit);
  $('resFresh').addEventListener('click', () => { play('click'); beginRun(1); });
  $('resJump').addEventListener('click', () => { play('warp'); beginRun(S.best); });
  $('resAsk').addEventListener('change', e => { S.askResume = !e.target.checked; saveSoon(); });

  on('nav', d => { menuIdx = (menuIdx + d + MENU.length) % MENU.length; play('click'); renderMenuSel(); });
  on('navEnter', () => activate(MENU[menuIdx].id));
  on('key', k => {
    if (k === 'mute') toggleSound();
    else if (k === 'pause' && view.screen === 'battle' && G) pause(!G.paused);
    else if (k === 'stats') openSheet('stats');
    else if (k === 'escape') {
      if (!$('resume').classList.contains('hidden')) return;
      if (popSlot >= 0) closePop();
      else if (sheetName) closeSheet();
      else if (view.screen === 'battle' && G && !G.over && $('summary').classList.contains('hidden')) pause(!G.paused);
    }
  });
  on('pause', on => { $('pauseVeil').classList.toggle('hidden', !on); $('btnPause').textContent = on ? '▶' : '⏸'; });
  on('banner', banner);
  on('toast', toast);
  on('gold', () => { refreshGold(); renderSkip(); if (sheetName === 'arsenal') renderSheet(); if (popSlot >= 0) renderPop(popSlot); renderPosts(); });
  on('xp', refreshXp);
  on('level', () => { refreshXp(); refreshMenuMeta(); refreshWeaponHud(); });
  on('stats', () => { refreshMenuMeta(); refreshWeaponHud(); if (sheetName === 'stats') renderSheet(); if (view.screen === 'menu') emit('menu:swing'); });
  on('weapon', () => { refreshMenuMeta(); refreshWeaponHud(); if (sheetName === 'arsenal') renderSheet(); });
  on('buildings', renderPosts);
  on('run:start', () => { $('pauseVeil').classList.add('hidden'); $('btnPause').textContent = '⏸'; $('lowhp').classList.remove('on'); renderPosts(); refreshWeaponHud(); refreshGold(); refreshXp(); renderSkip(); $('killVal').textContent = '0'; $('bossWrap').classList.add('hidden'); });
  on('run:end', showSummary);
  on('wave:inter', () => renderSkip());
  on('boss', e => { $('bossWrap').classList.toggle('hidden', !e); if (e && G) $('bossName').textContent = ENEMIES[e.type].name + ' · ВОЛНА ' + G.wave; });
  on('board', () => { if (sheetName === 'records') renderSheet(); refreshMenuMeta(); });
  on('screen', name => { if (name === 'menu') { closeSheet(); closePop(); refreshMenuMeta(); net.fetchWorld(); } });

  syncSound(); setSpeed(S.speed, true);
  $('grain').style.display = S.grain ? '' : 'none';
  refreshMenuMeta(); refreshGold(); refreshXp(); refreshWeaponHud(); renderPosts(); renderSkip();
  net.fetchWorld();
}
function toggleSound() { audioInit(); setMuted(S.sound); syncSound(); saveSoon(); if (sheetName === 'settings') renderSheet(); }

/* ---- запуск забега с предложением возврата ---- */
function requestRun() {
  if (S.best >= 2 && S.askResume) {
    $('resBest').textContent = S.best;
    $('resJump').textContent = `К ВОЛНЕ ${S.best} ▶`;
    $('resAsk').checked = false;
    $('resume').classList.remove('hidden');
  } else beginRun(1);
}
function beginRun(w) {
  $('resume').classList.add('hidden');
  $('summary').classList.add('hidden');
  emit('screen', 'battle');
  startRun(w);
  emit('layout');
}

/* ---- пропуск волн ---- */
function onSkip(n) {
  if (!G || G.phase !== 'inter') return;
  const cost = skipCost(S.gold, n);
  if (S.gold < cost) { play('err'); return; }
  if (!skipArm[n]) {
    skipArm[n] = true; renderSkip(); play('click');
    clearTimeout(skipTimers[n]);
    skipTimers[n] = setTimeout(() => { skipArm[n] = false; renderSkip(); }, 3000);
    return;
  }
  clearTimeout(skipTimers[n]); skipArm[n] = false;
  if (skipWaves(n)) renderSkip(); else play('err');
}
function renderSkip() {
  const inter = G && G.phase === 'inter' && !G.over && view.screen === 'battle';
  $('skipRow').classList.toggle('hidden', !inter);
  if (!inter) return;
  for (const n of [5, 10]) {
    const cost = skipCost(S.gold, n), btn = $('skip' + n);
    btn.disabled = S.gold < cost;
    btn.classList.toggle('arm', skipArm[n]);
    btn.textContent = skipArm[n] ? `ТОЧНО? −¤${cost}` : (n === 5 ? `ПРОПУСТИТЬ 5 · ¤${cost}` : `10 · ¤${cost}`);
  }
}

function buildMenu() {
  const nav = $('mNav'); nav.innerHTML = '';
  MENU.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'm-item'; b.innerHTML = `<span class="t">${m.t}</span><span class="s"></span>`;
    b.addEventListener('mouseenter', () => { menuIdx = i; renderMenuSel(); });
    b.addEventListener('click', () => { play('click'); activate(m.id); });
    nav.appendChild(b);
  });
  renderMenuSel();
}
function renderMenuSel() { [...$('mNav').children].forEach((el, i) => { el.classList.toggle('sel', i === menuIdx); el.querySelector('.s').textContent = MENU[i].s(); }); }
function activate(id) { if (id === 'fight') requestRun(); else openSheet(id); }
function refreshMenuMeta() {
  $('mGold').textContent = '¤ ' + fmtN(S.gold);
  $('mLvl').textContent = 'УР. ' + S.level;
  const st = S.stats;
  $('mStats').innerHTML = `<b>${WEAPONS[S.weapon].name}</b>${D.wLvl ? ' ур.' + D.wLvl : ''} · СИЛ ${st.str} · ЛОВ ${st.agi} · СТК ${st.vit} · ТЧН ${st.pre} · ИНЖ ${st.eng} · УДЧ ${st.lck}` +
    (S.pts ? `<br><span class="pts">+${S.pts} ОЧКА НЕ РАСПРЕДЕЛЕНЫ — ПРОКАЧКА</span>` : '') +
    `<br><span class="derived">${derivedText()}</span>` +
    `<br>забегов ${S.runs} · убийств ${fmtN(S.kills)} · лучшая волна <b>${S.best}</b>`;
  renderMenuSel();
}
function refreshGold() {
  $('mGold').textContent = '¤ ' + fmtN(S.gold);
  $('goldVal').textContent = fmtN(S.gold);
  const gw = $('goldVal').parentElement; gw.classList.remove('pulse'); void gw.offsetWidth; gw.classList.add('pulse');
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
  $('wStats').textContent = `УРОН ${Math.round(D.dmg)} · ТЕМП ${D.rate.toFixed(2)}/с · HP ${D.maxHp}`;
}
function syncSound() {
  const html = S.sound ? SND_ON : SND_OFF;
  $('mSound').innerHTML = html; $('btnSound').innerHTML = html;
  $('mSound').style.color = S.sound ? '' : 'var(--red)'; $('btnSound').style.color = S.sound ? '' : 'var(--red)';
}
function setSpeed(v, silent) { S.speed = v; $('btnSpeed').textContent = v + '×'; if (!silent) { play('click'); saveSoon(); } if (sheetName === 'settings') renderSheet(); }

export function openSheet(name) { sheetName = name; play('click'); $('sheet').classList.remove('hidden'); renderSheet(); if (view.screen === 'battle' && G && !G.over) panelPause(true); }
export function closeSheet() { if (!sheetName) return; sheetName = null; $('sheet').classList.add('hidden'); if (view.screen === 'battle' && popSlot < 0) panelPause(false); }
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
  let h = `<h3>АРСЕНАЛ</h3><div class="sub">оружие остаётся между забегами. постройки строятся в бою на 4 постах.</div>`;
  for (const id of WEAPON_ORDER) {
    const w = WEAPONS[id], rec = S.weapons[id], own = !!rec?.own, eq = S.weapon === id;
    const dmg = (10 * w.dmg * (1 + .2 * (rec?.lvl || 0))).toFixed(0);
    const feat = w.shock ? 'ударная волна' : w.steal ? 'вампиризм 5%' : w.pierce >= 99 ? 'игнорирует броню' : w.pierce ? `пробой ${w.pierce}` : w.kind === 'jab' ? 'быстрый тычок' : 'широкая дуга';
    h += `<div class="srow wrow"><div class="head"><span class="name ${eq ? 'eq' : ''}">${w.name}${own ? tierPips(rec.lvl) : ''}</span><span class="gold">${own ? (eq ? 'В РУКАХ' : 'КУПЛЕНО') : '¤' + w.cost}</span></div>
      <div class="flavor">${w.flavor}</div>
      <div class="nums">урон <b>~${dmg}</b> · темп <b>${w.rate}/с</b> · дальность <b>${w.range}</b> · ${feat}</div>
      <div class="acts">
        ${!own ? `<button class="ibtn small ${S.gold >= w.cost ? 'fill' : ''}" data-buy="${id}" ${S.gold >= w.cost ? '' : 'disabled'}>КУПИТЬ ¤${w.cost}</button>` : ''}
        ${own && !eq ? `<button class="ibtn small" data-equip="${id}">ВЗЯТЬ</button>` : ''}
        ${own && rec.lvl < W_MAX ? `<button class="ibtn small" data-upw="${id}" ${S.gold >= wUpCost(id, rec.lvl) ? '' : 'disabled'}>УЛУЧШИТЬ ¤${wUpCost(id, rec.lvl)}</button>` : ''}
        ${own && rec.lvl >= W_MAX ? `<span class="dim" style="font-size:9px;letter-spacing:.14em">МАКСИМУМ</span>` : ''}
      </div></div>`;
  }
  h += `<div class="srow"><div class="nums" style="margin-bottom:6px"><b>ПОСТРОЙКИ</b> — 4 поста, ставятся в бою:</div>`;
  for (const k of B_ORDER) { const t = BUILDINGS[k]; h += `<div class="bcat"><b>${t.name}</b><span class="cost">¤${t.cost}</span><small><span class="tag">${t.tag}</span> · ${t.desc}</small></div>`; }
  h += `</div><div class="hintline">пропуск волн: 5 = 25% золота, 10 = 50% (минимум ¤25/¤50), без наград.<br>сила утолщает руку и след · ловкость ускоряет взмах и даёт шлейф.</div>`;
  return h;
}
function statsHTML() {
  let h = `<h3>ПРОКАЧКА</h3><div class="sub">очки не сгорают. каждое очко сразу меняет цифры ниже и поведение бойца.</div>
    <div class="ptsline">СВОБОДНО <b>${S.pts}</b> ОЧКОВ · УР. ${S.level}</div>
    <div class="derived-box">${derivedText()}<br>ДАЛЬНОСТЬ <b>${Math.round(D.range)}</b> · ОТБРОС <b>${Math.round(D.kb)}</b> · РЕГЕН <b>${D.regen.toFixed(2)}/с</b></div>
    <div class="bar sk xpline"><i class="xp" style="width:${clamp(S.xp / BAL.xpNeed(S.level) * 100, 0, 100)}%"></i></div>`;
  for (const d of STATS) {
    const v = S.stats[d.k], can = S.pts > 0 && v < D.cap;
    h += `<div class="srow statrow"><div><div class="n">${d.n}</div><div class="e">${d.eff(v)}</div></div><div class="v">${v}<small>/ ${D.cap}</small></div><button class="plus" data-stat="${d.k}" ${can ? '' : 'disabled'}>+</button></div>`;
  }
  const total = Object.values(S.stats).reduce((a, b) => a + b, 0);
  h += `<div class="srow"><button class="ibtn small red" id="respecBtn" ${total && S.gold >= BAL.respecCost(S.level) ? '' : 'disabled'}>СБРОС СТАТОВ · ¤${BAL.respecCost(S.level)}</button></div>
    <div class="hintline">SHIFT+КЛИК = +5 · лимит на стат растёт с уровнем.<br>сброс — только здесь, за золото. постройки каждый забег строятся заново.</div>`;
  return h;
}
function recordsHTML() {
  let h = `<h3>РЕКОРДЫ</h3><div class="sub">лучший забег на позывной. рекорд считается по зачищенным волнам.</div>
    <div class="nickrow"><label>ПОЗЫВНОЙ</label><div class="apirow"><input id="nickInput" maxlength="16" value="${esc(S.nick)}" spellcheck="false"></div></div>
    <div class="tabs"><button class="tab ${boardTab === 'world' ? 'on' : ''}" data-tab="world">МИР</button><button class="tab ${boardTab === 'local' ? 'on' : ''}" data-tab="local">ЛОКАЛЬНО</button><button class="ibtn small" id="boardRefresh">↻</button></div>`;
  if (boardTab === 'local') h += S.board.length ? S.board.map(brow).join('') : `<div class="empty">пока пусто. первый забег ждёт.</div>`;
  else if (!net.apiBase()) h += `<div class="empty">мировая таблица живёт на cloudflare worker.<br>задеплой worker.js и вставь адрес в настройках.<br><button class="ibtn small" id="goSettings" style="margin-top:10px">НАСТРОЙКИ</button></div>`;
  else if (net.status === 'load') h += `<div class="empty">загрузка…</div>`;
  else if (!net.world) h += `<div class="empty">сервер не ответил. проверь адрес и связь.</div>`;
  else {
    h += `<div class="hintline" style="margin:0 0 8px">${net.worldMeta?.total ?? net.world.length} бойцов · рекорд волна ${net.worldMeta?.top ?? 0}</div>`;
    h += net.world.length ? net.world.map(brow).join('') : `<div class="empty">таблица пуста. стань первым.</div>`;
  }
  return h;
}
function brow(e, i) {
  const me = e.nick?.toUpperCase() === S.nick.toUpperCase();
  return `<div class="brow r${i + 1} ${me ? 'me' : ''}"><span class="rk">${String(i + 1).padStart(2, '0')}</span><span class="nk">${esc(e.nick)}<small>ур.${e.level | 0} · ✕${fmtN(e.kills | 0)} · ${fmtT(e.time | 0)}</small></span><span class="wv">${e.wave | 0}</span></div>`;
}
function settingsHTML() {
  return `<h3>НАСТРОЙКИ</h3><div class="sub">всё применяется сразу.</div>
    <div class="setrow"><span>ЗВУК<small>M · синтез в реальном времени</small></span><button class="sw ${S.sound ? 'on' : ''}" id="setSound"></button></div>
    <div class="setrow"><span>СКОРОСТЬ</span><div class="seg"><button data-speed="1" class="${S.speed === 1 ? 'on' : ''}">1×</button><button data-speed="2" class="${S.speed === 2 ? 'on' : ''}">2×</button></div></div>
    <div class="setrow"><span>ТРЯСКА</span><button class="sw ${S.shake ? 'on' : ''}" id="setShake"></button></div>
    <div class="setrow"><span>ЗЕРНО</span><button class="sw ${S.grain ? 'on' : ''}" id="setGrain"></button></div>
    <div class="setrow"><span>ЧАСТИЦЫ</span><div class="seg">${['high', 'med', 'low'].map(q => `<button data-q="${q}" class="${S.quality === q ? 'on' : ''}">${{ high: 'ПОЛН', med: 'СРЕД', low: 'МИН' }[q]}</button>`).join('')}</div></div>
    <div class="setrow"><span>ПРЕДЛАГАТЬ ВОЗВРАТ<small>к лучшей волне при новом забеге</small></span><button class="sw ${S.askResume ? 'on' : ''}" id="setAsk"></button></div>
    <div class="setrow" style="display:block"><span>CLOUDFLARE WORKER<small>адрес api лидборда · пусто = локально</small></span>
      <div class="apirow"><input id="apiInput" value="${esc(S.api || '')}" placeholder="https://cherta-lb.имя.workers.dev" spellcheck="false"><button class="ibtn small" id="apiCheck">ПРОВЕРИТЬ</button></div><div id="apiStatus"></div></div>
    <div class="setrow"><span class="red">СТЕРЕТЬ СОХРАНЕНИЕ<small>уровень, оружие, золото, рекорды</small></span><button class="ibtn small red" id="wipeBtn">СТЕРЕТЬ</button></div>`;
}
function bindSheet() {
  const b = $('sheetBody');
  b.querySelectorAll('[data-buy]').forEach(el => el.addEventListener('click', () => { if (buyWeapon(el.dataset.buy)) { play('up'); emit('menu:swing'); } else play('err'); }));
  b.querySelectorAll('[data-equip]').forEach(el => el.addEventListener('click', () => { if (equipWeapon(el.dataset.equip)) { play('click'); emit('menu:swing'); } }));
  b.querySelectorAll('[data-upw]').forEach(el => el.addEventListener('click', () => { if (upgradeWeapon(el.dataset.upw)) play('up'); else play('err'); }));
  b.querySelectorAll('[data-stat]').forEach(el => el.addEventListener('click', e => { if (addStat(el.dataset.stat, e.shiftKey ? 5 : 1)) play('up'); else play('err'); }));
  const rs = b.querySelector('#respecBtn'); if (rs) rs.addEventListener('click', () => { if (respec()) { play('build'); toast('Статы сброшены. Очки возвращены.', 'gold'); } else play('err'); });
  b.querySelectorAll('[data-tab]').forEach(el => el.addEventListener('click', () => { boardTab = el.dataset.tab; play('click'); renderSheet(); if (boardTab === 'world') net.fetchWorld(); }));
  const rf = b.querySelector('#boardRefresh'); if (rf) rf.addEventListener('click', () => { play('click'); boardTab === 'world' ? net.fetchWorld() : renderSheet(); });
  const gs = b.querySelector('#goSettings'); if (gs) gs.addEventListener('click', () => openSheet('settings'));
  const ni = b.querySelector('#nickInput');
  if (ni) ni.addEventListener('change', () => { const v = ni.value.trim().replace(/\s+/g, ' ').toUpperCase(); if (!NICK_RE.test(v)) { toast('Позывной: 3–16 символов.', 'red'); ni.value = S.nick; play('err'); return; } S.nick = v; ni.value = v; saveSoon(); play('click'); });
  const ss = b.querySelector('#setSound'); if (ss) ss.addEventListener('click', toggleSound);
  b.querySelectorAll('[data-speed]').forEach(el => el.addEventListener('click', () => setSpeed(+el.dataset.speed)));
  const sh = b.querySelector('#setShake'); if (sh) sh.addEventListener('click', () => { S.shake = !S.shake; saveSoon(); play('click'); renderSheet(); });
  const gr = b.querySelector('#setGrain'); if (gr) gr.addEventListener('click', () => { S.grain = !S.grain; $('grain').style.display = S.grain ? '' : 'none'; saveSoon(); play('click'); renderSheet(); });
  const sa = b.querySelector('#setAsk'); if (sa) sa.addEventListener('click', () => { S.askResume = !S.askResume; saveSoon(); play('click'); renderSheet(); });
  b.querySelectorAll('[data-q]').forEach(el => el.addEventListener('click', () => { S.quality = el.dataset.q; saveSoon(); emit('quality'); play('click'); renderSheet(); }));
  const ac = b.querySelector('#apiCheck');
  if (ac) ac.addEventListener('click', async () => {
    const v = b.querySelector('#apiInput').value.trim().replace(/\/+$/, ''); S.api = v; saveSoon();
    const st = b.querySelector('#apiStatus');
    if (!v) { st.textContent = 'локальный режим'; st.className = ''; net.fetchWorld(); return; }
    st.textContent = 'проверяю…'; st.className = '';
    try { const d = await net.checkApi(v); st.textContent = `✓ связь · ${d.players} бойцов · рекорд ${d.top}`; st.className = 'ok'; play('up'); net.fetchWorld(); }
    catch (e) { st.textContent = '✗ не удалось соединиться'; st.className = 'err'; play('err'); }
  });
  const wp = b.querySelector('#wipeBtn');
  if (wp) { let arm = false; wp.addEventListener('click', () => { if (!arm) { arm = true; wp.textContent = 'ТОЧНО?'; setTimeout(() => { arm = false; wp.textContent = 'СТЕРЕТЬ'; }, 3000); return; } ['cherta_save_v5', 'cherta_save_v4', 'cherta_save_v3', 'cherta_save_v2', 'cherta_save_v1'].forEach(k => localStorage.removeItem(k)); location.reload(); }); }
}

function openPop(i) {
  if (!G) return;
  if (popSlot === i) { closePop(); return; }
  popSlot = i; play('click'); renderPop(i);
  $('pop').classList.remove('hidden');
  const r = $('post' + i).getBoundingClientRect();
  $('pop').style.left = clamp(r.left + r.width / 2 - 140, 8, innerWidth - 288) + 'px';
  $('pop').style.bottom = innerHeight - r.top + 10 + 'px'; $('pop').style.top = 'auto';
  if (!G.over) panelPause(true);
}
function closePop() { if (popSlot < 0) return; popSlot = -1; $('pop').classList.add('hidden'); if (!sheetName && G) panelPause(false); }
function renderPop(i) {
  const b = G?.buildings[i];
  let h = `<h4>ПОСТ ${i + 1} ${b ? `<i>${BUILDINGS[b.type].name} УР.${b.lvl}</i>` : '<i>СВОБОДЕН</i>'}</h4>`;
  if (!b) {
    h += `<div class="ps">инженерия усиливает атаки и поддержку. выбирай под волну:</div>`;
    for (const k of B_ORDER) {
      const tw = BUILDINGS[k];
      h += `<button class="topt" data-act="build" data-type="${k}" ${S.gold >= tw.cost ? '' : 'disabled'}><b>${tw.name}</b><span class="cost">¤${tw.cost}</span><small><span class="tag">${tw.tag}</span> · ${tw.desc}${tw.dmg ? ` · ${tw.dmg}×${tw.rate}/с` : ''}${tw.hp ? ` · ${tw.hp} HP` : ''}</small></button>`;
    }
  } else {
    const cost = bUpCost(b.type, b.lvl), refund = Math.floor(b.spent * .5);
    const stat = b.type === 'wall' ? `прочность ${Math.round(b.hp)} / ${Math.round(b.maxHp)}` :
      b.type === 'gen' ? `+¤${Math.round((4 + b.lvl * 2) * D.supportM)} / 5с` :
      b.type === 'fix' ? `+${Math.round((8 + b.lvl * 4) * D.supportM)} HP / 4с` :
      b.type === 'totem' ? `аура +${Math.round((.12 + .05 * b.lvl) * 100)}% урона` :
      `урон ${bDmg(b).toFixed(1)} · темп ${bRate(b).toFixed(2)}/с · <span class="acc">${Math.round(bDmg(b) * bRate(b))} DPS</span>`;
    h += `<div class="ps">${BUILDINGS[b.type].desc}<br>${stat}<br>след. ур.: сильнее, новый силуэт</div>
      <button class="topt" data-act="up" ${S.gold >= cost ? '' : 'disabled'}><b>УЛУЧШИТЬ → УР.${b.lvl + 1}</b><span class="cost">¤${cost}</span></button>
      <button class="topt" data-act="sell"><b class="red">СНЕСТИ</b><span class="cost">+¤${refund}</span></button>`;
  }
  $('pop').innerHTML = h;
}
function onPopClick(e) {
  const b = e.target.closest('[data-act]'); if (!b || popSlot < 0) return;
  if (b.dataset.act === 'build') buildBuilding(popSlot, b.dataset.type);
  else if (b.dataset.act === 'up') upgradeBuilding(popSlot);
  else if (b.dataset.act === 'sell') sellBuilding(popSlot);
  renderPosts(); if (popSlot >= 0) renderPop(popSlot);
}
function renderPosts() {
  for (let i = 0; i < SLOTS; i++) {
    const b = G?.buildings[i], el = $('post' + i);
    if (!b) { el.className = 'post empty'; el.innerHTML = `<i>${i + 1}</i><span><b>ПОСТ ${i + 1}</b><em>построить</em></span>`; }
    else {
      const sub = b.type === 'wall' ? `${Math.round(b.hp / b.maxHp * 100)}% прочности` : b.type === 'gen' ? '+золото' : b.type === 'fix' ? 'лечение' : b.type === 'totem' ? 'аура' : `${Math.round(bDmg(b) * bRate(b))} DPS`;
      el.className = 'post';
      el.innerHTML = `<i>${i + 1}</i><span><b>${BUILDINGS[b.type].name} · ${b.lvl}</b><em>${sub}</em></span>${S.gold >= bUpCost(b.type, b.lvl) ? '<span class="up">↑</span>' : ''}${b.type === 'wall' ? `<span class="wallhp" style="width:${clamp(b.hp / b.maxHp * 100, 0, 100)}%"></span>` : ''}`;
    }
  }
}

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
  const boardWave = Math.max(1, d.cleared);
  net.recordLocal({ nick: S.nick, wave: boardWave, kills: d.kills, level: d.level, time: d.time, date: Date.now() });
  $('sumTitle').textContent = d.reason === 'death' ? 'ЧЕРТА ПРОРВАНА' : 'ВЫЛАЗКА ЗАВЕРШЕНА';
  $('sumTitle').classList.toggle('red', d.reason === 'death');
  $('sumWave').textContent = d.wave;
  $('sumRecord').classList.toggle('hidden', !d.record);
  $('sumMeta').textContent = `зачищено ${d.cleared} · пропущено ${d.skipped} · старт с волны ${d.startWave}`;
  $('sumKills').textContent = fmtN(d.kills); $('sumTime').textContent = fmtT(d.time);
  $('sumLvl').textContent = '+' + d.lvl; $('sumGold').textContent = '+¤' + fmtN(d.gold);
  $('sumXp').textContent = '+' + fmtN(d.xp); $('sumLevel').textContent = d.level;
  $('sumNick').value = S.nick;
  const st = $('submitStatus'), btn = $('btnSubmit');
  st.textContent = ''; st.className = ''; btn.disabled = false; btn.textContent = 'ОТПРАВИТЬ РЕКОРД';
  if (!net.apiBase()) { btn.disabled = true; btn.textContent = 'ЛОКАЛЬНО ✓'; st.textContent = 'рекорд на устройстве · подключи воркер для мировой таблицы'; }
  $('summary').classList.remove('hidden');
  refreshMenuMeta();
}
async function onSubmit() {
  if (!lastSummary || G?.submitted) return;
  const nick = $('sumNick').value.trim().replace(/\s+/g, ' ').toUpperCase();
  if (!NICK_RE.test(nick)) { $('submitStatus').textContent = 'позывной: 3–16 символов'; $('submitStatus').className = 'err'; play('err'); return; }
  S.nick = nick; saveSoon();
  const btn = $('btnSubmit'), st = $('submitStatus');
  btn.disabled = true; btn.textContent = 'ОТПРАВКА…';
  try {
    const r = await net.submit({ nick, wave: Math.max(1, lastSummary.cleared), kills: lastSummary.kills, level: lastSummary.level, time: lastSummary.time, runId: lastSummary.runId });
    if (r.ok && r.data?.ok) { G.submitted = true; btn.textContent = 'ПРИНЯТО ✓'; st.textContent = r.data.kept ? 'сервер оставил твой лучший результат' : '✓ рекорд в мировой таблице'; st.className = 'ok'; play('up'); setTimeout(net.fetchWorld, 600); }
    else { btn.disabled = false; btn.textContent = 'ПОВТОРИТЬ'; st.textContent = '✗ ' + (r.data?.error || 'ошибка ' + r.status); st.className = 'err'; play('err'); }
  } catch (e) { btn.disabled = false; btn.textContent = 'ПОВТОРИТЬ'; st.textContent = '✗ воркер недоступен — сохранено локально'; st.className = 'err'; play('err'); }
}

export function hudFrame(g) {
  if (!g) return;
  const hpPct = clamp(g.hp / g.maxHp * 100, 0, 100);
  $('hpFill').style.width = hpPct + '%';
  $('hpText').textContent = Math.ceil(g.hp) + ' / ' + g.maxHp;
  const low = hpPct < 30 && g.phase === 'wave';
  $('hpBar').classList.toggle('low', low);
  $('lowhp').classList.toggle('on', low);
  refreshXp();
  if (g.phase === 'wave') { $('waveNum').textContent = 'ВОЛНА ' + g.wave; $('waveSub').textContent = 'ОСТАЛОСЬ ' + (g.spawnQ.length + g.enemies.length); $('btnNext').classList.add('hidden'); $('skipRow').classList.add('hidden'); }
  else if (g.phase === 'inter') { $('waveNum').textContent = g.wave ? 'ВОЛНА ' + g.wave + ' ✓' : 'ГОТОВЬСЯ'; $('waveSub').textContent = 'СЛЕДУЮЩАЯ ЧЕРЕЗ ' + Math.max(0, Math.ceil(g.interT)) + ' СЕК'; renderSkip(); }
  else { $('waveSub').textContent = g.phase === 'dying' ? 'ЧЕРТА ПРОРВАНА' : ''; $('skipRow').classList.add('hidden'); }
  if (g.boss && !g.boss.dead) { $('bossFill').style.width = clamp(g.boss.hp / g.boss.maxHp * 100, 0, 100) + '%'; $('bossName').textContent = ENEMIES[g.boss.type].name + ' · ВОЛНА ' + g.wave; }
  $('ab1cd').style.height = (g.ab1 / g.ab1Max * 100) + '%';
  $('ab1s').textContent = g.ab1 > 0 ? g.ab1.toFixed(1) : '';
  $('ab1').classList.toggle('ready', g.ab1 <= 0);
  const locked = S.level < 4;
  $('ab2').classList.toggle('locked', locked);
  $('ab2').classList.toggle('raging', g.rage > 0);
  $('ab2cd').style.height = (g.ab2 / g.ab2Max * 100) + '%';
  $('ab2s').textContent = locked ? 'ур.4' : g.rage > 0 ? g.rage.toFixed(1) : g.ab2 > 0 ? Math.ceil(g.ab2) : '';
  $('ab2').classList.toggle('ready', !locked && g.ab2 <= 0);
  $('killVal').textContent = fmtN(g.kills);
}  
