import { BAL, STAT_DEFS, WEAPONS } from './config.js';
import { S, saveSoon } from './save.js';
import { $ } from './ui.js';

export let D = {};
export function calc() {
  const st = S.stats, lm = 1 + .04 * (S.level - 1);
  const w = WEAPONS[S.weapon] || WEAPONS.fists;
  D = {
    dmg: 10 * (1 + .14 * st.str) * lm * w.dmg,
    rate: Math.min(6, 1.1 * (1 + .03 * st.agi) * w.rate),
    maxHp: Math.round((100 + 18 * st.vit) * lm),
    crit: Math.min(.7, .05 + .012 * st.pre + (w.critBonus || 0)),
    critM: 1.5 + .04 * st.pre,
    dodge: Math.min(.3, .005 * st.agi),
    regen: .25 * st.vit,
    move: 170 + 2 * st.agi,
    range: w.range,
    knock: w.knock,
    goldM: 1 + .05 * st.lck,
    xpM: 1 + .04 * st.lck,
    tDmg: 1 + .12 * st.eng,
    tRate: 1 + .04 * st.eng,
    whirlCd: 7 * (1 - Math.min(.35, .01 * st.agi)),
    cap: BAL.statCap(S.level),
  };
  return D;
}
calc();

const statRows = [];
let addStatFn = null;
export function setAddStatHook(fn) { addStatFn = fn; }

export function buildStatList(container) {
  STAT_DEFS.forEach(def => {
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `<svg viewBox="0 0 24 24">${def.icon}</svg>
      <div><div class="stat-name">${def.n}</div><div class="stat-eff"></div></div>
      <div class="stat-val"><span>0</span><small>/ 0</small></div>
      <button class="stat-plus" aria-label="+${def.n}">+</button>`;
    row.querySelector('.stat-plus').addEventListener('click', e => { if (addStatFn) addStatFn(def.k, e.shiftKey ? 5 : 1); });
    container.appendChild(row);
    statRows.push({ def, row, eff: row.querySelector('.stat-eff'), val: row.querySelector('.stat-val span'),
      capEl: row.querySelector('.stat-val small'), btn: row.querySelector('.stat-plus') });
  });
}

export function refreshStats() {
  statRows.forEach(r => {
    const v = S.stats[r.def.k], can = S.pts > 0 && v < D.cap;
    r.val.textContent = v;
    r.capEl.textContent = '/ ' + D.cap;
    r.eff.textContent = r.def.eff(v);
    r.btn.disabled = !can;
    r.row.classList.toggle('can', can);
  });
  $('hubLevel').textContent = S.level;
  $('mPts').textContent = S.pts;
  $('hubCap').textContent = 'ЛИМИТ ' + D.cap;
  const need = BAL.xpNeed(S.level), pct = Math.min(100, S.xp / need * 100);
  $('hubXpFill').style.width = pct + '%';
  $('hubXpText').textContent = `${Math.floor(S.xp)} / ${need} XP`;
  const hb = $('hubPts'); hb.classList.toggle('hidden', S.pts <= 0); hb.textContent = '+' + S.pts;
  const pb = $('ptsBadge'); pb.classList.toggle('hidden', S.pts <= 0); pb.textContent = '+' + S.pts;
  $('btnRespec').textContent = `СБРОС · ¤${BAL.respecCost(S.level)}`;
  $('btnRespec').disabled = Object.values(S.stats).every(v => v === 0);
}

export function addStat(k, n) {
  const cur = S.stats[k], room = Math.min(S.pts, D.cap - cur, n);
  if (room <= 0) { saveSoon(); return false; }
  S.stats[k] += room;
  S.pts -= room;
  calc();
  saveSoon();
  return true;
}