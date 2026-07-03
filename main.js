/**
 * COBBIES — main orchestrator.
 * Owns the game state, coordinates the systems (farm/run/hatch/save), and
 * drives screen flow + the DOM overlays. Systems are dumb; this is the glue.
 *
 * Loop: farm → pick runner → run (dist=XP+coins) → return with growth →
 *       spend coins to hatch → repeat. Every action shows visible progress.
 */

import { CRITTERS, PALS, EVO_XP, RARITY, HATCH_POOL, stageFor } from './data/creatures.js';
import { drawPix, drawCentered } from './render/pixel.js';
import { lineFor } from './data/dialogue.js';
import * as Save from './systems/save.js';
import { createFarm, AVATAR_KEY } from './systems/farm.js';
import { createRunner } from './systems/run.js';
import { createWhack } from './systems/whack.js';
import { createMusic } from './audio/music.js';
import { createSfx } from './audio/sfx.js';
import { ensureDaily, getDaily, addProgress, claim as claimDaily } from './systems/daily.js';
import {
  hatchEgg, directBuy, EGG_COST, DIRECT_COST, PITY_LIMIT,
} from './systems/hatch.js';
import {
  renderRoster, renderDex, renderCard, renderScenes, displayName,
  renderAvatarEditor, drawAvatarPreview,
} from './ui/screens.js';

const $ = (id) => document.getElementById(id);

/* ---------- state ---------- */
let state = Save.load();
const persist = () => Save.save(state);

/* ---------- systems ---------- */
const farm = createFarm($('farm'), () => state, onFarmTap);
function onFarmTap(key) {
  if (key === AVATAR_KEY) openAvatar();
  else showCardFor(key);
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
window.addEventListener('resize', () => { farm.resize(); runner.resize(); whack.resize(); });

/* ============================================================
   MINIGAME LIFECYCLE — shared chrome for both games: hide the
   farm UI, summon the cheerleader buddy, start the music.
   ============================================================ */
let runActive = false;
function enterMinigame() {
  $('farmbtns').style.display = 'none';
  document.querySelector('.topbar').style.display = 'none';
  $('dialogue').classList.remove('show');
  $('dailyBanner').style.display = 'none';
  runActive = true;
  startBuddy();
  sfx.resume();
  if (state.settings.musicOn) { music.start(); music.setIntensity(0); }
}
function exitMinigame() {
  $('farmbtns').style.display = 'flex';
  document.querySelector('.topbar').style.display = '';
  $('dailyBanner').style.display = '';
  runActive = false;
  stopBuddy();
  music.stop();
  renderDailyBanner();
}

/* ---------- coin display ---------- */
function syncCoins() {
  $('coinCount').textContent = state.coins;
  $('hatchbtn').disabled = state.coins < EGG_COST;
}

/* ============================================================
   BOOT — name entry on first launch, otherwise straight to farm.
   ============================================================ */
function boot() {
  farm.start();
  ensureDaily(state);
  persist();
  renderDailyBanner();
  syncCoins();
  if (!state.playerName) {
    const ctx = $('noraIntro').getContext('2d');
    drawCentered(ctx, CRITTERS.nora.stages[0], PALS.nora, 96, 6);
    $('nameScreen').classList.add('show');
    $('nameInput').focus();
  } else {
    scheduleDialogue();
  }
}

$('nameGo').addEventListener('click', submitName);
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitName(); });
function submitName() {
  const v = $('nameInput').value.trim().toUpperCase().slice(0, 12);
  state.playerName = v || 'FRIEND';
  persist();
  $('nameScreen').classList.remove('show');
  scheduleDialogue();
}

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
$('playbtn').addEventListener('click', openHub);
$('hubBack').addEventListener('click', () => $('hubScreen').classList.remove('show'));
function openHub() {
  updateHubBuddyName();
  updateMusicToggle();
  $('hubScreen').classList.add('show');
}
$('hubRun').addEventListener('click', () => {
  renderRoster($('roster'), state.roster, startRun);
  $('rosterScreen').classList.add('show');
});
$('hubWhack').addEventListener('click', startWhack);
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

/* ---------- music toggle ---------- */
$('musicToggle').addEventListener('click', () => {
  state.settings.musicOn = !state.settings.musicOn;
  persist();
  updateMusicToggle();
  if (!state.settings.musicOn) music.stop();
  else if (runActive) music.start();
});
function updateMusicToggle() {
  $('musicToggle').textContent = state.settings.musicOn ? '🔊 MUSIC: ON' : '🔇 MUSIC: OFF';
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
  drawCentered(rc, cd.stages[r.stage], PALS[cd.type], 96, 6);
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
function startWhack() {
  $('hubScreen').classList.remove('show');
  $('whack').style.display = 'block';
  enterMinigame();
  whack.start();
}
function endWhack(score) {
  const coins = score * 3;
  const xp = score * 4;
  state.coins += coins;
  const buddy = state.roster.find((r) => r.key === state.buddy) || state.roster[0];
  const before = buddy.stage;
  buddy.xp += xp;
  const after = stageFor(buddy.xp);
  const evolved = after > before;
  if (evolved) buddy.stage = after;
  addProgress(state, 'coins', coins);
  addProgress(state, 'games', 1);
  farm.sync();
  persist();
  syncCoins();

  const cd = CRITTERS[buddy.key];
  $('resTitle').textContent = "TIME'S UP!";
  $('resName').textContent = `${displayName(buddy)} · ${cd.stageNames[buddy.stage]}`;
  $('resStat').innerHTML = `<b>${score}</b> bonks`;
  $('resXP').textContent = '+' + xp + ' XP';
  $('resCoins').textContent = '+' + coins + ' 🪙';
  const rc = $('resCanvas').getContext('2d');
  rc.clearRect(0, 0, 96, 96);
  drawCentered(rc, cd.stages[buddy.stage], PALS[cd.type], 96, 6);
  setTimeout(() => $('results').classList.add('show'), 300);
  pendingEvolve = evolved ? { key: buddy.key, before, after } : null;
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
  const cd = CRITTERS[state.buddy] || CRITTERS.nora;
  const owned = state.roster.find((r) => r.key === state.buddy);
  const c = $('buddyCanvas').getContext('2d');
  c.clearRect(0, 0, 48, 48);
  const bob = Math.abs(Math.sin(now / 130)) * 4; // excited hopping
  drawPix(c, cd.stages[owned ? owned.stage : 0], PALS[cd.type], 0, 4 - bob, 3);
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
$('hatchbtn').addEventListener('click', openHatchMenu);
$('hatchMenuBack').addEventListener('click', () => $('hatchMenu').classList.remove('show'));

function remainingToFind() {
  const owned = new Set(state.roster.map((r) => r.key));
  return HATCH_POOL.filter((k) => !owned.has(k)).length;
}
function openHatchMenu() {
  updatePityHint();
  $('eggRandom').disabled = state.coins < EGG_COST || remainingToFind() === 0;
  $('eggDirect').disabled = state.coins < DIRECT_COST;
  $('eggRandom').textContent = `🥚 RANDOM EGG · ${EGG_COST}`;
  $('eggDirect').textContent = `🎯 PICK A CRITTER · ${DIRECT_COST}`;
  $('directList').classList.remove('show');
  $('directList').innerHTML = '';
  $('hatchMenu').classList.add('show');
}
function updatePityHint() {
  const remaining = remainingToFind();
  if (remaining === 0) {
    $('pityHint').textContent = "You've collected every cobbie! 🎉";
    return;
  }
  const left = PITY_LIMIT - state.pity;
  $('pityHint').textContent =
    left <= 3
      ? `A legendary is guaranteed within ${left} egg${left === 1 ? '' : 's'}!`
      : `A random egg is always someone new — ${remaining} left to find.`;
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
  for (const key of HATCH_POOL) {
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
  if (!result.isDupe) { addProgress(state, 'hatch', 1); persist(); renderDailyBanner(); }
  farm.sync();
  $('hatchReveal').classList.add('show');
  $('hatchDone').style.display = 'block';
}
$('hatchDone').addEventListener('click', () => $('hatch').classList.remove('show'));

/* ============================================================
   COLLECTION (DEX) + CHARACTER CARD
   ============================================================ */
$('dexbtn').addEventListener('click', openDex);
$('dexBack').addEventListener('click', () => $('dexScreen').classList.remove('show'));
function openDex() {
  const total = 1 + HATCH_POOL.filter((k) => k !== 'nora').length;
  const have = new Set(state.roster.map((r) => r.key)).size;
  $('dexCount').textContent = `${have} / ${total} COLLECTED`;
  renderDex($('dexGrid'), state, showCardFor);
  $('dexScreen').classList.add('show');
}

/* ---------- avatar creator ---------- */
$('avatarbtn').addEventListener('click', openAvatar);
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
  renderScenes($('sceneGrid'), state.settings.biome, pickScene); // refresh highlight
}
function openScenes() {
  renderScenes($('sceneGrid'), state.settings.biome, pickScene);
  $('sceneScreen').classList.add('show');
}

function showCardFor(key) {
  const owned = state.roster.find((r) => r.key === key);
  if (!owned) return;
  cardKey = key;
  renderCard($('card'), owned);
  $('card').classList.add('show');
}
let cardKey = null;
$('cardClose').addEventListener('click', () => $('card').classList.remove('show'));

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
   DAILY CHALLENGE — one rotating goal per day, fed by the games.
   ============================================================ */
$('dailyBanner').addEventListener('click', () => {
  const d = getDaily(state);
  if (d.done && !d.claimed) {
    const reward = claimDaily(state);
    if (reward) { state.coins += reward; persist(); syncCoins(); }
    renderDailyBanner();
  }
});
function renderDailyBanner() {
  const d = ensureDaily(state);
  $('dailyText').textContent = d.text;
  $('dailyProg').textContent = d.claimed
    ? 'Done for today ✓'
    : d.done ? 'Complete · tap to claim' : `${d.progress} / ${d.target}`;
  $('dailyClaim').textContent = `+${d.reward}🪙`;
  $('dailyBanner').classList.toggle('done', d.done && !d.claimed);
  $('dailyBanner').classList.toggle('claimed', d.claimed);
}

/* ---------- go ---------- */
boot();
