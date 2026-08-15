import { Document, NodeIO } from "@gltf-transform/core";
import { dedup, prune } from "@gltf-transform/functions";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve("public/models/railjet-lab");
await mkdir(outputDirectory, { recursive: true });

const palettes = {
  classic: {
    red: "#a70f2f",
    redLight: "#cf2541",
    light: "#d8d3ca",
    dark: "#25282b",
    roof: "#383b3d",
    glass: "#142f3a",
  },
  nextgen: {
    red: "#bd1232",
    redLight: "#df2b47",
    light: "#ddd9d0",
    dark: "#22272a",
    roof: "#353a3c",
    glass: "#132f3b",
  },
};

const formations = {
  classic: [
    ["locomotive", 19.3],
    ["economy", 26.4],
    ["economy", 26.4],
    ["economy", 26.4],
    ["economy", 26.4],
    ["restaurant", 26.4],
    ["first", 26.4],
    ["driving-trailer", 26.4],
  ],
  nextgen: [
    ["locomotive", 19.3],
    ["first", 26.5],
    ["first", 26.5],
    ["restaurant", 26.5],
    ["economy", 26.5],
    ["economy", 26.5],
    ["economy", 26.5],
    ["economy", 26.5],
    ["multifunction", 26.5],
    ["driving-trailer", 26.5],
  ],
};

function rgba(hex) {
  const value = hex.slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
    1,
  ];
}

function triangleSoupGeometry(doc, buffer, name, triangles) {
  const positions = [];
  const normals = [];
  for (const [a, b, c] of triangles) {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const magnitude = Math.hypot(...normal) || 1;
    for (const vertex of [a, b, c]) {
      positions.push(...vertex);
      normals.push(normal[0] / magnitude, normal[1] / magnitude, normal[2] / magnitude);
    }
  }
  const indices = new Uint32Array(positions.length / 3);
  for (let index = 0; index < indices.length; index += 1) indices[index] = index;
  return {
    positions: doc.createAccessor(`${name}_position`).setType("VEC3").setArray(new Float32Array(positions)).setBuffer(buffer),
    normals: doc.createAccessor(`${name}_normal`).setType("VEC3").setArray(new Float32Array(normals)).setBuffer(buffer),
    indices: doc.createAccessor(`${name}_indices`).setType("SCALAR").setArray(indices).setBuffer(buffer),
  };
}

function cubeGeometry(doc, buffer) {
  const faces = [
    [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]],
    [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]],
    [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]],
    [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]],
    [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]],
    [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]],
  ];
  return triangleSoupGeometry(doc, buffer, "railjet_cube", faces.flatMap(([a, b, c, d]) => [[a, b, c], [a, c, d]]));
}

function cylinderGeometry(doc, buffer, segments = 14) {
  const triangles = [];
  for (let index = 0; index < segments; index += 1) {
    const a = (index / segments) * Math.PI * 2;
    const b = ((index + 1) / segments) * Math.PI * 2;
    const a0 = [Math.cos(a) * 0.5, -0.5, Math.sin(a) * 0.5];
    const a1 = [Math.cos(a) * 0.5, 0.5, Math.sin(a) * 0.5];
    const b0 = [Math.cos(b) * 0.5, -0.5, Math.sin(b) * 0.5];
    const b1 = [Math.cos(b) * 0.5, 0.5, Math.sin(b) * 0.5];
    triangles.push([a0, a1, b1], [a0, b1, b0]);
  }
  return triangleSoupGeometry(doc, buffer, "railjet_wheel", triangles);
}

function loftGeometry(doc, buffer, name, sections, dimensions) {
  const { width, height, bottom } = dimensions;
  const profile = [
    [0.02, -0.43],
    [0.05, -0.5],
    [0.72, -0.5],
    [0.9, -0.43],
    [1, -0.27],
    [1, 0.27],
    [0.9, 0.43],
    [0.72, 0.5],
    [0.05, 0.5],
    [0.02, 0.43],
  ];
  const rings = sections.map(({ x, widthScale = 1, heightScale = 1 }) => profile.map(([heightFactor, widthFactor]) => [
    x,
    bottom + heightFactor * height * heightScale,
    widthFactor * width * widthScale,
  ]));
  const triangles = [];
  for (let section = 0; section < rings.length - 1; section += 1) {
    for (let point = 0; point < profile.length; point += 1) {
      const next = (point + 1) % profile.length;
      const a = rings[section][point];
      const b = rings[section + 1][point];
      const c = rings[section + 1][next];
      const d = rings[section][next];
      triangles.push([a, b, c], [a, c, d]);
    }
  }
  const cap = (ring, reverse) => {
    const center = [ring[0][0], bottom + height * 0.5, 0];
    for (let point = 0; point < ring.length; point += 1) {
      const next = (point + 1) % ring.length;
      triangles.push(reverse ? [center, ring[next], ring[point]] : [center, ring[point], ring[next]]);
    }
  };
  cap(rings[0], true);
  cap(rings.at(-1), false);
  return triangleSoupGeometry(doc, buffer, name, triangles);
}

function primitive(doc, geometry, material) {
  return doc.createPrimitive()
    .setAttribute("POSITION", geometry.positions)
    .setAttribute("NORMAL", geometry.normals)
    .setIndices(geometry.indices)
    .setMaterial(material);
}

const qx = (angle) => [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)];
const qz = (angle) => [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)];

function createRailjet(generation) {
  const doc = new Document();
  const buffer = doc.createBuffer(`${generation}_railjet_buffer`);
  const palette = palettes[generation];
  const materials = {};
  const materialSpecs = {
    red: [palette.red, 0.2, 0.42],
    redLight: [palette.redLight, 0.14, 0.38],
    light: [palette.light, 0.16, 0.54],
    dark: [palette.dark, 0.34, 0.38],
    roof: [palette.roof, 0.28, 0.48],
    glass: [palette.glass, 0.5, 0.18],
    wheel: ["#171b1d", 0.68, 0.32],
    metal: ["#8f9899", 0.76, 0.3],
    lamp: ["#fff0ad", 0.08, 0.22],
  };
  for (const [name, [color, metallic, roughness]] of Object.entries(materialSpecs)) {
    materials[name] = doc.createMaterial(`${generation}_${name}`)
      .setBaseColorFactor(rgba(color))
      .setMetallicFactor(metallic)
      .setRoughnessFactor(roughness);
  }

  const cube = cubeGeometry(doc, buffer);
  const cylinder = cylinderGeometry(doc, buffer);
  const boxMeshes = Object.fromEntries(Object.entries(materials).map(([name, material]) => [
    name,
    doc.createMesh(`${generation}_${name}_box`).addPrimitive(primitive(doc, cube, material)),
  ]));
  const cylinderMeshes = Object.fromEntries(Object.entries(materials).map(([name, material]) => [
    name,
    doc.createMesh(`${generation}_${name}_cylinder`).addPrimitive(primitive(doc, cylinder, material)),
  ]));

  const coachLength = generation === "classic" ? 26.4 : 26.5;
  const coachShell = loftGeometry(doc, buffer, `${generation}_coach_shell`, [
    { x: -coachLength / 2 },
    { x: coachLength / 2 },
  ], { width: 2.86, height: generation === "classic" ? 3.92 : 4.02, bottom: 0.54 });
  const lowFloorShell = loftGeometry(doc, buffer, `${generation}_low_floor_shell`, [
    { x: -coachLength / 2 },
    { x: coachLength / 2 },
  ], { width: 2.86, height: 3.86, bottom: 0.38 });
  const locoLength = 19.3;
  const locoSections = generation === "classic"
    ? [
        { x: -locoLength / 2 },
        { x: locoLength * 0.2 },
        { x: locoLength * 0.38, widthScale: 0.94, heightScale: 0.95 },
        { x: locoLength / 2, widthScale: 0.68, heightScale: 0.78 },
      ]
    : [
        { x: -locoLength / 2 },
        { x: locoLength * 0.33 },
        { x: locoLength / 2, widthScale: 0.85, heightScale: 0.9 },
      ];
  const locoShell = loftGeometry(doc, buffer, `${generation}_locomotive_shell`, locoSections, { width: 3.02, height: 4.16, bottom: 0.48 });
  const drivingSections = generation === "classic"
    ? [
        { x: -coachLength / 2 },
        { x: coachLength * 0.27 },
        { x: coachLength * 0.43, widthScale: 0.92, heightScale: 0.94 },
        { x: coachLength / 2, widthScale: 0.66, heightScale: 0.78 },
      ]
    : [
        { x: -coachLength / 2 },
        { x: coachLength * 0.34 },
        { x: coachLength / 2, widthScale: 0.78, heightScale: 0.86 },
      ];
  const drivingShell = loftGeometry(doc, buffer, `${generation}_driving_shell`, drivingSections, { width: 2.86, height: 4.02, bottom: 0.5 });
  const shellMeshes = {
    coach: doc.createMesh(`${generation}_coach_loft`).addPrimitive(primitive(doc, coachShell, materials.light)),
    multifunction: doc.createMesh(`${generation}_multifunction_loft`).addPrimitive(primitive(doc, lowFloorShell, materials.light)),
    locomotive: doc.createMesh(`${generation}_locomotive_loft`).addPrimitive(primitive(doc, locoShell, materials.redLight)),
    "driving-trailer": doc.createMesh(`${generation}_driving_trailer_loft`).addPrimitive(primitive(doc, drivingShell, materials.light)),
  };

  const root = doc.createNode(`${generation}_railjet_hybrid_root`).setExtras({
    generation,
    vehicleCount: formations[generation].length,
    units: "metres",
    forward: "+X",
    source: "original-procedural-low-poly",
  });
  doc.createScene(`${generation} Railjet hybrid lab asset`).addChild(root);

  const addBox = (parent, name, material, size, position, rotation) => {
    const node = doc.createNode(name).setMesh(boxMeshes[material]).setScale(size).setTranslation(position);
    if (rotation) node.setRotation(rotation);
    parent.addChild(node);
    return node;
  };
  const addCylinder = (parent, name, material, size, position, rotation) => {
    const node = doc.createNode(name).setMesh(cylinderMeshes[material]).setScale(size).setTranslation(position);
    if (rotation) node.setRotation(rotation);
    parent.addChild(node);
  };

  const addBogie = (vehicle, prefix, x, width = 2.68) => {
    addBox(vehicle, `${prefix}_bogie_frame`, "dark", [2.65, 0.3, 2.25], [x, 0.56, 0]);
    for (const axle of [-0.72, 0.72]) {
      for (const side of [-1, 1]) {
        addCylinder(vehicle, `${prefix}_wheel_${axle}_${side}`, "wheel", [0.48, 0.18, 0.48], [x + axle, 0.48, side * width / 2], qx(Math.PI / 2));
      }
    }
  };

  const addPantograph = (vehicle, prefix, x) => {
    addBox(vehicle, `${prefix}_base`, "dark", [2.3, 0.12, 1.4], [x, 4.42, 0]);
    addBox(vehicle, `${prefix}_left_arm`, "metal", [2.25, 0.08, 0.08], [x - 0.45, 5.2, 0], qz(0.72));
    addBox(vehicle, `${prefix}_right_arm`, "metal", [2.25, 0.08, 0.08], [x + 0.45, 5.2, 0], qz(-0.72));
    addBox(vehicle, `${prefix}_collector`, "dark", [2.5, 0.07, 0.16], [x, 5.95, 0]);
  };

  const addCoachDetails = (vehicle, index, role, length) => {
    const prefix = `${generation}_vehicle_${index}_${role}`;
    const lowFloor = role === "multifunction";
    const windowCount = role === "restaurant" ? 5 : role === "first" ? 6 : lowFloor ? 5 : 8;
    const bandY = lowFloor ? 2.55 : 2.68;
    for (const side of [-1, 1]) {
      addBox(vehicle, `${prefix}_window_band_${side}`, "dark", [length - 1.1, 1.0, 0.045], [0, bandY, side * 1.445]);
      const usable = length - 4.4;
      const spacing = usable / windowCount;
      for (let pane = 0; pane < windowCount; pane += 1) {
        const x = -usable / 2 + spacing * (pane + 0.5);
        addBox(vehicle, `${prefix}_window_${pane}_${side}`, "glass", [spacing * 0.72, lowFloor ? 0.63 : 0.68, 0.055], [x, bandY + 0.02, side * 1.475]);
      }
      const doorXs = lowFloor ? [-7.2, 7.2] : [-9.35, 9.35];
      for (const [doorIndex, x] of doorXs.entries()) {
        addBox(vehicle, `${prefix}_door_${doorIndex}_${side}`, "red", [1.45, lowFloor ? 2.52 : 2.36, 0.07], [x, lowFloor ? 1.64 : 1.78, side * 1.49]);
        addBox(vehicle, `${prefix}_door_glass_${doorIndex}_${side}`, "glass", [0.88, 0.7, 0.075], [x, 2.35, side * 1.53]);
      }
      addBox(vehicle, `${prefix}_red_belt_${side}`, "red", [length - 0.7, 0.24, 0.055], [0, 1.82, side * 1.47]);
    }
    addBox(vehicle, `${prefix}_roof_cap`, "roof", [length - 0.8, 0.2, 2.35], [-0.1, 4.44, 0]);
    addBox(vehicle, `${prefix}_underframe`, "dark", [length - 3.3, 0.34, 1.75], [0, 0.55, 0]);
    addBox(vehicle, `${prefix}_equipment_a`, "roof", [3.2, 0.46, 1.5], [-3.4, 0.62, 0]);
    addBox(vehicle, `${prefix}_equipment_b`, "dark", [2.6, 0.38, 1.6], [2.2, 0.6, 0]);
    addBogie(vehicle, `${prefix}_front`, length / 2 - 3.25);
    addBogie(vehicle, `${prefix}_rear`, -length / 2 + 3.25);
    if (role === "restaurant") {
      addBox(vehicle, `${prefix}_restaurant_skylight`, "glass", [5.8, 0.14, 1.52], [-0.8, 4.68, 0]);
    }
    if (generation === "nextgen") {
      addBox(vehicle, `${prefix}_hvac_a`, "metal", [3.1, 0.28, 1.55], [-4.6, 4.7, 0]);
      addBox(vehicle, `${prefix}_hvac_b`, "metal", [3.1, 0.28, 1.55], [4.2, 4.7, 0]);
    }
  };

  const addCabDetails = (vehicle, index, role, length) => {
    const prefix = `${generation}_vehicle_${index}_${role}`;
    const locomotive = role === "locomotive";
    const frontX = length / 2 - (generation === "classic" ? 0.55 : 0.35);
    addBox(vehicle, `${prefix}_front_mask`, "glass", [0.12, generation === "classic" ? 1.42 : 1.55, 1.76], [frontX, 3.0, 0], qz(generation === "classic" ? -0.15 : -0.06));
    addBox(vehicle, `${prefix}_cab_side_left`, "glass", [2.5, 1.02, 0.06], [length / 2 - 2.8, 3.0, -1.5]);
    addBox(vehicle, `${prefix}_cab_side_right`, "glass", [2.5, 1.02, 0.06], [length / 2 - 2.8, 3.0, 1.5]);
    addBox(vehicle, `${prefix}_lower_apron`, locomotive ? "light" : "red", [3.6, 0.56, 2.28], [length / 2 - 1.15, 0.72, 0], qz(-0.08));
    for (const side of [-1, 1]) {
      addBox(vehicle, `${prefix}_headlight_${side}`, "lamp", [0.12, 0.22, 0.32], [frontX + 0.08, 1.25, side * 0.66]);
    }
    if (locomotive) {
      for (const side of [-1, 1]) {
        addBox(vehicle, `${prefix}_side_dark_panel_${side}`, "dark", [length * 0.68, 1.1, 0.06], [-1.15, 2.45, side * 1.53]);
        addBox(vehicle, `${prefix}_side_light_sweep_${side}`, "light", [length * 0.78, 0.28, 0.07], [-0.2, 1.26, side * 1.55], qz(-0.035));
      }
      addBox(vehicle, `${prefix}_roof`, "roof", [length * 0.72, 0.26, 2.45], [-1.3, 4.65, 0]);
      addPantograph(vehicle, prefix, -2.0);
      addBox(vehicle, `${prefix}_roof_transformer`, "metal", [3.6, 0.34, 1.55], [2.7, 4.74, 0]);
      addBogie(vehicle, `${prefix}_front`, length / 2 - 3.4, 2.82);
      addBogie(vehicle, `${prefix}_rear`, -length / 2 + 3.4, 2.82);
    } else {
      addCoachDetails(vehicle, index, "first", length);
    }
  };

  const formation = formations[generation];
  const totalLength = formation.reduce((sum, [, length]) => sum + length, 0) + (formation.length - 1) * 0.85;
  let cursor = totalLength / 2;
  for (let index = 0; index < formation.length; index += 1) {
    const [role, length] = formation[index];
    const center = cursor - length / 2;
    const vehicle = doc.createNode(`${generation}_vehicle_${index}_${role}`).setTranslation([center, 0, 0]).setExtras({ role, lengthMeters: length });
    root.addChild(vehicle);
    const shellKey = role === "locomotive" || role === "driving-trailer" || role === "multifunction" ? role : "coach";
    vehicle.addChild(doc.createNode(`${generation}_vehicle_${index}_${role}_lofted_shell`).setMesh(shellMeshes[shellKey]));

    if (role === "locomotive" || role === "driving-trailer") addCabDetails(vehicle, index, role, length);
    else addCoachDetails(vehicle, index, role, length);

    if (index < formation.length - 1) {
      addBox(vehicle, `${generation}_vehicle_${index}_coupler`, "dark", [1.15, 0.32, 0.42], [-length / 2 - 0.45, 0.8, 0]);
      addBox(vehicle, `${generation}_vehicle_${index}_bellows`, "dark", [0.24, 2.9, 2.45], [-length / 2 - 0.18, 2.35, 0]);
    }
    cursor -= length + 0.85;
  }

  return doc;
}

const io = new NodeIO();
for (const generation of Object.keys(formations)) {
  const document = createRailjet(generation);
  await document.transform(dedup(), prune());
  await io.write(path.join(outputDirectory, `railjet-${generation}-hybrid.glb`), document);
}

console.log("Generated two metre-scaled, lofted Railjet hybrid GLB formations.");
