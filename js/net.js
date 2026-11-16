import { S, pushLocal } from './state.js';
import { DEFAULT_API } from './config.js';
import { emit } from './events.js';

export const apiBase = () => (S.api || DEFAULT_API || '').replace(/\/+$/, '');
export let world = null, worldMeta = null, status = 'off';

async function fetchJSON(url, opt = {}, ms = 6500) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, Object.assign({ signal: ctl.signal }, opt));
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } finally { clearTimeout(to); }
}
export async function fetchWorld() {
  if (!apiBase()) { status = 'off'; world = null; emit('board'); return; }
  status = 'load'; emit('board');
  try {
    const r = await fetchJSON(apiBase() + '/api/leaderboard?limit=50');
    if (r.ok && r.data?.ok) { world = r.data.entries; worldMeta = { total: r.data.total, top: r.data.top }; status = 'ok'; }
    else status = 'err';
  } catch (e) { status = 'err'; }
  emit('board');
}
export async function checkApi(url) {
  const r = await fetchJSON(url + '/api/stats');
  if (r.ok && r.data?.ok) return r.data;
  throw new Error('bad response');
}
export async function submit(entry) {
  return fetchJSON(apiBase() + '/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
}
export function recordLocal(entry) { pushLocal(entry); emit('board'); }
