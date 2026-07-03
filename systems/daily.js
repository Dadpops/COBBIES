/**
 * DAILY CHALLENGES — one per minigame, each rerolled every calendar day
 * (deterministically from the date, so it's stable across reloads) and claimed
 * independently. Progress is fed from the minigames via addProgress(metric).
 *
 * state.dailies = { date, items: { <gameId>: { variant, progress, claimed } } }
 */

const GAMES = [
  { id: 'run',    metric: 'runDist',    mode: 'max', emoji: '🏃', name: 'Runner',
    variants: [{ t: 300, r: 45 }, { t: 450, r: 60 }, { t: 650, r: 80 }], text: (t) => `Reach ${t}m in a single run` },
  { id: 'whack',  metric: 'whackHits',  mode: 'add', emoji: '🔨', name: 'Whack',
    variants: [{ t: 15, r: 45 }, { t: 25, r: 60 }, { t: 35, r: 75 }], text: (t) => `Bonk ${t} cobbies in Whack` },
  { id: 'catch',  metric: 'catchHits',  mode: 'add', emoji: '🧺', name: 'Catch',
    variants: [{ t: 15, r: 45 }, { t: 25, r: 60 }, { t: 35, r: 75 }], text: (t) => `Catch ${t} treats in Catch` },
  { id: 'fish',   metric: 'fishHits',   mode: 'add', emoji: '🎣', name: 'Fishing',
    variants: [{ t: 6, r: 45 }, { t: 10, r: 60 }, { t: 14, r: 75 }], text: (t) => `Hook ${t} fish` },
  { id: 'rhythm', metric: 'rhythmHits', mode: 'add', emoji: '🎵', name: 'Rhythm',
    variants: [{ t: 20, r: 45 }, { t: 35, r: 60 }, { t: 50, r: 80 }], text: (t) => `Score ${t} in Rhythm` },
];

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function freshItem(key, g) {
  return { variant: hash(key + g.id) % g.variants.length, progress: 0, claimed: false };
}

/** Ensure state.dailies matches today; roll a fresh challenge per game if the day changed. */
export function ensureDaily(state) {
  const key = todayKey();
  if (!state.dailies || state.dailies.date !== key) {
    const items = {};
    for (const g of GAMES) items[g.id] = freshItem(key, g);
    state.dailies = { date: key, items };
  } else {
    // backfill any game added since this save was written
    for (const g of GAMES) if (!state.dailies.items[g.id]) state.dailies.items[g.id] = freshItem(key, g);
  }
  return getDailies(state);
}

function resolve(g, item) {
  const v = g.variants[item.variant] || g.variants[0];
  return {
    id: g.id, emoji: g.emoji, name: g.name, reward: v.r, target: v.t,
    text: g.text(v.t),
    progress: Math.min(item.progress, v.t),
    done: item.progress >= v.t, claimed: item.claimed,
  };
}

/** Resolved challenges (one per game) for display. */
export function getDailies(state) {
  return GAMES.map((g) => resolve(g, state.dailies.items[g.id]));
}

/** Feed a metric into whichever daily cares about it (harmless no-op otherwise). */
export function addProgress(state, metric, amount) {
  ensureDaily(state);
  for (const g of GAMES) {
    if (g.metric !== metric) continue;
    const item = state.dailies.items[g.id];
    if (item.claimed) continue;
    if (g.mode === 'max') item.progress = Math.max(item.progress, amount);
    else item.progress += amount;
  }
}

/** Claim one game's daily reward. Returns coins awarded (0 if not claimable). */
export function claim(state, gameId) {
  ensureDaily(state);
  const g = GAMES.find((x) => x.id === gameId);
  if (!g) return 0;
  const item = state.dailies.items[gameId];
  const r = resolve(g, item);
  if (r.done && !item.claimed) { item.claimed = true; return r.reward; }
  return 0;
}

/** True if any daily is complete and unclaimed (drives the ⭐ badge). */
export function anyDailyClaimable(state) {
  ensureDaily(state);
  return getDailies(state).some((d) => d.done && !d.claimed);
}
