import type { TrainDefinition } from "./types";
import { RAILWAY_METRIC_PROFILE } from "./metricRailway";

export type TrainVisualProfileId = "legacy-v1" | "metric-v1";

export interface TrainVisualVariant {
  id: string;
  assetPath: string;
  profile: TrainVisualProfileId;
  scale: readonly [number, number, number];
  rotation: readonly [number, number, number];
  contactOffsetY: number;
  lengthMeters?: number;
  minimumLengthLevel: number;
  selectionWeight: number;
  revision: string;
  /** Push-pull formations can run with their driving trailer at the front while
   * continuing along the same gameplay path. */
  cabCarLeadingChance?: number;
  headlights?: {
    frontInsetMeters: number;
    heightMeters: number;
    beamLengthMeters: number;
    color: string;
  };
}

const LEGACY_ASSET_VERSION = "5";
export const CAB_CAR_LEADING_CHANCE = 0.25;
export const METRONOM_VISUAL_VARIANTS = ["curved", "flat"].map((livery): TrainVisualVariant => ({
  id: `metronom-${livery}`,
  assetPath: `models/trains/blender/metronom/metronom-${livery}.glb`,
  profile: "metric-v1",
  scale: [RAILWAY_METRIC_PROFILE.metersToWorld, RAILWAY_METRIC_PROFILE.metersToWorld, RAILWAY_METRIC_PROFILE.metersToWorld],
  rotation: [0, 0, 0],
  contactOffsetY: RAILWAY_METRIC_PROFILE.railTopY,
  lengthMeters: 100.2,
  minimumLengthLevel: 3,
  selectionWeight: 1,
  revision: "metronom-two-liveries-m2",
  cabCarLeadingChance: CAB_CAR_LEADING_CHANCE,
  headlights: { frontInsetMeters: .50, heightMeters: 1.55, beamLengthMeters: 30, color: "#fff1c4" },
}));
const LEGACY_PUSH_PULL_MODEL_KEYS = new Set(["metronom", "ic2", "ice2", "comfortjet"]);

export const RAILJET_VISUAL_VARIANTS = [
  {
    id: "railjet-classic",
    assetPath: "models/trains/blender/railjet/railjet-classic-blender.glb",
    profile: "metric-v1",
    scale: [
      RAILWAY_METRIC_PROFILE.metersToWorld,
      RAILWAY_METRIC_PROFILE.metersToWorld,
      RAILWAY_METRIC_PROFILE.metersToWorld,
    ],
    rotation: [0, 0, 0],
    contactOffsetY: RAILWAY_METRIC_PROFILE.railTopY,
    lengthMeters: 205.38,
    minimumLengthLevel: 4,
    selectionWeight: 1,
    revision: "blender-livery-v2-1-production-2026-09-06",
    cabCarLeadingChance: CAB_CAR_LEADING_CHANCE,
  },
  {
    id: "railjet-nextgen",
    assetPath: "models/trains/blender/railjet/railjet-nextgen-blender.glb",
    profile: "metric-v1",
    scale: [
      RAILWAY_METRIC_PROFILE.metersToWorld,
      RAILWAY_METRIC_PROFILE.metersToWorld,
      RAILWAY_METRIC_PROFILE.metersToWorld,
    ],
    rotation: [0, 0, 0],
    contactOffsetY: RAILWAY_METRIC_PROFILE.railTopY,
    lengthMeters: 258,
    minimumLengthLevel: 5,
    selectionWeight: 1,
    revision: "blender-livery-v2-2026-09-05",
    cabCarLeadingChance: CAB_CAR_LEADING_CHANCE,
  },
] as const satisfies readonly TrainVisualVariant[];

export const NIGHTJET_VISUAL_VARIANTS = [
  {
    id: "nightjet-new-generation",
    assetPath: "models/trains/blender/nightjet/nightjet-new-generation-blender.glb",
    profile: "metric-v1",
    scale: [
      RAILWAY_METRIC_PROFILE.metersToWorld,
      RAILWAY_METRIC_PROFILE.metersToWorld,
      RAILWAY_METRIC_PROFILE.metersToWorld,
    ],
    rotation: [0, 0, 0],
    contactOffsetY: RAILWAY_METRIC_PROFILE.railTopY,
    lengthMeters: 204.675,
    minimumLengthLevel: 5,
    selectionWeight: 1,
    revision: "blender-n2-2026-08-21",
    cabCarLeadingChance: CAB_CAR_LEADING_CHANCE,
  },
] as const satisfies readonly TrainVisualVariant[];

export const DB_REGIONAL_EXPRESS_VISUAL_VARIANTS = [
  {
    id: "db-regional-express-br245-dosto",
    assetPath: "models/trains/blender/db-regional-express/db-regional-express-r3.glb",
    profile: "metric-v1",
    scale: [
      RAILWAY_METRIC_PROFILE.metersToWorld,
      RAILWAY_METRIC_PROFILE.metersToWorld,
      RAILWAY_METRIC_PROFILE.metersToWorld,
    ],
    rotation: [0, 0, 0],
    contactOffsetY: RAILWAY_METRIC_PROFILE.railTopY,
    lengthMeters: 99.84,
    minimumLengthLevel: 2,
    selectionWeight: 1,
    revision: "blender-r3-production",
    cabCarLeadingChance: CAB_CAR_LEADING_CHANCE,
    headlights: { frontInsetMeters: 0.50, heightMeters: 1.7, beamLengthMeters: 30, color: "#fff1c4" },
  },
] as const satisfies readonly TrainVisualVariant[];

export const ICE3_VISUAL_VARIANTS = [
  {
    id: "ice3-br403-unified",
    assetPath: "models/trains/blender/ice3/ice3-br403-unified-blender.glb",
    profile: "metric-v1",
    scale: [
      RAILWAY_METRIC_PROFILE.metersToWorld,
      RAILWAY_METRIC_PROFILE.metersToWorld,
      RAILWAY_METRIC_PROFILE.metersToWorld,
    ],
    rotation: [0, 0, 0],
    contactOffsetY: RAILWAY_METRIC_PROFILE.railTopY,
    lengthMeters: 200.32,
    minimumLengthLevel: 4,
    selectionWeight: 1,
    revision: "blender-unified-production-2026-09-02",
    headlights: {
      frontInsetMeters: 0.28,
      heightMeters: 1.675,
      beamLengthMeters: 38,
      color: "#ffe3a3",
    },
  },
] as const satisfies readonly TrainVisualVariant[];

export function legacyTrainVisual(modelKey: string): TrainVisualVariant {
  return {
    id: `${modelKey}-legacy-v1`,
    assetPath: `models/trains/${modelKey}.glb?v=${LEGACY_ASSET_VERSION}`,
    profile: "legacy-v1",
    scale: [1.1, 0.28, 0.28],
    rotation: [0, 0, 0],
    contactOffsetY: 0.279,
    minimumLengthLevel: 1,
    selectionWeight: 1,
    revision: LEGACY_ASSET_VERSION,
    ...(LEGACY_PUSH_PULL_MODEL_KEYS.has(modelKey) ? { cabCarLeadingChance: CAB_CAR_LEADING_CHANCE } : {}),
  };
}

export function trainVisualCabCarLeadingChance(visualVariantId: string): number {
  const promotedVariant = [...RAILJET_VISUAL_VARIANTS, ...NIGHTJET_VISUAL_VARIANTS, ...DB_REGIONAL_EXPRESS_VISUAL_VARIANTS, ...ICE3_VISUAL_VARIANTS, ...METRONOM_VISUAL_VARIANTS]
    .find((variant) => variant.id === visualVariantId);
  if (promotedVariant && "cabCarLeadingChance" in promotedVariant) {
    return promotedVariant.cabCarLeadingChance ?? 0;
  }
  const legacySuffix = "-legacy-v1";
  if (visualVariantId.endsWith(legacySuffix)) {
    const modelKey = visualVariantId.slice(0, -legacySuffix.length);
    return LEGACY_PUSH_PULL_MODEL_KEYS.has(modelKey) ? CAB_CAR_LEADING_CHANCE : 0;
  }
  return 0;
}

export function trainVisualVariants(train: Pick<TrainDefinition, "id" | "modelKey">): readonly TrainVisualVariant[] {
  if (train.id === "railjet") return RAILJET_VISUAL_VARIANTS;
  if (train.id === "nightjet") return NIGHTJET_VISUAL_VARIANTS;
  if (train.id === "db-regional-express") return DB_REGIONAL_EXPRESS_VISUAL_VARIANTS;
  if (train.id === "ice3") return ICE3_VISUAL_VARIANTS;
  if (train.id === "metronom") return METRONOM_VISUAL_VARIANTS;
  return [legacyTrainVisual(train.modelKey)];
}

export function eligibleTrainVisualVariants(
  train: Pick<TrainDefinition, "id" | "modelKey">,
  lengthLevel: number,
) {
  const variants = trainVisualVariants(train).filter((variant) => variant.minimumLengthLevel <= lengthLevel);
  return variants.length > 0 ? variants : trainVisualVariants(train).slice(0, 1);
}

export function resolveTrainVisualVariant(
  train: Pick<TrainDefinition, "id" | "modelKey">,
  visualVariantId?: string,
) {
  const variants = trainVisualVariants(train);
  return variants.find((variant) => variant.id === visualVariantId) ?? variants[0];
}

export function selectTrainVisualVariant(
  train: Pick<TrainDefinition, "id" | "modelKey">,
  lengthLevel: number,
  roll: number,
) {
  const variants = eligibleTrainVisualVariants(train, lengthLevel);
  const totalWeight = variants.reduce((sum, variant) => sum + variant.selectionWeight, 0);
  let cursor = Math.min(0.999999999, Math.max(0, roll)) * totalWeight;
  for (const variant of variants) {
    cursor -= variant.selectionWeight;
    if (cursor < 0) return variant;
  }
  return variants[variants.length - 1];
}

export function trainVisualAssetUrl(variant: TrainVisualVariant) {
  return `${import.meta.env.BASE_URL}${variant.assetPath}`;
}
