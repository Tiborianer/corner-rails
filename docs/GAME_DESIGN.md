# Corner Rails — concise game design

**High concept.** Corner Rails is a browser incremental game about growing a pocket-sized German rail stop into an international terminus. A locked orthographic camera presents a real low-poly station as a tactile isometric diorama. Trains arrive automatically; the player chooses how to spend scarce development opportunities, keeps the platforms clean, and earns access to increasingly prestigious real services.

**Player promise.** Every purchase changes both the economy and the diorama. A platform adds track frontage, length upgrades stretch the usable station, station tiers grow the building, and electrification, signals, road access, amenities, and a maintenance yard all appear in-world. The HUD stays compact and leaves the central playfield clear.

**Core loop.** Choose Germany → place the free platform → receive a one-car DB Class 650 → earn exactly 10 coins → serve automatic traffic → clean when dirt harms Station Rating → buy permanent development → tier up → meet better-train requirements → complete Tier 5 → prestige for +5 base rating per reset.

**Development tension.** Tiers 1–4 share exactly three permanent-purchase uses across platforms, length, systems, and amenities. The third purchase requires confirmation and locks further development until tier-up. It can be fully undone only until the next train dispatch. Tier-up costs coins but has no infrastructure prerequisite, preventing deadlocks. Tier 5 removes the cap and allows full international completion.

**Operations.** Cleanliness starts at 100%, falls by `0.8 + 0.1 × cars` after a visit, and falls faster during rain. Cleaning is a repeatable paid button, never an upgrade. Cleanliness supplies up to 20 Station Rating points; the remaining rating comes from tiers, platforms, length, systems, prestige, temporary boosts, and a rain penalty. Rating changes automatic spawn intervals through ×0.8/×1/×1.25/×1.5 bands.

**Content.** Germany has 18 scheduled trains: three unlock at each of Tiers 1–4 and six international trains unlock at Tier 5. Lower-tier services remain visible and available. Nightjet is night-only and pays exactly 20,000 coins. Rare event opportunities add the Tier 4 ICE-S record run (25,000 coins, +20 rating) and Tier 2 BR 01 steam festival (3,000 coins, +15 rating), both with ten-minute simulated boosts and developer triggers under `?debug=1`.

**World systems.** A 15-minute simulated day/night loop reserves five minutes for night. Seasons rotate every 30 simulated minutes. Each season has a deterministic 15% rain roll; rain lasts 2–5 simulated minutes, adds 10% dwell, multiplies arrival dirt by 1.5, removes 0.5 cleanliness per simulated minute, and applies a four-point rating penalty. Three rotating mission templates reward regular play. Simulation speed is 1×/2×/3× without changing UI motion or synthesized-audio pitch.

**Persistence and scope.** There is no backend, account, local storage, offline income, or autosave. Export creates a versioned `CR1` base64url save with an integrity checksum; import validates before replacing state. China, France, Japan, extra steam variants, additional events, and a second station remain future work.
