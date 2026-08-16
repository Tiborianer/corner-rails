# Railjet visual bake-off

## Open the laboratory

Append `?railjetLab=1` to the game URL. The private comparison route exposes formation, method, motion, weather, scale, and 1×/3× load controls. Candidate scoring remains session-only comparison evidence.

Candidate D was explicitly selected and is now the production Railjet path. The normal game and laboratory load the same canonical files under `public/models/trains/blender/railjet/`. The old `public/models/trains/railjet.glb` remains unchanged as a rollback artifact. For a focused approval view, use `?trainLab=railjet&variant=railjet-classic` or `?trainLab=railjet&variant=railjet-nextgen`.

## Implemented candidates

| Candidate | Rendering method | Classic formation | New-generation formation | Approximate asset size |
|---|---|---:|---:|---:|
| A | Generated transparent 2.5D modules | Taurus + 7 coaches | Locomotive + 9 Viaggio Next Level cars | 196 KB / 172 KB |
| B | Deterministic SVG 2.5D modules | 8 world cards | 10 world cards | 24 KB / 24 KB |
| C | Procedural low-poly GLB | 210.7 m generated bounds | 266.1 m generated bounds | 70 KB / 82 KB |
| D | Blender-authored low-poly GLB | 205.38 m, 8 vehicles | 258 m, 10 vehicles | 227 KB / 283 KB |

Candidate A was created with built-in Image Generation as two original five-module sheets, one per generation. The prompt set requested a consistent locked orthographic isometric angle, unbranded Taurus/coach/restaurant/first-class/driving-trailer modules, authentic red/dark-grey/light-grey blocking, recognisable cab and roof-equipment rhythm, a transparent/chroma background, and no logos, text, watermarks, or copied photography. The normalized source frames are under `public/railjet-lab/generated/`; the full source sheets are under `assets/railjet-lab/source/`.

Candidate B is regenerated entirely from `scripts/generate-railjet-vector-assets.mjs`. It intentionally prioritizes tiny downloads, deterministic editing, and crisp mobile silhouettes. The visible gangway joins are its present weakness and should count in user scoring.

Candidate C is regenerated from `scripts/generate-railjet-lab-assets.mjs`. It uses lofted cross-sections, curved roofs, separate cab masks, windscreens, doors, windows, bogies, wheelsets, couplers, underframe equipment, pantographs, roof cabinets, HVAC, and a new-generation low-floor module. Both GLBs are glTF 2.0, Y-up, metre-based, and optimized with shared geometry/materials.

Candidate D is regenerated from `scripts/blender/generate_railjet_classic.py` and `scripts/blender/generate_railjet_nextgen.py`. The editable masters live under `assets/blender/`; modular locomotive/coach GLBs and complete formations live under `public/models/trains/blender/railjet/`. It uses measured metre-scale bodies, curved cross-sections, separate driving cabs, windows, doors, bogies, wheelsets, underframes, couplers, pantographs, HVAC, and low-floor new-generation entrances. It contains no downloaded mesh, photo texture, logo, or operator wordmark.

Candidate D alone now uses a physical scene contract: 1.435 m standard gauge, tread centres at ±0.7175 m, wheel contact at Z=0, one 0.071 world-units-per-metre scale for both generations, and a 5.5 m raised-pantograph/contact-wire height. The browser rail centres are therefore ±0.05094 world units, the classic formation is about 14.58 units long, and the new generation is about 18.32 units long. The platform, catenary, shadows, lane spacing, and camera use the same profile. Candidates A–C retain their original comparison transforms.

## Rebuild and QA

```sh
npm run assets:railjet-lab
npm run assets:railjet-blender
npm test
npm run qa:railjet-contact-sheets
```

`scripts/capture-railjet-lab.mjs` captures all eight 390×844 views through a trusted local Chrome DevTools endpoint. The screenshot route also accepts `freeze=1&phase=<seconds>` for deterministic stop/pass frames; this does not change normal laboratory motion.

Automated coverage checks method/generation resolution, exact vehicle counts, relative formation length, transparency and anchors, SVG structure and budgets, both GLB pipelines' hierarchy/materials/bounds/budgets, and continuous map-exit motion. Browser checks cover day, night, rain, stationary, stopping, pass-through, direct URL hydration, 3× simultaneous load, and responsive layout.

## Evidence and current assessment

- [Desktop A/B/C/D comparison](../qa/railjet-lab/railjet-bakeoff-desktop.jpg)
- [Mobile A/B/C/D comparison](../qa/railjet-lab/railjet-bakeoff-mobile.jpg)
- [Classic Blender formation review](../qa/railjet-lab/classic-blender-overview.jpg)
- [Classic Taurus detail](../qa/railjet-lab/classic-blender-taurus-detail.jpg)
- [Classic Blender wheel/rail detail](../qa/railjet-lab/classic-blender-wheel-rail-detail.jpg)
- [Classic driving-trailer detail](../qa/railjet-lab/classic-blender-driving-trailer-detail.jpg)
- [New-generation Blender formation review](../qa/railjet-lab/nextgen-blender-overview.jpg)
- [New-generation driving-trailer detail](../qa/railjet-lab/nextgen-blender-driving-trailer-detail.jpg)
- [New-generation Blender wheel/rail detail](../qa/railjet-lab/nextgen-blender-wheel-rail-detail.jpg)
- [Classic calibrated browser view](../qa/railjet-lab/classic-blender-desktop.png)
- [Wheel/rail inspection view](../qa/railjet-lab/classic-blender-wheel-rail-detail.png)
- [New-generation calibrated browser view](../qa/railjet-lab/nextgen-blender-desktop.png)
- [Three-train calibrated rain load](../qa/railjet-lab/nextgen-blender-game-rain.png)
- [Classic night view](../qa/railjet-lab/classic-generated-night.jpg)
- [New-generation rain/platform view](../qa/railjet-lab/nextgen-hybrid-rain-platform.jpg)
- [Three-train procedural load](../qa/railjet-lab/nextgen-hybrid-three-load.jpg)

The user selected Candidate D after visual review. It is the only production candidate with editable Blender masters and independently modeled, measured vehicle modules. A–C remain available in the bake-off for historical comparison and are not loaded by normal gameplay.

Official research references: [ÖBB fleet overview](https://static.web.oebb.at/konzern/oebb-flotte-2025/4/) and [Siemens new-generation Railjet](https://press.siemens.com/global/en/pressrelease/obb-puts-first-new-generation-railjet-siemens-mobility-service-and-orders-19-more).
