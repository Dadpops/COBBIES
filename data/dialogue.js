/**
 * COMPANION DIALOGUE (Phase 2 seed)
 * ---------------------------------
 * Nora sets the emotional register — warm, playful, encouraging, never
 * nagging — and every other voice inherits it. Lines use `{name}` which is
 * replaced with the player's name so the creatures "know you".
 *
 * Keep them sweet. Keep them short. This tone is the brand.
 */

export const DIALOGUE = {
  nora: [
    "Hey {name}! Ready for a run? I'll be cheering.",
    "Morning, {name}. The others have been asking about you.",
    "Did you know? Every step out there makes someone here a little bigger.",
    "You're doing great, {name}. Truly.",
    "Take your time. The ranch isn't going anywhere.",
  ],
  pup: [
    "{name}! {name}! Did you see me run?? Did you??",
    "I found a stick. It's the best stick. Wanna see?",
  ],
  frog: [
    "The pond's calm today, {name}. Come sit a while.",
    "I remember being small. Growing is nice, isn't it?",
  ],
  cat: [
    "Oh. It's you, {name}. ...I was hoping it would be.",
    "I wasn't waiting for you. I just happened to be here. Hi.",
  ],
  bird: [
    "One day I'll fly so high, {name}. You'll still see me.",
    "Feels like a flying kind of day, doesn't it?",
  ],
  slime: [
    "Boing! Hi {name}! Boing boing!",
    "I glow a little brighter when you visit. Fun fact!",
  ],
};

/** Pick a line for a species, with the player's name spliced in. */
export function lineFor(key, playerName) {
  const pool = DIALOGUE[key] || DIALOGUE.nora;
  const line = pool[(Math.random() * pool.length) | 0];
  return line.replace(/\{name\}/g, playerName || 'friend');
}
