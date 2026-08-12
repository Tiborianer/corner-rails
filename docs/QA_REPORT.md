# Screenshot-backed QA summary

The screenshots below document the original 2026-08-11 vertical slice. A 2026-08-12 visual revision replaced the shared boxy train recipe with family-specific lead vehicles and formations, moved onboarding to the lower corner, extended rails and terrain beyond the camera, grounded the platform on a full plinth, and added deterministic landscape scenery. Automated regression results for this revision are recorded in the repository build output; the earlier screenshots are retained as before/after evidence rather than presented as the revised visuals.

A second 2026-08-12 regression pass corrected the catenary crash, isolated train loading from the rest of the diorama, added frame-by-frame train-motion extrapolation above the 10 Hz deterministic simulation, and replaced the Tier 1 bodies with three longer chamfered rail-vehicle shells. Daylight now eases through a one-minute dusk and one-minute dawn, including sky, fog, ambient light, directional light, hemisphere light, and station-window colour. Thirteen automated checks now include finite electrification geometry, continuous sub-frame motion, gradual daylight values, and distinct node signatures for all three Tier 1 GLBs.

The per-platform operations revision replaces the global train timer with one serializable lane per built platform. Regression coverage verifies lane creation/refund, simultaneous automatic spawns, concurrent phase progression, independent completion/countdown reset, and multi-lane save-code round-trips. The DOM arrival surface is now a compact platform board rather than a single-service card.

The complete-consist asset revision removes the shared runtime coach entirely. All 20 GLBs now include their full representative formation: recognisable regional articulated units, locomotive-hauled single- and double-deck stock, ICE end cars and intermediate equipment, Railjet and ComfortJet driving trailers, Nightjet sleeper variants, two-ended TGV Euroduplex power cars, the eleven-car Giruno, the ICE-S measurement car, and the BR 01 tender/heritage formation. Automated asset checks verify all twenty files, formation length, unique hierarchy signatures, international end-role nodes, and the complete bundle budget.

QA completed on **2026-08-11** in the Codex in-app Chromium browser plus Vitest/build validation.

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

## Known scope limits

- The train GLBs remain original low-poly interpretations with no protected logos, but no longer share a generic coach. Train families have distinct full-length silhouettes, cab masks, roof equipment, bogies, articulated or locomotive-hauled structure, door/window rhythms, liveries, and correct end roles. They are detailed diorama assets rather than scanned museum replicas.
- Longer soak balancing, China/France/Japan, extra steam variants, additional events, and second-station expansion remain future work.
