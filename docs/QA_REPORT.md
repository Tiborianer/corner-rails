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

## 2026-08-21 Nightjet Blender review and production promotion N2

The second per-train approval branch adds an editable Blender 5.2 master, six modular GLBs and one eight-vehicle formation: Taurus 1116, two sleeping cars, three couchette cars, multifunction car and control/seat car. N2 redraws the Taurus side treatment as layered, mirrored red and silver geometry sweeps with matching cab blocks and nose belts. The full optimized GLB is 238,364 bytes. The user references are recorded by filename but are neither copied nor embedded; recognition details use original geometry and material colour blocking without protected logos or photo textures.

Forty-four automated tests pass. Nightjet-specific coverage verifies the exact eight-root formation, 204.7–205.1 m exported bounds including couplers, 64 standard-gauge wheel objects, wheel contact at Z=0, 5.5 m pantograph contact, a named rail-contact origin, Taurus roof/vent and N2 livery-sweep signatures, the distinct control-car windshield/grille, sleeping/couchette/multifunction window signatures, the 500 KB budget, all nine reference filenames and `productionRegistryModified: true`. The production registry is `metric-v1`, the review and production GLBs are byte-identical, and the probability boundary is exactly 75% Taurus-leading / 25% cab-car-leading. Orientation selection is deterministic, persists through save codes and migrates the interim direction field.

The private `?trainLab=nightjet-new-generation` route was exercised at 1440×900 and 390×844 in stationary, stopping, fixed-phase pass-through, day, night, rain, inspection and three-simultaneous-formation states. N2 was captured twice at the identical pass-through phase and track position: exported orientation with the Taurus leading and a 180-degree turn with the cab car leading. Both enter from the left and travel right. Normal-game debug arrivals then verified both approved orientations at night, the exact 20,000-coin payout, metric rail/platform contact, smooth approach/dwell/depart motion and the production asset URL at desktop and 390×844. The server returned the canonical 238,364-byte GLB successfully. There were no WebGL/loading errors; console review found only Three.js's existing `Clock` deprecation warning.

## 2026-08-22 traffic, station and thunderstorm upgrade

The production metric scene now uses twelve separately proportioned procedural road vehicles, two deterministic directional lanes and one reserved station drop-off bay. Extended simulation at 1×/2×/3× verifies vehicle-length-aware clearances while eligible vehicles enter the bay, dwell for 3–7 simulated seconds and merge into a safe gap. The road visits remain visual-only and are not added to save codes or the economy.

All platform fixtures now illuminate independently, with bounded desktop/mobile point-light pools. Tier 5 uses a larger glass-and-concrete terminus, litter scales to twelve seeded pieces per platform with seven object families, and the maintenance siding visibly enters from the right corridor before curving into the open depot shed. The siding retains the metric gauge and uses separate ballast, sleepers, rails and buffer-stop geometry.

Weather is now an exclusive 65% clear / 25% rain / 10% thunderstorm season roll. Rain applies −10 rating; thunderstorms apply −25, heavier continuous/arrival dirt, lightning pulses and delayed synthesized thunder. Existing `CR1` rain saves migrate to the new weather fields. Desktop and 390×844 browser checks covered Tier 5 day/night, five-platform lighting, heavy dirt, mixed traffic, the right-entry siding and thunderstorms. No WebGL or loading errors occurred; only Three.js's existing `Clock` deprecation warning appeared.

Follow-up visual corrections align every road-vehicle front with its travel direction, raise thunderstorm precipitation to 920 faster particles (normal rain remains 260), and place pooled platform lights directly below visible fixture heads. The complete suite now contains 53 passing Vitest checks.

## 2026-08-22 ICE 3 Blender review I3 and per-platform signals

I3 adds an editable Blender 5.2 master, eight role-specific modular GLBs and one optimized 200.32 m Class 403 formation. The car order follows DB's official BR403 technical and passenger-role records, with a separately recognizable 403.3 Bordrestaurant, service car, powered converter/end cars and two transformer cars. The final recognition pass rounds the original over-sharp cab, seats the dark visor and side cab glazing against the nose, follows the shell with the descending red stripe, and darkens the restaurant glazing for daylight readability.

Asset validation confirms eight formation roots, 64 standard-gauge wheel objects, wheel contact at Z=0, a named rail-contact origin, a 5.5 m raised pantograph contact, no exported review rails, 12 materials and an optimized 188,328-byte formation. The production ICE 3 remains `legacy-v1`; the I3 registry entry is private-review with `productionRegistryModified: false`.

The private `?trainLab=ice3-br403` route was checked at 1440×900 and 390×844 in stationary, pass-through, day, night, rain, inspection and three-simultaneous-formation states. The visible counter sustained 60 FPS with three night formations and exceeded 100 FPS with one formation in the in-app software-WebGL session. No WebGL or loading errors occurred; only Three.js's existing `Clock` deprecation warning was logged. The normal Tier 5 debug station visibly renders five separate signals—one beyond each platform end—without occupying the vehicle envelope.

The complete Vitest suite now contains 59 passing checks. ESLint, the Sites production build, rendered-HTML smoke test and GitHub Pages build also pass; both builds retain only the existing large glTF runtime chunk warning.

## 2026-08-23 ICE 3 Class 403 V2 full formation

I3 V2 replaces the V1 cab construction with a separate subdivision-smoothed, reference-calibrated 403.0 end car. After the user approved checkpoint 7, that unchanged cab became the visual master for the complete eight-car V2 formation. Seven matching vehicles now provide the exact 403.0, 403.1, 403.2, 403.3, 403.8, 403.7, 403.6 and 403.5 order. The middle cars preserve the approved body height, lower continuous stripe, shallow rounded glazing and tall single-leaf door language while adding role-specific roof and underframe equipment. V1 remains selectable as a baseline, and the production `ice3.glb`/registry entry remains unchanged pending explicit full-formation approval.

The editable Blender master retains non-exported side/front reference guides. Cab checkpoint 7 remains separately available and unchanged. The completed formation adds 64 standard-gauge wheels at the Z=0 contact plane, a named `rail_contact_origin`, two transformer-car pantographs with the raised collector at 5.5 m, converter cabinets, service-car battery panels and an independently recognizable 403.3 Bordrestaurant with its asymmetric dining/galley window rhythm. The eight modular vehicle GLBs and 580,612-byte formation GLB contain 19 reusable materials and one embedded original PNG atlas. Validation confirms an approximately 200.46 m rendered bound including detail over the nominal 200.32 m vehicle contract, no exported calibration track or reference planes, and no supplied photograph or protected logo.

The full formation has deterministic Blender review renders for the complete side and isometric silhouettes, both cab ends, the Bordrestaurant, transformer roof and service car. The private `?trainLab=ice3-br403-v2` browser route loads the eight-car/200.32 m record correctly; stationary inspection and a three-formation rainy pass-through both rendered without a loading screen or WebGL failure. The active mobile-size software-WebGL session reported 112–120 FPS. All 60 Vitest checks, ESLint, the Sites production build, rendered-HTML smoke test and GitHub Pages build pass. Both builds retain only the existing large glTF runtime chunk warning. Checkpoint 7 close-up renders remain available to verify that the approved windscreen, nose, stripe and lamps were not regressed.

## 2026-08-29 ICE 3 Class 403 two-car continuity checkpoint

I3 C rebuilds only the 403.0 end car and adjacent 403.1 transformer car. One 19-vertex metric cross-section now controls both passenger shells, while one continuous black glazing recess, inset window system and shared 1.84 m / 0.18 m stripe datum provide the missing visual continuity. The 403.0 is a single loft from gangway to nose tip and exports no detached nose-cap object. The accepted panoramic windscreen, wipers, central lamps and general nose proportions remain the cab recognition baseline.

Asset inspection confirms two vehicle roots, 16 standard-gauge wheels at the Z=0 contact plane, a named `rail_contact_origin`, one raised 5.5 m pantograph collector, 42 inset passenger-window panes and four continuous black passenger-band surfaces. A focused reference pass replaces the old four oversized angular cab panes with two continuous dark cab-side ribbons containing five panes per side. The rearmost cab pane is now 1.08 m wide, closely matching the regular 1.16 m passenger-window module, and all ten cab-side panes reuse the verified `ICE3_V2_Glass_Interior` passenger-window material. The panes retain the shared height before descending and narrowing into the windscreen. The shared 0.18 m stripe datum remains at 1.84 m on both cars and throughout the nose sweep. The optimized two-car checkpoint is 237,752 bytes, below its 450 KB budget. Eight deterministic Blender views cover the side, isometric, nose/body transition, carriage junction, glazing band, stripe junction and transformer roof. The production ICE 3 SHA-256 remains `ec41a600…f0be`; the previous full V2 remains `736be624…3e0f`.

The local private route passed stationary day/night/rain, stopping/pass controls, one/three simultaneous formations, desktop inspection and a 390×844 mobile viewport. Revision `continuity-4` is the current cache-safe laboratory asset revision after the final width/colour correction. Comparison navigation works in both directions between “Previous full formation” and “New continuity checkpoint.” Browser logging contains no WebGL or asset errors; only Three.js's existing `Clock` deprecation warning remains. All 63 Vitest checks, ESLint, the Sites production build, rendered-HTML smoke test and GitHub Pages build pass. The only build warning is the existing large glTF runtime chunk.

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
- [Nightjet N2 Taurus-leading pass](../qa/train-review/nightjet-new-generation/nightjet-new-generation-n2-taurus-leading.png)
- [Nightjet N2 cab-car-leading pass](../qa/train-review/nightjet-new-generation/nightjet-new-generation-n2-cab-car-leading.png)
- [ICE 3 Blender overview](../qa/train-review/ice3-br403/ice3-br403-blender-overview.jpg)
- [ICE 3 rounded nose and cab glazing](../qa/train-review/ice3-br403/ice3-br403-blender-nose-detail.jpg)
- [ICE 3 403.3 Bordrestaurant side](../qa/train-review/ice3-br403/ice3-br403-blender-bordrestaurant-side.jpg)
- [ICE 3 transformer pantograph detail](../qa/train-review/ice3-br403/ice3-br403-blender-pantograph-detail.jpg)
- [ICE 3 wheel/rail calibration](../qa/train-review/ice3-br403/ice3-br403-blender-wheel-rail-detail.jpg)
- [ICE 3 V2 normal isometric checkpoint](../qa/train-review/ice3-br403-v2/ice3-br403-v2-normal-isometric.jpg)
- [ICE 3 V2 exact side](../qa/train-review/ice3-br403-v2/ice3-br403-v2-exact-side.jpg)
- [ICE 3 V2 nose three-quarter](../qa/train-review/ice3-br403-v2/ice3-br403-v2-nose-three-quarter.jpg)
- [ICE 3 V2 windscreen close-up](../qa/train-review/ice3-br403-v2/ice3-br403-v2-windscreen-close.jpg)
- [ICE 3 V2 door/window close-up](../qa/train-review/ice3-br403-v2/ice3-br403-v2-door-window-close.jpg)
- [ICE 3 V2 Bordrestaurant](../qa/train-review/ice3-br403-v2/ice3-br403-v2-bordrestaurant-side.jpg)
- [ICE 3 V2 transformer roof](../qa/train-review/ice3-br403-v2/ice3-br403-v2-transformer-roof.jpg)
- [ICE 3 V2 service car](../qa/train-review/ice3-br403-v2/ice3-br403-v2-service-car-side.jpg)
- [ICE 3 V2 rear cab](../qa/train-review/ice3-br403-v2/ice3-br403-v2-rear-end-three-quarter.jpg)
- [ICE 3 V2 browser day](../qa/train-review/ice3-br403-v2/ice3-br403-v2-browser-day.png)
- [ICE 3 V2 browser checkpoint 7](../qa/train-review/ice3-br403-v2/ice3-br403-v2-browser-checkpoint-7.png)
- [ICE 3 V2 browser rain with three cars](../qa/train-review/ice3-br403-v2/ice3-br403-v2-browser-rain-three.png)
- [ICE 3 V2 browser mobile](../qa/train-review/ice3-br403-v2/ice3-br403-v2-browser-mobile.png)
- [ICE 3 V2 complete formation in browser](../qa/train-review/ice3-br403-v2/ice3-br403-v2-browser-formation-day.png)
- [ICE 3 V2 three-formation rainy pass](../qa/train-review/ice3-br403-v2/ice3-br403-v2-browser-formation-rain-three.png)
- [ICE 3 continuity normal isometric](../qa/train-review/ice3-br403-v2-continuity/ice3-br403-v2-continuity-normal-isometric.jpg)
- [ICE 3 continuity exact side](../qa/train-review/ice3-br403-v2-continuity/ice3-br403-v2-continuity-exact-side.jpg)
- [ICE 3 continuity nose/body close-up](../qa/train-review/ice3-br403-v2-continuity/ice3-br403-v2-continuity-nose-body-close.jpg)
- [ICE 3 continuity carriage junction](../qa/train-review/ice3-br403-v2-continuity/ice3-br403-v2-continuity-carriage-junction-close.jpg)
- [ICE 3 continuity glazing band](../qa/train-review/ice3-br403-v2-continuity/ice3-br403-v2-continuity-window-band-close.jpg)
- [ICE 3 continuity stripe junction](../qa/train-review/ice3-br403-v2-continuity/ice3-br403-v2-continuity-stripe-continuity-close.jpg)
- [ICE 3 continuity browser day](../qa/train-review/ice3-br403-v2-continuity/ice3-br403-v2-continuity-browser-day.png)
- [ICE 3 continuity browser night](../qa/train-review/ice3-br403-v2-continuity/ice3-br403-v2-continuity-browser-night.png)
- [ICE 3 continuity browser rain with three formations](../qa/train-review/ice3-br403-v2-continuity/ice3-br403-v2-continuity-browser-rain-three.png)
- [ICE 3 continuity browser mobile](../qa/train-review/ice3-br403-v2-continuity/ice3-br403-v2-continuity-browser-mobile.png)
- [ICE 3 unified full formation](../qa/train-review/ice3-br403-v2-unified/ice3-br403-v2-unified-normal-isometric.jpg)
- [ICE 3 unified exact side](../qa/train-review/ice3-br403-v2-unified/ice3-br403-v2-unified-exact-side.jpg)
- [ICE 3 unified first carriage junction](../qa/train-review/ice3-br403-v2-unified/ice3-br403-v2-unified-first-junction-close.jpg)
- [ICE 3 unified Bordrestaurant](../qa/train-review/ice3-br403-v2-unified/ice3-br403-v2-unified-bordrestaurant-side.jpg)
- [ICE 3 unified service car](../qa/train-review/ice3-br403-v2-unified/ice3-br403-v2-unified-service-car-side.jpg)
- [ICE 3 unified transformer roof](../qa/train-review/ice3-br403-v2-unified/ice3-br403-v2-unified-transformer-roof.jpg)
- [ICE 3 unified emissive lenses and headlight beams](../qa/train-review/ice3-br403-v2-unified/ice3-br403-v2-unified-night-headlights.jpg)

The user approved I3 U for production on 2026-09-02. Normal gameplay now resolves the Tier 4 `ice3` service to the 200.32 m metric Class 403 GLB, preserves that visual ID in manual save codes, and migrates older active ICE 3 saves to it. The production renderer uses the approved single moving headlight beam and the laboratory-style warm directional platform fill with tightly bounded local point lights. The former `public/models/trains/ice3.glb` remains untouched for rollback.

## 2026-09-03 Railjet livery V2 and badge collection

The private train-review laboratory now includes separate classic and new-generation Railjet livery V2 candidates. Their geometry is unchanged; the review pass corrects the external colour hierarchy to a wine-red upper body, bright-red belt, graphite lower flank and aluminium skirt while preserving generation-specific doors, windows and driving ends. The normal game continues loading the previously approved production Railjet files until the user explicitly approves these recolours.

The normal game now contains twelve persistent badges spanning approachable milestones and difficult long-term challenges. A compact medal counter opens a collection drawer with a short clue, difficulty and unlocked state. Award checks use real simulation state, survive prestige and `CR1` export/import, and deliberately ignore debug-bar mutations. Regression coverage also locks the Tier 1→2 station cost at exactly 500 coins. The complete Vitest suite now contains 73 passing checks.
- [Production Nightjet with Taurus leading](../qa/production-nightjet-taurus-leading.png)
- [Rare production Nightjet with cab car leading](../qa/production-nightjet-cab-car-leading.png)
- [Production Nightjet mobile layout](../qa/production-nightjet-mobile.png)
- [Railjet night candidate](../qa/railjet-lab/classic-generated-night.jpg)
- [Three simultaneous procedural formations](../qa/railjet-lab/nextgen-hybrid-three-load.jpg)

## Known scope limits

- The train GLBs remain original low-poly interpretations with no protected logos, but no longer share a generic coach. Train families have distinct full-length silhouettes, cab masks, roof equipment, bogies, articulated or locomotive-hauled structure, door/window rhythms, liveries, and correct end roles. They are detailed diorama assets rather than scanned museum replicas.
- Longer soak balancing, China/France/Japan, extra steam variants, additional events, and second-station expansion remain future work.
- Mobile captures used Chrome software WebGL so their displayed FPS is not a hardware performance measurement. The in-app browser sustained 60 FPS with three simultaneous procedural formations at its desktop viewport; representative physical-mobile GPU profiling remains a follow-up.
