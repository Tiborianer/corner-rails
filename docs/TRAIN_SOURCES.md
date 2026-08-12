# Verified Germany train-source record

Checked against primary operator, manufacturer, or museum material on **2026-08-12**. Gameplay car counts are representative consists for the diorama; sources establish the vehicle/service identity and the tooltip fact. Where an operator uses variable consists, the record says so rather than implying one immutable formation.

| Tier | Game record | Representative consist | Primary record used |
|---:|---|---:|---|
| 1 | DB Class 650 Regio-Shuttle RS1 | 1 car | [Stadler RS1/RS ZERO data](https://www.stadlerrail.com/api/docs/x/fec656e35b/rszero_hemu_en.pdf) |
| 1 | DB Class 642 Desiro Classic | 2 cars | [Siemens Desiro Classic operational test](https://press.siemens.com/global/en/pressrelease/consortium-develops-safe-remote-controlled-system-ai-based-obstacle-detection-rail) |
| 1 | DB Class 648 LINT 41 | 2 cars | [Alstom DB LINT 41 order](https://www.alstom.com/de/press-releases-news/2009/11/Deutsche-Bahn-bestellt-16-Coradia-Lint-Regionalzuge-20091127) |
| 2 | Siemens Desiro HC Regional-Express | 4 cars | [Siemens/DB Regio Desiro HC order](https://press.siemens.com/global/de/pressemitteilung/db-regio-bayern-und-siemens-mobility-unterzeichnen-vertrag-ueber-31-regionalzuege) |
| 2 | metronom Double-Deck Express | locomotive + 5 cars | [metronom vehicle information](https://www.der-metronom.de/unternehmen/ueber-uns/) |
| 2 | DB Regio Talent 2 | 4 cars | [DB Regio service categories](https://www.dbregio.de/schiene/zugverkehre) |
| 3 | FlixTrain Refurbished Intercity | representative 10 cars | [Flix current fleet: 140 refurbished coaches forming 10–20 trainsets](https://corporate.flix.com/flix-brands/) |
| 3 | DB Intercity IC1 | locomotive + 8 cars | [DB 2024 fleet/quality report](https://ir.deutschebahn.com/fileadmin/Englisch/2025e/DB24_Quality_Report.pdf) |
| 3 | DB Intercity 2 | 6 cars | [DB 2024 fleet/quality report](https://ir.deutschebahn.com/fileadmin/Englisch/2025e/DB24_Quality_Report.pdf) |
| 4 | ICE 2 | 8 cars | [DB 2024 fleet/quality report](https://ir.deutschebahn.com/fileadmin/Englisch/2025e/DB24_Quality_Report.pdf) |
| 4 | ICE 3 | 8 cars | [DB 2024 fleet/quality report](https://ir.deutschebahn.com/fileadmin/Englisch/2025e/DB24_Quality_Report.pdf) |
| 4 | ICE 4 | 12 cars | [DB report listing 7-, 12-, and 13-car Class 412 sets](https://ir.deutschebahn.com/fileadmin/Englisch/2025e/DB24_Quality_Report.pdf) |
| 5 | ÖBB Railjet | locomotive + 7-car set | [ÖBB train information](https://www.oebb.at/en/reiseplanung-services/im-zug/unsere-zuege/railjet) |
| 5 | ÖBB Nightjet | representative 11-car maximum | [ÖBB 2025/26 figures: variable 3–11-coach consists](https://static.web.oebb.at/bericht/2025/zahlen-daten-fakten/64/) and [Germany service material](https://www.nightjet.com/dam/jcr%3A6d74c6d1-0c5e-44a2-8b25-5e08c2a51bdb/folder-nightjet-promo-deutschland-de.pdf) |
| 5 | TGV Euroduplex | 2 power cars + 8 trailers | [SNCF Euroduplex double-deck record](https://www.sncf-voyageurs.com/medias-publics/2024-08/230427%20-%20OUIGO%20ESPAGNE%20ALICANTE.pdf) |
| 5 | Czech RegioJet International | representative 9 cars | [RegioJet international train services](https://regiojet.com/our-tickets/types-of-tickets) |
| 5 | SBB Giruno | 11-car unit | [SBB: 202 m international Germany–Switzerland–Italy train](https://www.sbb.ch/en/travel-information/services-on-train/our-trains/giruno.html) |
| 5 | ČD ComfortJet | 9-car unit | [ČD: nine-car, 237 m, 230 km/h international set](https://www.ceskedrahy.cz/en/comfortjet) |
| Event | ICE-S Record Run | 3 cars | [DB: 76 m measurement train, 398 km/h in 2001](https://www.deutschebahn.com/de/konzern/Im-Fokus/-S-wie-Speed-Der-Hochgeschwindigkeitsmesszug-der-DB-7594140) |
| Event | BR 01 Steam Festival | locomotive + 5 heritage coaches | [DB Museum: 01 1100, built 1940, 140 km/h](https://www.dbmuseum.de/koblenz/fahrzeuge/01-1100) |

“RegioJet” is used only for the Czech operator at Tier 5. Tier 2 contains a verified DB Regio Talent 2 instead; DB’s own service categories remain S-Bahn, Regionalbahn, and Regional-Express.

## Implemented complete-consist visual-recognition pass

The original procedural assets intentionally omit protected logos, but each GLB now includes the entire representative formation and encodes the train-family cues visible in the primary records:

- **Tier 1:** the RS1 is a single long chamfered railcar with Stadler’s characteristic trapezoidal side-window lattice, red door and compact roof equipment; Class 642 uses a separate two-ended articulated Desiro body with a rounded wraparound black cab, red shell, silver window ribbon and articulation bellows; LINT 41 uses a longer two-ended body with a distinctly flatter cab, broad windshield, two door groups and larger roof HVAC equipment.
- **Tier 2:** Desiro HC mixes high-capacity end cars with double-deck centre cars; metronom uses a blue/yellow electric locomotive, double-deck trailers, and control coach; Talent 2 uses its bulbous dark “hamster cheek” nose.
- **Tier 3:** FlixTrain is a green electric locomotive with refurbished single-deck trailers; IC1 uses a locomotive-led single-deck formation; IC2 uses a modern locomotive with double-deck trailers and a control end.
- **Tier 4:** ICE 2 has the older wedge power head and paired windscreen; ICE 3 has a smooth rounded continuous mask; ICE 4 has a longer angular nose, squarer glass, black side mask, and red belt.
- **Tier 5:** Railjet uses a Taurus-style red locomotive, dedicated coaches, and a driving trailer; Nightjet has a Vectron, midnight-blue sleepers/couchettes, varied window rhythms, and accessible low-entry details; TGV Euroduplex has low pointed power cars at both ends and two window decks; RegioJet has a yellow Vectron and yellow/black coaches; Giruno is a complete eleven-car articulated low-floor EMU with a sharp black mask and red chin; ComfortJet has a blue/white Vectron, nine-car family structure, and a distinct driving trailer.
- **Events:** ICE-S is a three-car measurement set with grey measurement band, sensor rack, and dedicated pantograph; BR 01 uses a 4-6-2-style black boiler, red chassis and driving wheels, smoke deflectors, tender, and heritage coaches.

Formation choices were rechecked against the [metronom fleet record](https://www.der-metronom.de/unternehmen/ueber-uns/), [Flix current fleet record](https://corporate.flix.com/flix-brands/), [DB vehicle overview](https://www.deutschebahn.com/de/Fahrzeuge-der-DB-6854978), [Siemens Desiro HC record](https://press.siemens.com/global/en/pressrelease/db-regio-bayern-and-siemens-mobility-sign-contract-31-regional-trains), [ÖBB Railjet record](https://www.oebb.at/en/reiseplanung-services/im-zug/unsere-zuege/railjet), [SBB Giruno record](https://www.sbb.ch/en/travel-information/services-on-train/our-trains/giruno.html), [ČD ComfortJet record](https://www.ceskedrahy.cz/en/press-center/press-releases/first-comfortjet-train-set-has-arrived-test-circuit-velim), and [DB ICE-S record](https://www.deutschebahn.com/de/konzern/Im-Fokus/-S-wie-Speed-Der-Hochgeschwindigkeitsmesszug-der-DB-7594140).
