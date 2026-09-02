import { NodeIO } from "@gltf-transform/core";
import { dedup, prune } from "@gltf-transform/functions";
import { readdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";

const assetDirectory = path.resolve("public/models/train-lab/ice3-br403-v2-continuity");
const io = new NodeIO();
const files = (await readdir(assetDirectory)).filter((file) => file.endsWith(".glb")).sort();
const report = [];

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
  report.push({ file, before, candidate, after, saved: before - after });
}

console.log(JSON.stringify({ optimizer: "glTF Transform dedup + prune", assets: report }, null, 2));
