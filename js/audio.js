import { S } from './state.js';
let AC = null, master = null, noiseBuf = null;
export function init() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = S.sound ? .9 : 0; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const g = AC.createGain(), fl = AC.createBiquadFilter();
    g.gain.value = .04; fl.type = 'lowpass'; fl.frequency.value = 210;
    [55, 55.6, 110.3].forEach((f, i) => { const o = AC.createOscillator(); o.type = i === 2 ? 'triangle' : 'sine'; o.frequency.value = f; o.connect(fl); o.start(); });
    const lfo = AC.createOscillator(), lg = AC.createGain();
    lfo.frequency.value = .07; lg.gain.value = 70; lfo.connect(lg); lg.connect(fl.frequency); lfo.start();
    fl.connect(g); g.connect(master);
  } catch (e) { AC = null; }
}
export function resume() { if (AC && AC.state === 'suspended') AC.resume(); }
export function setMuted(m) { S.sound = !m; if (master) master.gain.setTargetAtTime(m ? 0 : .9, AC.currentTime, .05); }
function tone(type, f0, f1, t, g = .2, delay = 0) {
  if (!AC || !S.sound) return;
  const o = AC.createOscillator(), v = AC.createGain(), t0 = AC.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + t);
  v.gain.setValueAtTime(0, t0); v.gain.linearRampToValueAtTime(g, t0 + .008);
  v.gain.exponentialRampToValueAtTime(.0001, t0 + t);
  o.connect(v); v.connect(master); o.start(t0); o.stop(t0 + t + .02);
}
function noise(t, g = .2, f = 1200, type = 'lowpass', f1, delay = 0) {
  if (!AC || !S.sound) return;
  const src = AC.createBufferSource(), v = AC.createGain(), fl = AC.createBiquadFilter(), t0 = AC.currentTime + delay;
  src.buffer = noiseBuf; src.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t0);
  if (f1) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + t);
  v.gain.setValueAtTime(0, t0); v.gain.linearRampToValueAtTime(g, t0 + .01);
  v.gain.exponentialRampToValueAtTime(.0001, t0 + t);
  src.connect(fl); fl.connect(v); v.connect(master); src.start(t0); src.stop(t0 + t + .02);
}
export const SFX = {
  click: () => tone('square', 880, 660, .05, .07),
  jab: () => noise(.07, .09, 900, 'bandpass', 2200),
  swing: () => noise(.13, .12, 400, 'bandpass', 1700),
  slam: () => { noise(.3, .3, 420, 'lowpass', 60); tone('sine', 75, 38, .38, .3); },
  reap: () => { noise(.26, .16, 300, 'bandpass', 2600); tone('sine', 160, 320, .22, .08); },
  hit: () => { tone('triangle', 180, 90, .07, .14); noise(.03, .07, 2400, 'highpass'); },
  crit: () => { tone('triangle', 220, 90, .09, .18); tone('sine', 1250, 1250, .08, .1); },
  kill: () => { noise(.12, .15, 900, 'lowpass', 150); tone('sine', 300, 60, .16, .16); },
  coin: () => { tone('sine', 1320, 1320, .05, .06); tone('sine', 1760, 1760, .07, .06, .05); },
  xp: () => tone('sine', 980, 1200, .05, .04),
  level: () => [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, .14, .13, i * .09)),
  horn: () => { tone('sawtooth', 110, 110, .5, .11); tone('sawtooth', 165, 165, .5, .09); },
  clear: () => { tone('triangle', 659, 659, .12, .11); tone('triangle', 880, 880, .2, .11, .11); },
  rail: () => { tone('square', 1600, 200, .16, .09); noise(.12, .07, 3000, 'highpass', 600); },
  mg: () => { noise(.04, .05, 2000, 'bandpass'); tone('square', 420, 300, .03, .03); },
  mortar: () => tone('sine', 130, 60, .18, .13),
  boom: () => { noise(.35, .28, 420, 'lowpass', 60); tone('sine', 70, 40, .4, .28); },
  zap: () => { tone('square', 2200, 400, .1, .08); noise(.08, .06, 4000, 'highpass', 900); },
  hurt: () => { tone('sawtooth', 200, 80, .12, .18); noise(.06, .09, 700, 'lowpass'); },
  dodge: () => tone('sine', 1500, 1900, .05, .06),
  miss: () => tone('sine', 700, 500, .06, .05),
  whirl: () => { noise(.24, .18, 300, 'bandpass', 2400); tone('sine', 180, 340, .2, .09); },
  rage: () => [110, 138, 165].forEach(f => tone('sawtooth', f, f * 1.5, .55, .06)),
  death: () => { tone('sine', 220, 38, 1.2, .28); noise(1, .14, 500, 'lowpass', 60); },
  build: () => { tone('square', 220, 180, .07, .11); tone('square', 330, 330, .05, .07, .08); },
  up: () => { tone('sine', 660, 990, .1, .09); tone('sine', 990, 1320, .12, .09, .09); },
  err: () => { tone('square', 160, 160, .09, .1); tone('square', 120, 120, .12, .1, .1); },
  step: () => { tone('sine', 70, 45, .1, .12); noise(.05, .05, 200, 'lowpass'); },
  spit: () => tone('sawtooth', 600, 240, .12, .05),
  heal: () => { tone('sine', 660, 880, .12, .07); tone('sine', 880, 1100, .14, .06, .1); },
  summon: () => { tone('sawtooth', 90, 180, .3, .08); noise(.25, .06, 400, 'bandpass', 900); },
  warp: () => { tone('sine', 220, 880, .3, .1); tone('sine', 330, 1320, .3, .08, .08); noise(.3, .06, 800, 'bandpass', 2400); },
};
export const play = name => { try { SFX[name] && SFX[name](); } catch (e) {} };
export const weaponSound = kind => ({ jab: 'jab', swing: 'swing', slam: 'slam', spin: 'reap' }[kind] || 'swing');
