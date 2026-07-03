/**
 * COSMETICS — wearable hats for critters. Each hat is a tiny 16x16 overlay
 * drawn on top of the creature sprite (mostly empty; a few pixels near the
 * head) with its own little palette. A critter's equipped hat id lives on
 * its roster entry (r.hat); null means bare-headed.
 *
 * Overlay index convention: 1 outline, 2 main, 3 accent.
 */

export const HATS = {
  tophat: {
    name: 'TOP HAT', emoji: '🎩', cost: 140,
    pal: [null, '#111015', '#2b2b33', '#c04a4a'],
    grid: [
      [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
      [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
      [0,0,0,0,1,3,3,3,3,3,3,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
    ],
  },
  cap: {
    name: 'BALL CAP', emoji: '🧢', cost: 60,
    pal: [null, '#16283a', '#3a7ad0', '#eaf2ff'],
    grid: [
      [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
      [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0],
      [0,0,1,1,1,2,2,2,2,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  party: {
    name: 'PARTY HAT', emoji: '🥳', cost: 90,
    pal: [null, '#3a1a4a', '#e85aa0', '#ffd24a'],
    grid: [
      [0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,1,2,1,0,0,0,0,0,0,0],
      [0,0,0,0,0,1,3,2,2,1,0,0,0,0,0,0],
      [0,0,0,0,1,2,2,3,2,2,1,0,0,0,0,0],
      [0,0,0,1,2,3,2,2,2,3,2,1,0,0,0,0],
    ],
  },
  crown: {
    name: 'CROWN', emoji: '👑', cost: 250,
    pal: [null, '#8a6a10', '#ffd24a', '#ff6a6a'],
    grid: [
      [0,0,0,0,2,0,2,0,2,0,2,0,0,0,0,0],
      [0,0,0,0,2,3,2,3,2,3,2,0,0,0,0,0],
      [0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0],
    ],
  },
  flower: {
    name: 'FLOWER', emoji: '🌸', cost: 60,
    pal: [null, '#3a6a3a', '#ff8ab8', '#ffe04a'],
    grid: [
      [0,0,0,2,0,2,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,2,3,2,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  bow: {
    name: 'BOW', emoji: '🎀', cost: 80,
    pal: [null, '#8a2a4a', '#e85a8a', '#ffffff'],
    grid: [
      [0,0,0,0,2,2,0,2,2,0,0,0,0,0,0,0],
      [0,0,0,0,2,2,3,2,2,0,0,0,0,0,0,0],
      [0,0,0,0,0,2,2,2,0,0,0,0,0,0,0,0],
    ],
  },
  straw: {
    name: 'STRAW HAT', emoji: '👒', cost: 110,
    pal: [null, '#8a6a2a', '#e8c86a', '#c04a4a'],
    grid: [
      [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0],
      [0,0,0,1,3,3,3,3,3,3,3,1,0,0,0,0],
      [0,0,1,2,2,2,2,2,2,2,2,2,1,0,0,0],
    ],
  },
};

/** Ordered list for pickers (id + meta). */
export const HAT_LIST = Object.keys(HATS).map((id) => ({ id, ...HATS[id] }));
