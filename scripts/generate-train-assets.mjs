import { Document, NodeIO } from "@gltf-transform/core";
import { dedup, prune } from "@gltf-transform/functions";
import { mkdir } from "node:fs/promises";
import path from "node:path";

/*
 * Original low-poly lead vehicles for Corner Rails.  Each family preserves the
 * silhouette and livery blocks that make the real train readable at diorama
 * scale.  Logos are deliberately omitted; the game ships no downloaded models
 * or protected brand artwork.
 */
const assets = [
  { id: "br650", family: "rs1", body: "#d9dde0", accent: "#d71920", roof: "#8c969b", windows: "#193847" },
  { id: "br642", family: "desiro", body: "#e2e4e5", accent: "#c8102e", roof: "#858b8e", windows: "#183745" },
  { id: "br648", family: "lint", body: "#e7e8e8", accent: "#df1027", roof: "#7f898e", windows: "#153744" },
  { id: "desiro-hc", family: "desiro-hc", body: "#f1f1ed", accent: "#cc132c", roof: "#67747b", windows: "#133946" },
  { id: "metronom", family: "traxx", body: "#174f7d", accent: "#f3c400", roof: "#254257", windows: "#183d59" },
  { id: "talent2", family: "talent2", body: "#e7e8e8", accent: "#d6122b", roof: "#899197", windows: "#153744" },
  { id: "flixtrain", family: "vectron", body: "#76bf43", accent: "#153d2c", roof: "#333b38", windows: "#152f37" },
  { id: "ic1", family: "br101", body: "#eeeeea", accent: "#cf1530", roof: "#85898a", windows: "#1a3039" },
  { id: "ic2", family: "br147", body: "#eeeeea", accent: "#c9152d", roof: "#797f81", windows: "#203844" },
  { id: "ice2", family: "ice2", body: "#f4f2e9", accent: "#d1152e", roof: "#d8d8d2", windows: "#20343d" },
  { id: "ice3", family: "ice3", body: "#f7f4ea", accent: "#d3162f", roof: "#dfdfda", windows: "#1b313a" },
  { id: "ice4", family: "ice4", body: "#f5f3e9", accent: "#cd142d", roof: "#e0e0da", windows: "#182f39" },
  { id: "railjet", family: "taurus", body: "#a20d2e", accent: "#e7e0d2", roof: "#3b3437", windows: "#172e37" },
  { id: "nightjet", family: "vectron", body: "#10244f", accent: "#38a8dd", roof: "#101a31", windows: "#f4d26c" },
  { id: "tgv-duplex", family: "tgv", body: "#e6e5df", accent: "#6c3a8f", roof: "#777b80", windows: "#243642" },
  { id: "regiojet-cz", family: "vectron", body: "#f2cf00", accent: "#202020", roof: "#464646", windows: "#20333c" },
  { id: "giruno", family: "giruno", body: "#e9e8e3", accent: "#d71920", roof: "#595e61", windows: "#1a3742" },
  { id: "comfortjet", family: "vectron", body: "#e8eef0", accent: "#1267a4", roof: "#50636c", windows: "#183744" },
  { id: "ice-s", family: "ice-s", body: "#f2f0e8", accent: "#80878b", roof: "#d7d7d0", windows: "#18343e" },
  { id: "br01", family: "steam", body: "#17191a", accent: "#b42025", roof: "#111213", windows: "#e9b75e" },
];

/* Complete consist recipes.  The first vehicle is authored by the family
 * branches below; the remaining vehicles are generated here as recognisable
 * coach/EMU modules rather than being faked by one runtime box template. */
const consistSpecs = {
  br650: { cars: 1, style: "regional" },
  br642: { cars: 2, style: "regional-emu", tailCab: true, pitch: 1.78 },
  br648: { cars: 2, style: "regional-emu", tailCab: true, pitch: 1.82 },
  "desiro-hc": { cars: 4, style: "desiro-hc", tailCab: true, pitch: 1.62 },
  metronom: { cars: 6, style: "double", tailCab: true, pitch: 1.55 },
  talent2: { cars: 4, style: "regional-emu", tailCab: true, pitch: 1.48 },
  flixtrain: { cars: 10, style: "intercity", pitch: 1.54 },
  ic1: { cars: 9, style: "intercity", pitch: 1.54 },
  ic2: { cars: 6, style: "double", tailCab: true, pitch: 1.56 },
  ice2: { cars: 8, style: "ice", tailCab: true, pitch: 1.5 },
  ice3: { cars: 8, style: "ice", tailCab: true, pitch: 1.46 },
  ice4: { cars: 12, style: "ice4", tailCab: true, pitch: 1.48 },
  railjet: { cars: 8, style: "railjet", tailCab: true, pitch: 1.56 },
  nightjet: { cars: 11, style: "nightjet", pitch: 1.56 },
  "tgv-duplex": { cars: 10, style: "tgv-double", tailCab: true, pitch: 1.48 },
  "regiojet-cz": { cars: 9, style: "regiojet", pitch: 1.55 },
  giruno: { cars: 11, style: "giruno", tailCab: true, pitch: 1.42 },
  comfortjet: { cars: 9, style: "comfortjet", tailCab: true, pitch: 1.56 },
  "ice-s": { cars: 3, style: "measurement", tailCab: true, pitch: 1.52 },
  br01: { cars: 6, style: "heritage", tender: true, pitch: 1.56 },
};

function hexToFactor(hex) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
    1,
  ];
}

function cubeGeometry(doc, buffer) {
  const positions = new Float32Array([
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5,
    -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
  ]);
  const normals = new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
  ]);
  return {
    positions: doc.createAccessor("cube_position").setType("VEC3").setArray(positions).setBuffer(buffer),
    normals: doc.createAccessor("cube_normal").setType("VEC3").setArray(normals).setBuffer(buffer),
    indices: doc.createAccessor("cube_indices").setType("SCALAR").setArray(indices).setBuffer(buffer),
  };
}

function cylinderGeometry(doc, buffer, segments = 16) {
  const positions = [];
  const normals = [];
  const indices = [];
  for (let side = 0; side <= segments; side += 1) {
    const angle = (side / segments) * Math.PI * 2;
    const x = Math.cos(angle) * 0.5;
    const z = Math.sin(angle) * 0.5;
    positions.push(x, -0.5, z, x, 0.5, z);
    normals.push(Math.cos(angle), 0, Math.sin(angle), Math.cos(angle), 0, Math.sin(angle));
  }
  for (let side = 0; side < segments; side += 1) {
    const a = side * 2;
    indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  return {
    positions: doc.createAccessor("cylinder_position").setType("VEC3").setArray(new Float32Array(positions)).setBuffer(buffer),
    normals: doc.createAccessor("cylinder_normal").setType("VEC3").setArray(new Float32Array(normals)).setBuffer(buffer),
    indices: doc.createAccessor("cylinder_indices").setType("SCALAR").setArray(new Uint16Array(indices)).setBuffer(buffer),
  };
}

function railcarGeometry(doc, buffer) {
  // A long rail-vehicle cross-section with a narrow underframe and chamfered
  // roof shoulders.  Flat face normals keep the low-poly style intentional.
  const crossSection = [
    [-0.5, -0.34],
    [-0.42, -0.48],
    [0.31, -0.48],
    [0.5, -0.36],
    [0.5, 0.36],
    [0.31, 0.48],
    [-0.42, 0.48],
    [-0.5, 0.34],
  ];
  const raw = [];
  const addTriangle = (a, b, c) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const magnitude = Math.hypot(...normal) || 1;
    raw.push({ vertices: [a, b, c], normal: normal.map((value) => value / magnitude) });
  };
  for (let index = 0; index < crossSection.length; index += 1) {
    const next = (index + 1) % crossSection.length;
    const [y1, z1] = crossSection[index];
    const [y2, z2] = crossSection[next];
    const a = [-0.5, y1, z1];
    const b = [0.5, y1, z1];
    const c = [0.5, y2, z2];
    const d = [-0.5, y2, z2];
    addTriangle(a, b, c);
    addTriangle(a, c, d);
  }
  for (const x of [-0.5, 0.5]) {
    for (let index = 0; index < crossSection.length; index += 1) {
      const center = [x, 0, 0];
      const a = [x, crossSection[index][0], crossSection[index][1]];
      const next = (index + 1) % crossSection.length;
      const b = [x, crossSection[next][0], crossSection[next][1]];
      if (x < 0) addTriangle(center, b, a);
      else addTriangle(center, a, b);
    }
  }
  const positions = [];
  const normals = [];
  for (const triangle of raw) {
    for (const vertex of triangle.vertices) {
      positions.push(...vertex);
      normals.push(...triangle.normal);
    }
  }
  const indices = new Uint16Array(positions.length / 3);
  for (let index = 0; index < indices.length; index += 1) indices[index] = index;
  return {
    positions: doc.createAccessor("railcar_position").setType("VEC3").setArray(new Float32Array(positions)).setBuffer(buffer),
    normals: doc.createAccessor("railcar_normal").setType("VEC3").setArray(new Float32Array(normals)).setBuffer(buffer),
    indices: doc.createAccessor("railcar_indices").setType("SCALAR").setArray(indices).setBuffer(buffer),
  };
}

function makePrimitive(doc, geometry, material) {
  return doc.createPrimitive().setAttribute("POSITION", geometry.positions).setAttribute("NORMAL", geometry.normals).setIndices(geometry.indices).setMaterial(material);
}

const qx = (angle) => [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)];
const qz = (angle) => [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)];

function makeAsset(asset) {
  const doc = new Document();
  const buffer = doc.createBuffer("corner_rails_buffer");
  const cube = cubeGeometry(doc, buffer);
  const cylinder = cylinderGeometry(doc, buffer);
  const railcar = railcarGeometry(doc, buffer);
  const materialDefs = {
    body: [asset.body, 0.12, 0.58],
    accent: [asset.accent, 0.08, 0.52],
    roof: [asset.roof, 0.26, 0.5],
    windows: [asset.windows, 0.42, 0.2],
    wheel: ["#151b1c", 0.72, 0.38],
    lamp: ["#ffe79b", 0.05, 0.3],
    redLamp: ["#d51e35", 0.05, 0.3],
    steamRod: ["#d7b86a", 0.42, 0.35],
    destination: ["#f3b53f", 0.05, 0.28],
    heritage: ["#6d3427", 0.08, 0.72],
    cream: ["#d8bb79", 0.03, 0.68],
    silver: ["#c8ced0", 0.32, 0.42],
    equipment: ["#586265", 0.48, 0.4],
  };
  const materials = Object.fromEntries(Object.entries(materialDefs).map(([name, [hex, metallic, roughness]]) => [
    name,
    doc.createMaterial(`${name}_material`).setBaseColorFactor(hexToFactor(hex)).setMetallicFactor(metallic).setRoughnessFactor(roughness),
  ]));
  const meshes = Object.fromEntries(Object.entries(materials).map(([name, material]) => [name, doc.createMesh(`${name}_cube`).addPrimitive(makePrimitive(doc, cube, material))]));
  const cylinders = Object.fromEntries(Object.entries(materials).map(([name, material]) => [name, doc.createMesh(`${name}_cylinder`).addPrimitive(makePrimitive(doc, cylinder, material))]));
  const railcars = Object.fromEntries(Object.entries(materials).map(([name, material]) => [name, doc.createMesh(`${name}_railcar`).addPrimitive(makePrimitive(doc, railcar, material))]));
  const root = doc.createNode(`${asset.id}_train_root`);
  doc.createScene(`Corner Rails ${asset.id}`).addChild(root);

  const addBox = (name, material, scale, translation, rotation) => {
    const node = doc.createNode(name).setMesh(meshes[material]).setScale(scale).setTranslation(translation);
    if (rotation) node.setRotation(rotation);
    root.addChild(node);
  };
  const addCylinder = (name, material, scale, translation, rotation) => {
    const node = doc.createNode(name).setMesh(cylinders[material]).setScale(scale).setTranslation(translation);
    if (rotation) node.setRotation(rotation);
    root.addChild(node);
  };
  const addRailcar = (name, material, scale, translation, rotation) => {
    const node = doc.createNode(name).setMesh(railcars[material]).setScale(scale).setTranslation(translation);
    if (rotation) node.setRotation(rotation);
    root.addChild(node);
  };
  const addWheelPair = (x, radius = 0.13, material = "wheel") => {
    [-0.34, 0.34].forEach((z, side) => addCylinder(`wheel_${x}_${side}`, material, [radius, 0.09, radius], [x, 0.12, z], qx(Math.PI / 2)));
  };
  const addLights = (x, y, spread = 0.22) => {
    [-spread, spread].forEach((z, side) => addBox(`headlight_${side}`, "lamp", [0.035, 0.07, 0.07], [x, y, z]));
  };
  const addSideWindows = (length, y, count, height = 0.18, offset = 0, material = "windows") => {
    const spacing = length / count;
    for (let index = 0; index < count; index += 1) {
      const x = offset - length / 2 + spacing * (index + 0.5);
      [-0.371, 0.371].forEach((z, side) => addBox(`window_${y}_${index}_${side}`, material, [spacing * 0.66, height, 0.025], [x, y, z]));
    }
  };
  const addBogieSet = (length, radius = 0.13) => {
    addBox("undercarriage", "wheel", [length * 0.76, 0.14, 0.58], [-0.05, 0.19, 0]);
    addWheelPair(-length * 0.25, radius);
    addWheelPair(length * 0.25, radius);
  };
  const addPantograph = (x, y, material = "accent") => {
    addBox(`pantograph_left_${x}`, material, [0.42, 0.035, 0.035], [x - 0.09, y, 0], qz(0.72));
    addBox(`pantograph_right_${x}`, material, [0.42, 0.035, 0.035], [x + 0.09, y, 0], qz(-0.72));
    addBox(`pantograph_head_${x}`, material, [0.42, 0.025, 0.18], [x, y + 0.14, 0]);
  };
  const addFrontMask = (x, y, height, width = 0.54, split = false) => {
    if (split) {
      addBox("front_glass_left", "windows", [0.035, height, width * 0.42], [x, y, -width * 0.25], qz(-0.08));
      addBox("front_glass_right", "windows", [0.035, height, width * 0.42], [x, y, width * 0.25], qz(-0.08));
    } else {
      addBox("front_glass", "windows", [0.04, height, width], [x, y, 0], qz(-0.08));
    }
  };

  const addCoachWheelPair = (prefix, x, radius = 0.12) => {
    [-0.35, 0.35].forEach((z, side) => addCylinder(`${prefix}_wheel_${side}`, "wheel", [radius, 0.075, radius], [x, 0.12, z], qx(Math.PI / 2)));
  };
  const addCoachBogie = (prefix, x, length = 1.42, shared = false) => {
    addBox(`${prefix}_underframe`, "equipment", [length * 0.74, 0.12, 0.57], [x, 0.2, 0]);
    addCoachWheelPair(`${prefix}_front_bogie`, x - length * (shared ? 0.37 : 0.3));
    addCoachWheelPair(`${prefix}_rear_bogie`, x + length * (shared ? 0.37 : 0.3));
    addBox(`${prefix}_equipment_box_a`, "equipment", [0.28, 0.18, 0.48], [x - 0.22, 0.29, 0]);
    addBox(`${prefix}_equipment_box_b`, "wheel", [0.2, 0.14, 0.5], [x + 0.25, 0.28, 0]);
  };
  const addCoachWindows = (prefix, x, y, count, length = 1.36, height = 0.17, material = "windows", gap = 0.07) => {
    const usable = length - gap * 2;
    const spacing = usable / count;
    for (let pane = 0; pane < count; pane += 1) {
      const paneX = x - usable / 2 + spacing * (pane + 0.5);
      [-0.376, 0.376].forEach((z, side) => addBox(`${prefix}_window_${pane}_${side}`, material, [spacing * 0.68, height, 0.023], [paneX, y, z]));
    }
  };
  const addCoachDoors = (prefix, x, positions, material = "accent", height = 0.46) => {
    positions.forEach((localX, door) => [-0.382, 0.382].forEach((z, side) => {
      addBox(`${prefix}_door_${door}_${side}`, material, [0.16, height, 0.025], [x + localX, 0.55, z]);
      addBox(`${prefix}_door_glass_${door}_${side}`, "windows", [0.1, 0.18, 0.027], [x + localX, 0.69, z]);
    }));
  };
  const addCoachPantograph = (prefix, x, y = 1.18) => {
    addBox(`${prefix}_panto_left`, "equipment", [0.38, 0.03, 0.03], [x - 0.08, y, 0], qz(0.7));
    addBox(`${prefix}_panto_right`, "equipment", [0.38, 0.03, 0.03], [x + 0.08, y, 0], qz(-0.7));
    addBox(`${prefix}_panto_head`, "equipment", [0.38, 0.025, 0.16], [x, y + 0.13, 0]);
  };
  const addTailCab = (prefix, x, style, tall = false) => {
    const streamlined = ["ice", "ice4", "tgv-double", "giruno", "measurement"].includes(style);
    const cabMaterial = style === "railjet" ? "body" : style === "comfortjet" ? "body" : "body";
    if (streamlined) {
      addBox(`${prefix}_tail_nose_upper`, cabMaterial, [0.42, tall ? 0.55 : 0.46, 0.62], [x - 0.72, tall ? 0.62 : 0.52, 0], qz(0.2));
      addBox(`${prefix}_tail_nose_tip`, cabMaterial, [0.24, 0.25, 0.48], [x - 0.98, 0.34, 0], qz(0.18));
      addBox(`${prefix}_tail_glass`, "windows", [0.22, tall ? 0.3 : 0.26, 0.55], [x - 0.86, tall ? 0.79 : 0.7, 0], qz(0.18));
      addLights(x - 1.12, 0.4);
    } else {
      addBox(`${prefix}_tail_cab_face`, cabMaterial, [0.28, tall ? 0.77 : 0.65, 0.69], [x - 0.68, tall ? 0.63 : 0.57, 0], qz(0.07));
      addBox(`${prefix}_tail_windscreen`, "windows", [0.08, tall ? 0.3 : 0.26, 0.55], [x - 0.84, tall ? 0.83 : 0.76, 0], qz(0.07));
      addLights(x - 0.9, 0.4);
    }
  };

  const addConsistCoach = (index, x, spec) => {
    const prefix = `${asset.id}_car_${index}`;
    const last = index === spec.cars - 1;
    const doubleDeck = spec.style === "double" || spec.style === "desiro-hc" || spec.style === "tgv-double";
    const streamlined = ["ice", "ice4", "giruno", "measurement"].includes(spec.style);
    const bodyHeight = doubleDeck ? 0.92 : spec.style === "ice4" ? 0.78 : 0.72;
    const bodyY = doubleDeck ? 0.66 : 0.58;
    const length = spec.style === "giruno" ? 1.3 : spec.style === "regional-emu" ? 1.58 : 1.4;

    if (spec.tender && index === 1) {
      addBox(`${prefix}_coal_tender`, "body", [1.02, 0.66, 0.68], [x, 0.52, 0]);
      addBox(`${prefix}_coal_load`, "wheel", [0.82, 0.12, 0.54], [x, 0.9, 0]);
      addBox(`${prefix}_red_frame`, "accent", [1.08, 0.11, 0.69], [x, 0.23, 0]);
      addCoachBogie(prefix, x, 0.92);
      return;
    }

    const coachMaterial = spec.style === "heritage" ? "heritage" : "body";
    addRailcar(`${prefix}_chamfered_train_shell`, coachMaterial, [length, bodyHeight, 0.72], [x, bodyY, 0]);
    addBox(`${prefix}_roof`, spec.style === "heritage" ? "roof" : "roof", [length * 0.96, 0.09, 0.62], [x, bodyY + bodyHeight / 2 + 0.08, 0]);
    addBox(`${prefix}_lower_skirt`, spec.style === "heritage" ? "accent" : "equipment", [length * 0.96, 0.1, 0.7], [x, 0.29, 0]);

    if (spec.style === "heritage") {
      addCoachWindows(prefix, x, 0.68, 6, length, 0.19, "cream");
      addBox(`${prefix}_cream_waistline`, "cream", [length * 0.94, 0.045, 0.74], [x, 0.49, 0]);
      addCoachDoors(prefix, x, [-length * 0.39, length * 0.39], "heritage", 0.5);
    } else if (doubleDeck) {
      addCoachWindows(`${prefix}_lower`, x, 0.5, 5, length, 0.15);
      addCoachWindows(`${prefix}_upper`, x, 0.82, 6, length, 0.16);
      addBox(`${prefix}_window_divider`, spec.style === "tgv-double" ? "accent" : "body", [length * 0.95, 0.055, 0.74], [x, 0.66, 0]);
      addCoachDoors(prefix, x, spec.style === "tgv-double" ? [0] : [-length * 0.38, length * 0.38], "accent", 0.62);
      if (spec.style === "tgv-double") addBox(`${prefix}_purple_end_caps`, "accent", [0.15, 0.7, 0.735], [x + (index % 2 ? -0.58 : 0.58), 0.64, 0]);
    } else if (spec.style === "nightjet") {
      const sleeper = index % 3 !== 0;
      addCoachWindows(prefix, x, 0.67, sleeper ? 5 : 7, length, sleeper ? 0.2 : 0.16, "windows", 0.1);
      addBox(`${prefix}_night_blue_wave`, "accent", [length * 0.96, 0.09, 0.735], [x, index % 2 ? 0.39 : 0.47, 0], qz(index % 2 ? 0.06 : -0.05));
      addCoachDoors(prefix, x, [-length * 0.4, length * 0.4], "accent", 0.5);
      if (index % 4 === 0) addBox(`${prefix}_accessible_low_door`, "silver", [0.22, 0.31, 0.75], [x + 0.37, 0.4, 0]);
    } else {
      const windowCount = spec.style === "giruno" ? 5 : spec.style === "regional-emu" ? 6 : 7;
      const windowY = streamlined ? 0.68 : 0.67;
      addCoachWindows(prefix, x, windowY, windowCount, length, streamlined ? 0.17 : 0.18);
      const stripeMaterial = spec.style === "regiojet" ? "windows" : "accent";
      const stripeY = spec.style === "railjet" ? 0.43 : spec.style === "comfortjet" ? 0.38 : spec.style === "ice" || spec.style === "ice4" || spec.style === "giruno" || spec.style === "measurement" ? 0.4 : 0.42;
      addBox(`${prefix}_identity_stripe`, stripeMaterial, [length * 0.97, spec.style === "railjet" ? 0.13 : 0.065, 0.735], [x, stripeY, 0]);
      const doorMaterial = spec.style === "ice" || spec.style === "ice4" ? "body" : "accent";
      addCoachDoors(prefix, x, spec.style === "giruno" ? [-length * 0.35, length * 0.35] : [-length * 0.4, length * 0.4], doorMaterial, 0.5);
      if (spec.style === "comfortjet") addBox(`${prefix}_blue_window_ribbon`, "accent", [length * 0.88, 0.035, 0.74], [x, 0.54, 0]);
      if (spec.style === "railjet") addBox(`${prefix}_ivory_roof_sweep`, "accent", [length * 0.5, 0.04, 0.74], [x - 0.25, 0.82, 0], qz(-0.08));
      if (spec.style === "measurement") {
        addBox(`${prefix}_measurement_band`, "silver", [length * 0.9, 0.12, 0.74], [x, 0.54, 0]);
        addCoachPantograph(`${prefix}_measurement`, x, 1.17);
        addBox(`${prefix}_sensor_rack`, "equipment", [0.48, 0.07, 0.34], [x + 0.28, 1.03, 0]);
      }
      if ((spec.style === "ice4" && index % 4 === 0) || (spec.style === "giruno" && index % 3 === 0)) addCoachPantograph(prefix, x, 1.15);
    }

    addBox(`${prefix}_front_bellows`, "wheel", [0.06, bodyHeight * 0.78, 0.66], [x + length / 2 + 0.015, bodyY, 0]);
    addBox(`${prefix}_rear_bellows`, "wheel", [0.06, bodyHeight * 0.78, 0.66], [x - length / 2 - 0.015, bodyY, 0]);
    addCoachBogie(prefix, x, length, spec.style === "tgv-double" || spec.style === "giruno");
    if (last && spec.tailCab) addTailCab(prefix, x, spec.style, doubleDeck);
  };

  const locomotive = ({ length = 1.3, height = 0.78, sloped = false, rounded = false, stripeY = 0.43, pantograph = true, splitGlass = false } = {}) => {
    addBox("body_shell", "body", [length, height, 0.72], [0, 0.57, 0]);
    addBox("roof", "roof", [length * 0.92, 0.1, 0.63], [-0.04, 1.01, 0]);
    addBox("livery_stripe", "accent", [length * 0.98, 0.075, 0.74], [-0.02, stripeY, 0]);
    if (sloped || rounded) {
      addBox("cab_nose_lower", "body", [0.3, 0.43, rounded ? 0.58 : 0.65], [length / 2 + 0.13, 0.47, 0], qz(-0.17));
      addBox("cab_nose_tip", "body", [0.2, 0.23, rounded ? 0.44 : 0.56], [length / 2 + 0.32, 0.31, 0], qz(-0.2));
    }
    addFrontMask(length / 2 + (sloped || rounded ? 0.19 : 0.025), 0.72, 0.28, rounded ? 0.46 : 0.56, splitGlass);
    addSideWindows(length * 0.5, 0.72, 2, 0.2, -length * 0.18);
    addBogieSet(length);
    addLights(length / 2 + (sloped || rounded ? 0.36 : 0.04), 0.42);
    if (pantograph) addPantograph(-0.18, 1.22, "wheel");
  };

  if (asset.family === "steam") {
    addCylinder("boiler", "body", [0.36, 1.0, 0.36], [0.18, 0.67, 0], qz(-Math.PI / 2));
    addCylinder("smokebox_front", "body", [0.4, 0.18, 0.4], [0.72, 0.67, 0], qz(-Math.PI / 2));
    addBox("cab", "body", [0.55, 0.8, 0.7], [-0.62, 0.66, 0]);
    addBox("cab_roof", "roof", [0.66, 0.1, 0.82], [-0.62, 1.1, 0]);
    [-0.355, 0.355].forEach((z, side) => addBox(`cab_window_${side}`, "windows", [0.2, 0.26, 0.025], [-0.53, 0.82, z]));
    addCylinder("chimney", "body", [0.13, 0.52, 0.13], [0.5, 1.15, 0]);
    addCylinder("chimney_cap", "body", [0.2, 0.08, 0.2], [0.5, 1.43, 0]);
    addBox("smoke_deflector_left", "body", [0.38, 0.62, 0.04], [0.47, 0.93, -0.42], qz(-0.08));
    addBox("smoke_deflector_right", "body", [0.38, 0.62, 0.04], [0.47, 0.93, 0.42], qz(-0.08));
    addBox("red_chassis", "accent", [1.72, 0.13, 0.62], [-0.05, 0.24, 0]);
    [-0.62, -0.16, 0.31].forEach((x, index) => {
      [-0.37, 0.37].forEach((z, side) => addCylinder(`driver_${index}_${side}`, "accent", [0.25, 0.08, 0.25], [x, 0.18, z], qx(Math.PI / 2)));
    });
    addWheelPair(0.68, 0.13, "accent");
    [-0.37, 0.37].forEach((z, side) => addBox(`connecting_rod_${side}`, "steamRod", [1.12, 0.04, 0.025], [-0.16, 0.18, z]));
    addLights(0.9, 0.55, 0);
  } else if (asset.family === "rs1") {
    addRailcar("single_car_chamfered_shell", "body", [1.7, 0.74, 0.72], [-0.06, 0.56, 0]);
    addBox("sloped_front", "body", [0.3, 0.58, 0.62], [0.92, 0.53, 0], qz(-0.13));
    addBox("red_lower_band", "accent", [1.78, 0.22, 0.7], [-0.02, 0.3, 0]);
    addFrontMask(1.08, 0.72, 0.29, 0.48, true);
    addBox("destination_display", "destination", [0.035, 0.07, 0.23], [1.1, 0.91, 0]);
    addSideWindows(1.2, 0.72, 5, 0.22, -0.16);
    // RS1 visual signature: diagonal white/red lattice around the side windows.
    [-0.63, -0.32, -0.01, 0.3, 0.61].forEach((x, index) => {
      [-0.385, 0.385].forEach((z, side) => addBox(`rs1_diagonal_${index}_${side}`, "body", [0.3, 0.045, 0.025], [x, 0.72, z], qz(index % 2 ? -0.7 : 0.7)));
    });
    [-0.385, 0.385].forEach((z, side) => addBox(`rs1_red_door_${side}`, "accent", [0.19, 0.48, 0.025], [0.55, 0.54, z]));
    addBox("roof_exhaust", "roof", [0.38, 0.08, 0.34], [-0.2, 1.0, 0]);
    addBogieSet(1.56, 0.12);
    addLights(1.15, 0.42);
  } else if (asset.family === "desiro") {
    addRailcar("desiro_red_chamfered_shell", "accent", [1.72, 0.75, 0.72], [-0.08, 0.56, 0]);
    addBox("silver_window_ribbon", "body", [1.36, 0.32, 0.72], [-0.18, 0.7, 0]);
    addBox("desiro_rounded_nose_lower", "accent", [0.42, 0.46, 0.58], [0.88, 0.44, 0], qz(-0.2));
    addBox("desiro_wraparound_mask", "windows", [0.3, 0.39, 0.64], [0.93, 0.72, 0], qz(-0.18));
    addBox("desiro_white_chin", "body", [0.3, 0.13, 0.55], [1.05, 0.29, 0], qz(-0.12));
    addBox("destination_display", "destination", [0.035, 0.06, 0.22], [1.09, 0.91, 0]);
    addSideWindows(1.05, 0.72, 5, 0.19, -0.24);
    [-0.385, 0.385].forEach((z, side) => addBox(`desiro_door_${side}`, "accent", [0.18, 0.48, 0.025], [0.45, 0.54, z]));
    addBox("articulation_bellows", "wheel", [0.09, 0.69, 0.7], [-0.9, 0.57, 0]);
    addBox("roof_hvac", "roof", [0.5, 0.08, 0.42], [-0.28, 1.02, 0]);
    addBogieSet(1.58, 0.12);
    addLights(1.11, 0.4);
  } else if (asset.family === "lint") {
    addRailcar("lint_red_chamfered_shell", "accent", [1.78, 0.76, 0.72], [-0.08, 0.56, 0]);
    addBox("lint_silver_window_ribbon", "body", [1.42, 0.3, 0.72], [-0.2, 0.71, 0]);
    addBox("lint_flat_cab_face", "accent", [0.25, 0.58, 0.65], [0.91, 0.55, 0], qz(-0.07));
    addBox("lint_broad_black_windscreen", "windows", [0.13, 0.34, 0.57], [1.05, 0.74, 0], qz(-0.07));
    addBox("lint_grey_lower_apron", "roof", [0.28, 0.16, 0.58], [1.05, 0.31, 0], qz(-0.05));
    addBox("destination_display", "destination", [0.035, 0.065, 0.25], [1.12, 0.91, 0]);
    addSideWindows(1.08, 0.72, 4, 0.2, -0.28);
    [-0.385, 0.385].forEach((z, side) => {
      addBox(`lint_front_door_${side}`, "accent", [0.17, 0.5, 0.025], [0.48, 0.54, z]);
      addBox(`lint_rear_door_${side}`, "accent", [0.17, 0.5, 0.025], [-0.58, 0.54, z]);
    });
    addBox("lint_roof_hvac", "roof", [0.62, 0.1, 0.46], [-0.22, 1.03, 0]);
    addBogieSet(1.64, 0.12);
    addLights(1.13, 0.4);
  } else if (asset.family === "desiro-hc") {
    addBox("high_capacity_end_car", "body", [1.45, 0.89, 0.74], [-0.05, 0.63, 0]);
    addBox("desiro_hc_red_nose", "accent", [0.33, 0.68, 0.64], [0.76, 0.58, 0], qz(-0.12));
    addFrontMask(0.92, 0.81, 0.34, 0.54);
    addBox("red_belt", "accent", [1.46, 0.16, 0.75], [-0.04, 0.36, 0]);
    addSideWindows(0.92, 0.82, 4, 0.2, -0.14);
    addBox("roof", "roof", [1.24, 0.1, 0.63], [-0.13, 1.13, 0]);
    addBogieSet(1.3, 0.13);
    addPantograph(-0.25, 1.34, "wheel");
    addLights(0.96, 0.47);
  } else if (asset.family === "talent2") {
    addBox("talent_body", "body", [1.34, 0.75, 0.74], [-0.08, 0.58, 0]);
    addBox("hamster_cheek_nose", "accent", [0.38, 0.55, 0.76], [0.68, 0.51, 0], qz(-0.17));
    addBox("bulbous_black_mask", "windows", [0.2, 0.38, 0.62], [0.88, 0.75, 0], qz(-0.17));
    addBox("white_chin", "body", [0.22, 0.2, 0.58], [0.9, 0.35, 0], qz(-0.12));
    addSideWindows(0.82, 0.75, 4, 0.2, -0.16);
    addBox("roof", "roof", [1.12, 0.1, 0.64], [-0.15, 1.04, 0]);
    addBogieSet(1.26, 0.12);
    addLights(0.98, 0.43);
  } else if (asset.family === "ice2") {
    locomotive({ length: 1.42, height: 0.75, sloped: true, stripeY: 0.43, splitGlass: true });
    addBox("ice2_cab_seam", "roof", [0.03, 0.34, 0.6], [0.92, 0.68, 0]);
  } else if (asset.family === "ice3") {
    locomotive({ length: 1.5, height: 0.72, rounded: true, stripeY: 0.4 });
    addBox("ice3_continuous_mask", "windows", [0.34, 0.27, 0.65], [0.89, 0.68, 0], qz(-0.18));
  } else if (asset.family === "ice4") {
    locomotive({ length: 1.52, height: 0.78, sloped: true, stripeY: 0.39 });
    addBox("ice4_square_windscreen", "windows", [0.22, 0.31, 0.58], [0.94, 0.72, 0], qz(-0.14));
    addBox("ice4_black_side_mask", "windows", [0.48, 0.19, 0.735], [0.48, 0.77, 0]);
  } else if (asset.family === "tgv") {
    addBox("tgv_power_car", "body", [1.42, 0.68, 0.72], [-0.11, 0.55, 0]);
    addBox("tgv_low_wedge", "body", [0.48, 0.33, 0.57], [0.74, 0.34, 0], qz(-0.18));
    addBox("tgv_dark_cab", "windows", [0.3, 0.24, 0.58], [0.73, 0.66, 0], qz(-0.2));
    addBox("purple_nose_flash", "accent", [0.36, 0.12, 0.62], [0.85, 0.28, 0], qz(-0.14));
    addSideWindows(0.5, 0.72, 2, 0.16, -0.31);
    addBox("roof", "roof", [1.08, 0.1, 0.62], [-0.2, 0.94, 0]);
    addBogieSet(1.28, 0.13);
    addPantograph(-0.28, 1.15, "wheel");
    addLights(1.01, 0.39);
  } else if (asset.family === "giruno") {
    addBox("giruno_low_floor_body", "body", [1.48, 0.78, 0.73], [-0.09, 0.57, 0]);
    addBox("giruno_sharp_nose", "body", [0.48, 0.47, 0.58], [0.76, 0.45, 0], qz(-0.2));
    addBox("giruno_black_mask", "windows", [0.38, 0.29, 0.62], [0.72, 0.71, 0], qz(-0.18));
    addBox("giruno_red_chin", "accent", [0.34, 0.18, 0.58], [0.93, 0.31, 0], qz(-0.14));
    addBox("giruno_red_belt", "accent", [1.08, 0.07, 0.74], [-0.2, 0.39, 0]);
    addSideWindows(0.82, 0.72, 4, 0.19, -0.24);
    addBox("roof", "roof", [1.22, 0.08, 0.63], [-0.17, 1.0, 0]);
    addBogieSet(1.34, 0.12);
    addPantograph(-0.3, 1.22, "wheel");
    addLights(1.02, 0.4);
  } else if (asset.family === "ice-s") {
    locomotive({ length: 1.4, height: 0.74, sloped: true, stripeY: 0.41, splitGlass: true });
    addBox("measurement_grey_band", "accent", [1.38, 0.1, 0.75], [-0.02, 0.41, 0]);
    addPantograph(-0.13, 1.34, "accent");
    addBox("roof_sensor_rack", "windows", [0.28, 0.07, 0.3], [-0.42, 1.13, 0]);
  } else if (asset.family === "br101") {
    locomotive({ length: 1.32, height: 0.8, sloped: true, stripeY: 0.35, pantograph: true, splitGlass: true });
    addBox("br101_red_face", "accent", [0.28, 0.56, 0.68], [0.73, 0.54, 0], qz(-0.11));
    addFrontMask(0.87, 0.77, 0.28, 0.54, true);
  } else if (asset.family === "br147") {
    locomotive({ length: 1.3, height: 0.82, sloped: false, stripeY: 0.35, pantograph: true, splitGlass: true });
    addBox("br147_red_cab", "accent", [0.3, 0.65, 0.7], [0.65, 0.56, 0]);
    addFrontMask(0.81, 0.79, 0.29, 0.54, true);
  } else if (asset.family === "traxx") {
    locomotive({ length: 1.3, height: 0.82, sloped: false, stripeY: 0.3, pantograph: true, splitGlass: true });
    addBox("metronom_yellow_front", "accent", [0.31, 0.55, 0.69], [0.66, 0.5, 0]);
    addFrontMask(0.82, 0.78, 0.26, 0.54, true);
  } else if (asset.family === "taurus") {
    locomotive({ length: 1.34, height: 0.79, sloped: true, stripeY: 0.38, pantograph: true, splitGlass: true });
    addBox("taurus_red_cab", "body", [0.36, 0.58, 0.69], [0.7, 0.52, 0], qz(-0.09));
    addBox("railjet_light_sweep", "accent", [0.5, 0.08, 0.72], [0.28, 0.44, 0], qz(-0.11));
    addFrontMask(0.9, 0.76, 0.27, 0.54, true);
  } else {
    // Vectron family: FlixTrain, Nightjet, Czech RegioJet, and ComfortJet.
    locomotive({ length: 1.34, height: 0.82, sloped: true, stripeY: 0.37, pantograph: true, splitGlass: true });
    addBox("vectron_dark_brow", "windows", [0.34, 0.31, 0.62], [0.78, 0.76, 0], qz(-0.12));
    addBox("vectron_livery_face", "accent", [0.3, 0.23, 0.64], [0.88, 0.45, 0], qz(-0.12));
  }

  const consist = consistSpecs[asset.id];
  for (let index = 1; index < consist.cars; index += 1) {
    addConsistCoach(index, -(consist.pitch ?? 1.52) * index, consist);
  }

  return doc;
}

const outputDirectory = path.resolve("public/models/trains");
await mkdir(outputDirectory, { recursive: true });
const io = new NodeIO();
for (const asset of assets) {
  const doc = makeAsset(asset);
  await doc.transform(dedup(), prune());
  await io.write(path.join(outputDirectory, `${asset.id}.glb`), doc);
}

console.log(`Generated ${assets.length} complete, train-specific low-poly GLB consists in ${outputDirectory}`);
