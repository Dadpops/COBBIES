/**
 * CATCH — a one-thumb basket game. Treats (and the odd bomb) fall from the top;
 * drag your cobbie left/right to catch the treats and dodge the bombs. A 30s
 * round that gently ramps (faster, denser falls). Each treat caught reports its
 * screen position so the caller can ding a coin; a bomb costs a couple points.
 * Score → coins + XP for the chosen cobbie.
 */

import { CRITTERS, PALS } from '../data/creatures.js';
import { drawCritter } from '../render/critter.js';

const DURATION = 30;

export function createCatch(canvas, opts) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, raf = 0, last = 0;
  let items = [], elapsed = 0, score = 0, running = false, spawnT = 0;
  let player = null, px = 0, targetX = 0, catchY = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width; canvas.height = r.height;
    W = canvas.width; H = canvas.height;
    catchY = H * 0.82;
    if (!px) px = targetX = W * 0.5;
  }

  function diff() {
    const p = Math.min(1, elapsed / DURATION);
    return { interval: 0.95 - 0.5 * p, fall: (H * 0.28) * (1 + p * 0.9), bombChance: 0.14 + 0.16 * p, prog: p };
  }

  const TREATS = ['🍓', '🫐', '🍒', '🍎', '🌰', '🍯'];

  function spawnOne(d) {
    const bomb = Math.random() < d.bombChance;
    items.push({
      x: W * (0.1 + Math.random() * 0.8), y: -20, vy: d.fall * (0.85 + Math.random() * 0.3),
      bomb, emoji: bomb ? '💣' : TREATS[(Math.random() * TREATS.length) | 0], spin: 0, caught: false, pop: 0,
    });
  }

  function loop() {
    const now = performance.now();
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;

    if (running) {
      elapsed += dt;
      const d = diff();
      px += (targetX - px) * Math.min(1, dt * 12);   // basket eases toward the finger
      spawnT -= dt;
      if (spawnT <= 0) { spawnT = d.interval * (0.7 + Math.random() * 0.6); spawnOne(d); }
      for (const it of items) {
        it.y += it.vy * dt; it.spin += dt * 3;
        if (it.pop > 0) it.pop = Math.max(0, it.pop - dt * 3);
        if (!it.caught && it.y >= catchY - 22 && it.y <= catchY + 18 && Math.abs(it.x - px) < 42) {
          it.caught = true; it.pop = 1;
          const sx = canvas.getBoundingClientRect().left + it.x * (canvas.getBoundingClientRect().width / W);
          const sy = canvas.getBoundingClientRect().top + it.y * (canvas.getBoundingClientRect().height / H);
          if (it.bomb) { score = Math.max(0, score - 2); opts.onMiss && opts.onMiss(sx, sy); }
          else { score++; opts.onScore && opts.onScore(sx, sy); }
        }
      }
      items = items.filter((it) => it.y < H + 30 && !(it.caught && it.pop <= 0));
      opts.onIntensity && opts.onIntensity(d.prog);
      if (elapsed >= DURATION) end();
    }
    draw();
    raf = running ? requestAnimationFrame(loop) : 0;
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#bfe6f2'); g.addColorStop(0.55, '#dff1ec'); g.addColorStop(0.56, '#7cc26a'); g.addColorStop(1, '#4fa85f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const it of items) {
      ctx.save(); ctx.translate(it.x, it.y); ctx.scale(1 + it.pop * 0.3, 1 + it.pop * 0.3);
      ctx.font = '26px serif'; ctx.fillText(it.emoji, 0, 0); ctx.restore();
    }

    // the catcher: a shadow, the chosen cobbie, and a little basket
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.beginPath(); ctx.ellipse(px, catchY + 30, 30, 7, 0, 0, 6.28); ctx.fill();
    if (player) drawCritter(ctx, player.key, player.stage, player.hat, px - 24, catchY - 30, 3);
    ctx.fillStyle = '#b07a3a'; roundRect(px - 26, catchY + 8, 52, 20, 7); ctx.fill();
    ctx.fillStyle = '#8a5a24'; ctx.fillRect(px - 26, catchY + 8, 52, 4);
    ctx.strokeStyle = '#8a5a24'; ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(px + i * 10, catchY + 10); ctx.lineTo(px + i * 10, catchY + 26); ctx.stroke(); }

    hud();
  }

  function hud() {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    roundRect(14, 14, 92, 30, 15); ctx.fill();
    roundRect(W - 106, 14, 92, 30, 15); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px ui-monospace, monospace'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillText('🧺 ' + score, 26, 30);
    ctx.textAlign = 'right'; ctx.fillText(Math.max(0, Math.ceil(DURATION - elapsed)) + 's', W - 26, 30);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function moveTo(clientX) {
    const r = canvas.getBoundingClientRect();
    targetX = Math.max(42, Math.min(W - 42, (clientX - r.left) * (W / r.width)));
  }
  function onMove(e) { if (running) moveTo(e.clientX); }
  function onDown(e) { if (running) moveTo(e.clientX); }

  function start(p) {
    player = p || null;
    resize(); px = targetX = W * 0.5;
    items = []; elapsed = 0; score = 0; spawnT = 0.5; running = true; last = performance.now();
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    if (!raf) loop();
  }
  function end() { if (!running) return; running = false; opts.onEnd && opts.onEnd(score); }
  function stop() {
    running = false; cancelAnimationFrame(raf); raf = 0;
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
  }

  return { start, stop, resize };
}
