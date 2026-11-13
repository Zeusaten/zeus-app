// Geometria del vicolo, in "unita' mondo" (320 x 200, come lo schermo CGA originale).
// Le posizioni sono state misurate sulle schermate dell'Alley Cat originale (1984).

export const W = 320;
export const H = 200;

// Margini dello sfondo oltre lo schermo originale: riempiono le bande su schermi diversi da 8:5.
export const EXTRA_X = 60;
export const EXTRA_Y = 70;

export const GROUND_Y = 188; // dove poggiano le zampe del gatto sull'asfalto
export const FENCE_TOP = 104; // cima dello steccato = davanzale della fila di finestre piu' bassa
export const FENCE_BOTTOM = 178;

export const CAN_X = [40, 82, 120, 168, 255, 298]; // centri dei 6 bidoni
export const CAN_TOP = 150; // altezza del coperchio
export const CAN_HALF = 12.5;

export const WIN_COLS = [36, 118, 198, 278]; // centri delle 4 colonne di finestre
export const WIN_W = 34;
export const WIN_H = 17;
export const SILL_Y = [41, 74, 104]; // davanzale di ogni fila (0 = in alto)
export const LINES_Y = [14, 41, 74]; // fili del bucato (percorribili dal gatto)
// Punti dei 3 topi che corrono sui fili (dal piu' alto al piu' basso): dalla tabella DS:1F39 di CAT.EXE, x10.
export const MOUSE_POINTS = [90, 70, 50];

export const RUN_SPEED = 130; // unita/secondo
export const GRAVITY = 900;
export const JUMP_V = 300; // altezza salto ~50 unita'

/** Piattaforme su cui il gatto puo' atterrare (solo dall'alto). */
export function buildPlatforms() {
  const p = [];
  p.push({ x0: -10, x1: W + 10, y: GROUND_Y, kind: 'ground' });
  p.push({ x0: -10, x1: W + 10, y: FENCE_TOP, kind: 'fence' });
  CAN_X.forEach((cx, i) => p.push({ x0: cx - CAN_HALF, x1: cx + CAN_HALF, y: CAN_TOP, kind: 'can', index: i }));
  // i tre fili del bucato attraversano tutto il vicolo
  LINES_Y.forEach((y, row) => p.push({ x0: -10, x1: W + 10, y, kind: 'line', row }));
  return p;
}

export const SKILLS = [
  { id: 'kitten', label: 'Kitten', dogEvery: 16, throwEvery: 5.0, dogSpeed: 150, headEvery: 9 },
  { id: 'house', label: 'House Cat', dogEvery: 12, throwEvery: 4.0, dogSpeed: 175, headEvery: 7 },
  { id: 'tomcat', label: 'Tomcat', dogEvery: 9, throwEvery: 3.0, dogSpeed: 200, headEvery: 5.5 },
  { id: 'alley', label: 'Alley Cat', dogEvery: 6.5, throwEvery: 2.2, dogSpeed: 230, headEvery: 4 },
];
