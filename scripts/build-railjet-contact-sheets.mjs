import sharp from "sharp";
import path from "node:path";

const directory = path.resolve("qa/railjet-lab");
const candidates = [
  "classic-generated",
  "classic-vector",
  "classic-hybrid",
  "nextgen-generated",
  "nextgen-vector",
  "nextgen-hybrid",
];

async function buildSheet({ suffix, extension, tileWidth, tileHeight, output }) {
  const gap = 10;
  const margin = 16;
  const width = margin * 2 + tileWidth * 3 + gap * 2;
  const height = margin * 2 + tileHeight * 2 + gap;
  const inputs = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const image = await sharp(path.join(directory, `${candidates[index]}-${suffix}.${extension}`))
      .resize(tileWidth, tileHeight, { fit: "cover" })
      .jpeg({ quality: 88 })
      .toBuffer();
    inputs.push({
      input: image,
      left: margin + (index % 3) * (tileWidth + gap),
      top: margin + Math.floor(index / 3) * (tileHeight + gap),
    });
  }
  await sharp({ create: { width, height, channels: 3, background: "#172522" } })
    .composite(inputs)
    .jpeg({ quality: 90, progressive: true })
    .toFile(path.join(directory, output));
}

await buildSheet({ suffix: "desktop", extension: "jpg", tileWidth: 640, tileHeight: 360, output: "railjet-bakeoff-desktop.jpg" });
await buildSheet({ suffix: "mobile", extension: "png", tileWidth: 260, tileHeight: 563, output: "railjet-bakeoff-mobile.jpg" });
console.log("Built desktop and mobile Railjet bake-off contact sheets.");
