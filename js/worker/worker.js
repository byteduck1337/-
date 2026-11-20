/* ЧЕРТА — общий сервер игроков и лидборда.
   Cloudflare Worker + D1 (binding DB). Ник принадлежит игроку (id+token),
   уникальность ника проверяется по nick_lower, смена не чаще 120 секунд.
   Лидборд хранится по player_id — смена ника не может занять чужое место. */

const NICK_RE = /^[A-Za-zА-Яа-яЁё0-9_\- ]{3,16}$/;
const NICK_COOLDOWN_MS = 120000;
const CREATE_COOLDOWN_MS = 5000;
const RUN_TTL_MS = 86400000;
const MAX_BODY = 2048;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allow = (env.ALLOWED_ORIGIN || '*').split(',').map(s => s.trim());
    const cors = {
      'Access-Control-Allow-Origin': allow.includes('*') ? '*' : (allow.includes(origin) ? origin : allow[0]),
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400', 'Vary': 'Origin',
    };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
      status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors },
    });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      if (request.method === 'GET' && url.pathname === '/')
        return json({ ok: true, service: 'cherta-lb', db: 'd1', routes: ['/api/stats', '/api/leaderboard', '/api/player/create', '/api/player/me', '/api/player/nick', '/api/submit'] });

      if (request.method === 'GET' && url.pathname === '/api/stats') {
        const c = await env.DB.prepare('SELECT COUNT(*) c FROM players').first();
        const t = await env.DB.prepare('SELECT MAX(best_wave) m FROM players').first();
        return json({ ok: true, players: c?.c || 0, top: t?.m || 0 });
      }

      if (request.method === 'GET' && url.pathname === '/api/leaderboard') {
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
        const rows = await env.DB.prepare(
          'SELECT nick, best_wave wave, best_kills kills, best_level level, best_time time FROM players WHERE best_wave > 0 ORDER BY best_wave DESC, best_kills DESC, best_time ASC LIMIT ?'
        ).bind(limit).all();
        const c = await env.DB.prepare('SELECT COUNT(*) c FROM players WHERE best_wave > 0').first();
        const t = await env.DB.prepare('SELECT MAX(best_wave) m FROM players').first();
        return json({ ok: true, total: c?.c || 0, top: t?.m || 0, entries: rows.results || [] });
      }

      if (request.method !== 'POST') return json({ ok: false, error: 'не найдено' }, 404);

      const raw = await request.text();
      if (raw.length > MAX_BODY) return json({ ok: false, error: 'слишком большой запрос' }, 413);
      let b; try { b = JSON.parse(raw); } catch { return json({ ok: false, error: 'некорректный JSON' }, 400); }
      const now = Date.now();
      const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';

      /* ---- создание игрока ---- */
      if (url.pathname === '/api/player/create') {
        const id = String(b.id || '').slice(0, 64), token = String(b.token || '').slice(0, 128);
        if (id.length < 8 || token.length < 16) return json({ ok: false, error: 'некорректные учётные данные' }, 400);
        const hash = await sha256(token);
        const existing = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
        if (existing) {
          if (existing.token_hash === hash) return json(me(existing, now));
          return json({ ok: false, error: 'id уже занят' }, 409);
        }
        const ck = 'create:' + ip;
        const cd = await env.DB.prepare('SELECT until FROM cooldowns WHERE key = ?').bind(ck).first();
        if (cd && cd.until > now) return json({ ok: false, error: 'слишком часто' }, 429);
        await env.DB.prepare('INSERT OR REPLACE INTO cooldowns(key, until) VALUES(?, ?)').bind(ck, now + CREATE_COOLDOWN_MS).run();

        let nick = normalizeNick(b.nick);
        if (!NICK_RE.test(nick) || await nickTaken(env, nick, null)) nick = await freeNick(env);
        try {
          await env.DB.prepare(
            'INSERT INTO players(id, token_hash, nick, nick_lower, nick_changed_at, created_at) VALUES(?,?,?,?,0,?)'
          ).bind(id, hash, nick, nick.toLowerCase(), now).run();
        } catch (e) {
          nick = await freeNick(env);
          await env.DB.prepare(
            'INSERT INTO players(id, token_hash, nick, nick_lower, nick_changed_at, created_at) VALUES(?,?,?,?,0,?)'
          ).bind(id, hash, nick, nick.toLowerCase(), now).run();
        }
        const p = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
        return json(me(p, now));
      }

      /* ---- кто я ---- */
      if (url.pathname === '/api/player/me') {
        const p = await auth(env, b.id, b.token);
        if (!p) return json({ ok: false, error: 'не авторизован' }, 401);
        return json(me(p, now));
      }

      /* ---- смена позывного ---- */
      if (url.pathname === '/api/player/nick') {
        const p = await auth(env, b.id, b.token);
        if (!p) return json({ ok: false, error: 'не авторизован' }, 401);
        const nick = normalizeNick(b.nick);
        if (!NICK_RE.test(nick)) return json({ ok: false, error: 'позывной: 3–16 символов (буквы, цифры, _ -)' }, 400);
        const left = NICK_COOLDOWN_MS - (now - (p.nick_changed_at || 0));
        if (p.nick_changed_at && left > 0)
          return json({ ok: false, error: 'ник можно менять раз в 2 минуты', cooldown: Math.ceil(left / 1000) }, 429);
        if (nick.toLowerCase() === p.nick_lower) return json(me(p, now));
        if (await nickTaken(env, nick, p.id)) return json({ ok: false, error: 'ник уже занят' }, 409);
        try {
          await env.DB.prepare('UPDATE players SET nick = ?, nick_lower = ?, nick_changed_at = ? WHERE id = ?')
            .bind(nick, nick.toLowerCase(), now, p.id).run();
        } catch (e) { return json({ ok: false, error: 'ник уже занят' }, 409); }
        const upd = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(p.id).first();
        return json(me(upd, now));
      }

      /* ---- отправка рекорда ---- */
      if (url.pathname === '/api/submit') {
        const p = await auth(env, b.id, b.token);
        if (!p) return json({ ok: false, error: 'не авторизован' }, 401);
        const wave = Math.floor(Number(b.wave)), kills = Math.floor(Number(b.kills));
        const level = Math.floor(Number(b.level)), time = Math.floor(Number(b.time));
        const runId = String(b.runId || '').slice(0, 64);
        if (!Number.isFinite(wave) || wave < 1 || wave > 500) return json({ ok: false, error: 'волна вне диапазона' }, 400);
        if (!Number.isFinite(kills) || kills < 0 || kills > 100000) return json({ ok: false, error: 'убийства вне диапазона' }, 400);
        if (!Number.isFinite(level) || level < 1 || level > 5 + 2 * wave) return json({ ok: false, error: 'уровень неправдоподобен' }, 400);
        if (!Number.isFinite(time) || time < wave * 6 || time > 21600) return json({ ok: false, error: 'время неправдоподобно' }, 400);
        if (!runId) return json({ ok: false, error: 'нет runId' }, 400);
        const cumMin = .4 * (6 * (wave - 1) + .75 * (wave - 1) ** 2);
        const cumMax = 3 * (6 * wave + .75 * wave * wave) + 80;
        if (kills < Math.floor(cumMin) || kills > Math.ceil(cumMax)) return json({ ok: false, error: 'убийства не сходятся с волной' }, 400);

        const ins = await env.DB.prepare('INSERT OR IGNORE INTO runs(run_id, player_id, created_at) VALUES(?,?,?)')
          .bind(runId, p.id, now).run();
        if (!ins.meta?.changes) return json({ ok: false, error: 'забег уже отправлен' }, 409);

        const better = wave > p.best_wave || (wave === p.best_wave && kills > p.best_kills);
        if (better) {
          await env.DB.prepare(
            'UPDATE players SET best_wave=?, best_kills=?, best_level=?, best_time=?, best_at=?, runs=runs+1 WHERE id=?'
          ).bind(wave, kills, level, time, now, p.id).run();
        } else {
          await env.DB.prepare('UPDATE players SET runs=runs+1 WHERE id=?').bind(p.id).run();
        }
        ctx.waitUntil(env.DB.prepare('DELETE FROM runs WHERE created_at < ?').bind(now - RUN_TTL_MS).run());
        return json({ ok: true, kept: !better, nick: p.nick });
      }

      return json({ ok: false, error: 'не найдено' }, 404);
    } catch (e) {
      return json({ ok: false, error: 'внутренняя ошибка' }, 500);
    }
  },
};

function normalizeNick(v) { return String(v || '').trim().replace(/\s+/g, ' ').toUpperCase(); }
function me(p, now) {
  const left = Math.max(0, NICK_COOLDOWN_MS - (now - (p.nick_changed_at || 0)));
  return { ok: true, nick: p.nick, nickChangedAt: p.nick_changed_at || 0, cooldown: Math.ceil(left / 1000) };
}
async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function auth(env, id, token) {
  id = String(id || '').slice(0, 64); token = String(token || '').slice(0, 128);
  if (id.length < 8 || token.length < 16) return null;
  const p = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
  if (!p) return null;
  return (await sha256(token)) === p.token_hash ? p : null;
}
async function nickTaken(env, nick, exceptId) {
  const row = exceptId
    ? await env.DB.prepare('SELECT id FROM players WHERE nick_lower = ? AND id <> ?').bind(nick.toLowerCase(), exceptId).first()
    : await env.DB.prepare('SELECT id FROM players WHERE nick_lower = ?').bind(nick.toLowerCase()).first();
  return !!row;
}
async function freeNick(env) {
  for (let i = 0; i < 24; i++) {
    const n = 'БОЕЦ-' + Math.floor(1000 + Math.random() * 9000);
    if (!(await nickTaken(env, n, null))) return n;
  }
  return 'БОЕЦ-' + Date.now().toString(36).toUpperCase().slice(-6);
}