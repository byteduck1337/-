import { S, saveSoon } from './save.js';

let AC = null, master = null, noiseBuf = null, padNodes = null;

export function audioInit() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = S.sound ? 0.9 : 0;
    master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startPad();
  } catch (e) { AC = null; }
}

export function setMuted(m) {
  S.sound = !m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, AC.currentTime, .05);
  saveSoon();
}

function tone(type, f0, f1, t, g = .2, delay = 0) {
  if (!AC || !S.sound) return;
  const o = AC.createOscillator(), v = AC.createGain(), t0 = AC.currentTime + delay;
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + t);
  v.gain.setValueAtTime(0, t0);
  v.gain.linearRampToValueAtTime(g, t0 + .008);
  v.gain.exponentialRampToValueAtTime(.0001, t0 + t);
  o.connect(v); v.connect(master); o.start(t0); o.stop(t0 + t + .02);
}

function noise(t, g = .2, f = 1200, type = 'lowpass', f1, delay = 0) {
  if (!AC || !S.sound) return;
  const src = AC.createBufferSource(), v = AC.createGain(), fl = AC.createBiquadFilter(), t0 = AC.currentTime + delay;
  src.buffer = noiseBuf; src.loop = true;
  fl.type = type; fl.frequency.setValueAtTime(f, t0);
  if (f1) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + t);
  fl.Q.value = 1;
  v.gain.setValueAtTime(0, t0);
  v.gain.linearRampToValueAtTime(g, t0 + .01);
  v.gain.exponentialRampToValueAtTime(.0001, t0 + t);
  src.connect(fl); fl.connect(v); v.connect(master); src.start(t0); src.stop(t0 + t + .02);
}

function startPad() {
  if (!AC || padNodes) return;
  const g = AC.createGain(), fl = AC.createBiquadFilter();
  g.gain.value = .045; fl.type = 'lowpass'; fl.frequency.value = 220;
  const o1 = AC.createOscillator(), o2 = AC.createOscillator(), o3 = AC.createOscillator();
  o1.type = 'sine'; o1.frequency.value = 55;
  o2.type = 'sine'; o2.frequency.value = 55.6;
  o3.type = 'triangle'; o3.frequency.value = 110.3;
  const lfo = AC.createOscillator(), lg = AC.createGain();
  lfo.frequency.value = .07; lg.gain.value = 70;
  lfo.connect(lg); lg.connect(fl.frequency);
  o1.connect(fl); o2.connect(fl); o3.connect(fl); fl.connect(g); g.connect(master);
  o1.start(); o2.start(); o3.start(); lfo.start();
  padNodes = { g };
}

export const SFX = {
  click: () => tone('square', 880, 660, .05, .08),
  swing: () => noise(.11, .1, 500, 'bandpass', 1600),
  hit: () => { tone('triangle', 180, 90, .07, .16); noise(.03, .08, 2400, 'highpass'); },
  crit: () => { tone('triangle', 220, 90, .09, .2); tone('sine', 1250, 1250, .08, .12); },
  kill: () => { noise(.12, .16, 900, 'lowpass', 150); tone('sine', 300, 60, .16, .18); },
  coin: () => { tone('sine', 1320, 1320, .05, .07); tone('sine', 1760, 1760, .07, .07, .05); },
  xp: () => tone('sine', 980, 1200, .05, .045),
  level: () => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, .14, .14, i * .09)); },
  horn: () => { tone('sawtooth', 110, 110, .5, .12); tone('sawtooth', 165, 165, .5, .1); noise(.4, .05, 300, 'lowpass'); },
  clear: () => { tone('triangle', 659, 659, .12, .12); tone('triangle', 880, 880, .2, .12, .11); },
  rail: () => { tone('square', 1600, 200, .16, .1); noise(.12, .08, 3000, 'highpass', 600); },
  mg: () => { noise(.04, .06, 2000, 'bandpass'); tone('square', 420, 300, .03, .04); },
  mortar: () => tone('sine', 130, 60, .18, .14),
  boom: () => { noise(.35, .3, 420, 'lowpass', 60); tone('sine', 70, 40, .4, .3); },
  hurt: () => { tone('sawtooth', 200, 80, .12, .2); noise(.06, .1, 700, 'lowpass'); },
  dodge: () => tone('sine', 1500, 1900, .05, .07),
  whirl: () => { noise(.24, .2, 300, 'bandpass', 2400); tone('sine', 180, 340, .2, .1); },
  rage: () => { [110, 138, 165].forEach(f => tone('sawtooth', f, f * 1.5, .55, .07)); },
  death: () => { tone('sine', 220, 38, 1.2, .3); noise(1, .15, 500, 'lowpass', 60); },
  build: () => { tone('square', 220, 180, .07, .12); tone('square', 330, 330, .05, .08, .08); noise(.06, .08, 1200, 'bandpass'); },
  up: () => { tone('sine', 660, 990, .1, .1); tone('sine', 990, 1320, .12, .1, .09); },
  err: () => { tone('square', 160, 160, .09, .12); tone('square', 120, 120, .12, .12, .1); },
  step: () => { tone('sine', 70, 45, .1, .14); noise(.05, .06, 200, 'lowpass'); },
  spit: () => tone('sawtooth', 600, 240, .12, .06),
  purchase: () => { [660, 880, 1100].forEach((f, i) => tone('sine', f, f, .12, .1, i * .06)); },
};