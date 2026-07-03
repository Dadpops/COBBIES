/**
 * PLAYER AVATAR — a customisable chibi that wanders the farm with the
 * animals. Built from layers (body → hair → hat) so parts mix freely. Each
 * grid is a 16x16 char map; a char maps to a palette index, and the palette
 * is rebuilt from the player's colour picks. This mirrors the creature
 * renderer so the avatar sits at the same size as the critters.
 */

// char -> palette index
const LEG = { '.':0,'k':1,'s':2,'d':3,'h':4,'g':5,'c':6,'v':7,'e':8,'a':9,'b':10,'m':11 };

const BASE = [
  '................',
  '................',
  '...kkkkkkkkkk...',
  '...kssssssssk...',
  '...kssessessk...',
  '...kssssssssk...',
  '...ksssmmsssk...',
  '...kdssssssdk...',
  '....kssssk......',
  '..kcccccccck....',
  '..kcccccccck....',
  '..kcccccccck....',
  '..kcccccccck....',
  '..kcccccccck....',
  '...kvvk..kvvk...',
  '...kvvk..kvvk...',
];

const HAIR = {
  none: [],
  short: [
    '................',
    '...hhhhhhhhh....',
    '..hhhhhhhhhhh...',
    '..hh......hh....',
  ],
  long: [
    '................',
    '..hhhhhhhhhhh...',
    '..hhhhhhhhhhh...',
    '..hh......hh....',
    '..hh......hh....',
    '..hh......hh....',
    '..hhh....hhh....',
    '...hh....hh.....',
  ],
  spiky: [
    '...h.h.h.h.h....',
    '..hhhhhhhhhhh...',
    '..hhhhhhhhhhh...',
    '..hh......hh....',
  ],
  bun: [
    '.....hhh........',
    '...hhhhhhhhh....',
    '..hhhhhhhhhhh...',
    '..hh......hh....',
  ],
};

const HATS = {
  none: [],
  cap: [
    '................',
    '..aaaaaaaaaa....',
    '.baaaaaaaaaab...',
  ],
  flower: [
    '...a.a..........',
    '..abaa..........',
    '...a.a..........',
  ],
  band: [
    '................',
    '................',
    '................',
    '..bbbbbbbbbbb...',
  ],
};

export const AVATAR_OPTIONS = {
  skins: [
    { name: 'FAIR', c: '#f4c8a0', d: '#dca880' },
    { name: 'WARM', c: '#e0a072', d: '#c68858' },
    { name: 'TAN',  c: '#c88a5a', d: '#a86e44' },
    { name: 'DEEP', c: '#8a5a3a', d: '#6e4428' },
    { name: 'RICH', c: '#5e3a24', d: '#472a18' },
  ],
  hairColors: [
    { name: 'BROWN',  c: '#6a4028', d: '#4a2c18' },
    { name: 'BLACK',  c: '#2a2430', d: '#1a1620' },
    { name: 'BLONDE', c: '#e8c86a', d: '#c8a44a' },
    { name: 'RED',    c: '#c85a30', d: '#a03e1e' },
    { name: 'PINK',   c: '#e88ab8', d: '#c86a98' },
    { name: 'BLUE',   c: '#5a86c8', d: '#3e64a0' },
  ],
  hairStyles: ['short', 'long', 'spiky', 'bun', 'none'],
  outfits: [
    { name: 'RED',    c: '#d85a4a', d: '#b03e30' },
    { name: 'BLUE',   c: '#4a86c8', d: '#3364a0' },
    { name: 'GREEN',  c: '#4aa85a', d: '#348044' },
    { name: 'PURPLE', c: '#8a5ac8', d: '#6a3ea0' },
    { name: 'YELLOW', c: '#e8c04a', d: '#c89a30' },
    { name: 'TEAL',   c: '#3ab0a0', d: '#2a8a7c' },
  ],
  hats: [
    { name: 'NONE',   style: 'none',   c: null,      d: null },
    { name: 'CAP',    style: 'cap',    c: '#d85a4a', d: '#b03e30' },
    { name: 'FLOWER', style: 'flower', c: '#e88ab8', d: '#c86a98' },
    { name: 'BAND',   style: 'band',   c: '#4a86c8', d: '#3364a0' },
  ],
};

/** A fresh default look. */
export function defaultAvatar() {
  return { skin: 0, hairColor: 0, hairStyle: 0, outfit: 1, hat: 0 };
}

function paletteFor(sel) {
  const O = AVATAR_OPTIONS;
  const skin = O.skins[sel.skin] || O.skins[0];
  const hair = O.hairColors[sel.hairColor] || O.hairColors[0];
  const out = O.outfits[sel.outfit] || O.outfits[0];
  const hat = O.hats[sel.hat] || O.hats[0];
  return [
    null, '#2a2018', skin.c, skin.d, hair.c, hair.d,
    out.c, out.d, '#201810', hat.c, hat.d, '#e0788a',
  ];
}

function drawLayer(ctx, rows, pal, ox, oy, cell) {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const id = LEG[row[x]];
      if (!id) continue;
      const color = pal[id];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
    }
  }
}

/**
 * Draw the composed avatar. `sel` is a selection object (see defaultAvatar).
 */
export function drawAvatar(ctx, sel, ox, oy, cell) {
  const pal = paletteFor(sel);
  drawLayer(ctx, BASE, pal, ox, oy, cell);
  const styleName = AVATAR_OPTIONS.hairStyles[sel.hairStyle] || 'short';
  drawLayer(ctx, HAIR[styleName] || [], pal, ox, oy, cell);
  const hat = AVATAR_OPTIONS.hats[sel.hat] || AVATAR_OPTIONS.hats[0];
  drawLayer(ctx, HATS[hat.style] || [], pal, ox, oy, cell);
}
