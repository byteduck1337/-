import { S, D, addStat, respec, buyWeapon, upgradeWeapon, equipWeapon, saveSoon, weaponUnlocked, buildingUnlocked, ascend, ascensionGain, buyPerk, buyCharSkin, buyWeaponSkin, equipCharSkin, equipWeaponSkin, openBox } from './state.js?v=8';
import { BAL, STATS, WEAPONS, WEAPON_ORDER, W_MAX, wUpCost, BUILDINGS, B_ORDER, bUpCost, SLOTS, ENEMIES, skipCost, SPEEDS, CHALLENGES, PERKS, CHAR_SKINS, WEAPON_SKINS, BOX_COST, BOX3_COST } from './config.js?v=8';
import { on, emit } from './events.js?v=8';
import { view } from './view.js?v=8';
import { G, endRun, pause, panelPause, buildBuilding, upgradeBuilding, sellBuilding, bDmg, bRate, whirl, rage, startRun, skipWaves } from './game.js?v=8';
import { play, setMuted, init as audioInit } from './audio.js?v=8';
import { isConfigured, status, world, worldMeta, cooldownLeft, changeNick, fetchWorld, submitRun, recordLocal } from './net.js?v=8';
import { fmtN, fmtT, esc, NICK_RE, clamp } from './utils.js?v=8';

const $ = id => document.getElementById(id);
const RARITY = {
  common: { n: 'ОБЫЧНЫЙ', col: '#f2f2ee', w: .55 },
  rare: { n: 'РЕДКИЙ', col: '#5db4ff', w: .3 },
  epic: { n: 'ЭПИЧЕСКИЙ', col: '#c05dff', w: .12 },
  legend: { n: 'ЛЕГЕНДАРНЫЙ', col: '#f5b942', w: .03 },
};
const SND_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SND_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
let sheetName = null, boardTab = 'world', popSlot = -1, menuIdx = 0, lastSummary = null;
let arsenalTab = 'weapons', skinsTab = 'char';
let skipArm = { 5: false, 10: false }, skipTimers = { 5: null, 10: null }, nickTimer = null;
const MENU = [
  { id: 'fight', t: 'В БОЙ', s: () => `волна 1 · рекорд ${S.best}` },
  { id: 'arsenal', t: 'АРСЕНАЛ', s: () => `${WEAPONS[S.weapon].name}${D.wLvl ? ' ур.' + D.wLvl : ''} · оружие и постройки` },
  { id: 'skins', t: 'СКИНЫ', s: () => `персонаж: ${(CHAR_SKINS.find(x => x.id === S.skins.char) || {}).n || '—'} · ¤¤${S.shards}` },
  { id: 'stats', t: 'ПРОКАЧКА', s: () => S.pts ? `+${S.pts} очка ждут` : `ур. ${S.level} · печатей ${S.seals}` },
  { id: 'challenges', t: 'ИСПЫТАНИЯ', s: () => `ассенсия ${S.ascensions} · ${Object.keys(S.challenges).length}/${CHALLENGES.length}` },
  { id: 'records', t: 'РЕКОРДЫ', s: () => status === 'ok' ? 'мировая таблица · онлайн' : 'локально · нет связи' },
  { id: 'settings', t: 'НАСТРОЙКИ', s: () => 'звук · скорость · зерно' },
];
const derivedText = () => `УРОН <b>${Math.round(D.dmg)}</b> · ТЕМП <b>${D.rate.toFixed(2)}/с</b> · HP <b>${D.maxHp}</b> · КРИТ <b>${Math.round(D.crit * 100)}%</b> · УКЛОН <b>${Math.round(D.dodge * 100)}%</b>`;
const connText = () => ({ ok: 'ПОДКЛЮЧЁН', load: 'СВЯЗЬ…', err: 'НЕТ СВЯЗИ', off: 'НЕ НАСТРОЕН' }[status] || '—');
const connColor = () => ({ ok: 'var(--acc)', load: 'var(--gold)', err: 'var(--red)', off: 'var(--dim)' }[status] || 'var(--dim)');

export function init() {
  buildMenu();
  $('sheetClose').addEventListener('click', () => { play('click'); closeSheet(); });
  $('mSound').addEventListener('click', toggleSound);
  $('btnSound').addEventListener('click', toggleSound);
  $('btnPause').addEventListener('click', () => { play('click'); if (G) pause(!G.paused); });
  $('btnResume').addEventListener('click', () => { play('click'); pause(false); });
  $('btnAbandon').addEventListener('click', () => { play('click'); pause(false); endRun('retreat'); });
  $('btnSpeed').addEventListener('click', () => {
    const idx = SPEEDS.indexOf(S.speed);
    setSpeed(SPEEDS[(idx + 1) % SPEEDS.length]);
  });
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
  on('gold', () => { refreshGold(); renderSkip(); if (sheetName === 'arsenal') renderSheet(); if (sheetName === 'skins') renderSheet(); if (popSlot >= 0) renderPop(popSlot); renderPosts(); });
  on('xp', refreshXp);
  on('level', () => { refreshXp(); refreshMenuMeta(); refreshWeaponHud(); });
  on('stats', () => { refreshMenuMeta(); refreshWeaponHud(); if (sheetName === 'stats') renderSheet(); if (view.screen === 'menu') emit('menu:swing'); });
  on('weapon', () => { refreshMenuMeta(); refreshWeaponHud(); if (sheetName === 'arsenal') renderSheet(); });
  on('weapon:up', () => { if (sheetName === 'arsenal') renderSheet(); });
  on('weaponKills', () => { if (sheetName === 'arsenal') renderSheet(); });
  on('buildings', renderPosts);
  on('nick', refreshMenuMeta);
  on('net', () => { refreshMenuMeta(); if (sheetName === 'records' || sheetName === 'settings') renderSheet(); });
  on('run:start', () => { $('pauseVeil').classList.add('hidden'); $('btnPause').textContent = '⏸'; $('lowhp').classList.remove('on'); renderPosts(); refreshWeaponHud(); refreshGold(); refreshXp(); renderSkip(); $('killVal').textContent = '0'; $('bossWrap').classList.add('hidden'); });
  on('run:end', showSummary);
  on('wave:inter', () => renderSkip());
  on('boss', e => { $('bossWrap').classList.toggle('hidden', !e); if (e && G) $('bossName').textContent = ENEMIES[e.type].name + ' · ВОЛНА ' + G.wave; });
  on('board', () => { if (sheetName === 'records') renderSheet(); refreshMenuMeta(); });
  on('screen', name => { if (name === 'menu') { closeSheet(); closePop(); refreshMenuMeta(); fetchWorld(); } });
  on('ascension', () => { refreshMenuMeta(); refreshWeaponHud(); refreshGold(); refreshXp(); if (sheetName === 'stats') renderSheet(); toast('АССЕНСИЯ ПРИНЯТА', 'gold'); });
  on('perks', () => { refreshMenuMeta(); if (sheetName === 'stats') renderSheet(); });
  on('shards', () => { if (sheetName === 'skins') renderSheet(); refreshMenuMeta(); });
  on('seals', () => { if (sheetName === 'stats') renderSheet(); refreshMenuMeta(); });
  on('skins', () => { if (sheetName === 'skins' || sheetName === 'arsenal') renderSheet(); refreshMenuMeta(); });

  syncSound(); setSpeed(S.speed, true);
  $('grain').style.display = S.grain ? '' : 'none';
  refreshMenuMeta(); refreshGold(); refreshXp(); refreshWeaponHud(); renderPosts(); renderSkip();
  fetchWorld();
}
function toggleSound() { audioInit(); setMuted(S.sound); syncSound(); saveSoon(); if (sheetName === 'settings') renderSheet(); }

function requestRun() {
  if (S.best >= 2 && S.askResume) {
    $('resBest').textContent = S.best;
    $('resJump').textContent = `К ВОЛНЕ ${S.best} ▶`;
    $('resAsk').checked = false;
    $('resume').classList.remove('hidden');
  } else beginRun(1);
}
function beginRun(w, challengeId) {
  $('resume').classList.add('hidden');
  $('summary').classList.add('hidden');
  emit('screen', 'battle');
  startRun(w, challengeId || null);
  emit('layout');
}

function onSkip(n) {
  if (!G || G.phase !== 'inter') return;
  const cost = skipCost(G.wave, n);
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
    const cost = skipCost(G.wave, n), btn = $('skip' + n);
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
  const meta = [];
  if (S.ascensions) meta.push(`ассенсия ${S.ascensions}`);
  if (S.seals) meta.push(`печати ${S.seals}`);
  if (S.shards) meta.push(`¤¤${S.shards}`);
  $('mStats').innerHTML = `<b>${esc(S.nick)}</b> · ${WEAPONS[S.weapon].name}${D.wLvl ? ' ур.' + D.wLvl : ''} · СИЛ ${st.str} · ЛОВ ${st.agi} · СТК ${st.vit} · ТЧН ${st.pre} · ИНЖ ${st.eng} · УДЧ ${st.lck}` +
    (meta.length ? `<br><span class="derived">${meta.join(' · ')}</span>` : '') +
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
function setSpeed(v, silent) {
  if (!SPEEDS.includes(v)) v = SPEEDS[0];
  S.speed = v; $('btnSpeed').textContent = v + '×';
  if (!silent) { play('click'); saveSoon(); }
  if (sheetName === 'settings') renderSheet();
}

export function openSheet(name) { sheetName = name; play('click'); $('sheet').classList.remove('hidden'); renderSheet(); if (view.screen === 'battle' && G && !G.over) panelPause(true); }
export function closeSheet() { if (!sheetName) return; sheetName = null; stopNickTicker(); $('sheet').classList.add('hidden'); if (view.screen === 'battle' && popSlot < 0) panelPause(false); }
function renderSheet() {
  stopNickTicker();
  const b = $('sheetBody');
  if (sheetName === 'arsenal') b.innerHTML = arsenalHTML();
  else if (sheetName === 'skins') b.innerHTML = skinsHTML();
  else if (sheetName === 'stats') b.innerHTML = statsHTML();
  else if (sheetName === 'challenges') b.innerHTML = challengesHTML();
  else if (sheetName === 'records') b.innerHTML = recordsHTML();
  else if (sheetName === 'settings') b.innerHTML = settingsHTML();
  bindSheet();
  if (sheetName === 'records') { updateNickUI(); startNickTicker(); }
}
function tierPips(lvl) { return `<span class="tier">${Array.from({ length: W_MAX }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span>`; }
function reqText(req) {
  const parts = [];
  if (req.lvl) parts.push(`ур.${req.lvl}`);
  if (req.asc) parts.push(`ассенсия ${req.asc}`);
  if (req.kills) parts.push(`убить ${req.kills[1]} (${WEAPONS[req.kills[0]]?.name || '—'})`);
  return parts.join(' · ');
}
function arsenalHTML() {
  let h = `<h3>АРСЕНАЛ</h3><div class="sub">оружие и постройки открываются по уровню, ассенсии и навыку с предыдущим оружием. оружие покупается навсегда.</div>`;
  h += `<div class="tabs"><button class="tab ${arsenalTab === 'weapons' ? 'on' : ''}" data-atab="weapons">ОРУЖИЕ</button><button class="tab ${arsenalTab === 'buildings' ? 'on' : ''}" data-atab="buildings">ПОСТРОЙКИ</button></div>`;
  if (arsenalTab === 'weapons') {
    for (const id of WEAPON_ORDER) {
      const w = WEAPONS[id], rec = S.weapons[id], own = !!rec?.own, eq = S.weapon === id;
      const unlocked = weaponUnlocked(id);
      const dmg = (10 * w.dmg * (1 + .2 * (rec?.lvl || 0))).toFixed(0);
      const feat = w.shock ? 'ударная волна' : w.steal ? 'вампиризм 5%' : w.pierce >= 99 ? 'игнорирует броню' : w.pierce ? `пробой ${w.pierce}` : w.kind === 'jab' ? 'быстрый тычок' : 'широкая дуга';
      const kills = S.weaponKills[id] || 0;
      const reqKills = w.req?.kills?.[1] || 0;
      h += `<div class="srow wrow"><div class="head"><span class="name ${eq ? 'eq' : ''}">${w.name}${own ? tierPips(rec.lvl) : ''}</span><span class="gold">${own ? (eq ? 'В РУКАХ' : 'КУПЛЕНО') : unlocked ? '¤' + w.cost : 'ЗАКРЫТО'}</span></div>
        <div class="flavor">${w.flavor}</div>
        <div class="nums">урон <b>~${dmg}</b> · темп <b>${w.rate}/с</b> · дальность <b>${w.range}</b> · ${feat} · убийств <b>${kills}${reqKills ? '/' + reqKills : ''}</b></div>
        <div class="acts">`;
      if (!unlocked) h += `<span class="dim" style="font-size:9px;letter-spacing:.14em">ТРЕБУЕТСЯ: ${reqText(w.req || {})}</span>`;
      else {
        if (!own) h += `<button class="ibtn small ${S.gold >= w.cost ? 'fill' : ''}" data-buy="${id}" ${S.gold >= w.cost ? '' : 'disabled'}>КУПИТЬ ¤${w.cost}</button>`;
        if (own && !eq) h += `<button class="ibtn small" data-equip="${id}">ВЗЯТЬ</button>`;
        if (own && rec.lvl < W_MAX) h += `<button class="ibtn small" data-upw="${id}" ${S.gold >= wUpCost(id, rec.lvl) ? '' : 'disabled'}>УЛУЧШИТЬ ¤${wUpCost(id, rec.lvl)}</button>`;
        if (own && rec.lvl >= W_MAX) h += `<span class="dim" style="font-size:9px;letter-spacing:.14em">МАКСИМУМ</span>`;
      }
      h += `</div></div>`;
    }
  } else {
    h += `<div class="nums" style="margin-bottom:6px"><b>4 поста</b> — строятся в бою:</div>`;
    for (const k of B_ORDER) {
      const t = BUILDINGS[k];
      const unlocked = buildingUnlocked(k);
      h += `<div class="bcat ${!unlocked ? 'dim' : ''}"><b>${t.name}</b><span class="cost">${unlocked ? '¤' + t.cost : 'ЗАКРЫТО'}</span><small><span class="tag">${t.tag}</span> · ${t.desc}${!unlocked ? '<br><i>требуется: ' + reqText(t.req || {}) + '</i>' : ''}</small></div>`;
    }
  }
  h += `<div class="hintline">оружие открывается: по уровню персонажа, по ассенсии, и по числу убийств предыдущим оружием.<br>каждый удар текущим оружием увеличивает его счётчик.</div>`;
  return h;
}
function skinsHTML() {
  let h = `<h3>СКИНЫ</h3><div class="sub">¤¤ шарды — из испытаний и дублей. кейс за ¤¤${BOX_COST} даёт случайный скин из ещё не купленных.</div>`;
  h += `<div class="derived-box">¤¤ ШАРДЫ <b>${S.shards}</b> · ПЕЧАТИ <b>${S.seals}</b> · АССЕНСИЯ ${S.ascensions}</div>`;
  h += `<div class="acts"><button class="ibtn small fill" data-openbox ${S.shards >= BOX_COST ? '' : 'disabled'}>ОТКРЫТЬ КЕЙС · ¤¤${BOX_COST}</button></div>`;
  h += `<div class="tabs"><button class="tab ${skinsTab === 'char' ? 'on' : ''}" data-stab="char">ПЕРСОНАЖ</button><button class="tab ${skinsTab === 'weapon' ? 'on' : ''}" data-stab="weapon">ОРУЖИЕ</button></div>`;
  if (skinsTab === 'char') {
    for (const s of CHAR_SKINS) {
      const own = S.ownedSkins.char.includes(s.id);
      const eq = S.skins.char === s.id;
      h += `<div class="srow"><div class="head"><span class="name ${eq ? 'eq' : ''}" style="color:${s.col}">${s.n}</span><span class="gold">${own ? (eq ? 'НАДЕТО' : 'КУПЛЕНО') : '¤' + s.cost}</span></div>
        <div class="nums" style="color:${RARITY[s.rarity].col}">${RARITY[s.rarity].n} · свечение <b style="color:${s.glow}">${s.glow}</b></div>
        <div class="acts">${!own ? `<button class="ibtn small ${S.gold >= s.cost ? 'fill' : ''}" data-buychar="${s.id}" ${S.gold >= s.cost ? '' : 'disabled'}>КУПИТЬ ¤${s.cost}</button>` : (!eq ? `<button class="ibtn small" data-equipchar="${s.id}">НАДЕТЬ</button>` : '')}</div></div>`;
    }
  } else {
    for (const s of WEAPON_SKINS) {
      const own = S.ownedSkins.weapon.includes(s.id);
      const eq = S.skins.weapon === s.id;
      const req = s.req || {};
      const totalKills = Object.values(S.weaponKills).reduce((a, b) => a + b, 0);
      const okKills = !req.kills || totalKills >= req.kills;
      const okOwn = !req.own || S.weapons[req.own]?.own;
      const canBuy = own || (okKills && okOwn && S.gold >= s.cost);
      h += `<div class="srow"><div class="head"><span class="name ${eq ? 'eq' : ''}" style="color:${s.edge}">${s.n}</span><span class="gold">${own ? (eq ? 'В РУКАХ' : 'КУПЛЕНО') : okKills && okOwn ? '¤' + s.cost : 'ЗАКРЫТО'}</span></div>
        <div class="nums" style="color:${RARITY[s.rarity].col}">${RARITY[s.rarity].n} · убийств ${totalKills}${req.kills ? '/' + req.kills : ''}${req.own ? ' · нужно ' + (WEAPONS[req.own]?.name || req.own) : ''}</div>
        <div class="acts">${!own ? `<button class="ibtn small ${canBuy ? 'fill' : ''}" data-buywskin="${s.id}" ${canBuy ? '' : 'disabled'}>КУПИТЬ ¤${s.cost}</button>` : (!eq ? `<button class="ibtn small" data-equipwskin="${s.id}">НАДЕТЬ</button>` : '')}</div></div>`;
    }
  }
  return h;
}
function statsHTML() {
  let h = `<h3>ПРОКАЧКА</h3><div class="sub">очки не сгорают. каждое очко сразу меняет цифры ниже.</div>
    <div class="ptsline">СВОБОДНО <b>${S.pts}</b> ОЧКОВ · УР. ${S.level}</div>
    <div class="derived-box">${derivedText()}<br>ДАЛЬНОСТЬ <b>${Math.round(D.range)}</b> · ОТБРОС <b>${Math.round(D.kb)}</b> · РЕГЕН <b>${D.regen.toFixed(2)}/с</b></div>
    <div class="bar sk xpline"><i class="xp" style="width:${clamp(S.xp / BAL.xpNeed(S.level) * 100, 0, 100)}%"></i></div>`;
  for (const d of STATS) {
    const v = S.stats[d.k], can = S.pts > 0 && v < D.cap;
    h += `<div class="srow statrow"><div><div class="n">${d.n}</div><div class="e">${d.eff(v)}</div></div><div class="v">${v}<small>/ ${D.cap}</small></div><button class="plus" data-stat="${d.k}" ${can ? '' : 'disabled'}>+</button></div>`;
  }
  const total = Object.values(S.stats).reduce((a, b) => a + b, 0);
  h += `<div class="srow"><button class="ibtn small red" id="respecBtn" ${total && S.gold >= BAL.respecCost(S.level) ? '' : 'disabled'}>СБРОС СТАТОВ · ¤${BAL.respecCost(S.level)}</button></div>`;
  h += `<h3 style="margin-top:18px">АССЕНСИЯ</h3><div class="sub">печать эха за лучшую волну и уровень. обнуляет забег, но даёт постоянные перки.</div>`;
  h += `<div class="derived-box">ПЕЧАТИ <b>${S.seals}</b> · АССЕНСИЯ ${S.ascensions} · ПОЛУЧИШЬ <b>${ascensionGain()}</b></div>`;
  h += `<div class="acts" style="flex-wrap:wrap">`;
  for (const p of PERKS) {
    const lvl = S.perks[p.k] || 0;
    const maxed = lvl >= p.max;
    const cost = p.cost(lvl);
    h += `<button class="ibtn small" data-perk="${p.k}" ${maxed || S.seals < cost ? 'disabled' : ''}>${p.n} · ${lvl}/${p.max} · печать ${cost}</button>`;
  }
  h += `</div>`;
  const gain = ascensionGain();
  h += `<div class="acts"><button class="ibtn small red" id="ascBtn" ${S.best >= 15 && gain > 0 ? '' : 'disabled'}>ПРИНЯТЬ АССЕНСИЮ · +${gain} печати</button></div>`;
  h += `<div class="hintline">SHIFT+КЛИК = +5 · лимит стата растёт с уровнем.<br>ассенсия доступна с волны 15. сбрасывает забег, оружие, статы — печати и перки оставляет.</div>`;
  return h;
}
function challengesHTML() {
  let h = `<h3>ИСПЫТАНИЯ</h3><div class="sub">каждое испытание — отдельный забег с модификаторами. награда: шарды и печати.</div>`;
  for (const c of CHALLENGES) {
    const best = S.challenges[c.id] || 0;
    const done = best >= c.target;
    h += `<div class="srow"><div class="head"><span class="name">${c.n}</span><span class="gold">${done ? 'ПРОЙДЕНО' : `цель: волна ${c.target}`}</span></div>
      <div class="nums">${c.d}</div>
      <div class="nums" style="color:var(--gold)">награда: +${c.reward.shards}¤¤ · +${c.reward.seals} печати${best ? ' · лучший: ' + best : ''}</div>
      <div class="acts"><button class="ibtn small ${done ? '' : 'fill'}" data-challenge="${c.id}">${done ? 'ПОВТОРИТЬ' : 'НАЧАТЬ'}</button></div></div>`;
  }
  return h;
}
function recordsHTML() {
  const left = cooldownLeft();
  let h = `<h3>РЕКОРДЫ</h3><div class="sub">позывной уникален. смена — не чаще раза в 2 минуты.</div>
    <div class="nickrow"><label>ПОЗЫВНОЙ</label>
      <div class="apirow"><input id="nickInput" maxlength="16" value="${esc(S.nick)}" spellcheck="false" autocomplete="off"><button id="nickSave" class="ibtn small" ${left > 0 ? 'disabled' : ''}>СМЕНИТЬ</button></div>
      <div id="nickStatus" class="hintline" style="margin-top:8px">${left > 0 ? `следующая смена через ${left}с` : 'смена позывного доступна раз в 2 минуты'}</div>
    </div>
    <div class="tabs"><button class="tab ${boardTab === 'world' ? 'on' : ''}" data-tab="world">МИР</button><button class="tab ${boardTab === 'local' ? 'on' : ''}" data-tab="local">ЛОКАЛЬНО</button><button class="ibtn small" id="boardRefresh">↻</button></div>`;
  if (boardTab === 'local') h += S.board.length ? S.board.map(brow).join('') : `<div class="empty">пока пусто. первый забег ждёт.</div>`;
  else if (!isConfigured()) h += `<div class="empty">мировая таблица не настроена.</div>`;
  else if (status !== 'ok') h += `<div class="empty">нет связи с сервером.</div>`;
  else if (!world) h += `<div class="empty">загрузка таблицы…</div>`;
  else {
    h += `<div class="hintline" style="margin:0 0 8px">${worldMeta?.total ?? world.length} бойцов · рекорд волна ${worldMeta?.top ?? 0}</div>`;
    h += world.length ? world.map(brow).join('') : `<div class="empty">таблица пуста. стань первым.</div>`;
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
    <div class="setrow"><span>СКОРОСТЬ</span><div class="seg">${SPEEDS.map(v => `<button data-speed="${v}" class="${S.speed === v ? 'on' : ''}">${v}×</button>`).join('')}</div></div>
    <div class="setrow"><span>ТРЯСКА</span><button class="sw ${S.shake ? 'on' : ''}" id="setShake"></button></div>
    <div class="setrow"><span>ЗЕРНО</span><button class="sw ${S.grain ? 'on' : ''}" id="setGrain"></button></div>
    <div class="setrow"><span>ЧАСТИЦЫ</span><div class="seg">${['high', 'med', 'low'].map(q => `<button data-q="${q}" class="${S.quality === q ? 'on' : ''}">${{ high: 'ПОЛН', med: 'СРЕД', low: 'МИН' }[q]}</button>`).join('')}</div></div>
    <div class="setrow"><span>ПРЕДЛАГАТЬ ВОЗВРАТ<small>к лучшей волне при новом забеге</small></span><button class="sw ${S.askResume ? 'on' : ''}" id="setAsk"></button></div>
    <div class="setrow"><span>СЕРВЕР<small>общий лидборд · Cloudflare Worker</small></span><span style="font-size:10px;font-weight:700;letter-spacing:.14em;color:${connColor()}">${connText()}</span></div>
    <div class="setrow"><span class="red">СТЕРЕТЬ СОХРАНЕНИЕ<small>уровень, оружие, скины, эссенцию</small></span><button class="ibtn small red" id="wipeBtn">СТЕРЕТЬ</button></div>`;
}
function bindSheet() {
  const b = $('sheetBody');
  b.querySelectorAll('[data-buy]').forEach(el => el.addEventListener('click', () => { if (buyWeapon(el.dataset.buy)) { play('up'); emit('menu:swing'); } else play('err'); }));
  b.querySelectorAll('[data-equip]').forEach(el => el.addEventListener('click', () => { if (equipWeapon(el.dataset.equip)) { play('click'); emit('menu:swing'); } }));
  b.querySelectorAll('[data-upw]').forEach(el => el.addEventListener('click', () => { if (upgradeWeapon(el.dataset.upw)) play('up'); else play('err'); }));
  b.querySelectorAll('[data-stat]').forEach(el => el.addEventListener('click', e => { if (addStat(el.dataset.stat, e.shiftKey ? 5 : 1)) play('up'); else play('err'); }));
  b.querySelectorAll('[data-perk]').forEach(el => el.addEventListener('click', () => { if (buyPerk(el.dataset.perk)) play('up'); else play('err'); }));
  b.querySelectorAll('[data-buychar]').forEach(el => el.addEventListener('click', () => { if (buyCharSkin(el.dataset.buychar)) { play('up'); emit('menu:swing'); } else play('err'); }));
  b.querySelectorAll('[data-equipchar]').forEach(el => el.addEventListener('click', () => { if (equipCharSkin(el.dataset.equipchar)) play('click'); else play('err'); }));
  b.querySelectorAll('[data-buywskin]').forEach(el => el.addEventListener('click', () => { if (buyWeaponSkin(el.dataset.buywskin)) play('up'); else play('err'); }));
  b.querySelectorAll('[data-equipwskin]').forEach(el => el.addEventListener('click', () => { if (equipWeaponSkin(el.dataset.equipwskin)) play('click'); else play('err'); }));
  b.querySelectorAll('[data-challenge]').forEach(el => el.addEventListener('click', () => { play('click'); closeSheet(); beginRun(1, el.dataset.challenge); }));
  b.querySelectorAll('[data-atab]').forEach(el => el.addEventListener('click', () => { arsenalTab = el.dataset.atab; play('click'); renderSheet(); }));
  b.querySelectorAll('[data-stab]').forEach(el => el.addEventListener('click', () => { skinsTab = el.dataset.stab; play('click'); renderSheet(); }));
  const boxBtn = b.querySelector('[data-openbox]');
  if (boxBtn) boxBtn.addEventListener('click', () => {
    const r = openBox();
    if (!r) { play('err'); return; }
    if (r.dup) toast(`дубль · возврат ¤¤${r.refund}`, 'gold');
    else toast(`выпал скин: ${r.skin.n} (${RARITY[r.rarity].n})`, 'gold');
    play('up'); renderSheet();
  });
  const rs = b.querySelector('#respecBtn'); if (rs) rs.addEventListener('click', () => { if (respec()) { play('build'); toast('Статы сброшены. Очки возвращены.', 'gold'); } else play('err'); });
  const ab = b.querySelector('#ascBtn');
  if (ab) {
    let arm = false;
    ab.addEventListener('click', () => {
      if (!arm) { arm = true; ab.textContent = 'ТОЧНО? СБРОС ЗАБЕГА'; setTimeout(() => { arm = false; if (sheetName === 'stats') renderSheet(); }, 3000); return; }
      if (ascend()) play('level'); else play('err');
    });
  }
  b.querySelectorAll('[data-tab]').forEach(el => el.addEventListener('click', () => { boardTab = el.dataset.tab; play('click'); renderSheet(); if (boardTab === 'world') fetchWorld(); }));
  const rf = b.querySelector('#boardRefresh'); if (rf) rf.addEventListener('click', () => { play('click'); boardTab === 'world' ? fetchWorld() : renderSheet(); });
  const ni = b.querySelector('#nickInput'), ns = b.querySelector('#nickSave');
  if (ns) ns.addEventListener('click', async () => {
    const st = b.querySelector('#nickStatus');
    const v = ni.value.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!NICK_RE.test(v)) { st.textContent = '✗ позывной: 3–16 символов (буквы, цифры, _ -)'; st.style.color = 'var(--red)'; play('err'); return; }
    ns.disabled = true; ns.textContent = '…'; st.textContent = 'проверяю…'; st.style.color = 'var(--dim)';
    const r = await changeNick(v);
    if (r.ok) { st.textContent = '✓ позывной обновлён'; st.style.color = 'var(--acc)'; ni.value = r.nick; refreshMenuMeta(); play('up'); }
    else { st.textContent = '✗ ' + r.error; st.style.color = 'var(--red)'; play('err'); }
    updateNickUI();
  });
  const ss = b.querySelector('#setSound'); if (ss) ss.addEventListener('click', toggleSound);
  b.querySelectorAll('[data-speed]').forEach(el => el.addEventListener('click', () => setSpeed(+el.dataset.speed)));
  const sh = b.querySelector('#setShake'); if (sh) sh.addEventListener('click', () => { S.shake = !S.shake; saveSoon(); play('click'); renderSheet(); });
  const gr = b.querySelector('#setGrain'); if (gr) gr.addEventListener('click', () => { S.grain = !S.grain; $('grain').style.display = S.grain ? '' : 'none'; saveSoon(); play('click'); renderSheet(); });
  const sa = b.querySelector('#setAsk'); if (sa) sa.addEventListener('click', () => { S.askResume = !S.askResume; saveSoon(); play('click'); renderSheet(); });
  b.querySelectorAll('[data-q]').forEach(el => el.addEventListener('click', () => { S.quality = el.dataset.q; saveSoon(); emit('quality'); play('click'); renderSheet(); }));
  const wp = b.querySelector('#wipeBtn');
  if (wp) { let arm = false; wp.addEventListener('click', () => { if (!arm) { arm = true; wp.textContent = 'ТОЧНО?'; setTimeout(() => { arm = false; wp.textContent = 'СТЕРЕТЬ'; }, 3000); return; } ['cherta_save_v10', 'cherta_save_v9', 'cherta_save_v8', 'cherta_save_v7', 'cherta_save_v6', 'cherta_save_v5', 'cherta_save_v4', 'cherta_save_v3', 'cherta_save_v2', 'cherta_save_v1'].forEach(k => localStorage.removeItem(k)); location.reload(); }); }
}
function startNickTicker() { stopNickTicker(); nickTimer = setInterval(updateNickUI, 1000); }
function stopNickTicker() { if (nickTimer) { clearInterval(nickTimer); nickTimer = null; } }
function updateNickUI() {
  const btn = $('nickSave'), st = $('nickStatus'); if (!btn) return;
  const left = cooldownLeft();
  if (left > 0) { btn.disabled = true; btn.textContent = `СМЕНИТЬ (${left}с)`; if (st && !st.textContent.startsWith('✗') && !st.textContent.startsWith('✓')) st.textContent = `следующая смена через ${left}с`; }
  else { btn.disabled = false; btn.textContent = 'СМЕНИТЬ'; }
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
      const unlocked = buildingUnlocked(k);
      h += `<button class="topt" data-act="build" data-type="${k}" ${(unlocked && S.gold >= tw.cost) ? '' : 'disabled'}><b>${tw.name}</b><span class="cost">${!unlocked ? 'ЗАКРЫТО' : '¤' + tw.cost}</span><small><span class="tag">${tw.tag}</span> · ${tw.desc}${tw.dmg ? ` · ${tw.dmg}×${tw.rate}/с` : ''}${tw.hp ? ` · ${tw.hp} HP` : ''}${!unlocked ? '<br><i>' + reqText(tw.req || {}) + '</i>' : ''}</small></button>`;
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
  if (b.dataset.act === 'build') { if (!buildBuilding(popSlot, b.dataset.type)) play('err'); }
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
  recordLocal({ nick: S.nick, wave: boardWave, kills: d.kills, level: d.level, time: d.time, date: Date.now() });
  $('sumTitle').textContent = d.reason === 'death' ? 'ЧЕРТА ПРОРВАНА' : 'ВЫЛАЗКА ЗАВЕРШЕНА';
  $('sumTitle').classList.toggle('red', d.reason === 'death');
  $('sumWave').textContent = d.wave;
  $('sumRecord').classList.toggle('hidden', !d.record);
  $('sumMeta').textContent = `зачищено ${d.cleared} · пропущено ${d.skipped} · старт с волны ${d.startWave}${d.challenge ? ' · испытание' : ''}`;
  $('sumKills').textContent = fmtN(d.kills); $('sumTime').textContent = fmtT(d.time);
  $('sumLvl').textContent = '+' + d.lvl; $('sumGold').textContent = '+¤' + fmtN(d.gold);
  $('sumXp').textContent = '+' + fmtN(d.xp); $('sumLevel').textContent = d.level;
  $('sumNick').value = S.nick;
  const st = $('submitStatus'), btn = $('btnSubmit');
  st.textContent = ''; st.className = ''; btn.disabled = false; btn.textContent = 'ОТПРАВИТЬ РЕКОРД';
  if (!isConfigured() || status !== 'ok') { btn.disabled = true; btn.textContent = 'ЛОКАЛЬНО ✓'; st.textContent = 'рекорд сохранён на устройстве · сервер недоступен'; }
  $('summary').classList.remove('hidden');
  refreshMenuMeta();
}
async function onSubmit() {
  if (!lastSummary || G?.submitted) return;
  const btn = $('btnSubmit'), st = $('submitStatus');
  btn.disabled = true; btn.textContent = 'ОТПРАВКА…';
  try {
    const r = await submitRun({ wave: Math.max(1, lastSummary.cleared), kills: lastSummary.kills, level: lastSummary.level, time: lastSummary.time, runId: lastSummary.runId });
    if (r.ok && r.data?.ok) {
      G.submitted = true; btn.textContent = 'ПРИНЯТО ✓';
      st.textContent = r.data.kept ? 'сервер оставил твой лучший результат' : '✓ рекорд в мировой таблице';
      st.className = 'ok'; play('up'); setTimeout(fetchWorld, 600);
    } else { btn.disabled = false; btn.textContent = 'ПОВТОРИТЬ'; st.textContent = '✗ ' + (r.data?.error || 'ошибка ' + r.status); st.className = 'err'; play('err'); }
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
