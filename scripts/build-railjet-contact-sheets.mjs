import sharp from "sharp";
import path from "node:path";

const directory = path.resolve("qa/railjet-lab");
const candidates = [
  { desktop: "classic-generated-desktop.jpg", mobile: "classic-generated-mobile.png" },
  { desktop: "classic-vector-desktop.jpg", mobile: "classic-vector-mobile.png" },
  { desktop: "classic-hybrid-desktop.jpg", mobile: "classic-hybrid-mobile.png" },
  { desktop: "classic-blender-desktop.png", mobile: "classic-blender-mobile.png" },
  { desktop: "nextgen-generated-desktop.jpg", mobile: "nextgen-generated-mobile.png" },
  { desktop: "nextgen-vector-desktop.jpg", mobile: "nextgen-vector-mobile.png" },
  { desktop: "nextgen-hybrid-desktop.jpg", mobile: "nextgen-hybrid-mobile.png" },
  { desktop: "nextgen-blender-desktop.png", mobile: "nextgen-blender-mobile.png" },
];

async function buildSheet({ kind, tileWidth, tileHeight, output }) {
  const gap = 10;
  const margin = 16;
  const columns = 4;
  const width = margin * 2 + tileWidth * columns + gap * (columns - 1);
  const height = margin * 2 + tileHeight * 2 + gap;
  const inputs = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const image = await sharp(path.join(directory, candidates[index][kind]))
      .resize(tileWidth, tileHeight, { fit: "cover" })
      .jpeg({ quality: 88 })
      .toBuffer();
    inputs.push({
      input: image,
      left: margin + (index % columns) * (tileWidth + gap),
      top: margin + Math.floor(index / columns) * (tileHeight + gap),
    });
  }
  await sharp({ create: { width, height, channels: 3, background: "#172522" } })
    .composite(inputs)
    .jpeg({ quality: 90, progressive: true })
    .toFile(path.join(directory, output));
}

await buildSheet({ kind: "desktop", tileWidth: 480, tileHeight: 270, output: "railjet-bakeoff-desktop.jpg" });
await buildSheet({ kind: "mobile", tileWidth: 195, tileHeight: 422, output: "railjet-bakeoff-mobile.jpg" });
console.log("Built desktop and mobile Railjet bake-off contact sheets.");
