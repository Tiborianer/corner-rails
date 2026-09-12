import { NodeIO } from "@gltf-transform/core";
import { KHRMaterialsEmissiveStrength } from "@gltf-transform/extensions";
import { dedup, prune } from "@gltf-transform/functions";
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const directory = path.resolve("public/models/train-lab/metronom-br146");
const io = new NodeIO().registerExtensions([KHRMaterialsEmissiveStrength]);
const report = [];
for (const name of (await readdir(directory)).filter(name => name.endsWith(".glb")).sort()) {
  const file = path.join(directory, name);
  const before = (await stat(file)).size;
  const doc = await io.read(file);
  await doc.transform(dedup(), prune({ keepLeaves: true }));
  await io.write(file, doc);
  report.push({ name, before, after: (await stat(file)).size });
}
await writeFile("assets/blender/metronom-br146/optimization.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
