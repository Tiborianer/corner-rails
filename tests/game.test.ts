import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import path from "node:path";
import { LENGTH_COSTS, PLATFORM_COSTS, TRAINS, createInitialState } from "../app/game/data";
import { decodeSave, encodeSave } from "../app/game/save";
import {
  canPurchase,
  cleanStation,
  cleaningCost,
  daylightFactor,
  isNight,
  purchaseUpgrade,
  stationRating,
  tickGame,
  tierUp,
  trainMeetsRequirements,
} from "../app/game/simulation";
import type { GameState } from "../app/game/types";
import { catenaryPolePositions, trainMotionPosition } from "../app/game/visual";

function fundedState(): GameState {
  return {
    ...createInitialState(),
    region: "germany",
    platformPlaced: true,
    coins: 100_000,
  };
}

describe("Corner Rails economy and progression", () => {
  it("keeps the specified structural upgrade prices", () => {
    expect(PLATFORM_COSTS).toEqual([50, 150, 400, 10_000]);
    expect(LENGTH_COSTS).toEqual([30, 90, 1_200, 7_500]);
  });

  it("counts systems and structure against the same three-use cap", () => {
    let state = fundedState();
    state = purchaseUpgrade(state, { kind: "platform" });
    state = purchaseUpgrade(state, { kind: "system", system: "electrification" });
    state = purchaseUpgrade(state, { kind: "length" });
    expect(state.upgradesUsed).toBe(3);
    expect(canPurchase(state, { kind: "system", system: "signaling" }).allowed).toBe(false);
    const tiered = tierUp(state);
    expect(tiered.tier).toBe(2);
    expect(tiered.upgradesUsed).toBe(0);
  });

  it("removes the development cap at Tier 5", () => {
    let state = { ...fundedState(), tier: 5 as const, upgradesUsed: 3 };
    state = purchaseUpgrade(state, { kind: "platform" });
    state = purchaseUpgrade(state, { kind: "length" });
    state = purchaseUpgrade(state, { kind: "system", system: "electrification" });
    expect(state.platforms).toBe(2);
    expect(state.lengthLevel).toBe(2);
    expect(state.systems.electrification).toBe(true);
    expect(state.upgradesUsed).toBe(3);
  });
});

describe("gradual day and night presentation", () => {
  it("eases through dusk and dawn instead of switching lighting instantly", () => {
    expect(daylightFactor(0)).toBe(1);
    expect(daylightFactor(570)).toBeCloseTo(0.5);
    expect(daylightFactor(600)).toBe(0);
    expect(daylightFactor(840)).toBe(0);
    expect(daylightFactor(870)).toBeCloseTo(0.5);
    expect(daylightFactor(900)).toBe(1);
  });
});

describe("render helpers", () => {
  it("creates finite catenary positions across the complete corridor", () => {
    const poles = catenaryPolePositions(58);
    expect(poles).toHaveLength(10);
    expect(poles.every(Number.isFinite)).toBe(true);
    expect(poles[0]).toBeCloseTo(-26.8);
    expect(poles.at(-1)).toBeCloseTo(26.8);
  });

  it("provides continuous sub-frame train positions", () => {
    const first = trainMotionPosition("approach", 1, 5, -20, 4, 30);
    const nextFrame = trainMotionPosition("approach", 1 + 1 / 60, 5, -20, 4, 30);
    expect(nextFrame).toBeGreaterThan(first);
    expect(nextFrame - first).toBeLessThan(1);
  });

  it("ships three structurally distinct Tier 1 GLB models", async () => {
    const io = new NodeIO();
    const modelDirectory = path.resolve("public/models/trains");
    const signatures = [
      ["br650.glb", "single_car_chamfered_shell"],
      ["br642.glb", "desiro_red_chamfered_shell"],
      ["br648.glb", "lint_red_chamfered_shell"],
    ] as const;
    const nodeSets = await Promise.all(signatures.map(async ([file, signature]) => {
      const document = await io.read(path.join(modelDirectory, file));
      const names = document.getRoot().listNodes().map((node) => node.getName());
      expect(names).toContain(signature);
      return names.join("|");
    }));
    expect(new Set(nodeSets).size).toBe(3);
  });
});

describe("cleanliness and rating", () => {
  it("prices a full clean by dirt and tier without consuming development", () => {
    const state = { ...fundedState(), tier: 3 as const, cleanliness: 50, upgradesUsed: 1 };
    expect(cleaningCost(state)).toBe(200);
    const cleaned = cleanStation(state);
    expect(cleaned.cleanliness).toBe(100);
    expect(cleaned.coins).toBe(99_800);
    expect(cleaned.upgradesUsed).toBe(1);
  });

  it("low cleanliness lowers station rating", () => {
    const clean = fundedState();
    const dirty = { ...clean, cleanliness: 20 };
    expect(stationRating(clean) - stationRating(dirty)).toBe(16);
  });

  it("rain adds continuous dirt and multiplies arrival dirt", () => {
    const state: GameState = {
      ...fundedState(),
      raining: true,
      rainRemaining: 100,
      activeTrain: {
        trainId: "br650",
        phase: "depart",
        phaseElapsed: 4.95,
        phaseDuration: 5,
        payout: 10,
        firstService: false,
      },
    };
    const next = tickGame(state, 0.1);
    expect(next.activeTrain).toBeNull();
    expect(next.cleanliness).toBeLessThan(98.7);
  });
});

describe("train content and eligibility", () => {
  it("ships three scheduled trains at tiers 1-4 and six at tier 5", () => {
    for (const tier of [1, 2, 3, 4]) {
      expect(TRAINS.filter((train) => train.kind === "scheduled" && train.tier === tier)).toHaveLength(3);
    }
    expect(TRAINS.filter((train) => train.kind === "scheduled" && train.tier === 5)).toHaveLength(6);
    expect(TRAINS.filter((train) => train.kind === "event")).toHaveLength(2);
  });

  it("allows Nightjet only at night and fixes its payout at 20,000", () => {
    const nightjet = TRAINS.find((train) => train.id === "nightjet")!;
    const base: GameState = {
      ...fundedState(),
      tier: 5,
      platforms: 5,
      lengthLevel: 5,
      systems: {
        electrification: true,
        signaling: true,
        roadAccess: true,
        maintenance: true,
        amenities: true,
        advancedSignaling: true,
      },
    };
    expect(isNight(base)).toBe(false);
    expect(trainMeetsRequirements(base, nightjet)).toBe(false);
    const night = { ...base, simSeconds: 610 };
    expect(isNight(night)).toBe(true);
    expect(trainMeetsRequirements(night, nightjet)).toBe(true);
    expect(nightjet.payout).toEqual([20_000, 20_000]);
  });
});

describe("manual save codes", () => {
  it("round-trips serializable game state and rejects damage", () => {
    const state = { ...fundedState(), tier: 4 as const, cleanliness: 72, coins: 12_345 };
    const code = encodeSave(state);
    const decoded = decodeSave(code);
    expect(decoded.tier).toBe(4);
    expect(decoded.cleanliness).toBe(72);
    expect(decoded.coins).toBe(12_345);
    expect(() => decodeSave(`${code}x`)).toThrow(/damaged|incomplete/u);
  });
});
