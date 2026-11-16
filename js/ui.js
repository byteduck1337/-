import { SFX } from './audio.js';

export const $ = id => document.getElementById(id);
export const openStack = [];
let hooks = { open: null, close: null };

export function setModalHooks(open, close) { hooks = { open, close }; }

export function toast(msg, cls = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + cls;
  t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 3200);
}

let bannerTimer = null;
export function banner(title, sub = '', cls = '') {
  const b = $('banner');
  $('bannerTitle').textContent = title;
  $('bannerSub').textContent = sub;
  b.className = cls;
  void b.offsetWidth;
  b.classList.add('slam');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.add('hidden'), 1900);
}

export function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

export function openModal(el) {
  el.classList.remove('hidden');
  openStack.push(el);
  if (hooks.open) hooks.open();
}

export function closeModal(el) {
  el.classList.add('hidden');
  const i = openStack.indexOf(el);
  if (i >= 0) openStack.splice(i, 1);
  if (hooks.close) hooks.close();
}

export function closeTop() {
  const el = openStack[openStack.length - 1];
  if (el && !el.hasAttribute('data-static')) { closeModal(el); return true; }
  return false;
}

export function initModals() {
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('pointerdown', e => { if (e.target === m && !m.hasAttribute('data-static')) closeModal(m); });
    m.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { SFX.click(); closeModal(m); }));
  });
}

export const ICON_SND_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
export const ICON_SND_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';