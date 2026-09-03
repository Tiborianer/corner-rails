import { NodeIO } from "@gltf-transform/core";
import { dedup, prune } from "@gltf-transform/functions";
import { readdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";

const directories = [
  path.resolve("public/models/train-lab/railjet-classic-livery-v2"),
  path.resolve("public/models/train-lab/railjet-nextgen-livery-v2"),
];
const io = new NodeIO();
const report = [];

for (const directory of directories) {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".glb")).sort();
  for (const file of files) {
    const assetPath = path.join(directory, file);
    const temporaryPath = `${assetPath}.optimized.glb`;
    const before = (await stat(assetPath)).size;
    const document = await io.read(assetPath);
    await document.transform(dedup(), prune({ keepLeaves: true }));
    await io.write(temporaryPath, document);
    const candidate = (await stat(temporaryPath)).size;
    if (candidate < before) await rename(temporaryPath, assetPath);
    else await unlink(temporaryPath);
    const after = (await stat(assetPath)).size;
    report.push({ file: path.relative(process.cwd(), assetPath), before, after, saved: before - after });
  }
}

console.log(JSON.stringify({ optimizer: "glTF Transform dedup + prune", assets: report }, null, 2));
