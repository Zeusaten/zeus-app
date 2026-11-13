// Effetti sonori sintetizzati con WebAudio (nessun file audio).

let ctx = null;
let master = null;
let muted = false;

export function initAudio() {
  if (ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.22;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.22;
}

export function isMuted() {
  return muted;
}

function tone({ f0, f1 = f0, dur = 0.12, type = 'square', vol = 0.5, delay = 0 }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.15, vol = 0.4, delay = 0, lp = 1500 }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
}

export const sfx = {
  jump: () => tone({ f0: 320, f1: 760, dur: 0.12, type: 'square', vol: 0.35 }),
  land: () => noise({ dur: 0.06, vol: 0.35, lp: 500 }),
  bark: () => {
    tone({ f0: 240, f1: 130, dur: 0.1, type: 'sawtooth', vol: 0.55 });
    tone({ f0: 220, f1: 110, dur: 0.12, type: 'sawtooth', vol: 0.55, delay: 0.15 });
  },
  hit: () => {
    tone({ f0: 420, f1: 60, dur: 0.45, type: 'sawtooth', vol: 0.5 });
    noise({ dur: 0.2, vol: 0.4, lp: 900 });
  },
  hiss: () => noise({ dur: 0.25, vol: 0.35, lp: 5000 }),
  pop: () => tone({ f0: 180, f1: 520, dur: 0.09, type: 'triangle', vol: 0.6 }),
  point: () => {
    tone({ f0: 660, dur: 0.07, type: 'square', vol: 0.3 });
    tone({ f0: 990, dur: 0.1, type: 'square', vol: 0.3, delay: 0.07 });
  },
  start: () => {
    [392, 523, 659, 784].forEach((f, i) => tone({ f0: f, dur: 0.12, type: 'square', vol: 0.3, delay: i * 0.09 }));
  },
  gameover: () => {
    [392, 330, 262, 196].forEach((f, i) => tone({ f0: f, dur: 0.22, type: 'square', vol: 0.3, delay: i * 0.2 }));
  },
};
