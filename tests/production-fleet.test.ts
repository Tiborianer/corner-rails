import { readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createInitialState, TRAINS } from "../app/game/data";
import { debugState, eligibleTrains, tickGame, trainMeetsRequirements } from "../app/game/simulation";
import { resolveTrainVisualVariant, selectTrainVisualVariant, trainVisualVariants } from "../app/game/trainVisuals";
import { TRAIN_REVIEW_CANDIDATES } from "../app/game/trainReviewData";
import { decodeSave, encodeSave } from "../app/game/save";

const previews = [
  ["railjet-classic", "railjet", "railjet-classic", 1],
  ["railjet-classic-cab-car", "railjet", "railjet-classic", -1],
  ["railjet-nextgen", "railjet", "railjet-nextgen", 1],
  ["railjet-nextgen-cab-car", "railjet", "railjet-nextgen", -1],
  ["regional-express-locomotive", "db-regional-express", "db-regional-express-br245-dosto", 1],
  ["regional-express-cab-car", "db-regional-express", "db-regional-express-br245-dosto", -1],
  ["metronom-curved", "metronom", "metronom-curved", 1],
  ["metronom-curved-cab-car", "metronom", "metronom-curved", -1],
  ["metronom-flat", "metronom", "metronom-flat", 1],
  ["metronom-flat-cab-car", "metronom", "metronom-flat", -1],
  ["nightjet-taurus", "nightjet", "nightjet-new-generation", 1],
  ["nightjet-cab-car", "nightjet", "nightjet-new-generation", -1],
  ["ice3-unified", "ice3", "ice3-br403-unified", 1],
] as const;

describe("complete approved production fleet", () => {
  it.each(previews)("dispatches %s through normal gameplay with the approved asset", (mode, trainId, variantId, orientation) => {
    const state = debugState(createInitialState(), mode);
    const active = state.platformLanes[0].activeTrain!;
    const train = TRAINS.find((t) => t.id === trainId)!;
    expect(active).toMatchObject({ trainId, visualVariantId: variantId, phase: "approach" });
    expect(active.formationOrientation ?? 1).toBe(orientation);
    expect(trainMeetsRequirements(state, train)).toBe(true);
    expect(resolveTrainVisualVariant(train, active.visualVariantId).profile).toBe("metric-v1");
    expect(tickGame(state, 0.1).platformLanes[0].activeTrain!.phaseElapsed).toBeGreaterThan(0);
    expect(decodeSave(encodeSave(state)).platformLanes[0].activeTrain).toEqual(active);
  });

  it("has a working debug control and a shared approved review asset for every metric variant", async () => {
    const ui = await readFile("app/CornerRails.tsx", "utf8");
    const ready = debugState(debugState(createInitialState(), "tier5"), "night");
    const eligible = new Set(eligibleTrains(ready).map((t) => t.id));
    const metric = TRAINS.flatMap((train) => trainVisualVariants(train)
      .filter((v) => v.profile === "metric-v1").map((variant) => ({train, variant})));
    expect(metric).toHaveLength(7);
    for (const {train, variant} of metric) {
      expect(eligible.has(train.id)).toBe(true);
      const preview = previews.find((p) => p[2] === variant.id)!;
      expect(preview).toBeDefined();
      expect(ui).toContain(`mode: "${preview[0]}"`);
      expect(Object.values(TRAIN_REVIEW_CANDIDATES).some((c) => c.approvalStatus === "approved-production" && c.assetPath === `/${variant.assetPath}`)).toBe(true);
      expect((await stat(`public/${variant.assetPath}`)).size).toBeGreaterThan(1000);
    }
  });

  it("keeps the latest classic Railjet byte-identical to the approved V2.1 review model", async () => {
    expect(await readFile("public/models/trains/blender/railjet/railjet-classic-blender.glb"))
      .toEqual(await readFile("public/models/train-lab/railjet-classic-livery-v2/railjet-classic-livery-v2.glb"));
  });

  it("retains equal Metronom livery chances and normal infrastructure requirements", () => {
    const train = TRAINS.find((t) => t.id === "metronom")!;
    expect(selectTrainVisualVariant(train, 3, 0.499999).id).toBe("metronom-curved");
    expect(selectTrainVisualVariant(train, 3, 0.5).id).toBe("metronom-flat");
    const ready = { ...debugState(createInitialState(), "tier5"), tier: 2 as const, platforms: 2, lengthLevel: 3 };
    expect(trainMeetsRequirements(ready, train)).toBe(true);
    expect(trainMeetsRequirements({...ready, systems: {...ready.systems, electrification: false}}, train)).toBe(false);
    expect(trainMeetsRequirements({...ready, systems: {...ready.systems, signaling: false}}, train)).toBe(false);
    expect(trainMeetsRequirements({...ready, lengthLevel: 2}, train)).toBe(false);
  });
});
