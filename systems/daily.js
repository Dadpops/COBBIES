/**
 * DAILY CHALLENGES — one rotating goal per calendar day, chosen
 * deterministically from the date so it's stable across reloads. Progress is
 * fed from the minigames; completing it lets the player claim a coin reward.
 * A new day resets to a fresh challenge automatically.
 */

const TEMPLATES = [
  { id: 'run',   metric: 'runDist',   mode: 'max', target: 400, reward: 60, text: 'Reach {t}m in a single run' },
  { id: 'whack', metric: 'whackHits', mode: 'add', target: 20,  reward: 60, text: 'Bonk {t} cobbies in Whack' },
  { id: 'games', metric: 'games',     mode: 'add', target: 3,   reward: 50, text: 'Play {t} minigames' },
  { id: 'coins', metric: 'coins',     mode: 'add', target: 150, reward: 55, text: 'Earn {t} coins today' },
  { id: 'hatch', metric: 'hatch',     mode: 'add', target: 1,   reward: 50, text: 'Hatch a brand-new cobbie' },
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

/** Make sure state.daily matches today; roll a new one if the day changed. */
export function ensureDaily(state) {
  const key = todayKey();
  if (!state.daily || state.daily.date !== key) {
    const t = TEMPLATES[hash(key) % TEMPLATES.length];
    state.daily = { date: key, id: t.id, progress: 0, claimed: false };
  }
  return getDaily(state);
}

/** The resolved challenge for display. */
export function getDaily(state) {
  const t = TEMPLATES.find((x) => x.id === state.daily.id) || TEMPLATES[0];
  const progress = Math.min(state.daily.progress, t.target);
  return {
    id: t.id, reward: t.reward, target: t.target,
    text: t.text.replace('{t}', t.target),
    progress, done: state.daily.progress >= t.target, claimed: state.daily.claimed,
  };
}

/** Feed progress for a metric. Returns true if this challenge cared about it. */
export function addProgress(state, metric, amount) {
  ensureDaily(state);
  const t = TEMPLATES.find((x) => x.id === state.daily.id);
  if (!t || t.metric !== metric || state.daily.claimed) return false;
  if (t.mode === 'max') state.daily.progress = Math.max(state.daily.progress, amount);
  else state.daily.progress += amount;
  return true;
}

/** Claim the reward if complete and unclaimed. Returns coins awarded (0 if none). */
export function claim(state) {
  ensureDaily(state);
  const d = getDaily(state);
  if (d.done && !state.daily.claimed) {
    state.daily.claimed = true;
    return d.reward;
  }
  return 0;
}
