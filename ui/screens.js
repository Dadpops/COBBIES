/**
 * UI SCREENS — render helpers for the roster select, the collection "dex",
 * and the character card. These build DOM into containers owned by main.js;
 * they hold no game state, they just paint what they're handed.
 */

import { CRITTERS, PALS, EVO_XP, RARITY, HATCH_POOL } from '../data/creatures.js';
import { drawPix, drawCentered } from '../render/pixel.js';

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
    drawPix(cc, cd.stages[r.stage], PALS[cd.type], 0, 0, 3);
    card.addEventListener('click', () => onPick(i));
  });
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
    const cell = document.createElement('div');
    cell.className = 'dcell' + (owned ? '' : ' locked');
    const rarity = RARITY[cd.rarity];
    cell.innerHTML = `<canvas width="48" height="48"></canvas>
      <div class="dname">${owned ? cd.name : '???'}</div>
      <div class="drar" style="color:${rarity.color}">${rarity.label}</div>`;
    container.appendChild(cell);
    const cx = cell.querySelector('canvas').getContext('2d');
    if (owned) {
      const r = state.roster.find((x) => x.key === key);
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
  drawCentered(ctx, cd.stages[owned.stage], PALS[cd.type], canvas.width, 6);
}
