# Asset inventory

## Implemented Germany assets

| Group | Implemented asset | Shipping form |
|---|---|---|
| Playfield | Base diorama, rails, sleepers, five platform slots, dirt pieces, wet ground response | Instanced/procedural R3F geometry |
| Station | Tier 2–5 building growth, platform length states, lamps, shelters, kiosk | Procedural R3F geometry |
| Systems | Catenary, signals/ETCS indicator, full-width road with twelve traffic variants, maintenance siding/depot, amenities | Reused low-poly geometry |
| Weather/time | Day, night, four ground palettes, rain particles, lighting and fog states | Runtime shaders/materials |
| Scheduled trains | 18 visually distinct complete-consist GLBs, one per scheduled record | `public/models/trains/*.glb` |
| Event trains | Complete three-car ICE-S and BR 01/tender/heritage-coach consists | `ice-s.glb`, `br01.glb` |
| Consists | Train-specific locomotive, power-car, EMU, coach, double-deck, sleeper, control-car, articulated, and rear-power-car modules | Complete GLB composition |
| Events | ICE-S test look; steam smoke, bunting, festival colour accents | Runtime effects |
| UI | Region screen, HUD, build tray, train/tier/save/help drawers, confirmation modals, tooltips, mission card | Responsive DOM/CSS |
| Marketing | Corner Rails social-preview card | `public/og.png` |

All GLBs use glTF 2.0, metres, Y-up, applied transforms, a stable forward axis, reusable materials, and gameplay-friendly origins. Every multi-car record now ships as one complete consist, preventing generic runtime coaches from erasing its identity. The generated 20-file bundle is about 760 KB and remains far below the Tier 1 8 MB and later-tier 5 MB targets. Tier-based runtime requests provide practical lazy loading even though the files do not require separate archives.

## Planned assets

- China, France, and Japan train rosters and station dressing.
- Optional future LOD1/LOD2 meshes, KTX2 texture sets, animated doors, and operator-approved branding.
- BR 50 or another verified preserved locomotive, extra festivals, and special-charter decoration packs.
- Second-station map/selector and expansion-specific station props.

No protected operator logos or unlicensed downloadable models are shipped. Liveries use original colour blocking sufficient for recognition at diorama scale.
