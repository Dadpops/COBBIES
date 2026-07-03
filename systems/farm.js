/**
 * FARM MAP — the ranch home screen, now a tappable map of buildings.
 *
 * Each building is a location you tap to enter: Barn (Jobs), Nest (Hatch),
 * Pen (Collection), Play sign, Wardrobe, Shop. Only the player's chosen
 * "home" critters (max 10) wander here — the rest live in the Pen, and any
 * critter currently stationed at a job is shown in the Barn, not out here.
 *
 * Buildings and critters are depth-sorted together so they occlude naturally.
 */

import { CRITTERS, PALS } from '../data/creatures.js';
import { BIOMES, DEFAULT_BIOME } from '../data/biomes.js';
import { drawAvatar } from '../data/avatar.js';
import { drawPix } from '../render/pixel.js';

export const AVATAR_KEY = '__avatar__';

const BAND_TOP = 0.62, BAND_BOTTOM = 0.9, BAND_L = 0.1, BAND_R = 0.9;
const HILL_FRONT = 0.58;

// building layout: fractional position of each location's base point
const BUILDINGS = [
  { id: 'barn',     label: 'BARN',     x: 0.20, y: 0.66 },
  { id: 'nest',     label: 'NEST',     x: 0.50, y: 0.63 },
  { id: 'pen',      label: 'PEN',      x: 0.80, y: 0.66 },
  { id: 'play',     label: 'PLAY',     x: 0.22, y: 0.85 },
  { id: 'wardrobe', label: 'WARDROBE', x: 0.50, y: 0.88 },
  { id: 'shop',     label: 'SHOP',     x: 0.78, y: 0.85 },
];

export function createFarm(canvas, getState, onPick, onBuilding) {
  const ctx = canvas.getContext('2d');
  let FW = 0, FH = 0, ft = 0, raf = 0;
  let wanderers = [];
  let stars = [], particles = [], tufts = [];

  function resize() {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width; canvas.height = r.height;
    FW = canvas.width; FH = canvas.height;
  }

  const randX = () => BAND_L + Math.random() * (BAND_R - BAND_L);
  const randY = () => BAND_TOP + Math.random() * (BAND_BOTTOM - BAND_TOP);
  const screenPos = (x, y) => ({ px: x * FW, py: y * FH });

  /** Which critters are currently stationed at a job (kept off the home farm). */
  function stationedKeys() {
    const st = getState().stations || {};
    const set = new Set();
    for (const k in st) if (st[k] && st[k].key) set.add(st[k].key);
    return set;
  }

  /** Home wanderers = chosen home critters that are owned and not at a job. */
  function sync() {
    const state = getState();
    const owned = new Set(state.roster.map((r) => r.key));
    const busy = stationedKeys();
    const homeKeys = (state.homeCritters || []).filter((k) => owned.has(k) && !busy.has(k)).slice(0, 10);
    const desired = homeKeys.map((k) => ({ key: k, avatar: false }));
    desired.push({ key: AVATAR_KEY, avatar: true });
    wanderers = desired.map((d) => {
      const existing = wanderers.find((w) => w.key === d.key);
      if (existing) return existing;
      return { key: d.key, avatar: d.avatar, x: randX(), y: randY(), tx: randX(), ty: randY(), ph: Math.random() * 6.28 };
    });
  }

  function stageOf(key) {
    const r = getState().roster.find((x) => x.key === key);
    return r ? r.stage : 0;
  }

  /* ---------- background pieces ---------- */
  function hillBand(color, baseFrac, amp, speed, ph) {
    ctx.fillStyle = color; ctx.beginPath();
    const y0 = FH * baseFrac; ctx.moveTo(0, FH);
    for (let x = 0; x <= FW; x += 6) ctx.lineTo(x, y0 + Math.sin(x * 0.012 + ft * speed + ph) * amp);
    ctx.lineTo(FW, FH); ctx.closePath(); ctx.fill();
  }
  function drawSun(color) {
    const x = FW * 0.82, y = FH * 0.16;
    ctx.fillStyle = color; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(x, y, 32, 0, 6.28); ctx.fill();
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, 20, 0, 6.28); ctx.fill();
  }
  function drawMoon(skyColor) {
    const x = FW * 0.8, y = FH * 0.14;
    ctx.fillStyle = '#f4eecf'; ctx.beginPath(); ctx.arc(x, y, 16, 0, 6.28); ctx.fill();
    ctx.fillStyle = skyColor; ctx.beginPath(); ctx.arc(x + 7, y - 4, 14, 0, 6.28); ctx.fill();
  }
  function drawStars() {
    for (const s of stars) {
      const tw = 0.6 + 0.4 * Math.sin(ft * 2 + s.ph);
      ctx.fillStyle = `rgba(255,255,255,${0.5 * tw})`; ctx.fillRect(s.x * FW, s.y * FH, 2, 2);
    }
  }
  function drawClouds() {
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    const cl = (ft * 8) % (FW + 80) - 40;
    ctx.fillRect(cl, 46, 44, 10); ctx.fillRect(cl + 8, 38, 28, 10);
  }
  function drawTree(x, y, b) {
    ctx.fillStyle = b.trunk; ctx.fillRect(x - 3, y - 12, 6, 16);
    ctx.fillStyle = b.leaf;
    ctx.beginPath(); ctx.arc(x, y - 22, 13, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 9, y - 15, 9, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 9, y - 15, 9, 0, 6.28); ctx.fill();
    ctx.fillStyle = b.leaf2; ctx.beginPath(); ctx.arc(x - 3, y - 25, 7, 0, 6.28); ctx.fill();
  }
  function drawPine(x, y, b) {
    ctx.fillStyle = b.trunk; ctx.fillRect(x - 2, y - 5, 5, 7);
    ctx.fillStyle = b.leaf;
    for (let i = 0; i < 3; i++) {
      const ty = y - 7 - i * 8, tw = 14 - i * 4;
      ctx.beginPath(); ctx.moveTo(x, ty - 11); ctx.lineTo(x + tw, ty); ctx.lineTo(x - tw, ty); ctx.closePath(); ctx.fill();
    }
  }
  function drawDecor(b) {
    const gy = FH * HILL_FRONT + 6;
    for (const f of [0.08, 0.93]) {
      const x = FW * f;
      if (b.decor === 'pines') drawPine(x, gy, b); else drawTree(x, gy, b);
    }
  }
  function drawTufts() {
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    for (const t of tufts) {
      const x = t.x * FW, y = (BAND_TOP + t.y * (BAND_BOTTOM - BAND_TOP)) * FH;
      ctx.fillRect(x - 3, y, 1, -4); ctx.fillRect(x, y, 1, -6); ctx.fillRect(x + 3, y, 1, -4);
    }
  }
  function drawParticles(kind) {
    for (const p of particles) {
      if (kind === 'snow') {
        p.y += p.spd * 0.0018; p.x += Math.sin(ft + p.ph) * 0.0006;
        if (p.y > 1) { p.y = 0; p.x = Math.random(); }
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(p.x * FW, p.y * FH, 2, 2);
      } else {
        const gx = p.x + Math.sin(ft * 0.6 + p.ph) * 0.03, gy = p.y + Math.cos(ft * 0.5 + p.ph) * 0.02;
        ctx.fillStyle = `rgba(255,236,140,${0.4 + 0.4 * Math.sin(ft * 3 + p.ph)})`;
        ctx.fillRect(gx * FW, (gy * 0.5 + 0.45) * FH, 3, 3);
      }
    }
  }

  /* ---------- buildings ---------- */
  function label(x, y, text) {
    ctx.font = 'bold 9px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = 'rgba(30,40,30,.55)';
    roundRect(x - w / 2, y + 2, w, 13, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(text, x, y + 9);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawBuilding(b) {
    const x = b.x * FW, y = b.y * FH;
    ctx.save();
    if (b.id === 'barn') {
      ctx.fillStyle = '#c0503a'; ctx.fillRect(x - 22, y - 22, 44, 24);
      ctx.fillStyle = '#a03a2a'; ctx.beginPath(); ctx.moveTo(x - 26, y - 22); ctx.lineTo(x, y - 40); ctx.lineTo(x + 26, y - 22); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7a2a1e'; ctx.fillRect(x - 7, y - 14, 14, 16);
      ctx.fillStyle = '#e8c86a'; ctx.fillRect(x - 4, y - 30, 8, 7);
    } else if (b.id === 'nest') {
      ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); ctx.ellipse(x, y - 6, 22, 11, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#6a4a24'; ctx.beginPath(); ctx.ellipse(x, y - 8, 15, 7, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#fff4e0';
      [-7, 0, 7].forEach((dx, i) => { ctx.beginPath(); ctx.ellipse(x + dx, y - 10 - (i === 1 ? 2 : 0), 5, 6, 0, 0, 6.28); ctx.fill(); });
      ctx.fillStyle = '#ffd0a0'; ctx.beginPath(); ctx.ellipse(x, y - 12, 5, 6, 0, 0, 6.28); ctx.fill();
    } else if (b.id === 'pen') {
      ctx.fillStyle = '#7a4a2a';
      for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * 11 - 1, y - 18, 3, 20);
      ctx.fillRect(x - 24, y - 12, 48, 3); ctx.fillRect(x - 24, y - 4, 48, 3);
      ctx.fillStyle = '#6cc46a'; ctx.beginPath(); ctx.ellipse(x, y + 2, 24, 6, 0, 0, 6.28); ctx.fill();
    } else if (b.id === 'play') {
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 2, y - 24, 4, 26);
      ctx.fillStyle = '#f0954a'; roundRect(x - 16, y - 30, 32, 16, 5); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('▶', x, y - 21);
    } else if (b.id === 'wardrobe') {
      ctx.fillStyle = '#6a5a8a'; ctx.fillRect(x - 16, y - 26, 32, 28);
      ctx.fillStyle = '#4a3a6a'; ctx.fillRect(x - 1, y - 26, 2, 28);
      ctx.fillStyle = '#e8c86a'; ctx.fillRect(x - 5, y - 13, 3, 3); ctx.fillRect(x + 2, y - 13, 3, 3);
      ctx.fillStyle = '#8a7ab0'; ctx.beginPath(); ctx.moveTo(x - 18, y - 26); ctx.lineTo(x, y - 34); ctx.lineTo(x + 18, y - 26); ctx.closePath(); ctx.fill();
    } else if (b.id === 'shop') {
      ctx.fillStyle = '#c8a86a'; ctx.fillRect(x - 20, y - 12, 40, 14);
      ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x - 20, y - 12, 40, 4);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#e85a4a' : '#f4f0e0'; ctx.fillRect(x - 20 + i * 8, y - 24, 8, 12); }
      ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x - 20, y - 24, 40, 3);
    }
    ctx.restore();
    label(x, y, b.label);
  }

  function buildingScreenBox(b) {
    return { cx: b.x * FW, cy: b.y * FH, top: b.y * FH - 42, bot: b.y * FH + 16, halfW: 28 };
  }

  /* ---------- main loop ---------- */
  function frame() {
    ft += 0.016;
    const b = BIOMES[getState().settings.biome] || BIOMES[DEFAULT_BIOME];

    const g = ctx.createLinearGradient(0, 0, 0, FH);
    g.addColorStop(0, b.sky[0]); g.addColorStop(0.4, b.sky[1]); g.addColorStop(0.58, b.sky[2]);
    g.addColorStop(0.6, b.horizon); g.addColorStop(1, b.ground);
    ctx.fillStyle = g; ctx.fillRect(0, 0, FW, FH);

    if (b.stars) drawStars();
    if (b.moon) drawMoon(b.sky[0]);
    if (b.sun) drawSun(b.sun);
    hillBand(b.hillA, 0.5, 16, 0.15, 0);
    hillBand(b.hillB, HILL_FRONT, 12, 0.28, 2);
    if (b.clouds) drawClouds();
    drawDecor(b);
    drawTufts();

    // depth-sorted drawables: buildings + wanderers
    const drawables = [];
    for (const bl of BUILDINGS) drawables.push({ y: bl.y * FH, draw: () => drawBuilding(bl) });
    for (const w of wanderers) {
      w.x += (w.tx - w.x) * 0.006; w.y += (w.ty - w.y) * 0.006;
      if (Math.hypot(w.tx - w.x, w.ty - w.y) < 0.02) { w.tx = randX(); w.ty = randY(); }
      const { px, py } = screenPos(w.x, w.y);
      const bob = Math.abs(Math.sin(ft * 4 + w.ph)) * 3;
      const depth = (w.y - BAND_TOP) / (BAND_BOTTOM - BAND_TOP);
      const s = 0.8 + 0.34 * depth;
      drawables.push({ y: py, draw: () => {
        ctx.fillStyle = 'rgba(0,0,0,.16)';
        ctx.beginPath(); ctx.ellipse(px, py, 15 * s, 5 * s, 0, 0, 6.28); ctx.fill();
        ctx.save(); ctx.translate(px, py); ctx.scale(s, s);
        if (w.avatar) drawAvatar(ctx, getState().avatar, -24, -46 - bob, 3);
        else drawPix(ctx, CRITTERS[w.key].stages[stageOf(w.key)], PALS[CRITTERS[w.key].type], -24, -44 - bob, 3);
        ctx.restore();
      } });
    }
    drawables.sort((a, c) => a.y - c.y);
    for (const d of drawables) d.draw();

    if (b.particle) drawParticles(b.particle);
    raf = requestAnimationFrame(frame);
  }

  function onPointerDown(e) {
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (FW / r.width);
    const my = (e.clientY - r.top) * (FH / r.height);
    // buildings first (they're the primary navigation)
    for (const bl of BUILDINGS) {
      const bx = buildingScreenBox(bl);
      if (mx > bx.cx - bx.halfW && mx < bx.cx + bx.halfW && my > bx.top && my < bx.bot + 14) {
        if (onBuilding) onBuilding(bl.id); return;
      }
    }
    // then critters
    if (!onPick) return;
    const sorted = [...wanderers].sort((a, c) => c.y - a.y);
    for (const w of sorted) {
      const { px, py } = screenPos(w.x, w.y);
      if (mx > px - 22 && mx < px + 22 && my > py - 50 && my < py + 8) { onPick(w.avatar ? AVATAR_KEY : w.key); return; }
    }
  }

  function start() {
    resize();
    if (!stars.length) for (let i = 0; i < 40; i++) stars.push({ x: Math.random(), y: Math.random() * 0.42, ph: Math.random() * 6.28 });
    if (!particles.length) for (let i = 0; i < 40; i++) particles.push({ x: Math.random(), y: Math.random(), ph: Math.random() * 6.28, spd: 0.4 + Math.random() });
    if (!tufts.length) for (let i = 0; i < 12; i++) tufts.push({ x: 0.08 + Math.random() * 0.84, y: Math.random() });
    sync();
    canvas.addEventListener('pointerdown', onPointerDown);
    if (!raf) frame();
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; canvas.removeEventListener('pointerdown', onPointerDown); }

  return { start, stop, sync, resize };
}
