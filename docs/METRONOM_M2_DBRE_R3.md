# Metronom M2 and Regional-Express R3

## Metronom: production

User requested a second livery and equal spawning on 2026-09-12. Two metric visual variants now share the same service: `metronom-curved` and `metronom-flat`. Each has selection weight 1, identical infrastructure requirements, four vehicles, and a 100.2 m formation. The flat variant uses a horizontal yellow lower half, white upper side and blue trim; this is a user-requested interpretation, not a new claim about a specific dated fleet revision.

Selection occurs once per dispatch. The saved visual variant is retained through movement and import/export. Older metronom saves default/migrate to the curved set. Cab-car leading remains independently 25%, locomotive leading 75%. No payouts, dwell times, spawn weights or upgrade requirements changed. Car count now matches the requested four-vehicle set, so length-based arrival dirt follows four vehicles.

Reproduce: generate the existing metronom normally, generate again with `-- --flat`, optimize each folder (`--flat` for the second), then run `node scripts/prepare-metronom-and-dosto.mjs` after generating R3. The last step copies the two optimized production formations and records the production metadata.

## Regional-Express: review only

R3 preserves the BR 245 generator and replaces the two coaches and driving trailer. Its body has a continuous rounded upper-deck/roof cross-section, conformed glass and seals, thin horizontal white belt, white double-leaf doors with rounded windows, grey lower fairings and gangways. The cab is a raked, laterally crowned surface with a fitted grey surround, one-piece windscreen, wiper, destination display and lamps.

The supplied real rear/front photograph defines the cab treatment; the side-model references define door/window rhythm. Sources consulted:

- [RMV double-deck vehicle information](https://www.rmv.de/c/de/fahrplan/linien-netze/fahrzeugtypen/regionalzuege/doppelstockwagen-lokbespannt/doppelstockwagen) — search-indexed accessibility/entry descriptions; direct page was unavailable.
- [Tillig double-deck models](https://www.tillig.com/Produkte/Doppelstockwagen.html) — DBpbzfa 766 / DBpza 780 reference identification.
- [Additional DBpbzfa 766 photographic reference](https://www.bahnbilder.de/bild/deutschland~strecken~kbs-590-halle-kasseler-bahn/1233205/blick-auf-einen-doppelstock-steuerwagen-der-2.html) — searched image reference; no photo downloaded or shipped.

This is an original reference-guided model, not a scan. No exact carriage subtype is asserted from these mixed references. Photographs and protected logos are not embedded. The current production R2 formation remains unchanged, SHA-256 `40d531dadbfe6fe2e3ba35a921dde336c820414752ad720f1b50d062a76f2a56`.

## Review evidence

Blender side/front/three-quarter renders: `qa/train-review/db-regional-express-r3/` and `qa/train-review/metronom-br146-flat/`. These were visually inspected; the initial overly wide cab surround was corrected before final export. Current-turn checks cover exported GLBs, selection boundaries, 1,000 equal-spaced probability samples, saved variant/orientation, curved glazing, vehicle count and preserved production separation. No new browser interaction/performance benchmark is claimed for this pass.

Private routes: `?trainLab=metronom-br146-flat` and `?trainLab=db-regional-express-r3`. Existing comparison links provide access to the curved metronom and previous Regional-Express.

Validation: 84 Vitest tests passed; lint, Sites production build, rendered-HTML test and GitHub Pages build all passed. Browser GPU/performance testing was not repeated in this pass.
