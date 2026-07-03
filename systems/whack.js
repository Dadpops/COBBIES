/**
 * WHACK-A-COBBIE — the second minigame. Creatures pop out of holes in the
 * ground; tap them before they duck back down. A 30-second round that
 * steadily gets harder: pop intervals shorten and up-times shrink as the
 * clock runs, clamped so it never becomes unplayable. Score converts to
 * coins + XP for the player's buddy.
 */

import { CRITTERS, PALS } from '../data/creatures.js';
import { drawPix } from '../render/pixel.js';

const DURATION = 30;

export function createWhack(canvas, opts) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, raf = 0, last = 0;
  let holes = [], elapsed = 0, score = 0, running = false, spawnT = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width; canvas.height = r.height;
    W = canvas.width; H = canvas.height;
  }

  function layout() {
    holes = [];
    const cols = 3, rows = 2;
    const marginX = W * 0.15, top = H * 0.4, gapX = (W - 2 * marginX) / (cols - 1), gapY = H * 0.25;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        holes.push({ x: marginX + gapX * c, y: top + gapY * r, up: 0, dir: 0, key: null, tUp: 0, pop: 0 });
  }

  /** difficulty as a function of elapsed time (clamped so it stays fair) */
  function diff() {
    const p = Math.min(1, elapsed / DURATION);
    return { interval: 1.0 - 0.55 * p, upTime: 1.2 - 0.55 * p, prog: p };
  }

  function pickKey() {
    const r = opts.getState().roster;
    return r[(Math.random() * r.length) | 0].key;
  }

  function spawnOne(upTime) {
    const empty = holes.filter((h) => !h.key);
    if (!empty.length) return;
    const h = empty[(Math.random() * empty.length) | 0];
    h.key = pickKey(); h.up = 0; h.dir = 1; h.tUp = upTime; h.pop = 0;
  }

  function loop() {
    const now = performance.now();
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;

    if (running) {
      elapsed += dt;
      const d = diff();
      spawnT -= dt;
      if (spawnT <= 0) { spawnT = d.interval * (0.7 + Math.random() * 0.6); spawnOne(d.upTime); }
      for (const h of holes) {
        if (h.pop > 0) h.pop = Math.max(0, h.pop - dt * 4);
        if (h.dir === 1) { h.up = Math.min(1, h.up + dt * 6); if (h.up >= 1) h.dir = 0; }
        else if (h.dir === 0 && h.key) { h.tUp -= dt; if (h.tUp <= 0) h.dir = -1; }
        else if (h.dir === -1) { h.up = Math.max(0, h.up - dt * 6); if (h.up <= 0) { h.dir = 0; h.key = null; } }
      }
      opts.onIntensity && opts.onIntensity(d.prog);
      if (elapsed >= DURATION) { end(); }
    }
    draw();
    raf = running ? requestAnimationFrame(loop) : 0;
  }

  function draw() {
    // sky + grass field
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#bfe6f2'); g.addColorStop(0.34, '#dff1ec');
    g.addColorStop(0.35, '#7cc26a'); g.addColorStop(1, '#4fa85f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    for (const h of holes) {
      // hole
      ctx.fillStyle = '#3a2a1e';
      ctx.beginPath(); ctx.ellipse(h.x, h.y, 30, 12, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#2a1e14';
      ctx.beginPath(); ctx.ellipse(h.x, h.y - 1, 26, 9, 0, 0, 6.28); ctx.fill();

      if (h.key && h.up > 0) {
        const cd = CRITTERS[h.key];
        const squash = h.pop * 0.25;
        ctx.save();
        // clip so the sprite emerges from the hole (nothing below the rim)
        ctx.beginPath(); ctx.rect(h.x - 32, 0, 64, h.y + 4); ctx.clip();
        ctx.translate(h.x, h.y + 6);
        ctx.scale(1 + squash, 1 - squash);
        const top = -44 * h.up;
        drawPix(ctx, cd.stages[0], PALS[cd.type], -24, top, 3);
        ctx.restore();
      }
      // rim in front
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.beginPath(); ctx.ellipse(h.x, h.y + 3, 30, 8, 0, 0, Math.PI); ctx.fill();
    }

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    roundRect(14, 14, 92, 30, 15); ctx.fill();
    roundRect(W - 106, 14, 92, 30, 15); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillText('★ ' + score, 26, 30);
    ctx.textAlign = 'right';
    ctx.fillText(Math.max(0, Math.ceil(DURATION - elapsed)) + 's', W - 26, 30);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function onDown(e) {
    if (!running) return;
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (W / r.width);
    const my = (e.clientY - r.top) * (H / r.height);
    for (const h of holes) {
      if (h.key && h.up > 0.35 && h.dir >= 0) {
        const cy = h.y - 20 * h.up;
        const dx = (mx - h.x) / 28, dy = (my - cy) / 30;
        if (dx * dx + dy * dy <= 1) { score++; h.dir = -1; h.pop = 1; opts.onScore && opts.onScore(1); return; }
      }
    }
  }

  function start() {
    resize(); layout();
    elapsed = 0; score = 0; spawnT = 0.6; running = true; last = performance.now();
    canvas.addEventListener('pointerdown', onDown);
    if (!raf) loop();
  }
  function end() {
    if (!running) return;
    running = false;
    opts.onEnd && opts.onEnd(score);
  }
  function stop() {
    running = false; cancelAnimationFrame(raf); raf = 0;
    canvas.removeEventListener('pointerdown', onDown);
  }

  return { start, stop, resize };
}
