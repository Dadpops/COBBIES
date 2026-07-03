# 🐾 COBBIES — A Cozy Creature Ranch

A mobile-first, portrait, one-thumb creature ranch. Collect 150 pixel critters,
raise them through evolution stages, run little one-button minigames, and grow a
calm, warm idle homestead. Tamagotchi-meets-endless-runner — low-pressure and cozy.

### ▶️ [**Play it live → dadpops.github.io/cobbies**](https://dadpops.github.io/cobbies/)

Runs in any modern browser; best on a phone (add it to your home screen — it's an
installable PWA). Your progress saves automatically in the browser.

---

## How to play

The whole game is one gentle loop, and a **guided tutorial** walks you through it
on first launch (tap the **❓** in the top bar to replay it anytime):

1. **Meet your cobbies.** A few critters roam your ranch and greet you by name.
   Tap any one to open its card.
2. **Play for XP + coins.** Tap **▶ PLAY** and pick a minigame:
   - 🏃 **Runner** — one-tap jumping; the farther you go, the more you earn.
   - 🔨 **Whack-a-Cobbie** — bonk the pop-ups for 30 seconds as it speeds up.

   Choose a star cobbie to level up, plus a **cheerleader buddy** who cheers from
   the sideline.
3. **Grow & evolve.** XP pushes each cobbie through evolution stages, with a
   dedicated reveal moment when they transform.
4. **Hatch new friends** at the 🥚 **Nest** — a rarity-weighted random egg (with a
   pity timer that guarantees legendaries) or a direct pick. Duplicates bank bonus XP.
5. **Put cobbies to work** at the 🚜 **Barn** — station them at the Berry Patch,
   Fishing Hole, or Lookout to earn coins over time, even while you're away.
   Collect the coins and **expand your ranch** to hold more critters.
6. **Spend & customise** — buy **hats** and expansions in the **Shop**, dress up your
   own avatar at the **Wardrobe**, and browse everyone you've found in the **Pen**.
7. **Chase goals** — a ⭐ **daily challenge** plus long-term goals reward coins,
   hats, more ranch space, and new **scenes** (biomes) for your ranch.

## Features

- **150 collectible critters** across common / rare / legendary tiers, each with
  three evolution stages, rarity, and flavor text.
- **Two one-thumb minigames** (endless Runner + Whack-a-Cobbie) that both feed XP
  and coins back into the collection.
- **Idle economy** — station critters at jobs for offline coin accrual (capped so
  it stays idle-friendly), then reinvest into ranch capacity.
- **Hatchery** with rarity weighting, pity, and direct buy; dupes convert to XP.
- **4 biomes** — Meadow, Desert, Snowfield, and Dusk — each with its own sky, sun
  or moon and stars, parallax hills, **drifting clouds**, decor, and ambient
  particles (snow / fireflies).
- **Cosmetics** — 7 hats to buy and equip on any critter.
- **Avatar creator** — customise your on-ranch character (skin, hair, outfit…).
- **Nora**, your hand-authored guide, plus a weighted home-dialogue voice so
  captured cobbies greet you by name.
- **Goals & dailies** — a retention ladder that unlocks hats, capacity, and biomes.
- **Music & SFX** with a settings panel (track, volume, dynamic tempo, mute).
- **Guided tutorial** — a first-launch spotlight walkthrough of every feature,
  reopenable anytime.
- **Persistent save** (localStorage) and an **installable PWA** manifest.

## Running locally

The game uses native ES modules, so it must be served over HTTP (opening
`index.html` via `file://` will fail on module imports). Any static server works:

```bash
npm run dev
# or, without Node:
python -m http.server 8000
```

Then open the printed URL (e.g. http://localhost:8000).

## Project structure

```
index.html            shell + all screen/overlay markup
main.js               orchestrator: state, screen flow, tutorial, wiring
css/styles.css        all styles
manifest.webmanifest  PWA manifest
data/
  creatures.js        content spine — sprites, palettes, stages, rarity, flavor
  creatures_extra.js  additional hand/authored critter art
  generator.js        procedural sprite-bank generation (scales to 150)
  biomes.js           selectable scenes (sky, hills, clouds, decor, particles)
  cosmetics.js        wearable hats (pixel overlays)
  avatar.js           the player-avatar sprite + options
  dialogue.js         companion lines (Nora sets the tone)
render/
  pixel.js            the shared grid+palette pixel renderer
  critter.js          critter drawing (sprite + equipped hat)
systems/
  save.js             localStorage persistence (roster, coins, name, pity, flags)
  hatch.js            egg economy: random roll + pity + direct buy
  farm.js             ranch home scene — buildings, wandering critters, backgrounds
  run.js              one-button endless runner
  whack.js            whack-a-cobbie minigame
  idle.js             station/jobs idle economy + ranch capacity
  quests.js           lifetime goals ladder
  daily.js            daily challenge
audio/
  music.js            background music tracks
  sfx.js              sound effects
ui/
  screens.js          roster select, collection/dex, character card, pickers
scripts/
  gen-icons.mjs       icon/asset generation
```

## Roadmap note on TypeScript

Modules are plain JS with JSDoc types today. Migrating to TypeScript + Vite
later is mostly mechanical: add `tsconfig`, rename `.js`→`.ts`, and the JSDoc
shapes (`GameState`, `OwnedCreature`, `HatchResult`) become real interfaces.

See [`cobbiesdraft.md`](cobbiesdraft.md) for the original product brief.
