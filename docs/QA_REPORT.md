# Screenshot-backed QA summary

The screenshots below document the original 2026-08-11 vertical slice. A 2026-08-12 visual revision replaced the shared boxy train recipe with family-specific lead vehicles and formations, moved onboarding to the lower corner, extended rails and terrain beyond the camera, grounded the platform on a full plinth, and added deterministic landscape scenery. Automated regression results for this revision are recorded in the repository build output; the earlier screenshots are retained as before/after evidence rather than presented as the revised visuals.

A second 2026-08-12 regression pass corrected the catenary crash, isolated train loading from the rest of the diorama, added frame-by-frame train-motion extrapolation above the 10 Hz deterministic simulation, and replaced the Tier 1 bodies with three longer chamfered rail-vehicle shells. Daylight now eases through a one-minute dusk and one-minute dawn, including sky, fog, ambient light, directional light, hemisphere light, and station-window colour. Thirteen automated checks now include finite electrification geometry, continuous sub-frame motion, gradual daylight values, and distinct node signatures for all three Tier 1 GLBs.

The per-platform operations revision replaces the global train timer with one serializable lane per built platform. Regression coverage verifies lane creation/refund, simultaneous automatic spawns, concurrent phase progression, independent completion/countdown reset, and multi-lane save-code round-trips. The DOM arrival surface is now a compact platform board rather than a single-service card.

The complete-consist asset revision removes the shared runtime coach entirely. All 20 GLBs now include their full representative formation: recognisable regional articulated units, locomotive-hauled single- and double-deck stock, ICE end cars and intermediate equipment, Railjet and ComfortJet driving trailers, Nightjet sleeper variants, two-ended TGV Euroduplex power cars, the eleven-car Giruno, the ICE-S measurement car, and the BR 01 tender/heritage formation. Automated asset checks verify all twenty files, formation length, unique hierarchy signatures, international end-role nodes, and the complete bundle budget.

QA completed on **2026-08-11** in the Codex in-app Chromium browser plus Vitest/build validation.

The non-Blender Railjet bake-off was added on **2026-08-15**. It preserves the production Railjet and introduces a private `?railjetLab=1` route with generated 2.5D, deterministic vector 2.5D, and procedural 3D candidates for both Railjet generations. Twenty-seven automated tests now cover the six combinations, exact 8/10-vehicle formations, transparent sprite bounds, SVG safety, GLB hierarchy/bounds/budgets, and continuous stop/pass motion. Direct non-default URLs were browser-tested after fixing a server/client query-state hydration mismatch. The first SVG pass also exposed missing intrinsic dimensions; the generator now writes explicit 512×256 dimensions so Three.js can upload the vectors reliably.

The 2026-08-16 Blender pass adds editable Blender 5.2 LTS masters, modular vehicle GLBs, and complete classic/new-generation formations as private-lab candidate D. The classic model follows the official 205.38 m formation and Class 1116/Viaggio Comfort dimensions; the new-generation model follows the official ten-vehicle-with-locomotive, 258 m formation and includes visibly lower entrances on seven cars. Production Railjet bytes remain unchanged pending user selection.

Twenty-eight automated tests now include Blender hierarchy, exact vehicle count, metre-scale bounds, distinct cab/door/bogie nodes, material count, grounding, and the 500 KB per-formation budget. Direct candidate-D URLs were browser-tested at desktop and 390×844 mobile sizes in parked, rain, night, pass-through, and three-simultaneous-train states. Both assets loaded without WebGL errors; the only console warning was Three.js's existing `Clock` deprecation notice.

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
- [New-generation Blender driving-trailer detail](../qa/railjet-lab/nextgen-blender-driving-trailer-detail.jpg)
- [Railjet night candidate](../qa/railjet-lab/classic-generated-night.jpg)
- [Three simultaneous procedural formations](../qa/railjet-lab/nextgen-hybrid-three-load.jpg)

## Known scope limits

- The train GLBs remain original low-poly interpretations with no protected logos, but no longer share a generic coach. Train families have distinct full-length silhouettes, cab masks, roof equipment, bogies, articulated or locomotive-hauled structure, door/window rhythms, liveries, and correct end roles. They are detailed diorama assets rather than scanned museum replicas.
- Longer soak balancing, China/France/Japan, extra steam variants, additional events, and second-station expansion remain future work.
- Mobile captures used Chrome software WebGL so their displayed FPS is not a hardware performance measurement. The in-app browser sustained 60 FPS with three simultaneous procedural formations at its desktop viewport; representative physical-mobile GPU profiling remains a follow-up.
