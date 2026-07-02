# COBBIES

A mobile-first, portrait, one-thumb creature-collector. Collect pixel critters,
grow them through evolution stages, and run a one-button endless runner that
feeds XP and coins back into the collection. Calm, warm, low-pressure —
Tamagotchi-meets-endless-runner.

See [`cobbiesdraft.md`](cobbiesdraft.md) for the full product brief.

## Running

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
index.html          shell + all screen/overlay markup
main.js             orchestrator: state, screen flow, wiring
css/styles.css      all styles
data/
  creatures.js      the content bank — sprites, palettes, stages, rarity, flavor
  dialogue.js       companion lines (Nora sets the tone)
render/
  pixel.js          the shared grid+palette pixel renderer
systems/
  save.js           localStorage persistence (roster, coins, name, pity)
  hatch.js          egg economy: random roll + pity + direct buy
  farm.js           2.5D iso home scene, wandering + depth sort
  run.js            one-button endless runner
ui/
  screens.js        roster select, collection/dex, character card
```

## What's built (playable vertical slice)

- **Phase 0** — modular split, save/persistence, first-launch name entry.
- **Core loop** — farm → pick runner → run → return with growth → hatch → repeat.
- **Collection** — dex with locked silhouettes, tappable character cards, rename.
- **Evolution** — dedicated reveal moment on threshold crossing.
- **Hatchery** — random egg (rarity-weighted) + pity + direct buy; dupes bank XP.
- **Nora** — hand-authored hero (orange, black stripes, tan mane), name entry
  guide, and weighted home-dialogue voice.

## Not yet built (see brief)

- Phase 3 content scale (creature-bank pipeline decision), biomes.
- Phase 4 retention economy (dailies/weeklies) — recommended fast-follow.
- Phase 5 audio (music + SFX, mute toggle).

## Roadmap note on TypeScript

Modules are plain JS with JSDoc types today. Migrating to TypeScript + Vite
later is mostly mechanical: add `tsconfig`, rename `.js`→`.ts`, and the JSDoc
shapes (`GameState`, `OwnedCreature`, `HatchResult`) become real interfaces.
