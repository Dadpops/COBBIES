/**
 * RANCH LEVELS — the ranch grows more lived-in as your collection grows.
 * Purely gated on how many cobbies you've COLLECTED (roster size), so it ticks
 * up naturally as you play, independent of the coin economy. Each level also
 * grants a one-time capacity bonus (more room on the ranch) and, in farm.js,
 * a new layer of scenery: a rural homestead slowly becomes a lit-up city.
 *
 * The level is derived from `collected`; `ranchLevelSeen` remembers the highest
 * level whose rewards were already granted, so a level-up fires exactly once.
 */

/**
 * @typedef {Object} RanchTier
 * @property {number} level
 * @property {number} need     collected cobbies required
 * @property {number} capBonus one-time ranch-capacity bonus on reaching it
 * @property {string} name
 * @property {string} adds     short description of what appears at this level
 */

/** @type {RanchTier[]} — level 1 is the starting homestead (no bonus). */
export const RANCH_TIERS = [
  { level: 1, need: 0,   capBonus: 0, name: 'HOMESTEAD',   adds: 'a cozy little ranch' },
  { level: 2, need: 10,  capBonus: 2, name: 'PAVED PATH',  adds: 'a paved road and a fence' },
  { level: 3, need: 25,  capBonus: 3, name: 'GARDEN PLOTS', adds: 'crop rows and a first neighbour' },
  { level: 4, need: 45,  capBonus: 3, name: 'VILLAGE',      adds: 'a cluster of cottages' },
  { level: 5, need: 70,  capBonus: 4, name: 'STREET LAMPS', adds: 'warm street lamps along the road' },
  { level: 6, need: 100, capBonus: 5, name: 'TOWN',         adds: 'townhouses on the horizon' },
  { level: 7, need: 130, capBonus: 6, name: 'CITY LIGHTS',  adds: 'a distant skyline that lights up' },
  { level: 8, need: 150, capBonus: 8, name: 'METROPOLIS',   adds: 'a full glittering city' },
];

/** Highest tier whose `need` is met by `collected`. Returns a level 1–8. */
export function ranchLevelFor(collected) {
  let lv = 1;
  for (const t of RANCH_TIERS) if (collected >= t.need) lv = t.level;
  return lv;
}

/** The tier record for a given level (falls back to level 1). */
export function ranchTier(level) {
  return RANCH_TIERS.find((t) => t.level === level) || RANCH_TIERS[0];
}

/** The next tier not yet reached, or null if maxed. */
export function nextRanchTier(collected) {
  return RANCH_TIERS.find((t) => t.need > collected) || null;
}

/**
 * Reconcile ranch level with the current collection. Grants the one-time
 * capacity bonus for every newly-passed tier and advances ranchLevelSeen.
 * @returns {{ leveledUp: boolean, level: number, from: number, gained: RanchTier[] }}
 */
export function applyRanchLevel(state) {
  const level = ranchLevelFor(state.roster.length);
  const seen = state.ranchLevelSeen || 1;
  if (level <= seen) return { leveledUp: false, level, from: seen, gained: [] };

  const gained = RANCH_TIERS.filter((t) => t.level > seen && t.level <= level);
  for (const t of gained) state.capacity += t.capBonus;
  state.ranchLevelSeen = level;
  return { leveledUp: true, level, from: seen, gained };
}
