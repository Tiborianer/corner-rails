import { describe, expect, it } from "vitest";
import { getBounds, NodeIO } from "@gltf-transform/core";
import { KHRMaterialsEmissiveStrength } from "@gltf-transform/extensions";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { LENGTH_COSTS, PLATFORM_COSTS, TIER_COSTS, TRAINS, createInitialState } from "../app/game/data";
import { BADGES } from "../app/game/badges";
import { decodeSave, encodeSave } from "../app/game/save";
import {
  canPurchase,
  awardBadges,
  cleanStation,
  cleaningCost,
  chooseTrainFormationOrientation,
  NIGHTJET_CAB_CAR_LEADING_CHANCE,
  NIGHTJET_TAURUS_LEADING_CHANCE,
  WEATHER_RAIN_CHANCE,
  WEATHER_THUNDERSTORM_CHANCE,
  daylightFactor,
  debugState,
  isNight,
  isWetWeather,
  purchaseUpgrade,
  stationRating,
  tickGame,
  tierUp,
  trainMeetsRequirements,
  triggerEvent,
  undoLastUpgrade,
  weatherArrivalDirtMultiplier,
  weatherDirtPerMinute,
  weatherDwellMultiplier,
  weatherFromRoll,
  weatherRatingPenalty,
  nightjetFormationOrientationForRoll,
} from "../app/game/simulation";
import type { GameState } from "../app/game/types";
import {
  TRAFFIC_CAR_KINDS,
  TRAFFIC_MINIMUM_GAP,
  TRAFFIC_VEHICLE_DEFINITIONS,
  catenaryPolePositions,
  createTrafficFleet,
  maintenanceSidingControlPoints,
  platformFixturePositions,
  platformPointLightPositions,
  platformSignalPositions,
  seededLitterLayout,
  stepTrafficFleet,
  trafficVehicleYaw,
  trafficLaneClearances,
  trainMotionPosition,
} from "../app/game/visual";
import {
  RAILJET_METHODS,
  RAILJET_METRIC_PROFILE,
  RAILJET_PROTOTYPES,
  generatedVehicleAsset,
  railjetLabMotionPosition,
  railjetMetersToWorld,
} from "../app/game/railjetLabData";
import {
  PRODUCTION_TRACK_CENTER_SPACING_METERS,
  RAILWAY_METRIC_PROFILE,
  metricPlatformCenter,
  platformLengthMeters,
  productionTrackCenter,
  railwayMetersToWorld,
} from "../app/game/metricRailway";
import {
  ICE3_VISUAL_VARIANTS,
  NIGHTJET_VISUAL_VARIANTS,
  RAILJET_VISUAL_VARIANTS,
  resolveTrainVisualVariant,
  selectTrainVisualVariant,
  trainVisualVariants,
} from "../app/game/trainVisuals";
import {
  TRAIN_REVIEW_CANDIDATES,
  TRAIN_REVIEW_METRIC_SCALE,
  trainReviewFormationRotation,
  trainReviewMotionPosition,
} from "../app/game/trainReviewData";

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

  it("keeps the Tier 1 station upgrade at exactly 500 coins", () => {
    expect(TIER_COSTS).toEqual([500, 2_000, 8_000, 30_000]);
    const ready = { ...fundedState(), upgradesUsed: 3 };
    const tiered = tierUp(ready);
    expect(tiered.tier).toBe(2);
    expect(tiered.coins).toBe(99_500);
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
    let state: GameState = { ...fundedState(), tier: 5, upgradesUsed: 3 };
    state = purchaseUpgrade(state, { kind: "platform" });
    state = purchaseUpgrade(state, { kind: "length" });
    state = purchaseUpgrade(state, { kind: "system", system: "electrification" });
    expect(state.platforms).toBe(2);
    expect(state.lengthLevel).toBe(2);
    expect(state.systems.electrification).toBe(true);
    expect(state.upgradesUsed).toBe(3);
  });
});

describe("badges", () => {
  it("defines twelve unique achievements with short clues", () => {
    expect(BADGES).toHaveLength(12);
    expect(new Set(BADGES.map((badge) => badge.id)).size).toBe(12);
    expect(BADGES.every((badge) => badge.clue.length <= 45)).toBe(true);
  });

  it("awards milestone and difficult badges from real game state", () => {
    const previous = fundedState();
    const completed = {
      ...previous,
      tier: 5 as const,
      platforms: 5,
      lengthLevel: 5,
      systems: Object.fromEntries(Object.keys(previous.systems).map((key) => [key, true])) as GameState["systems"],
      weather: "thunderstorm" as const,
      lifetimeCoins: 1_000_000,
      cleanedFromCritical: true,
      stormNightjetServed: true,
      prestige: 3,
      boosts: [{ id: "badge-test", label: "Badge test", amount: 20, remaining: 60 }],
      servedTrainIds: TRAINS.map((train) => train.id),
      platformLanes: Array.from({ length: 5 }, (_, platformIndex) => ({
        platformIndex,
        spawnCountdown: 0,
        activeTrain: {
          trainId: TRAINS[platformIndex].id,
          phase: "dwell" as const,
          phaseElapsed: 1,
          phaseDuration: 10,
          payout: 10,
          firstService: false,
        },
      })),
    };
    const awarded = awardBadges(previous, completed);
    expect(awarded.unlockedBadges).toHaveLength(BADGES.length);
    expect(new Set(awarded.unlockedBadges)).toEqual(new Set(BADGES.map((badge) => badge.id)));
  });

  it("keeps badges through prestige and save-code round trips", () => {
    const state = {
      ...fundedState(),
      unlockedBadges: ["grand-terminus", "storm-watcher"] as GameState["unlockedBadges"],
      servedTrainIds: ["nightjet", "ice-s"],
      cleanedFromCritical: true,
      stormNightjetServed: true,
    };
    const restored = decodeSave(encodeSave(state));
    expect(restored.unlockedBadges).toEqual(state.unlockedBadges);
    expect(restored.servedTrainIds).toEqual(state.servedTrainIds);
    expect(restored.cleanedFromCritical).toBe(true);
    expect(restored.stormNightjetServed).toBe(true);
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

  it("moves a run-through train continuously from entry to exit", () => {
    const entry = trainMotionPosition("pass", 0, 10, -34, 4, 36);
    const halfway = trainMotionPosition("pass", 5, 10, -34, 4, 36);
    const exit = trainMotionPosition("pass", 10, 10, -34, 4, 36);
    expect(entry).toBe(-34);
    expect(halfway).toBeCloseTo(1);
    expect(exit).toBe(36);
  });

  it("provides at least ten distinct road-traffic silhouettes", () => {
    expect(TRAFFIC_VEHICLE_DEFINITIONS).toHaveLength(12);
    expect(new Set(TRAFFIC_VEHICLE_DEFINITIONS.map((vehicle) => vehicle.id)).size).toBe(12);
    expect(new Set(TRAFFIC_VEHICLE_DEFINITIONS.map((vehicle) => `${vehicle.length}:${vehicle.width}:${vehicle.height}`)).size).toBeGreaterThanOrEqual(10);
    expect(TRAFFIC_CAR_KINDS.length).toBeGreaterThanOrEqual(10);
  });

  it("faces procedural road vehicles in their direction of travel", () => {
    expect(trafficVehicleYaw(1)).toBe(Math.PI);
    expect(trafficVehicleYaw(-1)).toBe(0);
  });

  it("keeps deterministic two-lane traffic separated while a vehicle visits the drop-off bay", () => {
    for (const speed of [1, 2, 3] as const) {
      let fleet = createTrafficFleet();
      let observedStop = false;
      for (let step = 0; step < 4_800; step += 1) {
        fleet = stepTrafficFleet(fleet, 0.05, speed);
        observedStop ||= fleet.some((vehicle) => vehicle.phase === "dwelling");
        expect(Math.min(...trafficLaneClearances(fleet))).toBeGreaterThanOrEqual(TRAFFIC_MINIMUM_GAP - 0.001);
      }
      expect(observedStop).toBe(true);
    }
  });

  it("lights every platform and creates stable varied litter within platform bounds", () => {
    const platformZs = [-1, -0.5, 0, 0.5, 1];
    expect(platformFixturePositions(platformZs, 20)).toHaveLength(20);
    expect(platformPointLightPositions(platformZs, 20)).toHaveLength(10);
    expect(platformPointLightPositions(platformZs, 20, true)).toHaveLength(5);
    expect(platformPointLightPositions([0], 20, false, 0.4)).toEqual([
      { x: -2.4, z: -0.1 },
      { x: 2.4, z: 0.1 },
    ]);
    expect(platformSignalPositions(platformZs, 20, 0.14)).toEqual(platformZs.map((z) => ({
      x: 10.28,
      z: z - 0.14,
    })));
    const dirty = seededLitterLayout(0, platformZs, 20, 0.355);
    expect(dirty).toHaveLength(60);
    expect(new Set(dirty.map((piece) => piece.kind)).size).toBeGreaterThanOrEqual(5);
    expect(dirty).toEqual(seededLitterLayout(0, platformZs, 20, 0.355));
    expect(dirty.every((piece) => Math.abs(piece.x) <= 9.6)).toBe(true);
    expect(seededLitterLayout(100, platformZs, 20, 0.355)).toEqual([]);
  });

  it("routes the maintenance siding from the right corridor into the depot", () => {
    const points = maintenanceSidingControlPoints({ trackLength: 60, platformLength: 20, rearTrackZ: -1, depotZ: -3, depotCenterX: 0.2 });
    expect(points[0]).toEqual({ x: 30, z: -1 });
    expect(points[1].x).toBeGreaterThan(points[2].x);
    expect(points.at(-1)).toEqual({ x: -0.25, z: -3 });
  });

  it("ships three structurally distinct Tier 1 complete-consist GLBs", async () => {
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

  it("ships all twenty full consists with unique hierarchies and realistic formation extents", async () => {
    const io = new NodeIO();
    const modelDirectory = path.resolve("public/models/trains");
    const hierarchySignatures = new Set<string>();
    let bundleBytes = 0;

    for (const train of TRAINS) {
      const modelPath = path.join(modelDirectory, `${train.modelKey}.glb`);
      const document = await io.read(modelPath);
      const nodes = document.getRoot().listNodes();
      const bounds = getBounds(document.getRoot().listScenes()[0]);
      const formationLength = bounds.max[0] - bounds.min[0];
      bundleBytes += (await stat(modelPath)).size;
      hierarchySignatures.add(nodes.map((node) => node.getName()).sort().join("|"));

      expect(nodes.some((node) => node.getName() === `${train.id}_train_root`)).toBe(true);
      if (train.cars > 1) {
        expect(nodes.some((node) => node.getName().startsWith(`${train.id}_car_1_`))).toBe(true);
        expect(formationLength).toBeGreaterThan(train.cars * 0.75);
      }
      expect(formationLength).toBeLessThan(train.cars * 2.2 + 2);
    }

    expect(hierarchySignatures.size).toBe(TRAINS.length);
    expect(bundleBytes).toBeLessThan(1_000_000);
  });

  it("gives every international formation its defining consist role", async () => {
    const io = new NodeIO();
    const modelDirectory = path.resolve("public/models/trains");
    const requiredNodes: Record<string, string> = {
      railjet: "railjet_car_7_tail_cab_face",
      nightjet: "nightjet_car_10_chamfered_train_shell",
      "tgv-duplex": "tgv-duplex_car_9_tail_nose_tip",
      "regiojet-cz": "regiojet-cz_car_8_chamfered_train_shell",
      giruno: "giruno_car_10_tail_nose_tip",
      comfortjet: "comfortjet_car_8_tail_cab_face",
    };
    for (const [modelKey, requiredNode] of Object.entries(requiredNodes)) {
      const document = await io.read(path.join(modelDirectory, `${modelKey}.glb`));
      expect(document.getRoot().listNodes().map((node) => node.getName())).toContain(requiredNode);
    }
  });
});

describe("Railjet visual bake-off assets", () => {
  it("defines all four methods for both authentic formation lengths", () => {
    expect(RAILJET_METHODS.map((method) => method.id)).toEqual(["generated-2d", "vector-2d", "hybrid-3d", "blender-3d"]);
    expect(RAILJET_PROTOTYPES.classic).toMatchObject({ vehicleCount: 8, lengthMeters: 205.38 });
    expect(RAILJET_PROTOTYPES.nextgen).toMatchObject({ vehicleCount: 10, lengthMeters: 258 });
    expect(RAILJET_PROTOTYPES.classic.consist).toHaveLength(8);
    expect(RAILJET_PROTOTYPES.nextgen.consist).toHaveLength(10);
    expect(RAILJET_PROTOTYPES.classic.consist.at(-1)?.role).toBe("driving-trailer");
    expect(RAILJET_PROTOTYPES.nextgen.consist.at(-1)?.role).toBe("driving-trailer");
  });

  it("ships transparent, normalized generated modules inside the per-generation budget", async () => {
    for (const definition of Object.values(RAILJET_PROTOTYPES)) {
      const uniqueFrames = [...new Set(definition.consist.map((vehicle) => vehicle.generatedFrame))];
      let bytes = 0;
      for (const frame of uniqueFrames) {
        const assetPath = path.resolve("public", generatedVehicleAsset(definition, frame).slice(1));
        const metadata = await sharp(assetPath).metadata();
        bytes += (await stat(assetPath)).size;
        expect(metadata).toMatchObject({ width: 512, height: 512, hasAlpha: true, format: "webp" });
      }
      expect(bytes).toBeLessThan(750_000);
    }
  });

  it("ships deterministic SVG modules without embedded images, text, or protected operator marks", async () => {
    for (const definition of Object.values(RAILJET_PROTOTYPES)) {
      const uniqueAssets = [...new Set(definition.consist.map((vehicle) => vehicle.vectorAsset))];
      let bytes = 0;
      for (const asset of uniqueAssets) {
        const assetPath = path.resolve("public", asset.slice(1));
        const content = await readFile(assetPath, "utf8");
        bytes += Buffer.byteLength(content);
        expect(content).toContain("<svg");
        expect(content).not.toMatch(/<(?:image|text)\b/i);
        expect(content).not.toMatch(/ÖBB|logo|trademark/i);
      }
      expect(bytes).toBeLessThan(200_000);
    }
  });

  it("ships optimized metre-scaled hybrid GLBs with stable pivots and correct relative lengths", async () => {
    const io = new NodeIO();
    const lengths: Record<string, number> = {};
    for (const definition of Object.values(RAILJET_PROTOTYPES)) {
      const modelPath = path.resolve("public", definition.hybridAsset.slice(1));
      const document = await io.read(modelPath);
      const root = document.getRoot();
      const scene = root.listScenes()[0];
      const bounds = getBounds(scene);
      const length = bounds.max[0] - bounds.min[0];
      lengths[definition.id] = length;
      expect(root.listNodes().map((node) => node.getName())).toContain(`${definition.id}_railjet_hybrid_root`);
      expect(root.listNodes().filter((node) => /^\w+_vehicle_\d+_(?:locomotive|economy|restaurant|first|multifunction|driving-trailer)$/.test(node.getName()))).toHaveLength(definition.vehicleCount);
      expect(root.listMaterials().length).toBeLessThanOrEqual(9);
      expect(bounds.min[1]).toBeGreaterThanOrEqual(0);
      expect(Math.abs(bounds.max[0] + bounds.min[0])).toBeLessThan(1);
      expect((await stat(modelPath)).size).toBeLessThan(500_000);
    }
    expect(lengths.nextgen).toBeGreaterThan(lengths.classic * 1.2);
  });

  it("ships Blender-authored GLBs with exact formations, stable pivots, distinct vehicles, and web budgets", async () => {
    const io = new NodeIO();
    const lengths: Record<string, number> = {};
    for (const definition of Object.values(RAILJET_PROTOTYPES)) {
      const modelPath = path.resolve("public", definition.blenderAsset.slice(1));
      const document = await io.read(modelPath);
      const root = document.getRoot();
      const scene = root.listScenes()[0];
      const bounds = getBounds(scene);
      const length = bounds.max[0] - bounds.min[0];
      const nodeNames = root.listNodes().map((node) => node.getName());
      const prefix = definition.id === "classic" ? "railjet_classic" : "railjet_nextgen";
      const formationRoot = root.listNodes().find((node) => node.getName() === `${prefix}_blender_root`);
      lengths[definition.id] = length;

      expect(formationRoot).toBeDefined();
      expect(formationRoot?.getExtras()).toMatchObject({
        units: "meters",
        forward_axis: "+X",
        lateral_axis: "+Y",
        up_axis: "+Z",
        standard_gauge_m: 1.435,
        wheel_tread_center_m: 0.7175,
        rail_contact_plane_z: 0,
        pantograph_contact_height_m: 5.5,
      });
      const contactAnchor = root.listNodes().find((node) => node.getName() === "rail_contact_origin");
      expect(contactAnchor?.getWorldTranslation()).toEqual([0, 0, 0]);
      expect(nodeNames.some((name) => name.startsWith("review_"))).toBe(false);
      expect(nodeNames.filter((name) => /^vehicle_\d\d_/.test(name))).toHaveLength(definition.vehicleCount);
      expect(new Set(nodeNames.filter((name) => /^vehicle_\d\d_/.test(name))).size).toBe(definition.vehicleCount);
      expect(nodeNames.some((name) => name.includes("taurus_cab") && name.includes("windshield"))).toBe(true);
      expect(nodeNames.some((name) => name.includes("driving") && name.includes("windshield"))).toBe(true);
      expect(nodeNames.some((name) => name.includes("bogie"))).toBe(true);
      expect(nodeNames.some((name) => name.includes("door"))).toBe(true);
      const wheelNodes = root.listNodes().filter((node) => /_wheel_-?1_[01](?:\.\d+)?$/.test(node.getName()));
      expect(wheelNodes.length).toBeGreaterThan(0);
      for (const wheel of wheelNodes) {
        expect(Math.abs(wheel.getWorldTranslation()[2])).toBeCloseTo(0.7175, 4);
        const wheelRadius = wheel.getName().includes("taurus") ? 0.575 : 0.46;
        expect(wheel.getWorldTranslation()[1] - wheelRadius).toBeCloseTo(0, 4);
      }
      expect(root.listMaterials().length).toBeLessThanOrEqual(13);
      expect(bounds.min[1]).toBeGreaterThanOrEqual(-0.05);
      expect(Math.abs(bounds.max[0] + bounds.min[0])).toBeLessThan(0.1);
      expect(length).toBeCloseTo(definition.lengthMeters, 0);
      expect((await stat(modelPath)).size).toBeLessThan(500_000);
    }
    expect(lengths.nextgen).toBeGreaterThan(lengths.classic * 1.2);
  });

  it("uses one physical Candidate D scale for wheels, rails, formations, platforms, and catenary", async () => {
    const worldGauge = railjetMetersToWorld(RAILJET_METRIC_PROFILE.standardGaugeMeters);
    const railCenterOffset = worldGauge / 2;
    const classicLength = railjetMetersToWorld(RAILJET_PROTOTYPES.classic.lengthMeters);
    const nextgenLength = railjetMetersToWorld(RAILJET_PROTOTYPES.nextgen.lengthMeters);
    const platformLength = railjetMetersToWorld(RAILJET_METRIC_PROFILE.platformLengthMeters);
    const contactWireY = RAILJET_METRIC_PROFILE.railTopY + railjetMetersToWorld(RAILJET_METRIC_PROFILE.catenaryContactHeightMeters);
    const wheelCenterOffset = railjetMetersToWorld(0.7175);
    const vehicleWidth = railjetMetersToWorld(RAILJET_METRIC_PROFILE.vehicleWidthMeters);
    const laneSpacing = railjetMetersToWorld(RAILJET_METRIC_PROFILE.trackCenterSpacingMeters);
    const platformClearance = railjetMetersToWorld(RAILJET_METRIC_PROFILE.platformEdgeClearanceMeters);

    expect(RAILJET_METRIC_PROFILE.metersToWorld).toBe(0.071);
    expect(railCenterOffset).toBeCloseTo(0.0509425, 7);
    expect(classicLength).toBeCloseTo(14.58198, 4);
    expect(nextgenLength).toBeCloseTo(18.318, 4);
    expect(nextgenLength / classicLength).toBeGreaterThan(1.25);
    expect(platformLength).toBeCloseTo(19.88, 5);
    expect(contactWireY).toBeCloseTo(0.6855, 5);
    expect(Math.abs(wheelCenterOffset - railCenterOffset)).toBeLessThan(0.005);
    expect(Math.abs(RAILJET_METRIC_PROFILE.railTopY - (0 * RAILJET_METRIC_PROFILE.metersToWorld + RAILJET_METRIC_PROFILE.railTopY))).toBeLessThan(0.005);
    expect(laneSpacing - vehicleWidth).toBeGreaterThan(0.15);
    expect(platformClearance).toBeCloseTo(0.0142, 5);

    for (const generation of ["classic", "nextgen"] as const) {
      const manifestPath = path.resolve("assets/blender", generation === "classic" ? "railjet-classic" : "railjet-nextgen", "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      expect(manifest).toMatchObject({
        schemaVersion: 2,
        productionRailjetModified: true,
        assetContract: {
          units: "meters",
          forwardAxis: "+X",
          lateralAxis: "+Y",
          upAxis: "+Z",
          standardGaugeMeters: 1.435,
          railContactPlaneZ: 0,
          railContactAnchor: "rail_contact_origin",
          wheelTreadCentersMeters: [-0.7175, 0.7175],
          pantographContactHeightMeters: 5.5,
          calibrationTrackExported: false,
        },
      });
    }
  });

  it("keeps stopping and pass-through lab motion continuous and outside the map at cycle edges", () => {
    expect(railjetLabMotionPosition("stationary", 999)).toBe(0);
    expect(railjetLabMotionPosition("stopping", 0)).toBe(-27);
    expect(railjetLabMotionPosition("stopping", 5)).toBe(0);
    expect(railjetLabMotionPosition("stopping", 11)).toBe(0);
    expect(railjetLabMotionPosition("stopping", 17.99)).toBeGreaterThan(26);
    const passA = railjetLabMotionPosition("pass", 3);
    const passB = railjetLabMotionPosition("pass", 3 + 1 / 60);
    expect(passB).toBeGreaterThan(passA);
    expect(passB - passA).toBeLessThan(1);
  });
});

describe("per-train Blender approval laboratory", () => {
  it("registers the DB Regional-Express candidate only for private review", () => {
    expect(TRAIN_REVIEW_CANDIDATES["db-regional-express"]).toMatchObject({
      approvalStatus: "private-review",
      productionTrainId: "unassigned",
      assetRevision: "1",
      vehicleCount: 4,
      nominalLengthMeters: 99.84,
      traction: "diesel",
    });
    expect(TRAIN_REVIEW_METRIC_SCALE).toBe(RAILWAY_METRIC_PROFILE.metersToWorld);
    const productionVisual = trainVisualVariants({ id: "desiro-hc", modelKey: "desiro-hc" })[0];
    expect(productionVisual.profile).toBe("legacy-v1");
    expect(productionVisual.assetPath).toContain("models/trains/desiro-hc.glb");
  });

  it("ships a metre-scaled four-vehicle BR 245 double-deck review formation", async () => {
    const candidate = TRAIN_REVIEW_CANDIDATES["db-regional-express"];
    const modelPath = path.resolve("public", candidate.assetPath.slice(1));
    const io = new NodeIO();
    const document = await io.read(modelPath);
    const root = document.getRoot();
    const nodeNames = root.listNodes().map((node) => node.getName());
    const formationRoot = root.listNodes().find((node) => node.getName() === "db_regional_express_blender_root");
    const bounds = getBounds(root.listScenes()[0]);
    const exportedLength = bounds.max[0] - bounds.min[0];

    expect(formationRoot?.getExtras()).toMatchObject({
      units: "meters",
      forward_axis: "+X",
      lateral_axis: "+Y",
      up_axis: "+Z",
      standard_gauge_m: 1.435,
      wheel_tread_center_m: 0.7175,
      rail_contact_plane_z: 0,
      approval_status: "private review only",
    });
    expect(nodeNames.filter((name) => /^vehicle_\d\d_/.test(name))).toHaveLength(4);
    expect(nodeNames).toContain("vehicle_00_br245");
    expect(nodeNames).toContain("vehicle_01_mixed_class");
    expect(nodeNames).toContain("vehicle_02_second_class");
    expect(nodeNames).toContain("vehicle_03_driving_trailer");
    expect(nodeNames.some((name) => name.includes("br245_engine_grille"))).toBe(true);
    expect(nodeNames.some((name) => name.includes("driving_trailer_front_windscreen"))).toBe(true);
    expect(nodeNames.some((name) => name.includes("upper_window"))).toBe(true);
    expect(nodeNames.some((name) => name.includes("lower_window"))).toBe(true);
    expect(nodeNames.some((name) => name.startsWith("review_"))).toBe(false);
    expect(root.listNodes().find((node) => node.getName() === "rail_contact_origin")?.getWorldTranslation()).toEqual([0, 0, 0]);
    expect(exportedLength).toBeGreaterThan(99.8);
    expect(exportedLength).toBeLessThan(101.2);
    expect(Math.abs(bounds.max[0] + bounds.min[0])).toBeLessThan(0.1);
    expect(root.listMaterials().length).toBeLessThanOrEqual(14);
    expect((await stat(modelPath)).size).toBeLessThan(500_000);

    const wheels = root.listNodes().filter((node) => /_wheel_-?1_[01](?:\.\d+)?$/.test(node.getName()));
    expect(wheels).toHaveLength(32);
    for (const wheel of wheels) {
      const [,, lateral] = wheel.getWorldTranslation();
      const radius = wheel.getName().includes("br245") ? 0.625 : 0.46;
      expect(Math.abs(lateral)).toBeCloseTo(0.7175, 4);
      expect(wheel.getWorldTranslation()[1] - radius).toBeCloseTo(0, 4);
    }
  });

  it("uses continuous stopping and pass-through motion for the review candidate", () => {
    expect(trainReviewMotionPosition("stationary", 999)).toBe(0);
    expect(trainReviewMotionPosition("stopping", 0)).toBe(-27);
    expect(trainReviewMotionPosition("stopping", 5)).toBe(0);
    expect(trainReviewMotionPosition("stopping", 11)).toBe(0);
    expect(trainReviewMotionPosition("stopping", 17.99)).toBeGreaterThan(26);
    expect(trainReviewMotionPosition("pass", 3 + 1 / 60)).toBeGreaterThan(trainReviewMotionPosition("pass", 3));
    expect(trainReviewFormationRotation("taurus")).toBe(0);
    expect(trainReviewFormationRotation("cab-car")).toBe(Math.PI);
  });

  it("records user reference filenames without copying or embedding the images", async () => {
    const manifest = JSON.parse(await readFile(path.resolve("assets/blender/db-regional-express/manifest.json"), "utf8"));
    expect(manifest).toMatchObject({
      candidateId: "db-regional-express-dosto-br245",
      approvalStatus: "private-review",
      productionRegistryModified: false,
      userReferenceFilenames: [
        "Regio_Clean_side_view.jpg",
        "Regio_miniature_view.jpg",
        "Regio_real_photo_back view.jpg",
        "Regio_single_cabcar_side_view.jpg",
      ],
      assetContract: {
        units: "meters",
        standardGaugeMeters: 1.435,
        railContactPlaneZ: 0,
        railContactAnchor: "rail_contact_origin",
        wheelTreadCentersMeters: [-0.7175, 0.7175],
        traction: "diesel",
        pantographContactHeightMeters: null,
        calibrationTrackExported: false,
      },
    });
    expect(manifest.referencePolicy).toContain("not copied");
  });

  it("keeps the original eight-car ICE 3 BR403 candidate as a private baseline", () => {
    expect(TRAIN_REVIEW_CANDIDATES["ice3-br403"]).toMatchObject({
      approvalStatus: "private-review",
      productionTrainId: "ice3",
      assetRevision: "1",
      vehicleCount: 8,
      nominalLengthMeters: 200.32,
      traction: "electric",
    });
    const productionVisual = trainVisualVariants({ id: "ice3", modelKey: "ice3" })[0];
    expect(productionVisual).toEqual(ICE3_VISUAL_VARIANTS[0]);
  });

  it("ships a calibrated BR403 formation with the dedicated 403.3 Bordrestaurant", async () => {
    const candidate = TRAIN_REVIEW_CANDIDATES["ice3-br403"];
    const modelPath = path.resolve("public", candidate.assetPath.slice(1));
    const document = await new NodeIO().read(modelPath);
    const root = document.getRoot();
    const nodeNames = root.listNodes().map((node) => node.getName());
    const formationRoot = root.listNodes().find((node) => node.getName() === "ice3_br403_blender_root");
    const bounds = getBounds(root.listScenes()[0]);
    const exportedLength = bounds.max[0] - bounds.min[0];

    expect(formationRoot?.getExtras()).toMatchObject({
      units: "meters",
      forward_axis: "+X",
      lateral_axis: "+Y",
      up_axis: "+Z",
      standard_gauge_m: 1.435,
      wheel_tread_center_m: 0.7175,
      rail_contact_plane_z: 0,
      pantograph_contact_height_m: 5.5,
      approval_status: "private review only",
      bordrestaurant_vehicle: "vehicle_03_bordrestaurant_403_3",
    });
    expect(nodeNames.filter((name) => /^vehicle_\d\d_/.test(name))).toEqual([
      "vehicle_00_first_end_403_0",
      "vehicle_01_first_transformer_403_1",
      "vehicle_02_second_converter_403_2",
      "vehicle_03_bordrestaurant_403_3",
      "vehicle_04_service_403_8",
      "vehicle_05_second_converter_403_7",
      "vehicle_06_second_transformer_403_6",
      "vehicle_07_second_end_403_5",
    ]);
    expect(nodeNames.some((name) => name.includes("front_windscreen_visor"))).toBe(true);
    expect(nodeNames.some((name) => name.includes("nose_red_sweep"))).toBe(true);
    expect(nodeNames.some((name) => name.includes("bordrestaurant_403_3_galley_blank_panel"))).toBe(true);
    expect(nodeNames.some((name) => name.includes("bordrestaurant_403_3_restaurant_identity_panel"))).toBe(true);
    expect(nodeNames.some((name) => name.includes("first_transformer_403_1_pantograph_collector"))).toBe(true);
    expect(nodeNames.some((name) => name.startsWith("review_"))).toBe(false);
    expect(root.listNodes().find((node) => node.getName() === "rail_contact_origin")?.getWorldTranslation()).toEqual([0, 0, 0]);
    expect(exportedLength).toBeGreaterThan(200.2);
    expect(exportedLength).toBeLessThan(200.5);
    expect(Math.abs(bounds.max[0] + bounds.min[0])).toBeLessThan(0.01);
    expect(root.listMaterials().length).toBeLessThanOrEqual(14);
    expect((await stat(modelPath)).size).toBeLessThan(500_000);

    const wheels = root.listNodes().filter((node) => /_wheel_-?1_[01](?:\.\d+)?$/.test(node.getName()));
    expect(wheels).toHaveLength(64);
    for (const wheel of wheels) {
      const [, vertical, lateral] = wheel.getWorldTranslation();
      expect(Math.abs(lateral)).toBeCloseTo(0.7175, 4);
      expect(vertical - 0.46).toBeCloseTo(0, 4);
    }
  });

  it("records the ICE 3 references, exact consist and non-production approval state", async () => {
    const manifest = JSON.parse(await readFile(path.resolve("assets/blender/ice3-br403/manifest.json"), "utf8"));
    expect(manifest).toMatchObject({
      candidateId: "ice3-br403-redesign",
      approvalStatus: "private-review",
      productionRegistryModified: false,
      vehicleCount: 8,
      lengthMeters: 200.32,
      consist: [
        "first_end_403_0",
        "first_transformer_403_1",
        "second_converter_403_2",
        "bordrestaurant_403_3",
        "service_403_8",
        "second_converter_403_7",
        "second_transformer_403_6",
        "second_end_403_5",
      ],
      bordrestaurant: { vehicleIndex: 3, class: "403.3", redesignSeatCount: 20 },
      userReferenceFilenames: [
        "ice_3_front_sideview.jpg.avif",
        "ice_3_front_forwardview.jpg.avif",
        "ice_car_sideview.jpg",
        "ICE_3_second_class_car_sideview.png.webp",
        "ice_3_front-side_view.jpeg",
      ],
      assetContract: {
        units: "meters",
        standardGaugeMeters: 1.435,
        railContactPlaneZ: 0,
        railContactAnchor: "rail_contact_origin",
        wheelTreadCentersMeters: [-0.7175, 0.7175],
        traction: "distributed-electric",
        pantographContactHeightMeters: 5.5,
        calibrationTrackExported: false,
      },
    });
    expect(manifest.referencePolicy).toContain("not copied");
  });

  it("keeps the previous complete ICE 3 V2 formation as a private baseline", () => {
    expect(TRAIN_REVIEW_CANDIDATES["ice3-br403-v2"]).toMatchObject({
      approvalStatus: "private-review",
      reviewStage: "formation",
      productionTrainId: "ice3",
      assetRevision: "formation-1",
      vehicleCount: 8,
      nominalLengthMeters: 200.32,
      traction: "electric",
    });
    expect(TRAIN_REVIEW_CANDIDATES["ice3-br403"]).toMatchObject({
      approvalStatus: "private-review",
      reviewStage: "formation",
      assetRevision: "1",
      vehicleCount: 8,
    });
    const productionVisual = trainVisualVariants({ id: "ice3", modelKey: "ice3" })[0];
    expect(productionVisual).toEqual(ICE3_VISUAL_VARIANTS[0]);
  });

  it("ships the reference-calibrated ICE 3 V2 cab with smooth glass, corrected door bands and one original atlas", async () => {
    const modelPath = path.resolve("public/models/train-lab/ice3-br403-v2/ice3-br403-v2-cab-checkpoint.glb");
    const document = await new NodeIO().read(modelPath);
    const root = document.getRoot();
    const nodeNames = root.listNodes().map((node) => node.getName());
    const checkpoint = root.listNodes().find((node) => node.getName() === "ice3_br403_v2_cab_checkpoint_root");
    const bounds = getBounds(root.listScenes()[0]);
    const exportedLength = bounds.max[0] - bounds.min[0];

    expect(checkpoint?.getExtras()).toMatchObject({
      candidate: "DB ICE 3 Class 403 V2 cab checkpoint",
      vehicle_role: "403.0 first-class end car",
      review_stage: "cab",
      approval_status: "private review only",
      production_registry_modified: false,
      future_formation_vehicle_count: 8,
      reference_tolerance_percent: 2,
      units: "meters",
      standard_gauge_m: 1.435,
      wheel_tread_center_m: 0.7175,
      rail_contact_plane_z: 0,
      pantograph_contact_height_m: 5.5,
    });
    expect(nodeNames).toContain("ice3_v2_reference_calibrated_cab_shell");
    expect(nodeNames).toContain("ice3_v2_convex_nose_cap");
    expect(nodeNames).toContain("ice3_v2_panorama_windscreen");
    expect(nodeNames).toContain("ice3_v2_panorama_windscreen_seal");
    expect(nodeNames).toContain("ice3_v2_panorama_windscreen_glass");
    expect(nodeNames).toContain("ice3_v2_windscreen_lower_detail");
    expect(nodeNames.some((name) => name.includes("windscreen_center_divider"))).toBe(false);
    expect(nodeNames).toContain("ice3_v2_passenger_door_leaf_1");
    expect(nodeNames).toContain("ice3_v2_passenger_door_window_1");
    expect(nodeNames).toContain("ice3_v2_smooth_nose_stripe_1");
    expect(nodeNames).toContain("ice3_v2_front_stripe_bridge");
    expect(nodeNames).toContain("ice3_v2_original_decal_atlas_1");
    expect(nodeNames.some((name) => name.includes("front_windscreen_visor"))).toBe(false);
    expect(nodeNames.filter((name) => name.includes("side_cab_window_glass"))).toHaveLength(8);
    expect(nodeNames.filter((name) => name.includes("side_cab_window_band"))).toHaveLength(2);
    expect(nodeNames.filter((name) => name.includes("headlight_housing"))).toHaveLength(2);
    expect(nodeNames.filter((name) => name.includes("main_headlamp"))).toHaveLength(2);
    expect(nodeNames.filter((name) => name.includes("headlight_grille_slat"))).toHaveLength(6);
    expect(nodeNames.filter((name) => /passenger_window_\d\d_-?1$/.test(name))).toHaveLength(20);
    expect(nodeNames.some((name) => name.startsWith("review_"))).toBe(false);
    expect(nodeNames.some((name) => name.includes("reference_guide"))).toBe(false);
    expect(root.listNodes().find((node) => node.getName() === "rail_contact_origin")?.getWorldTranslation()).toEqual([0, 0, 0]);
    expect(exportedLength).toBeGreaterThan(25.8);
    expect(exportedLength).toBeLessThan(26.3);
    expect(root.listTextures()).toHaveLength(1);
    expect(root.listTextures()[0].getMimeType()).toBe("image/png");
    expect(root.listTextures()[0].getImage()?.byteLength).toBeGreaterThan(1_000);
    expect(root.listMaterials().length).toBeLessThanOrEqual(16);
    expect((await stat(modelPath)).size).toBeLessThan(1_000_000);

    const cockpitWindowBand = root.listNodes().find((node) => node.getName() === "ice3_v2_side_cab_window_band_1");
    const panoramicWindscreen = root.listNodes().find((node) => node.getName() === "ice3_v2_panorama_windscreen_glass");
    const panoramicWindscreenSeal = root.listNodes().find((node) => node.getName() === "ice3_v2_panorama_windscreen_seal");
    const passengerWindow = root.listNodes().find((node) => node.getName() === "ice3_v2_passenger_window_00_1");
    const convexCap = root.listNodes().find((node) => node.getName() === "ice3_v2_convex_nose_cap");
    expect(cockpitWindowBand?.getMesh()?.listPrimitives()[0].getAttribute("POSITION")?.getCount()).toBeGreaterThanOrEqual(10);
    expect(panoramicWindscreen?.getMesh()?.listPrimitives()[0].getAttribute("POSITION")?.getCount()).toBeGreaterThan(800);
    expect(panoramicWindscreenSeal?.getMesh()?.listPrimitives()[0].getAttribute("POSITION")?.getCount()).toBeGreaterThan(600);
    expect(passengerWindow?.getMesh()?.listPrimitives()[0].getAttribute("POSITION")?.getCount()).toBeGreaterThan(16);
    expect(convexCap?.getMesh()?.listPrimitives()[0].getAttribute("POSITION")?.getCount()).toBeGreaterThan(80);

    const wheels = root.listNodes().filter((node) => /_wheel_-?1_[01](?:\.\d+)?$/.test(node.getName()));
    expect(wheels).toHaveLength(8);
    for (const wheel of wheels) {
      const [, vertical, lateral] = wheel.getWorldTranslation();
      expect(Math.abs(lateral)).toBeCloseTo(0.7175, 4);
      expect(vertical - 0.46).toBeCloseTo(0, 4);
    }
  });

  it("ships all eight matching Class 403 V2 vehicles as one metric private-review formation", async () => {
    const candidate = TRAIN_REVIEW_CANDIDATES["ice3-br403-v2"];
    const modelPath = path.resolve("public", candidate.assetPath.slice(1));
    const document = await new NodeIO().read(modelPath);
    const root = document.getRoot();
    const nodes = root.listNodes();
    const nodeNames = nodes.map((node) => node.getName());
    const formationRoot = nodes.find((node) => node.getName() === "ice3_br403_v2_blender_root");
    const bounds = getBounds(root.listScenes()[0]);
    const exportedLength = bounds.max[0] - bounds.min[0];
    const expectedVehicles = [
      "vehicle_00_first_end_403_0",
      "vehicle_01_first_transformer_403_1",
      "vehicle_02_second_converter_403_2",
      "vehicle_03_bordrestaurant_403_3",
      "vehicle_04_service_403_8",
      "vehicle_05_second_converter_403_7",
      "vehicle_06_second_transformer_403_6",
      "vehicle_07_second_end_403_5",
    ];

    expect(formationRoot?.getExtras()).toMatchObject({
      formation: "DB ICE 3 Class 403 V2 eight-car review candidate",
      vehicle_count: 8,
      length_m: 200.32,
      review_stage: "formation",
      approval_status: "private review only",
      approved_cab_checkpoint: 7,
      production_registry_modified: false,
      units: "meters",
      standard_gauge_m: 1.435,
      wheel_tread_center_m: 0.7175,
      rail_contact_plane_z: 0,
      pantograph_contact_height_m: 5.5,
    });
    expect(expectedVehicles.every((name) => nodeNames.includes(name))).toBe(true);
    expect(exportedLength).toBeGreaterThan(200.3);
    expect(exportedLength).toBeLessThan(200.7);
    expect(nodeNames.filter((name) => /_wheel_-?1_[01](?:\.\d+)?$/.test(name))).toHaveLength(64);
    expect(nodeNames.filter((name) => name.includes("pantograph_collector"))).toHaveLength(2);
    expect(nodeNames.filter((name) => name.includes("bordrestaurant_403_3_window_glass"))).toHaveLength(16);
    expect(nodeNames.filter((name) => name.includes("service_403_8_accessible_service_panel"))).toHaveLength(2);
    expect(root.listNodes().find((node) => node.getName() === "rail_contact_origin")?.getWorldTranslation()).toEqual([0, 0, 0]);
    expect(root.listTextures()).toHaveLength(1);
    expect(root.listMaterials().length).toBeLessThanOrEqual(20);
    expect((await stat(modelPath)).size).toBeLessThan(1_000_000);
    expect(nodeNames.some((name) => name.startsWith("review_"))).toBe(false);
    expect(nodeNames.some((name) => name.includes("reference_guide"))).toBe(false);

    const raisedCollector = nodes
      .filter((node) => node.getName().includes("pantograph_collector"))
      .map((node) => node.getWorldTranslation()[1])
      .sort((a, b) => b - a)[0];
    expect(raisedCollector).toBeCloseTo(5.5, 3);

    const secondEnd = nodes.find((node) => node.getName() === "vehicle_07_second_end_403_5");
    const secondEndDescendants: string[] = [];
    const visit = (node: NonNullable<typeof secondEnd>) => {
      secondEndDescendants.push(node.getName());
      node.listChildren().forEach((child) => visit(child));
    };
    if (secondEnd) visit(secondEnd);
    expect(secondEndDescendants.some((name) => name.includes("first_class_marker"))).toBe(false);
  });

  it("records the V2 calibration guides and keeps all supplied references research-only", async () => {
    const manifest = JSON.parse(await readFile(path.resolve("assets/blender/ice3-br403-v2/manifest.json"), "utf8"));
    const atlasPath = path.resolve(manifest.hybridDetail.atlas);
    const atlasMetadata = await sharp(atlasPath).metadata();
    expect(manifest).toMatchObject({
      schemaVersion: 3,
      candidateId: "ice3-br403-v2-formation",
      approvalStatus: "private-review",
      reviewStage: "formation",
      productionRegistryModified: false,
      cabApproval: {
        checkpoint: 7,
        status: "approved-for-formation-build",
        cabGeometryChangedByFormationBuild: false,
      },
      vehicleCount: 8,
      lengthMeters: 200.32,
      consist: [
        "first_end_403_0",
        "first_transformer_403_1",
        "second_converter_403_2",
        "bordrestaurant_403_3",
        "service_403_8",
        "second_converter_403_7",
        "second_transformer_403_6",
        "second_end_403_5",
      ],
      bordrestaurant: {
        vehicleIndex: 3,
        class: "403.3",
        redesignSeatCount: 20,
      },
      calibration: {
        knownDimensionsMeters: { endCarLength: 25.835, middleCarLength: 24.775, vehicleWidth: 2.95, vehicleHeight: 3.89 },
        silhouetteTolerancePercent: 2,
        featureGuidesMeters: {
          panoramicWindscreenXRangeMeters: [9.55, 11.55],
          passengerWindowCenterZMeters: 2.48,
          passengerWindowHeightMeters: 0.52,
          passengerDoorBottomZMeters: 0.9,
          passengerDoorTopZMeters: 3.16,
          sideStripeCenterZMeters: 1.94,
        },
      },
      hybridDetail: {
        dimensionsPixels: [2048, 512],
        authorship: "original code-authored decal atlas",
        containsPhotography: false,
        containsProtectedLogos: false,
      },
      assetContract: {
        units: "meters",
        standardGaugeMeters: 1.435,
        railContactPlaneZ: 0,
        railContactAnchor: "rail_contact_origin",
        wheelTreadCentersMeters: [-0.7175, 0.7175],
        calibrationTrackExported: false,
      },
      userReferenceFilenames: [
        "ice_3_front_sideview.jpg.avif",
        "ice_3_front_forwardview.jpg.avif",
        "ice_car_sideview.jpg",
        "ICE_3_second_class_car_sideview.png.webp",
        "ice_3_front-side_view.jpeg",
      ],
    });
    expect(Object.keys(manifest.moduleGlbs)).toHaveLength(8);
    expect(manifest.referencePolicy).toContain("not copied");
    expect(manifest.nextApprovalGate).toContain("before changing the production ICE 3 registry");
    expect(atlasMetadata).toMatchObject({ width: 2048, height: 512, format: "png" });
  });

  it("keeps the isolated two-car ICE 3 continuity gate beside the approved production formation", () => {
    expect(TRAIN_REVIEW_CANDIDATES["ice3-br403-v2-continuity"]).toMatchObject({
      approvalStatus: "private-review",
      reviewStage: "continuity",
      productionTrainId: "ice3",
      assetRevision: "continuity-4",
      vehicleCount: 2,
      nominalLengthMeters: 50.61,
      comparisonCandidateId: "ice3-br403-v2-unified",
      comparisonLabel: "Complete unified formation",
    });
    expect(TRAIN_REVIEW_CANDIDATES["ice3-br403-v2"]).toMatchObject({
      vehicleCount: 8,
      nominalLengthMeters: 200.32,
      assetRevision: "formation-1",
      comparisonCandidateId: "ice3-br403-v2-continuity",
      comparisonLabel: "New continuity checkpoint",
    });
    const productionVisual = trainVisualVariants({ id: "ice3", modelKey: "ice3" })[0];
    expect(productionVisual).toEqual(ICE3_VISUAL_VARIANTS[0]);
  });

  it("ships a unified two-car Class 403 checkpoint with shared bands, stripe datum and metric contact", async () => {
    const candidate = TRAIN_REVIEW_CANDIDATES["ice3-br403-v2-continuity"];
    const modelPath = path.resolve("public", candidate.assetPath.slice(1));
    const document = await new NodeIO().read(modelPath);
    const root = document.getRoot();
    const nodes = root.listNodes();
    const names = nodes.map((node) => node.getName());
    const checkpoint = nodes.find((node) => node.getName() === "ice3_br403_v2_continuity_root");
    const bounds = getBounds(root.listScenes()[0]);
    const exportedLength = bounds.max[0] - bounds.min[0];

    expect(checkpoint?.getExtras()).toMatchObject({
      candidate: "DB ICE 3 Class 403 V2 two-car continuity checkpoint",
      vehicle_count: 2,
      length_m: 50.61,
      review_stage: "continuity",
      approval_status: "private review only",
      shared_profile_id: "class403-continuity-v1",
      body_profile_tolerance_m: 0.001,
      livery_tolerance_m: 0.002,
      production_registry_modified: false,
      units: "meters",
      standard_gauge_m: 1.435,
      wheel_tread_center_m: 0.7175,
      rail_contact_plane_z: 0,
      pantograph_contact_height_m: 5.5,
    });
    expect(names.filter((name) => /^vehicle_\d\d_/.test(name))).toEqual([
      "vehicle_00_first_end_403_0",
      "vehicle_01_first_transformer_403_1",
    ]);
    expect(names).toContain("ice3_v2_reference_calibrated_cab_shell.001");
    expect(names).toContain("ice3_continuity_shared_transformer_shell.001");
    expect(names.some((name) => name.includes("convex_nose_cap"))).toBe(false);
    expect(names.filter((name) => name.includes("continuous_black_glazing_band"))).toHaveLength(4);
    expect(names.filter((name) => name.includes("inset_window"))).toHaveLength(42);
    expect(names.filter((name) => name.includes("shared_red_body_stripe"))).toHaveLength(4);
    expect(names.filter((name) => name.includes("integrated_nose_stripe"))).toHaveLength(2);
    expect(names.filter((name) => name.includes("reference_side_cab_band"))).toHaveLength(2);
    const cabPanes = nodes.filter((node) => node.getName().includes("reference_side_cab_pane"));
    expect(cabPanes).toHaveLength(10);
    expect(cabPanes.every((node) => node.getMesh()?.listPrimitives().every(
      (primitive) => primitive.getMaterial()?.getName() === "ICE3_V2_Glass_Interior",
    ))).toBe(true);
    expect(names.some((name) => name.includes("ice3_v2_side_cab_window"))).toBe(false);
    expect(names.some((name) => name.startsWith("review_"))).toBe(false);
    expect(names.some((name) => name.includes("reference_guide"))).toBe(false);
    expect(nodes.find((node) => node.getName() === "rail_contact_origin")?.getWorldTranslation()).toEqual([0, 0, 0]);
    expect(exportedLength).toBeGreaterThan(50.6);
    expect(exportedLength).toBeLessThan(51.2);
    expect(root.listTextures()).toHaveLength(0);
    expect(root.listMaterials().length).toBeLessThanOrEqual(18);
    expect((await stat(modelPath)).size).toBeLessThan(450_000);

    const wheels = nodes.filter((node) => /_wheel_-?1_[01](?:\.\d+)?$/.test(node.getName()));
    expect(wheels).toHaveLength(16);
    for (const wheel of wheels) {
      const [, vertical, lateral] = wheel.getWorldTranslation();
      expect(Math.abs(lateral)).toBeCloseTo(0.7175, 4);
      expect(vertical - 0.46).toBeCloseTo(0, 4);
    }
    const collector = nodes.find((node) => node.getName().includes("pantograph_collector"));
    expect(collector?.getWorldTranslation()[1]).toBeCloseTo(5.5, 3);
  });

  it("records the continuity contract and keeps both protected ICE 3 assets byte-identical", async () => {
    const manifest = JSON.parse(await readFile(path.resolve("assets/blender/ice3-br403-v2-continuity/manifest.json"), "utf8"));
    expect(manifest).toMatchObject({
      schemaVersion: 4,
      candidateId: "ice3-br403-v2-continuity",
      approvalStatus: "private-review",
      reviewStage: "continuity",
      productionRegistryModified: false,
      currentCheckpoint: {
        vehicleCount: 2,
        lengthMeters: 50.61,
        vehicles: ["403.0 first-class end car", "403.1 first-class transformer car"],
        remainingFormationVehiclesDeferred: 6,
      },
      sharedBodyProfile: {
        id: "class403-continuity-v1",
        vertexCount: 19,
        widthMeters: 2.95,
        junctionToleranceMeters: 0.001,
      },
      glazingBand: { centerZMeters: 2.48, heightMeters: 0.74 },
      bodyStripe: { centerZMeters: 1.84, heightMeters: 0.18, junctionToleranceMeters: 0.002 },
      assetContract: {
        units: "meters",
        standardGaugeMeters: 1.435,
        railContactPlaneZ: 0,
        railContactAnchor: "rail_contact_origin",
        wheelTreadCentersMeters: [-0.7175, 0.7175],
        pantographContactHeightMeters: 5.5,
        calibrationTrackExported: false,
      },
    });
    expect(manifest.approvedCabFeatures.separateNoseCapExported).toBe(false);
    expect(manifest.approvedCabFeatures.sideCabGlazingRevision).toContain("1.08 m rearmost pane");
    expect(manifest.approvedCabFeatures.rearmostCabPaneWidthMeters).toBe(1.08);
    expect(manifest.approvedCabFeatures.sideCabGlassMaterial).toBe("ICE3_V2_Glass_Interior");
    expect(manifest.referencePolicy).toContain("not copied");
    expect(manifest.nextApprovalGate).toContain("before generating the remaining six vehicles");

    const digest = async (file: string) => createHash("sha256").update(await readFile(path.resolve(file))).digest("hex");
    expect(await digest("public/models/trains/ice3.glb")).toBe("ec41a600008b01fb665b60162bf2e8252360040ff860f4adc89a355f7db8f0be");
    expect(await digest("public/models/train-lab/ice3-br403-v2/ice3-br403-v2-blender.glb")).toBe("736be62423aa78a97404ff4b0dfeae555a05a988822fcd6ab753bc90e4e03e0f");
  });

  it("registers the approved unified Class 403 as the production eight-car asset", () => {
    expect(TRAIN_REVIEW_CANDIDATES["ice3-br403-v2-unified"]).toMatchObject({
      approvalStatus: "approved-production",
      reviewStage: "formation",
      productionTrainId: "ice3",
      assetRevision: "production-unified-1",
      vehicleCount: 8,
      nominalLengthMeters: 200.32,
      comparisonCandidateId: "ice3-br403-v2-continuity",
      comparisonLabel: "Approved two-car checkpoint",
      headlights: {
        frontInsetMeters: 0.28,
        heightMeters: 1.675,
        lateralMeters: 0.27,
        beamLengthMeters: 38,
        color: "#ffe3a3",
      },
    });
  });

  it("ships all eight unified Class 403 roles with continuous body datums and emissive headlamps", async () => {
    const candidate = TRAIN_REVIEW_CANDIDATES["ice3-br403-v2-unified"];
    const modelPath = path.resolve("public", candidate.assetPath.slice(1));
    const io = new NodeIO().registerExtensions([KHRMaterialsEmissiveStrength]);
    const document = await io.read(modelPath);
    const root = document.getRoot();
    const nodes = root.listNodes();
    const names = nodes.map((node) => node.getName());
    const formation = nodes.find((node) => node.getName() === "ice3_br403_v2_unified_root");
    const bounds = getBounds(root.listScenes()[0]);
    const exportedLength = bounds.max[0] - bounds.min[0];

    expect(formation?.getExtras()).toMatchObject({
      formation: "DB ICE 3 Class 403 unified eight-car production formation",
      vehicle_count: 8,
      length_m: 200.32,
      approval_status: "approved production",
      review_stage: "unified-formation",
      shared_profile_id: "class403-continuity-v1",
      headlight_lenses_emissive: true,
      runtime_headlights: "one combined moving React Three Fiber spot light at leading cab",
      production_registry_modified: true,
      production_train_id: "ice3",
      units: "meters",
      standard_gauge_m: 1.435,
      wheel_tread_center_m: 0.7175,
      rail_contact_plane_z: 0,
      pantograph_contact_height_m: 5.5,
    });
    expect(names.filter((name) => /^vehicle_\d\d_/.test(name))).toEqual([
      "vehicle_00_first_end_403_0",
      "vehicle_01_first_transformer_403_1",
      "vehicle_02_second_converter_403_2",
      "vehicle_03_bordrestaurant_403_3",
      "vehicle_04_service_403_8",
      "vehicle_05_second_converter_403_7",
      "vehicle_06_second_transformer_403_6",
      "vehicle_07_second_end_403_5",
    ]);
    expect(names.filter((name) => name.includes("continuous_black_glazing_band"))).toHaveLength(16);
    expect(names.filter((name) => name.includes("shared_red_body_stripe"))).toHaveLength(16);
    expect(names.some((name) => name.includes("bordrestaurant_403_3_window"))).toBe(true);
    expect(names.some((name) => name.includes("service_403_8_accessible_panel"))).toBe(true);
    expect(names.some((name) => name.startsWith("review_"))).toBe(false);
    expect(nodes.find((node) => node.getName() === "rail_contact_origin")?.getWorldTranslation()).toEqual([0, 0, 0]);
    expect(exportedLength).toBeGreaterThan(200.3);
    expect(exportedLength).toBeLessThan(200.6);
    expect(root.listTextures()).toHaveLength(0);
    expect(root.listMaterials().length).toBeLessThanOrEqual(18);
    expect((await stat(modelPath)).size).toBeLessThan(1_000_000);

    const wheels = nodes.filter((node) => /_wheel_-?1_[01](?:\.\d+)?$/.test(node.getName()));
    expect(wheels).toHaveLength(64);
    for (const wheel of wheels) {
      const [, vertical, lateral] = wheel.getWorldTranslation();
      expect(Math.abs(lateral)).toBeCloseTo(0.7175, 4);
      expect(vertical - 0.46).toBeCloseTo(0, 4);
    }
    const raisedCollector = nodes.find((node) => node.getName().includes("first_transformer_403_1_pantograph_collector"));
    expect(raisedCollector?.getWorldTranslation()[1]).toBeCloseTo(5.5, 3);

    const lampMaterial = root.listMaterials().find((material) => material.getName() === "ICE3_V2_Headlamp");
    expect(lampMaterial?.getEmissiveFactor()[0]).toBeCloseTo(1, 3);
    expect(lampMaterial?.getExtension<KHRMaterialsEmissiveStrength>("KHR_materials_emissive_strength")?.getEmissiveStrength()).toBe(8);
  });

  it("records the production formation contract while preserving every prior ICE 3 approval gate", async () => {
    const manifest = JSON.parse(await readFile(path.resolve("assets/blender/ice3-br403-v2-unified/manifest.json"), "utf8"));
    expect(manifest).toMatchObject({
      schemaVersion: 5,
      candidateId: "ice3-br403-v2-unified",
      approvalStatus: "approved-production",
      reviewStage: "unified-formation",
      productionRegistryModified: true,
      vehicleCount: 8,
      lengthMeters: 200.32,
      continuityContract: {
        approvedCheckpointRevision: 4,
        sharedProfileId: "class403-continuity-v1",
        profileVertexCount: 19,
        bodyStripeCenterZMeters: 1.84,
        bodyStripeHeightMeters: 0.18,
        glazingBandCenterZMeters: 2.48,
        glazingBandHeightMeters: 0.74,
      },
      lighting: {
        lensMaterial: "ICE3_V2_Headlamp",
        lensEmissive: true,
        emissionStrength: 8,
        runtimeOwner: "React Three Fiber",
        leadingCabSpotLightCount: 1,
      },
      bordrestaurant: {
        vehicleIndex: 3,
        class: "403.3",
        redesignSeatCount: 20,
        asymmetricDiningAndGalleySides: true,
      },
    });
    expect(manifest.consist).toHaveLength(8);
    expect(Object.keys(manifest.moduleGlbs)).toHaveLength(8);
    expect(manifest.referencePolicy).toContain("not copied");
    expect(manifest.formationGlb).toBe("public/models/trains/blender/ice3/ice3-br403-unified-blender.glb");
    expect(manifest.nextApprovalGate).toContain("Approved and promoted");

    const digest = async (file: string) => createHash("sha256").update(await readFile(path.resolve(file))).digest("hex");
    expect(await digest("public/models/trains/ice3.glb")).toBe("ec41a600008b01fb665b60162bf2e8252360040ff860f4adc89a355f7db8f0be");
    expect(await digest("public/models/train-lab/ice3-br403-v2/ice3-br403-v2-blender.glb")).toBe("736be62423aa78a97404ff4b0dfeae555a05a988822fcd6ab753bc90e4e03e0f");
    expect(await digest("public/models/train-lab/ice3-br403-v2-continuity/ice3-br403-v2-continuity-checkpoint.glb")).toBe("ce99e3ce1399b90945a33c7541ce1a6580c4c13662d214048d0aee62ca4ec009");
  });

  it("promotes the approved Nightjet N2 asset into the production registry", async () => {
    expect(TRAIN_REVIEW_CANDIDATES["nightjet-new-generation"]).toMatchObject({
      approvalStatus: "approved-production",
      productionTrainId: "nightjet",
      assetRevision: "production-n2",
      vehicleCount: 8,
      nominalLengthMeters: 204.675,
      traction: "electric",
    });
    const productionVisual = trainVisualVariants({ id: "nightjet", modelKey: "nightjet" })[0];
    expect(productionVisual).toEqual(NIGHTJET_VISUAL_VARIANTS[0]);
    expect(productionVisual).toMatchObject({
      id: "nightjet-new-generation",
      profile: "metric-v1",
      assetPath: "models/trains/blender/nightjet/nightjet-new-generation-blender.glb",
      minimumLengthLevel: 5,
      lengthMeters: 204.675,
    });
    expect(productionVisual.scale).toEqual([
      RAILWAY_METRIC_PROFILE.metersToWorld,
      RAILWAY_METRIC_PROFILE.metersToWorld,
      RAILWAY_METRIC_PROFILE.metersToWorld,
    ]);

    const productionBytes = await readFile(path.resolve("public/models/trains/blender/nightjet/nightjet-new-generation-blender.glb"));
    const reviewBytes = await readFile(path.resolve("public/models/train-lab/nightjet-new-generation/nightjet-new-generation-blender.glb"));
    expect(productionBytes).toEqual(reviewBytes);
  });

  it("ships a metre-scaled Taurus 1116 and seven-car Nightjet review formation", async () => {
    const candidate = TRAIN_REVIEW_CANDIDATES["nightjet-new-generation"];
    const modelPath = path.resolve("public", candidate.assetPath.slice(1));
    const io = new NodeIO();
    const document = await io.read(modelPath);
    const root = document.getRoot();
    const nodeNames = root.listNodes().map((node) => node.getName());
    const formationRoot = root.listNodes().find((node) => node.getName() === "nightjet_new_generation_blender_root");
    const bounds = getBounds(root.listScenes()[0]);
    const exportedLength = bounds.max[0] - bounds.min[0];

    expect(formationRoot?.getExtras()).toMatchObject({
      units: "meters",
      forward_axis: "+X",
      lateral_axis: "+Y",
      up_axis: "+Z",
      standard_gauge_m: 1.435,
      wheel_tread_center_m: 0.7175,
      rail_contact_plane_z: 0,
      pantograph_contact_height_m: 5.5,
      approval_status: "approved production",
      production_train_id: "nightjet",
      coach_set: "2 seating + 3 couchette + 2 sleeping",
      asset_revision: "N2",
    });
    expect(nodeNames.filter((name) => /^vehicle_\d\d_/.test(name))).toEqual([
      "vehicle_00_taurus_1116",
      "vehicle_01_sleeping_a",
      "vehicle_02_sleeping_b",
      "vehicle_03_couchette",
      "vehicle_04_couchette",
      "vehicle_05_couchette",
      "vehicle_06_multifunction",
      "vehicle_07_control_seat_car",
    ]);
    expect(nodeNames.some((name) => name.includes("nightjet_taurus_panto_raised_collector"))).toBe(true);
    expect(nodeNames.some((name) => name.includes("nightjet_taurus_vent"))).toBe(true);
    expect(nodeNames.some((name) => name.includes("nightjet_taurus_red_sweep"))).toBe(true);
    expect(nodeNames.some((name) => name.includes("nightjet_taurus_silver_sweep"))).toBe(true);
    expect(nodeNames.some((name) => name.includes("nightjet_taurus_red_cab_block"))).toBe(true);
    expect(nodeNames.some((name) => name.includes("nightjet_control_cab_windshield"))).toBe(true);
    expect(nodeNames.some((name) => name.includes("nightjet_control_front_grille"))).toBe(true);
    expect(nodeNames.some((name) => name.includes("sleeping_a_window"))).toBe(true);
    expect(nodeNames.some((name) => name.includes("couchette_window"))).toBe(true);
    expect(nodeNames.some((name) => name.includes("multifunction_window"))).toBe(true);
    expect(nodeNames.some((name) => name.startsWith("review_"))).toBe(false);
    expect(root.listNodes().find((node) => node.getName() === "rail_contact_origin")?.getWorldTranslation()).toEqual([0, 0, 0]);
    expect(exportedLength).toBeGreaterThan(204.7);
    expect(exportedLength).toBeLessThan(205.1);
    expect(Math.abs(bounds.max[0] + bounds.min[0])).toBeLessThan(0.1);
    expect(root.listMaterials().length).toBeLessThanOrEqual(15);
    expect((await stat(modelPath)).size).toBeLessThan(500_000);

    const wheels = root.listNodes().filter((node) => /_wheel_-?1_[01](?:\.\d+)?$/.test(node.getName()));
    expect(wheels).toHaveLength(64);
    for (const wheel of wheels) {
      const [, vertical, lateral] = wheel.getWorldTranslation();
      const radius = wheel.getName().includes("nightjet_taurus") ? 0.575 : 0.46;
      expect(Math.abs(lateral)).toBeCloseTo(0.7175, 4);
      expect(vertical - radius).toBeCloseTo(0, 4);
    }
  });

  it("records the complete Nightjet formation and local reference filenames without shipping images", async () => {
    const manifest = JSON.parse(await readFile(path.resolve("assets/blender/nightjet-new-generation/manifest.json"), "utf8"));
    expect(manifest).toMatchObject({
      candidateId: "nightjet-new-generation-taurus-1116",
      assetRevision: "N2",
      approvalStatus: "approved-production",
      productionRegistryModified: true,
      formationGlb: "public/models/trains/blender/nightjet/nightjet-new-generation-blender.glb",
      reviewFormationGlb: "public/models/train-lab/nightjet-new-generation/nightjet-new-generation-blender.glb",
      vehicleCount: 8,
      consist: [
        "taurus-1116",
        "sleeping-a",
        "sleeping-b",
        "couchette",
        "couchette",
        "couchette",
        "multifunction",
        "control-seat-car",
      ],
      sevenCarCoachSet: [
        "control-seat-car",
        "multifunction",
        "couchette",
        "couchette",
        "couchette",
        "sleeping-a",
        "sleeping-b",
      ],
      userReferenceFilenames: [
        "nightjet_cabcar_front-side.jpg",
        "nightjet_cabcar_front-side-view 2.jpg",
        "nightjet_full formation_without_locomotive.jpg",
        "nightjet_car_1.jpg",
        "nightjet_car_2.jpg",
        "nightjet_cabcar_side_view.jpg",
        "nightjet_taurus_1116_corner_view.png",
        "nightjet_taurus_1116_sideview.jpg",
        "nightjet_taurus_1116_front-side_view.jpg",
      ],
      assetContract: {
        units: "meters",
        standardGaugeMeters: 1.435,
        railContactPlaneZ: 0,
        railContactAnchor: "rail_contact_origin",
        wheelTreadCentersMeters: [-0.7175, 0.7175],
        traction: "electric",
        pantographContactHeightMeters: 5.5,
        calibrationTrackExported: false,
      },
    });
    expect(manifest.referencePolicy).toContain("not copied");
    expect(manifest.revisionNotes).toContain("Redrawn Taurus side livery");
  });

  it("uses the approved 75/25 Nightjet leading-end distribution deterministically", () => {
    expect(NIGHTJET_TAURUS_LEADING_CHANCE).toBe(0.75);
    expect(NIGHTJET_CAB_CAR_LEADING_CHANCE).toBe(0.25);
    expect(NIGHTJET_TAURUS_LEADING_CHANCE + NIGHTJET_CAB_CAR_LEADING_CHANCE).toBe(1);
    expect(nightjetFormationOrientationForRoll(0)).toBe(1);
    expect(nightjetFormationOrientationForRoll(0.749999)).toBe(1);
    expect(nightjetFormationOrientationForRoll(0.75)).toBe(-1);
    expect(nightjetFormationOrientationForRoll(0.999999)).toBe(-1);
    expect(chooseTrainFormationOrientation("nightjet-new-generation", 0)[0]).toBe(1);
    expect(chooseTrainFormationOrientation("nightjet-new-generation", 1327)[0]).toBe(-1);
    expect(chooseTrainFormationOrientation("nightjet-new-generation", 1327)).toEqual(chooseTrainFormationOrientation("nightjet-new-generation", 1327));
    expect(chooseTrainFormationOrientation("nightjet-legacy-v1", 999)).toEqual([1, 999]);
  });

  it("provides deterministic production debug arrivals for both Nightjet orientations", () => {
    const taurus = debugState(fundedState(), "nightjet-taurus");
    const cabCar = debugState(fundedState(), "nightjet-cab-car");
    expect(taurus.platformLanes[0].activeTrain).toMatchObject({
      trainId: "nightjet",
      visualVariantId: "nightjet-new-generation",
      formationOrientation: 1,
      payout: 20_000,
    });
    expect(cabCar.platformLanes[0].activeTrain).toMatchObject({
      trainId: "nightjet",
      visualVariantId: "nightjet-new-generation",
      formationOrientation: -1,
      payout: 20_000,
    });
    expect(isNight(taurus)).toBe(true);
    expect(isNight(cabCar)).toBe(true);
  });
});

describe("production metric railway and Railjet registry", () => {
  it("ships two private reference-livery Railjet candidates without changing production", async () => {
    const io = new NodeIO();
    const candidates = [
      { id: "railjet-classic-livery-v2" as const, length: 205.375, vehicles: 8 },
      { id: "railjet-nextgen-livery-v2" as const, length: 258, vehicles: 10 },
    ];
    for (const candidate of candidates) {
      const record = TRAIN_REVIEW_CANDIDATES[candidate.id];
      const modelPath = path.resolve("public", record.assetPath.slice(1));
      const document = await io.read(modelPath);
      const root = document.getRoot();
      const nodeNames = root.listNodes().map((node) => node.getName());
      const materialNames = root.listMaterials().map((material) => material.getName());
      const bounds = getBounds(root.listScenes()[0]);
      expect(record).toMatchObject({ approvalStatus: "private-review", vehicleCount: candidate.vehicles, nominalLengthMeters: candidate.length });
      const graphiteMaterial = candidate.id === "railjet-nextgen-livery-v2" ? "RJ2_Graphite_V2" : "RJ_Graphite";
      expect(materialNames).toEqual(expect.arrayContaining(["RJ_Wine_Red", "RJ_Bright_Red", graphiteMaterial, "RJ_Aluminium", "RJ_Smoked_Glass"]));
      expect(nodeNames.some((name) => name.includes("red_belt"))).toBe(true);
      expect(nodeNames.some((name) => name.includes("silver_skirt"))).toBe(true);
      expect(nodeNames.some((name) => name.includes("railjet_wordmark"))).toBe(true);
      expect(nodeNames.some((name) => name.includes("window_band") || name.includes("window_ribbon"))).toBe(false);
      expect(bounds.max[0] - bounds.min[0]).toBeGreaterThan(candidate.length - 0.1);
      expect(bounds.max[0] - bounds.min[0]).toBeLessThan(candidate.length + 0.3);
      expect((await stat(modelPath)).size).toBeLessThan(500_000);

      const manifest = JSON.parse(await readFile(path.resolve("assets/blender", candidate.id, "manifest.json"), "utf8"));
      expect(manifest).toMatchObject({ schemaVersion: 3, vehicleCount: candidate.vehicles, productionRailjetModified: false });
      expect(manifest.liveryRevision).toMatch(/^reference-calibrated-v2/);
      if (candidate.id === "railjet-nextgen-livery-v2") {
        expect(materialNames).toContain("RJ2_Taurus_Headlamp");
        expect(nodeNames.some((name) => name.includes("wide_door"))).toBe(false);
        expect(nodeNames.some((name) => name.includes("door_upper_leaf"))).toBe(true);
        expect(nodeNames.some((name) => name.includes("door_lower_leaf"))).toBe(true);
        expect(nodeNames.some((name) => name.includes("door_red_belt"))).toBe(true);
        const expectedPanelMaterials = [
          ["red_belt", "RJ_Bright_Red"],
          ["silver_skirt", "RJ_Aluminium"],
          ["graphite_flank", "RJ2_Graphite_V2"],
        ] as const;
        for (const [nodeFragment, expectedMaterial] of expectedPanelMaterials) {
          const matchingNodes = root.listNodes().filter((node) => node.getName().includes(nodeFragment));
          expect(matchingNodes.length).toBeGreaterThan(0);
          expect(matchingNodes.every((node) => node.getMesh()?.listPrimitives().every(
            (primitive) => primitive.getMaterial()?.getName() === expectedMaterial,
          ))).toBe(true);
        }
        expect(manifest.liveryReferenceNotes.sideBands).toEqual({
          silverSkirt: [0.73, 1.22],
          graphiteFlank: [1.22, 2.05],
          brightRedBelt: [2.05, 2.5],
          surfaceRule: "non-overlapping vertical spans on one shared side plane",
        });
        expect(manifest.liveryRevision).toBe("reference-calibrated-v2.3");
        expect(manifest.liveryReferenceNotes.taurusCab).toMatchObject({
          class: "OEBB Class 1116 Taurus / Siemens ES64U2",
          windscreen: expect.stringContaining("curved black visor"),
          stripe: expect.stringContaining("horizontal bright-red belt"),
        });
        expect(nodeNames.filter((name) => name.includes("taurus_reference_cab_") && name.includes("windscreen_glass"))).toHaveLength(4);
        expect(nodeNames.filter((name) => name.includes("taurus_reference_side_window_glass"))).toHaveLength(4);
        expect(nodeNames.filter((name) => name.includes("taurus_reference_red_belt_center"))).toHaveLength(2);
        expect(nodeNames.filter((name) => name.includes("taurus_reference_red_belt_cab"))).toHaveLength(4);
        expect(nodeNames.filter((name) => name.includes("taurus_reference_cab_") && name.includes("headlight_lens"))).toHaveLength(8);
        expect(nodeNames.some((name) => name.startsWith("taurus_cab_") && name.includes("windshield"))).toBe(false);
        expect(nodeNames.some((name) => name.includes("taurus_bright_red_sweep"))).toBe(false);
      }
    }

    const digest = async (file: string) => createHash("sha256").update(await readFile(path.resolve(file))).digest("hex");
    expect(await digest("public/models/trains/blender/railjet/railjet-classic-blender.glb")).toBe("d1f489c7e6562051dba5e156a868e8b437bf95864e2070409bfab74ed1df9383");
    expect(await digest("public/models/trains/blender/railjet/railjet-nextgen-blender.glb")).toBe("c054832ca766eee16dd4592d69d4ba42d0867bf963ab8f705e63dea8e75c49cc");
    expect(await digest("public/models/trains/railjet.glb")).toBe("9b0bdff278461f9ad9fe35378679e8e82c31839bcdc487bda53a159175f9503e");
  });

  it("defines the complete production railway contract and calculated five-lane layout", () => {
    expect(RAILWAY_METRIC_PROFILE).toMatchObject({
      metersToWorld: 0.071,
      standardGaugeMeters: 1.435,
      railTopY: 0.295,
      platformHeightMeters: 0.55,
      platformWidthMeters: 5,
      platformEdgeClearanceMeters: 0.2,
      catenaryContactHeightMeters: 5.5,
      platformLengthMetersByLevel: [90, 130, 170, 220, 280],
    });
    expect([1, 2, 3, 4, 5].map(platformLengthMeters)).toEqual([90, 130, 170, 220, 280]);
    expect(PRODUCTION_TRACK_CENTER_SPACING_METERS).toBeCloseTo(8.225, 6);
    const laneCenters = Array.from({ length: 5 }, (_, index) => productionTrackCenter(index, 5));
    expect(laneCenters[2]).toBe(0);
    expect(laneCenters[4] - laneCenters[3]).toBeCloseTo(railwayMetersToWorld(8.225), 6);
    const platformCenter = metricPlatformCenter(laneCenters[4]);
    const nearPlatformEdge = platformCenter - railwayMetersToWorld(RAILWAY_METRIC_PROFILE.platformWidthMeters / 2);
    const trainSide = laneCenters[4] + railwayMetersToWorld(RAILWAY_METRIC_PROFILE.vehicleWidthMeters / 2);
    expect(nearPlatformEdge - trainSide).toBeCloseTo(railwayMetersToWorld(0.2), 6);
  });

  it("keeps every still-unapproved train on its temporary legacy profile", () => {
    expect(RAILJET_VISUAL_VARIANTS).toHaveLength(2);
    expect(RAILJET_VISUAL_VARIANTS.map((variant) => ({
      id: variant.id,
      profile: variant.profile,
      minimumLengthLevel: variant.minimumLengthLevel,
      selectionWeight: variant.selectionWeight,
    }))).toEqual([
      { id: "railjet-classic", profile: "metric-v1", minimumLengthLevel: 4, selectionWeight: 1 },
      { id: "railjet-nextgen", profile: "metric-v1", minimumLengthLevel: 5, selectionWeight: 1 },
    ]);
    for (const train of TRAINS.filter((candidate) => candidate.id !== "railjet" && candidate.id !== "nightjet" && candidate.id !== "ice3")) {
      expect(trainVisualVariants(train)).toHaveLength(1);
      expect(resolveTrainVisualVariant(train).profile).toBe("legacy-v1");
    }
  });

  it("gates the new-generation formation by length and chooses equally using deterministic rolls", () => {
    const railjet = TRAINS.find((train) => train.id === "railjet")!;
    expect(selectTrainVisualVariant(railjet, 4, 0.99).id).toBe("railjet-classic");
    expect(selectTrainVisualVariant(railjet, 5, 0.1).id).toBe("railjet-classic");
    expect(selectTrainVisualVariant(railjet, 5, 0.9).id).toBe("railjet-nextgen");
  });

  it("promotes the approved unified ICE 3 with its metric scale and single headlight profile", () => {
    expect(ICE3_VISUAL_VARIANTS).toHaveLength(1);
    expect(ICE3_VISUAL_VARIANTS[0]).toMatchObject({
      id: "ice3-br403-unified",
      profile: "metric-v1",
      assetPath: "models/trains/blender/ice3/ice3-br403-unified-blender.glb",
      lengthMeters: 200.32,
      minimumLengthLevel: 4,
      selectionWeight: 1,
      headlights: {
        frontInsetMeters: 0.28,
        heightMeters: 1.675,
        beamLengthMeters: 38,
        color: "#ffe3a3",
      },
    });
    expect(ICE3_VISUAL_VARIANTS[0].scale).toEqual([
      RAILWAY_METRIC_PROFILE.metersToWorld,
      RAILWAY_METRIC_PROFILE.metersToWorld,
      RAILWAY_METRIC_PROFILE.metersToWorld,
    ]);
    expect(debugState(fundedState(), "ice3-unified").platformLanes[0].activeTrain).toMatchObject({
      trainId: "ice3",
      visualVariantId: "ice3-br403-unified",
    });
  });

  it("creates reviewable production states for both Blender generations", () => {
    expect(debugState(fundedState(), "railjet-classic").platformLanes[0].activeTrain).toMatchObject({
      trainId: "railjet",
      visualVariantId: "railjet-classic",
    });
    expect(debugState(fundedState(), "railjet-nextgen").platformLanes[0].activeTrain).toMatchObject({
      trainId: "railjet",
      visualVariantId: "railjet-nextgen",
    });
  });
});

describe("cleanliness and rating", () => {
  it("uses exclusive 10% thunderstorm, 25% rain, and 65% clear season rolls", () => {
    expect(WEATHER_THUNDERSTORM_CHANCE).toBe(0.1);
    expect(WEATHER_RAIN_CHANCE).toBe(0.25);
    expect(weatherFromRoll(0)).toBe("thunderstorm");
    expect(weatherFromRoll(0.099999)).toBe("thunderstorm");
    expect(weatherFromRoll(0.1)).toBe("rain");
    expect(weatherFromRoll(0.349999)).toBe("rain");
    expect(weatherFromRoll(0.35)).toBe("clear");
    expect(weatherFromRoll(0.999)).toBe("clear");
  });

  it("applies the specified weather rating, dwell, and dirt modifiers", () => {
    expect(weatherRatingPenalty("clear")).toBe(0);
    expect(weatherRatingPenalty("rain")).toBe(10);
    expect(weatherRatingPenalty("thunderstorm")).toBe(25);
    expect(weatherArrivalDirtMultiplier("rain")).toBe(1.5);
    expect(weatherArrivalDirtMultiplier("thunderstorm")).toBe(2);
    expect(weatherDirtPerMinute("rain")).toBe(0.5);
    expect(weatherDirtPerMinute("thunderstorm")).toBe(1.5);
    expect(weatherDwellMultiplier("rain")).toBe(1.1);
    expect(weatherDwellMultiplier("thunderstorm")).toBe(1.15);
    const clear = fundedState();
    expect(stationRating(clear) - stationRating({ ...clear, weather: "rain" })).toBe(10);
    expect(stationRating(clear) - stationRating({ ...clear, weather: "thunderstorm" })).toBe(25);
  });

  it("keeps every season-start weather duration between two and five simulated minutes", () => {
    for (let seed = 1; seed <= 64; seed += 1) {
      const rolled = tickGame({ ...fundedState(), rng: seed, simSeconds: 1_799.9, nextSeasonAt: 1_800 }, 0.1);
      if (rolled.weather !== "clear") {
        expect(rolled.weatherRemaining).toBeGreaterThanOrEqual(120);
        expect(rolled.weatherRemaining).toBeLessThanOrEqual(300);
      } else {
        expect(rolled.weatherRemaining).toBe(0);
      }
    }
  });

  it("schedules deterministic lightning and adds extra continuous storm dirt", () => {
    const storm: GameState = {
      ...fundedState(),
      weather: "thunderstorm",
      weatherRemaining: 180,
      nextLightningIn: 0.1,
      cleanliness: 100,
    };
    const struck = tickGame(storm, 0.1);
    expect(isWetWeather(struck)).toBe(true);
    expect(struck.lightningStrikeId).toBe(1);
    expect(struck.nextLightningIn).toBeGreaterThanOrEqual(18);
    expect(struck.nextLightningIn).toBeLessThanOrEqual(45);
    expect(struck.thunderDelaySeconds).toBeGreaterThanOrEqual(0.8);
    expect(struck.thunderDelaySeconds).toBeLessThanOrEqual(2.4);
    expect(struck.cleanliness).toBeCloseTo(99.9975, 4);
  });

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
      weather: "rain",
      weatherRemaining: 100,
      platformLanes: [{
        platformIndex: 0,
        spawnCountdown: 0,
        activeTrain: {
          trainId: "br650",
          phase: "depart",
          phaseElapsed: 4.95,
          phaseDuration: 5,
          payout: 10,
          firstService: false,
        },
      }],
    };
    const next = tickGame(state, 0.1);
    expect(next.platformLanes[0].activeTrain).toBeNull();
    expect(next.cleanliness).toBeLessThan(98.7);
  });
});

describe("independent platform operations", () => {
  it("adds an independent lane whenever a platform is purchased", () => {
    const state = purchaseUpgrade(fundedState(), { kind: "platform" });
    expect(state.platforms).toBe(2);
    expect(state.platformLanes).toHaveLength(2);
    expect(state.platformLanes[0].spawnCountdown).toBe(2);
    expect(state.platformLanes[1]).toMatchObject({ platformIndex: 1, activeTrain: null });
    const undone = undoLastUpgrade(state);
    expect(undone.platforms).toBe(1);
    expect(undone.platformLanes).toHaveLength(1);
  });

  it("can operate multiple trains simultaneously without sharing timers", () => {
    const active = (trainId: string) => ({
      trainId,
      phase: "dwell" as const,
      phaseElapsed: 1,
      phaseDuration: 12,
      payout: 15,
      firstService: false,
    });
    const state: GameState = {
      ...fundedState(),
      platforms: 2,
      firstTrainComplete: true,
      platformLanes: [
        { platformIndex: 0, spawnCountdown: 0, activeTrain: active("br650") },
        { platformIndex: 1, spawnCountdown: 0, activeTrain: active("br642") },
      ],
    };
    const next = tickGame(state, 0.5);
    expect(next.platformLanes[0].activeTrain?.phaseElapsed).toBeCloseTo(1.5);
    expect(next.platformLanes[1].activeTrain?.phaseElapsed).toBeCloseTo(1.5);
  });

  it("starts a separate automatic service on every ready platform", () => {
    const state: GameState = {
      ...fundedState(),
      platforms: 3,
      firstTrainComplete: true,
      platformLanes: [0, 1, 2].map((platformIndex) => ({ platformIndex, spawnCountdown: 0, activeTrain: null })),
    };
    const next = tickGame(state, 0.1);
    expect(next.platformLanes.every((lane) => lane.activeTrain !== null)).toBe(true);
    expect(next.platformLanes.map((lane) => lane.activeTrain?.phase)).toEqual(["approach", "approach", "approach"]);
  });

  it("resets only the lane whose train completes", () => {
    const state: GameState = {
      ...fundedState(),
      platforms: 2,
      firstTrainComplete: true,
      platformLanes: [
        {
          platformIndex: 0,
          spawnCountdown: 0,
          activeTrain: { trainId: "br650", phase: "depart", phaseElapsed: 4.95, phaseDuration: 5, payout: 10, firstService: false },
        },
        {
          platformIndex: 1,
          spawnCountdown: 0,
          activeTrain: { trainId: "br642", phase: "dwell", phaseElapsed: 3, phaseDuration: 12, payout: 18, firstService: false },
        },
      ],
    };
    const next = tickGame(state, 0.1);
    expect(next.platformLanes[0].activeTrain).toBeNull();
    expect(next.platformLanes[0].spawnCountdown).toBeGreaterThan(0);
    expect(next.platformLanes[1].activeTrain?.trainId).toBe("br642");
    expect(next.platformLanes[1].activeTrain?.phaseElapsed).toBeCloseTo(3.1);
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

  it("runs event trains through without a dwell or stop", () => {
    const eligible = debugState(fundedState(), "tier5");
    const triggered = triggerEvent(eligible, "ice-s");
    expect(triggered.platformLanes[0].activeTrain).toMatchObject({ trainId: "ice-s", phase: "pass", phaseDuration: 10 });
    expect(triggered.eventWindow).toBe("ice-s");
    expect(triggered.eventRemaining).toBe(300);
    expect(triggered.eventPassesRemaining).toBe(1);
    expect(triggered.boosts).toContainEqual(expect.objectContaining({ label: "ICE-S record excitement", amount: 30, remaining: 300 }));

    const midRun = tickGame(triggered, 5);
    expect(midRun.platformLanes[0].activeTrain).toMatchObject({ trainId: "ice-s", phase: "pass" });
    expect(midRun.coins).toBe(150_000);

    const completed = tickGame(midRun, 5.1);
    expect(completed.platformLanes[0].activeTrain).toBeNull();
    expect(completed.coins).toBe(175_000);
    expect(completed.boosts.some((boost) => boost.label === "ICE-S record excitement" && boost.amount === 30)).toBe(true);

    const secondRunReady: GameState = {
      ...completed,
      eventNextPassIn: 0,
      platformLanes: completed.platformLanes.map((lane) => ({ ...lane, activeTrain: null, spawnCountdown: 30 })),
    };
    const secondRun = tickGame(secondRunReady, 0.1);
    expect(secondRun.platformLanes[0].activeTrain).toMatchObject({ trainId: "ice-s", phase: "pass" });
    expect(secondRun.eventPassesRemaining).toBe(0);

    const eventEnd = tickGame({
      ...secondRun,
      eventRemaining: 0.1,
      eventPassesRemaining: 0,
      boosts: secondRun.boosts.map((boost) => ({ ...boost, remaining: 0.1 })),
      platformLanes: secondRun.platformLanes.map((lane) => ({ ...lane, activeTrain: null })),
    }, 0.1);
    expect(eventEnd.eventWindow).toBeNull();
    expect(eventEnd.boosts.some((boost) => boost.label === "ICE-S record excitement")).toBe(false);
  });
});

describe("manual save codes", () => {
  it("round-trips serializable game state and rejects damage", () => {
    const state: GameState = {
      ...fundedState(),
      tier: 4,
      cleanliness: 72,
      coins: 12_345,
      platforms: 2,
      platformLanes: [
        { ...fundedState().platformLanes[0], spawnCountdown: 17 },
        { platformIndex: 1, spawnCountdown: 9, activeTrain: null },
      ],
    };
    const code = encodeSave(state);
    const decoded = decodeSave(code);
    expect(decoded.tier).toBe(4);
    expect(decoded.cleanliness).toBe(72);
    expect(decoded.coins).toBe(12_345);
    expect(decoded.platformLanes).toHaveLength(2);
    expect(decoded.platformLanes.map((lane) => lane.spawnCountdown)).toEqual([17, 9]);
    expect(() => decodeSave(`${code}x`)).toThrow(/damaged|incomplete/u);
  });

  it("round-trips thunderstorms and migrates legacy CR1 rain fields", () => {
    const storm: GameState = {
      ...fundedState(),
      weather: "thunderstorm",
      weatherRemaining: 144,
      nextLightningIn: 24,
      lightningStrikeId: 3,
      thunderDelaySeconds: 1.4,
    };
    expect(decodeSave(encodeSave(storm))).toMatchObject({
      weather: "thunderstorm",
      weatherRemaining: 144,
      nextLightningIn: 24,
      lightningStrikeId: 3,
      thunderDelaySeconds: 1.4,
    });
    const legacyRain = {
      ...fundedState(),
      weather: undefined,
      weatherRemaining: undefined,
      nextLightningIn: undefined,
      lightningStrikeId: undefined,
      thunderDelaySeconds: undefined,
      raining: true,
      rainRemaining: 77,
    } as unknown as GameState;
    expect(decodeSave(encodeSave(legacyRain))).toMatchObject({
      weather: "rain",
      weatherRemaining: 77,
      nextLightningIn: 0,
      lightningStrikeId: 0,
      thunderDelaySeconds: 0,
    });
  });

  it("preserves a selected Railjet formation and safely defaults old active Railjets", () => {
    const activeRailjet = {
      trainId: "railjet",
      phase: "dwell" as const,
      phaseElapsed: 2,
      phaseDuration: 14,
      payout: 9_000,
      firstService: false,
      visualVariantId: "railjet-nextgen",
    };
    const state: GameState = {
      ...fundedState(),
      tier: 5,
      lengthLevel: 5,
      platformLanes: [{ platformIndex: 0, spawnCountdown: 0, activeTrain: activeRailjet }],
    };
    expect(decodeSave(encodeSave(state)).platformLanes[0].activeTrain?.visualVariantId).toBe("railjet-nextgen");

    const oldState: GameState = {
      ...state,
      platformLanes: [{ platformIndex: 0, spawnCountdown: 0, activeTrain: { ...activeRailjet, visualVariantId: undefined } }],
    };
    expect(decodeSave(encodeSave(oldState)).platformLanes[0].activeTrain?.visualVariantId).toBe("railjet-classic");
  });

  it("preserves the unified ICE 3 variant and migrates old active ICE 3 saves", () => {
    const activeIce3 = {
      trainId: "ice3",
      visualVariantId: "ice3-br403-unified",
      phase: "dwell" as const,
      phaseElapsed: 3,
      phaseDuration: 14,
      payout: 3_200,
      firstService: false,
    };
    const state: GameState = {
      ...fundedState(),
      tier: 4,
      lengthLevel: 4,
      platformLanes: [{ platformIndex: 0, spawnCountdown: 0, activeTrain: activeIce3 }],
    };
    expect(decodeSave(encodeSave(state)).platformLanes[0].activeTrain?.visualVariantId).toBe("ice3-br403-unified");

    const oldState: GameState = {
      ...state,
      platformLanes: [{ platformIndex: 0, spawnCountdown: 0, activeTrain: { ...activeIce3, visualVariantId: undefined } }],
    };
    expect(decodeSave(encodeSave(oldState)).platformLanes[0].activeTrain?.visualVariantId).toBe("ice3-br403-unified");
  });

  it("preserves the Nightjet formation facing and migrates the interim direction field", () => {
    const activeNightjet = {
      trainId: "nightjet",
      visualVariantId: "nightjet-new-generation",
      formationOrientation: -1 as const,
      phase: "approach" as const,
      phaseElapsed: 1,
      phaseDuration: 5,
      payout: 20_000,
      firstService: false,
    };
    const state: GameState = {
      ...fundedState(),
      tier: 5,
      lengthLevel: 5,
      platformLanes: [{ platformIndex: 0, spawnCountdown: 0, activeTrain: activeNightjet }],
    };
    expect(decodeSave(encodeSave(state)).platformLanes[0].activeTrain?.formationOrientation).toBe(-1);

    const interimState = {
      ...state,
      platformLanes: [{ platformIndex: 0, spawnCountdown: 0, activeTrain: { ...activeNightjet, formationOrientation: undefined, travelDirection: -1 } }],
    } as GameState;
    expect(decodeSave(encodeSave(interimState)).platformLanes[0].activeTrain?.formationOrientation).toBe(-1);

    const oldState: GameState = {
      ...state,
      platformLanes: [{ platformIndex: 0, spawnCountdown: 0, activeTrain: { ...activeNightjet, formationOrientation: undefined } }],
    };
    expect(decodeSave(encodeSave(oldState)).platformLanes[0].activeTrain?.formationOrientation).toBe(1);
  });
});
