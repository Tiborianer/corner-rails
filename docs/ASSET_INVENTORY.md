# Asset inventory

## Implemented Germany assets

| Group | Implemented asset | Shipping form |
|---|---|---|
| Playfield | Base diorama, rails, sleepers, five platform slots, dirt pieces, wet ground response | Instanced/procedural R3F geometry |
| Station | Tier 2–5 building growth, platform length states, lamps, shelters, kiosk | Procedural R3F geometry |
| Systems | Catenary, signals/ETCS indicator, road loop and moving car, maintenance shed, amenities | Reused low-poly geometry |
| Weather/time | Day, night, four ground palettes, rain particles, lighting and fog states | Runtime shaders/materials |
| Scheduled trains | 18 visually distinct train-head GLBs, one per scheduled record | `public/models/trains/*.glb` |
| Event trains | ICE-S measurement head and BR 01-style steam head | `ice-s.glb`, `br01.glb` |
| Consists | Low-poly locomotive/power-car/EMU head plus runtime coaches; double-deck, steam, night, ICE, and international material variants | Modular composition |
| Events | ICE-S test look; steam smoke, bunting, festival colour accents | Runtime effects |
| UI | Region screen, HUD, build tray, train/tier/save/help drawers, confirmation modals, tooltips, mission card | Responsive DOM/CSS |
| Marketing | Corner Rails social-preview card | `public/og.png` |

All GLBs use glTF 2.0, metres, Y-up, applied transforms, a stable forward axis, reusable materials, and gameplay-friendly origins. The generated train bundle contains 20 files and is far below the Tier 1 8 MB and later-tier 5 MB targets. Tier-based runtime requests provide practical lazy loading even though the tiny files do not require separate archives.

## Planned assets

- China, France, and Japan train rosters and station dressing.
- Higher-fidelity train-specific coach families, LOD1/LOD2 meshes, KTX2 texture sets, pantographs, bogies, and animated doors.
- BR 50 or another verified preserved locomotive, extra festivals, and special-charter decoration packs.
- Second-station map/selector and expansion-specific station props.

No protected operator logos or unlicensed downloadable models are shipped. Liveries use original colour blocking sufficient for recognition at diorama scale.

