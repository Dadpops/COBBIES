/**
 * COBBIES — main orchestrator.
 * Owns the game state, coordinates the systems (farm/run/hatch/save), and
 * drives screen flow + the DOM overlays. Systems are dumb; this is the glue.
 *
 * Loop: farm → pick runner → run (dist=XP+coins) → return with growth →
 *       spend coins to hatch → repeat. Every action shows visible progress.
 */

import { CRITTERS, PALS, EVO_XP, RARITY, HATCH_POOL, TOTAL_SPECIES, stageFor } from './data/creatures.js';
import { drawPix, drawCentered } from './render/pixel.js';
import { lineFor } from './data/dialogue.js';
import * as Save from './systems/save.js';
import { createFarm, AVATAR_KEY } from './systems/farm.js';
import { createRunner } from './systems/run.js';
import { createWhack } from './systems/whack.js';
import { createMusic, TRACKS } from './audio/music.js';
import { createSfx } from './audio/sfx.js';
import { HAT_LIST, HATS } from './data/cosmetics.js';
import { drawCritter, drawCritterCentered } from './render/critter.js';
import { GOALS, goalProgress, goalDone, goalClaimed, rewardText, claimGoal, anyGoalClaimable } from './systems/quests.js';
import { ensureDaily, getDaily, addProgress, claim as claimDaily } from './systems/daily.js';
import {
  hatchEgg, directBuy, EGG_COST, DIRECT_COST, PITY_LIMIT,
} from './systems/hatch.js';
import {
  STATIONS, totalAccrued, collectAll, collectOne, assign as assignStation,
  unassign as unassignStation, stationOf, expand as expandRanch, expandCost, isFull,
} from './systems/idle.js';
import {
  renderRoster, renderCollection, renderCard, renderScenes, displayName,
  renderAvatarEditor, drawAvatarPreview, renderStations, renderPicker,
} from './ui/screens.js';

const $ = (id) => document.getElementById(id);

/* ---------- state ---------- */
let state = Save.load();
const persist = () => Save.save(state);

/* ---------- systems ---------- */
const farm = createFarm($('farm'), () => state, onFarmTap, onBuilding);
function onFarmTap(key) {
  if (key === AVATAR_KEY) openAvatar();
  else showCardFor(key);
}
// Tapping a building on the ranch map opens its area.
function onBuilding(id) {
  if (id === 'barn') openJobs();
  else if (id === 'nest') openHatchMenu();
  else if (id === 'pen') openCollection();
  else if (id === 'wardrobe') openAvatar();
  else if (id === 'shop') openShop();
}
const runner = createRunner($('run'), onRunDistance, onRunEnd, onRunClear);
const music = createMusic();
const sfx = createSfx();
const beep = (fn) => { if (state.settings.musicOn) fn(); };
const whack = createWhack($('whack'), {
  getState: () => state,
  onScore: (x, y) => { beep(() => sfx.smack()); beep(() => sfx.coin()); floatPop(x, y, '+3 🪙', 'coin'); addProgress(state, 'whackHits', 1); },
  onBomb: (x, y) => { beep(() => sfx.bomb()); floatPop(x, y, '✗', 'x'); },
  onIntensity: (p) => music.setIntensity(Math.min(0.7, p * 0.55)), // gentle
  onEnd: (score) => endWhack(score),
});

/* Floating popup (coin ding / bomb X) at a page position. */
function floatPop(px, py, text, cls) {
  const el = document.createElement('div');
  el.className = 'float-pop ' + cls;
  el.textContent = text;
  el.style.left = px + 'px'; el.style.top = py + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 850);
}
window.addEventListener('resize', () => {
  farm.resize(); runner.resize(); whack.resize();
  if ($('tutorialScreen').classList.contains('show')) renderTut();
});

/* ============================================================
   MINIGAME LIFECYCLE — shared chrome for both games: hide the
   farm UI, summon the cheerleader buddy, start the music.
   ============================================================ */
let runActive = false;
function enterMinigame() {
  document.querySelector('.topbar').style.display = 'none';
  $('dialogue').classList.remove('show');
  $('playBig').style.display = 'none';
  runActive = true;
  startBuddy();
  sfx.resume();
  startMusicOnce();
  music.setIntensity(0);           // ramps up as the match goes on
}
function exitMinigame() {
  document.querySelector('.topbar').style.display = '';
  $('playBig').style.display = '';
  runActive = false;
  stopBuddy();
  music.setIntensity(0);           // calm again on the farm — music keeps playing
  renderChallenges();
}

/* ---------- music: plays across the whole game once started ---------- */
let musicStarted = false;
function applyMusicSettings() {
  music.setTrack(state.settings.track);
  music.setVolume(state.settings.volume);
  music.setDynamic(state.settings.musicDynamic);
}
function startMusicOnce() {
  if (musicStarted || !state.settings.musicOn) return;
  applyMusicSettings();
  music.start();
  musicStarted = true;
}
// Browsers require a gesture before audio — start on the very first tap.
window.addEventListener('pointerdown', startMusicOnce, { once: false });

/* ---------- coin display ---------- */
function syncCoins() {
  $('coinCount').textContent = state.coins;
}

/* ============================================================
   BOOT — name entry on first launch, otherwise straight to farm.
   ============================================================ */
function boot() {
  farm.start();
  ensureDaily(state);
  // idle earnings collected while away
  const away = totalAccrued(state, Date.now());
  if (away > 0) { collectAll(state, Date.now()); toast(`🧺 Your ranch earned ${away} 🪙 while you were away!`); }
  persist();
  renderChallenges();
  syncCoins();
  showTitle();
}
function proceedFromTitle() {
  if (!state.playerName) {
    const ctx = $('noraIntro').getContext('2d');
    drawCentered(ctx, CRITTERS.nora.stages[0], PALS.nora, 96, 6);
    $('nameScreen').classList.add('show');
    $('nameInput').focus();
  } else if (!state.tutorialSeen) {
    openTutorial();
  } else {
    scheduleDialogue();
  }
}

/* ============================================================
   TITLE / SPLASH — the real in-game Nora + a pixel COBBIES
   wordmark. Eyes are enlarged here for legibility at a glance.
   ============================================================ */
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
let titleRaf = 0, titleT = 0;
function showTitle() {
  drawTitleWord($('titleWord'));
  $('titleScreen').classList.add('show');
  titleT = 0;
  const loop = () => { titleT += 0.05; drawTitleNora($('titleNora'), titleT); titleRaf = requestAnimationFrame(loop); };
  loop();
}
function hideTitle() {
  if (!$('titleScreen').classList.contains('show')) return;
  cancelAnimationFrame(titleRaf); titleRaf = 0;
  $('titleScreen').classList.remove('show');
  proceedFromTitle();
}
$('titleScreen').addEventListener('click', hideTitle);

$('nameGo').addEventListener('click', submitName);
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitName(); });
function submitName() {
  const v = $('nameInput').value.trim().toUpperCase().slice(0, 12);
  state.playerName = v || 'FRIEND';
  persist();
  $('nameScreen').classList.remove('show');
  openTutorial();
}

/* ============================================================
   HOW TO PLAY — a first-launch walkthrough of the core loop and
   every ranch feature. Reopenable anytime via the ❓ topbar button.
   ============================================================ */
// Each step highlights a real element (`target`) while explaining it. Targets:
// 'critters' = the roaming band, 'play' = the PLAY button, a building id
// (nest/barn/pen/shop), 'topright' = the topbar tools, or null for a centered card.
const TUTORIAL = [
  { emoji: '👋', title: 'WELCOME!', target: null, body: () =>
    `Hi ${state.playerName || 'friend'}! <b>Cobbies</b> are cute pixel critters you collect, raise, and play with. Here's a quick guided tour of your ranch.` },
  { emoji: '🐾', title: 'YOUR COBBIES', target: 'critters', body: () =>
    `These little friends roam your ranch and greet you by name. <b>Tap any cobbie</b> to open its card — every game they play earns XP and <b>evolves</b> them into new forms.` },
  { emoji: '▶️', title: 'PLAY & EARN', target: 'play', body: () =>
    `Tap <b>PLAY</b> for minigames — one-tap <b>Runner</b> and <b>Whack-a-Cobbie</b>. Pick a star cobbie plus a <b>cheerleader buddy</b>, then rack up <b>XP + coins</b>.` },
  { emoji: '🥚', title: 'THE HATCHERY', target: 'nest', body: () =>
    `This is the <b>Nest</b>. Spend coins on a <b>random egg</b> (always someone new — with pity for legendaries) or pick an exact critter. Duplicates bank bonus XP.` },
  { emoji: '🚜', title: 'THE BARN', target: 'barn', body: () =>
    `Send cobbies to <b>work</b> at the Barn — the Berry Patch, Fishing Hole and Lookout earn coins over time, even while you're away. Collect coins to <b>expand your ranch</b>.` },
  { emoji: '📖', title: 'THE PEN', target: 'pen', body: () =>
    `Your full <b>collection</b> lives in the Pen. Browse everyone you've found, spot the locked silhouettes still to discover, and choose which cobbies roam your home ranch.` },
  { emoji: '🎩', title: 'SHOP & WARDROBE', target: 'shop', body: () =>
    `Spend coins in the <b>Shop</b> on dapper <b>hats</b> and ranch expansions — then equip hats from any critter's card and style your own avatar at the <b>Wardrobe</b>.` },
  { emoji: '⭐', title: 'DAILY CHALLENGES', target: 'topright', body: () =>
    `Up here live the <b>⭐ daily challenge</b> and long-term goals (coins + unlocks), the <b>🗺️ scene</b> picker for new backgrounds, and <b>⚙️ settings</b> for music.` },
  { emoji: '🚀', title: "YOU'RE READY!", target: null, body: () =>
    `That's the whole ranch! Collect them all and make it cozy. Tap the <b>❓</b> up top anytime to replay this tour. Have fun, ${state.playerName || 'friend'}!` },
];
let tutIdx = 0;
function openTutorial() {
  tutIdx = 0;
  const dots = $('tutDots');
  dots.innerHTML = '';
  TUTORIAL.forEach(() => dots.appendChild(document.createElement('i')));
  $('tutorialScreen').classList.add('show');
  renderTut();
}
/** Page-space rect of a step's highlight target (null = centered, no spotlight). */
function tutTargetRect(target) {
  if (!target) return null;
  if (target === 'play') return $('playBig').getBoundingClientRect();
  if (target === 'topright') return document.querySelector('.top-right').getBoundingClientRect();
  if (target === 'critters') {
    const r = $('farm').getBoundingClientRect();
    return { left: r.left + r.width * 0.15, top: r.top + r.height * 0.7, width: r.width * 0.7, height: r.height * 0.22 };
  }
  return farm.buildingRect(target); // nest / barn / pen / shop / wardrobe
}
function renderTut() {
  const step = TUTORIAL[tutIdx];
  $('tutEmoji').textContent = step.emoji;
  $('tutTitle').textContent = step.title;
  $('tutBody').innerHTML = step.body();
  $('tutPrev').disabled = tutIdx === 0;
  $('tutNext').textContent = tutIdx === TUTORIAL.length - 1 ? "LET'S PLAY ▸" : 'NEXT ›';
  [...$('tutDots').children].forEach((d, i) => d.classList.toggle('on', i === tutIdx));
  positionSpotlight(tutTargetRect(step.target));
}
// Frame the highlighted rect with four dark panels + an accent ring, and park
// the caption card on the opposite side so it never covers the highlight.
function positionSpotlight(rect) {
  const spot = $('tutSpot'), card = $('tutCard');
  const app = $('app').getBoundingClientRect();
  const W = app.width, H = app.height;
  const setBox = (el, l, t, w, h) => {
    el.style.left = l + 'px'; el.style.top = t + 'px';
    el.style.width = Math.max(0, w) + 'px'; el.style.height = Math.max(0, h) + 'px';
  };
  if (!rect) {
    // no target — dim the whole screen (one panel covers all), center the card
    setBox($('tutMaskT'), 0, 0, W, H);
    [$('tutMaskB'), $('tutMaskL'), $('tutMaskR')].forEach((m) => setBox(m, 0, 0, 0, 0));
    spot.classList.add('none'); setBox(spot, W / 2, H * 0.42, 0, 0);
    card.classList.add('center'); card.style.top = ''; card.style.bottom = '';
    return;
  }
  spot.classList.remove('none'); card.classList.remove('center');
  const l = rect.left - app.left, t = rect.top - app.top, w = rect.width, h = rect.height;
  setBox($('tutMaskT'), 0, 0, W, t);
  setBox($('tutMaskB'), 0, t + h, W, H - (t + h));
  setBox($('tutMaskL'), 0, t, l, h);
  setBox($('tutMaskR'), l + w, t, W - (l + w), h);
  setBox(spot, l, t, w, h);
  // caption goes opposite the target so it never covers the highlight
  if (t + h / 2 < H * 0.5) { card.style.top = ''; card.style.bottom = '22px'; }
  else { card.style.bottom = ''; card.style.top = '18px'; }
}
function closeTutorial() {
  $('tutorialScreen').classList.remove('show');
  if (!state.tutorialSeen) { state.tutorialSeen = true; persist(); }
  scheduleDialogue();
}
$('tutPrev').addEventListener('click', () => { if (tutIdx > 0) { tutIdx--; renderTut(); } });
$('tutNext').addEventListener('click', () => {
  if (tutIdx < TUTORIAL.length - 1) { tutIdx++; renderTut(); } else closeTutorial();
});
$('tutSkip').addEventListener('click', closeTutorial);
$('helpbtn').addEventListener('click', openTutorial);

/* ============================================================
   HOME DIALOGUE (Phase 2 seed) — a random owned critter greets
   the player by name. Nora is weighted to speak most often.
   ============================================================ */
let dialogueTimer = 0;
let dialogueIdx = 0;
function scheduleDialogue() {
  clearTimeout(dialogueTimer);
  if (!runActive) showDialogue();
  dialogueTimer = setTimeout(scheduleDialogue, 10000);
}
function showDialogue() {
  const bubble = $('dialogue');
  const roster = state.roster;
  if (!roster.length) return;
  // Round-robin through every captured cobbie so they all get a turn.
  const owner = roster[dialogueIdx % roster.length];
  dialogueIdx = (dialogueIdx + 1) % roster.length;
  const cd = CRITTERS[owner.key];
  const ctx = $('dlgCanvas').getContext('2d');
  ctx.clearRect(0, 0, 48, 48);
  drawPix(ctx, cd.stages[owner.stage], PALS[cd.type], 0, 0, 3);
  $('dlgText').textContent = lineFor(owner.key, state.playerName);
  bubble.classList.add('show');
  setTimeout(() => bubble.classList.remove('show'), 8500);
}

/* ============================================================
   MINIGAME HUB — PLAY opens a picker (Runner / Whack) with the
   cheerleader-buddy selector and a music toggle.
   ============================================================ */
$('hubBack').addEventListener('click', () => $('hubScreen').classList.remove('show'));
function openHub() {
  updateHubBuddyName();
  updateMusicToggle();
  $('hubScreen').classList.add('show');
}
$('hubRun').addEventListener('click', () => openRosterFor(startRun));
$('hubWhack').addEventListener('click', () => openRosterFor(startWhackWith));
function openRosterFor(onPick) {
  renderRoster($('roster'), state.roster, onPick);
  $('rosterScreen').classList.add('show');
}
$('rosterBack').addEventListener('click', () => $('rosterScreen').classList.remove('show'));

/* ---------- cheerleader buddy selection ---------- */
$('hubBuddy').addEventListener('click', openBuddySelect);
$('buddyBack').addEventListener('click', () => $('buddyScreen').classList.remove('show'));
function updateHubBuddyName() {
  const b = state.roster.find((r) => r.key === state.buddy) || state.roster[0];
  $('hubBuddyName').textContent = displayName(b);
}
function openBuddySelect() {
  const grid = $('buddyGrid');
  grid.innerHTML = '';
  for (const r of state.roster) {
    const cd = CRITTERS[r.key];
    const cell = document.createElement('div');
    cell.className = 'dcell' + (state.buddy === r.key ? ' active' : '');
    cell.innerHTML = `<canvas width="48" height="48"></canvas><div class="dname">${displayName(r)}</div>`;
    grid.appendChild(cell);
    drawPix(cell.querySelector('canvas').getContext('2d'), cd.stages[r.stage], PALS[cd.type], 0, 0, 3);
    cell.addEventListener('click', () => {
      state.buddy = r.key; persist(); updateHubBuddyName(); openBuddySelect();
    });
  }
  $('buddyScreen').classList.add('show');
}

/* ---------- sound options (opens Settings) ---------- */
$('musicToggle').addEventListener('click', openSettings);
function updateMusicToggle() { $('musicToggle').textContent = '🎵 SOUND OPTIONS'; }

/* ============================================================
   SETTINGS — music track / volume / dynamic-tempo / on-off.
   ============================================================ */
$('settingsbtn').addEventListener('click', openSettings);
$('settingsBack').addEventListener('click', () => $('settingsScreen').classList.remove('show'));
function openSettings() { renderSettings(); $('settingsScreen').classList.add('show'); }
function renderSettings() {
  const b = $('settingsBody');
  b.innerHTML = '';
  b.appendChild(toggleRow('MUSIC', state.settings.musicOn, () => {
    state.settings.musicOn = !state.settings.musicOn; persist();
    if (state.settings.musicOn) { musicStarted = false; startMusicOnce(); }
    else { music.stop(); musicStarted = false; }
    renderSettings();
  }));
  b.appendChild(chipRow('TRACK', TRACKS.map((t) => t.name), state.settings.track, (i) => {
    state.settings.track = i; persist(); music.setTrack(i);
    if (state.settings.musicOn) startMusicOnce();
    renderSettings();
  }));
  const vr = document.createElement('div'); vr.className = 'set-row';
  vr.innerHTML = '<span class="set-label">VOLUME</span>';
  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.className = 'set-vol';
  slider.value = Math.round(state.settings.volume * 100);
  slider.addEventListener('input', () => { state.settings.volume = slider.value / 100; music.setVolume(state.settings.volume); });
  slider.addEventListener('change', persist);
  vr.appendChild(slider); b.appendChild(vr);
  b.appendChild(toggleRow('SPEED-UP IN GAMES', state.settings.musicDynamic, () => {
    state.settings.musicDynamic = !state.settings.musicDynamic; persist();
    music.setDynamic(state.settings.musicDynamic); renderSettings();
  }));
}
function toggleRow(label, on, onClick) {
  const row = document.createElement('div'); row.className = 'set-row';
  row.innerHTML = `<span class="set-label">${label}</span>`;
  const opts = document.createElement('div'); opts.className = 'set-opts';
  ['ON', 'OFF'].forEach((t, i) => {
    const active = (i === 0) === on;
    const btn = document.createElement('button');
    btn.className = 'av-chip' + (active ? ' on' : '');
    btn.textContent = t;
    btn.addEventListener('click', () => { if (!active) onClick(); });
    opts.appendChild(btn);
  });
  row.appendChild(opts); return row;
}
function chipRow(label, names, sel, onPick) {
  const row = document.createElement('div'); row.className = 'set-row';
  row.innerHTML = `<span class="set-label">${label}</span>`;
  const opts = document.createElement('div'); opts.className = 'set-opts';
  names.forEach((n, i) => {
    const btn = document.createElement('button');
    btn.className = 'av-chip' + (sel === i ? ' on' : '');
    btn.textContent = n;
    btn.addEventListener('click', () => onPick(i));
    opts.appendChild(btn);
  });
  row.appendChild(opts); return row;
}

/* ============================================================
   RANCH JOBS (idle) — station critters to earn coins over time,
   expand the ranch to hold more critters.
   ============================================================ */
$('jobsBack').addEventListener('click', () => $('jobsScreen').classList.remove('show'));
function jobsHandlers() {
  return {
    onAssign: (id) => {
      const st = STATIONS.find((s) => s.id === id);
      openPicker('STATION AT ' + st.name.toUpperCase(),
        (key) => stationOf(state, key) === id,
        (key) => { assignStation(state, id, key, Date.now()); persist(); farm.sync(); $('pickerScreen').classList.remove('show'); refreshJobs(); });
    },
    onUnassign: (id) => { unassignStation(state, id, Date.now()); persist(); syncCoins(); farm.sync(); refreshJobs(); },
    onCollect: (id) => { if (collectOne(state, id, Date.now())) { persist(); syncCoins(); beep(() => sfx.coin()); } refreshJobs(); },
    onExpand: () => { if (expandRanch(state)) { persist(); syncCoins(); beep(() => sfx.coin()); refreshJobs(); } },
  };
}
function refreshJobs() { renderStations($('jobsList'), state, Date.now(), jobsHandlers()); drawBarnScene(); }
function openJobs() { refreshJobs(); $('jobsScreen').classList.add('show'); }

// A little barn interior showing the critters currently on the job.
function drawBarnScene() {
  const cv = $('barnScene'); const c = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#8a5a34'); g.addColorStop(1, '#6a4424');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 2;
  for (let y = 16; y < H - 30; y += 18) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.fillStyle = '#c8a86a'; c.fillRect(0, H - 30, W, 30);
  c.fillStyle = '#b89858'; c.fillRect(0, H - 30, W, 4);
  c.fillStyle = '#e8c86a'; c.fillRect(12, H - 42, 26, 12); c.fillRect(W - 42, H - 40, 28, 10);

  const workers = STATIONS.map((st) => state.stations[st.id]).filter((s) => s && s.key);
  if (!workers.length) {
    c.fillStyle = 'rgba(255,255,255,.7)'; c.font = '11px ui-monospace, monospace';
    c.textAlign = 'center'; c.fillText('No critters working yet — station some below!', W / 2, H - 46);
    return;
  }
  workers.forEach((s, i) => {
    const o = state.roster.find((r) => r.key === s.key);
    const bx = workers.length === 1 ? W * 0.5 : W * (0.22 + 0.56 * (i / (workers.length - 1)));
    c.fillStyle = 'rgba(0,0,0,.18)';
    c.beginPath(); c.ellipse(bx, H - 26, 18, 5, 0, 0, 6.28); c.fill();
    drawCritter(c, s.key, o ? o.stage : 0, o ? o.hat : null, bx - 24, H - 74, 3);
  });
}

/* ---------- generic creature picker ---------- */
$('pickerBack').addEventListener('click', () => $('pickerScreen').classList.remove('show'));
function openPicker(title, disabledFn, onPick) {
  $('pickerTitle').textContent = title;
  renderPicker($('pickerGrid'), state, disabledFn, onPick);
  $('pickerScreen').classList.add('show');
}

/* ---------- welcome-back toast ---------- */
function toast(text, ms = 3400) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = text;
  $('app').appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/* ============================================================
   RUNNER
   ============================================================ */
let activeRunIdx = -1;
function startRun(idx) {
  activeRunIdx = idx;
  const r = state.roster[idx];
  $('rosterScreen').classList.remove('show');
  $('hubScreen').classList.remove('show');
  $('run').style.display = 'block';
  $('runhud').classList.add('show');
  $('runnerName').textContent = displayName(r);
  enterMinigame();
  runner.start({ key: r.key, stage: r.stage });
}
function onRunDistance(d) {
  $('dist').textContent = d;
  music.setIntensity(Math.min(0.85, d / 2500)); // very gradual speed-up
}
// Each cleared obstacle: a coin, a ding, and a floating popup.
function onRunClear(px, py) {
  state.coins += 3;
  addProgress(state, 'coins', 3);
  syncCoins();
  beep(() => sfx.coin());
  floatPop(px, py, '+3 🪙', 'coin');
}

function onRunEnd(dist, clears) {
  const r = state.roster[activeRunIdx];
  const gainedXP = Math.floor(dist * 0.4);       // reduced
  const gainedCoins = clears * 3;                 // already credited live per clear
  const before = r.stage;
  r.xp += gainedXP;
  const after = stageFor(r.xp);
  const evolved = after > before;
  if (evolved) r.stage = after;
  addProgress(state, 'runDist', dist);
  addProgress(state, 'games', 1);
  state.stats.games++; state.stats.runBest = Math.max(state.stats.runBest, dist); // goals
  farm.sync();
  persist();
  syncCoins();

  // Results card first…
  const cd = CRITTERS[r.key];
  $('resTitle').textContent = 'RUN COMPLETE';
  $('resName').textContent = `${displayName(r)} · ${cd.stageNames[r.stage]}`;
  $('resStat').innerHTML = `Distance <b>${dist}</b>m`;
  $('resXP').textContent = '+' + gainedXP + ' XP';
  $('resCoins').textContent = '+' + gainedCoins + ' 🪙';
  const rc = $('resCanvas').getContext('2d');
  rc.clearRect(0, 0, 96, 96);
  drawCritterCentered(rc, r.key, r.stage, r.hat, 96, 6);
  setTimeout(() => $('results').classList.add('show'), 300);

  // …then, if it evolved, a dedicated reveal after the player continues.
  pendingEvolve = evolved ? { key: r.key, before, after } : null;
}

let pendingEvolve = null;
$('resContinue').addEventListener('click', () => {
  $('results').classList.remove('show');
  $('run').style.display = 'none';
  $('whack').style.display = 'none';
  $('runhud').classList.remove('show');
  runner.stop();
  whack.stop();
  exitMinigame();
  if (pendingEvolve) {
    showEvolution(pendingEvolve);
    pendingEvolve = null;
  }
});

/* ============================================================
   WHACK-A-COBBIE — creatures pop from holes; bonk them. Earns
   coins + XP for the chosen buddy. Difficulty ramps over 30s.
   ============================================================ */
let whackIdx = -1;
function startWhackWith(idx) {
  whackIdx = idx;
  const r = state.roster[idx];
  $('rosterScreen').classList.remove('show');
  $('hubScreen').classList.remove('show');
  $('whack').style.display = 'block';
  enterMinigame();
  whack.start({ key: r.key, stage: r.stage, hat: r.hat });
}
function endWhack(score) {
  const coins = score * 3;
  const xp = score * 4;
  state.coins += coins;
  const r = state.roster[whackIdx] || state.roster[0];
  const before = r.stage;
  r.xp += xp;
  const after = stageFor(r.xp);
  const evolved = after > before;
  if (evolved) r.stage = after;
  addProgress(state, 'coins', coins);
  addProgress(state, 'games', 1);
  state.stats.games++; state.stats.whackHits += score; // goal progress
  farm.sync();
  persist();
  syncCoins();

  const cd = CRITTERS[r.key];
  $('resTitle').textContent = "TIME'S UP!";
  $('resName').textContent = `${displayName(r)} · ${cd.stageNames[r.stage]}`;
  $('resStat').innerHTML = `<b>${score}</b> bonks`;
  $('resXP').textContent = '+' + xp + ' XP';
  $('resCoins').textContent = '+' + coins + ' 🪙';
  const rc = $('resCanvas').getContext('2d');
  rc.clearRect(0, 0, 96, 96);
  drawCritterCentered(rc, r.key, r.stage, r.hat, 96, 6);
  setTimeout(() => $('results').classList.add('show'), 300);
  pendingEvolve = evolved ? { key: r.key, before, after } : null;
}

/* ============================================================
   CHEERLEADER BUDDY — bounces on the sideline and cheers during
   any minigame. Draws the chosen buddy creature + a speech pop.
   ============================================================ */
let buddyRaf = 0, buddyNextCheer = 0;
const CHEERS = ['Go go go!', 'Nice!', 'You got this!', 'Woohoo!', 'Amazing!', 'Keep it up!', "Let's go!"];
function startBuddy() {
  $('buddyBox').classList.add('show');
  buddyNextCheer = performance.now() + 1200;
  if (!buddyRaf) buddyLoop();
}
function buddyLoop() {
  const now = performance.now();
  const owned = state.roster.find((r) => r.key === state.buddy);
  const c = $('buddyCanvas').getContext('2d');
  c.clearRect(0, 0, 48, 48);
  const bob = Math.abs(Math.sin(now / 130)) * 4; // excited hopping
  drawCritter(c, state.buddy || 'nora', owned ? owned.stage : 0, owned ? owned.hat : null, 0, 4 - bob, 3);
  if (now > buddyNextCheer) {
    $('buddyBubble').textContent = CHEERS[(Math.random() * CHEERS.length) | 0];
    $('buddyBubble').classList.add('show');
    setTimeout(() => $('buddyBubble').classList.remove('show'), 1400);
    buddyNextCheer = now + 2600 + Math.random() * 1600;
  }
  buddyRaf = requestAnimationFrame(buddyLoop);
}
function stopBuddy() {
  cancelAnimationFrame(buddyRaf); buddyRaf = 0;
  $('buddyBox').classList.remove('show');
  $('buddyBubble').classList.remove('show');
}

/* ============================================================
   EVOLUTION — a dedicated reveal moment (mirrors the hatch beat).
   ============================================================ */
function showEvolution({ key, before, after }) {
  const cd = CRITTERS[key];
  const r = state.roster.find((x) => x.key === key);
  const ctx = $('evoCanvas').getContext('2d');
  ctx.clearRect(0, 0, 120, 120);
  // brief flash of the old stage, then settle on the new one
  drawCentered(ctx, cd.stages[before], PALS[cd.type], 120, 7);
  $('evoName').textContent = displayName(r);
  $('evoTransition').textContent = `${cd.stageNames[before]} → ${cd.stageNames[after]}`;
  $('evolve').classList.add('show');
  setTimeout(() => {
    ctx.clearRect(0, 0, 120, 120);
    drawCentered(ctx, cd.stages[after], PALS[cd.type], 120, 7);
  }, 700);
}
$('evoDone').addEventListener('click', () => $('evolve').classList.remove('show'));

/* ============================================================
   HATCHERY — random egg vs direct buy (Section 9 decision).
   ============================================================ */
$('hatchMenuBack').addEventListener('click', () => $('hatchMenu').classList.remove('show'));

function remainingToFind() {
  const owned = new Set(state.roster.map((r) => r.key));
  return HATCH_POOL.filter((k) => !owned.has(k) && (CRITTERS[k].unlockAt ?? 8) <= state.capacity).length;
}
function lockedRemaining() {
  const owned = new Set(state.roster.map((r) => r.key));
  return HATCH_POOL.filter((k) => !owned.has(k) && (CRITTERS[k].unlockAt ?? 8) > state.capacity).length;
}
function openHatchMenu() {
  updatePityHint();
  $('eggRandom').disabled = state.coins < EGG_COST || remainingToFind() === 0 || isFull(state);
  $('eggDirect').disabled = state.coins < DIRECT_COST;
  $('eggRandom').textContent = `🥚 RANDOM EGG · ${EGG_COST}`;
  $('eggDirect').textContent = `🎯 PICK A CRITTER · ${DIRECT_COST}`;
  $('directList').classList.remove('show');
  $('directList').innerHTML = '';
  $('hatchMenu').classList.add('show');
}
function updatePityHint() {
  const remaining = remainingToFind();
  if (isFull(state) && remaining > 0) {
    $('pityHint').textContent = 'Ranch is full — expand it in Jobs to make room!';
    return;
  }
  if (remaining === 0) {
    $('pityHint').textContent = lockedRemaining() > 0
      ? 'Hatched all you can! Expand your ranch in Jobs to unlock new critters.'
      : "You've collected every cobbie! 🎉";
    return;
  }
  const left = PITY_LIMIT - state.pity;
  $('pityHint').textContent =
    left <= 3
      ? `A legendary is guaranteed within ${left} egg${left === 1 ? '' : 's'}!`
      : `A random egg is always someone new — ${remaining} unlocked to find.`;
}

$('eggRandom').addEventListener('click', () => {
  const result = hatchEgg(state);
  if (!result) return;
  if (result.allCollected) { updatePityHint(); $('eggRandom').disabled = true; return; }
  persist(); syncCoins();
  $('hatchMenu').classList.remove('show');
  playHatchAnimation(result);
});

$('eggDirect').addEventListener('click', () => {
  const list = $('directList');
  if (list.classList.contains('show')) { list.classList.remove('show'); return; }
  list.innerHTML = '';
  const ownedKeys = new Set(state.roster.map((r) => r.key));
  const unlocked = HATCH_POOL.filter((k) => (CRITTERS[k].unlockAt ?? 8) <= state.capacity);
  for (const key of unlocked) {
    const cd = CRITTERS[key];
    const owned = ownedKeys.has(key);
    const row = document.createElement('div');
    row.className = 'direct-row' + (owned ? ' owned' : '');
    row.innerHTML = `<canvas width="40" height="40"></canvas>
      <span class="drname">${cd.name}</span>
      <span class="drtag" style="color:${RARITY[cd.rarity].color}">${owned ? 'OWNED · +XP' : RARITY[cd.rarity].label}</span>`;
    list.appendChild(row);
    drawPix(row.querySelector('canvas').getContext('2d'), cd.stages[0], PALS[cd.type], -4, -4, 3);
    row.addEventListener('click', () => {
      if (!owned && isFull(state)) { toast('Ranch is full — expand it in Jobs!'); return; }
      const result = directBuy(state, key);
      if (!result) return;
      persist(); syncCoins();
      $('hatchMenu').classList.remove('show');
      playHatchAnimation(result);
    });
  }
  list.classList.add('show');
});

/* ---------- egg reveal animation ---------- */
const EGG_PAL = [null, '#c8a86a', '#f0e0c0', '#fff8e8', '#a88a4a', '#8a6a3a'];
function eggGrid(cracked) {
  const g = [
    [0,0,0,3,3,3,0,0,0,0],
    [0,0,3,2,2,2,3,0,0,0],
    [0,3,2,2,2,2,2,3,0,0],
    [0,3,2,2,2,2,2,3,0,0],
    [3,2,2,2,2,2,2,2,3,0],
    [3,2,2,2,2,2,2,2,3,0],
    [3,1,2,2,2,2,2,1,3,0],
    [3,1,1,2,2,2,1,1,3,0],
    [0,3,1,1,1,1,1,3,0,0],
    [0,0,3,4,4,4,3,0,0,0],
  ];
  if (cracked) { g[4][4] = 5; g[5][3] = 5; g[5][5] = 5; g[6][4] = 5; }
  return g;
}
function drawEgg(cracked) {
  const ec = $('eggCanvas'), c = ec.getContext('2d');
  c.clearRect(0, 0, ec.width, ec.height);
  drawPix(c, eggGrid(cracked), EGG_PAL, 0, 0, 6);
}

function playHatchAnimation(result) {
  $('hatchTitle').textContent = 'HATCHING...';
  $('hatchReveal').classList.remove('show');
  $('hatchDone').style.display = 'none';
  const egg = $('eggCanvas');
  egg.style.display = 'block';
  drawEgg(false);
  $('hatch').classList.add('show');
  setTimeout(() => egg.classList.add('shake'), 400);
  setTimeout(() => drawEgg(true), 1500);
  setTimeout(() => { egg.classList.remove('shake'); revealHatch(result); }, 2300);
}

function revealHatch(result) {
  const cd = CRITTERS[result.key];
  $('eggCanvas').style.display = 'none';
  const rc = $('hatchCanvas').getContext('2d');
  rc.clearRect(0, 0, 96, 96);
  const owned = state.roster.find((r) => r.key === result.key);
  drawCentered(rc, cd.stages[owned ? owned.stage : 0], PALS[cd.type], 96, 3);
  $('hatchTitle').textContent = 'IT HATCHED!';
  $('hatchName').textContent = cd.name;
  const tag = $('hatchTag');
  if (result.isDupe) {
    tag.className = 'hdupe';
    tag.textContent = `DUPLICATE · +${result.awardedXP} XP TO ${cd.name}`;
  } else {
    tag.className = 'hnew';
    tag.textContent = 'NEW CRITTER JOINS THE RANCH!';
  }
  if (result.pityTriggered) {
    tag.innerHTML += `<div class="hpity">✦ PITY REWARD ✦</div>`;
  }
  if (!result.isDupe) {
    addProgress(state, 'hatch', 1);
    state.stats.hatches++; // goals
    if (state.homeCritters.length < 10) state.homeCritters.push(result.key); // show new friend at home
    persist(); renderChallenges();
  }
  farm.sync();
  $('hatchReveal').classList.add('show');
  $('hatchDone').style.display = 'block';
}
$('hatchDone').addEventListener('click', () => $('hatch').classList.remove('show'));

/* ============================================================
   COLLECTION (DEX) + CHARACTER CARD
   ============================================================ */
$('dexBack').addEventListener('click', () => $('dexScreen').classList.remove('show'));
function openCollection() {
  $('dexCount').textContent = `${state.roster.length} / ${TOTAL_SPECIES} COLLECTED · 🏠 = on farm`;
  renderCollection($('dexGrid'), state, showCardFor);
  $('dexScreen').classList.add('show');
}

/* ---------- wardrobe (avatar creator) ---------- */
$('avatarBack').addEventListener('click', () => $('avatarScreen').classList.remove('show'));
$('avatarDone').addEventListener('click', () => $('avatarScreen').classList.remove('show'));
function openAvatar() {
  const refresh = () => {
    persist();
    drawAvatarPreview($('avatarPreview'), state.avatar);
    renderAvatarEditor($('avatarOptions'), state.avatar, refresh);
  };
  drawAvatarPreview($('avatarPreview'), state.avatar);
  renderAvatarEditor($('avatarOptions'), state.avatar, refresh);
  $('avatarScreen').classList.add('show');
}

/* ---------- scene / biome picker ---------- */
$('scenebtn').addEventListener('click', openScenes);
$('sceneBack').addEventListener('click', () => $('sceneScreen').classList.remove('show'));
function pickScene(key) {
  state.settings.biome = key;
  persist();
  renderScenes($('sceneGrid'), state.settings.biome, state.unlockedBiomes, pickScene);
}
function openScenes() {
  renderScenes($('sceneGrid'), state.settings.biome, state.unlockedBiomes, pickScene);
  $('sceneScreen').classList.add('show');
}

function showCardFor(key) {
  const owned = state.roster.find((r) => r.key === key);
  if (!owned) return;
  cardKey = key;
  renderCard($('card'), owned);
  updateCardHome();
  $('card').classList.add('show');
}
let cardKey = null;
$('cardClose').addEventListener('click', () => $('card').classList.remove('show'));

// Toggle whether this critter appears on the home ranch (max 10).
$('cardHome').addEventListener('click', () => {
  if (!cardKey) return;
  const home = state.homeCritters;
  const idx = home.indexOf(cardKey);
  if (idx >= 0) home.splice(idx, 1);
  else if (home.length >= 10) { toast('Home ranch is full (10) — remove one first.'); return; }
  else home.push(cardKey);
  persist(); farm.sync(); updateCardHome();
  if ($('dexScreen').classList.contains('show')) renderCollection($('dexGrid'), state, showCardFor);
});
function updateCardHome() {
  const on = state.homeCritters.includes(cardKey);
  const btn = $('cardHome');
  btn.textContent = on ? '🏠 ON FARM ✓' : '🏠 ADD TO FARM';
  btn.classList.toggle('on', on);
}

/* ---------- critter hats ---------- */
$('cardHat').addEventListener('click', () => {
  if (!cardKey) return;
  $('card').classList.remove('show'); // card sits above the hat screen — close it first
  openHatPicker(cardKey);
});
$('hatBack').addEventListener('click', () => $('hatScreen').classList.remove('show'));
function openHatPicker(key) {
  const owned = state.roster.find((r) => r.key === key);
  if (!owned) return;
  $('hatTitle').textContent = 'HAT FOR ' + displayName(owned);
  const grid = $('hatGrid');
  grid.innerHTML = '';
  const none = document.createElement('div');
  none.className = 'hatcell' + (owned.hat ? '' : ' on');
  none.innerHTML = '<span class="hatemoji">🚫</span><span class="hatname">NONE</span>';
  none.addEventListener('click', () => setHat(key, null));
  grid.appendChild(none);
  for (const h of HAT_LIST) {
    const have = state.ownedHats.includes(h.id) || owned.hat === h.id;
    const cell = document.createElement('div');
    cell.className = 'hatcell' + (owned.hat === h.id ? ' on' : '') + (have ? '' : ' busy');
    cell.innerHTML = `<span class="hatemoji">${have ? h.emoji : '🔒'}</span><span class="hatname">${h.name}</span>`;
    cell.addEventListener('click', () => {
      if (!have) { toast('Buy ' + h.name + ' in the Shop!'); return; }
      setHat(key, h.id);
    });
    grid.appendChild(cell);
  }
  $('hatScreen').classList.add('show');
}
function setHat(key, hatId) {
  const owned = state.roster.find((r) => r.key === key);
  if (!owned) return;
  owned.hat = hatId; persist(); farm.sync();
  openHatPicker(key);            // refresh selection highlight
  renderCard($('card'), owned);  // update the card preview behind
}

/* ---------- shop ---------- */
$('shopBack').addEventListener('click', () => $('shopScreen').classList.remove('show'));
function openShop() { renderShop(); $('shopScreen').classList.add('show'); }
function renderShop() {
  const body = $('shopBody');
  body.innerHTML = '';
  const cost = expandCost(state.capacity);
  body.appendChild(shopItem('🏡', 'Ranch Expansion', `+2 space · now ${state.roster.length}/${state.capacity}`,
    `${cost} 🪙`, state.coins >= cost, () => {
      if (expandRanch(state)) { persist(); syncCoins(); beep(() => sfx.coin()); renderShop(); }
    }));

  const head = document.createElement('div');
  head.className = 'goals-head'; head.textContent = '🎩 HATS';
  head.style.marginTop = '8px'; body.appendChild(head);
  for (const h of HAT_LIST) {
    const owned = state.ownedHats.includes(h.id);
    const item = shopItem(h.emoji, h.name,
      owned ? 'Equip it from a critter card' : 'A dapper little accessory',
      owned ? 'OWNED' : `${h.cost} 🪙`, !owned && state.coins >= h.cost, () => {
        if (owned || state.coins < h.cost) return;
        state.coins -= h.cost; state.ownedHats.push(h.id);
        persist(); syncCoins(); beep(() => sfx.coin()); toast('Bought ' + h.name + '!'); renderShop();
      });
    if (owned) item.querySelector('.shop-buy').classList.add('owned');
    body.appendChild(item);
  }
  body.appendChild(shopItemSoon('🖼️', 'More Backgrounds', 'Unlock scenes via Challenges'));
}
function shopItem(emoji, title, desc, price, enabled, onBuy) {
  const el = document.createElement('div');
  el.className = 'shop-item';
  el.innerHTML = `<span class="shop-emoji">${emoji}</span>
    <div class="shop-info"><b>${title}</b><span>${desc}</span></div>
    <button class="shop-buy" ${enabled ? '' : 'disabled'}>${price}</button>`;
  el.querySelector('.shop-buy').addEventListener('click', onBuy);
  return el;
}
function shopItemSoon(emoji, title, desc) {
  const el = document.createElement('div');
  el.className = 'shop-item soon';
  el.innerHTML = `<span class="shop-emoji">${emoji}</span>
    <div class="shop-info"><b>${title}</b><span>${desc}</span></div>
    <button class="shop-buy" disabled>SOON</button>`;
  return el;
}

// Rename via an in-app modal (prompt() is blocked inside embedded/iframe hosts).
$('cardRename').addEventListener('click', () => {
  const owned = state.roster.find((r) => r.key === cardKey);
  if (!owned) return;
  $('renameInput').value = displayName(owned);
  $('renameModal').classList.add('show');
  $('renameInput').focus();
  $('renameInput').select();
});
function commitRename() {
  const owned = state.roster.find((r) => r.key === cardKey);
  const v = $('renameInput').value.trim().toUpperCase().slice(0, 14);
  $('renameModal').classList.remove('show');
  if (owned && v) {
    owned.nickname = v;
    persist();
    renderCard($('card'), owned);
    farm.sync();
  }
}
$('renameSave').addEventListener('click', commitRename);
$('renameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') commitRename(); });
$('renameCancel').addEventListener('click', () => $('renameModal').classList.remove('show'));

/* ============================================================
   CHALLENGES — a ⭐ topbar button opens the daily challenge.
   ============================================================ */
$('playBig').addEventListener('click', openHub);
$('challengesbtn').addEventListener('click', openChallenges);
$('challengesBack').addEventListener('click', () => $('challengesScreen').classList.remove('show'));
$('chalClaim').addEventListener('click', () => {
  const reward = claimDaily(state);
  if (reward) { state.coins += reward; persist(); syncCoins(); beep(() => sfx.coin()); }
  renderChallenges();
});
function openChallenges() { renderChallenges(); $('challengesScreen').classList.add('show'); }
function renderChallenges() {
  const d = ensureDaily(state);
  $('chalText').textContent = d.text;
  $('chalFill').style.width = Math.round((d.progress / d.target) * 100) + '%';
  $('chalProg').textContent = d.claimed ? 'Claimed for today ✓' : `${d.progress} / ${d.target}`;
  const claim = $('chalClaim');
  claim.textContent = d.claimed ? 'CLAIMED ✓' : `CLAIM +${d.reward} 🪙`;
  claim.disabled = !d.done || d.claimed;

  // goals ladder
  const gl = $('goalsList');
  if (gl) {
    gl.innerHTML = '';
    for (const g of GOALS) {
      const val = goalProgress(state, g);
      const done = goalDone(state, g);
      const claimed = goalClaimed(state, g);
      const row = document.createElement('div');
      row.className = 'goal-row' + (claimed ? ' claimed' : done ? ' done' : '');
      row.innerHTML = `
        <div class="goal-top"><span class="goal-text">${g.text}</span><span class="goal-reward">${rewardText(g.reward)}</span></div>
        <div class="goal-bar"><div class="goal-fill" style="width:${Math.round((val / g.target) * 100)}%"></div></div>
        <div class="goal-prog">${Math.min(val, g.target)} / ${g.target}</div>
        ${done && !claimed ? '<button class="goal-claim">CLAIM REWARD</button>'
          : claimed ? '<div class="goal-reward" style="text-align:center;margin-top:6px">Claimed ✓</div>' : ''}`;
      gl.appendChild(row);
      const btn = row.querySelector('.goal-claim');
      if (btn) btn.addEventListener('click', () => claimGoalUI(g));
    }
  }
  $('challengesbtn').classList.toggle('ready', (d.done && !d.claimed) || anyGoalClaimable(state));
}
function claimGoalUI(g) {
  const reward = claimGoal(state, g);
  if (!reward) return;
  persist(); syncCoins(); beep(() => sfx.coin());
  toast('Unlocked ' + rewardText(reward) + '!');
  renderChallenges();
}

/* ---------- go ---------- */
boot();
