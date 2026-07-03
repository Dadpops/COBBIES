/**
 * THE RUN — one-button endless runner. Tap to jump. Distance = XP + coins.
 * Feet planted on the ground, gentle capped speed ramp (validated feel;
 * do not re-litigate). One hit ends the run. Ported from the prototype and
 * wrapped in a controller that reports the outcome to the caller.
 */

import { CRITTERS, PALS } from '../data/creatures.js';
import { drawPix } from '../render/pixel.js';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {(dist:number)=>void} onDistance   HUD tick
 * @param {(dist:number)=>void} onEnd         run finished at this distance
 */
export function createRunner(canvas, onDistance, onEnd) {
  const ctx = canvas.getContext('2d');
  const JUMP_V = -9.8;   // a touch floatier than the prototype for easier timing
  const GRAV = 0.46;
  let RW = 0, RH = 0, raf = 0;
  /** @type {any} */
  let run = null;

  function resize() {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width;
    canvas.height = r.height;
    RW = canvas.width;
    RH = canvas.height;
  }

  function jump() {
    if (!run || !run.alive) return;
    if (run.onGround || run.coyote > 0) {
      run.vy = JUMP_V; run.onGround = false; run.coyote = 0;
    } else {
      run.jumpBuffer = 8; // remember an early tap; fire it the instant we land
    }
  }

  function start(creature) {
    resize();
    const groundY = RH * 0.72;
    run = {
      key: creature.key, stage: creature.stage,
      x: RW * 0.35, y: groundY, vy: 0, groundY, onGround: true,
      dist: 0, speed: 2.3, obstacles: [], spawnT: 240, alive: true, t: 0,
      bg1: 0, bg2: 0, strideT: 0, dust: [], coyote: 6, jumpBuffer: 0,
    };
    if (!raf) loop();
  }

  function loop() {
    if (!run) { raf = 0; return; }
    run.t += 0.016;
    if (run.speed < 6.8) run.speed += 0.0016; // steadily speeds up, then caps
    run.dist += run.speed * 0.5;

    // coyote time: brief window to still jump just after leaving the ground
    if (run.onGround) run.coyote = 6; else if (run.coyote > 0) run.coyote--;
    run.vy += GRAV; run.y += run.vy;
    if (run.y >= run.groundY) {
      run.y = run.groundY; run.vy = 0;
      if (!run.onGround) {
        run.onGround = true;
        if (run.jumpBuffer > 0) { run.vy = JUMP_V; run.onGround = false; run.jumpBuffer = 0; }
      }
    }
    if (run.jumpBuffer > 0) run.jumpBuffer--;

    // dust kicked up on each footfall while grounded
    if (run.onGround) {
      run.strideT += run.speed;
      if (run.strideT > (run.key === 'nora' ? 15 : 22)) {
        run.strideT = 0;
        run.dust.push({ x: run.x - 16, y: run.groundY + 38, life: 1 });
      }
    }
    for (const p of run.dust) { p.x -= run.speed * 0.6; p.life -= 0.05; }
    run.dust = run.dust.filter((p) => p.life > 0);

    run.spawnT -= run.speed;
    if (run.spawnT <= 0) {
      run.obstacles.push({ x: RW + 20, w: 14 + Math.random() * 10, h: 20 + Math.random() * 22 });
      run.spawnT = 140 + Math.random() * 90;
    }
    for (const o of run.obstacles) o.x -= run.speed;
    run.obstacles = run.obstacles.filter((o) => o.x > -40);

    const cw = 34, ch = 40, cx = run.x, cy = run.y - ch;
    for (const o of run.obstacles) {
      const ox = o.x, oy = run.groundY - o.h;
      if (cx + cw - 6 > ox && cx + 6 < ox + o.w && cy + ch > oy) { end(); break; }
    }

    if (run) draw();
    onDistance(Math.floor(run ? run.dist : 0));
    raf = run && run.alive ? requestAnimationFrame(loop) : 0;
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, RH);
    g.addColorStop(0, '#b8e0f0'); g.addColorStop(1, '#e8f4ec');
    ctx.fillStyle = g; ctx.fillRect(0, 0, RW, RH);

    run.bg1 = (run.bg1 - run.speed * 0.3) % RW;
    run.bg2 = (run.bg2 - run.speed * 0.6) % RW;
    ctx.fillStyle = '#a8d8a0';
    for (let i = -1; i < 3; i++) {
      const bx = run.bg1 + i * RW;
      for (let x = 0; x < RW; x += 6)
        ctx.fillRect(bx + x, RH * 0.55 + Math.sin((bx + x) * 0.01) * 18, 6, RH);
    }
    ctx.fillStyle = '#7ac06a';
    for (let i = -1; i < 3; i++) {
      const bx = run.bg2 + i * RW;
      for (let x = 0; x < RW; x += 6)
        ctx.fillRect(bx + x, RH * 0.64 + Math.sin((bx + x) * 0.02 + 2) * 12, 6, RH);
    }
    ctx.fillStyle = '#5aa84a'; ctx.fillRect(0, run.groundY + 38, RW, RH);
    ctx.fillStyle = '#4a983f'; ctx.fillRect(0, run.groundY + 38, RW, 5);

    for (const o of run.obstacles) {
      const oy = run.groundY + 38 - o.h;
      ctx.fillStyle = '#6a5a4a'; ctx.fillRect(o.x, oy, o.w, o.h);
      ctx.fillStyle = '#8a7a6a'; ctx.fillRect(o.x, oy, o.w, 4);
    }

    const cd = CRITTERS[run.key];
    const grid = cd.stages[run.stage];
    const cell = 3;
    const groundLine = run.groundY + 38;
    const spriteH = 16 * cell;
    const footInset = 2 * cell;                 // empty rows under the feet
    const footFromTop = spriteH - footInset;    // where the feet meet the ground
    const lift = run.groundY - run.y;           // >0 while airborne
    const grounded = lift < 1;
    const isNora = run.key === 'nora';

    // Run cycle: phase advances with distance, so leg speed tracks run speed.
    // Nora has a bespoke gallop (rolling two-beat bound, forward reach + a
    // bigger leap); every other creature uses the generic footfall trot.
    const phase = run.dist * (isNora ? 0.62 : 0.5);
    let bob = 0, lean = 0, sx = 1, sy = 1;
    if (!grounded) {
      lean = isNora ? 0.22 : 0.14;                 // leap / bound pose
    } else if (isNora) {
      const b = Math.abs(Math.sin(phase)) * 0.7 + Math.abs(Math.sin(phase + 1)) * 0.3;
      const reach = Math.cos(phase);
      bob = b * 8;
      lean = 0.1 + Math.sin(phase) * 0.06;
      sx = 1 + reach * 0.1;                         // stretch forward mid-bound
      sy = 1 - reach * 0.08;
    } else {
      const squash = Math.sin(phase * 2) * 0.07;
      bob = Math.abs(Math.sin(phase)) * 4;
      lean = Math.sin(phase) * 0.05;
      sx = 1 + squash * 0.4;
      sy = 1 - squash;
    }

    // dust puffs behind the feet
    for (const p of run.dust) {
      const s = 3 + (1 - p.life) * 5;
      ctx.fillStyle = `rgba(250,248,240,${0.45 * p.life})`;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }

    const shScale = Math.max(0.4, 1 - lift / 120);
    ctx.fillStyle = `rgba(0,0,0,${0.18 * shScale})`;
    ctx.beginPath();
    ctx.ellipse(run.x, groundLine, 18 * shScale, 5 * shScale, 0, 0, 6.28);
    ctx.fill();

    // draw the sprite around a pivot at its feet so squash/lean look natural
    ctx.save();
    ctx.translate(run.x, groundLine - lift - bob);
    ctx.rotate(lean);
    ctx.scale(sx, sy);
    drawPix(ctx, grid, PALS[cd.type], -24, -footFromTop, cell);
    ctx.restore();
  }

  function end() {
    if (!run.alive) return;
    run.alive = false;
    const dist = Math.floor(run.dist);
    onEnd(dist);
  }

  canvas.addEventListener('pointerdown', jump);

  return {
    start,
    resize,
    stop() { cancelAnimationFrame(raf); raf = 0; run = null; },
  };
}
