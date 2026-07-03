/**
 * Hat-aware critter draw. Draws the creature sprite, then its equipped hat
 * overlay (if any) on top, at the same origin/scale. Use this anywhere a
 * player-owned critter is shown so cosmetics appear consistently.
 */

import { CRITTERS, PALS } from '../data/creatures.js';
import { HATS } from '../data/cosmetics.js';
import { drawPix } from './pixel.js';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} key    creature key
 * @param {number} stage
 * @param {string|null} hat  equipped hat id (or null)
 * @param {number} ox
 * @param {number} oy
 * @param {number} cell
 */
export function drawCritter(ctx, key, stage, hat, ox, oy, cell) {
  const cd = CRITTERS[key];
  drawPix(ctx, cd.stages[stage], PALS[cd.type], ox, oy, cell);
  if (hat && HATS[hat]) drawPix(ctx, HATS[hat].grid, HATS[hat].pal, ox, oy, cell);
}

/** Same, but centred inside a square area of side `size`. */
export function drawCritterCentered(ctx, key, stage, hat, size, cell) {
  const grid = CRITTERS[key].stages[stage];
  const ox = (size - grid[0].length * cell) / 2;
  const oy = (size - grid.length * cell) / 2;
  drawCritter(ctx, key, stage, hat, ox, oy, cell);
}
