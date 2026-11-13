// Grafica vettoriale originale (nessuno sprite dell'Alley Cat del 1984 e' riutilizzato).
// Tutte le funzioni disegnano in unita' mondo (320 x 200) su un contesto gia' scalato.
import {
  W, H, EXTRA_X, EXTRA_Y, FENCE_TOP, FENCE_BOTTOM, CAN_X, CAN_TOP, CAN_HALF, WIN_COLS, WIN_W, WIN_H, SILL_Y, LINES_Y,
} from './world.js';

const TAU = Math.PI * 2;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/* ------------------------------------------------------------------ */
/* Sfondo statico                                                       */
/* ------------------------------------------------------------------ */

export function renderStatic(c) {
  const rand = rng(1984);

  // Muro del palazzo: tramonto viola/magenta (omaggio ai colori CGA dell'originale)
  const wall = c.createLinearGradient(0, -EXTRA_Y, 0, FENCE_TOP + 6);
  wall.addColorStop(0, '#0d0620');
  wall.addColorStop(0.39, '#1d0f3d');
  wall.addColorStop(0.72, '#4a1a6e');
  wall.addColorStop(1, '#8a2d8a');
  c.fillStyle = wall;
  c.fillRect(-EXTRA_X, -EXTRA_Y, W + 2 * EXTRA_X, FENCE_BOTTOM + EXTRA_Y);

  // Mattoni
  c.lineWidth = 0.4;
  for (let row = 0, y = -EXTRA_Y; y < FENCE_BOTTOM; y += 5, row++) {
    c.strokeStyle = 'rgba(15,5,35,0.30)';
    c.beginPath();
    c.moveTo(-EXTRA_X, y);
    c.lineTo(W + EXTRA_X, y);
    c.stroke();
    const off = row % 2 ? 0 : 7;
    for (let x = -EXTRA_X - off; x < W + EXTRA_X; x += 14) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y + 5);
      c.stroke();
      if (rand() < 0.22) {
        c.fillStyle = `rgba(255,170,230,${0.03 + rand() * 0.05})`;
        c.fillRect(x + 0.6, y + 0.6, 13, 4);
      }
    }
  }

  // Finestre: cornice e davanzale (il vetro e' dinamico)
  for (let r = 0; r < 3; r++) {
    for (const cx of WIN_COLS) {
      const sill = SILL_Y[r];
      const x = cx - WIN_W / 2;
      const y = sill - WIN_H;
      // incasso scuro
      c.fillStyle = '#12082a';
      c.fillRect(x - 1.5, y - 1.5, WIN_W + 3, WIN_H + 1.5);
      // cornice
      c.fillStyle = '#e8d9c0';
      c.fillRect(x - 1.5, y - 1.5, WIN_W + 3, 1.6);
      c.fillRect(x - 1.5, y - 1.5, 1.6, WIN_H + 1.5);
      c.fillRect(x + WIN_W - 0.1, y - 1.5, 1.6, WIN_H + 1.5);
      // davanzale in pietra (solo file alte; la piu' bassa poggia sullo steccato)
      if (r < 2) {
        c.fillStyle = '#9b8bc0';
        c.fillRect(cx - 20, sill, 40, 3);
        c.fillStyle = '#c5b8e6';
        c.fillRect(cx - 20, sill, 40, 0.9);
        c.fillStyle = 'rgba(10,0,30,0.35)';
        c.fillRect(cx - 19, sill + 3, 38, 2);
      }
    }
  }

  // Steccato: trave di coronamento + assi
  c.fillStyle = '#0c5560';
  c.fillRect(-EXTRA_X, FENCE_TOP, W + 2 * EXTRA_X, 4);
  c.fillStyle = 'rgba(120,255,240,0.55)';
  c.fillRect(-EXTRA_X, FENCE_TOP, W + 2 * EXTRA_X, 0.9);
  const plank = 4;
  for (let x = -EXTRA_X, i = 0; x < W + EXTRA_X; x += plank, i++) {
    const g = c.createLinearGradient(0, FENCE_TOP + 4, 0, FENCE_BOTTOM);
    const light = i % 2 === 0;
    g.addColorStop(0, light ? '#2cc3bd' : '#22aaa8');
    g.addColorStop(1, light ? '#16807f' : '#0f6d71');
    c.fillStyle = g;
    c.fillRect(x, FENCE_TOP + 4, plank - 0.5, FENCE_BOTTOM - FENCE_TOP - 4);
    c.fillStyle = 'rgba(0,25,40,0.35)';
    c.fillRect(x + plank - 0.5, FENCE_TOP + 4, 0.5, FENCE_BOTTOM - FENCE_TOP - 4);
    if (rand() < 0.35) {
      c.fillStyle = 'rgba(255,255,255,0.10)';
      c.fillRect(x + 1, FENCE_TOP + 6 + rand() * 40, 0.8, 8 + rand() * 20);
    }
  }
  // ombra alla base
  const shade = c.createLinearGradient(0, FENCE_BOTTOM - 14, 0, FENCE_BOTTOM);
  shade.addColorStop(0, 'rgba(10,0,30,0)');
  shade.addColorStop(1, 'rgba(10,0,30,0.45)');
  c.fillStyle = shade;
  c.fillRect(-EXTRA_X, FENCE_BOTTOM - 14, W + 2 * EXTRA_X, 14);

  // Graffiti (omaggio a "LOVE THEM MOUSIES")
  c.save();
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const tag = (txt, x, y, rot, size, color) => {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.font = `italic 800 ${size}px "Comic Sans MS","Chalkboard SE","Marker Felt",ui-rounded,system-ui,sans-serif`;
    c.lineWidth = 2.2;
    c.strokeStyle = 'rgba(20,0,40,0.8)';
    c.strokeText(txt, 0, 0);
    c.fillStyle = color;
    c.fillText(txt, 0, 0);
    c.restore();
  };
  tag('LOVE', 128, 122, -0.45, 12, '#ff7ab8');
  tag('THEM', 170, 125, 0.4, 12, '#ffd36e');
  tag('MOUSIES', 214, 150, -0.22, 13, '#ff7ab8');
  tag('HI!', 28, 125, -0.2, 12, '#fff0a8');
  c.restore();

  // Asfalto
  const road = c.createLinearGradient(0, FENCE_BOTTOM, 0, H + EXTRA_Y);
  road.addColorStop(0, '#34224a');
  road.addColorStop(0.3, '#1f1233');
  road.addColorStop(1, '#0d0618');
  c.fillStyle = road;
  c.fillRect(-EXTRA_X, FENCE_BOTTOM, W + 2 * EXTRA_X, H + EXTRA_Y - FENCE_BOTTOM);
  c.fillStyle = '#5a4580';
  c.fillRect(-EXTRA_X, FENCE_BOTTOM, W + 2 * EXTRA_X, 1.2);
  c.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 30; i++) c.fillRect(-EXTRA_X + rand() * (W + 2 * EXTRA_X), FENCE_BOTTOM + 3 + rand() * 40, 6 + rand() * 18, 0.5);

  // Ossa a terra
  drawBone(c, 222, 193, 0.2);
  drawFishBone(c, 192, 191);

  // Vignettatura
  const v = c.createRadialGradient(W / 2, H / 2, 70, W / 2, H / 2, 210);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(8,0,20,0.5)');
  c.fillStyle = v;
  c.fillRect(-EXTRA_X, -EXTRA_Y, W + 2 * EXTRA_X, H + 2 * EXTRA_Y);
}

function drawBone(c, x, y, rot) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.fillStyle = '#efe6d2';
  c.strokeStyle = 'rgba(60,40,70,0.6)';
  c.lineWidth = 0.4;
  c.fillRect(-6, -1, 12, 2);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      c.beginPath();
      c.arc(sx * 6.2, sy * 1.4, 1.6, 0, TAU);
      c.fill();
      c.stroke();
    }
  }
  c.restore();
}

function drawFishBone(c, x, y) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = '#efe6d2';
  c.lineWidth = 0.8;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-8, 0);
  c.lineTo(7, 0);
  c.stroke();
  for (let i = -6; i <= 4; i += 2.5) {
    c.beginPath();
    c.moveTo(i, 0);
    c.lineTo(i + 1.5, -3);
    c.moveTo(i, 0);
    c.lineTo(i + 1.5, 3);
    c.stroke();
  }
  c.fillStyle = '#efe6d2';
  c.beginPath();
  c.arc(-9, 0, 2.2, 0, TAU);
  c.fill();
  c.beginPath();
  c.moveTo(7, 0);
  c.lineTo(11, -3);
  c.lineTo(11, 3);
  c.closePath();
  c.fill();
  c.restore();
}

/* ------------------------------------------------------------------ */
/* Finestre (vetro animato)                                             */
/* ------------------------------------------------------------------ */

export function drawWindows(c, wins, t) {
  for (const w of wins) {
    const x = w.cx - WIN_W / 2 + 1;
    const y = SILL_Y[w.r] - WIN_H + 0.5;
    const pw = WIN_W - 2;
    const ph = WIN_H - 1;
    const open = w.open; // 0..1

    // interno: sempre disegnato, poi coperto dal vetro che scorre verso l'alto
    const room = c.createLinearGradient(0, y, 0, y + ph);
    room.addColorStop(0, '#ffe08a');
    room.addColorStop(1, '#ff9a4d');
    c.fillStyle = room;
    c.fillRect(x, y, pw, ph);

    if (open > 0.05) {
      // sagoma di mobili/tenda
      c.fillStyle = 'rgba(120,40,60,0.35)';
      c.fillRect(x, y, 4 + Math.sin(t * 1.5 + w.cx) * 1.2, ph);
      c.fillRect(x + pw - 4, y, 4 - Math.sin(t * 1.5 + w.cx) * 1.2, ph);
      c.fillStyle = 'rgba(60,20,40,0.45)';
      c.fillRect(x + pw * 0.35, y + ph - 5, pw * 0.3, 5);
    }

    // vetro chiuso: copre la parte non ancora aperta
    const glassH = ph * (1 - open);
    if (glassH > 0.3) {
      const g = c.createLinearGradient(0, y, 0, y + glassH);
      g.addColorStop(0, '#2f6f95');
      g.addColorStop(1, '#183a63');
      c.fillStyle = g;
      c.fillRect(x, y + ph - glassH, pw, glassH);
      c.save();
      c.beginPath();
      c.rect(x, y + ph - glassH, pw, glassH);
      c.clip();
      c.strokeStyle = 'rgba(255,255,255,0.28)';
      c.lineWidth = 1.3;
      c.beginPath();
      c.moveTo(x + 4, y + ph);
      c.lineTo(x + 16, y + ph - glassH);
      c.moveTo(x + 12, y + ph);
      c.lineTo(x + 24, y + ph - glassH);
      c.stroke();
      c.restore();
      // traversa
      c.fillStyle = '#e8d9c0';
      c.fillRect(x, y + ph - glassH - 0.8, pw, 1.2);
    }
    // montante centrale
    c.fillStyle = '#e8d9c0';
    c.fillRect(x + pw / 2 - 0.5, y, 1, ph);

    // alone caldo quando e' aperta
    if (open > 0.4) {
      c.save();
      c.globalCompositeOperation = 'screen';
      const gl = c.createRadialGradient(w.cx, y + ph / 2, 4, w.cx, y + ph / 2, 34);
      gl.addColorStop(0, `rgba(255,190,90,${0.35 * open})`);
      gl.addColorStop(1, 'rgba(255,190,90,0)');
      c.fillStyle = gl;
      c.fillRect(w.cx - 36, y - 24, 72, 70);
      c.restore();
    }
  }
}

/* ------------------------------------------------------------------ */
/* Bucato sui fili                                                      */
/* ------------------------------------------------------------------ */

const LAUNDRY = (() => {
  const rand = rng(77);
  const palette = ['#ffd24a', '#7ee0ff', '#ff8fb8', '#d6ff7a', '#ffffff', '#b9a0ff', '#ff9a5a'];
  const kinds = ['shirt', 'pants', 'sock', 'towel', 'dress'];
  return LINES_Y.map((ly) => {
    const items = [];
    for (let x = -EXTRA_X + 8 + rand() * 18; x < W + EXTRA_X - 8; x += 24 + rand() * 26) {
      items.push({
        x,
        kind: kinds[(rand() * kinds.length) | 0],
        color: palette[(rand() * palette.length) | 0],
        phase: rand() * TAU,
      });
    }
    return { y: ly, items };
  });
})();

function sag(x) {
  return 1.8 * Math.sin((Math.PI * x) / W);
}

export function drawLaundry(c, t) {
  for (const line of LAUNDRY) {
    c.strokeStyle = 'rgba(30,15,50,0.75)';
    c.lineWidth = 0.6;
    c.beginPath();
    for (let x = -EXTRA_X; x <= W + EXTRA_X; x += 8) {
      const y = line.y + sag(x);
      if (x === -EXTRA_X) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
    for (const it of line.items) {
      const py = line.y + sag(it.x);
      c.save();
      c.translate(it.x, py);
      c.rotate(Math.sin(t * 1.5 + it.phase) * 0.09);
      c.fillStyle = it.color;
      c.strokeStyle = 'rgba(20,5,40,0.55)';
      c.lineWidth = 0.4;
      switch (it.kind) {
        case 'shirt':
          c.beginPath();
          c.moveTo(-5, 0.5);
          c.lineTo(-8.5, 3);
          c.lineTo(-7, 6);
          c.lineTo(-4.5, 4.5);
          c.lineTo(-4.5, 12);
          c.lineTo(4.5, 12);
          c.lineTo(4.5, 4.5);
          c.lineTo(7, 6);
          c.lineTo(8.5, 3);
          c.lineTo(5, 0.5);
          c.closePath();
          break;
        case 'pants':
          c.beginPath();
          c.moveTo(-5, 0.5);
          c.lineTo(5, 0.5);
          c.lineTo(5.5, 13);
          c.lineTo(1, 13);
          c.lineTo(0, 6);
          c.lineTo(-1, 13);
          c.lineTo(-5.5, 13);
          c.closePath();
          break;
        case 'sock':
          c.beginPath();
          c.moveTo(-2.4, 0.5);
          c.lineTo(2.4, 0.5);
          c.lineTo(2.4, 7);
          c.lineTo(5.5, 9.5);
          c.lineTo(5.5, 11.5);
          c.lineTo(-2.4, 11.5);
          c.closePath();
          break;
        case 'towel':
          roundRect(c, -5.5, 0.5, 11, 12, 1);
          break;
        default:
          c.beginPath();
          c.moveTo(-3, 0.5);
          c.lineTo(3, 0.5);
          c.lineTo(3.5, 4);
          c.lineTo(7, 14);
          c.lineTo(-7, 14);
          c.lineTo(-3.5, 4);
          c.closePath();
      }
      c.fill();
      c.stroke();
      // mollette
      c.fillStyle = '#f2f2f2';
      c.fillRect(-3.2, -1, 1.2, 2.4);
      c.fillRect(2, -1, 1.2, 2.4);
      c.restore();
    }
  }
}

/* ------------------------------------------------------------------ */
/* Bidoni (con la testa di gatto rivale)                                */
/* ------------------------------------------------------------------ */

export function drawCans(c, cans, t) {
  CAN_X.forEach((cx, i) => {
    const can = cans[i];
    // ombra
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(cx + 1, 178.5, CAN_HALF + 3, 2.2, 0, 0, TAU);
    c.fill();

    const bodyTop = CAN_TOP + 3;
    const g = c.createLinearGradient(cx - CAN_HALF, 0, cx + CAN_HALF, 0);
    g.addColorStop(0, '#4d5a80');
    g.addColorStop(0.35, '#9fb0d4');
    g.addColorStop(1, '#3d4768');
    c.fillStyle = g;
    roundRect(c, cx - 11, bodyTop, 22, 178 - bodyTop, 1.5);
    c.fill();
    c.strokeStyle = 'rgba(20,20,50,0.5)';
    c.lineWidth = 0.6;
    for (let k = 1; k <= 3; k++) {
      const yy = bodyTop + k * 6.5;
      c.beginPath();
      c.moveTo(cx - 11, yy);
      c.lineTo(cx + 11, yy);
      c.stroke();
    }

    const pop = can.pop; // 0..1
    const rattle = can.warn > 0 ? Math.sin(t * 60) * 0.8 : 0;

    // testa di gatto che sbuca
    if (pop > 0.02) {
      c.save();
      c.beginPath();
      c.rect(cx - 14, CAN_TOP - 22, 28, 26);
      c.clip();
      drawRivalHead(c, cx, CAN_TOP + 4 - pop * 11, pop, t);
      c.restore();
    }

    // coperchio con cerniera
    c.save();
    c.translate(cx - 12, CAN_TOP + 1);
    c.rotate(-pop * 0.9);
    c.translate(0, rattle);
    const lg = c.createLinearGradient(0, -3, 0, 1.5);
    lg.addColorStop(0, '#d7e0f5');
    lg.addColorStop(1, '#7f8db3');
    c.fillStyle = lg;
    roundRect(c, -1, -3, 26, 4, 2);
    c.fill();
    c.strokeStyle = '#ff7fb0';
    c.lineWidth = 1.1;
    c.beginPath();
    c.arc(12, -3, 2.6, Math.PI, 0);
    c.stroke();
    c.restore();
  });
}

function drawRivalHead(c, x, y, pop, t) {
  c.save();
  c.translate(x, y);
  c.fillStyle = '#e8923f';
  c.strokeStyle = 'rgba(60,20,10,0.6)';
  c.lineWidth = 0.6;
  // orecchie
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(s * 3, -5);
    c.lineTo(s * 7, -12);
    c.lineTo(s * 8.5, -3);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#ff9fb8';
    c.beginPath();
    c.moveTo(s * 4.4, -5.5);
    c.lineTo(s * 6.6, -9.5);
    c.lineTo(s * 7.2, -4.5);
    c.closePath();
    c.fill();
    c.fillStyle = '#e8923f';
  }
  // testa
  c.beginPath();
  c.ellipse(0, 0, 9, 7.5, 0, 0, TAU);
  c.fill();
  c.stroke();
  // righe
  c.strokeStyle = 'rgba(120,50,10,0.7)';
  c.beginPath();
  c.moveTo(-2, -7);
  c.lineTo(-1.5, -4);
  c.moveTo(0, -7.3);
  c.lineTo(0, -3.5);
  c.moveTo(2, -7);
  c.lineTo(1.5, -4);
  c.stroke();
  // occhi arrabbiati
  c.fillStyle = '#e8ff7a';
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(s * 3.8, -0.8, 2.2, 1.8, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#111';
    c.fillRect(s * 3.8 - 0.4, -2.4, 0.8, 3.2);
    c.fillStyle = '#e8ff7a';
    c.strokeStyle = '#3a1200';
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(s * 6.5, -4.4);
    c.lineTo(s * 1.6, -2.2);
    c.stroke();
  }
  // naso e bocca con zanne
  c.fillStyle = '#ff6f9a';
  c.beginPath();
  c.moveTo(-1.3, 2);
  c.lineTo(1.3, 2);
  c.lineTo(0, 3.3);
  c.closePath();
  c.fill();
  c.fillStyle = '#3a0a18';
  c.beginPath();
  c.ellipse(0, 5, 3.6, 1.6 + Math.sin(t * 25) * 0.3 * pop, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#fff';
  c.fillRect(-2.6, 3.6, 1.1, 1.8);
  c.fillRect(1.5, 3.6, 1.1, 1.8);
  c.restore();
}

/* ------------------------------------------------------------------ */
/* Il gatto (Freddy)                                                    */
/* ------------------------------------------------------------------ */

const FUR = '#1b1727';
const FUR_LIGHT = '#403a5c';

function limb(c, hx, hy, fx, fy, w = 2.5) {
  const kx = (hx + fx) / 2 + (fx - hx) * 0.05;
  const ky = (hy + fy) / 2 - 0.8;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.lineWidth = w;
  c.beginPath();
  c.moveTo(hx, hy);
  c.quadraticCurveTo(kx, ky, fx, fy);
  c.stroke();
  c.fillStyle = FUR_LIGHT;
  c.beginPath();
  c.ellipse(fx + 0.5, fy - 0.2, 1.9, 1.2, 0, 0, TAU);
  c.fill();
}

export function drawCat(c, cat, t) {
  if (cat.hidden) return;
  const blinkAlpha = cat.invuln > 0 && Math.floor(t * 14) % 2 === 0 ? 0.35 : 1;
  c.save();
  c.globalAlpha = blinkAlpha;

  // ombra sulla piattaforma
  if (cat.onGround) {
    c.fillStyle = 'rgba(0,0,0,0.32)';
    c.beginPath();
    c.ellipse(cat.x, cat.y + 0.6, 10, 1.8, 0, 0, TAU);
    c.fill();
  }

  c.translate(cat.x, cat.y);
  if (cat.dead) {
    c.rotate(cat.deadT * 7);
    c.translate(0, -8);
  }
  c.scale(cat.face, 1);

  const running = cat.onGround && Math.abs(cat.vx) > 4;
  const ph = cat.phase;
  const bob = running ? Math.abs(Math.sin(ph)) * 1.0 : 0;
  const airUp = !cat.onGround && cat.vy < -40;
  const airDown = !cat.onGround && cat.vy >= -40;
  const wag = Math.sin(t * (running ? 9 : 3.2));

  c.strokeStyle = FUR;
  c.fillStyle = FUR;

  // coda
  c.lineCap = 'round';
  c.lineWidth = 2.6;
  c.beginPath();
  c.moveTo(-8, -9 - bob);
  if (airUp) c.bezierCurveTo(-14, -9, -17, -10, -20, -11);
  else if (airDown) c.bezierCurveTo(-13, -12, -16, -17, -18, -21);
  else if (running) c.bezierCurveTo(-14, -9, -17, -14, -19, -15 + wag * 1.5);
  else c.bezierCurveTo(-13, -9, -15, -16 + wag * 1.2, -12, -21 + wag);
  c.stroke();

  // zampe lontane (piu' scure)
  c.strokeStyle = '#120f1b';
  const sw = Math.sin(ph);
  const swo = Math.sin(ph + Math.PI);
  const lift = (s) => Math.max(0, Math.cos(s)) * 2.8;
  if (airUp) {
    limb(c, 5.5, -6.5, 9, -11);
    limb(c, -5.5, -6.5, -10, -5);
  } else if (airDown) {
    limb(c, 5.5, -6.5, 8, -3.5);
    limb(c, -5.5, -6.5, -9, -3);
  } else if (running) {
    limb(c, 5.5, -6.5, 5.5 + swo * 5, -0.6 - lift(ph + Math.PI));
    limb(c, -5.5, -6.5, -5.5 + sw * 5, -0.6 - lift(ph));
  } else {
    limb(c, 5.5, -6.5, 6, -0.6);
    limb(c, -5.5, -6.5, -6, -0.6);
  }

  // corpo
  c.strokeStyle = FUR;
  const bg = c.createLinearGradient(0, -15 - bob, 0, -4 - bob);
  bg.addColorStop(0, '#3a3454');
  bg.addColorStop(0.45, FUR);
  bg.addColorStop(1, '#0f0c18');
  c.fillStyle = bg;
  c.beginPath();
  c.ellipse(0, -9.5 - bob, 9.8, 5.3, 0, 0, TAU);
  c.fill();
  // luce di bordo
  c.strokeStyle = 'rgba(160,150,255,0.55)';
  c.lineWidth = 0.7;
  c.beginPath();
  c.ellipse(0, -9.5 - bob, 9.5, 5.0, 0, Math.PI * 1.08, Math.PI * 1.9);
  c.stroke();

  // zampe vicine
  c.strokeStyle = FUR;
  if (airUp) {
    limb(c, 6.5, -6, 10.5, -10.5);
    limb(c, -6.5, -6, -11, -6);
  } else if (airDown) {
    limb(c, 6.5, -6, 9.5, -2.5);
    limb(c, -6.5, -6, -10, -2.5);
  } else if (running) {
    limb(c, 6.5, -6, 6.5 + sw * 5, -0.6 - lift(ph));
    limb(c, -6.5, -6, -6.5 + swo * 5, -0.6 - lift(ph + Math.PI));
  } else {
    limb(c, 6.5, -6, 7, -0.6);
    limb(c, -6.5, -6, -7, -0.6);
  }

  // testa
  const hy = -13.2 - bob * 0.8;
  c.fillStyle = FUR;
  for (const s of [0, 1]) {
    const ox = 7.8 + s * 5.2;
    c.beginPath();
    c.moveTo(ox - 0.8, hy - 3.2);
    c.lineTo(ox + 0.8 + s * 0.8, hy - 9.5);
    c.lineTo(ox + 3.3, hy - 3);
    c.closePath();
    c.fill();
    c.fillStyle = '#ff9fc4';
    c.beginPath();
    c.moveTo(ox + 0.2, hy - 3.6);
    c.lineTo(ox + 1.3 + s * 0.6, hy - 7.4);
    c.lineTo(ox + 2.5, hy - 3.4);
    c.closePath();
    c.fill();
    c.fillStyle = FUR;
  }
  const hg = c.createRadialGradient(11, hy - 1.5, 1, 11.5, hy, 6);
  hg.addColorStop(0, '#3a3454');
  hg.addColorStop(1, FUR);
  c.fillStyle = hg;
  c.beginPath();
  c.ellipse(11.4, hy, 5.2, 4.7, 0, 0, TAU);
  c.fill();
  c.strokeStyle = 'rgba(160,150,255,0.5)';
  c.lineWidth = 0.6;
  c.beginPath();
  c.ellipse(11.4, hy, 5.0, 4.5, 0, Math.PI * 1.15, Math.PI * 1.75);
  c.stroke();

  // occhi
  const blink = cat.blink > 0;
  const stunned = cat.stun > 0 || cat.dead;
  for (const ex of [12.6, 15.4]) {
    if (stunned) {
      c.strokeStyle = '#ffe86a';
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(ex - 1, hy - 2);
      c.lineTo(ex + 1, hy);
      c.moveTo(ex + 1, hy - 2);
      c.lineTo(ex - 1, hy);
      c.stroke();
    } else if (blink) {
      c.strokeStyle = '#ffe86a';
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(ex - 1, hy - 1);
      c.lineTo(ex + 1, hy - 1);
      c.stroke();
    } else {
      c.fillStyle = '#ffe86a';
      c.beginPath();
      c.ellipse(ex, hy - 1.1, 1.35, 1.7, 0, 0, TAU);
      c.fill();
      c.fillStyle = '#000';
      c.fillRect(ex - 0.28, hy - 2.7, 0.56, 3.1);
    }
  }
  // naso e baffi
  c.fillStyle = '#ff7fa8';
  c.beginPath();
  c.moveTo(16.2, hy + 0.5);
  c.lineTo(17.6, hy + 0.2);
  c.lineTo(16.9, hy + 1.5);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.7)';
  c.lineWidth = 0.35;
  c.beginPath();
  c.moveTo(15.6, hy + 1.4);
  c.lineTo(19.5, hy + 0.6);
  c.moveTo(15.6, hy + 1.9);
  c.lineTo(19.3, hy + 2.6);
  c.stroke();

  // stelline se stordito
  if (cat.stun > 0 && !cat.dead) {
    c.fillStyle = '#ffe86a';
    for (let k = 0; k < 3; k++) {
      const a = t * 8 + (k * TAU) / 3;
      c.beginPath();
      c.arc(11 + Math.cos(a) * 6, hy - 9 + Math.sin(a) * 1.8, 0.9, 0, TAU);
      c.fill();
    }
  }
  c.restore();
}

/* ------------------------------------------------------------------ */
/* Il cane                                                              */
/* ------------------------------------------------------------------ */

export function drawDog(c, dog, t) {
  if (!dog.active) return;
  c.save();
  // polvere
  for (let k = 1; k <= 4; k++) {
    c.fillStyle = `rgba(200,180,230,${0.22 - k * 0.04})`;
    c.beginPath();
    c.arc(dog.x - dog.dir * (14 + k * 7), GROUND_LINE - 2 - Math.sin(t * 20 + k) * 1.2, 2 + k * 0.7, 0, TAU);
    c.fill();
  }
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath();
  c.ellipse(dog.x, GROUND_LINE + 0.5, 15, 2, 0, 0, TAU);
  c.fill();

  c.translate(dog.x, GROUND_LINE);
  c.scale(dog.dir, 1);
  const ph = dog.phase;
  const bounce = Math.abs(Math.sin(ph)) * 1.8;
  const DOG = '#b9b4cf';
  const DOG_D = '#7c7796';

  // zampe lontane
  c.strokeStyle = DOG_D;
  c.lineCap = 'round';
  c.lineWidth = 3;
  const legs = [
    [8, Math.sin(ph)],
    [-8, Math.sin(ph + 2.6)],
    [10, Math.sin(ph + Math.PI)],
    [-10, Math.sin(ph + Math.PI + 2.6)],
  ];
  legs.slice(0, 2).forEach(([hx, s]) => {
    c.beginPath();
    c.moveTo(hx, -8 - bounce);
    c.lineTo(hx + s * 7, -1 - Math.max(0, Math.cos(ph)) * 2);
    c.stroke();
  });
  // corpo
  const g = c.createLinearGradient(0, -20, 0, -6);
  g.addColorStop(0, '#d8d4ea');
  g.addColorStop(1, DOG);
  c.fillStyle = g;
  roundRect(c, -14, -19 - bounce, 28, 13, 6);
  c.fill();
  // macchia
  c.fillStyle = 'rgba(80,60,110,0.35)';
  roundRect(c, -8, -18 - bounce, 11, 7, 3);
  c.fill();
  // zampe vicine
  c.strokeStyle = DOG;
  legs.slice(2).forEach(([hx, s]) => {
    c.beginPath();
    c.moveTo(hx, -8 - bounce);
    c.lineTo(hx + s * 7, -1 - Math.max(0, Math.cos(ph + Math.PI)) * 2);
    c.stroke();
  });
  // coda
  c.strokeStyle = DOG;
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(-13, -16 - bounce);
  c.lineTo(-17, -20 - bounce - Math.sin(t * 25));
  c.stroke();
  // testa
  c.fillStyle = DOG;
  roundRect(c, 9, -23 - bounce, 15, 12, 5);
  c.fill();
  // muso
  c.fillStyle = '#d8d4ea';
  roundRect(c, 17, -18 - bounce, 9, 7, 3);
  c.fill();
  c.fillStyle = '#16111f';
  c.beginPath();
  c.ellipse(25.4, -18 - bounce, 2.1, 1.6, 0, 0, TAU);
  c.fill();
  // fauci
  c.fillStyle = '#4a1022';
  c.fillRect(18, -13.3 - bounce, 7, 2 + Math.abs(Math.sin(t * 18)) * 1.5);
  c.fillStyle = '#fff';
  c.fillRect(19, -13.3 - bounce, 1.3, 1.8);
  c.fillRect(22.5, -13.3 - bounce, 1.3, 1.8);
  // orecchio
  c.fillStyle = DOG_D;
  c.beginPath();
  c.moveTo(10, -23 - bounce);
  c.lineTo(12, -29 - bounce);
  c.lineTo(15.5, -22.5 - bounce);
  c.closePath();
  c.fill();
  // occhio arrabbiato
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(19.2, -20.2 - bounce, 1.7, 0, TAU);
  c.fill();
  c.fillStyle = '#c4122f';
  c.beginPath();
  c.arc(19.7, -20.1 - bounce, 0.9, 0, TAU);
  c.fill();
  c.strokeStyle = '#2a1840';
  c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(16.2, -22.8 - bounce);
  c.lineTo(21.2, -21.4 - bounce);
  c.stroke();
  // collare con borchie
  c.fillStyle = '#d6264a';
  c.fillRect(8.2, -20 - bounce, 2.8, 8);
  c.fillStyle = '#ffd24a';
  for (const yy of [-18.5, -15.5, -12.5]) c.fillRect(8.7, yy - bounce, 1.8, 1.2);
  c.restore();
}

const GROUND_LINE = 188;

/* ------------------------------------------------------------------ */
/* Oggetti lanciati dalle finestre                                      */
/* ------------------------------------------------------------------ */

export function drawThrown(c, o) {
  c.save();
  c.translate(o.x, o.y);
  c.rotate(o.rot);
  if (o.kind === 'pot') {
    c.fillStyle = '#c8683a';
    c.beginPath();
    c.moveTo(-4, -3);
    c.lineTo(4, -3);
    c.lineTo(3, 4);
    c.lineTo(-3, 4);
    c.closePath();
    c.fill();
    c.fillStyle = '#e48a56';
    c.fillRect(-4.6, -4.2, 9.2, 1.8);
    c.fillStyle = '#3fae4a';
    c.beginPath();
    c.ellipse(-2, -6, 2.2, 1.2, -0.6, 0, TAU);
    c.ellipse(2, -6.4, 2.2, 1.2, 0.6, 0, TAU);
    c.fill();
  } else if (o.kind === 'shoe') {
    c.fillStyle = '#6a3b1e';
    c.beginPath();
    c.moveTo(-5, -2);
    c.lineTo(1, -2);
    c.lineTo(1.5, 0);
    c.lineTo(5, 1);
    c.lineTo(5, 3);
    c.lineTo(-5, 3);
    c.closePath();
    c.fill();
    c.fillStyle = '#2a140a';
    c.fillRect(-5, 2.4, 10, 1.2);
  } else {
    c.fillStyle = '#e8d9a8';
    roundRect(c, -6, -1.6, 12, 3.2, 1.6);
    c.fill();
    c.fillStyle = '#b08a4a';
    c.fillRect(-8.5, -0.8, 3, 1.6);
    c.fillRect(5.5, -0.8, 3, 1.6);
  }
  c.restore();
}

/* ------------------------------------------------------------------ */
/* Cartello "!" per l'arrivo del cane                                    */
/* ------------------------------------------------------------------ */

export function drawWarning(c, x, t) {
  c.save();
  c.translate(x, 166 + Math.sin(t * 14) * 1.2);
  c.fillStyle = '#ffdf4a';
  c.strokeStyle = '#3a1200';
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(0, -8);
  c.lineTo(8, 6);
  c.lineTo(-8, 6);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = '#3a1200';
  c.fillRect(-0.9, -3, 1.8, 5);
  c.fillRect(-0.9, 3, 1.8, 1.6);
  c.restore();
}

/* Topo che corre sul filo del bucato. */
export function drawMouse(c, m) {
  if (!m.alive) return;
  c.save();
  c.translate(m.x, m.y);
  c.scale(m.dir, 1);
  const run = Math.sin(m.phase) * 0.9;
  // coda
  c.strokeStyle = '#ff9fc0';
  c.lineWidth = 0.7;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-4.5, -2.2);
  c.quadraticCurveTo(-8, -2 + run, -10.5, -4 - run);
  c.stroke();
  // corpo
  const g = c.createLinearGradient(0, -7, 0, 0);
  g.addColorStop(0, '#d9d4e6');
  g.addColorStop(1, '#8f89a8');
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(0, -3, 5.2, 3, 0, 0, TAU);
  c.fill();
  // testa
  c.beginPath();
  c.ellipse(4.6, -3.3, 2.6, 2.1, 0, 0, TAU);
  c.fill();
  // orecchio e occhio, naso
  c.fillStyle = '#ff9fc0';
  c.beginPath();
  c.arc(3.6, -5.4, 1.4, 0, TAU);
  c.fill();
  c.fillStyle = '#111';
  c.beginPath();
  c.arc(5.4, -3.9, 0.45, 0, TAU);
  c.fill();
  c.fillStyle = '#ff6f9a';
  c.beginPath();
  c.arc(7.1, -3.2, 0.55, 0, TAU);
  c.fill();
  // zampette
  c.strokeStyle = '#6a6485';
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(-2, -1.2);
  c.lineTo(-2 + run, 0.3);
  c.moveTo(2, -1.2);
  c.lineTo(2 - run, 0.3);
  c.stroke();
  c.restore();
}

/* Insetti notturni attorno alle finestre accese: solo atmosfera. */
export function drawMoths(c, wins, t) {
  c.fillStyle = 'rgba(255,240,190,0.85)';
  for (const w of wins) {
    if (w.open < 0.6) continue;
    for (let k = 0; k < 2; k++) {
      const a = t * (1.6 + k * 0.7) + w.cx * 0.3 + k * 2;
      const x = w.cx + Math.cos(a) * 14;
      const y = SILL_Y[w.r] - WIN_H / 2 + Math.sin(a * 1.3) * 7;
      c.beginPath();
      c.arc(x, y, 0.7, 0, TAU);
      c.fill();
    }
  }
}
