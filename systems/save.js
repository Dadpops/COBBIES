/**
 * PERSISTENCE
 * -----------
 * The prototype had NO save — this closes that gap. Everything the player
 * accumulates lives in one JSON blob in localStorage: roster (per-creature
 * XP/stage/nickname), coins, player name, the pity counter, and settings.
 *
 * `load()` returns a fully-formed state (defaults + migration applied), so
 * the rest of the game can assume every field exists.
 */

import { stageFor } from '../data/creatures.js';
import { defaultAvatar } from '../data/avatar.js';
import { ranchLevelFor } from './ranch.js';

const KEY = 'cobbies.save.v1';

/**
 * @typedef {Object} OwnedCreature
 * @property {string} key       species key into CRITTERS
 * @property {number} xp
 * @property {number} stage
 * @property {string|null} nickname  player-chosen name, or null for default
 */

/**
 * @typedef {Object} GameState
 * @property {string|null} playerName
 * @property {number} coins
 * @property {OwnedCreature[]} roster
 * @property {number} pity        hatches since last legendary
 * @property {{muted:boolean}} settings
 */

/** Brand-new player: Nora is the gift; two starters keep the farm warm. */
export function defaultState() {
  const roster = [
    { key: 'nora', xp: 40, stage: 0, nickname: null, hat: null },
    { key: 'pup',  xp: 60, stage: 0, nickname: null, hat: null },
    { key: 'frog', xp: 30, stage: 0, nickname: null, hat: null },
  ];
  roster.forEach((r) => (r.stage = stageFor(r.xp)));
  return {
    playerName: null,
    coins: 40,
    roster,
    pity: 0,
    capacity: 8,   // ranch starts small; expand it with idle coins
    ranchLevelSeen: 1, // highest ranch level whose rewards were granted (see systems/ranch.js)
    homeCritters: roster.map((r) => r.key), // which critters wander the home farm (max 10)
    avatar: defaultAvatar(),
    buddy: 'nora',
    dailies: null, // filled in by ensureDaily() on boot (one challenge per minigame)
    stations: { berry: { key: null, since: 0 }, pond: { key: null, since: 0 }, lookout: { key: null, since: 0 } },
    stats: { games: 0, whackHits: 0, hatches: 0, runBest: 0, whackBest: 0, // lifetime counters for goals
      catchHits: 0, fishHits: 0, rhythmHits: 0, catchBest: 0, fishBest: 0, rhythmBest: 0,
      coinsEarned: 0 }, // lifetime gross coins earned (Town Board)
    hammer: 'wood',           // equipped whack mallet skin
    ownedHammers: ['wood'],   // unlocked mallet skins (default is free)
    ownedHats: [],            // hats bought in the shop
    goalsClaimed: [],         // ids of completed+claimed goals
    unlockedBiomes: ['meadow'], // scenes unlocked via goals
    tutorialSeen: false,        // first-launch "how to play" walkthrough
    settings: { musicOn: true, musicDynamic: true, volume: 0.7, track: 0, biome: 'meadow' },
  };
}

/** Load and normalise saved state, or return a fresh default. */
export function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // localStorage blocked (private mode / file://) — run ephemerally.
    return defaultState();
  }
  if (!raw) return defaultState();

  try {
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch {
    return defaultState();
  }
}

/** Persist state. Failures are swallowed — the game stays playable. */
export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / access errors */
  }
}

/** Wipe the save (used by a future "reset" affordance / debugging). */
export function reset() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Fill in any missing fields so old saves keep working as the schema grows. */
function migrate(s) {
  const base = defaultState();
  const state = {
    ...base,
    ...s,
    avatar: { ...base.avatar, ...(s.avatar || {}) },
    stations: { ...base.stations, ...(s.stations || {}) },
    stats: { ...base.stats, ...(s.stats || {}) },
    ownedHats: Array.isArray(s.ownedHats) ? s.ownedHats : [],
    hammer: s.hammer || 'wood',
    ownedHammers: Array.isArray(s.ownedHammers) && s.ownedHammers.length ? s.ownedHammers : ['wood'],
    goalsClaimed: Array.isArray(s.goalsClaimed) ? s.goalsClaimed : [],
    // existing saves keep access to every scene; new games start with meadow only
    unlockedBiomes: Array.isArray(s.unlockedBiomes) ? s.unlockedBiomes : ['meadow', 'desert', 'snow', 'dusk'],
    settings: { ...base.settings, ...(s.settings || {}) },
  };
  if (!Array.isArray(state.roster) || state.roster.length === 0) {
    state.roster = base.roster;
  }
  // never strand an existing collection: capacity is at least what they hold
  state.capacity = Math.max(s.capacity ?? 8, state.roster.length);
  // home critters: keep valid owned keys, default to the first 10 owned
  const ownedKeys = new Set(state.roster.map((r) => r.key));
  let home = Array.isArray(s.homeCritters) ? s.homeCritters.filter((k) => ownedKeys.has(k)) : null;
  if (!home || !home.length) home = state.roster.slice(0, 10).map((r) => r.key);
  state.homeCritters = home.slice(0, 10);
  state.roster = state.roster.map((r) => ({
    key: r.key,
    xp: r.xp | 0,
    nickname: r.nickname ?? null,
    hat: r.hat ?? null,
    stage: stageFor(r.xp | 0),
  }));
  // Saves predating ranch levels start "caught up" — no retroactive bonus/celebration.
  state.ranchLevelSeen = s.ranchLevelSeen ?? ranchLevelFor(state.roster.length);
  return state;
}
