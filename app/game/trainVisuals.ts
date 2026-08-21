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
}

const LEGACY_ASSET_VERSION = "5";

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
    revision: "blender-2026-08-16",
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
    revision: "blender-2026-08-16",
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
  };
}

export function trainVisualVariants(train: Pick<TrainDefinition, "id" | "modelKey">): readonly TrainVisualVariant[] {
  if (train.id === "railjet") return RAILJET_VISUAL_VARIANTS;
  if (train.id === "nightjet") return NIGHTJET_VISUAL_VARIANTS;
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
    if (cursor <= 0) return variant;
  }
  return variants[variants.length - 1];
}

export function trainVisualAssetUrl(variant: TrainVisualVariant) {
  return `${import.meta.env.BASE_URL}${variant.assetPath}`;
}
