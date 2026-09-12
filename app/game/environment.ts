/** Cosmetic randomness is independent of the economy RNG. All coordinates are world units. */
export function sceneryRandom(seed: number) {
  let n = Math.imul(seed ^ 0x7f4a7c15, 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export type TreeKind = "oak" | "birch" | "spruce" | "poplar" | "pine";
export interface SceneryTree { x: number; z: number; scale: number; kind: TreeKind; rotation: number }
export const TREE_KINDS: readonly TreeKind[] = ["oak", "birch", "spruce", "poplar", "pine"];

export function scatteredTrees(frontPlatformZ: number, roadZ: number): SceneryTree[] {
  const trees: SceneryTree[] = [];
  for (let attempt = 0; attempt < 700 && trees.length < 88; attempt++) {
    const x = (sceneryRandom(attempt * 9 + 1) - .5) * 54;
    const front = sceneryRandom(attempt * 9 + 2) > .4;
    // Reserve the whole future road/town envelope even before it is purchased.
    const z = front
      ? frontPlatformZ + 2.5 + sceneryRandom(attempt * 9 + 3) * 7
      : roadZ - 3.8 - sceneryRandom(attempt * 9 + 3) * 6;
    const scale = .85 + sceneryRandom(attempt * 9 + 4) * .9;
    if (trees.some(t => Math.hypot(t.x - x, t.z - z) < .65 * (scale + t.scale))) continue;
    trees.push({ x, z, scale, kind: TREE_KINDS[attempt % 5], rotation: sceneryRandom(attempt * 9 + 5) * Math.PI * 2 });
  }
  return trees;
}

export interface TownPlot { id: number; x: number; z: number; apartment: boolean; floors: number; reveal: number }
export function roadsideTown(roadAgeSeconds: number, tier: number, roadZ: number): TownPlot[] {
  const xs = [-5.6, 1.2, -2.2, 4.6, -9, 8, -12.4, 11.4];
  return xs.flatMap((x, id) => {
    const apartment = id >= 4;
    if (apartment && tier < 4) return [];
    const startsAt = apartment ? 480 + (id - 4) * 90 : 20 + id * 70;
    const reveal = Math.min(1, Math.max(0, (roadAgeSeconds - startsAt) / 3));
    return reveal > 0 ? [{id, x, z: roadZ - 1.75, apartment, floors: apartment ? 3 + id % 2 : 1 + id % 2, reveal}] : [];
  });
}

export function birdEncounter(time: number) {
  const cycle = Math.floor(time / 110);
  const start = 18 + sceneryRandom(cycle + 931) * 35;
  const elapsed = time % 110 - start;
  return { cycle, active: elapsed >= 0 && elapsed < 25, progress: Math.min(1, Math.max(0, elapsed / 25)), count: 3 + cycle % 3 };
}

/** A reserved meadow corridor: no deer ever enter the railway or roadway. */
export function deerEncounter(time: number, frontPlatformZ: number) {
  const cycle = Math.floor(time / 160);
  const elapsed = time % 160 - 25;
  const active = elapsed >= 0 && elapsed < 56;
  let x: number;
  let moving = true;
  if (elapsed < 18) x = -32 + Math.max(0, elapsed) / 18 * 27;
  else if (elapsed < 26) { x = -5; moving = false; }
  else if (elapsed < 36) x = -5 + (elapsed - 26);
  else if (elapsed < 42) { x = 5; moving = false; }
  else x = 5 + (elapsed - 42) / 14 * 27;
  const direction = cycle % 2 === 0 ? 1 : -1;
  return { active, moving, x: x * direction, z: frontPlatformZ + 1.35 + .12 * Math.sin(x * .5), direction };
}
