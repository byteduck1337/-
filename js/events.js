const map = new Map();
export function on(key, fn) { if (!map.has(key)) map.set(key, []); map.get(key).push(fn); }
export function emit(key, ...args) { (map.get(key) || []).forEach(fn => fn(...args)); }