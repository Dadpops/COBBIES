/**
 * FARM SCENE — the 2.5D isometric "home" the player owns.
 * Ported from the prototype: sky/ground gradient, iso tile grid, a barn
 * accent, drifting clouds, and the roster wandering with depth-sorted
 * shadows. This is where growth feels like it matters.
 *
 * Exposes a small controller so main.js can start it, resync wanderers
 * when the roster changes (hatch/evolve), and let the player tap a critter.
 */

import { CRITTERS, PALS } from '../data/creatures.js';
import { drawPix } from '../render/pixel.js';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {() => import('./save.js').GameState} getState
 * @param {(key:string) => void} [onPickCritter]  tap a critter -> callback
 */
export function createFarm(canvas, getState, onPickCritter) {
  const ctx = canvas.getContext('2d');
  let FW = 0, FH = 0, ft = 0, raf = 0;
  /** @type {{key:string,stage:number,x:number,y:number,tx:number,ty:number,ph:number,flip:number}[]} */
  let wanderers = [];

  function resize() {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width;
    canvas.height = r.height;
    FW = canvas.width;
    FH = canvas.height;
  }

  /** Rebuild wanderers from current roster (call after hatch / evolve). */
  function sync() {
    const roster = getState().roster;
    wanderers = roster.map((r, i) => {
      const existing = wanderers.find((w) => w.key === r.key);
      if (existing) {
        existing.stage = r.stage;
        return existing;
      }
      return {
        key: r.key,
        stage: r.stage,
        x: 0.3 + 0.2 * (i % 3),
        y: 0.55 + 0.08 * (i % 2),
        tx: Math.random(),
        ty: Math.random() * 0.3 + 0.5,
        ph: Math.random() * 6.28,
        flip: 1,
      };
    });
  }

  function isoTile(cx, cy, top, left, right, tw, td) {
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.moveTo(cx, cy); ctx.lineTo(cx + tw, cy + td);
    ctx.lineTo(cx, cy + td * 2); ctx.lineTo(cx - tw, cy + td);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = left;
    ctx.beginPath();
    ctx.moveTo(cx - tw, cy + td); ctx.lineTo(cx, cy + td * 2);
    ctx.lineTo(cx, cy + td * 2 + 6); ctx.lineTo(cx - tw, cy + td + 6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = right;
    ctx.beginPath();
    ctx.moveTo(cx + tw, cy + td); ctx.lineTo(cx, cy + td * 2);
    ctx.lineTo(cx, cy + td * 2 + 6); ctx.lineTo(cx + tw, cy + td + 6);
    ctx.closePath(); ctx.fill();
  }

  function drawBarn(x, y) {
    ctx.fillStyle = '#c0503a'; ctx.fillRect(x - 22, y, 44, 30);
    ctx.fillStyle = '#a03a2a';
    ctx.beginPath(); ctx.moveTo(x - 26, y); ctx.lineTo(x, y - 18);
    ctx.lineTo(x + 26, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a2a1e'; ctx.fillRect(x - 7, y + 12, 14, 18);
    ctx.fillStyle = '#e8c86a'; ctx.fillRect(x - 3, y + 3, 6, 6);
  }

  function frame() {
    ft += 0.016;
    const g = ctx.createLinearGradient(0, 0, 0, FH);
    g.addColorStop(0, '#8ad0e8'); g.addColorStop(0.55, '#c8ecf0');
    g.addColorStop(0.56, '#7ec86a'); g.addColorStop(1, '#4fa85f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, FW, FH);

    ctx.fillStyle = 'rgba(255,255,255,.7)';
    const cl = (ft * 8) % (FW + 80) - 40;
    ctx.fillRect(cl, 50, 44, 10); ctx.fillRect(cl + 8, 42, 28, 10);
    ctx.fillRect(FW - cl * 0.6, 80, 36, 8); ctx.fillRect(FW - cl * 0.6 + 6, 73, 22, 8);

    const originY = FH * 0.5, tw = 34, td = 17, cols = 5, rows = 4;
    const cx0 = FW / 2;
    for (let r = 0; r < rows; r++)
      for (let cIdx = 0; cIdx < cols; cIdx++) {
        const cx = cx0 + (cIdx - r) * tw;
        const cy = originY + (cIdx + r) * td - td * 3;
        const alt = (r + cIdx) % 2;
        isoTile(cx, cy, alt ? '#7ac86a' : '#6cbe5e', alt ? '#4a9a4a' : '#3f8f3f',
          alt ? '#3f8f3f' : '#357f37', tw, td);
      }

    drawBarn(cx0 + tw * 2.1, originY - 6);

    const sorted = [...wanderers].sort((a, b) => a.y - b.y);
    for (const w of sorted) {
      w.x += (w.tx - w.x) * 0.008; w.y += (w.ty - w.y) * 0.008;
      if (Math.hypot(w.tx - w.x, w.ty - w.y) < 0.02) {
        w.tx = 0.2 + Math.random() * 0.6; w.ty = 0.5 + Math.random() * 0.28;
        w.flip = w.tx > w.x ? 1 : -1;
      }
      const px = w.x * FW, py = w.y * FH;
      const bob = Math.abs(Math.sin(ft * 4 + w.ph)) * 3;
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath(); ctx.ellipse(px, py + 2, 16, 6, 0, 0, 6.28); ctx.fill();
      const grid = CRITTERS[w.key].stages[w.stage];
      drawPix(ctx, grid, PALS[CRITTERS[w.key].type], px - 24, py - 40 - bob, 3);
    }
    raf = requestAnimationFrame(frame);
  }

  // Tap-to-inspect: hit-test the tap against each wanderer's sprite box.
  function onPointerDown(e) {
    if (!onPickCritter) return;
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (FW / r.width);
    const my = (e.clientY - r.top) * (FH / r.height);
    // topmost (largest y) first so front critters win overlaps
    const sorted = [...wanderers].sort((a, b) => b.y - a.y);
    for (const w of sorted) {
      const px = w.x * FW, py = w.y * FH;
      if (mx > px - 24 && mx < px + 24 && my > py - 46 && my < py + 8) {
        onPickCritter(w.key);
        return;
      }
    }
  }

  function start() {
    resize();
    sync();
    canvas.addEventListener('pointerdown', onPointerDown);
    if (!raf) frame();
  }
  function stop() {
    cancelAnimationFrame(raf); raf = 0;
    canvas.removeEventListener('pointerdown', onPointerDown);
  }

  return { start, stop, sync, resize };
}
