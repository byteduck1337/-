import { clamp } from './utils.js?v=8';
export const view = { W: 0, H: 0, DPR: 1, cx: 0, ground: 0, dockH: 0, screen: 'menu' };
export function computeView() {
  view.W = innerWidth; view.H = innerHeight;
  view.DPR = Math.min(2, devicePixelRatio || 1);
  view.cx = view.W / 2;
  view.ground = view.H - clamp(170, view.H * .26, 250);
}