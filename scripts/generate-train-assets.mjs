import { Document, NodeIO } from "@gltf-transform/core";
import { dedup, prune } from "@gltf-transform/functions";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const assets = [
  ["br650", "dmu", "#d9dde0", "#d71920", "#8c969b", "#193847"],
  ["br642", "dmu", "#e2e4e5", "#c8102e", "#858b8e", "#183745"],
  ["br648", "dmu", "#e7e8e8", "#df1027", "#7f898e", "#153744"],
  ["desiro-hc", "regional", "#f1f1ed", "#cc132c", "#67747b", "#133946"],
  ["metronom", "double", "#f4f1df", "#f3c400", "#174f7d", "#183d59"],
  ["talent2", "regional", "#e7e8e8", "#d6122b", "#899197", "#153744"],
  ["flixtrain", "intercity", "#76bf43", "#153d2c", "#333b38", "#152f37"],
  ["ic1", "intercity", "#eeeeea", "#cf1530", "#85898a", "#1a3039"],
  ["ic2", "double", "#f2f1eb", "#c9152d", "#797f81", "#203844"],
  ["ice2", "ice", "#f4f2e9", "#d1152e", "#d8d8d2", "#20343d"],
  ["ice3", "ice", "#f7f4ea", "#d3162f", "#dfdfda", "#1b313a"],
  ["ice4", "ice", "#f5f3e9", "#cd142d", "#e0e0da", "#182f39"],
  ["railjet", "international", "#a20d2e", "#e7e0d2", "#3b3437", "#172e37"],
  ["nightjet", "night", "#10244f", "#38a8dd", "#101a31", "#f4d26c"],
  ["tgv-duplex", "double", "#e6e5df", "#6c3a8f", "#777b80", "#243642"],
  ["regiojet-cz", "international", "#f2cf00", "#202020", "#464646", "#20333c"],
  ["giruno", "international", "#e9e8e3", "#d71920", "#595e61", "#1a3742"],
  ["comfortjet", "international", "#e8eef0", "#1267a4", "#50636c", "#183744"],
  ["ice-s", "measurement", "#f2f0e8", "#80878b", "#d7d7d0", "#18343e"],
  ["br01", "steam", "#17191a", "#b42025", "#111213", "#e9b75e"],
];

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

function makePrimitive(doc, geometry, material) {
  return doc
    .createPrimitive()
    .setAttribute("POSITION", geometry.positions)
    .setAttribute("NORMAL", geometry.normals)
    .setIndices(geometry.indices)
    .setMaterial(material);
}

function makeAsset([, style, bodyHex, accentHex, roofHex, windowsHex]) {
  const doc = new Document();
  const buffer = doc.createBuffer("corner_rails_buffer");
  const cube = cubeGeometry(doc, buffer);
  const cylinder = cylinderGeometry(doc, buffer);
  const bodyMaterial = doc.createMaterial("body_material").setBaseColorFactor(hexToFactor(bodyHex)).setMetallicFactor(0.15).setRoughnessFactor(0.62);
  const accentMaterial = doc.createMaterial("accent_material").setBaseColorFactor(hexToFactor(accentHex)).setMetallicFactor(0.1).setRoughnessFactor(0.55);
  const roofMaterial = doc.createMaterial("roof_material").setBaseColorFactor(hexToFactor(roofHex)).setMetallicFactor(0.3).setRoughnessFactor(0.52);
  const windowMaterial = doc.createMaterial("window_material").setBaseColorFactor(hexToFactor(windowsHex)).setMetallicFactor(0.45).setRoughnessFactor(0.22);
  const wheelMaterial = doc.createMaterial("wheel_material").setBaseColorFactor([0.055, 0.065, 0.07, 1]).setMetallicFactor(0.8).setRoughnessFactor(0.42);
  const materials = { body: bodyMaterial, accent: accentMaterial, roof: roofMaterial, windows: windowMaterial, wheel: wheelMaterial };
  const meshes = Object.fromEntries(
    Object.entries(materials).map(([name, material]) => [name, doc.createMesh(`${name}_cube`).addPrimitive(makePrimitive(doc, cube, material))]),
  );
  const cylinderMeshes = Object.fromEntries(
    Object.entries(materials).map(([name, material]) => [name, doc.createMesh(`${name}_cylinder`).addPrimitive(makePrimitive(doc, cylinder, material))]),
  );
  const root = doc.createNode("train_root");
  doc.createScene("Corner Rails train").addChild(root);
  const addBox = (name, material, scale, translation, rotation) => {
    const node = doc.createNode(name).setMesh(meshes[material]).setScale(scale).setTranslation(translation);
    if (rotation) node.setRotation(rotation);
    root.addChild(node);
  };
  const addCylinder = (name, material, scale, translation, rotation) => {
    const node = doc.createNode(name).setMesh(cylinderMeshes[material]).setScale(scale).setTranslation(translation);
    if (rotation) node.setRotation(rotation);
    root.addChild(node);
  };

  if (style === "steam") {
    addCylinder("boiler", "body", [0.55, 1.45, 0.55], [0.25, 0.62, 0], [0, 0, -0.7071, 0.7071]);
    addBox("cab", "body", [0.72, 0.92, 0.88], [-0.92, 0.62, 0]);
    addBox("cab_windows", "windows", [0.18, 0.34, 0.9], [-0.72, 0.74, 0]);
    addCylinder("smokestack", "body", [0.23, 0.72, 0.23], [0.92, 1.15, 0]);
    addBox("red_chassis", "accent", [2.65, 0.16, 0.72], [0, 0.2, 0]);
    [-0.95, -0.25, 0.45, 1.02].forEach((x, index) => addCylinder(`wheel_${index}`, "wheel", [0.38, 0.14, 0.38], [x, 0.1, 0.44], [0.7071, 0, 0, 0.7071]));
  } else {
    const tall = style === "double" ? 1.12 : style === "night" ? 0.95 : 0.78;
    const long = style === "ice" || style === "measurement" ? 2.85 : style === "intercity" || style === "international" ? 2.45 : 2.2;
    addBox("body_shell", "body", [long, tall, 0.88], [0, 0.62, 0]);
    addBox("window_band", "windows", [long * 0.82, tall * 0.25, 0.9], [-0.03, 0.74, 0]);
    addBox("livery_stripe", "accent", [long * 0.96, 0.08, 0.91], [-0.03, 0.42, 0]);
    addBox("roof", "roof", [long * 0.9, 0.12, 0.78], [-0.05, 0.62 + tall / 2 + 0.08, 0]);
    addBox("undercarriage", "wheel", [long * 0.78, 0.18, 0.66], [-0.05, 0.14, 0]);
    addBox("front_nose", "body", [style === "ice" || style === "measurement" ? 0.74 : 0.34, tall * 0.72, 0.75], [long / 2 + 0.18, 0.57, 0], style === "ice" || style === "measurement" ? [0, 0, -0.11, 0.994] : undefined);
    addBox("front_glass", "windows", [0.2, tall * 0.34, 0.77], [long / 2 + 0.5, 0.71, 0]);
    [-long * 0.27, long * 0.27].forEach((x, index) => {
      addCylinder(`bogie_front_${index}`, "wheel", [0.18, 0.1, 0.18], [x, 0.08, 0.38], [0.7071, 0, 0, 0.7071]);
      addCylinder(`bogie_back_${index}`, "wheel", [0.18, 0.1, 0.18], [x, 0.08, -0.38], [0.7071, 0, 0, 0.7071]);
    });
    if (style === "measurement") {
      addBox("measurement_pantograph", "accent", [0.5, 0.06, 0.28], [-0.3, 1.18, 0], [0, 0, 0.35, 0.937]);
    }
  }
  return doc;
}

const outputDirectory = path.resolve("public/models/trains");
await mkdir(outputDirectory, { recursive: true });
const io = new NodeIO();
for (const asset of assets) {
  const doc = makeAsset(asset);
  await doc.transform(dedup(), prune());
  await io.write(path.join(outputDirectory, `${asset[0]}.glb`), doc);
}

console.log(`Generated ${assets.length} optimized GLB train bodies in ${outputDirectory}`);
