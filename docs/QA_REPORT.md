# Screenshot-backed QA summary

The screenshots below document the original 2026-08-11 vertical slice. A 2026-08-12 visual revision replaced the shared boxy train recipe with family-specific lead vehicles and formations, moved onboarding to the lower corner, extended rails and terrain beyond the camera, grounded the platform on a full plinth, and added deterministic landscape scenery. Automated regression results for this revision are recorded in the repository build output; the earlier screenshots are retained as before/after evidence rather than presented as the revised visuals.

A second 2026-08-12 regression pass corrected the catenary crash, isolated train loading from the rest of the diorama, added frame-by-frame train-motion extrapolation above the 10 Hz deterministic simulation, and replaced the Tier 1 bodies with three longer chamfered rail-vehicle shells. Daylight now eases through a one-minute dusk and one-minute dawn, including sky, fog, ambient light, directional light, hemisphere light, and station-window colour. Thirteen automated checks now include finite electrification geometry, continuous sub-frame motion, gradual daylight values, and distinct node signatures for all three Tier 1 GLBs.

The per-platform operations revision replaces the global train timer with one serializable lane per built platform. Regression coverage verifies lane creation/refund, simultaneous automatic spawns, concurrent phase progression, independent completion/countdown reset, and multi-lane save-code round-trips. The DOM arrival surface is now a compact platform board rather than a single-service card.

The complete-consist asset revision removes the shared runtime coach entirely. All 20 GLBs now include their full representative formation: recognisable regional articulated units, locomotive-hauled single- and double-deck stock, ICE end cars and intermediate equipment, Railjet and ComfortJet driving trailers, Nightjet sleeper variants, two-ended TGV Euroduplex power cars, the eleven-car Giruno, the ICE-S measurement car, and the BR 01 tender/heritage formation. Automated asset checks verify all twenty files, formation length, unique hierarchy signatures, international end-role nodes, and the complete bundle budget.

QA completed on **2026-08-11** in the Codex in-app Chromium browser plus Vitest/build validation.

The non-Blender Railjet bake-off was added on **2026-08-15**. It preserves the production Railjet and introduces a private `?railjetLab=1` route with generated 2.5D, deterministic vector 2.5D, and procedural 3D candidates for both Railjet generations. Twenty-seven automated tests now cover the six combinations, exact 8/10-vehicle formations, transparent sprite bounds, SVG safety, GLB hierarchy/bounds/budgets, and continuous stop/pass motion. Direct non-default URLs were browser-tested after fixing a server/client query-state hydration mismatch. The first SVG pass also exposed missing intrinsic dimensions; the generator now writes explicit 512×256 dimensions so Three.js can upload the vectors reliably.

The 2026-08-16 Blender pass adds editable Blender 5.2 LTS masters, modular vehicle GLBs, and complete classic/new-generation formations as candidate D. The classic model follows the official 205.38 m formation and Class 1116/Viaggio Comfort dimensions; the new-generation model follows the official ten-vehicle-with-locomotive, 258 m formation and includes visibly lower entrances on seven cars.

The physical-calibration revision gives Candidate D a 1.435 m gauge contract, wheel-tread centres at ±0.7175 m, a Z=0 rail-contact anchor, a shared 0.071 world-units-per-metre scale, and a 5.5 m pantograph/contact-wire height. Its R3F rails, platform, catenary, shadows, lane spacing, and locked camera are derived from that contract instead of inheriting the oversized legacy comparison environment. Calibration rails remain in the editable Blender review scenes and are excluded from every shipping GLB.

Twenty-nine automated tests now include Blender hierarchy, exact vehicle count, metre-scale bounds, contact-anchor extras, tread gauge/contact height, manifest metadata, distinct cab/door/bogie nodes, material count, runtime world lengths, platform/catenary values, and the 500 KB per-formation budget. Direct candidate-D URLs were browser-tested at desktop and 390×844 mobile sizes in stationary, stopping, rain, night, pass-through, inspection, and three-simultaneous-train states. Both assets loaded without WebGL errors; the only console warning was Three.js's existing `Clock` deprecation notice.

## 2026-08-16 production metric migration

Candidate D was selected by the user and promoted without changing the old `public/models/trains/railjet.glb`; its working-tree and committed Git hashes remain byte-identical. The normal game and private review route now share the canonical classic and new-generation GLBs under `public/models/trains/blender/railjet/`. One scheduled Railjet record remains in the six-service Tier 5 roster. Level 4 selects only classic; level 5 selects classic/new generation with equal deterministic weight, and the chosen variant is serialized on its active platform lane.

The normal scene now uses the shared metric rails, calculated five-lane/platform placement, 90/130/170/220/280 m length levels, 5.5 m catenary, formation-bound entry/exit and contact shadows, metric-positioned station/road/maintenance/scenery, and the laboratory light balance. All other train records remain on temporary legacy profiles; browser QA showed five concurrent lanes containing one metric Railjet plus four legacy trains without loading stalls or obvious rail/platform displacement. The old scene remains available only at `?debug=1&visuals=legacy`.

Thirty-four automated game/asset tests, lint, the Sites production build, rendered-HTML smoke test and GitHub Pages build pass. Browser flows verified the 10-coin first service, classic day arrival, new-generation night/rain arrival, five simultaneous platforms at 1× after a 3× dispatch, desktop layout, 390×844 layout, both focused `?trainLab=railjet` URLs and the debug rollback renderer. No WebGL errors occurred; only Three.js's existing `Clock` deprecation warning appeared. Mobile browser captures are responsive-layout evidence, not physical-device GPU benchmarks.

## 2026-08-16 DB Regional-Express Blender review R1

The first per-train approval branch adds an editable Blender 5.2 master, four modular GLBs and one 99.84 m nominal four-vehicle formation. The set follows the supplied BR 245, double-deck intermediate and double-deck driving-trailer views. The initial material pass exposed shared-mesh material inheritance; it was corrected with one cached primitive mesh per material before browser review. A second close-up pass made both cabs blunter and moved the recognition surfaces onto the outer front plane so the BR 245 windshields and grey driving-trailer face do not disappear into the lofted body.

Thirty-eight automated tests now pass. Candidate-specific coverage verifies four distinct vehicle roots, engine grilles, upper/lower double-deck windows, driving-trailer windscreens, 1.435 m wheel-tread placement, Z=0 rail contact, a centred approximately 100.8 m exported bound including couplers, a named rail-contact origin, a 500 KB formation budget, recorded reference filenames, and `productionRegistryModified: false`. The existing Desiro HC remains `legacy-v1` and byte/path-independent from this candidate.

The private `?trainLab=db-regional-express` route was exercised at desktop and 390×844 mobile sizes in stationary, stopping, pass-through, day, night, rain and three-lane-capable states. The controls update the URL/state correctly, the model loads without WebGL errors, and the visible FPS counter stayed above 100 in the in-app desktop software-WebGL session. The only console output was Three.js's existing `Clock` deprecation warning. The mobile screenshot is layout evidence, not a physical-device GPU result. Blender review startup exited once when chained directly after the Node optimizer; running the same saved master as a separate command rendered all five views successfully, so generation/export is unaffected.

## 2026-08-21 Nightjet Blender review N1

The second per-train approval branch adds an editable Blender 5.2 master, six modular GLBs and one eight-vehicle formation: Taurus 1116, two sleeping cars, three couchette cars, multifunction car and control/seat car. The full optimized GLB is 235,256 bytes. The user references are recorded by filename but are neither copied nor embedded; recognition details use original geometry and material colour blocking without protected logos or photo textures.

Forty-one focused automated tests pass. Candidate-specific coverage verifies the exact eight-root formation, 204.7–205.1 m exported bounds including couplers, 64 standard-gauge wheel objects, wheel contact at Z=0, 5.5 m pantograph contact, a named rail-contact origin, Taurus roof/vent signatures, the distinct control-car windshield/grille, sleeping/couchette/multifunction window signatures, the 500 KB budget, all nine reference filenames and `productionRegistryModified: false`. The normal Tier 5 Nightjet remains `legacy-v1`.

The private `?trainLab=nightjet-new-generation` route was exercised at 1440×900 and 390×844 in stationary, stopping, fixed-phase pass-through, day, night, rain, inspection and three-simultaneous-formation states. The visible desktop counter reported 94–118 FPS; the three-formation rain state reported 98 FPS. The asset loaded without WebGL or loading errors. Console review found only Three.js's existing `Clock` deprecation warning. Mobile evidence verifies responsive layout, not physical-device GPU performance.

## Automated acceptance coverage

- Nine deterministic simulation tests cover exact structural prices, the shared cap, system purchases, Tier 5 unlimited development, cleaning cost and cap exclusion, rating response, train and rain dirt, roster counts, Nightjet night eligibility/fixed payout, and save-code round-trip/damage rejection.
- Production build and rendered-HTML smoke test are part of `npm test`.
- The asset generator creates and optimizes all 20 complete-consist train GLBs; the shipping bundle is approximately 760 KB before application compression.

## Browser flows exercised

- Germany region selection → free platform → automatic Class 650 arrival → 10-coin first fare.
- 1×/2×/3× simulation speeds; desktop and 390×844 mobile layouts; resize back to desktop.
- Tier 5 complete station, six visible international records, and Nightjet READY only at night.
- Heavy dirt plus rain, cleanliness/rating response, paid full clean to 100%, and disabled spotless state.
- Forced ICE-S and BR 01 event dispatches using `?debug=1`, including rewards, temporary boosts, steam, smoke, bunting, and arrival cards.
- Manual `CR1` export/import round-trip and invalid-code protection.
- A resize defect in a world-space HTML placement label was found during mobile QA and removed; accessible DOM onboarding remains, and the gold platform mesh is still clickable.

## Captures

- [Tier 5 international terminus](../qa/tier5-international.jpg)
- [ICE-S record run](../qa/ice-s-record-run.jpg)
- [BR 01 steam festival](../qa/steam-festival.jpg)
- [Rain and dirty station](../qa/rain-dirty-station.jpg)
- [Mobile onboarding](../qa/mobile-onboarding.jpg)
- [Railjet desktop A/B/C/D contact sheet](../qa/railjet-lab/railjet-bakeoff-desktop.jpg)
- [Railjet mobile A/B/C/D contact sheet](../qa/railjet-lab/railjet-bakeoff-mobile.jpg)
- [Classic Blender Taurus detail](../qa/railjet-lab/classic-blender-taurus-detail.jpg)
- [Classic Blender wheel/rail detail](../qa/railjet-lab/classic-blender-wheel-rail-detail.jpg)
- [New-generation Blender driving-trailer detail](../qa/railjet-lab/nextgen-blender-driving-trailer-detail.jpg)
- [New-generation Blender wheel/rail detail](../qa/railjet-lab/nextgen-blender-wheel-rail-detail.jpg)
- [Classic calibrated browser view](../qa/railjet-lab/classic-blender-desktop.png)
- [Candidate D wheel/rail inspection view](../qa/railjet-lab/classic-blender-wheel-rail-detail.png)
- [New-generation calibrated browser view](../qa/railjet-lab/nextgen-blender-desktop.png)
- [Three calibrated formations in rain](../qa/railjet-lab/nextgen-blender-game-rain.png)
- [Classic Railjet in the production station](../qa/production-railjet-classic-day.png)
- [New-generation Railjet with production night/rain lighting](../qa/production-railjet-nextgen-night-rain.png)
- [Five simultaneous metric/legacy production lanes](../qa/production-five-platform-concurrent.png)
- [New-generation production mobile layout](../qa/production-railjet-nextgen-mobile.png)
- [Classic focused train-review route at night](../qa/train-review-railjet-classic-night.png)
- [New-generation focused train-review mobile route](../qa/train-review-railjet-nextgen-mobile.png)
- [DB Regional-Express Blender overview](../qa/train-review/db-regional-express/db-regional-express-blender-overview.jpg)
- [DB Regional-Express BR 245 detail](../qa/train-review/db-regional-express/db-regional-express-blender-br245-detail.jpg)
- [DB Regional-Express driving-trailer detail](../qa/train-review/db-regional-express/db-regional-express-blender-driving-trailer-detail.jpg)
- [DB Regional-Express wheel/rail detail](../qa/train-review/db-regional-express/db-regional-express-blender-wheel-rail-detail.jpg)
- [DB Regional-Express browser day](../qa/train-review/db-regional-express/db-regional-express-browser-day.png)
- [DB Regional-Express browser night](../qa/train-review/db-regional-express/db-regional-express-browser-night.png)
- [DB Regional-Express browser rain](../qa/train-review/db-regional-express/db-regional-express-browser-rain.png)
- [DB Regional-Express browser mobile layout](../qa/train-review/db-regional-express/db-regional-express-browser-mobile.png)
- [Nightjet Blender overview](../qa/train-review/nightjet-new-generation/nightjet-new-generation-blender-overview.jpg)
- [Nightjet Taurus 1116 detail](../qa/train-review/nightjet-new-generation/nightjet-new-generation-blender-taurus-1116-detail.jpg)
- [Nightjet control-car detail](../qa/train-review/nightjet-new-generation/nightjet-new-generation-blender-control-car-detail.jpg)
- [Nightjet sleeping/couchette side profiles](../qa/train-review/nightjet-new-generation/nightjet-new-generation-blender-sleeping-couchette-side.jpg)
- [Nightjet wheel/rail calibration](../qa/train-review/nightjet-new-generation/nightjet-new-generation-blender-wheel-rail-detail.jpg)
- [Nightjet browser day](../qa/train-review/nightjet-new-generation/nightjet-new-generation-browser-day.png)
- [Nightjet browser night inspection](../qa/train-review/nightjet-new-generation/nightjet-new-generation-browser-night.png)
- [Three Nightjet formations in rain](../qa/train-review/nightjet-new-generation/nightjet-new-generation-browser-rain.png)
- [Nightjet pass-through state](../qa/train-review/nightjet-new-generation/nightjet-new-generation-browser-pass.png)
- [Nightjet browser mobile layout](../qa/train-review/nightjet-new-generation/nightjet-new-generation-browser-mobile.png)
- [Railjet night candidate](../qa/railjet-lab/classic-generated-night.jpg)
- [Three simultaneous procedural formations](../qa/railjet-lab/nextgen-hybrid-three-load.jpg)

## Known scope limits

- The train GLBs remain original low-poly interpretations with no protected logos, but no longer share a generic coach. Train families have distinct full-length silhouettes, cab masks, roof equipment, bogies, articulated or locomotive-hauled structure, door/window rhythms, liveries, and correct end roles. They are detailed diorama assets rather than scanned museum replicas.
- Longer soak balancing, China/France/Japan, extra steam variants, additional events, and second-station expansion remain future work.
- Mobile captures used Chrome software WebGL so their displayed FPS is not a hardware performance measurement. The in-app browser sustained 60 FPS with three simultaneous procedural formations at its desktop viewport; representative physical-mobile GPU profiling remains a follow-up.
