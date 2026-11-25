import { S } from './state.js?v=8';
let AC = null, master = null, musicBus = null, busLP = null, noiseBuf = null;
let tickTimer = null, sceneName = 'menu';
const tracks = {};
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
const rr = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);

const DEFS = {
menu: {
  name: 'menu', bpm: 68, swing: .12, level: .4, barsPer: 2, crackle: .32,
  chords: [
    [57, 60, 64, 67],
    [53, 57, 60, 64],
    [55, 59, 62, 65],
    [52, 55, 59, 62],
    [57, 60, 64, 67],
    [50, 53, 57, 60],
    [55, 59, 62, 67],
    [53, 57, 60, 65],
  ],
  roots: [45, 41, 43, 40, 45, 38, 43, 41],
  penta: [69, 72, 74, 76, 79, 81, 84],
},
battle: {
  name: 'battle', bpm: 92, swing: 0, level: .38, barsPer: 2, crackle: .16,
  chords: [
    [57, 60, 64],
    [53, 57, 60],
    [48, 52, 55],
    [55, 59, 62],
    [57, 60, 64],
    [52, 55, 59],
    [53, 57, 60],
    [55, 59, 62],
  ],
  roots: [45, 41, 36, 43, 45, 40, 41, 43],
  penta: [69, 72, 74, 76, 79, 81],
},
};

export function init() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = S.sound ? .9 : 0;
    master.connect(AC.destination);
    const comp = AC.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 22; comp.ratio.value = 2.5;
    comp.attack.value = .008; comp.release.value = .32;
    comp.connect(master);
    busLP = AC.createBiquadFilter();
    busLP.type = 'lowpass'; busLP.frequency.value = 4200; busLP.Q.value = .4;
    busLP.connect(comp);
    musicBus = AC.createGain();
    musicBus.gain.value = .55;
    musicBus.connect(busLP);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    tickTimer = setInterval(tick, 90);
    setScene(sceneName);
  } catch (e) { AC = null; }
}
export function resume() { if (AC && AC.state === 'suspended') AC.resume(); }
export function setMuted(m) { S.sound = !m; if (master) master.gain.setTargetAtTime(m ? 0 : .9, AC.currentTime, .05); }
export function duck(on) { if (AC && musicBus) musicBus.gain.setTargetAtTime(on ? .15 : .55, AC.currentTime, .18); }
export function setScene(name) {
  sceneName = name;
  if (!AC) return;
  if (!tracks[name]) ensureTrack(name);
  for (const k in tracks) {
    const tr = tracks[k];
    clearTimeout(tr.stopTimer);
    if (k === name) {
      tr.active = true;
      if (tr.next < AC.currentTime) tr.next = AC.currentTime + .08;
      tr.out.gain.setTargetAtTime(tr.d.level, AC.currentTime, .6);
    } else if (tr.active) {
      tr.out.gain.setTargetAtTime(0, AC.currentTime, .5);
      tr.stopTimer = setTimeout(() => { tr.active = false; }, 2000);
    }
  }
}
function ensureTrack(name) {
  const d = DEFS[name];
  const out = AC.createGain();
  out.gain.value = 0;
  out.connect(musicBus);
  const padFl = AC.createBiquadFilter();
  padFl.type = 'lowpass';
  padFl.frequency.value = name === 'battle' ? 950 : 850;
  padFl.Q.value = .55;
  const drift = AC.createOscillator();
  drift.frequency.value = .04 + Math.random() * .02;
  const dg = AC.createGain();
  dg.gain.value = name === 'battle' ? 260 : 180;
  drift.connect(dg); dg.connect(padFl.frequency); drift.start();
  const pump = AC.createGain();
  pump.gain.value = 1;
  padFl.connect(pump); pump.connect(out);
  const delay = AC.createDelay(1.5);
  delay.delayTime.value = 60 / d.bpm * .55;
  const fb = AC.createGain();
  fb.gain.value = .28;
  const dFl = AC.createBiquadFilter();
  dFl.type = 'lowpass'; dFl.frequency.value = 2200;
  delay.connect(fb); fb.connect(delay); delay.connect(dFl); dFl.connect(out);
  const cb = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), cd = cb.getChannelData(0);
  for (let i = 0; i < cd.length; i++) {
    cd[i] = (Math.random() * 2 - 1) * .005;
    if (Math.random() < .00025) {
      const a = rr(.12, .35);
      for (let k = 0; k < 20 && i + k < cd.length; k++) cd[i + k] += a * Math.exp(-k / 5) * (Math.random() * 2 - 1);
    }
  }
  const cs = AC.createBufferSource();
  cs.buffer = cb; cs.loop = true;
  const cg = AC.createGain();
  cg.gain.value = d.crackle;
  cs.connect(cg); cg.connect(out); cs.start();
  tracks[name] = { d, out, padFl, pump, delay, step: 0, bar: 0, chordIdx: 0, cycle: 0, next: AC.currentTime + .12, active: false, stopTimer: null };
}
function tick() {
  if (!AC) return;
  for (const k in tracks) {
    const tr = tracks[k];
    if (!tr.active) continue;
    const sd = 60 / tr.d.bpm / 4;
    while (tr.next < AC.currentTime + 1.2) {
      const s = tr.step, t = tr.next + (tr.d.swing && s % 2 ? sd * tr.d.swing : 0);
      scheduleStep(tr, s, t, sd);
      tr.next += sd; tr.step++;
      if (tr.step >= 16) {
        tr.step = 0; tr.bar++;
        if (tr.bar % tr.d.barsPer === 0) {
          tr.chordIdx++;
          if (tr.chordIdx >= tr.d.chords.length) { tr.chordIdx = 0; tr.cycle++; }
        }
      }
    }
  }
}
function scheduleStep(tr, s, t, sd) {
  const d = tr.d, chord = d.chords[tr.chordIdx], root = d.roots[tr.chordIdx];
  const hum = rr(.9, 1.06);
  const humanize = () => rr(-.006, .006);
  if (d.name === 'battle') {
    const breakBar = tr.cycle % 5 === 4 && tr.bar % 8 === 7;
    if (s === 0 && tr.bar % d.barsPer === 0) pad(tr, chord, t, d.barsPer * sd * 16 * .97);
    if (breakBar) {
      if (s === 8 && Math.random() < .5) arp(tr, chord[(tr.cycle + 2) % chord.length] + 12, t + humanize());
      return;
    }
    if (s === 0 || s === 6 || s === 10) {
      kick(tr.out, t, .32 * hum);
      tr.pump.gain.cancelScheduledValues(t);
      tr.pump.gain.setValueAtTime(.45, t);
      tr.pump.gain.linearRampToValueAtTime(1, t + .28);
    }
    if (s === 4 || s === 12) snare(tr.out, t, .1 * hum);
    if (s % 4 === 2) hat(tr.out, t, .018 * hum);
    if (s % 8 === 6 && Math.random() < .35) hat(tr.out, t, .012, .04);
    if (s === 0) bass(tr, root, t, sd * 6.5);
    if (s === 8) bass(tr, root + 7, t, sd * 3.5);
    if ((s === 2 || s === 6 || s === 10 || s === 14) && Math.random() < .65) {
      const n = chord[(tr.cycle + Math.floor(s / 2) + tr.bar) % chord.length] + 12;
      arp(tr, n, t + humanize());
    }
    if (s === 15 && Math.random() < .2) arp(tr, chord[0] + 24, t + humanize());
  } else {
    if (s === 0) keys(tr, chord, t);
    if (s === 8 && Math.random() < .35) keys(tr, chord.slice(1, 3), t);
    if (s === 0) bass(tr, root, t, sd * 8);
    if (s === 10 && Math.random() < .5) bass(tr, root + 7, t, sd * 3.5);
    if (s === 0) kick(tr.out, t, .22 * hum);
    if (s === 8 && Math.random() < .5) kick(tr.out, t, .16 * hum);
    if (s === 12 && Math.random() > .3) snare(tr.out, t, .06 * hum);
    if (s % 4 === 2 && Math.random() < .5) hat(tr.out, t, .012 * hum);
    if ((s === 4 && Math.random() < .35) || (s === 10 && Math.random() < .25)) {
      const n = d.penta[Math.floor(rr(d.penta.length))];
      arp(tr, n, t + humanize());
    }
  }
}

function pad(tr, notes, t, dur) {
  notes.forEach(m => {
    [-4, 4].forEach(det => {
      const o = AC.createOscillator(), v = AC.createGain();
      o.type = 'triangle';
      o.frequency.value = mf(m);
      o.detune.value = det;
      const g = .022;
      v.gain.setValueAtTime(0, t);
      v.gain.linearRampToValueAtTime(g, t + .7);
      v.gain.setValueAtTime(g * .9, t + dur - .8);
      v.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(v); v.connect(tr.padFl);
      o.start(t); o.stop(t + dur + .1);
    });
  });
}
function keys(tr, notes, t) {
  notes.forEach((m, i) => {
    const tt = t + i * .018;
    const o = AC.createOscillator(), v = AC.createGain();
    o.type = 'triangle'; o.frequency.value = mf(m);
    v.gain.setValueAtTime(0, tt);
    v.gain.linearRampToValueAtTime(.045, tt + .012);
    v.gain.exponentialRampToValueAtTime(.0001, tt + 1.3);
    o.connect(v); v.connect(tr.padFl);
    o.start(tt); o.stop(tt + 1.4);
    const s = AC.createOscillator(), sv = AC.createGain();
    s.type = 'sine'; s.frequency.value = mf(m - 12);
    sv.gain.setValueAtTime(0, tt);
    sv.gain.linearRampToValueAtTime(.018, tt + .015);
    sv.gain.exponentialRampToValueAtTime(.0001, tt + .9);
    s.connect(sv); sv.connect(tr.padFl);
    s.start(tt); s.stop(tt + 1);
  });
}
function arp(tr, m, t) {
  const o = AC.createOscillator(), v = AC.createGain();
  o.type = 'triangle'; o.frequency.value = mf(m);
  v.gain.setValueAtTime(0, t);
  v.gain.linearRampToValueAtTime(.05, t + .006);
  v.gain.exponentialRampToValueAtTime(.0001, t + .3);
  o.connect(v); v.connect(tr.padFl);
  const send = AC.createGain(); send.gain.value = .5;
  v.connect(send); send.connect(tr.delay);
  v.connect(tr.out);
  o.start(t); o.stop(t + .32);
}
function bass(tr, m, t, dur) {
  const o = AC.createOscillator(), v = AC.createGain(), fl = AC.createBiquadFilter();
  fl.type = 'lowpass'; fl.frequency.value = 200;
  o.type = 'sine'; o.frequency.value = mf(m);
  v.gain.setValueAtTime(0, t);
  v.gain.linearRampToValueAtTime(.13, t + .02);
  v.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(fl); fl.connect(v);
  v.connect(tr.d.name === 'battle' ? tr.pump : tr.out);
  o.start(t); o.stop(t + dur + .05);
  const o2 = AC.createOscillator(), v2 = AC.createGain();
  o2.type = 'triangle'; o2.frequency.value = mf(m + 12);
  v2.gain.setValueAtTime(0, t);
  v2.gain.linearRampToValueAtTime(.04, t + .02);
  v2.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o2.connect(v2);
  v2.connect(tr.d.name === 'battle' ? tr.pump : tr.out);
  o2.start(t); o2.stop(t + dur + .05);
}
function kick(dest, t, g) {
  const o = AC.createOscillator(), v = AC.createGain(), fl = AC.createBiquadFilter();
  fl.type = 'lowpass'; fl.frequency.value = 210;
  o.type = 'sine';
  o.frequency.setValueAtTime(105, t);
  o.frequency.exponentialRampToValueAtTime(42, t + .1);
  v.gain.setValueAtTime(g, t);
  v.gain.exponentialRampToValueAtTime(.0001, t + .26);
  o.connect(fl); fl.connect(v); v.connect(dest);
  o.start(t); o.stop(t + .3);
}
function snare(dest, t, g) {
  const src = AC.createBufferSource(), v = AC.createGain(), fl = AC.createBiquadFilter();
  src.buffer = noiseBuf; src.loop = true;
  fl.type = 'bandpass'; fl.frequency.value = 1300; fl.Q.value = 1.4;
  v.gain.setValueAtTime(0, t);
  v.gain.linearRampToValueAtTime(g, t + .006);
  v.gain.exponentialRampToValueAtTime(.0001, t + .12);
  src.connect(fl); fl.connect(v); v.connect(dest);
  src.start(t); src.stop(t + .14);
}
function hat(dest, t, g, dur = .03) {
  const src = AC.createBufferSource(), v = AC.createGain(), fl = AC.createBiquadFilter();
  src.buffer = noiseBuf; src.loop = true;
  fl.type = 'highpass'; fl.frequency.value = 5200;
  v.gain.setValueAtTime(0, t);
  v.gain.linearRampToValueAtTime(g, t + .002);
  v.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(fl); fl.connect(v); v.connect(dest);
  src.start(t); src.stop(t + dur + .02);
}

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