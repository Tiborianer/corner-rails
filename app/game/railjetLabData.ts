export type RailjetGeneration = "classic" | "nextgen";
export type RailjetRenderMethod = "generated-2d" | "vector-2d" | "hybrid-3d" | "blender-3d";
export type RailjetMotionMode = "stationary" | "stopping" | "pass";
export type RailjetAtmosphere = "day" | "night" | "rain";

export type RailjetVehicleRole =
  | "locomotive"
  | "economy"
  | "restaurant"
  | "first"
  | "multifunction"
  | "driving-trailer";

export interface RailjetVehicleDefinition {
  id: string;
  role: RailjetVehicleRole;
  lengthMeters: number;
  generatedFrame: 1 | 2 | 3 | 4 | 5;
  vectorAsset: string;
}

export interface RailjetPrototypeDefinition {
  id: RailjetGeneration;
  label: string;
  shortLabel: string;
  serviceYear: number;
  lengthMeters: number;
  vehicleCount: number;
  consist: RailjetVehicleDefinition[];
  generatedBase: string;
  hybridAsset: string;
  blenderAsset: string;
  worldScale: number;
  pivot: readonly [number, number, number];
  groundOffset: number;
  source: string;
}

export const RAILJET_METRIC_PROFILE = {
  metersToWorld: 0.071,
  standardGaugeMeters: 1.435,
  railTopY: 0.295,
  platformLengthMeters: 280,
  platformWidthMeters: 5,
  platformHeightMeters: 0.55,
  platformEdgeClearanceMeters: 0.2,
  vehicleWidthMeters: 2.825,
  catenaryContactHeightMeters: 5.5,
  trackCenterSpacingMeters: 5,
  sleeperLengthMeters: 2.58,
  maxFormationLengthMeters: 258,
} as const;

export function railjetMetersToWorld(meters: number) {
  return meters * RAILJET_METRIC_PROFILE.metersToWorld;
}

const vectorPath = (generation: RailjetGeneration, role: RailjetVehicleRole) =>
  `/railjet-lab/vector/${generation}-${role}.svg`;

const classicVehicles: RailjetVehicleDefinition[] = [
  { id: "classic-locomotive", role: "locomotive", lengthMeters: 19.3, generatedFrame: 1, vectorAsset: vectorPath("classic", "locomotive") },
  { id: "classic-economy-1", role: "economy", lengthMeters: 26.4, generatedFrame: 2, vectorAsset: vectorPath("classic", "economy") },
  { id: "classic-economy-2", role: "economy", lengthMeters: 26.4, generatedFrame: 2, vectorAsset: vectorPath("classic", "economy") },
  { id: "classic-economy-3", role: "economy", lengthMeters: 26.4, generatedFrame: 2, vectorAsset: vectorPath("classic", "economy") },
  { id: "classic-economy-4", role: "economy", lengthMeters: 26.4, generatedFrame: 2, vectorAsset: vectorPath("classic", "economy") },
  { id: "classic-restaurant", role: "restaurant", lengthMeters: 26.4, generatedFrame: 3, vectorAsset: vectorPath("classic", "restaurant") },
  { id: "classic-first", role: "first", lengthMeters: 26.4, generatedFrame: 4, vectorAsset: vectorPath("classic", "first") },
  { id: "classic-driving-trailer", role: "driving-trailer", lengthMeters: 26.4, generatedFrame: 5, vectorAsset: vectorPath("classic", "driving-trailer") },
];

const nextgenVehicles: RailjetVehicleDefinition[] = [
  { id: "nextgen-locomotive", role: "locomotive", lengthMeters: 19.3, generatedFrame: 1, vectorAsset: vectorPath("nextgen", "locomotive") },
  { id: "nextgen-first-1", role: "first", lengthMeters: 26.5, generatedFrame: 4, vectorAsset: vectorPath("nextgen", "first") },
  { id: "nextgen-first-2", role: "first", lengthMeters: 26.5, generatedFrame: 4, vectorAsset: vectorPath("nextgen", "first") },
  { id: "nextgen-restaurant", role: "restaurant", lengthMeters: 26.5, generatedFrame: 4, vectorAsset: vectorPath("nextgen", "restaurant") },
  { id: "nextgen-economy-1", role: "economy", lengthMeters: 26.5, generatedFrame: 2, vectorAsset: vectorPath("nextgen", "economy") },
  { id: "nextgen-economy-2", role: "economy", lengthMeters: 26.5, generatedFrame: 2, vectorAsset: vectorPath("nextgen", "economy") },
  { id: "nextgen-economy-3", role: "economy", lengthMeters: 26.5, generatedFrame: 2, vectorAsset: vectorPath("nextgen", "economy") },
  { id: "nextgen-economy-4", role: "economy", lengthMeters: 26.5, generatedFrame: 2, vectorAsset: vectorPath("nextgen", "economy") },
  { id: "nextgen-multifunction", role: "multifunction", lengthMeters: 26.5, generatedFrame: 3, vectorAsset: vectorPath("nextgen", "multifunction") },
  { id: "nextgen-driving-trailer", role: "driving-trailer", lengthMeters: 26.5, generatedFrame: 5, vectorAsset: vectorPath("nextgen", "driving-trailer") },
];

export const RAILJET_PROTOTYPES: Record<RailjetGeneration, RailjetPrototypeDefinition> = {
  classic: {
    id: "classic",
    label: "Classic Railjet + Taurus",
    shortLabel: "Classic",
    serviceYear: 2008,
    lengthMeters: 205.38,
    vehicleCount: 8,
    consist: classicVehicles,
    generatedBase: "/railjet-lab/generated/classic",
    hybridAsset: "/models/railjet-lab/railjet-classic-hybrid.glb",
    blenderAsset: "/models/railjet-lab/blender/railjet-classic-blender.glb",
    worldScale: 0.071,
    pivot: [0, 0, 0],
    groundOffset: 0.14,
    source: "https://static.web.oebb.at/konzern/oebb-flotte-2025/4/",
  },
  nextgen: {
    id: "nextgen",
    label: "Railjet New Generation",
    shortLabel: "New generation",
    serviceYear: 2024,
    lengthMeters: 258,
    vehicleCount: 10,
    consist: nextgenVehicles,
    generatedBase: "/railjet-lab/generated/nextgen",
    hybridAsset: "/models/railjet-lab/railjet-nextgen-hybrid.glb",
    blenderAsset: "/models/railjet-lab/blender/railjet-nextgen-blender.glb",
    worldScale: 0.061,
    pivot: [0, 0, 0],
    groundOffset: 0.14,
    source: "https://press.siemens.com/global/en/pressrelease/obb-puts-first-new-generation-railjet-siemens-mobility-service-and-orders-19-more",
  },
};

export const RAILJET_METHODS: Array<{ id: RailjetRenderMethod; blindLabel: "A" | "B" | "C" | "D"; label: string; description: string }> = [
  { id: "generated-2d", blindLabel: "A", label: "Generated 2.5D", description: "Original rendered modules on transparent world cards." },
  { id: "vector-2d", blindLabel: "B", label: "Vector 2.5D", description: "Deterministic isometric SVG modules with exact consist assembly." },
  { id: "hybrid-3d", blindLabel: "C", label: "Procedural 3D", description: "Lofted GLB bodies with geometric livery and roof equipment." },
  { id: "blender-3d", blindLabel: "D", label: "Blender 3D", description: "Measured Blender-authored cars with distinct cabs, bogies, doors, windows, underframes, and roof equipment." },
];

export function generatedVehicleAsset(definition: RailjetPrototypeDefinition, frame: number) {
  return `${definition.generatedBase}/${String(frame).padStart(2, "0")}.webp`;
}

export function railjetFormationPitch(definition: RailjetPrototypeDefinition, vehicle: RailjetVehicleDefinition) {
  return (vehicle.lengthMeters / definition.lengthMeters) * (definition.id === "classic" ? 14.2 : 15.7);
}

export function railjetLabMotionPosition(mode: RailjetMotionMode, elapsedSeconds: number) {
  if (mode === "stationary") return 0;
  if (mode === "pass") {
    const progress = (elapsedSeconds % 12) / 12;
    const eased = progress * progress * (3 - 2 * progress);
    return -27 + eased * 54;
  }
  const cycle = elapsedSeconds % 18;
  if (cycle < 5) {
    const progress = cycle / 5;
    return -27 + 27 * (1 - Math.pow(1 - progress, 3));
  }
  if (cycle < 11) return 0;
  const progress = (cycle - 11) / 7;
  return 27 * progress * progress;
}
