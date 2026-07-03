/**
 * UI SCREENS — render helpers for the roster select, the collection "dex",
 * and the character card. These build DOM into containers owned by main.js;
 * they hold no game state, they just paint what they're handed.
 */

import { CRITTERS, PALS, EVO_XP, RARITY, HATCH_POOL } from '../data/creatures.js';
import { BIOMES } from '../data/biomes.js';
import { AVATAR_OPTIONS, drawAvatar } from '../data/avatar.js';
import { STATIONS, rateFor, accruedFor, expandCost } from '../systems/idle.js';
import { drawPix, drawCentered } from '../render/pixel.js';
import { drawCritter, drawCritterCentered } from '../render/critter.js';

/** Display name for an owned creature (nickname overrides the default). */
export function displayName(owned) {
  return owned.nickname || CRITTERS[owned.key].name;
}

/** Progress toward the next evolution, as a 0–100 percentage. */
function evoPct(owned) {
  if (owned.stage >= EVO_XP.length - 1) return 100;
  const next = EVO_XP[owned.stage + 1];
  const prev = EVO_XP[owned.stage];
  return Math.round(((owned.xp - prev) / (next - prev)) * 100);
}

/**
 * Roster select list. Renders one card per owned creature.
 * @param {HTMLElement} container
 * @param {import('../systems/save.js').OwnedCreature[]} roster
 * @param {(index:number)=>void} onPick
 */
export function renderRoster(container, roster, onPick) {
  container.innerHTML = '';
  roster.forEach((r, i) => {
    const cd = CRITTERS[r.key];
    const card = document.createElement('div');
    card.className = 'rcard';
    card.innerHTML = `<canvas width="48" height="48"></canvas>
      <div class="rinfo">
        <div class="rname">${displayName(r)}</div>
        <div class="rmeta">${cd.stageNames[r.stage]} · LVL ${r.stage + 1} · ${r.xp} XP</div>
        <div class="xpbar"><div class="xpfill" style="width:${evoPct(r)}%"></div></div>
      </div><div class="rgo">RUN ›</div>`;
    container.appendChild(card);
    const cc = card.querySelector('canvas').getContext('2d');
    drawCritter(cc, r.key, r.stage, r.hat, 0, 0, 3);
    card.addEventListener('click', () => onPick(i));
  });
}

/**
 * The Pen: your current collection (owned critters only). A 🏠 badge marks
 * the ones shown on the home ranch. Tap a critter to open its card.
 */
export function renderCollection(container, state, onPick) {
  container.innerHTML = '';
  const home = new Set(state.homeCritters || []);
  for (const r of state.roster) {
    const cd = CRITTERS[r.key];
    const cell = document.createElement('div');
    cell.className = 'dcell';
    cell.innerHTML = `<canvas width="48" height="48"></canvas>
      <div class="dname">${displayName(r)}</div>
      ${home.has(r.key) ? '<div class="home-badge">🏠</div>' : ''}`;
    container.appendChild(cell);
    drawCritter(cell.querySelector('canvas').getContext('2d'), r.key, r.stage, r.hat, 0, 0, 3);
    cell.addEventListener('click', () => onPick(r.key));
  }
}

/**
 * Collection / dex. Every species in a grid: owned shown in colour, locked
 * shown as a silhouette with a "?" so players know what's left to catch.
 * @param {HTMLElement} container
 * @param {import('../systems/save.js').GameState} state
 * @param {(key:string)=>void} onPick   tap an owned cell -> character card
 */
export function renderDex(container, state, onPick) {
  container.innerHTML = '';
  const ownedKeys = new Set(state.roster.map((r) => r.key));
  // Nora + everything hatchable, in a stable order.
  const all = ['nora', ...HATCH_POOL.filter((k) => k !== 'nora')];
  for (const key of all) {
    const cd = CRITTERS[key];
    const owned = ownedKeys.has(key);
    const r = owned ? state.roster.find((x) => x.key === key) : null;
    const cell = document.createElement('div');
    cell.className = 'dcell' + (owned ? '' : ' locked');
    const rarity = RARITY[cd.rarity];
    cell.innerHTML = `<canvas width="48" height="48"></canvas>
      <div class="dname">${owned ? displayName(r) : '???'}</div>
      <div class="drar" style="color:${rarity.color}">${rarity.label}</div>`;
    container.appendChild(cell);
    const cx = cell.querySelector('canvas').getContext('2d');
    if (owned) {
      drawPix(cx, cd.stages[r.stage], PALS[cd.type], 0, 0, 3);
      cell.addEventListener('click', () => onPick(key));
    } else {
      // silhouette: draw stage 0 as flat dark shapes, overlay a "?"
      drawSilhouette(cx, cd.stages[0], 0, 0, 3);
    }
  }
}

function drawSilhouette(ctx, grid, ox, oy, cell) {
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < grid[y].length; x++)
      if (grid[y][x]) ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.font = 'bold 22px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', ox + 24, oy + 24);
}

/**
 * Ranch Jobs screen: one card per station (worker, rate, collectable coins)
 * plus the capacity/expand panel.
 * @param {HTMLElement} container
 * @param {object} state
 * @param {number} now  Date.now()
 * @param {{onAssign,onUnassign,onCollect,onExpand:Function}} h
 */
export function renderStations(container, state, now, h) {
  container.innerHTML = '';
  for (const st of STATIONS) {
    const s = state.stations[st.id] || { key: null };
    const cr = s.key ? state.roster.find((r) => r.key === s.key) : null;
    const acc = accruedFor(state, st.id, now);
    const row = document.createElement('div');
    row.className = 'job-row';
    row.innerHTML = `
      <div class="job-head"><span class="job-emoji">${st.emoji}</span><span class="job-name">${st.name}</span></div>
      <div class="job-body">
        <canvas class="job-critter" width="48" height="48"></canvas>
        <div class="job-info">
          <div class="job-worker">${cr ? displayName(cr) : 'No worker'}</div>
          <div class="job-rate">${cr ? rateFor(st, cr) + ' 🪙/hr' : 'Station a critter here'}</div>
        </div>
        <div class="job-actions">
          ${cr ? `<button class="job-btn collect" data-a="collect" ${acc ? '' : 'disabled'}>+${acc} 🪙</button>` : ''}
          <button class="job-btn" data-a="assign">${cr ? 'CHANGE' : 'ASSIGN'}</button>
          ${cr ? `<button class="job-btn ghost" data-a="remove">✕</button>` : ''}
        </div>
      </div>`;
    container.appendChild(row);
    if (cr) drawPix(row.querySelector('.job-critter').getContext('2d'),
      CRITTERS[cr.key].stages[cr.stage], PALS[CRITTERS[cr.key].type], 0, 0, 3);
    row.querySelectorAll('[data-a]').forEach((btn) => btn.addEventListener('click', () => {
      const a = btn.dataset.a;
      if (a === 'collect') h.onCollect(st.id);
      else if (a === 'remove') h.onUnassign(st.id);
      else h.onAssign(st.id);
    }));
  }
  const cost = expandCost(state.capacity);
  const cap = document.createElement('div');
  cap.className = 'cap-panel';
  cap.innerHTML = `
    <div class="cap-info">Ranch space <b>${state.roster.length} / ${state.capacity}</b></div>
    <button class="job-btn accent" id="expandBtn" ${state.coins < cost ? 'disabled' : ''}>EXPAND +2 · ${cost} 🪙</button>`;
  container.appendChild(cap);
  cap.querySelector('#expandBtn').addEventListener('click', h.onExpand);
}

/**
 * Generic owned-creature picker grid (used for station assignment).
 * @param {HTMLElement} container
 * @param {object} state
 * @param {(key:string)=>boolean} disabledFn  return true to grey out a creature
 * @param {(key:string)=>void} onPick
 */
export function renderPicker(container, state, disabledFn, onPick) {
  container.innerHTML = '';
  for (const r of state.roster) {
    const cd = CRITTERS[r.key];
    const off = disabledFn(r.key);
    const cell = document.createElement('div');
    cell.className = 'dcell' + (off ? ' busy' : '');
    cell.innerHTML = `<canvas width="48" height="48"></canvas><div class="dname">${displayName(r)}</div>`;
    container.appendChild(cell);
    drawPix(cell.querySelector('canvas').getContext('2d'), cd.stages[r.stage], PALS[cd.type], 0, 0, 3);
    if (!off) cell.addEventListener('click', () => onPick(r.key));
  }
}

/** Redraw the avatar preview canvas from a selection. */
export function drawAvatarPreview(canvas, sel) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawAvatar(ctx, sel, 0, 0, canvas.width / 16);
}

/**
 * Build the avatar editor option rows. Calls onChange(sel) after every pick.
 * @param {HTMLElement} container
 * @param {object} sel   avatar selection (mutated in place)
 * @param {() => void} onChange
 */
export function renderAvatarEditor(container, sel, onChange) {
  container.innerHTML = '';
  const O = AVATAR_OPTIONS;

  const colorRow = (label, field, list) => {
    const row = document.createElement('div');
    row.className = 'av-row';
    row.innerHTML = `<span class="av-label">${label}</span>`;
    const opts = document.createElement('div');
    opts.className = 'av-opts';
    list.forEach((item, i) => {
      const sw = document.createElement('button');
      sw.className = 'av-sw' + (sel[field] === i ? ' on' : '');
      sw.style.background = item.c || '#3a4653';
      if (!item.c) sw.textContent = '∅';
      sw.title = item.name;
      sw.addEventListener('click', () => { sel[field] = i; onChange(); });
      opts.appendChild(sw);
    });
    row.appendChild(opts);
    container.appendChild(row);
  };

  const textRow = (label, field, names) => {
    const row = document.createElement('div');
    row.className = 'av-row';
    row.innerHTML = `<span class="av-label">${label}</span>`;
    const opts = document.createElement('div');
    opts.className = 'av-opts';
    names.forEach((name, i) => {
      const b = document.createElement('button');
      b.className = 'av-chip' + (sel[field] === i ? ' on' : '');
      b.textContent = name.toUpperCase();
      b.addEventListener('click', () => { sel[field] = i; onChange(); });
      opts.appendChild(b);
    });
    row.appendChild(opts);
    container.appendChild(row);
  };

  textRow('BODY', 'body', O.bodies.map((x) => x.name));
  colorRow('SKIN', 'skin', O.skins);
  textRow('HAIR', 'hairStyle', O.hairStyles);
  colorRow('COLOR', 'hairColor', O.hairColors);
  colorRow('OUTFIT', 'outfit', O.outfits);
  textRow('HAT', 'hat', O.hats.map((h) => h.name));
}

/**
 * Scene / biome picker. One swatch card per biome, current one highlighted.
 * @param {HTMLElement} container
 * @param {string} current   currently selected biome key
 * @param {(key:string)=>void} onPick
 */
export function renderScenes(container, current, onPick) {
  container.innerHTML = '';
  for (const key of Object.keys(BIOMES)) {
    const b = BIOMES[key];
    const cell = document.createElement('div');
    cell.className = 'scell' + (key === current ? ' active' : '');
    cell.innerHTML = `
      <div class="sswatch" style="background:linear-gradient(180deg,${b.sky[0]},${b.horizon} 62%,${b.ground})">
        <span class="stile" style="background:${b.tileA.top}"></span>
        <span class="stile" style="background:${b.tileB.top}"></span>
      </div>
      <div class="sname">${b.emoji} ${b.name}</div>`;
    container.appendChild(cell);
    cell.addEventListener('click', () => onPick(key));
  }
}

/**
 * Fill the character-card overlay for an owned creature.
 * @param {HTMLElement} root  the #card overlay element
 * @param {import('../systems/save.js').OwnedCreature} owned
 */
export function renderCard(root, owned) {
  const cd = CRITTERS[owned.key];
  const rarity = RARITY[cd.rarity];
  root.querySelector('.card-name').textContent = displayName(owned);
  root.querySelector('.card-stage').textContent =
    `${cd.stageNames[owned.stage]} · LVL ${owned.stage + 1}`;
  root.querySelector('.card-xp').textContent = `${owned.xp} XP`;
  const rar = root.querySelector('.card-rarity');
  rar.textContent = rarity.label;
  rar.style.color = rarity.color;
  root.querySelector('.card-flavor').textContent = cd.flavor;
  const xpFill = root.querySelector('.card-xpfill');
  xpFill.style.width = evoPct(owned) + '%';
  const canvas = root.querySelector('.card-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCritterCentered(ctx, owned.key, owned.stage, owned.hat, canvas.width, 6);
}
