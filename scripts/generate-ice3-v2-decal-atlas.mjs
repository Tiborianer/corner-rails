import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve("assets/blender/ice3-br403-v2");
const outputPath = path.join(outputDirectory, "ice3-br403-v2-decals.png");

await mkdir(outputDirectory, { recursive: true });

// Original, code-authored trim atlas. It deliberately contains no copied
// photography, operator logo, protected wordmark, or downloaded artwork.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="512" viewBox="0 0 2048 512">
  <rect width="2048" height="512" fill="none"/>
  <path d="M0 277 H2048 V296 H0 Z" fill="#d31827"/>
  <g fill="#778187" opacity="0.9">
    <rect x="115" y="401" width="128" height="18" rx="5"/>
    <rect x="280" y="401" width="92" height="18" rx="5"/>
    <rect x="712" y="411" width="108" height="15" rx="4"/>
    <rect x="850" y="411" width="68" height="15" rx="4"/>
    <rect x="1275" y="401" width="138" height="18" rx="5"/>
  </g>
  <g fill="#333d42" opacity="0.95">
    <rect x="425" y="389" width="64" height="31" rx="4"/>
    <rect x="504" y="389" width="64" height="31" rx="4"/>
    <rect x="1012" y="394" width="86" height="28" rx="4"/>
    <rect x="1455" y="389" width="78" height="31" rx="4"/>
  </g>
  <g stroke="#4d585e" stroke-width="4">
    <path d="M1510 126 h112"/>
    <path d="M1510 139 h112"/>
    <path d="M1510 152 h112"/>
    <path d="M1510 165 h112"/>
  </g>
  <circle cx="1438" cy="212" r="8" fill="#d31827"/>
  <circle cx="1438" cy="212" r="3" fill="#f4d8d4"/>
</svg>`;

await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9, palette: true })
  .toFile(outputPath);

console.log(`CORNER_RAILS_ICE3_V2_ATLAS ${outputPath}`);
