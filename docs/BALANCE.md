# Balance table

## Structural economy

| Purchase | Result | Coins |
|---|---:|---:|
| Free starter | 1 platform | 0 |
| Platform 1–4 | 2 / 3 / 4 / 5 platforms | 50 / 150 / 400 / 10,000 |
| Length 1–4 | Levels 2 / 3 / 4 / international 5 | 30 / 90 / 1,200 / 7,500 |
| Tier 1→2 / 2→3 / 3→4 / 4→5 | Tier 2 / 3 / 4 / 5 | 500 / 2,000 / 8,000 / 30,000 |
| Electrification | Catenary and electric eligibility | 120 |
| Signaling | Express eligibility | 280 |
| Road access | Drop-off loop | 650 |
| Amenities | Shelter, lamps and kiosk | 420 |
| Maintenance yard | Long-distance maintenance eligibility | 1,800 |
| ETCS test package | ICE-S eligibility | 5,000 |

## Cleaning

`cost = ceil(tier maximum × dirt% ÷ 100)`. The button restores 100% cleanliness and consumes no development use.

| Tier | Maximum cleaning price at 0% cleanliness |
|---:|---:|
| 1 | 25 |
| 2 | 100 |
| 3 | 400 |
| 4 | 1,600 |
| 5 | 6,000 |

Each completed visit removes approximately `0.8 + 0.1 × cars` cleanliness. Rain multiplies arrival dirt by 1.5 and removes another 0.5% per simulated minute.

## Scheduled service payouts

| Tier | Trains | Payout range per completed visit |
|---:|---|---:|
| 1 | Class 650 / Class 642 / Class 648 | 10–16 / 14–22 / 18–30 |
| 2 | Desiro HC / metronom / Talent 2 | 55–90 / 80–125 / 95–150 |
| 3 | FlixTrain / IC1 / IC2 | 320–520 / 480–720 / 650–900 |
| 4 | ICE 2 / ICE 3 / ICE 4 | 1,500–2,400 / 2,400–3,500 / 3,400–4,500 |
| 5 | Railjet / Nightjet / TGV / RegioJet / Giruno / ComfortJet | 6,000–9,000 / **20,000 fixed** / 8,000–13,000 / 7,000–11,000 / 10,000–15,000 / 12,000–18,000 |
| Events | BR 01 festival / ICE-S record run | **3,000 fixed** / **25,000 fixed** |

## Rating and spawn pacing

`rating = clamp(permanent + cleanliness × 0.20 + temporary boosts − weather penalty, 0, 100)`.

| Source | Rating points |
|---|---:|
| Station tier | +5 per tier |
| Platforms | +3 each |
| Length | +2 each level |
| Regular system | +5 each |
| ETCS test package | +3 |
| Prestige | +5 per prestige |
| Cleanliness | 0–20 |
| Rain | −4 |
| Mission boost | +5 for 5 simulated minutes |
| Steam festival / ICE-S | +15 / +20 for 10 simulated minutes |

Base automatic interval is `48 ÷ multiplier`, clamped to 10–60 simulated seconds.

| Rating | Multiplier | Example interval |
|---:|---:|---:|
| 0–20 | ×0.8 | 60 s |
| 21–60 | ×1.0 | 48 s |
| 61–90 | ×1.25 | 38.4 s |
| 91–100 | ×1.5 | 32 s |

