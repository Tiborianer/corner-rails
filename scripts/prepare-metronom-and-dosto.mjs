import { NodeIO } from "@gltf-transform/core";
import { KHRMaterialsEmissiveStrength } from "@gltf-transform/extensions";
import { dedup, prune } from "@gltf-transform/functions";
import { mkdir, readdir, copyFile, readFile, writeFile } from "node:fs/promises";

const dir = "public/models/train-lab/db-regional-express-r3";
const io = new NodeIO().registerExtensions([KHRMaterialsEmissiveStrength]);
for (const name of await readdir(dir)) {
  if (!name.endsWith(".glb")) continue;
  const doc = await io.read(`${dir}/${name}`);
  await doc.transform(dedup(), prune({keepLeaves: true}));
  await io.write(`${dir}/${name}`, doc);
}
await mkdir("public/models/trains/blender/metronom", {recursive:true});
for (const [livery,candidate] of [["curved","metronom-br146"],["flat","metronom-br146-flat"]]) {
  await copyFile(`public/models/train-lab/${candidate}/metronom-br146-blender.glb`, `public/models/trains/blender/metronom/metronom-${livery}.glb`);
  const file = `assets/blender/${candidate}/manifest.json`;
  const manifest = JSON.parse(await readFile(file,"utf8"));
  manifest.approvalStatus = "approved-production";
  manifest.productionRegistryModified = true;
  manifest.livery = livery;
  manifest.productionLiveryChance = 0.5;
  manifest.productionAsset = `public/models/trains/blender/metronom/metronom-${livery}.glb`;
  if(livery === "flat") manifest.visualGuides = {livery:"Straight horizontal yellow lower half and white upper sides, blue trim; same four-vehicle geometry as curved M1."};
  await writeFile(file, JSON.stringify(manifest,null,2)+"\n");
}
