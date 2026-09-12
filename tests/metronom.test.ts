import { describe, expect, it } from "vitest";
import { NodeIO, getBounds } from "@gltf-transform/core";
import { KHRMaterialsEmissiveStrength } from "@gltf-transform/extensions";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { TRAIN_REVIEW_CANDIDATES, trainReviewFormationRotation, trainReviewMotionPosition } from "../app/game/trainReviewData";
import { trainVisualVariants, selectTrainVisualVariant } from "../app/game/trainVisuals";
import { createInitialState } from "../app/game/data";
import { encodeSave, decodeSave } from "../app/game/save";

const file = "public/models/train-lab/metronom-br146/metronom-br146-blender.glb";
const load = () => new NodeIO().registerExtensions([KHRMaterialsEmissiveStrength]).read(file);

describe("metronom curved-livery Blender review", () => {
  it("exports four distinct vehicle roles, exact gauge and grounded wheels", async () => {
    const root = (await load()).getRoot();
    const nodes = root.listNodes();
    expect(nodes.filter(n => /^vehicle_\d\d_/.test(n.getName())).map(n => n.getName())).toEqual([
      "vehicle_01_br146", "vehicle_02_second_class", "vehicle_03_bicycle", "vehicle_04_cab_car",
    ]);
    expect(nodes.find(n => n.getName() === "rail_contact_origin")?.getWorldTranslation()).toEqual([0, 0, 0]);
    const wheels = nodes.filter(n => /_wheel_-?1_[01](?:\.\d+)?$/.test(n.getName()));
    expect(wheels).toHaveLength(32);
    for (const wheel of wheels) {
      const [, y, z] = wheel.getWorldTranslation();
      expect(Math.abs(z)).toBeCloseTo(.7175, 4);
      expect(y).toBeCloseTo(wheel.getName().startsWith("br146") ? .625 : .46, 4);
    }
    const bounds = getBounds(root.listScenes()[0]);
    expect(bounds.max[0] - bounds.min[0]).toBeCloseTo(100.3, 1);
    expect(bounds.max[1]).toBeCloseTo(5.5, 4);
    expect(nodes.some(n => /^review_|calibration_track/.test(n.getName()))).toBe(false);
  });

  it("ships original curved surfaces, emissive headlights and no reference images", async () => {
    const root = (await load()).getRoot();
    const names = root.listNodes().map(n => n.getName());
    expect(names.filter(n => n.includes("yellow_sweep"))).toHaveLength(2);
    expect(names.filter(n => n.includes("yellow_curve"))).toHaveLength(6);
    expect(names.filter(n => n.includes("cab_car_panoramic_windscreen"))).toHaveLength(1);
    expect(names.filter(n => n.includes("br146_windscreen_glass"))).toHaveLength(4);
    expect(root.listTextures()).toHaveLength(0);
    const lamp = root.listNodes().find(n => n.getName().includes("cab_car_headlamp"))?.getMesh()?.listPrimitives()[0].getMaterial();
    expect(lamp?.getEmissiveFactor().some(v => v > 0)).toBe(true);
    const bytes = await readFile(file);
    expect(bytes.length).toBeLessThan(1_200_000);
    expect(gzipSync(bytes).length).toBeLessThan(300_000);
  });

  it("keeps modules available and promotes both user-requested liveries", async () => {
    const manifest = JSON.parse(await readFile("assets/blender/metronom-br146/manifest.json", "utf8"));
    expect(manifest).toMatchObject({ vehicleCount: 4, lengthMeters: 100.2, approvalStatus: "approved-production", productionRegistryModified: true });
    expect(Object.keys(manifest.moduleGlbs)).toHaveLength(4);
    for (const modulePath of Object.values(manifest.moduleGlbs)) {
      const root = (await new NodeIO().registerExtensions([KHRMaterialsEmissiveStrength]).read(modulePath as string)).getRoot();
      expect(root.listNodes().find(n => n.getName() === "rail_contact_origin")).toBeDefined();
    }
    expect(TRAIN_REVIEW_CANDIDATES["metronom-br146"].supportsCabCarLeading).toBe(true);
    expect(trainVisualVariants({ id: "metronom", modelKey: "metronom" }).every(v => v.profile === "metric-v1")).toBe(true);
  });

  it("selects equal-probability liveries and persists the choice through saves", () => {
    const train = {id:"metronom",modelKey:"metronom"};
    expect(selectTrainVisualVariant(train,3,0).id).toBe("metronom-curved");
    expect(selectTrainVisualVariant(train,3,.499999).id).toBe("metronom-curved");
    expect(selectTrainVisualVariant(train,3,.5).id).toBe("metronom-flat");
    expect(selectTrainVisualVariant(train,3,.999999).id).toBe("metronom-flat");
    const counts = {"metronom-curved":0,"metronom-flat":0};
    for(let i=0;i<1000;i++) counts[selectTrainVisualVariant(train,3,i/1000).id as keyof typeof counts]++;
    expect(counts).toEqual({"metronom-curved":500,"metronom-flat":500});
    for(const variant of trainVisualVariants(train)) {
      const state = createInitialState();
      state.platformLanes=[{platformIndex:0,spawnCountdown:0,activeTrain:{trainId:"metronom",visualVariantId:variant.id,formationOrientation:-1,phase:"approach",phaseElapsed:1,phaseDuration:10,payout:100,firstService:false}}];
      const restored=decodeSave(encodeSave(state)).platformLanes[0].activeTrain;
      expect(restored?.visualVariantId).toBe(variant.id);
      expect(restored?.formationOrientation).toBe(-1);
    }
  });

  it("promotes the rounded Regional-Express without changing its approved geometry", async () => {
    const candidate = TRAIN_REVIEW_CANDIDATES["db-regional-express-r3"];
    expect(candidate.approvalStatus).toBe("approved-production");
    const variant = trainVisualVariants({id:"db-regional-express",modelKey:"desiro-hc"})[0];
    expect(`/${variant.assetPath}`).toBe(candidate.assetPath);
    expect(await readFile(`public/${variant.assetPath}`)).toEqual(await readFile("public/models/train-lab/db-regional-express-r3/db-regional-express-r3.glb"));
    const doc=await new NodeIO().registerExtensions([KHRMaterialsEmissiveStrength]).read("public/models/train-lab/db-regional-express-r3/db-regional-express-r3.glb");
    const nodes=doc.getRoot().listNodes();
    expect(nodes.filter(n=>n.getName().includes("r3_continuous_rounded_shell"))).toHaveLength(3);
    expect(nodes.filter(n=>n.getName().includes("r3_cab_panoramic_glass"))).toHaveLength(1);
    expect(nodes.filter(n=>/_wheel_-?1_[01](?:\.\d+)?$/.test(n.getName()))).toHaveLength(32);
    const pane=nodes.find(n=>n.getName().includes("r3_second_class_upper") && n.getName().includes("_pane"));
    const positions=pane?.getMesh()?.listPrimitives()[0].getAttribute("POSITION");
    expect(positions).toBeDefined();
    const xyz=[0,0,0]; const widths:number[]=[];
    for(let i=0;i<positions!.getCount();i++){positions!.getElement(i,xyz);widths.push(Math.abs(xyz[2]));}
    expect(Math.max(...widths)-Math.min(...widths)).toBeGreaterThan(.1);
    expect(doc.getRoot().listTextures()).toHaveLength(0);
  });

  it("reverses the formation without reversing travel and keeps smooth stop/pass motion", () => {
    expect(trainReviewFormationRotation("taurus")).toBe(0);
    expect(trainReviewFormationRotation("cab-car")).toBe(Math.PI);
    for (const time of [5, 6, 9, 10]) expect(trainReviewMotionPosition("stopping", time)).toBe(0);
    for (let frame = 1; frame < 720; frame++) {
      const previous = trainReviewMotionPosition("pass", (frame - 1) / 60);
      const current = trainReviewMotionPosition("pass", frame / 60);
      expect(current).toBeGreaterThanOrEqual(previous);
      expect(current - previous).toBeLessThan(.12);
    }
    expect(trainReviewMotionPosition("pass", 0)).toBeLessThan(-25);
    expect(trainReviewMotionPosition("pass", 11.99)).toBeGreaterThan(25);
  });
});
