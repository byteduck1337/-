import { S } from './state.js?v=8';
let AC = null, master = null, noiseBuf = null;
let musicGain = null, musicBus = null;
let menuTimer = null, battleTimer = null, activeTrack = null;
let musicToken = 0;

const MENU_BPM = 72, BATTLE_BPM = 96;
const MENU_STEP = 60 / MENU_BPM / 4;
const BATTLE_STEP = 60 / BATTLE_BPM / 4;

export function init() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = S.sound ? .9 : 0; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    musicGain = AC.createGain(); musicGain.gain.value = .55; musicGain.connect(master);
    musicBus = AC.createGain(); musicBus.gain.value = 1; musicBus.connect(musicGain);
  } catch (e) { AC = null; }
}
export function resume() { if (AC && AC.state === 'suspended') AC.resume(); }
export function setMuted(m) {
  S.sound = !m;
  if (master) master.gain.setTargetAtTime(m ? 0 : .9, AC.currentTime, .05);
  if (m) stopMusic(); else if (S.sound && activeTrack) startTrack(activeTrack);
}

function stopMusic() {
  musicToken++;
  if (menuTimer) { clearTimeout(menuTimer); menuTimer = null; }
  if (battleTimer) { clearTimeout(battleTimer); battleTimer = null; }
  if (musicBus && AC) {
    const t = AC.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setTargetAtTime(0, t, .08);
  }
  activeTrack = null;
}
function startTrack(name) {
  if (!AC) return;
  activeTrack = name;
  const token = ++musicToken;
  if (musicBus) { const t = AC.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setTargetAtTime(1, t, .15); }
  if (name === 'menu') scheduleMenu(token); else scheduleBattle(token);
}
export function playMenuMusic() { if (!AC) return; if (activeTrack === 'menu') return; startTrack('menu'); }
export function playBattleMusic() { if (!AC) return; if (activeTrack === 'battle') return; startTrack('battle'); }
export function stopMenuMusic() { if (activeTrack === 'menu') stopMusic(); }
export function stopBattleMusic() { if (activeTrack === 'battle') stopMusic(); }

function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

function pianoNote(midi, t, dur, gain = .12, bright = 1) {
  if (!AC) return;
  const f = mtof(midi);
  const o1 = AC.createOscillator(), o2 = AC.createOscillator(), o3 = AC.createOscillator();
  const g = AC.createGain(), fl = AC.createBiquadFilter();
  o1.type = 'triangle'; o1.frequency.value = f;
  o2.type = 'sine'; o2.frequency.value = f * 2.002;
  o3.type = 'sine'; o3.frequency.value = f * .5;
  fl.type = 'lowpass'; fl.frequency.setValueAtTime(1400 * bright, t);
  fl.frequency.exponentialRampToValueAtTime(500, t + dur);
  const g2 = AC.createGain(); g2.gain.value = .25; o2.connect(g2);
  const g3 = AC.createGain(); g3.gain.value = .18; o3.connect(g3);
  g2.connect(fl); g3.connect(fl); o1.connect(fl); fl.connect(g);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + .012);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  g.connect(musicBus);
  o1.start(t); o2.start(t); o3.start(t);
  o1.stop(t + dur + .05); o2.stop(t + dur + .05); o3.stop(t + dur + .05);
}
function padNote(midi, t, dur, gain = .06, detune = 6) {
  if (!AC) return;
  const f = mtof(midi);
  const o1 = AC.createOscillator(), o2 = AC.createOscillator();
  const fl = AC.createBiquadFilter(), g = AC.createGain();
  o1.type = 'sawtooth'; o1.frequency.value = f; o1.detune.value = -detune;
  o2.type = 'sawtooth'; o2.frequency.value = f; o2.detune.value = detune;
  fl.type = 'lowpass'; fl.frequency.value = 900; fl.Q.value = 1.2;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + .4);
  g.gain.linearRampToValueAtTime(gain * .8, t + dur - .3);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o1.connect(fl); o2.connect(fl); fl.connect(g); g.connect(musicBus);
  o1.start(t); o2.start(t); o1.stop(t + dur + .05); o2.stop(t + dur + .05);
}
function bassNote(midi, t, dur, gain = .1) {
  if (!AC) return;
  const f = mtof(midi);
  const o = AC.createOscillator(), g = AC.createGain(), fl = AC.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = f;
  fl.type = 'lowpass'; fl.frequency.value = 380;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + .008);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(fl); fl.connect(g); g.connect(musicBus);
  o.start(t); o.stop(t + dur + .05);
}
function kick(t, gain = .5) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + .12);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + .18);
  o.connect(g); g.connect(musicBus);
  o.start(t); o.stop(t + .2);
}
function snare(t, gain = .18) {
  if (!AC) return;
  const src = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  src.buffer = noiseBuf; src.loop = true;
  fl.type = 'bandpass'; fl.frequency.value = 1800; fl.Q.value = .8;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + .12);
  src.connect(fl); fl.connect(g); g.connect(musicBus);
  src.start(t); src.stop(t + .14);
}
function hat(t, gain = .05, open = false) {
  if (!AC) return;
  const src = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  src.buffer = noiseBuf; src.loop = true;
  fl.type = 'highpass'; fl.frequency.value = 7000;
  const d = open ? .16 : .04;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + d);
  src.connect(fl); fl.connect(g); g.connect(musicBus);
  src.start(t); src.stop(t + d + .02);
}
function vinyl(t, gain = .012) {
  if (!AC) return;
  const src = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  src.buffer = noiseBuf; src.loop = true;
  fl.type = 'highpass'; fl.frequency.value = 3000;
  g.gain.value = gain;
  src.connect(fl); fl.connect(g); g.connect(musicBus);
  src.start(t); src.stop(t + .4);
}

const MENU_CHORDS = [
  [57, 60, 64, 67],
  [53, 57, 60, 64],
  [55, 59, 62, 65],
  [52, 55, 59, 62],
];
const MENU_BASS = [33, 29, 31, 28];

function scheduleMenu(token) {
  if (!AC) return;
  let step = 0;
  const barLen = 16;
  let nextTime = AC.currentTime + .1;
  function schedule() {
    if (token !== musicToken) return;
    while (nextTime < AC.currentTime + .25) {
      const bar = Math.floor(step / barLen) % 4;
      const s = step % barLen;
      if (s === 0) { MENU_CHORDS[bar].forEach((m, i) => pianoNote(m, nextTime + i * .015, 2.4, .09, .9)); bassNote(MENU_BASS[bar], nextTime, 1.6, .12); }
      if (s === 6) pianoNote(MENU_CHORDS[bar][2] + 12, nextTime, 1.2, .05, .8);
      if (s === 10) pianoNote(MENU_CHORDS[bar][1] + 12, nextTime, 1.0, .04, .8);
      if (s === 4 || s === 12) kick(nextTime, .35);
      if (s === 4 || s === 12) snare(nextTime, .12);
      if (s % 4 === 2) hat(nextTime, .035);
      if (s === 8) vinyl(nextTime, .015);
      nextTime += MENU_STEP;
      step++;
    }
    menuTimer = setTimeout(schedule, 80);
  }
  schedule();
}

const BATTLE_BARS = [
  { root: 45, chords: [[57, 60, 64], [57, 60, 64], [55, 59, 62], [53, 57, 60]] },
  { root: 41, chords: [[53, 57, 60], [53, 57, 60], [52, 55, 59], [50, 53, 57]] },
  { root: 43, chords: [[55, 59, 62], [55, 59, 62], [53, 57, 60], [52, 55, 59]] },
  { root: 40, chords: [[52, 55, 59], [52, 55, 59], [50, 53, 57], [48, 52, 55]] },
];
const BATTLE_ARP = [0, 2, 1, 3, 2, 0, 3, 1];
const BATTLE_LEN = 16 * 4 * 3;

function scheduleBattle(token) {
  if (!AC) return;
  let step = 0;
  const barLen = 16;
  let nextTime = AC.currentTime + .15;
  let arpIdx = 0;
  function schedule() {
    if (token !== musicToken) return;
    while (nextTime < AC.currentTime + .2) {
      const barIdx = Math.floor(step / barLen) % BATTLE_LEN;
      const s = step % barLen;
      const bar = BATTLE_BARS[barIdx % 4];
      const chord = bar.chords[Math.floor((barIdx % 16) / 4) % 4];
      const f = mtof(chord[0]);
      if (s === 0) {
        padNote(chord[0], nextTime, BATTLE_STEP * 16, .035, 7);
        padNote(chord[2], nextTime, BATTLE_STEP * 16, .03, 7);
        bassNote(bar.root, nextTime, BATTLE_STEP * 8, .11);
      }
      if (s === 8) bassNote(bar.root + 7, nextTime, BATTLE_STEP * 6, .08);
      if (s % 2 === 0) {
        const note = chord[BATTLE_ARP[arpIdx % BATTLE_ARP.length]] + 12;
        pianoNote(note, nextTime, .18, .045, 1.3);
        arpIdx++;
      }
      if (s === 0 || s === 6 || s === 8 || s === 14) kick(nextTime, .32);
      if (s === 4 || s === 12) snare(nextTime, .1);
      if (s % 4 === 2) hat(nextTime, .03, s === 14);
      if (s === 0) vinyl(nextTime, .01);
      nextTime += BATTLE_STEP;
      step++;
      if (step >= BATTLE_LEN * barLen) step = 0;
    }
    battleTimer = setTimeout(schedule, 80);
  }
  schedule();
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