import { view } from './view.js?v=8';
import { emit } from './events.js?v=8';
import { init as audioInit, resume } from './audio.js?v=8';

export const keys = new Set();
export const pointer = { dragX: null };
let down = null, dragged = false;

export function init(canvas) {
  document.addEventListener('keydown', e => {
    if (e.target.closest('input,textarea,select')) { if (e.code === 'Escape') e.target.blur(); return; }
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    const menu = view.screen === 'menu';
    switch (e.code) {
      case 'Space': if (menu) emit('menu:swing'); else emit('key', 'whirl'); break;
      case 'KeyE': if (!menu) emit('key', 'rage'); break;
      case 'KeyN': if (!menu) emit('key', 'next'); break;
      case 'KeyP': if (!menu) emit('key', 'pause'); break;
      case 'KeyC': emit('key', 'stats'); break;
      case 'KeyM': emit('key', 'mute'); break;
      case 'Escape': emit('key', 'escape'); break;
      case 'ArrowUp': case 'KeyW': if (menu) emit('nav', -1); break;
      case 'ArrowDown': case 'KeyS': if (menu) emit('nav', 1); break;
      case 'Enter': if (menu) emit('navEnter'); break;
    }
  });
  document.addEventListener('keyup', e => keys.delete(e.code));
  document.addEventListener('pointerdown', () => { audioInit(); resume(); });
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, id: e.pointerId }; dragged = false; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} });
  canvas.addEventListener('pointermove', e => {
    if (!down || e.pointerId !== down.id) return;
    if (Math.abs(e.clientX - down.x) > 10) dragged = true;
    if (dragged && view.screen === 'battle') pointer.dragX = e.clientX;
  });
  canvas.addEventListener('pointerup', e => {
    if (!down || e.pointerId !== down.id) return;
    pointer.dragX = null;
    if (!dragged) emit(view.screen === 'menu' ? 'menu:swing' : 'tap');
    down = null; dragged = false;
  });
  canvas.addEventListener('pointercancel', () => { down = null; dragged = false; pointer.dragX = null; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}