/**
 * WHACK-A-COBBIE — creatures pop out of holes; tap them before they duck.
 * Some pop-ups are BOMBS — tapping one costs you points. A 30-second round
 * that gently ramps up (shorter intervals + up-times, clamped so it stays
 * fair). Hits and bomb-taps report their screen position so the caller can
 * play sounds and float a popup there. Score → coins + XP for the buddy.
 */

import { CRITTERS, PALS } from '../data/creatures.js';
import { drawPix } from '../render/pixel.js';
import { drawCritter } from '../render/critter.js';

const DURATION = 30;

export function createWhack(canvas, opts) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, raf = 0, last = 0;
  let holes = [], elapsed = 0, score = 0, running = false, spawnT = 0;
  let player = null, cursor = { x: 0, y: 0 }, swing = 0;

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
        holes.push({ x: marginX + gapX * c, y: top + gapY * r, up: 0, dir: 0, active: false, bomb: false, key: null, tUp: 0, pop: 0 });
  }

  /** Difficulty over time — gentle slope, clamped so late game stays fair. */
  function diff() {
    const p = Math.min(1, elapsed / DURATION);
    return { interval: 1.05 - 0.4 * p, upTime: 1.35 - 0.45 * p, bombChance: 0.16 + 0.14 * p, prog: p };
  }

  function pickKey() {
    const r = opts.getState().roster;
    return r[(Math.random() * r.length) | 0].key;
  }

  function spawnOne(d) {
    const empty = holes.filter((h) => !h.active);
    if (!empty.length) return;
    const h = empty[(Math.random() * empty.length) | 0];
    h.active = true; h.up = 0; h.dir = 1; h.tUp = d.upTime; h.pop = 0;
    h.bomb = Math.random() < d.bombChance;
    h.key = h.bomb ? null : pickKey();
  }

  function loop() {
    const now = performance.now();
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;

    if (running) {
      elapsed += dt;
      const d = diff();
      spawnT -= dt;
      if (spawnT <= 0) { spawnT = d.interval * (0.7 + Math.random() * 0.6); spawnOne(d); }
      for (const h of holes) {
        if (h.pop > 0) h.pop = Math.max(0, h.pop - dt * 4);
        if (h.dir === 1) { h.up = Math.min(1, h.up + dt * 6); if (h.up >= 1) h.dir = 0; }
        else if (h.dir === 0 && h.active) { h.tUp -= dt; if (h.tUp <= 0) h.dir = -1; }
        else if (h.dir === -1) { h.up = Math.max(0, h.up - dt * 6); if (h.up <= 0) { h.dir = 0; h.active = false; } }
      }
      if (swing > 0) swing = Math.max(0, swing - dt * 6);
      opts.onIntensity && opts.onIntensity(d.prog);
      if (elapsed >= DURATION) { end(); }
    }
    draw();
    raf = running ? requestAnimationFrame(loop) : 0;
  }

  /** The chosen character stands to the right of the cursor with a mallet. */
  function drawPlayer() {
    if (!player) return;
    const cx = cursor.x, cy = cursor.y;
    const hx = cx - 6, hy = (cy - 24) + 22 * swing; // mallet head: raised, slams to cursor on tap
    ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx + 5, hy + 6); ctx.lineTo(cx + 14, cy - 4); ctx.stroke();
    ctx.fillStyle = '#9aa0a8'; ctx.fillRect(hx - 8, hy, 18, 10);
    ctx.fillStyle = '#787e86'; ctx.fillRect(hx - 8, hy, 18, 3);
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.beginPath(); ctx.ellipse(cx + 20, cy + 14, 14, 5, 0, 0, 6.28); ctx.fill();
    drawCritter(ctx, player.key, player.stage, player.hat, cx + 2, cy - 30, 3);
  }

  function drawBomb(x, y, up, pop) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x - 32, 0, 64, y + 4); ctx.clip();
    const cy = y + 6 - 30 * up, s = 1 + pop * 0.25;
    ctx.translate(x, cy); ctx.scale(s, s);
    ctx.fillStyle = '#1c1c22';
    ctx.beginPath(); ctx.arc(0, -6, 13, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#3a3a44';
    ctx.beginPath(); ctx.arc(-4, -10, 4, 0, 6.28); ctx.fill();     // highlight
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(4, -16); ctx.quadraticCurveTo(12, -22, 9, -28); ctx.stroke();
    ctx.fillStyle = '#ffcf5a';                                     // spark
    ctx.beginPath(); ctx.arc(9, -29, 2.5, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#ff7a3a';
    ctx.beginPath(); ctx.arc(9, -29, 1.3, 0, 6.28); ctx.fill();
    ctx.restore();
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#bfe6f2'); g.addColorStop(0.34, '#dff1ec');
    g.addColorStop(0.35, '#7cc26a'); g.addColorStop(1, '#4fa85f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    for (const h of holes) {
      ctx.fillStyle = '#3a2a1e';
      ctx.beginPath(); ctx.ellipse(h.x, h.y, 30, 12, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#2a1e14';
      ctx.beginPath(); ctx.ellipse(h.x, h.y - 1, 26, 9, 0, 0, 6.28); ctx.fill();

      if (h.active && h.up > 0) {
        if (h.bomb) drawBomb(h.x, h.y, h.up, h.pop);
        else {
          const cd = CRITTERS[h.key]; const squash = h.pop * 0.25;
          ctx.save();
          ctx.beginPath(); ctx.rect(h.x - 32, 0, 64, h.y + 4); ctx.clip();
          ctx.translate(h.x, h.y + 6); ctx.scale(1 + squash, 1 - squash);
          drawPix(ctx, cd.stages[0], PALS[cd.type], -24, -44 * h.up, 3);
          ctx.restore();
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.beginPath(); ctx.ellipse(h.x, h.y + 3, 30, 8, 0, 0, Math.PI); ctx.fill();
    }

    ctx.fillStyle = 'rgba(0,0,0,.35)';
    roundRect(14, 14, 92, 30, 15); ctx.fill();
    roundRect(W - 106, 14, 92, 30, 15); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillText('★ ' + score, 26, 30);
    ctx.textAlign = 'right';
    ctx.fillText(Math.max(0, Math.ceil(DURATION - elapsed)) + 's', W - 26, 30);

    drawPlayer();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    cursor.x = (e.clientX - r.left) * (W / r.width);
    cursor.y = (e.clientY - r.top) * (H / r.height);
  }

  function onDown(e) {
    if (!running) return;
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (W / r.width);
    const my = (e.clientY - r.top) * (H / r.height);
    cursor.x = mx; cursor.y = my; swing = 1; // slam the mallet where you tapped
    for (const h of holes) {
      if (h.active && h.up > 0.35 && h.dir >= 0) {
        const cy = h.y - 20 * h.up;
        const dx = (mx - h.x) / 28, dy = (my - cy) / 30;
        if (dx * dx + dy * dy <= 1) {
          h.dir = -1; h.pop = 1;
          if (h.bomb) { score = Math.max(0, score - 3); opts.onBomb && opts.onBomb(e.clientX, e.clientY); }
          else { score++; opts.onScore && opts.onScore(e.clientX, e.clientY); }
          return;
        }
      }
    }
  }

  function start(p) {
    player = p || null;
    resize(); layout();
    cursor = { x: W * 0.5, y: H * 0.6 };
    elapsed = 0; score = 0; spawnT = 0.6; running = true; swing = 0; last = performance.now();
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
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
    canvas.removeEventListener('pointermove', onMove);
  }

  return { start, stop, resize };
}
