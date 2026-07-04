/**
 * RHYTHM — one-thumb tap-to-the-beat. Notes fall toward a hit-line; tap as each
 * one crosses it. Perfect / Good / Miss by timing; consecutive hits build a
 * combo that multiplies the payout. Notes keep a constant fall time (so timing
 * stays learnable) while the spawn tempo quickens over the 30s round.
 * Score → coins + XP for the chosen cobbie.
 */

import { drawCritter } from '../render/critter.js';

const DURATION = 30;
const FALL_TIME = 1.5;                 // seconds from spawn to the hit-line

export function createRhythm(canvas, opts) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, raf = 0, last = 0;
  let running = false, elapsed = 0, score = 0, combo = 0, bestCombo = 0;
  let notes = [], spawnT = 0, feedback = '', fbT = 0, hitFlash = 0;
  let player = null, hitY = 0, vy = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width; canvas.height = r.height;
    W = canvas.width; H = canvas.height;
    hitY = H * 0.78; vy = hitY / FALL_TIME;
  }

  // Beat spacing: an overall quickening PLUS a section that changes every ~4s
  // (normal → fast burst → slow), so the pace you tap at keeps shifting.
  function interval() {
    const p = Math.min(1, elapsed / DURATION);
    const base = 0.78 - 0.30 * p;
    const factor = [1.0, 0.62, 1.35][Math.floor(elapsed / 4) % 3];
    return base * factor;
  }

  const laneX = () => W * 0.5;

  function loop() {
    const now = performance.now();
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;

    if (running) {
      elapsed += dt;
      spawnT -= dt;
      if (spawnT <= 0) { spawnT = interval() * (0.85 + Math.random() * 0.3); notes.push({ y: -20, hit: false }); }
      for (const n of notes) n.y += vy * dt;
      // notes that sail past the line unstruck break the combo
      for (const n of notes) if (!n.hit && n.y > hitY + 46) { n.missed = true; if (combo) { combo = 0; feedback = 'Miss'; fbT = 0.4; } }
      notes = notes.filter((n) => n.y < H + 30 && !n.hit && !n.missed);
      if (fbT > 0) fbT -= dt;
      if (hitFlash > 0) hitFlash = Math.max(0, hitFlash - dt * 4);
      opts.onIntensity && opts.onIntensity(Math.min(1, elapsed / DURATION));
      if (elapsed >= DURATION) end();
    }
    draw();
    raf = running ? requestAnimationFrame(loop) : 0;
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a2050'); g.addColorStop(0.6, '#3a2a66'); g.addColorStop(1, '#20183e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const lx = laneX();
    // lane
    ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(lx - 46, 0, 92, H);
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(lx - 46, 0); ctx.lineTo(lx - 46, H); ctx.moveTo(lx + 46, 0); ctx.lineTo(lx + 46, H); ctx.stroke();

    // hit-line (glows on a hit)
    ctx.fillStyle = `rgba(240,149,74,${0.5 + hitFlash * 0.5})`;
    ctx.fillRect(lx - 54, hitY - 3, 108, 6);
    ctx.strokeStyle = '#f0a24a'; ctx.lineWidth = 2;
    ctx.strokeRect(lx - 40, hitY - 22, 80, 44);

    // notes
    for (const n of notes) {
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.arc(lx, n.y, 16, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#c88a2a'; ctx.font = 'bold 16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('♪', lx, n.y + 1);
    }

    // the dancer bopping in the corner
    if (player) {
      const bop = Math.abs(Math.sin(elapsed * 4)) * 6;
      drawCritter(ctx, player.key, player.stage, player.hat, W * 0.5 - 24, H * 0.9 - 30 - bop, 3);
    }

    if (fbT > 0) {
      ctx.fillStyle = feedback === 'Perfect' ? '#bfffce' : feedback === 'Good' ? '#ffe9a8' : '#ffb0a0';
      ctx.font = 'bold 20px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(feedback, lx, hitY - 54);
    }
    if (combo >= 3) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 15px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText(combo + ' COMBO', lx, 64);
    }
    hud();
  }

  function hud() {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    roundRect(14, 14, 92, 30, 15); ctx.fill();
    roundRect(W - 106, 14, 92, 30, 15); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px ui-monospace, monospace'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillText('★ ' + score, 26, 30);
    ctx.textAlign = 'right'; ctx.fillText(Math.max(0, Math.ceil(DURATION - elapsed)) + 's', W - 26, 30);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function onDown() {
    if (!running) return;
    // nearest un-hit note to the line
    let best = null, bestD = 1e9;
    for (const n of notes) { const d = Math.abs(n.y - hitY); if (d < bestD) { bestD = d; best = n; } }
    if (best && bestD <= 44) {
      best.hit = true; hitFlash = 1;
      const perfect = bestD <= 16;
      combo++; bestCombo = Math.max(bestCombo, combo);
      const mult = 1 + Math.floor(combo / 10);
      score += (perfect ? 2 : 1) * mult;
      feedback = perfect ? 'Perfect' : 'Good'; fbT = 0.5;
      opts.onHit && opts.onHit(combo);
      const r = canvas.getBoundingClientRect();
      opts.onScore && opts.onScore(r.left + laneX() * (r.width / W), r.top + hitY * (r.height / H));
    } else {
      combo = 0; feedback = 'Miss'; fbT = 0.4; opts.onMiss && opts.onMiss();
    }
  }

  function start(p) {
    player = p || null;
    resize();
    running = true; elapsed = 0; score = 0; combo = 0; bestCombo = 0; notes = []; spawnT = 0.6; fbT = 0; last = performance.now();
    canvas.addEventListener('pointerdown', onDown);
    if (!raf) loop();
  }
  function end() { if (!running) return; running = false; opts.onEnd && opts.onEnd(score); }
  function stop() { running = false; cancelAnimationFrame(raf); raf = 0; canvas.removeEventListener('pointerdown', onDown); }

  return { start, stop, resize };
}
