import { RAILWAY_METRIC_PROFILE } from "./metricRailway";

export type TrainReviewMotion = "stationary" | "stopping" | "pass";
export type TrainReviewAtmosphere = "day" | "night" | "rain";
export type TrainReviewScale = "normal" | "inspect";
export type TrainReviewLoad = 1 | 3;
export type TrainReviewLeadingEnd = "taurus" | "cab-car";

export interface TrainReviewCandidate {
  id: string;
  badge: string;
  label: string;
  shortLabel: string;
  assetPath: string;
  assetRevision: string;
  vehicleCount: number;
  nominalLengthMeters: number;
  reviewPlatformLengthMeters: number;
  traction: "diesel" | "electric";
  revision: string;
  primarySource: string;
  productionTrainId: string;
  approvalStatus: "private-review";
  reviewSummary: string;
}

export const TRAIN_REVIEW_CANDIDATES = {
  "db-regional-express": {
    id: "db-regional-express",
    badge: "R1",
    label: "DB Regional-Express · BR 245 + Dosto",
    shortLabel: "BR 245 Dosto",
    assetPath: "/models/train-lab/db-regional-express/db-regional-express-blender.glb",
    assetRevision: "1",
    vehicleCount: 4,
    nominalLengthMeters: 99.84,
    reviewPlatformLengthMeters: 130,
    traction: "diesel",
    revision: "blender-review-1",
    primarySource: "https://www.alstom.com/solutions/rolling-stock/locomotives/traxx-passenger-locomotives-comfortable-borderless-operations-passengers",
    productionTrainId: "unassigned",
    approvalStatus: "private-review",
    reviewSummary: "Built from the supplied BR 245, double-deck coach and driving-trailer references. Approval is required before production changes.",
  },
  "nightjet-new-generation": {
    id: "nightjet-new-generation",
    badge: "N2",
    label: "ÖBB Nightjet · Taurus 1116 + new-generation set",
    shortLabel: "Taurus 1116 Nightjet",
    assetPath: "/models/train-lab/nightjet-new-generation/nightjet-new-generation-blender.glb",
    assetRevision: "2",
    vehicleCount: 8,
    nominalLengthMeters: 204.675,
    reviewPlatformLengthMeters: 280,
    traction: "electric",
    revision: "blender-review-2",
    primarySource: "https://press.siemens.com/global/en/pressrelease/obb-and-siemens-mobility-present-interior-design-next-generation-nightjet",
    productionTrainId: "nightjet",
    approvalStatus: "private-review",
    reviewSummary: "N2 redraws the Taurus red/silver sweep from the supplied references. Try both leading ends; production remains unchanged until approval.",
  },
} as const satisfies Record<string, TrainReviewCandidate>;

export type TrainReviewCandidateId = keyof typeof TRAIN_REVIEW_CANDIDATES;

export const TRAIN_REVIEW_METRIC_SCALE = RAILWAY_METRIC_PROFILE.metersToWorld;

export function trainReviewAssetUrl(candidate: TrainReviewCandidate) {
  return `${candidate.assetPath}?v=${candidate.assetRevision}`;
}

export function trainReviewMotionPosition(mode: TrainReviewMotion, elapsedSeconds: number, direction: 1 | -1 = 1) {
  if (mode === "stationary") return 0;
  if (mode === "pass") {
    const progress = (elapsedSeconds % 12) / 12;
    const eased = progress * progress * (3 - 2 * progress);
    return direction * (-27 + eased * 54);
  }
  const cycle = elapsedSeconds % 18;
  if (cycle < 5) {
    const progress = cycle / 5;
    return direction * (-27 + 27 * (1 - Math.pow(1 - progress, 3)));
  }
  if (cycle < 11) return 0;
  const progress = (cycle - 11) / 7;
  return direction * 27 * progress * progress;
}
