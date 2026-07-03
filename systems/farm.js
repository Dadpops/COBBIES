/**
 * FARM SCENE — the decorated "home" the player owns.
 *
 * No more isometric platform: the animals simply roam a flat patch of green
 * that sits *below* the hills, and are clamped to that band so they never
 * wander into the sky or off screen. On top we layer a proper background —
 * a multi-stop sky, a sun/moon, two parallax hill bands, clouds or stars,
 * edge decorations (trees/cacti/pines) and an ambient particle — all driven
 * by the active biome. The player's avatar roams here too.
 */

import { CRITTERS, PALS } from '../data/creatures.js';
import { BIOMES, DEFAULT_BIOME } from '../data/biomes.js';
import { drawAvatar } from '../data/avatar.js';
import { drawPix } from '../render/pixel.js';

export const AVATAR_KEY = '__avatar__';

// wander band in screen fractions: below the hills, above the buttons.
const BAND_TOP = 0.62, BAND_BOTTOM = 0.9, BAND_L = 0.09, BAND_R = 0.91;
const HILL_FRONT = 0.58; // front hill base; decorations sit on this line

export function createFarm(canvas, getState, onPick) {
  const ctx = canvas.getContext('2d');
  let FW = 0, FH = 0, ft = 0, raf = 0;
  /** @type {{key:string,stage:number,x:number,y:number,tx:number,ty:number,ph:number,avatar:boolean}[]} */
  let wanderers = [];
  let stars = [];
  let particles = [];
  let tufts = [];

  function resize() {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width; canvas.height = r.height;
    FW = canvas.width; FH = canvas.height;
  }

  const randX = () => BAND_L + Math.random() * (BAND_R - BAND_L);
  const randY = () => BAND_TOP + Math.random() * (BAND_BOTTOM - BAND_TOP);
  const screenPos = (x, y) => ({ px: x * FW, py: y * FH });

  /** Rebuild wanderers from roster (+ avatar), keeping existing positions. */
  function sync() {
    const state = getState();
    const desired = state.roster.map((r) => ({ key: r.key, stage: r.stage, avatar: false }));
    desired.push({ key: AVATAR_KEY, stage: 0, avatar: true });
    wanderers = desired.map((d) => {
      const existing = wanderers.find((w) => w.key === d.key);
      if (existing) { existing.stage = d.stage; return existing; }
      return {
        key: d.key, stage: d.stage, avatar: d.avatar,
        x: randX(), y: randY(), tx: randX(), ty: randY(), ph: Math.random() * 6.28,
      };
    });
  }

  /* ---------- background pieces ---------- */

  function hillBand(color, baseFrac, amp, speed, ph) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const y0 = FH * baseFrac;
    ctx.moveTo(0, FH);
    for (let x = 0; x <= FW; x += 6)
      ctx.lineTo(x, y0 + Math.sin(x * 0.012 + ft * speed + ph) * amp);
    ctx.lineTo(FW, FH); ctx.closePath(); ctx.fill();
  }

  function drawSun(color) {
    const x = FW * 0.78, y = FH * 0.2;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(x, y, 34, 0, 6.28); ctx.fill();
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, 22, 0, 6.28); ctx.fill();
  }

  function drawMoon(skyColor) {
    const x = FW * 0.76, y = FH * 0.17;
    ctx.fillStyle = '#f4eecf';
    ctx.beginPath(); ctx.arc(x, y, 18, 0, 6.28); ctx.fill();
    ctx.fillStyle = skyColor;
    ctx.beginPath(); ctx.arc(x + 8, y - 4, 16, 0, 6.28); ctx.fill();
  }

  function drawStars() {
    for (const s of stars) {
      const tw = 0.6 + 0.4 * Math.sin(ft * 2 + s.ph);
      ctx.fillStyle = `rgba(255,255,255,${0.5 * tw})`;
      ctx.fillRect(s.x * FW, s.y * FH, 2, 2);
    }
  }

  function drawClouds() {
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    const cl = (ft * 8) % (FW + 80) - 40;
    ctx.fillRect(cl, 50, 44, 10); ctx.fillRect(cl + 8, 42, 28, 10);
    ctx.fillRect(FW - cl * 0.6, 84, 36, 8); ctx.fillRect(FW - cl * 0.6 + 6, 77, 22, 8);
  }

  function drawTree(x, y, b) {
    ctx.fillStyle = b.trunk; ctx.fillRect(x - 3, y - 14, 6, 18);
    ctx.fillStyle = b.leaf;
    ctx.beginPath(); ctx.arc(x, y - 24, 15, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 11, y - 16, 11, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 11, y - 16, 11, 0, 6.28); ctx.fill();
    ctx.fillStyle = b.leaf2;
    ctx.beginPath(); ctx.arc(x - 4, y - 28, 9, 0, 6.28); ctx.fill();
  }

  function drawCactus(x, y, b) {
    ctx.fillStyle = b.trunk; ctx.fillRect(x - 5, y - 30, 10, 34);
    ctx.fillRect(x - 14, y - 20, 6, 14); ctx.fillRect(x - 14, y - 20, 12, 5);
    ctx.fillRect(x + 8, y - 26, 6, 16); ctx.fillRect(x + 2, y - 26, 12, 5);
    ctx.fillStyle = b.leaf2; ctx.fillRect(x - 3, y - 28, 3, 20);
  }

  function drawPine(x, y, b) {
    ctx.fillStyle = b.trunk; ctx.fillRect(x - 2, y - 6, 5, 8);
    ctx.fillStyle = b.leaf;
    for (let i = 0; i < 3; i++) {
      const ty = y - 8 - i * 9, tw = 16 - i * 4;
      ctx.beginPath();
      ctx.moveTo(x, ty - 12); ctx.lineTo(x + tw, ty); ctx.lineTo(x - tw, ty);
      ctx.closePath(); ctx.fill();
    }
    if (b.particle === 'snow') {
      ctx.fillStyle = b.leaf2;
      ctx.fillRect(x - 2, y - 34, 4, 3); ctx.fillRect(x - 6, y - 20, 12, 2);
    }
  }

  function drawDecor(b) {
    const gy = FH * HILL_FRONT + 8;
    for (const f of [0.1, 0.26, 0.74, 0.9]) {
      const x = FW * f;
      if (b.decor === 'trees') drawTree(x, gy, b);
      else if (b.decor === 'cacti') drawCactus(x, gy, b);
      else if (b.decor === 'pines') drawPine(x, gy, b);
    }
  }

  function drawTufts() {
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    for (const t of tufts) {
      const x = t.x * FW, y = (BAND_TOP + t.y * (BAND_BOTTOM - BAND_TOP)) * FH;
      ctx.fillRect(x - 3, y, 1, -4); ctx.fillRect(x, y, 1, -6); ctx.fillRect(x + 3, y, 1, -4);
    }
  }

  function drawBarn() {
    const x = FW * 0.72, y = FH * (HILL_FRONT + 0.02);
    ctx.fillStyle = '#c0503a'; ctx.fillRect(x - 20, y, 40, 26);
    ctx.fillStyle = '#a03a2a';
    ctx.beginPath(); ctx.moveTo(x - 24, y); ctx.lineTo(x, y - 16);
    ctx.lineTo(x + 24, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a2a1e'; ctx.fillRect(x - 6, y + 11, 12, 15);
    ctx.fillStyle = '#e8c86a'; ctx.fillRect(x - 3, y + 3, 6, 6);
  }

  function drawParticles(kind) {
    for (const p of particles) {
      if (kind === 'snow') {
        p.y += p.spd * 0.0018; p.x += Math.sin(ft + p.ph) * 0.0006;
        if (p.y > 1) { p.y = 0; p.x = Math.random(); }
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.fillRect(p.x * FW, p.y * FH, 2, 2);
      } else {
        const gx = p.x + Math.sin(ft * 0.6 + p.ph) * 0.03;
        const gy = p.y + Math.cos(ft * 0.5 + p.ph) * 0.02;
        const a = 0.4 + 0.4 * Math.sin(ft * 3 + p.ph);
        ctx.fillStyle = `rgba(255,236,140,${a})`;
        ctx.fillRect(gx * FW, (gy * 0.5 + 0.45) * FH, 3, 3);
      }
    }
  }

  /* ---------- main loop ---------- */

  function frame() {
    ft += 0.016;
    const b = BIOMES[getState().settings.biome] || BIOMES[DEFAULT_BIOME];

    const g = ctx.createLinearGradient(0, 0, 0, FH);
    g.addColorStop(0, b.sky[0]); g.addColorStop(0.4, b.sky[1]);
    g.addColorStop(0.58, b.sky[2]); g.addColorStop(0.6, b.horizon);
    g.addColorStop(1, b.ground);
    ctx.fillStyle = g; ctx.fillRect(0, 0, FW, FH);

    if (b.stars) drawStars();
    if (b.moon) drawMoon(b.sky[0]);
    if (b.sun) drawSun(b.sun);

    hillBand(b.hillA, 0.5, 16, 0.15, 0);
    hillBand(b.hillB, HILL_FRONT, 12, 0.28, 2);
    if (b.clouds) drawClouds();

    drawDecor(b);
    drawBarn();
    drawTufts();

    // wanderers roam the flat green, drawn back-to-front by y with a gentle
    // size-by-distance scale so nearer critters read as closer.
    const sorted = [...wanderers].sort((a, c) => a.y - c.y);
    for (const w of sorted) {
      w.x += (w.tx - w.x) * 0.006; w.y += (w.ty - w.y) * 0.006;
      if (Math.hypot(w.tx - w.x, w.ty - w.y) < 0.02) { w.tx = randX(); w.ty = randY(); }
      const { px, py } = screenPos(w.x, w.y);
      const bob = Math.abs(Math.sin(ft * 4 + w.ph)) * 3;
      const depth = (w.y - BAND_TOP) / (BAND_BOTTOM - BAND_TOP);
      const s = 0.82 + 0.34 * depth;
      ctx.fillStyle = 'rgba(0,0,0,.16)';
      ctx.beginPath(); ctx.ellipse(px, py, 15 * s, 5 * s, 0, 0, 6.28); ctx.fill();
      ctx.save();
      ctx.translate(px, py); ctx.scale(s, s);
      if (w.avatar) drawAvatar(ctx, getState().avatar, -24, -46 - bob, 3);
      else drawPix(ctx, CRITTERS[w.key].stages[w.stage], PALS[CRITTERS[w.key].type],
        -24, -44 - bob, 3);
      ctx.restore();
    }

    if (b.particle) drawParticles(b.particle);
    raf = requestAnimationFrame(frame);
  }

  function onPointerDown(e) {
    if (!onPick) return;
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (FW / r.width);
    const my = (e.clientY - r.top) * (FH / r.height);
    const sorted = [...wanderers].sort((a, c) => c.y - a.y);
    for (const w of sorted) {
      const { px, py } = screenPos(w.x, w.y);
      if (mx > px - 22 && mx < px + 22 && my > py - 50 && my < py + 8) {
        onPick(w.avatar ? AVATAR_KEY : w.key);
        return;
      }
    }
  }

  function start() {
    resize();
    if (!stars.length)
      for (let i = 0; i < 40; i++)
        stars.push({ x: Math.random(), y: Math.random() * 0.45, ph: Math.random() * 6.28 });
    if (!particles.length)
      for (let i = 0; i < 46; i++)
        particles.push({ x: Math.random(), y: Math.random(), ph: Math.random() * 6.28, spd: 0.4 + Math.random() });
    if (!tufts.length)
      for (let i = 0; i < 14; i++)
        tufts.push({ x: 0.06 + Math.random() * 0.88, y: Math.random() });
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
