import { NodeIO } from "@gltf-transform/core";
import { KHRMaterialsEmissiveStrength } from "@gltf-transform/extensions";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";

const source = path.resolve("public/models/train-lab/ice3-br403-v2-unified/ice3-br403-v2-unified-blender.glb");
const destination = path.resolve("public/models/trains/blender/ice3/ice3-br403-unified-blender.glb");
const io = new NodeIO().registerExtensions([KHRMaterialsEmissiveStrength]);
const document = await io.read(source);
const root = document.getRoot().listNodes().find((node) => node.getName() === "ice3_br403_v2_unified_root");

if (!root) throw new Error("Unified ICE 3 formation root was not found.");

root.setExtras({
  ...root.getExtras(),
  formation: "DB ICE 3 Class 403 unified eight-car production formation",
  approval_status: "approved production",
  production_train_id: "ice3",
  production_registry_modified: true,
  asset_revision: "blender-unified-production-2026-09-02",
});

await mkdir(path.dirname(destination), { recursive: true });
await io.write(destination, document);

console.log(JSON.stringify({
  source: path.relative(process.cwd(), source),
  destination: path.relative(process.cwd(), destination),
  bytes: (await stat(destination)).size,
  status: "approved-production",
}, null, 2));
