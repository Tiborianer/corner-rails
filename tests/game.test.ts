import { describe, expect, it } from "vitest";
import { getBounds, NodeIO } from "@gltf-transform/core";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import sharp from "sharp";
import { LENGTH_COSTS, PLATFORM_COSTS, TRAINS, createInitialState } from "../app/game/data";
import { decodeSave, encodeSave } from "../app/game/save";
import {
  canPurchase,
  cleanStation,
  cleaningCost,
  daylightFactor,
  debugState,
  isNight,
  purchaseUpgrade,
  stationRating,
  tickGame,
  tierUp,
  trainMeetsRequirements,
  triggerEvent,
  undoLastUpgrade,
} from "../app/game/simulation";
import type { GameState } from "../app/game/types";
import { TRAFFIC_CAR_KINDS, catenaryPolePositions, trainMotionPosition } from "../app/game/visual";
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
  RAILJET_VISUAL_VARIANTS,
  resolveTrainVisualVariant,
  selectTrainVisualVariant,
  trainVisualVariants,
} from "../app/game/trainVisuals";
import {
  TRAIN_REVIEW_CANDIDATES,
  TRAIN_REVIEW_METRIC_SCALE,
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

  it("moves a run-through train continuously from entry to exit", () => {
    const entry = trainMotionPosition("pass", 0, 10, -34, 4, 36);
    const halfway = trainMotionPosition("pass", 5, 10, -34, 4, 36);
    const exit = trainMotionPosition("pass", 10, 10, -34, 4, 36);
    expect(entry).toBe(-34);
    expect(halfway).toBeCloseTo(1);
    expect(exit).toBe(36);
  });

  it("provides at least ten distinct road-traffic silhouettes", () => {
    expect(TRAFFIC_CAR_KINDS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(TRAFFIC_CAR_KINDS).size).toBe(TRAFFIC_CAR_KINDS.length);
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

  it("registers the Nightjet candidate for review without replacing production", () => {
    expect(TRAIN_REVIEW_CANDIDATES["nightjet-new-generation"]).toMatchObject({
      approvalStatus: "private-review",
      productionTrainId: "nightjet",
      assetRevision: "1",
      vehicleCount: 8,
      nominalLengthMeters: 204.675,
      traction: "electric",
    });
    const productionVisual = trainVisualVariants({ id: "nightjet", modelKey: "nightjet" })[0];
    expect(productionVisual.profile).toBe("legacy-v1");
    expect(productionVisual.assetPath).toContain("models/trains/nightjet.glb");
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
      approval_status: "private review only",
      production_train_id: "nightjet",
      coach_set: "2 seating + 3 couchette + 2 sleeping",
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
      approvalStatus: "private-review",
      productionRegistryModified: false,
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
  });
});

describe("production metric railway and Railjet registry", () => {
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

  it("promotes exactly two metric Railjet variants while every other train remains legacy", () => {
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
    for (const train of TRAINS.filter((candidate) => candidate.id !== "railjet")) {
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
});
