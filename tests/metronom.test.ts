import { describe, expect, it } from "vitest";
import { NodeIO, getBounds } from "@gltf-transform/core";
import { KHRMaterialsEmissiveStrength } from "@gltf-transform/extensions";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { TRAIN_REVIEW_CANDIDATES, trainReviewFormationRotation, trainReviewMotionPosition } from "../app/game/trainReviewData";
import { trainVisualVariants } from "../app/game/trainVisuals";

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

  it("keeps approval pending, modules available and production metronom unchanged", async () => {
    const manifest = JSON.parse(await readFile("assets/blender/metronom-br146/manifest.json", "utf8"));
    expect(manifest).toMatchObject({ vehicleCount: 4, lengthMeters: 100.2, approvalStatus: "private-review", productionRegistryModified: false });
    expect(Object.keys(manifest.moduleGlbs)).toHaveLength(4);
    for (const modulePath of Object.values(manifest.moduleGlbs)) {
      const root = (await new NodeIO().registerExtensions([KHRMaterialsEmissiveStrength]).read(modulePath as string)).getRoot();
      expect(root.listNodes().find(n => n.getName() === "rail_contact_origin")).toBeDefined();
    }
    expect(TRAIN_REVIEW_CANDIDATES["metronom-br146"].supportsCabCarLeading).toBe(true);
    expect(trainVisualVariants({ id: "metronom", modelKey: "metronom" }).every(v => v.profile === "legacy-v1")).toBe(true);
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
