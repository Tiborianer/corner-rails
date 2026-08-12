# Corner Rails

A playable Germany-first incremental station game built as a private Sites/Vinext app with React, TypeScript, React Three Fiber, Three.js, and Drei.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Add `?debug=1` to reveal deterministic Tier 5, night, rain, dirt, ICE-S, and BR 01 QA controls.

## Validate

```bash
npm test
npm run lint
```

Regenerate the original complete low-poly GLB train consists with:

```bash
npm run assets:generate
```

## Project map

- `app/CornerRails.tsx` — responsive HUD and game orchestration.
- `app/game/simulation.ts` — deterministic serializable simulation.
- `app/game/data.ts` — economy, systems, missions, and 20 sourced train records.
- `app/game/Scene.tsx` — locked isometric R3F diorama.
- `app/game/save.ts` — versioned base64url save codes with integrity checking.
- `scripts/generate-train-assets.mjs` — original complete-consist GLB asset pipeline.
- `docs/` — design, balance, sources, onboarding, asset inventory, and QA.

There is intentionally no autosave, local storage, backend, account, or offline income. Copy the in-game save code before closing the page.
