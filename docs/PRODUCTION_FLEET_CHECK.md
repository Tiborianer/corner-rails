# Approved train availability

All seven approved Blender formations/liveries are wired into normal gameplay.
Earlier ICE 3 experiments and superseded Regional-Express R2 remain comparison
assets only; they must not replace the approved models.

| Service | Production formation | Testing-bar control |
| --- | --- | --- |
| Railjet | Classic V2.1, Taurus + seven coaches | Railjet classic V2.1 / Classic V2.1 cab |
| Railjet | New generation, Taurus + nine coaches | RJ new / RJ new cab |
| Nightjet | Approved N2 eight-vehicle formation | NJ Taurus / NJ cab car |
| DB Regional-Express | BR 245 + rounded R3 double-deck set | RE BR 245 / RE cab car |
| metronom | BR 146 curved livery, four vehicles | Metronom curved / Metronom curved cab |
| metronom | BR 146 straight-band livery, four vehicles | Metronom flat / Metronom flat cab |
| ICE 3 | Approved unified eight-car Class 403 | ICE 3 |

Metronom starts at Tier 2 and needs two platforms, length level 3,
electrification and signaling. Its liveries retain equal 50/50 chances.
Classic Railjet is Tier 5 with length level 4; new-generation Railjet needs
length level 5. Other existing service requirements remain unchanged.
Push-pull formations keep 75% locomotive-leading / 25% cab-car-leading arrivals.

Testing controls prepare a fully equipped station and dispatch the selected
production model onto platform 1 immediately. They do not require waiting for
a random arrival. Use normal gameplay or manual save codes for progression;
debug controls replace the station's current test state.

The production-fleet regression tests enumerate all metric registry variants,
check their normal eligibility and review-asset mapping, test their debug
dispatch/movement/save round trips, and verify classic Railjet V2.1 is
byte-identical to the approved review GLB.
