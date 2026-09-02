import { NodeIO } from "@gltf-transform/core";
import { KHRMaterialsEmissiveStrength } from "@gltf-transform/extensions";
import { dedup, prune } from "@gltf-transform/functions";
import { readdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";

const assetDirectories = [
  path.resolve("public/models/train-lab/ice3-br403-v2-unified"),
  path.resolve("public/models/trains/blender/ice3"),
];
const io = new NodeIO().registerExtensions([KHRMaterialsEmissiveStrength]);
const report = [];

for (const assetDirectory of assetDirectories) {
  const files = (await readdir(assetDirectory)).filter((file) => file.endsWith(".glb")).sort();
  for (const file of files) {
    const assetPath = path.join(assetDirectory, file);
    const temporaryPath = `${assetPath}.optimized.glb`;
    const before = (await stat(assetPath)).size;
    const document = await io.read(assetPath);
    await document.transform(dedup(), prune({ keepLeaves: true }));
    await io.write(temporaryPath, document);
    const candidate = (await stat(temporaryPath)).size;
    if (candidate < before) await rename(temporaryPath, assetPath);
    else await unlink(temporaryPath);
    const after = (await stat(assetPath)).size;
    report.push({ file: path.relative(process.cwd(), assetPath), before, candidate, after, saved: before - after });
  }
}

console.log(JSON.stringify({ optimizer: "glTF Transform dedup + prune", assets: report }, null, 2));
