import { API_BASE, NICK_COOLDOWN } from './config.js';
import { S, setIdentity, setNick, saveSoon, saveNow, pushLocal } from './state.js';
import { emit } from './events.js';
import { uuid, NICK_RE } from './utils.js';

export const isConfigured = () => !!API_BASE;
export let status = 'off';      // off | load | ok | err
export let identityReady = false;
export let world = null, worldMeta = null;

const base = () => API_BASE.replace(/\/+$/, '');

async function api(path, body, ms = 8000) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(base() + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}), signal: ctl.signal,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } finally { clearTimeout(to); }
}
async function getJSON(path, ms = 8000) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(base() + path, { signal: ctl.signal });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } finally { clearTimeout(to); }
}
const newToken = () => (uuid() + uuid()).replace(/-/g, '');

export function cooldownLeft() {
  if (!S.nickChangedAt) return 0;
  return Math.max(0, NICK_COOLDOWN - Math.floor((Date.now() - S.nickChangedAt) / 1000));
}

export async function initIdentity() {
  if (!isConfigured()) { status = 'off'; identityReady = false; emit('net'); return; }
  status = 'load'; emit('net');
  try {
    if (!S.playerId || !S.playerToken) {
      const id = uuid(), token = newToken();
      const r = await api('/api/player/create', { id, token, nick: S.nick });
      if (r.ok && r.data?.ok) {
        setIdentity(id, token); setNick(r.data.nick);
        S.nickChangedAt = r.data.nickChangedAt || 0; saveNow();
        identityReady = true; status = 'ok';
      } else status = 'err';
    } else {
      let r = await api('/api/player/me', { id: S.playerId, token: S.playerToken });
      if (r.status === 401) {
        const id = uuid(), token = newToken();
        r = await api('/api/player/create', { id, token, nick: S.nick });
        if (r.ok && r.data?.ok) { setIdentity(id, token); }
      }
      if (r.ok && r.data?.ok) {
        setNick(r.data.nick); S.nickChangedAt = r.data.nickChangedAt || 0; saveNow();
        identityReady = true; status = 'ok';
      } else status = 'err';
    }
  } catch (e) { status = 'err'; }
  emit('net');
  if (status === 'ok') fetchWorld();
}

export async function changeNick(raw) {
  const nick = String(raw || '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!NICK_RE.test(nick)) return { ok: false, error: 'позывной: 3–16 символов (буквы, цифры, _ -)' };
  if (!isConfigured()) return { ok: false, error: 'сервер не настроен' };
  if (!identityReady) return { ok: false, error: 'нет связи с сервером' };
  const left = cooldownLeft();
  if (left > 0) return { ok: false, error: `ник можно менять раз в 2 минуты · подожди ${left}с`, cooldown: left };
  try {
    const r = await api('/api/player/nick', { id: S.playerId, token: S.playerToken, nick });
    if (r.ok && r.data?.ok) {
      setNick(r.data.nick); S.nickChangedAt = r.data.nickChangedAt || Date.now(); saveNow();
      emit('net'); fetchWorld();
      return { ok: true, nick: r.data.nick };
    }
    if (r.status === 429 && r.data?.cooldown) {
      S.nickChangedAt = Date.now() - (NICK_COOLDOWN - r.data.cooldown) * 1000; saveSoon();
    }
    return { ok: false, error: r.data?.error || 'ошибка сети', cooldown: r.data?.cooldown || 0, status: r.status };
  } catch (e) { return { ok: false, error: 'сервер недоступен' }; }
}

export async function fetchWorld() {
  if (!isConfigured()) { world = null; emit('board'); return; }
  try {
    const r = await getJSON('/api/leaderboard?limit=50');
    if (r.ok && r.data?.ok) { world = r.data.entries; worldMeta = { total: r.data.total, top: r.data.top }; }
    else { world = world || null; }
  } catch (e) { world = world || null; }
  emit('board');
}

export async function submitRun(entry) {
  if (!isConfigured() || !identityReady) return { ok: false, status: 0, data: { error: 'нет связи с сервером' } };
  return api('/api/submit', { id: S.playerId, token: S.playerToken, ...entry });
}

export function recordLocal(entry) { pushLocal(entry); emit('board'); }
