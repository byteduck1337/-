const map = new Map();
let depth = 0;
export function on(key, fn) { if (!map.has(key)) map.set(key, []); map.get(key).push(fn); }
export function emit(key, ...args) {
  if (depth > 24) { console.error('event recursion blocked:', key); return; }
  depth++;
  try { (map.get(key) || []).forEach(fn => { try { fn(...args); } catch (e) { console.error('[event]', key, e); } }); }
  finally { depth--; }
}