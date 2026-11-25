import { S } from './state.js?v=8';
let AC = null, master = null, musicBus = null, noiseBuf = null, wowGain = null;
let tickTimer = null, sceneName = 'menu', ducked = false;
const tracks = {};
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
const rr = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);

/* ── Генеративные lo-fi треки. Никаких файлов: всё синтезируется. ──
   menu: 76 BPM, lo-fi hip-hop, ii–V–I–vi, vinyl + tape wow.
   battle: 96 BPM, retro-synthwave (HOME — Resonance vibe):
   detuned saw pads, sidechain pump, sub bass, arp через delay.
   Луп бесшовный: планировщик schedule-ит непрерывно, гармония и
   паттерны мутируют каждый цикл → повтор не считывается. */
const DEFS = {
menu: { name: 'menu', bpm: 76, swing: .09, level: .5, barsPer: 1, crackle: .5,
chords: [[50, 53, 57, 60, 64], [55, 59, 62, 65, 69], [48, 55, 60, 64, 67], [57, 60, 64, 67, 71]],
roots: [38, 43, 36, 45], penta: [60, 62, 64, 67, 69, 72] },
battle: { name: 'battle', bpm: 96, swing: 0, level: .46, barsPer: 2, crackle: .22,
chords: [[57, 64, 67, 71, 76], [53, 60, 64, 67, 72], [60, 64, 67, 71, 74], [55, 62, 64, 67, 69]],
roots: [45, 41, 36, 43] },
};

export function init() {
if (AC) return;
try {
AC = new (window.AudioContext || window.webkitAudioContext)();
master = AC.createGain(); master.gain.value = S.sound ? .9 : 0; master.connect(AC.destination);
const comp = AC.createDynamicsCompressor();
comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .24;
comp.connect(master);
musicBus = AC.createGain(); musicBus.gain.value = .8; musicBus.connect(comp);
noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
const d = noiseBuf.getChannelData(0);
for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
/* tape wow: медленный дрейф высоты всех нот */
const wow = AC.createOscillator(); wow.frequency.value = .45;
wowGain = AC.createGain(); wowGain.gain.value = 6; wow.connect(wowGain); wow.start();
tickTimer = setInterval(tick, 90);
setScene(sceneName);
} catch (e) { AC = null; }
}
export function resume() { if (AC && AC.state === 'suspended') AC.resume(); }
export function setMuted(m) { S.sound = !m; if (master) master.gain.setTargetAtTime(m ? 0 : .9, AC.currentTime, .05); }
export function duck(on) { ducked = on; if (AC) musicBus.gain.setTargetAtTime(on ? .18 : .8, AC.currentTime, .18); }
export function setScene(name) {
sceneName = name; if (!AC) return;
if (!tracks[name]) ensureTrack(name);
for (const k in tracks) {
const tr = tracks[k]; clearTimeout(tr.stopTimer);
if (k === name) { tr.active = true; if (tr.next < AC.currentTime) tr.next = AC.currentTime + .06; tr.out.gain.setTargetAtTime(tr.d.level, AC.currentTime, .5); }
else if (tr.active) { tr.out.gain.setTargetAtTime(0, AC.currentTime, .4); tr.stopTimer = setTimeout(() => { tr.active = false; }, 1600); }
}
}
function ensureTrack(name) {
const d = DEFS[name];
const out = AC.createGain(); out.gain.value = 0; out.connect(musicBus);
const padFl = AC.createBiquadFilter(); padFl.type = 'lowpass'; padFl.frequency.value = name === 'battle' ? 1500 : 1300; padFl.Q.value = .6;
const drift = AC.createOscillator(); drift.frequency.value = .05 + Math.random() * .03;
const dg = AC.createGain(); dg.gain.value = name === 'battle' ? 600 : 350;
drift.connect(dg); dg.connect(padFl.frequency); drift.start();
const pump = AC.createGain(); pump.gain.value = 1; padFl.connect(pump); pump.connect(out);
const delay = AC.createDelay(1.2); delay.delayTime.value = 60 / d.bpm * .75;
const fb = AC.createGain(); fb.gain.value = .32;
const dFl = AC.createBiquadFilter(); dFl.type = 'lowpass'; dFl.frequency.value = 2600;
delay.connect(fb); fb.connect(delay); delay.connect(dFl); dFl.connect(out);
/* vinyl crackle + hiss, зациклен */
const cb = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), cd = cb.getChannelData(0);
for (let i = 0; i < cd.length; i++) {
cd[i] = (Math.random() * 2 - 1) * .006;
if (Math.random() < .00035) { const a = rr(.15, .5); for (let k = 0; k < 24 && i + k < cd.length; k++) cd[i + k] += a * Math.exp(-k / 5) * (Math.random() * 2 - 1); }
}
const cs = AC.createBufferSource(); cs.buffer = cb; cs.loop = true;
const cg = AC.createGain(); cg.gain.value = d.crackle; cs.connect(cg); cg.connect(out); cs.start();
tracks[name] = { d, out, padFl, pump, delay, step: 0, bar: 0, chordIdx: 0, cycle: 0, next: AC.currentTime + .1, active: false, stopTimer: null };
}
function tick() {
if (!AC) return;
for (const k in tracks) {
const tr = tracks[k]; if (!tr.active) continue;
const sd = 60 / tr.d.bpm / 4;
while (tr.next < AC.currentTime + 1.15) {
const s = tr.step, t = tr.next + (tr.d.swing && s % 2 ? sd * tr.d.swing : 0);
scheduleStep(tr, s, t, sd);
tr.next += sd; tr.step++;
if (tr.step >= 16) {
tr.step = 0; tr.bar++;
if (tr.bar % tr.d.barsPer === 0) { tr.chordIdx++; if (tr.chordIdx >= tr.d.chords.length) { tr.chordIdx = 0; tr.cycle++; } }
}
}
}
}
function scheduleStep(tr, s, t, sd) {
const d = tr.d, chord = d.chords[tr.chordIdx], root = d.roots[tr.chordIdx], cyc = tr.cycle;
const hum = rr(.88, 1.08);
if (d.name === 'battle') {
const breakBar = cyc % 4 === 3 && tr.bar % 8 === 7; /* каждый 4-й цикл — бар без ударных */
if (s === 0 && tr.bar % d.barsPer === 0) pad(tr, chord, t, d.barsPer * sd * 16 * .98);
if (breakBar) { if (s === 8 && Math.random() < .6) pluck(tr, chord[(cyc + 2) % chord.length] + 12, t, .04, .6); return; }
if (s % 4 === 0) { kick(tr.out, t, .5 * hum); tr.pump.gain.setValueAtTime(.3, t); tr.pump.gain.linearRampToValueAtTime(1, t + .3); }
if (s === 4 || s === 12) snare(tr.out, t, .2 * hum);
if (s % 2 === 1) hat(tr.out, t, .045 * hum);
if (s % 4 === 2 && Math.random() < .5) hat(tr.out, t, .02, .02);
if (s % 4 === 0) bass(tr, root, t, sd * 3.4);
if (s % 8 === 6) bass(tr, root + 12, t, sd * 1.6);
if ((s === 2 || s === 6 || s === 10 || s === 14) && Math.random() < .8) {
const n = chord[(cyc + s / 2 + tr.bar) % chord.length] + 12;
pluck(tr, n, t, .05 * hum, .28);
}
} else {
if (s === 0) keys(tr, chord, t);
if (s === 6 && Math.random() < .45) keys(tr, chord.slice(1), t);
if (s === 0) bass(tr, root, t, sd * 7);
if (s === 10 && Math.random() < .6) bass(tr, root + 7, t, sd * 3);
if (s === 0 || (s === 10 && Math.random() < .8)) kick(tr.out, t, .32 * hum);
if ((s === 4 || s === 12) && Math.random() > .12) snare(tr.out, t, .12 * hum);
if (s % 2 === 0 && Math.random() < .7) hat(tr.out, t, .022 * hum, .03);
if ((s === 0 && Math.random() < .4) || (s === 8 && Math.random() < .3)) pluck(tr, d.penta[Math.floor(rr(d.penta.length))], t, .045, .9);
}
}
/* ── инструменты ── */
function pad(tr, notes, t, dur) {
notes.forEach(m => { [-7, 7].forEach(det => {
const o = AC.createOscillator(), v = AC.createGain();
o.type = 'sawtooth'; o.frequency.value = mf(m); o.detune.value = det; wowGain.connect(o.detune);
const g = .028;
v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + .4);
v.gain.setValueAtTime(g, t + dur - .5); v.gain.linearRampToValueAtTime(0, t + dur);
o.connect(v); v.connect(tr.padFl); o.start(t); o.stop(t + dur + .1);
}); });
}
function keys(tr, notes, t) {
notes.forEach((m, i) => { const tt = t + i * .016;
note(tr, 'triangle', m, tt, 1.4, .05, tr.padFl);
note(tr, 'sine', m + 12, tt, 1.1, .018, tr.padFl);
});
}
function note(tr, type, m, t, dur, g, dest) {
const o = AC.createOscillator(), v = AC.createGain();
o.type = type; o.frequency.value = mf(m); wowGain.connect(o.detune);
v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + .012); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
o.connect(v); v.connect(dest); o.start(t); o.stop(t + dur + .05);
}
function bass(tr, m, t, dur) {
const fl = AC.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 480;
const v = AC.createGain();
v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(.16, t + .01); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mf(m); wowGain.connect(o.detune);
const s = AC.createOscillator(); s.type = 'sine'; s.frequency.value = mf(m);
o.connect(fl); s.connect(fl); fl.connect(v); v.connect(tr.d.name === 'battle' ? tr.pump : tr.out);
o.start(t); s.start(t); o.stop(t + dur + .05); s.stop(t + dur + .05);
}
function pluck(tr, m, t, g, dur) {
const v = AC.createGain();
v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + .006); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = mf(m); wowGain.connect(o.detune);
const o2 = AC.createOscillator(); o2.type = 'square'; o2.frequency.value = mf(m);
const g2 = AC.createGain(); g2.gain.value = .25;
o.connect(v); o2.connect(g2); g2.connect(v);
const send = AC.createGain(); send.gain.value = .6; v.connect(send); send.connect(tr.delay);
v.connect(tr.out);
o.start(t); o2.start(t); o.stop(t + dur + .05); o2.stop(t + dur + .05);
}
function kick(dest, t, g) {
const o = AC.createOscillator(), v = AC.createGain();
o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + .09);
v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.0001, t + .22);
o.connect(v); v.connect(dest); o.start(t); o.stop(t + .26);
}
function snare(dest, t, g) {
const src = AC.createBufferSource(), v = AC.createGain(), fl = AC.createBiquadFilter();
src.buffer = noiseBuf; src.loop = true; fl.type = 'bandpass'; fl.frequency.value = 1800; fl.Q.value = .8;
v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.0001, t + .13);
src.connect(fl); fl.connect(v); v.connect(dest); src.start(t); src.stop(t + .16);
const o = AC.createOscillator(), ov = AC.createGain();
o.type = 'triangle'; o.frequency.value = 190; ov.gain.setValueAtTime(g * .5, t); ov.gain.exponentialRampToValueAtTime(.0001, t + .07);
o.connect(ov); ov.connect(dest); o.start(t); o.stop(t + .09);
}
function hat(dest, t, g, dur = .035) {
const src = AC.createBufferSource(), v = AC.createGain(), fl = AC.createBiquadFilter();
src.buffer = noiseBuf; src.loop = true; fl.type = 'highpass'; fl.frequency.value = 6500;
v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
src.connect(fl); fl.connect(v); v.connect(dest); src.start(t); src.stop(t + dur + .02);
}

/* ── SFX: без изменений, как и просили ── */
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