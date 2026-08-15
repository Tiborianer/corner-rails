# Railjet visual bake-off

## Open the laboratory

Append `?railjetLab=1` to the game URL. The private comparison route keeps the production Railjet unchanged and exposes formation, method, motion, weather, scale, and 1×/3× load controls. Candidate scoring is deliberately session-only, and no winner is selected automatically.

Tomorrow's Blender candidate can be added as `blender-3d`; the shared data contract already includes that method without requiring a laboratory rewrite.

## Implemented candidates

| Candidate | Rendering method | Classic formation | New-generation formation | Approximate asset size |
|---|---|---:|---:|---:|
| A | Generated transparent 2.5D modules | Taurus + 7 coaches | Locomotive + 9 Viaggio Next Level cars | 196 KB / 172 KB |
| B | Deterministic SVG 2.5D modules | 8 world cards | 10 world cards | 24 KB / 24 KB |
| C | Procedural low-poly GLB | 210.7 m generated bounds | 266.1 m generated bounds | 70 KB / 82 KB |

Candidate A was created with built-in Image Generation as two original five-module sheets, one per generation. The prompt set requested a consistent locked orthographic isometric angle, unbranded Taurus/coach/restaurant/first-class/driving-trailer modules, authentic red/dark-grey/light-grey blocking, recognisable cab and roof-equipment rhythm, a transparent/chroma background, and no logos, text, watermarks, or copied photography. The normalized source frames are under `public/railjet-lab/generated/`; the full source sheets are under `assets/railjet-lab/source/`.

Candidate B is regenerated entirely from `scripts/generate-railjet-vector-assets.mjs`. It intentionally prioritizes tiny downloads, deterministic editing, and crisp mobile silhouettes. The visible gangway joins are its present weakness and should count in user scoring.

Candidate C is regenerated from `scripts/generate-railjet-lab-assets.mjs`. It uses lofted cross-sections, curved roofs, separate cab masks, windscreens, doors, windows, bogies, wheelsets, couplers, underframe equipment, pantographs, roof cabinets, HVAC, and a new-generation low-floor module. Both GLBs are glTF 2.0, Y-up, metre-based, and optimized with shared geometry/materials.

## Rebuild and QA

```sh
npm run assets:railjet-lab
npm test
npm run qa:railjet-contact-sheets
```

`scripts/capture-railjet-lab.mjs` captures all six 390×844 views through a trusted local Chrome DevTools endpoint. The screenshot route also accepts `freeze=1&phase=<seconds>` for deterministic stop/pass frames; this does not change normal laboratory motion.

Automated coverage checks method/generation resolution, exact vehicle counts, relative formation length, transparency and anchors, SVG structure and budgets, GLB hierarchy/materials/bounds/budgets, and continuous map-exit motion. Browser checks cover day, night, rain, stationary, stopping, pass-through, direct URL hydration, 3× simultaneous load, and responsive layout.

## Evidence and current assessment

- [Desktop A/B/C comparison](../qa/railjet-lab/railjet-bakeoff-desktop.jpg)
- [Mobile A/B/C comparison](../qa/railjet-lab/railjet-bakeoff-mobile.jpg)
- [Classic night view](../qa/railjet-lab/classic-generated-night.jpg)
- [New-generation rain/platform view](../qa/railjet-lab/nextgen-hybrid-rain-platform.jpg)
- [Three-train procedural load](../qa/railjet-lab/nextgen-hybrid-three-load.jpg)

The bake-off is ready for blind user review against the locked 50/20/15/10/5 rubric. Candidate A currently has the strongest small-scale surface detail, Candidate B the smallest and most editable assets, and Candidate C the most physically consistent depth and occlusion. These are observations, not a declared winner.

Official research references: [ÖBB fleet overview](https://static.web.oebb.at/konzern/oebb-flotte-2025/4/) and [Siemens new-generation Railjet](https://press.siemens.com/global/en/pressrelease/obb-puts-first-new-generation-railjet-siemens-mobility-service-and-orders-19-more).
