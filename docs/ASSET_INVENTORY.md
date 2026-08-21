# Asset inventory

## Implemented Germany assets

| Group | Implemented asset | Shipping form |
|---|---|---|
| Playfield | Metric ground, 1.435 m-gauge rails, sleepers, five calculated train lanes, dirt pieces, wet ground response | Shared procedural R3F geometry |
| Station | 90/130/170/220/280 m platform states, calculated clearances, lamps, shelters and metric-positioned building | Shared procedural R3F geometry |
| Systems | 5.5 m catenary, signals, full-width road with twelve traffic variants, maintenance siding/depot, amenities | Shared low-poly R3F geometry |
| Weather/time | Day, night, four ground palettes, rain particles, lighting and fog states | Runtime shaders/materials |
| Scheduled trains | 17 temporary legacy complete-consist GLBs plus two approved Blender Railjet formations behind one Tier 5 service record | `public/models/trains/*.glb`, `public/models/trains/blender/railjet/` |
| Event trains | Complete three-car ICE-S and BR 01/tender/heritage-coach consists | `ice-s.glb`, `br01.glb` |
| Consists | Train-specific locomotive, power-car, EMU, coach, double-deck, sleeper, control-car, articulated, and rear-power-car modules | Complete GLB composition |
| Events | ICE-S test look; steam smoke, bunting, festival colour accents | Runtime effects |
| UI | Region screen, HUD, build tray, train/tier/save/help drawers, confirmation modals, tooltips, mission card | Responsive DOM/CSS |
| Marketing | Corner Rails social-preview card | `public/og.png` |
| Railjet lab A | Ten original transparent WebP modules for classic and new-generation Railjet formations | `public/railjet-lab/generated/` |
| Railjet lab B | Twelve deterministic, editable SVG vehicle-role modules with no embedded imagery or branding | `public/railjet-lab/vector/` |
| Railjet lab C | Separate classic and new-generation lofted procedural formations | `public/models/railjet-lab/*.glb` |
| Railjet production/lab D | Editable Blender 5.2 masters, calibrated 1.435 m wheel/rail contract, modular Taurus/coach/driving-trailer GLBs, and complete classic/new-generation formations | `assets/blender/`, `public/models/trains/blender/railjet/` |
| DB Regional-Express review R1 | Private four-vehicle BR 245 + double-deck push-pull candidate: diesel locomotive, mixed-class coach, second-class coach and driving trailer | `assets/blender/db-regional-express/`, `public/models/train-lab/db-regional-express/` |
| Nightjet production/lab N2 | Approved eight-vehicle Taurus 1116 + new-generation Nightjet formation: two sleepers, three couchettes, multifunction car and control/seat car | `assets/blender/nightjet-new-generation/`, `public/models/trains/blender/nightjet/` |

All GLBs use glTF 2.0. The two production Railjets and production Nightjet additionally obey the approved metre-scale contract: X-forward, Y-lateral, Z-up in Blender, a named `rail_contact_origin`, standard-gauge wheel treads and a 0.071 world-units-per-metre runtime scale. The Railjet formations are about 227/283 KB and Nightjet N2 is about 238 KB after glTF Transform deduplication and pruning.

Candidate D is now the approved production Railjet. The laboratory and normal game load the same canonical GLBs; A–C remain comparison evidence. The old `public/models/trains/railjet.glb` remains only as a rollback/legacy artifact. Candidate D's calibration track stays inside its editable Blender review scenes and is deliberately excluded from the GLBs because React Three Fiber owns reusable railway infrastructure. Source image-generation sheets and Blender masters are not served publicly.

Every train other than Railjet and Nightjet remains on a temporary `legacy-v1` presentation profile. Those profiles correct only gross lane/contact presentation in the new metric environment; they do not claim physical accuracy or replace the underlying model. The per-train approval process is documented in [TRAIN_ASSET_APPROVAL_WORKFLOW.md](TRAIN_ASSET_APPROVAL_WORKFLOW.md).

The DB Regional-Express R1 set is the first use of that process after Railjet. Its complete formation is about 157 KB after glTF Transform deduplication/pruning; its four reusable module GLBs are about 43–48 KB each. It is available only through `?trainLab=db-regional-express`. Its manifest records the supplied filenames but none of the local photographs are copied, embedded, served or used as textures. The candidate is deliberately unassigned to a production train record because the references depict a locomotive-hauled BR 245/Dosto set, not the current Siemens Desiro HC record. Production mapping will be decided only after visual approval.

Nightjet N2 was explicitly approved on 2026-08-21 and promoted to the Tier 5 production registry. Its complete 204.675 m formation is about 238 KB; six reusable review modules cover the Taurus, two sleeper layouts, couchette, multifunction car and control/seat car at roughly 37–44 KB each. The laboratory and normal game load the same canonical production formation. N2 uses the geometry-only red/silver Taurus treatment and selects its leading end once per arrival: 75% Taurus and 25% cab car. Both orientations enter from the same side and follow the same path. The manifest records the nine supplied filenames, but the images remain research-only and are not copied, embedded, served or used as textures.

## Planned assets

- China, France, and Japan train rosters and station dressing.
- Optional future LOD1/LOD2 meshes, KTX2 texture sets, animated doors, and operator-approved branding.
- BR 50 or another verified preserved locomotive, extra festivals, and special-charter decoration packs.
- Second-station map/selector and expansion-specific station props.

No protected operator logos or unlicensed downloadable models are shipped. Liveries use original colour blocking sufficient for recognition at diorama scale.
