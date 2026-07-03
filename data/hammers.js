/**
 * HAMMERS — mallet skins for Whack-a-Cobbie. Each is just a small palette
 * (handle / head / head-top, plus an optional stripe accent and head size);
 * `drawHammer` paints one, used both by the in-game mallet and the picker.
 *
 * The equipped hammer id lives on state.hammer; owned hammers in
 * state.ownedHammers. 'wood' is the free default; the rest unlock via
 * whack-related goals (see systems/quests.js).
 */

export const HAMMERS = {
  wood:  { name: 'WOODEN', emoji: '🔨', handle: '#8a5a2a', head: '#9aa0a8', top: '#c4cad2', w: 18, h: 10 },
  steel: { name: 'STEEL',  emoji: '⚙️', handle: '#4a4a56', head: '#c8d0da', top: '#eef2f8', w: 18, h: 10 },
  candy: { name: 'CANDY',  emoji: '🍭', handle: '#b84a7a', head: '#ff8ec0', top: '#ffd6ea', w: 18, h: 10, stripe: '#ffffff' },
  stone: { name: 'STONE',  emoji: '🪨', handle: '#6a5a4a', head: '#8f8f8a', top: '#b4b4ae', w: 20, h: 12 },
  gold:  { name: 'GOLDEN', emoji: '✨', handle: '#7a5a10', head: '#ffce4a', top: '#fff0a8', w: 20, h: 11 },
  mega:  { name: 'MEGA',   emoji: '💥', handle: '#33333c', head: '#e85a4a', top: '#ff9a7a', w: 26, h: 14 },
};

/** Ordered list for pickers (id + meta). 'wood' first (the default). */
export const HAMMER_LIST = Object.keys(HAMMERS).map((id) => ({ id, ...HAMMERS[id] }));

export function hammer(id) { return HAMMERS[id] || HAMMERS.wood; }

/**
 * Draw a mallet whose head is raised above (cx,cy) and slams down to it as
 * `swing` goes 0→1. Scales with `s`. Shared by whack.js and the hammer picker.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} ham   a HAMMERS entry
 * @param {number} cx    impact point x (where the head lands)
 * @param {number} cy    impact point y
 * @param {number} [s]   scale
 * @param {number} [swing] 0 = raised, 1 = slammed to the impact point
 */
export function drawHammer(ctx, ham, cx, cy, s = 1, swing = 0) {
  const hx = cx - 6 * s, hy = (cy - 24 * s) + 22 * s * swing;
  const w = ham.w * s, h = ham.h * s;
  const headCx = cx - 5 * s;
  // handle
  ctx.strokeStyle = ham.handle; ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hx + 5 * s, hy + 6 * s); ctx.lineTo(cx + 14 * s, cy - 4 * s); ctx.stroke();
  // head
  ctx.fillStyle = ham.head; ctx.fillRect(headCx - w / 2, hy, w, h);
  ctx.fillStyle = ham.top;  ctx.fillRect(headCx - w / 2, hy, w, 3 * s);
  if (ham.stripe) { ctx.fillStyle = ham.stripe; ctx.fillRect(headCx - w / 2, hy + h * 0.44, w, 2 * s); }
}
