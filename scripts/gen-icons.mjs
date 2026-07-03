/**
 * Generates favicon.svg and og-image.svg from the REAL in-game Nora sprite
 * (so the branding can't drift from the game art). Run: node scripts/gen-icons.mjs
 */
import { writeFileSync } from 'node:fs';
import { CRITTERS, PALS } from '../data/creatures.js';

function spriteRects(key, stage, size, ox = 0, oy = 0) {
  const grid = CRITTERS[key].stages[stage];
  const pal = PALS[CRITTERS[key].type];
  const cell = size / grid.length;
  let out = '';
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < grid[y].length; x++) {
      const id = grid[y][x];
      if (!id || !pal[id]) continue;
      out += `<rect x="${(ox + x * cell).toFixed(2)}" y="${(oy + y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="${pal[id]}"/>`;
    }
  return out;
}

// --- favicon: Nora on a warm rounded tile ---
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges">
<rect width="64" height="64" rx="14" fill="#f0954a"/>
<rect x="3" y="3" width="58" height="58" rx="12" fill="#fff6df"/>
${spriteRects('nora', 0, 52, 6, 6)}
</svg>`;
writeFileSync(new URL('../favicon.svg', import.meta.url), favicon);

// --- social / og image (1200x630) ---
const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" shape-rendering="crispEdges">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#8ad0e8"/><stop offset="0.54" stop-color="#bfe6f2"/>
<stop offset="0.54" stop-color="#7cc46a"/><stop offset="1" stop-color="#57a84a"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#sky)"/>
${spriteRects('nora', 2, 300, 120, 165)}
<text x="470" y="300" font-family="ui-monospace,Menlo,monospace" font-size="150" font-weight="800"
  fill="#f0a24a" stroke="#6a2f0a" stroke-width="6" paint-order="stroke" letter-spacing="10">COBBIES</text>
<text x="474" y="380" font-family="ui-monospace,Menlo,monospace" font-size="40" font-weight="700"
  fill="#356a35" letter-spacing="14">A COZY CREATURE RANCH</text>
</svg>`;
writeFileSync(new URL('../og-image.svg', import.meta.url), og);

console.log('wrote favicon.svg + og-image.svg');
