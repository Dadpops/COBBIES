/**
 * EGG ECONOMY
 * -----------
 * Coins expand the roster. Two ways to spend them (Section 9 decision:
 * "both — random eggs plus a pity/direct-buy option"):
 *
 *   - EGG (random)  : cheaper, a rarity-weighted roll. Discovery/excitement.
 *   - DIRECT BUY    : pricier, pick an exact species. Agency/goal-pursuit.
 *
 * Anti-frustration (a core value): a duplicate is never a dead pull — it
 * banks XP into the creature you already own. And a pity counter guarantees
 * a legendary within PITY_LIMIT random eggs so the tail can't run forever.
 */

import { CRITTERS, HATCH_POOL, RARITY, stageFor } from '../data/creatures.js';

export const EGG_COST = 50;
export const DIRECT_COST = 150;
export const DUPE_XP = 40;
export const PITY_LIMIT = 10; // random eggs without a legendary -> forced

/**
 * @typedef {Object} HatchResult
 * @property {string} key
 * @property {boolean} isDupe
 * @property {boolean} pityTriggered
 * @property {number} awardedXP    XP given to the existing creature if dupe
 */

/**
 * Weighted-random species drawn ONLY from creatures the player doesn't own
 * yet, honouring the pity rule. A random egg is always a new friend — never
 * a duplicate. Returns { key: null } once everything hatchable is collected.
 */
function rollSpecies(state) {
  const owned = new Set(state.roster.map((r) => r.key));
  // only critters your ranch has unlocked (unlockAt <= capacity) and don't own
  const pool = HATCH_POOL.filter(
    (k) => !owned.has(k) && (CRITTERS[k].unlockAt ?? 8) <= state.capacity
  );
  if (!pool.length) return { key: null, pityTriggered: false };

  if (state.pity >= PITY_LIMIT - 1) {
    const legendaries = pool.filter((k) => CRITTERS[k].rarity === 'legendary');
    if (legendaries.length) return { key: pick(legendaries), pityTriggered: true };
  }
  const weighted = [];
  for (const key of pool) {
    const w = RARITY[CRITTERS[key].rarity]?.weight ?? 1;
    for (let i = 0; i < w; i++) weighted.push(key);
  }
  return { key: pick(weighted), pityTriggered: false };
}

function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

/**
 * Spend coins on a random egg and mutate `state` with the result.
 * @returns {HatchResult|null} null if the player can't afford it
 */
export function hatchEgg(state) {
  if (state.coins < EGG_COST) return null;
  const { key, pityTriggered } = rollSpecies(state);
  if (!key) return { allCollected: true }; // nothing new — don't charge

  state.coins -= EGG_COST;
  // Pity tracking: reset on a legendary, otherwise advance.
  if (CRITTERS[key].rarity === 'legendary') state.pity = 0;
  else state.pity += 1;

  return grant(state, key, pityTriggered);
}

/**
 * Spend coins to buy an exact species. Always succeeds (as a hatch) if
 * affordable; a dupe still banks XP so it's never wasted.
 * @returns {HatchResult|null}
 */
export function directBuy(state, key) {
  if (!HATCH_POOL.includes(key)) return null;
  if (state.coins < DIRECT_COST) return null;
  state.coins -= DIRECT_COST;
  return grant(state, key, false);
}

/** Add a species to the roster, or convert a dupe to XP. */
function grant(state, key, pityTriggered) {
  const owned = state.roster.find((r) => r.key === key);
  if (owned) {
    owned.xp += DUPE_XP;
    owned.stage = stageFor(owned.xp);
    return { key, isDupe: true, pityTriggered, awardedXP: DUPE_XP };
  }
  state.roster.push({ key, xp: 0, stage: 0, nickname: null });
  return { key, isDupe: false, pityTriggered, awardedXP: 0 };
}
