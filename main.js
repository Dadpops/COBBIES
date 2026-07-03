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
const runner = createRunner($('run'), onRunDistance, onRunEnd);
window.addEventListener('resize', () => { farm.resize(); runner.resize(); });

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
   ROSTER SELECT → RUN
   ============================================================ */
$('playbtn').addEventListener('click', () => {
  renderRoster($('roster'), state.roster, startRun);
  $('rosterScreen').classList.add('show');
});
$('rosterBack').addEventListener('click', () => $('rosterScreen').classList.remove('show'));

let activeRunIdx = -1;
let runActive = false;
function startRun(idx) {
  activeRunIdx = idx;
  const r = state.roster[idx];
  $('rosterScreen').classList.remove('show');
  $('run').style.display = 'block';
  $('runhud').classList.add('show');
  $('farmbtns').style.display = 'none';
  document.querySelector('.topbar').style.display = 'none';
  $('dialogue').classList.remove('show');
  runActive = true;
  $('runnerName').textContent = displayName(r);
  runner.start({ key: r.key, stage: r.stage });
}
function onRunDistance(d) { $('dist').textContent = d; }

function onRunEnd(dist) {
  const r = state.roster[activeRunIdx];
  const gainedXP = Math.floor(dist * 0.6);
  const gainedCoins = Math.floor(dist * 0.35);
  state.coins += gainedCoins;
  const before = r.stage;
  r.xp += gainedXP;
  const after = stageFor(r.xp);
  const evolved = after > before;
  if (evolved) r.stage = after;
  farm.sync();
  persist();
  syncCoins();

  // Results card first…
  const cd = CRITTERS[r.key];
  $('resTitle').textContent = 'RUN COMPLETE';
  $('resName').textContent = `${displayName(r)} · ${cd.stageNames[r.stage]}`;
  $('resDist').textContent = dist;
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
  $('runhud').classList.remove('show');
  $('farmbtns').style.display = 'flex';
  document.querySelector('.topbar').style.display = '';
  runActive = false;
  runner.stop();
  if (pendingEvolve) {
    showEvolution(pendingEvolve);
    pendingEvolve = null;
  }
});

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

/* ---------- go ---------- */
boot();
