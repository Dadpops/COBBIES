/**
 * Shared pixel renderer — extracted verbatim (in behaviour) from the
 * prototype. Every creature is a grid of palette indices; index 0 is
 * transparent, any other index looks up a colour in `pal`.
 *
 * This is the single source of truth for how a sprite reaches the screen.
 * Keep it dumb and fast; it runs in the farm loop and the run loop.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[][]} grid   rows of palette indices (0 = transparent)
 * @param {(string|null)[]} pal  palette; index 0 is null/transparent
 * @param {number} ox   left offset in device pixels
 * @param {number} oy   top offset in device pixels
 * @param {number} cell size of one pixel-cell in device pixels
 */
export function drawPix(ctx, grid, pal, ox, oy, cell) {
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const id = row[x];
      if (!id) continue;
      const color = pal[id];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
    }
  }
}

/**
 * Convenience: draw a 16x16 creature grid centred inside a square canvas
 * area of side `size`, at the given cell scale. Used by cards / reveals.
 */
export function drawCentered(ctx, grid, pal, size, cell) {
  const w = grid[0].length * cell;
  const h = grid.length * cell;
  drawPix(ctx, grid, pal, (size - w) / 2, (size - h) / 2, cell);
}
