// Alley Cat - riedizione per cellulare. Logica di gioco, input, loop, interfaccia.
import {
  W, H, EXTRA_X, EXTRA_Y, GROUND_Y, CAN_X, CAN_TOP, CAN_HALF, WIN_COLS, SILL_Y, WIN_H, LINES_Y, MOUSE_POINTS,
  RUN_SPEED, GRAVITY, JUMP_V, buildPlatforms, SKILLS,
} from './world.js';
import * as art from './art.js';
import { initAudio, resumeAudio, setMuted, isMuted, sfx } from './audio.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#game');
const stage = $('#stage');
const overlay = $('#overlay');
const ctx = canvas.getContext('2d');

const platforms = buildPlatforms();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

/* ------------------------------------------------------------------ */
/* Stato                                                                */
/* ------------------------------------------------------------------ */

function newCat() {
  return {
    x: 16, y: GROUND_Y, vx: 0, vy: 0, face: 1, onGround: true, platform: platforms[0],
    phase: 0, blink: 0, blinkT: rand(1.5, 3.5), stun: 0, invuln: 0, dead: false, deadT: 0,
    coyote: 0, hidden: false,
  };
}

function newWindows() {
  const wins = [];
  for (let r = 0; r < 3; r++) {
    WIN_COLS.forEach((cx, c) => {
      const open = Math.random() < 0.35;
      wins.push({ cx, r, c, open: open ? 1 : 0, target: open ? 1 : 0, timer: rand(1, 7), throwT: rand(1, 3) });
    });
  }
  return wins;
}

function newCans() {
  return CAN_X.map(() => ({ state: 'idle', t: 0, pop: 0, warn: 0, armT: -1, hit: false }));
}

// Tre topi, uno per filo del bucato: come nell'originale (tabella DS:1F39 = 9,7,5 x10 punti).
function newMice() {
  return LINES_Y.map((y, i) => ({
    line: i, y, x: rand(30, W - 30), dir: Math.random() < 0.5 ? -1 : 1, speed: rand(28, 48), pause: 0,
    alive: true, respawn: 0, phase: Math.random() * 6, points: MOUSE_POINTS[i],
  }));
}

function loadHi() {
  try {
    return Number(localStorage.getItem('alleycat.hi')) || 0;
  } catch {
    return 0;
  }
}
function saveHi(v) {
  try {
    localStorage.setItem('alleycat.hi', String(v));
  } catch {
    /* ignora */
  }
}

const G = {
  mode: 'title', // title | select | play | paused | gameover
  skill: SKILLS[0],
  t: 0,
  score: 0,
  hi: loadHi(),
  lives: 3,
  cat: newCat(),
  dog: { active: false, x: 0, dir: 1, phase: 0, warn: 0, speed: 160 },
  dogTimer: 0,
  headTimer: 6,
  wins: newWindows(),
  cans: newCans(),
  mice: newMice(),
  thrown: [],
  parts: [],
  pops: [],
  visited: new Set(),
  shake: 0,
  demo: { dir: 1, sit: 0, pick: 1 },
};
window.__alleycat = G; // utile per i test automatici

/* ------------------------------------------------------------------ */
/* Input                                                                */
/* ------------------------------------------------------------------ */

const held = { left: false, right: false };
let jumpBuf = 0;

function pressJump() {
  jumpBuf = 0.14;
}

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};
const JUMPKEYS = new Set(['ArrowUp', 'KeyW', 'Space', 'KeyZ', 'KeyX']);

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey) return;
  const k = KEYMAP[e.code];
  const isJump = JUMPKEYS.has(e.code);
  if (k || isJump || e.code === 'Escape' || e.code === 'Enter') e.preventDefault();
  initAudio();
  resumeAudio();
  if (G.mode === 'title') {
    if (!e.repeat) showSelect();
    return;
  }
  if (G.mode === 'select') {
    const idx = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, KeyK: 0, KeyH: 1, KeyT: 2, KeyA: 3 }[e.code];
    if (idx !== undefined) startGame(SKILLS[idx]);
    else if (e.code === 'Escape') showTitle();
    return;
  }
  if (G.mode === 'gameover') {
    if (e.code === 'Enter' || e.code === 'Space') startGame(G.skill);
    else if (e.code === 'Escape' || e.code === 'KeyM') showSelect();
    return;
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    togglePause();
    return;
  }
  if (e.code === 'KeyM') {
    toggleMute();
    return;
  }
  if (G.mode === 'paused') {
    if (e.code === 'Enter' || e.code === 'Space') togglePause();
    return;
  }
  if (k) held[k] = true;
  if (isJump && !e.repeat) pressJump();
});

window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) held[k] = false;
});

function bindHold(el, key) {
  const down = (e) => {
    e.preventDefault();
    initAudio();
    resumeAudio();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* ignora */
    }
    if (key === 'jump') pressJump();
    else held[key] = true;
    el.classList.add('down');
  };
  const up = () => {
    if (key !== 'jump') held[key] = false;
    el.classList.remove('down');
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

bindHold($('#btn-left'), 'left');
bindHold($('#btn-right'), 'right');
bindHold($('#btn-jump'), 'jump');

$('#btn-pause').addEventListener('click', () => {
  initAudio();
  togglePause();
});
$('#btn-mute').addEventListener('click', () => {
  initAudio();
  resumeAudio();
  toggleMute();
});

overlay.addEventListener('pointerdown', (e) => {
  initAudio();
  resumeAudio();
  if (G.mode === 'title' && e.target.closest('#screen-title')) showSelect();
});
document.querySelectorAll('[data-skill]').forEach((b) => {
  b.addEventListener('click', () => startGame(SKILLS[Number(b.dataset.skill)]));
});
$('#btn-back').addEventListener('click', showTitle);
$('#btn-resume').addEventListener('click', togglePause);
$('#btn-quit').addEventListener('click', showSelect);
$('#btn-again').addEventListener('click', () => startGame(G.skill));
$('#btn-menu').addEventListener('click', showSelect);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.mode === 'play') togglePause();
});

function toggleMute() {
  setMuted(!isMuted());
  $('#btn-mute').textContent = isMuted() ? '🔇' : '🔊';
  $('#btn-mute').setAttribute('aria-pressed', String(isMuted()));
}

/* ------------------------------------------------------------------ */
/* Schermate                                                            */
/* ------------------------------------------------------------------ */

function setScreen(name) {
  overlay.dataset.screen = name || '';
  document.body.dataset.mode = G.mode;
}

function showTitle() {
  G.mode = 'title';
  resetKeys();
  setScreen('title');
}

function showSelect() {
  G.mode = 'select';
  resetKeys();
  setScreen('select');
}

function resetKeys() {
  held.left = held.right = false;
  jumpBuf = 0;
}

function togglePause() {
  if (G.mode === 'play') {
    G.mode = 'paused';
    resetKeys();
    setScreen('pause');
  } else if (G.mode === 'paused') {
    G.mode = 'play';
    setScreen('');
  }
}

function startGame(skill) {
  G.skill = skill;
  G.score = 0;
  G.lives = 3;
  G.cat = newCat();
  G.cat.invuln = 1.2;
  G.dog = { active: false, x: 0, dir: 1, phase: 0, warn: 0, speed: skill.dogSpeed };
  G.dogTimer = 0;
  G.headTimer = rand(3, 6);
  G.thrown = [];
  G.parts = [];
  G.pops = [];
  G.cans = newCans();
  G.mice = newMice();
  G.visited = new Set();
  G.mode = 'play';
  resetKeys();
  setScreen('');
  sfx.start();
}

function gameOver() {
  G.mode = 'gameover';
  resetKeys();
  if (G.score > G.hi) {
    G.hi = G.score;
    saveHi(G.hi);
  }
  $('#final-score').textContent = String(G.score).padStart(5, '0');
  $('#final-hi').textContent = String(G.hi).padStart(5, '0');
  setScreen('gameover');
  sfx.gameover();
}

/* ------------------------------------------------------------------ */
/* Aggiornamento                                                        */
/* ------------------------------------------------------------------ */

function addPopup(x, y, text) {
  G.pops.push({ x, y, text, t: 0 });
}

function addScore(n, x, y) {
  G.score += n;
  addPopup(x, y - 18, '+' + n);
  sfx.point();
}

function burst(x, y, color, n = 8, speed = 40) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rand(0.3, 1) * speed;
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: rand(0.3, 0.6), t: 0, color, size: rand(0.6, 1.4) });
  }
}

function hitCat(reason) {
  const cat = G.cat;
  if (cat.dead || cat.invuln > 0) return;
  cat.dead = true;
  cat.deadT = 0;
  cat.vx = 0;
  G.lives -= 1;
  G.shake = 0.35;
  sfx.hit();
  burst(cat.x, cat.y - 8, '#ffe86a', 10, 60);
  cat.reason = reason;
}

function respawn() {
  const cat = newCat();
  cat.invuln = 2.2;
  G.cat = cat;
  G.dog.active = false;
  G.dog.warn = 0;
  G.dogTimer = 0;
  G.thrown = [];
  G.visited = new Set();
}

function onLand(cat, p, impact) {
  if (impact > 130) {
    sfx.land();
    burst(cat.x, cat.y, 'rgba(220,200,255,0.8)', 4, 25);
  }
  let key = null;
  let pts = 0;
  if (p.kind === 'can') {
    key = 'can' + p.index;
    pts = 10;
    const can = G.cans[p.index];
    if (can.state === 'idle') can.armT = rand(0.5, 1.3);
  } else if (p.kind === 'fence') {
    key = 'fence';
    pts = 25;
  } else if (p.kind === 'line') {
    key = 'line' + p.row;
    pts = p.row === 2 ? 50 : p.row === 1 ? 75 : 100;
  }
  if (key && !G.visited.has(key)) {
    G.visited.add(key);
    addScore(pts, cat.x, cat.y);
  }
}

function updateCat(dt) {
  const cat = G.cat;
  if (cat.dead) {
    cat.deadT += dt;
    if (cat.deadT > 1.15) {
      if (G.lives <= 0) gameOver();
      else respawn();
    }
    return;
  }
  cat.invuln = Math.max(0, cat.invuln - dt);
  cat.stun = Math.max(0, cat.stun - dt);
  cat.blinkT -= dt;
  if (cat.blinkT <= 0) {
    cat.blink = 0.12;
    cat.blinkT = rand(2, 4.5);
  }
  cat.blink = Math.max(0, cat.blink - dt);

  const dir = cat.stun > 0 ? 0 : (held.right ? 1 : 0) - (held.left ? 1 : 0);
  if (dir) cat.face = dir;

  cat.coyote = cat.onGround ? 0.09 : cat.coyote - dt;
  jumpBuf = Math.max(0, jumpBuf - dt);
  if (cat.stun <= 0 && jumpBuf > 0 && cat.coyote > 0) {
    cat.vy = -JUMP_V;
    cat.onGround = false;
    cat.coyote = 0;
    jumpBuf = 0;
    sfx.jump();
  }

  if (cat.stun > 0) cat.vx *= 0.93;
  else cat.vx = dir * RUN_SPEED * (cat.onGround ? 1 : 0.92);

  const prevY = cat.y;
  cat.x = clamp(cat.x + cat.vx * dt, 7, W - 7);
  cat.vy += GRAVITY * dt;
  cat.y += cat.vy * dt;

  let landed = null;
  if (cat.vy >= 0) {
    for (const p of platforms) {
      if (cat.x >= p.x0 - 2 && cat.x <= p.x1 + 2 && prevY <= p.y + 0.01 && cat.y >= p.y) {
        if (!landed || p.y < landed.y) landed = p;
      }
    }
  }
  if (landed) {
    const impact = cat.vy;
    cat.y = landed.y;
    cat.vy = 0;
    const wasAir = !cat.onGround;
    cat.onGround = true;
    cat.platform = landed;
    if (wasAir) onLand(cat, landed, impact);
  } else {
    cat.onGround = false;
    cat.platform = null;
  }
  if (cat.y > H + 30) cat.y = GROUND_Y;

  if (cat.onGround && Math.abs(cat.vx) > 4) cat.phase += dt * 17;
}

function updateCans(dt) {
  const cat = G.cat;
  // scelta di una testa casuale che spunta
  G.headTimer -= dt;
  if (G.headTimer <= 0) {
    G.headTimer = G.skill.headEvery * rand(0.7, 1.3);
    const idle = G.cans.map((c, i) => (c.state === 'idle' ? i : -1)).filter((i) => i >= 0);
    if (idle.length) {
      const i = idle[(Math.random() * idle.length) | 0];
      G.cans[i].state = 'warn';
      G.cans[i].t = 0.45;
      G.cans[i].hit = false;
    }
  }
  G.cans.forEach((can, i) => {
    const cx = CAN_X[i];
    if (can.state === 'idle') {
      // il gatto fermo sul coperchio fa arrabbiare chi sta dentro
      const onIt = !cat.dead && cat.onGround && cat.platform && cat.platform.kind === 'can' && cat.platform.index === i;
      if (onIt && can.armT >= 0) {
        can.armT -= dt;
        if (can.armT <= 0) {
          can.state = 'warn';
          can.t = 0.4;
          can.hit = false;
          can.armT = -1;
        }
      }
      can.warn = 0;
    } else if (can.state === 'warn') {
      can.warn = 1;
      can.t -= dt;
      if (can.t <= 0) {
        can.state = 'pop';
        can.t = 0.75;
        sfx.hiss();
      }
    } else if (can.state === 'pop') {
      can.warn = 0;
      can.t -= dt;
      const el = 0.75 - can.t;
      can.pop = el < 0.12 ? el / 0.12 : can.t < 0.2 ? Math.max(0, can.t / 0.2) : 1;
      if (can.t <= 0) {
        can.state = 'idle';
        can.pop = 0;
        can.armT = -1;
      }
      // colpisce il gatto che sta sopra o vicino al coperchio
      if (!cat.dead && !can.hit && can.pop > 0.7 && Math.abs(cat.x - cx) < CAN_HALF + 5 && cat.y <= CAN_TOP + 2 && cat.y >= CAN_TOP - 24) {
        can.hit = true;
        cat.vy = -200;
        cat.vx = (cat.x < cx ? -1 : 1) * 95;
        cat.stun = 0.6;
        cat.onGround = false;
        G.shake = 0.15;
        sfx.pop();
        burst(cx, CAN_TOP - 4, '#ff9fb8', 6, 40);
      }
    }
  });
}

function updateWindows(dt, active) {
  const cat = G.cat;
  for (const w of G.wins) {
    w.timer -= dt;
    if (w.timer <= 0) {
      w.target = w.target ? 0 : 1;
      w.timer = w.target ? rand(5, 9) : rand(3, 9);
    }
    const d = w.target - w.open;
    w.open += clamp(d, -dt * 1.6, dt * 1.6);

    if (!active) continue;
    w.throwT -= dt;
    const sill = SILL_Y[w.r];
    const below = !cat.dead && cat.y > sill + 4 && cat.y < sill + 85 && Math.abs(cat.x - w.cx) < 34;
    if (w.open > 0.95 && below && w.throwT <= 0) {
      w.throwT = G.skill.throwEvery * rand(0.8, 1.4);
      const kinds = ['pot', 'shoe', 'pin'];
      G.thrown.push({
        x: w.cx, y: sill - WIN_H / 2, vx: clamp((cat.x - w.cx) * 0.45, -34, 34), vy: -25,
        rot: 0, vr: rand(-6, 6), kind: kinds[(Math.random() * kinds.length) | 0],
      });
      sfx.pop();
    }
  }
}

function updateThrown(dt) {
  const cat = G.cat;
  for (const o of G.thrown) {
    o.vy += 420 * dt;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.rot += o.vr * dt;
    if (!cat.dead && cat.invuln <= 0 && Math.abs(o.x - cat.x) < 7 && Math.abs(o.y - (cat.y - 8)) < 9) {
      o.dead = true;
      hitCat('thrown');
      burst(o.x, o.y, '#ffb36b', 8, 50);
    }
    if (o.y > GROUND_Y + 2) {
      o.dead = true;
      burst(o.x, GROUND_Y, o.kind === 'pot' ? '#c8683a' : '#e8d9c0', 6, 45);
    }
  }
  G.thrown = G.thrown.filter((o) => !o.dead);
}

function updateDog(dt) {
  const cat = G.cat;
  const dog = G.dog;
  if (!dog.active && dog.warn <= 0) {
    const grounded = cat.onGround && cat.platform && cat.platform.kind === 'ground';
    G.dogTimer += dt * (grounded ? 1 : 0.4);
    if (G.dogTimer >= G.skill.dogEvery && !cat.dead) {
      dog.dir = cat.x < W / 2 ? -1 : 1; // arriva dal lato opposto al gatto
      dog.x = dog.dir > 0 ? -34 : W + 34;
      dog.warn = 1.1;
      dog.speed = G.skill.dogSpeed;
      sfx.bark();
    }
  } else if (dog.warn > 0) {
    dog.warn -= dt;
    if (dog.warn <= 0) dog.active = true;
  } else {
    dog.x += dog.dir * dog.speed * dt;
    dog.phase += dt * 22;
    if (!cat.dead && cat.invuln <= 0 && cat.y > GROUND_Y - 13 && Math.abs(cat.x - dog.x) < 15) hitCat('dog');
    if (dog.x < -50 || dog.x > W + 50) {
      dog.active = false;
      G.dogTimer = 0;
    }
  }
}

function updateMice(dt, playing) {
  const cat = G.cat;
  for (const m of G.mice) {
    if (!m.alive) {
      m.respawn -= dt;
      if (m.respawn <= 0) {
        m.alive = true;
        m.x = Math.random() < 0.5 ? 6 : W - 6;
        m.dir = m.x < W / 2 ? 1 : -1;
      }
      continue;
    }
    if (m.pause > 0) {
      m.pause -= dt;
    } else {
      m.x += m.dir * m.speed * dt;
      m.phase += dt * 14;
      if (m.x < 4) m.dir = 1;
      if (m.x > W - 4) m.dir = -1;
      if (Math.random() < dt * 0.6) {
        if (Math.random() < 0.5) m.dir = -m.dir;
        else m.pause = rand(0.3, 1.2);
      }
    }
    // il gatto che passa sul filo del topo lo cattura
    if (playing && !cat.dead && cat.stun <= 0 && Math.abs(cat.x - m.x) < 9 && Math.abs(cat.y - m.y) < 13) {
      m.alive = false;
      m.respawn = rand(3.5, 6);
      addScore(m.points, m.x, m.y);
      burst(m.x, m.y - 3, '#ffd6e8', 7, 45);
    }
  }
}

function updateParticles(dt) {
  for (const p of G.parts) {
    p.t += dt;
    p.vy += 160 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  G.parts = G.parts.filter((p) => p.t < p.life);
  for (const p of G.pops) p.t += dt;
  G.pops = G.pops.filter((p) => p.t < 1.0);
  G.shake = Math.max(0, G.shake - dt);
}

function updateDemo(dt) {
  const cat = G.cat;
  const d = G.demo;
  cat.platform = platforms[1];
  cat.y = platforms[1].y;
  cat.onGround = true;
  cat.blinkT -= dt;
  if (cat.blinkT <= 0) {
    cat.blink = 0.12;
    cat.blinkT = rand(2, 4.5);
  }
  cat.blink = Math.max(0, cat.blink - dt);
  d.pick -= dt;
  if (d.pick <= 0) {
    d.pick = rand(1.2, 3);
    const r = Math.random();
    d.sit = r < 0.35 ? rand(1, 2.2) : 0;
    if (!d.sit) d.dir = Math.random() < 0.5 ? -1 : 1;
  }
  if (cat.x < 40) d.dir = 1;
  if (cat.x > W - 40) d.dir = -1;
  if (d.sit > 0) {
    d.sit -= dt;
    cat.vx = 0;
  } else {
    cat.vx = d.dir * 42;
    cat.face = d.dir;
    cat.phase += dt * 8;
  }
  cat.x += cat.vx * dt;
}

function update(dt) {
  if (G.mode === 'paused') return;
  G.t += dt;
  const playing = G.mode === 'play';
  if (playing) {
    updateCat(dt);
    updateCans(dt);
    updateThrown(dt);
    updateDog(dt);
  } else if (G.mode === 'gameover') {
    updateCans(dt);
  } else {
    updateDemo(dt);
    updateCans(dt);
  }
  updateWindows(dt, playing);
  updateMice(dt, playing);
  updateParticles(dt);
  updateCamera(dt);
  if (G.mode === 'gameover') G.cat.hidden = true;
}

/* ------------------------------------------------------------------ */
/* Disegno                                                              */
/* ------------------------------------------------------------------ */

const view = { dpr: 1, cw: 0, ch: 0, scale: 1, ox: 0, oy: 0, hudTop: 0, visW: W, camX: 0 };
const staticLayer = document.createElement('canvas');

function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const cw = stage.clientWidth;
  const ch = stage.clientHeight;
  if (!cw || !ch) return;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  const portrait = ch > cw;
  // In verticale si zooma e la camera segue il gatto; in orizzontale si vede tutto il vicolo.
  const hudTop = portrait ? 50 : 0;
  const visW = portrait ? 170 : W;
  const availH = ch - hudTop;
  const scale = portrait ? cw / visW : Math.min(cw / W, availH / H) * 0.97;
  view.dpr = dpr;
  view.cw = cw;
  view.ch = ch;
  view.scale = scale;
  view.hudTop = hudTop;
  view.visW = visW;
  view.ox = (cw - visW * scale) / 2;
  view.oy = hudTop + (availH - H * scale) / 2;
  view.camX = camTarget();
  const sc = scale * dpr;
  staticLayer.width = Math.ceil((W + 2 * EXTRA_X) * sc);
  staticLayer.height = Math.ceil((H + 2 * EXTRA_Y) * sc);
  const sctx = staticLayer.getContext('2d');
  sctx.setTransform(sc, 0, 0, sc, EXTRA_X * sc, EXTRA_Y * sc);
  art.renderStatic(sctx);
}

function camTarget() {
  if (view.visW >= W) return 0;
  return clamp(G.cat.x + G.cat.face * 14 - view.visW / 2, 0, W - view.visW);
}

function updateCamera(dt) {
  const target = camTarget();
  view.camX += (target - view.camX) * Math.min(1, dt * 7);
}
new ResizeObserver(layout).observe(stage);
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 120));

function pad(n, w = 5) {
  return String(n).padStart(w, '0');
}

function drawHud() {
  const { dpr, cw, hudTop } = view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const portrait = hudTop > 0;
  const y = portrait ? 8 : 6;
  const fs = portrait ? 18 : 14;
  ctx.font = `800 ${fs}px ui-rounded,"Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif`;
  ctx.textBaseline = 'top';

  // pannello
  const pw = 150;
  ctx.fillStyle = 'rgba(10,4,24,0.55)';
  ctx.beginPath();
  ctx.roundRect(10, y - 3, pw, fs + 8, 10);
  ctx.fill();
  ctx.fillStyle = '#ffe86a';
  ctx.textAlign = 'left';
  ctx.fillText(pad(G.score), 20, y + 1);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `700 ${fs - 5}px ui-rounded,system-ui,sans-serif`;
  ctx.fillText('HI ' + pad(Math.max(G.hi, G.score)), 20 + fs * 3.6, y + 4);

  // vite: teste di gatto
  const n = Math.max(0, G.lives);
  const iw = fs + 6;
  const px = cw - 112 - (n * iw + 16);
  ctx.fillStyle = 'rgba(10,4,24,0.55)';
  ctx.beginPath();
  ctx.roundRect(px, y - 3, n * iw + 16, fs + 8, 10);
  ctx.fill();
  for (let i = 0; i < n; i++) drawLifeIcon(px + 12 + i * iw, y + fs / 2 + 1, fs / 2 + 2);
}

function drawLifeIcon(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#2a2440';
  ctx.strokeStyle = '#ffe86a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-r, -r * 0.2);
  ctx.lineTo(-r * 0.8, -r * 1.05);
  ctx.lineTo(-r * 0.2, -r * 0.6);
  ctx.lineTo(r * 0.2, -r * 0.6);
  ctx.lineTo(r * 0.8, -r * 1.05);
  ctx.lineTo(r, -r * 0.2);
  ctx.arc(0, r * 0.15, r * 0.95, -0.1, Math.PI + 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffe86a';
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, r * 0.1, r * 0.17, r * 0.26, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.38, r * 0.1, r * 0.17, r * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function render() {
  const { dpr, cw, scale, ox, oy } = view;
  if (!cw) return;
  const t = G.t;

  // sfondo dei bordi (letterbox)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#0f0820');
  bg.addColorStop(1, '#1c0f33');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sc = scale * dpr;
  let sx = 0;
  let sy = 0;
  if (G.shake > 0) {
    sx = (Math.random() - 0.5) * G.shake * 10;
    sy = (Math.random() - 0.5) * G.shake * 10;
  }
  const camShift = view.camX * scale;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(
    staticLayer,
    (ox - EXTRA_X * scale - camShift + sx) * dpr,
    (oy - EXTRA_Y * scale + sy) * dpr,
    (W + 2 * EXTRA_X) * sc,
    (H + 2 * EXTRA_Y) * sc,
  );

  ctx.setTransform(sc, 0, 0, sc, (ox - camShift + sx) * dpr, (oy + sy) * dpr);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-EXTRA_X, -EXTRA_Y, W + 2 * EXTRA_X, H + 2 * EXTRA_Y);
  ctx.clip();

  art.drawWindows(ctx, G.wins, t);
  art.drawMoths(ctx, G.wins, t);
  art.drawLaundry(ctx, t);
  for (const m of G.mice) art.drawMouse(ctx, m);
  for (const o of G.thrown) art.drawThrown(ctx, o);
  art.drawCans(ctx, G.cans, t);
  art.drawDog(ctx, G.dog, t);
  art.drawCat(ctx, G.cat, t);

  // particelle
  for (const p of G.parts) {
    ctx.globalAlpha = 1 - p.t / p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // avviso cane
  if (G.dog.warn > 0) {
    const left = view.visW < W ? view.camX : 0;
    const right = view.visW < W ? view.camX + view.visW : W;
    art.drawWarning(ctx, G.dog.dir > 0 ? left + 18 : right - 18, t);
  }

  // punti che salgono
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 9px ui-rounded,"Arial Rounded MT Bold",system-ui,sans-serif';
  for (const p of G.pops) {
    ctx.globalAlpha = 1 - p.t;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(20,0,40,0.8)';
    ctx.strokeText(p.text, p.x, p.y - p.t * 14);
    ctx.fillStyle = '#ffe86a';
    ctx.fillText(p.text, p.x, p.y - p.t * 14);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (G.mode === 'play' || G.mode === 'paused' || G.mode === 'gameover') drawHud();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

layout();
setScreen('title');
requestAnimationFrame(frame);
