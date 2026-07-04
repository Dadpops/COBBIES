/**
 * IDLE STATIONING — the ranch's idle-game layer. The player "stations" a
 * creature at a task; it earns coins over real time, even while away (offline
 * accrual, capped so it stays idle-friendly not exploit-y). Higher evolution
 * stages earn more. This is the resource engine that funds ranch expansion,
 * which in turn gates how many critters you can hold (see capacity below).
 */

export const STATIONS = [
  { id: 'berry',   name: 'Berry Patch',   emoji: '🫐', base: 8 },
  { id: 'pond',    name: 'Fishing Hole',  emoji: '🎣', base: 10 },
  { id: 'lookout', name: 'Lookout Post',  emoji: '🔭', base: 6 },
];

export const IDLE_CAP_HOURS = 8;   // accrual stops after this long away
const HOUR = 3600000;

/** Coins/hour a creature earns at a station (scales with evolution stage). */
export function rateFor(station, creature) {
  return Math.round(station.base * (1 + creature.stage * 0.6));
}

/** Coins currently waiting at a station. */
export function accruedFor(state, id, now) {
  const s = state.stations[id];
  if (!s || !s.key) return 0;
  const cr = state.roster.find((r) => r.key === s.key);
  if (!cr) return 0;
  const st = STATIONS.find((x) => x.id === id);
  const hrs = Math.min(IDLE_CAP_HOURS, (now - (s.since || now)) / HOUR);
  return Math.floor(rateFor(st, cr) * hrs);
}

/** Total across all stations (for the "while you were away" summary). */
export function totalAccrued(state, now) {
  return STATIONS.reduce((sum, st) => sum + accruedFor(state, st.id, now), 0);
}

/** Current passive income rate in coins/hour across all stationed critters. */
export function incomeRate(state) {
  return STATIONS.reduce((sum, st) => {
    const s = state.stations[st.id];
    const cr = s && s.key ? state.roster.find((r) => r.key === s.key) : null;
    return cr ? sum + rateFor(st, cr) : sum;
  }, 0);
}

export function collectOne(state, id, now) {
  const c = accruedFor(state, id, now);
  if (c > 0) { state.coins += c; state.stations[id].since = now; }
  return c;
}

export function collectAll(state, now) {
  return STATIONS.reduce((sum, st) => sum + collectOne(state, st.id, now), 0);
}

export function assign(state, id, key, now) {
  // a creature can only be at one station — pull it off any other first
  for (const st of STATIONS)
    if (state.stations[st.id] && state.stations[st.id].key === key)
      state.stations[st.id] = { key: null, since: 0 };
  state.stations[id] = { key, since: now };
}

export function unassign(state, id, now) {
  collectOne(state, id, now);          // don't lose pending coins
  state.stations[id] = { key: null, since: 0 };
}

export function stationOf(state, key) {
  const st = STATIONS.find((s) => state.stations[s.id] && state.stations[s.id].key === key);
  return st ? st.id : null;
}

/* ---------- ranch capacity (gates how many critters you can hold) ---------- */

/** Coin cost to expand the ranch by CAP_STEP slots at the current capacity. */
export const CAP_STEP = 2;
export function expandCost(capacity) {
  // Gentle linear ramp. Reaching capacity ~150 (needed to hold all 150 cobbies)
  // costs ~32k total; combined with hatching + the day-capped idle/daily faucets,
  // a full collection paces to ~a month of daily play (see systems/ranch.js bonuses).
  return Math.round(30 + Math.max(0, capacity - 8) * 6);
}
export function canExpand(state) {
  return state.coins >= expandCost(state.capacity);
}
export function expand(state) {
  const cost = expandCost(state.capacity);
  if (state.coins < cost) return false;
  state.coins -= cost;
  state.capacity += CAP_STEP;
  return true;
}
export function isFull(state) {
  return state.roster.length >= state.capacity;
}
