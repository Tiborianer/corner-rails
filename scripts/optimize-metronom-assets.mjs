import { NodeIO } from "@gltf-transform/core";
import { KHRMaterialsEmissiveStrength } from "@gltf-transform/extensions";
import { dedup, prune } from "@gltf-transform/functions";
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const candidate = process.argv.includes("--flat") ? "metronom-br146-flat" : "metronom-br146";
const directory = path.resolve("public/models/train-lab", candidate);
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
await writeFile(`assets/blender/${candidate}/optimization.json`, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
