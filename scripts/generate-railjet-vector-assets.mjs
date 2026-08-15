import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve("public/railjet-lab/vector");
await mkdir(outputDirectory, { recursive: true });

const generations = {
  classic: { red: "#a70f2f", redLight: "#d22a43", charcoal: "#29292c", roof: "#3b393b", light: "#d8d3ca", glass: "#152c36" },
  nextgen: { red: "#bd1232", redLight: "#e12b46", charcoal: "#24262a", roof: "#33373b", light: "#ddd9d0", glass: "#142d38" },
};

const roles = ["locomotive", "economy", "restaurant", "first", "multifunction", "driving-trailer"];

function wheelSet(xs) {
  return xs.map((x) => `<g class="wheel"><ellipse cx="${x}" cy="213" rx="18" ry="10" fill="#171b1d"/><ellipse cx="${x}" cy="211" rx="10" ry="6" fill="#596064"/><circle cx="${x}" cy="210" r="3" fill="#b6b8b5"/></g>`).join("");
}

function windows(count, start, end, y = 126, height = 38) {
  const gap = 8;
  const width = (end - start - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, index) => {
    const x = start + index * (width + gap);
    return `<path d="M${x} ${y} L${x + width} ${y - 5} L${x + width} ${y + height - 5} L${x} ${y + height} Z" fill="url(#glass)"/>`;
  }).join("");
}

function doors(xs, lowFloor = false) {
  return xs.map((x) => `<g><path d="M${x} ${lowFloor ? 121 : 116} L${x + 22} ${lowFloor ? 119 : 113} L${x + 22} 190 L${x} 193 Z" fill="#b81734" stroke="#ef6a7d" stroke-width="2"/><path d="M${x + 4} ${lowFloor ? 127 : 122} L${x + 18} ${lowFloor ? 125 : 120} L${x + 18} 151 L${x + 4} 153 Z" fill="#19333e"/></g>`).join("");
}

function pantograph() {
  return `<g fill="none" stroke="#1d2528" stroke-width="6" stroke-linecap="round"><path d="M188 76 L218 34 L248 76"/><path d="M205 54 L235 31"/><path d="M207 27 L249 22"/></g>`;
}

function coachSvg(palette, role, generation) {
  const lowFloor = role === "multifunction";
  const windowCount = role === "restaurant" ? 5 : role === "first" ? 6 : lowFloor ? 5 : 8;
  const doorPositions = lowFloor ? [124, 352] : [86, 389];
  const roofDetails = generation === "nextgen"
    ? `<rect x="202" y="66" width="90" height="13" rx="5" fill="#63696b"/><rect x="223" y="59" width="48" height="9" rx="3" fill="#8c9292"/>`
    : `<rect x="211" y="70" width="70" height="10" rx="4" fill="#5b5c5d"/>`;
  const lowFloorCut = lowFloor ? `<path d="M105 185 L405 161 L405 202 L105 213 Z" fill="${palette.light}" opacity=".92"/>` : "";
  const restaurantRoof = role === "restaurant" ? `<path d="M184 82 L314 69 L338 99 L165 113 Z" fill="#2b3033"/><path d="M196 80 L307 70 L325 91 L181 102 Z" fill="#61747a" opacity=".72"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="256" viewBox="0 0 512 256" role="img" aria-label="Unbranded ${generation} Railjet ${role} vector module">
  <defs><linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#456974"/><stop offset="1" stop-color="${palette.glass}"/></linearGradient></defs>
  <g stroke-linejoin="round">
    <path d="M55 104 L422 72 L462 100 L96 135 Z" fill="${palette.roof}"/>
    <path d="M55 104 L96 135 L96 207 L55 180 Z" fill="${palette.red}"/>
    <path d="M96 135 L462 100 L462 178 L96 207 Z" fill="${palette.light}"/>
    <path d="M96 129 L462 95 L462 157 L96 191 Z" fill="${palette.charcoal}"/>
    <path d="M96 112 L462 80 L462 101 L96 135 Z" fill="${palette.redLight}"/>
    <path d="M96 185 L462 156 L462 171 L96 201 Z" fill="${palette.red}"/>
    ${lowFloorCut}${windows(windowCount, 119, 431, lowFloor ? 122 : 126, lowFloor ? 32 : 38)}${doors(doorPositions, lowFloor)}${roofDetails}${restaurantRoof}
    <path d="M55 180 L96 207 L462 178 L462 191 L96 221 L55 191 Z" fill="#34383a"/>
    ${wheelSet([139, 178, 386, 425])}
  </g></svg>`;
}

function locomotiveSvg(palette, generation) {
  const boxy = generation === "nextgen";
  const nose = boxy ? "M421 88 L469 116 L459 185 L404 198" : "M405 86 L470 123 L454 186 L397 198";
  const cabGlass = boxy ? "M404 95 L448 120 L441 151 L398 139 Z" : "M397 95 L446 124 L438 153 L390 137 Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="256" viewBox="0 0 512 256" role="img" aria-label="Unbranded ${generation} Railjet electric locomotive vector module">
  <defs><linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#53727b"/><stop offset="1" stop-color="${palette.glass}"/></linearGradient></defs>
  <g stroke-linejoin="round">
    <path d="M55 100 L385 70 L${boxy ? 421 : 405} 86 L104 130 Z" fill="${palette.roof}"/>
    <path d="M55 100 L104 130 L104 209 L55 180 Z" fill="${palette.red}"/>
    <path d="M104 130 L${boxy ? 421 : 405} 88 ${nose} L104 221 Z" fill="${palette.redLight}"/>
    <path d="M104 172 L${boxy ? 433 : 432} 139 L454 186 L397 203 L104 221 Z" fill="${palette.light}"/>
    <path d="M110 137 L373 104 L390 150 L111 184 Z" fill="${palette.charcoal}"/>
    <path d="${cabGlass}" fill="url(#glass)" stroke="#0b171c" stroke-width="5"/>
    <path d="M401 161 L443 163 L437 173 L400 174 Z" fill="#f7e7ad"/><circle cx="433" cy="169" r="5" fill="#fff0a8"/>
    <path d="M55 180 L104 209 L397 188 L454 178 L454 194 L397 207 L104 225 L55 191 Z" fill="#34383a"/>
    ${pantograph()}<rect x="267" y="67" width="72" height="11" rx="4" fill="#666d70"/>
    ${wheelSet([139, 177, 350, 389])}
  </g></svg>`;
}

function drivingTrailerSvg(palette, generation) {
  const coach = coachSvg(palette, "first", generation);
  return coach
    .replace(/aria-label="[^"]+"/, `aria-label="Unbranded ${generation} Railjet driving trailer vector module"`)
    .replace('<path d="M96 129 L462 95 L462 157 L96 191 Z"', '<path d="M96 129 L405 100 L458 126 L451 171 L96 191 Z"')
    .replace('</g></svg>', `<path d="M405 94 L462 124 L451 162 L397 145 Z" fill="url(#glass)" stroke="#0b171c" stroke-width="5"/><path d="M416 172 L451 168" stroke="#fff0ad" stroke-width="7" stroke-linecap="round"/></g></svg>`);
}

for (const [generation, palette] of Object.entries(generations)) {
  for (const role of roles) {
    const content = role === "locomotive"
      ? locomotiveSvg(palette, generation)
      : role === "driving-trailer"
        ? drivingTrailerSvg(palette, generation)
        : coachSvg(palette, role, generation);
    await writeFile(path.join(outputDirectory, `${generation}-${role}.svg`), content);
  }
}

console.log(`Generated ${Object.keys(generations).length * roles.length} deterministic Railjet SVG modules.`);
