/**
 * FISHING — a one-thumb timing game. A marker sweeps back and forth along a
 * bar; tap when it's inside the green zone to hook a fish. Each cast rerolls
 * the zone; it shrinks and the marker speeds up as the 30s round ramps up.
 * Score → coins + XP for the chosen cobbie.
 */

import { drawCritter } from '../render/critter.js';

const DURATION = 30;

export function createFishing(canvas, opts) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, raf = 0, last = 0;
  let running = false, elapsed = 0, score = 0;
  let marker = 0.5, dir = 1, zoneC = 0.5, zoneW = 0.3, fishPop = 0, feedback = '', fbT = 0;
  let player = null;

  function resize() {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width; canvas.height = r.height;
    W = canvas.width; H = canvas.height;
  }

  function diff() {
    const p = Math.min(1, elapsed / DURATION);
    return { speed: 0.75 + 1.2 * p, zoneW: 0.30 - 0.17 * p, prog: p };
  }

  function rerollZone(d) { zoneW = d.zoneW; zoneC = zoneW / 2 + Math.random() * (1 - zoneW); }

  const barX = () => W * 0.12, barW = () => W * 0.76, barY = () => H * 0.7;

  function loop() {
    const now = performance.now();
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;

    if (running) {
      elapsed += dt;
      const d = diff();
      marker += dir * d.speed * dt;
      if (marker > 1) { marker = 1; dir = -1; } else if (marker < 0) { marker = 0; dir = 1; }
      if (fishPop > 0) fishPop = Math.max(0, fishPop - dt * 2);
      if (fbT > 0) fbT -= dt;
      opts.onIntensity && opts.onIntensity(d.prog);
      if (elapsed >= DURATION) end();
    }
    draw();
    raf = running ? requestAnimationFrame(loop) : 0;
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#bfe6f2'); g.addColorStop(0.42, '#dff1ec'); g.addColorStop(0.43, '#4aa8c8'); g.addColorStop(1, '#2a6a8a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // gentle water ripples
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const wy = H * (0.5 + i * 0.1);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, wy + Math.sin(x * 0.05 + elapsed * 2 + i) * 3);
      ctx.stroke();
    }

    // the angler on the left dock
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(0, H * 0.40, W * 0.22, 10);
    if (player) drawCritter(ctx, player.key, player.stage, player.hat, W * 0.06, H * 0.40 - 46, 3);
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W * 0.12, H * 0.36); ctx.lineTo(W * 0.5, H * 0.52); ctx.stroke(); // line
    // a hooked fish pops up on a catch
    if (fishPop > 0) {
      ctx.save(); ctx.translate(W * 0.5, H * 0.52 - fishPop * 40); ctx.scale(1 + fishPop * 0.2, 1 + fishPop * 0.2);
      ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🐟', 0, 0); ctx.restore();
    }

    // timing bar
    const bx = barX(), bw = barW(), by = barY();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; roundRect(bx - 6, by - 16, bw + 12, 32, 12); ctx.fill();
    ctx.fillStyle = '#e8dcc0'; roundRect(bx, by - 8, bw, 16, 8); ctx.fill();
    ctx.fillStyle = '#5ac06a'; ctx.fillRect(bx + (zoneC - zoneW / 2) * bw, by - 8, zoneW * bw, 16);   // catch zone
    ctx.fillStyle = '#2a2418'; ctx.fillRect(bx + marker * bw - 2, by - 13, 4, 26);                    // marker
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TAP WHEN THE LINE IS IN THE GREEN', W / 2, by + 34);
    if (fbT > 0) { ctx.fillStyle = feedback === 'Nice!' ? '#bfffce' : '#ffd0c0'; ctx.font = 'bold 16px ui-monospace, monospace'; ctx.fillText(feedback, W / 2, by - 40); }

    hud();
  }

  function hud() {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    roundRect(14, 14, 92, 30, 15); ctx.fill();
    roundRect(W - 106, 14, 92, 30, 15); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px ui-monospace, monospace'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillText('🐟 ' + score, 26, 30);
    ctx.textAlign = 'right'; ctx.fillText(Math.max(0, Math.ceil(DURATION - elapsed)) + 's', W - 26, 30);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function onDown(e) {
    if (!running) return;
    const d = diff();
    const hit = Math.abs(marker - zoneC) <= zoneW / 2;
    if (hit) {
      score++; fishPop = 1; feedback = 'Nice!'; fbT = 0.7;
      const r = canvas.getBoundingClientRect();
      opts.onScore && opts.onScore(r.left + (barX() + marker * barW()) * (r.width / W), r.top + barY() * (r.height / H));
    } else { feedback = 'Missed!'; fbT = 0.6; opts.onMiss && opts.onMiss(); }
    rerollZone(d);
  }

  function start(p) {
    player = p || null;
    resize();
    running = true; elapsed = 0; score = 0; marker = 0; dir = 1; fishPop = 0; fbT = 0; last = performance.now();
    rerollZone(diff());
    canvas.addEventListener('pointerdown', onDown);
    if (!raf) loop();
  }
  function end() { if (!running) return; running = false; opts.onEnd && opts.onEnd(score); }
  function stop() { running = false; cancelAnimationFrame(raf); raf = 0; canvas.removeEventListener('pointerdown', onDown); }

  return { start, stop, resize };
}
