# metronom M1 — four-vehicle Blender review

Status: **promoted following the user's two-livery spawning request on 2026-09-12**. See `METRONOM_M2_DBRE_R3.md` for current behavior. The notes below preserve the first-review record.

## Reference interpretation

The supplied close locomotive reference reads ME 146-12 / 146 512-9. This candidate follows the Class 146.2-family TRAXX 2 appearance, not the Regional-Express's BR 245 diesel. The operator lists the 146.1, 146.2 and 147.5 families, and Märklin identifies its metronom locomotive model as Class 146.2.

Sources:

- [metronom fleet](https://www.der-metronom.de/unternehmen/ueber-uns/)
- [Operator carriage arrangement](https://www.der-metronom.com/fahrplan/wagenreihung/)
- [Märklin metronom Class 146.2 reference](https://www.marklin.com/products/details/article/26611)
- [DB double-deck dimensional reference](https://www.deutschebahn.com/resource/blob/12723972/27f230ccadd935116edcb92217fda017/DB-Wg-D_____11-2004_Doppelstock-data.pdf)

“Four cars” is interpreted as **four vehicles total**, matching the supplied `metronom_full_consist.jpg`: locomotive, second-class double-decker, bicycle double-decker, driving trailer. This shortened 100.2 m formation is a user-selected game formation, not a claim about the operator's usual full-length consist. Exact Dosto subseries and maintenance-era details remain visual approximations pending review.

## Implemented

- Separate electric locomotive and tall rounded driving-trailer geometry; no BR 245 repaint.
- Yellow sides, curved white sweeps, blue doors and sills, blue locomotive roof, grey coach roofs.
- Split locomotive windscreen; one-piece cab-car windscreen with wiper, destination panel and three emissive lamp positions.
- Roof-following upper-deck windows, lower-deck windows, double-leaf doors, underframe, bogies, buffers, couplers, two pantographs and roof electrical equipment.
- Four modular GLBs and one assembled GLB; editable Blender master with non-exported review rails.
- Metres, X-forward/Z-up source, glTF Y-up export, 1.435 m gauge, zero tread contact plane and 5.5 m raised collector.
- Review controls: stationary/stopping/pass-through, day/night/rain, inspection scale, one/three trains, locomotive/cab-car leading. Both orientations travel in the same direction.

References are recorded by filename only. No supplied photographs, copied textures or operator logos are shipped. Small details are original simplified geometry, not a photorealistic scan.

## Files and reproduction

- `scripts/blender/generate_metronom.py`
- `scripts/optimize-metronom-assets.mjs`
- `assets/blender/metronom-br146/metronom-br146-master.blend`
- `assets/blender/metronom-br146/manifest.json`
- `public/models/train-lab/metronom-br146/`
- `qa/train-review/metronom-br146/` — seven Blender review renders

Run `npm run assets:metronom-blender`, then `npm run qa:metronom-blender`.

## QA record — 2026-09-12

- 82 Vitest tests passed, including four new metronom checks: vehicle roles, 32 grounded wheels, gauge, 5.5 m collector, contact origins, curved livery, lamps, absence of reference textures, review gate and movement continuity.
- Lint, Sites production build, rendered-HTML test and GitHub Pages build passed. Existing large-bundle warnings remain; no physical-phone performance claim is made.
- Complete formation: approximately 1.10 MB uncompressed GLB / 204 KB gzip; four reusable modules. glTF Transform deduplication and pruning preserve emissive strength.
- Visually reviewed Blender side/front/three-quarter outputs and actual browser day/night/rain states, normal scale, both orientations and three-train load.
- Corrected shell-conforming livery/window surfaces and directional-light self-shadow acne discovered during review.
- Browser logs: no WebGL errors observed; existing Three.Clock deprecation warning remains.
- Desktop readings around 100–115 FPS in sampled states. Mobile-size viewport is a layout test on the Mac, not a physical-phone GPU benchmark. Mode changes may briefly lower the displayed sample.
- Appearance approval is still required before replacing production metronom.
