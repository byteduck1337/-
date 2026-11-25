import { WEAPONS } from './config.js';
import { S, saveSoon } from './save.js';
import { $, toast } from './ui.js';
import { SFX } from './audio.js';
import { calc } from './stats.js';

const ICONS = {
  fists: '<path d="M8 12 V8 a2 2 0 1 1 4 0 V11 M12 11 V7 a2 2 0 1 1 4 0 V11 M16 11 V8 a2 2 0 1 1 4 0 V14 a6 6 0 0 1 -6 6 h-3 a6 6 0 0 1 -6 -6 V11 a2 2 0 1 1 4 0" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/>',
  knife: '<path d="M14 3 L20 9 L10 19 L6 20 L7 16 z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M4 20 L7 17" stroke="currentColor" stroke-width="1.7"/>',
  bat: '<path d="M6 18 L16 8 M16 8 a3 3 0 1 0 4 4 L6 20 z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/>',
  machete: '<path d="M4 20 L6 16 L18 4 L20 6 L8 18 z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><circle cx="6" cy="17" r="1.5" fill="currentColor"/>',
  axe: '<path d="M4 20 L14 10 M10 8 a6 6 0 0 1 10 2 l-6 4 z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/>',
  katana: '<path d="M3 21 L19 5 L20 4 L21 5 L6 20 z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M4 20 L6 20 M3 21 L5 19" stroke="currentColor" stroke-width="1.7"/>',
  scythe: '<path d="M4 20 C4 12 12 4 20 4 C16 8 10 10 8 12 L8 20" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/>',
};

export function renderWeaponShop() {
  const list = $('weaponList');
  if (!list) return;
  list.innerHTML = '';
  for (const k in WEAPONS) {
    const w = WEAPONS[k];
    const owned = S.owned.includes(k);
    const active = S.weapon === k;
    const canBuy = !owned && S.gold >= w.cost;
    const card = document.createElement('button');
    card.className = 'weapon-card' + (active ? ' active' : '') + (owned ? ' owned' : '') + (canBuy ? ' buyable' : '');
    card.innerHTML = `
      <div class="wc-icon" style="color:${w.color}"><svg viewBox="0 0 24 24">${ICONS[k]}</svg></div>
      <div class="wc-info">
        <div class="wc-name">${w.name}</div>
        <div class="wc-desc">${w.desc}</div>
        <div class="wc-stats"><span>D×${w.dmg}</span><span>R×${w.rate}</span><span>RNG ${w.range}</span></div>
      </div>
      <div class="wc-cta">${active ? '✓' : owned ? 'ВЫБРАТЬ' : '¤' + w.cost}</div>`;
    card.addEventListener('click', () => {
      if (active) return;
      if (owned) {
        S.weapon = k;
        calc();
        SFX.click();
        saveSoon();
        renderWeaponShop();
      } else if (S.gold >= w.cost) {
        S.gold -= w.cost;
        S.owned.push(k);
        S.weapon = k;
        calc();
        SFX.purchase();
        toast(w.name + ' куплен', 'gold');
        saveSoon();
        renderWeaponShop();
        $('hubGold').textContent = S.gold;
        $('hubGold2').textContent = '¤' + S.gold;
      } else {
        SFX.err();
        toast('Не хватает золота', 'red');
      }
    });
    list.appendChild(card);
  }
}