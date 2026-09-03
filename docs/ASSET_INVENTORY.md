# Asset inventory

## Implemented Germany assets

| Group | Implemented asset | Shipping form |
|---|---|---|
| Playfield | Metric ground, 1.435 m-gauge rails, sleepers, five calculated train lanes, dirt pieces, wet ground response | Shared procedural R3F geometry |
| Station | 90/130/170/220/280 m platform states, calculated clearances, lamps, shelters and metric-positioned building | Shared procedural R3F geometry |
| Systems | 5.5 m catenary, signals, full-width road with twelve distinct vehicle silhouettes and a drop-off bay, right-entry maintenance siding/depot, amenities | Shared low-poly R3F geometry |
| Weather/time | Gradual day/night, four ground palettes, rain and thunderstorm states, lightning, synthesized thunder, lighting and fog | Runtime shaders/materials/Web Audio |
| Scheduled trains | 15 temporary legacy complete-consist GLBs plus approved Blender Railjet, Nightjet and ICE 3 assets; Railjet has two formations behind one Tier 5 service record | `public/models/trains/*.glb`, `public/models/trains/blender/` |
| Event trains | Complete three-car ICE-S and BR 01/tender/heritage-coach consists | `ice-s.glb`, `br01.glb` |
| Consists | Train-specific locomotive, power-car, EMU, coach, double-deck, sleeper, control-car, articulated, and rear-power-car modules | Complete GLB composition |
| Events | ICE-S test look; steam smoke, bunting, festival colour accents | Runtime effects |
| UI | Region screen, HUD, build tray, train/tier/badges/save/help drawers, confirmation modals, tooltips, mission card | Responsive DOM/CSS |
| Marketing | Corner Rails social-preview card | `public/og.png` |
| Railjet lab A | Ten original transparent WebP modules for classic and new-generation Railjet formations | `public/railjet-lab/generated/` |
| Railjet lab B | Twelve deterministic, editable SVG vehicle-role modules with no embedded imagery or branding | `public/railjet-lab/vector/` |
| Railjet lab C | Separate classic and new-generation lofted procedural formations | `public/models/railjet-lab/*.glb` |
| Railjet production/lab D | Editable Blender 5.2 masters, calibrated 1.435 m wheel/rail contract, modular Taurus/coach/driving-trailer GLBs, and complete classic/new-generation formations | `assets/blender/`, `public/models/trains/blender/railjet/` |
| Railjet livery review V2 | Private classic and new-generation Railjet recolour candidates with authentic wine-red upper body, bright-red belt, graphite lower flank, aluminium skirt and generation-specific door/window treatment | `assets/blender/railjet-*-livery-v2/`, `public/models/train-lab/railjet-*-livery-v2/` |
| DB Regional-Express review R1 | Private four-vehicle BR 245 + double-deck push-pull candidate: diesel locomotive, mixed-class coach, second-class coach and driving trailer | `assets/blender/db-regional-express/`, `public/models/train-lab/db-regional-express/` |
| Nightjet production/lab N2 | Approved eight-vehicle Taurus 1116 + new-generation Nightjet formation: two sleepers, three couchettes, multifunction car and control/seat car | `assets/blender/nightjet-new-generation/`, `public/models/trains/blender/nightjet/` |
| ICE 3 review I3 | Private eight-car DB Class 403 redesign candidate with two cab ends, transformer/pantograph cars, converter cars, service car and distinct 403.3 Bordrestaurant | `assets/blender/ice3-br403/`, `public/models/train-lab/ice3-br403/` |
| ICE 3 review I3 V2 | Private reference-calibrated eight-car Class 403 formation. The approved checkpoint-7 cab appears at both ends, with matching transformer, converter, Bordrestaurant and service cars plus an original procedural decal atlas | `assets/blender/ice3-br403-v2/`, `public/models/train-lab/ice3-br403-v2/` |
| ICE 3 review I3 C | Private two-car Class 403 continuity checkpoint: rebuilt 403.0 end car and matching 403.1 transformer car using one shell profile, continuous black glazing recess and shared stripe datum | `assets/blender/ice3-br403-v2-continuity/`, `public/models/train-lab/ice3-br403-v2-continuity/` |
| ICE 3 production I3 U | Approved complete eight-car Class 403 unified formation: matching end, transformer, converter, Bordrestaurant and service cars; emissive lenses and one runtime headlight beam | `assets/blender/ice3-br403-v2-unified/`, `public/models/trains/blender/ice3/ice3-br403-unified-blender.glb` |

All GLBs use glTF 2.0. The two production Railjets, production Nightjet and production ICE 3 obey the approved metre-scale contract: X-forward, Y-lateral, Z-up in Blender, a named `rail_contact_origin`, standard-gauge wheel treads and a 0.071 world-units-per-metre runtime scale. The Railjet formations are about 227/283 KB and Nightjet N2 is about 238 KB after glTF Transform deduplication and pruning.

Candidate D is now the approved production Railjet. The laboratory and normal game load the same canonical GLBs; A–C remain comparison evidence. The old `public/models/trains/railjet.glb` remains only as a rollback/legacy artifact. Candidate D's calibration track stays inside its editable Blender review scenes and is deliberately excluded from the GLBs because React Three Fiber owns reusable railway infrastructure. Source image-generation sheets and Blender masters are not served publicly.

Every train other than Railjet, Nightjet and ICE 3 remains on a temporary `legacy-v1` presentation profile. Those profiles correct only gross lane/contact presentation in the new metric environment; they do not claim physical accuracy or replace the underlying model. The per-train approval process is documented in [TRAIN_ASSET_APPROVAL_WORKFLOW.md](TRAIN_ASSET_APPROVAL_WORKFLOW.md).

The ICE 3 I3 candidate remains private and does not replace `public/models/trains/ice3.glb`. Its editable Blender master and eight modular role GLBs use the same metric rail-contact contract as the approved production assets. The complete optimized review formation is approximately 188 KB; user reference images are recorded only by filename and are not copied or embedded.

The I3 V2 candidate has advanced from its cab gate to a complete private-review formation. Checkpoint 7 remains byte-for-byte available as the approval baseline, and its cab geometry is reused unchanged at both ends. Seven matching vehicles complete the 200.32 m set: transformer cars with raised/folded pantographs, powered converter cars, an asymmetric 403.3 Bordrestaurant, a service car and the reversed second-class end car. All cars share the approved pearl-white body, low widening red band, rounded shallow glazing, tall pressure-tight door language and standard-gauge contact contract. The optimized full formation is 580,612 bytes, uses 19 materials and one original 2048×512 decal atlas; eight modular vehicle GLBs are also available. V1 remains available for direct comparison, and production still loads the legacy ICE 3 until the complete V2 receives explicit approval.

I3 C is the approved continuity checkpoint created after the full V2 exposed a body-language mismatch. Its 403.0 and 403.1 passenger sections share the same 19-vertex 2.95 m cross-section, roof/floor datum, continuous matte-black glazing recess and 0.18 m red stripe at the slightly lower 1.84 m datum. The rebuilt end car is one loft from rear gangway to nose tip, so no separate nose-cap object is exported. Its cab-side glazing uses a reference-matched continuous dark ribbon: the rearmost pane is widened to 1.08 m toward the 1.16 m passenger-window module, all five panes reuse the passenger-glass material, and the remaining panes taper naturally into the front windscreen. The individual 403.0 and 403.1 modules remain editable and independently exportable.

I3 U extends that approved continuity contract across the complete 200.32 m formation. All eight vehicles use the identical body, window-band, stripe, door and gangway datums; role-specific windows and roof/underframe equipment distinguish the transformer, converter, service and asymmetric 403.3 Bordrestaurant cars. The approved production GLB is approximately 395 KB and the eight modular vehicle exports remain separately reusable. The front lamp lenses use `KHR_materials_emissive_strength`, while one combined React Three Fiber spot light moves with the leading cab and produces a single pool on the rails in day, night and rain. Normal gameplay now loads I3 U through the `metric-v1` registry. The former `public/models/trains/ice3.glb`, previous eight-car V2 and approved two-car checkpoint remain byte-identical as rollback and review baselines.

The DB Regional-Express R1 set is the first use of that process after Railjet. Its complete formation is about 157 KB after glTF Transform deduplication/pruning; its four reusable module GLBs are about 43–48 KB each. It is available only through `?trainLab=db-regional-express`. Its manifest records the supplied filenames but none of the local photographs are copied, embedded, served or used as textures. The candidate is deliberately unassigned to a production train record because the references depict a locomotive-hauled BR 245/Dosto set, not the current Siemens Desiro HC record. Production mapping will be decided only after visual approval.

Nightjet N2 was explicitly approved on 2026-08-21 and promoted to the Tier 5 production registry. Its complete 204.675 m formation is about 238 KB; six reusable review modules cover the Taurus, two sleeper layouts, couchette, multifunction car and control/seat car at roughly 37–44 KB each. The laboratory and normal game load the same canonical production formation. N2 uses the geometry-only red/silver Taurus treatment and selects its leading end once per arrival: 75% Taurus and 25% cab car. Both orientations enter from the same side and follow the same path. The manifest records the nine supplied filenames, but the images remain research-only and are not copied, embedded, served or used as textures.

## Planned assets

- China, France, and Japan train rosters and station dressing.
- Optional future LOD1/LOD2 meshes, KTX2 texture sets, animated doors, and operator-approved branding.
- BR 50 or another verified preserved locomotive, extra festivals, and special-charter decoration packs.
- Second-station map/selector and expansion-specific station props.

No protected operator logos or unlicensed downloadable models are shipped. Liveries use original colour blocking sufficient for recognition at diorama scale.
