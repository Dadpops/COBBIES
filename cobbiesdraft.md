# COBBIES — Build Brief

A mobile-first, portrait, one-thumb creature-collector game. Validated as a single-file
HTML prototype (working title "Critter Ranch"); this brief hands it off to a real project.
Paste this as the opening context for a Claude Code session, then build in phases.

---

## 1. The product in one paragraph

You collect cute pixel creatures, grow them through evolution stages, and use them to run
a dead-simple one-button endless runner. The runner is an XP-and-coin faucet; the actual
product is the collection and the creatures' presence in a home space you own. Retention
comes from wanting to complete the set and from the creatures feeling like companions who
know you by name. Calm, warm, low-pressure. Think Tamagotchi-meets-endless-runner.

## 2. The core loop (this is what must stay fun)

Home / farm (see your creatures wandering) → pick a runner → run (distance = XP + coins)
→ return with visible growth (XP banked, evolution at thresholds) → spend coins to hatch
new creatures → repeat. Every action must produce visible progress. No dead pulls, no
grind that feels like grind.

## 3. Architecture (split the monolith on day one)

The prototype is one HTML file. Restructure into modules before adding features:

- `data/creatures.js` — creature definitions: sprite grids, palettes, evolution stages,
  stage names, rarity tier. This is the content bank; it will grow large, keep it isolated.
- `systems/run.js` — the endless runner (physics, obstacles, spawn, collision, escalation).
- `systems/farm.js` — the 2.5D iso home scene, wandering critters, depth sorting.
- `systems/hatch.js` — egg economy, rarity roll, dupe handling.
- `systems/save.js` — persistence (localStorage for web; the prototype had NONE — this is
  the first real gap to close). Roster, coins, player name, unlocked set, daily state.
- `ui/` — screens: roster select, collection/dex, character card, evolution, name entry,
  home dialogue.
- `render/pixel.js` — the shared grid+palette pixel renderer (already exists, extract it).
- `audio/` — music + sfx.

Use git from commit one. Every phase below is a branch/PR so nothing is destructive.

## 4. Design decisions already made (don't re-litigate these)

- **One-button runner, feet planted on ground, gentle capped speed ramp.** Validated.
- **Two currencies:** XP grows individuals, coins expand the roster. Same run pays both.
- **Dupes are never dead:** a duplicate hatch awards XP to the owned creature.
- **Anti-frustration is a core value:** every action shows progress.

## 5. Phased roadmap (sequenced by dependency and value, NOT by the order asks arrived)

**Phase 0 — Foundation (do before any feature).**
Split the monolith per section 3. Add save/persistence. Add player-name entry on first
launch (stored, used everywhere). This unblocks everything else.

**Phase 1 — Collection core (the actual product).**
- Collection / "dex" page: grid of all creatures, unlocked shown, locked as silhouettes
  with a "?" so players know what's left to catch.
- Character card: tap any creature (in dex or farm) to see a card — sprite, name, stage,
  XP, rarity, a short flavor line.
- Evolution screen: a dedicated reveal moment (mirror the hatch screen's build-up) when a
  creature crosses a threshold, instead of just a results-card tag.
- Optional naming: let the player rename a creature on hatch or from its card. Keep the
  existing default names (BISCUIT, LILY, MIDNIGHT, PIP, BLOB) as the defaults.

**Phase 2 — Companion warmth (cheap, high emotional payoff).**
- Home-screen dialogue: a random owned critter appears at the top in a speech bubble and
  says an encouraging line or a fun fact, addressing the player by name
  ("Hey Kit, did you know...?"). Rotate lines; keep them sweet, never nagging. Nora (the
  tutorial guide, section 7) is the default/primary voice and sets the tone all others follow.
- Cheerleader buddy: let the player pick a second creature to appear in the top corner
  during a run, reacting/cheering while the chosen creature runs. Reinforces the
  "companions who care" thread.

**Phase 3 — Content scale (the biggest lift — needs a pipeline decision first).**
- Expand the creature bank. SEE SECTION 6 — decide the generation pipeline before setting
  a target count. Add rarity tiers here (common/rare/legendary) which feed the hatch odds.
- Multiple backgrounds/biomes the player can choose, so creatures don't crowd one map.
  Eventually each creature lives in a biome; for now, selectable home scenes.

**Phase 4 — Retention economy (a genre commitment — consider deferring).**
- Rebalance coins: make hatching rarer / coins scarcer than the prototype.
- Daily challenges → weekly meta, as the reason to return and the main coin faucet.
- NOTE: this turns the game into a live-ops product with date-based state, streaks, and
  reward pacing. It's the largest scope item. Recommend proving Phases 1–2 are fun FIRST;
  don't build the re-engagement machine before the thing it re-engages people with is good.

**Phase 5 — Polish.**
- Music: upbeat-but-relaxed synth loop for the whole game (Web Audio or Tone.js). SFX for
  jump, coin, hatch, evolve. Respect a mute toggle and reduced-motion.

## 6. The creature-bank pipeline decision (think about this before Phase 3)

"A huge bank" = hundreds of hand-authored sprite grids (3 per creature). This is a content
problem, not a code problem. Pick an approach before committing to a count:
- **Generate via Claude Code:** fast, but risks visual sameness.
- **Hand-author in Aseprite:** distinctive, slow, doesn't scale cheaply.
- **Hybrid (recommended):** Claude generates the grid from a description, you refine hero
  creatures by hand. Decide which creatures are "hero" (worth hand-polish) vs "filler."
Set a realistic launch count (e.g. 12–16 well-made creatures beats 100 samey ones).

## 7. Nora — the tutorial guide and mascot (player request, elevated)

Add the hero creature: **Nora**, a small **orange dog with black stripes across her back**,
a **tan tuft of hair on her chest and mane**. Design her 3 evolution stages in that palette
(orange body, black stripe accents, tan chest/mane highlight). She is hand-polished, not
generated — she is the face of the game.

Nora's product role: she is the **tutorial guide** and the game's first relationship. Every
player meets her first, so she carries onboarding AND brand. She introduces the loop, teaches
the runner, and reappears as a recurring friendly voice (she's a strong candidate for the
Phase 2 home-screen dialogue critter and cheerleader buddy).

**Voice/tone spec (inherited by all companion dialogue):** warm, playful, encouraging, never
nagging. Nora sets the emotional register for the entire game in the first 30 seconds, and
that tone becomes the template for every dialogue line, challenge prompt, and evolution
message across the roster. Keep it consistent as content scales — it's the brand.

## 8. Existing prototype reference

The validated prototype (single HTML file) demonstrates the working loop, the pixel
renderer, the iso farm, the runner, the hatch flow, and 5 creatures with 3 stages each
(pup, frog, cat, bird, slime). Use it as the source of truth for feel and for the render
method; rebuild its systems into the modular structure above rather than extending the
single file.

## 9. Open questions to resolve with the player

- Random hatch (discovery/excitement) vs a shop where you pick (agency/goal-pursuit)?
  Or both — random eggs plus a pity/direct-buy option?
- Launch creature count and hero-vs-filler split?
- Is the daily/weekly economy launch scope or a fast-follow? (Recommend fast-follow.)
