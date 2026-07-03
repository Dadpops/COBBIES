/**
 * GOALS — the progression spine. A ladder of milestones that reward coins,
 * hats, new scenes, or ranch space. Progress is derived from live state and
 * lifetime stats, so goals tick up as you play; completing one lets you
 * CLAIM its reward. This is what makes the loop feel like working toward
 * unlocks: come in, do challenges, cash the reward, chase the next tier.
 */

import { HATS } from '../data/cosmetics.js';
import { BIOMES } from '../data/biomes.js';
import { HAMMERS } from '../data/hammers.js';

const METRICS = {
  collected: (s) => s.roster.length,
  capacity: (s) => s.capacity,
  prime: (s) => s.roster.filter((r) => r.stage >= 2).length,
  games: (s) => s.stats.games,
  whacks: (s) => s.stats.whackHits,
  whackBest: (s) => s.stats.whackBest || 0,
  hatches: (s) => s.stats.hatches,
  runBest: (s) => s.stats.runBest,
};

// Lifetime achievements — each rewards an UNLOCK (hat / scene / ranch space).
export const GOALS = [
  { id: 'c5',    text: 'Collect 5 critters',        metric: 'collected', target: 5,   reward: { type: 'hat', id: 'flower' } },
  { id: 'p3',    text: 'Play 3 minigames',          metric: 'games',     target: 3,   reward: { type: 'hat', id: 'cap' } },
  { id: 'c10',   text: 'Collect 10 critters',       metric: 'collected', target: 10,  reward: { type: 'capacity', amount: 3 } },
  { id: 'cap12', text: 'Expand ranch to 12 space',  metric: 'capacity',  target: 12,  reward: { type: 'biome', id: 'desert' } },
  { id: 'w40',   text: 'Bonk 40 cobbies total',     metric: 'whacks',    target: 40,  reward: { type: 'hat', id: 'bow' } },
  { id: 'r400',  text: 'Reach 400m in one run',     metric: 'runBest',   target: 400, reward: { type: 'hat', id: 'party' } },
  { id: 'prime1',text: 'Evolve a critter to PRIME', metric: 'prime',     target: 1,   reward: { type: 'hat', id: 'crown' } },
  { id: 'c20',   text: 'Collect 20 critters',       metric: 'collected', target: 20,  reward: { type: 'biome', id: 'snow' } },
  { id: 'cap20', text: 'Expand ranch to 20 space',  metric: 'capacity',  target: 20,  reward: { type: 'biome', id: 'dusk' } },
  { id: 'h10',   text: 'Hatch 10 critters',         metric: 'hatches',   target: 10,  reward: { type: 'hat', id: 'straw' } },
  { id: 'c40',   text: 'Collect 40 critters',       metric: 'collected', target: 40,  reward: { type: 'hat', id: 'tophat' } },
  { id: 'g15',   text: 'Play 15 minigames',         metric: 'games',     target: 15,  reward: { type: 'capacity', amount: 5 } },
  // Whack-a-Cobbie hammer skins — unlocked by bonking milestones + single-round scores.
  { id: 'ham_steel', text: 'Bonk 120 cobbies total',       metric: 'whacks',    target: 120, reward: { type: 'hammer', id: 'steel' } },
  { id: 'ham_candy', text: 'Score 25 in one Whack round',  metric: 'whackBest', target: 25,  reward: { type: 'hammer', id: 'candy' } },
  { id: 'ham_stone', text: 'Bonk 300 cobbies total',       metric: 'whacks',    target: 300, reward: { type: 'hammer', id: 'stone' } },
  { id: 'ham_gold',  text: 'Score 40 in one Whack round',  metric: 'whackBest', target: 40,  reward: { type: 'hammer', id: 'gold' } },
  { id: 'ham_mega',  text: 'Bonk 600 cobbies total',       metric: 'whacks',    target: 600, reward: { type: 'hammer', id: 'mega' } },
];

export function goalValue(state, goal) { return METRICS[goal.metric](state); }
export function goalProgress(state, goal) { return Math.min(goal.target, goalValue(state, goal)); }
export function goalDone(state, goal) { return goalValue(state, goal) >= goal.target; }
export function goalClaimed(state, goal) { return state.goalsClaimed.includes(goal.id); }

export function rewardText(reward) {
  if (reward.type === 'coins') return `+${reward.amount} 🪙`;
  if (reward.type === 'hat') return `🎩 ${HATS[reward.id]?.name || reward.id}`;
  if (reward.type === 'hammer') return `🔨 ${HAMMERS[reward.id]?.name || reward.id}`;
  if (reward.type === 'biome') return `🗺️ ${BIOMES[reward.id]?.name || reward.id}`;
  if (reward.type === 'capacity') return `+${reward.amount} space`;
  return '';
}

/** Apply a completed goal's reward. Returns the reward, or null if not ready. */
export function claimGoal(state, goal) {
  if (!goalDone(state, goal) || goalClaimed(state, goal)) return null;
  const r = goal.reward;
  if (r.type === 'coins') state.coins += r.amount;
  else if (r.type === 'hat') { if (!state.ownedHats.includes(r.id)) state.ownedHats.push(r.id); }
  else if (r.type === 'hammer') { if (!state.ownedHammers.includes(r.id)) state.ownedHammers.push(r.id); }
  else if (r.type === 'biome') { if (!state.unlockedBiomes.includes(r.id)) state.unlockedBiomes.push(r.id); }
  else if (r.type === 'capacity') state.capacity += r.amount;
  state.goalsClaimed.push(goal.id);
  return r;
}

export function anyGoalClaimable(state) {
  return GOALS.some((g) => goalDone(state, g) && !goalClaimed(state, g));
}
