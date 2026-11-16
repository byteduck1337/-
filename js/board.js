import { fmtT, fmtN, DEFAULT_API } from './config.js';
import { S } from './save.js';
import { $, esc } from './ui.js';

export let boardTab = 'world', worldBoard = null, worldMeta = null, boardLoading = false;
export const apiBase = () => (S.api || DEFAULT_API || '').replace(/\/+$/, '');

export async function fetchJSON(url, opt = {}, ms = 6500) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, Object.assign({ signal: ctl.signal }, opt));
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } finally { clearTimeout(to); }
}

export function setBoardStatus(cls) { $('boardStatus').className = 'status ' + cls; }

export async function fetchWorld() {
  if (!apiBase()) { worldBoard = null; setBoardStatus(''); renderBoard(); return; }
  if (boardLoading) return;
  boardLoading = true;
  setBoardStatus('load');
  $('btnBoardRefresh').classList.add('spin');
  if (boardTab === 'world') renderBoard();
  try {
    const r = await fetchJSON(apiBase() + '/api/leaderboard?limit=50');
    if (r.ok && r.data && r.data.ok) {
      worldBoard = r.data.entries;
      worldMeta = { total: r.data.total, top: r.data.top };
      setBoardStatus('ok');
    } else {
      setBoardStatus('err');
      worldBoard = worldBoard || [];
    }
  } catch (e) {
    setBoardStatus('err');
    worldBoard = worldBoard || [];
  }
  boardLoading = false;
  $('btnBoardRefresh').classList.remove('spin');
  renderBoard();
}

function brow(e, i) {
  const me = e.nick && e.nick.toUpperCase() === S.nick.toUpperCase();
  return `<div class="brow r${i + 1}${me ? ' me' : ''}"><span class="rk">${String(i + 1).padStart(2, '0')}</span>
    <span class="nk">${esc(e.nick)}<small>LV${e.level | 0} · ✕${fmtN(e.kills | 0)} · ${fmtT(e.time | 0)}</small></span>
    <span class="wv">${e.wave | 0}<small>ВОЛНА</small></span></div>`;
}

export function renderBoard() {
  const list = $('boardList'), meta = $('boardMeta');
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === boardTab));
  if (boardTab === 'local') {
    meta.textContent = 'ТВОИ ЛУЧШИЕ ЗАБЕГИ · LOCALSTORAGE';
    if (!S.board.length) { list.innerHTML = '<div class="board-empty">Пока пусто.<br>Первый забег ждёт.</div>'; return; }
    list.innerHTML = S.board.map((e, i) => brow(e, i)).join('');
    return;
  }
  if (!apiBase()) {
    meta.textContent = 'WORKER НЕ ПОДКЛЮЧЁН';
    list.innerHTML = '<div class="board-empty">Мировая таблица живёт на Cloudflare Worker.<br>Задеплой worker.js и вставь адрес в настройках.</div>';
    return;
  }
  if (boardLoading && !worldBoard) {
    meta.textContent = 'ЗАГРУЗКА…';
    list.innerHTML = '<div class="skel"></div>'.repeat(6);
    return;
  }
  if (!worldBoard) {
    meta.textContent = 'СЕРВЕР НЕ ОТВЕТИЛ';
    list.innerHTML = '<div class="board-empty">Не удалось получить таблицу.<br>Проверь адрес воркера.</div>';
    return;
  }
  meta.textContent = `${worldMeta ? worldMeta.total : worldBoard.length} БОЙЦОВ · РЕКОРД: ВОЛНА ${worldMeta ? worldMeta.top : (worldBoard[0] ? worldBoard[0].wave : 0)}`;
  if (!worldBoard.length) { list.innerHTML = '<div class="board-empty">Таблица пуста.<br>Стань первым.</div>'; return; }
  list.innerHTML = worldBoard.map((e, i) => brow(e, i)).join('');
}

export function pushLocal(entry) {
  S.board.push(entry);
  S.board.sort((a, b) => b.wave - a.wave || b.kills - a.kills);
  S.board = S.board.slice(0, 12);
}