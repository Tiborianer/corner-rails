# Living countryside and roadside neighborhood

## Implemented

- 88 seeded, irregularly scattered trees: oak, birch, spruce, poplar and umbrella-shaped pine. Variable scale, crowns and seasonal palettes; three instanced batches rather than individual tree draws.
- Flocks of 3–5 birds cross occasionally during clear daylight. Wing flaps/gliding and two synthesized raspy calls per encounter. Calls use the existing opt-in AudioBus; mute cancels pending bird voices. No simulation-speed pitch changes.
- Two deer occasionally run through a reserved meadow, pause to graze and leave. The corridor is outside tracks, platforms and roads. Birds and deer hide in wet weather and at night. Reduced-motion uses gliding birds and static leg poses rather than flapping/running cycles.
- Road age begins at purchase, advances in simulated time, survives CR1 export/import, resets on road undo and prestige. Old saves default to zero age. No offline growth or economy/RNG effects.
- Four houses reveal at road ages 20, 90, 160 and 230 seconds. At Tier 4+, four apartment buildings follow at 480, 570, 660 and 750 seconds. Three-second reveal per plot, far side of road only. Hedges, driveways, parked vehicle variants and night windows included.
- `scenery` in the existing debug bar prepares the full neighborhood and a daylight wildlife encounter. This is a test preset, not a new progression action.

## Checks and limits

88 automated tests passed, including seeded variety, clear corridors, exclusive far-side plots, gradual growth, tier gates, motion continuity, road purchase/undo, speed scaling and old/new saves. Sites build and rendered-HTML check passed. Changed-file lint checked. TypeScript still reports existing Cloudflare-worker declarations and older test typing errors; no errors remained in the new scenery files.

Local in-app screenshots reviewed at the current 1078×1204 viewport: full Tier 5 neighborhood with deer, flock overhead, settled night with illuminated windows and active trains. No console errors were reported after the corrected module loaded. The initial case-insensitive module-name conflict was corrected by separating `Scenery.tsx` from `environment.ts`. Existing three-dimensional train assets were untouched.

No new mobile-device FPS benchmark or audio listening test is claimed. Browser evidence was captured inline in the task. The legacy debug scene and train laboratories retain their prior scenery. Bears, pedestrians, cycle racks and flowerbeds are not included in this pass.
