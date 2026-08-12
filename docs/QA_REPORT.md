# Screenshot-backed QA summary

The screenshots below document the original 2026-08-11 vertical slice. A 2026-08-12 visual revision replaced the shared boxy train recipe with family-specific lead vehicles and formations, moved onboarding to the lower corner, extended rails and terrain beyond the camera, grounded the platform on a full plinth, and added deterministic landscape scenery. Automated regression results for this revision are recorded in the repository build output; the earlier screenshots are retained as before/after evidence rather than presented as the revised visuals.

QA completed on **2026-08-11** in the Codex in-app Chromium browser plus Vitest/build validation.

## Automated acceptance coverage

- Nine deterministic simulation tests cover exact structural prices, the shared cap, system purchases, Tier 5 unlimited development, cleaning cost and cap exclusion, rating response, train and rain dirt, roster counts, Nightjet night eligibility/fixed payout, and save-code round-trip/damage rejection.
- Production build and rendered-HTML smoke test are part of `npm test`.
- The asset generator creates and optimizes all 20 train GLBs; the shipping bundle is approximately 160 KB before application compression.

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

- The train GLBs remain original compact low-poly interpretations with no protected logos. Train families now have distinct silhouettes, cab masks, roof equipment, window rhythms, liveries, and consist roles; they are readable game assets rather than museum-grade replicas.
- Longer soak balancing, China/France/Japan, extra steam variants, additional events, and second-station expansion remain future work.
