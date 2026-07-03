/**
 * TITLE / SPLASH — the real in-game Nora + a pixel COBBIES wordmark.
 * A leaf screen: it draws itself and, once the player taps through, hands
 * control back via the onProceed callback. Owns nothing but its own canvas.
 */

import { CRITTERS, PALS } from '../data/creatures.js';
import { drawPix } from '../render/pixel.js';

const $ = (id) => document.getElementById(id);

const TITLE_FONT = {
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
};
function drawTitleWord(cv) {
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height, text = 'COBBIES';
  ctx.clearRect(0, 0, W, H);
  const px = Math.floor(W / (text.length * 6 + 1));
  const wordW = text.length * 6 * px - px;
  const x0 = (W - wordW) / 2, y0 = (H - 7 * px) / 2;
  const sh = Math.max(2, Math.round(px * 0.28));
  for (let i = 0; i < text.length; i++) {
    const g = TITLE_FONT[text[i]], lx = x0 + i * 6 * px;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === '1') {
      ctx.fillStyle = '#6a2f0a'; ctx.fillRect(lx + c * px, y0 + r * px + sh, px, px);       // drop shadow
      ctx.fillStyle = '#f0a24a'; ctx.fillRect(lx + c * px, y0 + r * px, px, px);             // face
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(lx + c * px, y0 + r * px, px, Math.ceil(px / 3)); // top hilite
    }
  }
}
function drawTitleNora(cv, t) {
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const cell = Math.floor(Math.min(W, H) / 18);
  const bob = Math.abs(Math.sin(t)) * 4;
  const ox = (W - 16 * cell) / 2, oy = (H - 16 * cell) / 2 - bob;
  // soft shadow
  ctx.fillStyle = 'rgba(0,0,0,.14)';
  ctx.beginPath(); ctx.ellipse(W / 2, oy + 15 * cell, 8 * cell, 2 * cell, 0, 0, 6.28); ctx.fill();
  // the real in-game Nora sprite, unmodified
  drawPix(ctx, CRITTERS.nora.stages[2], PALS.nora, ox, oy, cell);
}

/**
 * Wire the title screen. Returns { show } to raise it; the player taps to
 * dismiss, which cancels the animation and calls onProceed().
 * @param {() => void} onProceed
 */
export function initTitle(onProceed) {
  let titleRaf = 0, titleT = 0;
  function show() {
    drawTitleWord($('titleWord'));
    $('titleScreen').classList.add('show');
    titleT = 0;
    const loop = () => { titleT += 0.05; drawTitleNora($('titleNora'), titleT); titleRaf = requestAnimationFrame(loop); };
    loop();
  }
  function hide() {
    if (!$('titleScreen').classList.contains('show')) return;
    cancelAnimationFrame(titleRaf); titleRaf = 0;
    $('titleScreen').classList.remove('show');
    onProceed();
  }
  $('titleScreen').addEventListener('click', hide);
  return { show };
}
