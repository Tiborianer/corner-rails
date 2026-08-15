import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const jobs = [
  { generation: "classic", sheet: "assets/railjet-lab/source/classic-module-sheet.png" },
  { generation: "nextgen", sheet: "assets/railjet-lab/source/nextgen-module-sheet.png" },
];

function connectedModules(pixels, info) {
  const pixelCount = info.width * info.height;
  const labels = new Int32Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  const components = [];
  let nextLabel = 1;

  for (let start = 0; start < pixelCount; start += 1) {
    if (labels[start] !== 0) continue;
    if (pixels[start * info.channels + 3] <= 1) {
      labels[start] = -1;
      continue;
    }
    const label = nextLabel++;
    let head = 0;
    let tail = 0;
    let count = 0;
    let minX = info.width;
    let maxX = 0;
    let minY = info.height;
    let maxY = 0;
    labels[start] = label;
    queue[tail++] = start;

    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      const neighbors = [pixel - 1, pixel + 1, pixel - info.width, pixel + info.width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= pixelCount || labels[neighbor] !== 0) continue;
        const neighborX = neighbor % info.width;
        if (Math.abs(neighborX - x) > 1) continue;
        if (pixels[neighbor * info.channels + 3] <= 1) {
          labels[neighbor] = -1;
          continue;
        }
        labels[neighbor] = label;
        queue[tail++] = neighbor;
      }
    }
    if (count > 1_000) components.push({ label, count, minX, maxX, minY, maxY });
  }

  const modules = components.sort((a, b) => a.minX - b.minX);
  if (modules.length !== 5) throw new Error(`Module sheet must contain five separated vehicles; detected ${modules.length}.`);
  return { labels, modules };
}

for (const job of jobs) {
  const source = sharp(job.sheet);
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height || !metadata.hasAlpha) {
    throw new Error(`${job.sheet} must be a transparent RGBA module sheet.`);
  }

  const outputDirectory = path.resolve(`public/railjet-lab/generated/${job.generation}`);
  await mkdir(outputDirectory, { recursive: true });
  const { data: pixels, info } = await sharp(job.sheet).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { labels, modules } = connectedModules(pixels, info);

  for (let index = 0; index < 5; index += 1) {
    const component = modules[index];
    const left = Math.max(0, component.minX - 8);
    const top = Math.max(0, component.minY - 8);
    const width = Math.min(info.width - left, component.maxX - component.minX + 17);
    const height = Math.min(info.height - top, component.maxY - component.minY + 17);
    const isolated = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const sourceX = left + x;
        const sourceY = top + y;
        const sourcePixel = sourceY * info.width + sourceX;
        if (labels[sourcePixel] !== component.label) continue;
        const sourceOffset = sourcePixel * info.channels;
        const outputOffset = (y * width + x) * 4;
        pixels.copy(isolated, outputOffset, sourceOffset, sourceOffset + 4);
      }
    }
    const output = path.join(outputDirectory, `${String(index + 1).padStart(2, "0")}.webp`);
    await sharp(isolated, { raw: { width, height, channels: 4 } })
      .resize({
        width: 480,
        height: 480,
        fit: "contain",
        position: "south",
        withoutEnlargement: false,
        kernel: sharp.kernel.lanczos3,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: 16,
        bottom: 16,
        left: 16,
        right: 16,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 80, alphaQuality: 100, effort: 3 })
      .toFile(output);
  }
}

console.log("Prepared two five-module Railjet WebP sheets with shared bottom-center anchors.");
