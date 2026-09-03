import { RAILWAY_METRIC_PROFILE } from "./metricRailway";

export type TrainReviewMotion = "stationary" | "stopping" | "pass";
export type TrainReviewAtmosphere = "day" | "night" | "rain";
export type TrainReviewScale = "normal" | "inspect";
export type TrainReviewLoad = 1 | 3;
export type TrainReviewLeadingEnd = "taurus" | "cab-car";
export type TrainReviewStage = "cab" | "continuity" | "formation";

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
  approvalStatus: "private-review" | "approved-production";
  reviewStage: TrainReviewStage;
  reviewSummary: string;
  comparisonCandidateId?: string;
  comparisonLabel?: string;
  headlights?: {
    frontInsetMeters: number;
    heightMeters: number;
    lateralMeters: number;
    beamLengthMeters: number;
    color: string;
  };
}

export const TRAIN_REVIEW_CANDIDATES = {
  "railjet-classic-livery-v2": {
    id: "railjet-classic-livery-v2",
    badge: "RJ C2",
    label: "ÖBB Railjet classic · reference livery V2",
    shortLabel: "Classic Railjet livery V2",
    assetPath: "/models/train-lab/railjet-classic-livery-v2/railjet-classic-livery-v2.glb",
    assetRevision: "livery-v2-1",
    vehicleCount: 8,
    nominalLengthMeters: 205.375,
    reviewPlatformLengthMeters: 280,
    traction: "electric",
    revision: "livery-review-2",
    primarySource: "https://www.oebb.at/de/reiseplanung-services/im-zug/unsere-zuege/railjet",
    productionTrainId: "railjet",
    approvalStatus: "private-review",
    reviewStage: "formation",
    reviewSummary: "Livery-only review candidate preserves the approved classic geometry and metric calibration while replacing the old white scheme with the real wine-red, graphite, bright-red and aluminium Railjet colour blocking. Production remains unchanged pending approval.",
    comparisonCandidateId: "railjet-nextgen-livery-v2",
    comparisonLabel: "View new-generation livery V2",
  },
  "railjet-nextgen-livery-v2": {
    id: "railjet-nextgen-livery-v2",
    badge: "RJ N2",
    label: "ÖBB Railjet new generation · reference livery V2",
    shortLabel: "New Railjet livery V2",
    assetPath: "/models/train-lab/railjet-nextgen-livery-v2/railjet-nextgen-livery-v2.glb",
    assetRevision: "livery-v2-2",
    vehicleCount: 10,
    nominalLengthMeters: 258,
    reviewPlatformLengthMeters: 280,
    traction: "electric",
    revision: "livery-review-2.1",
    primarySource: "https://press.siemens.com/global/en/pressrelease/obb-puts-first-new-generation-railjet-siemens-mobility-service-and-orders-19-more",
    productionTrainId: "railjet",
    approvalStatus: "private-review",
    reviewStage: "formation",
    reviewSummary: "Livery-only review candidate preserves the approved Viaggio Next Level geometry and applies its distinct wine-red upper body, graphite lower body, bright-red belt and cab sweep, aluminium skirts and pale door surrounds. The passenger doors now continue those body colours instead of appearing as solid black rectangles. Production remains unchanged pending approval.",
    comparisonCandidateId: "railjet-classic-livery-v2",
    comparisonLabel: "View classic livery V2",
  },
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
    reviewStage: "formation",
    reviewSummary: "Built from the supplied BR 245, double-deck coach and driving-trailer references. Approval is required before production changes.",
  },
  "nightjet-new-generation": {
    id: "nightjet-new-generation",
    badge: "N2",
    label: "ÖBB Nightjet · Taurus 1116 + new-generation set",
    shortLabel: "Taurus 1116 Nightjet",
    assetPath: "/models/trains/blender/nightjet/nightjet-new-generation-blender.glb",
    assetRevision: "production-n2",
    vehicleCount: 8,
    nominalLengthMeters: 204.675,
    reviewPlatformLengthMeters: 280,
    traction: "electric",
    revision: "blender-review-2",
    primarySource: "https://press.siemens.com/global/en/pressrelease/obb-and-siemens-mobility-present-interior-design-next-generation-nightjet",
    productionTrainId: "nightjet",
    approvalStatus: "approved-production",
    reviewStage: "formation",
    reviewSummary: "Approved N2 production formation. Normal gameplay uses 75% Taurus-leading and 25% cab-car-leading arrivals.",
  },
  "ice3-br403": {
    id: "ice3-br403",
    badge: "I3",
    label: "DB ICE 3 · Class 403 redesign",
    shortLabel: "ICE 3 BR403",
    assetPath: "/models/train-lab/ice3-br403/ice3-br403-blender.glb",
    assetRevision: "1",
    vehicleCount: 8,
    nominalLengthMeters: 200.32,
    reviewPlatformLengthMeters: 220,
    traction: "electric",
    revision: "blender-review-1",
    primarySource: "https://www.deutschebahn.com/de/ICE-3-7033052",
    productionTrainId: "ice3",
    approvalStatus: "private-review",
    reviewStage: "formation",
    reviewSummary: "Exact eight-car Class 403 order with a distinct 403.3 Bordrestaurant. Approval is required before the existing production ICE 3 changes.",
    comparisonCandidateId: "ice3-br403-v2",
    comparisonLabel: "View V2 formation",
  },
  "ice3-br403-v2": {
    id: "ice3-br403-v2",
    badge: "I3 V2",
    label: "DB ICE 3 · Class 403 V2 full formation",
    shortLabel: "ICE 3 BR403 V2",
    assetPath: "/models/train-lab/ice3-br403-v2/ice3-br403-v2-blender.glb",
    assetRevision: "formation-1",
    vehicleCount: 8,
    nominalLengthMeters: 200.32,
    reviewPlatformLengthMeters: 220,
    traction: "electric",
    revision: "formation-review-1",
    primarySource: "https://www.deutschebahn.com/de/ICE-3-7033052",
    productionTrainId: "ice3",
    approvalStatus: "private-review",
    reviewStage: "formation",
    reviewSummary: "The approved checkpoint-7 cab now anchors the complete eight-car Class 403 set, with matching middle-car bodies and distinct transformer, converter, Bordrestaurant and service-car equipment. Full-formation approval is required before production changes.",
    comparisonCandidateId: "ice3-br403-v2-continuity",
    comparisonLabel: "New continuity checkpoint",
  },
  "ice3-br403-v2-continuity": {
    id: "ice3-br403-v2-continuity",
    badge: "I3 C",
    label: "DB ICE 3 · Class 403 continuity checkpoint",
    shortLabel: "ICE 3 two-car continuity",
    assetPath: "/models/train-lab/ice3-br403-v2-continuity/ice3-br403-v2-continuity-checkpoint.glb",
    assetRevision: "continuity-4",
    vehicleCount: 2,
    nominalLengthMeters: 50.61,
    reviewPlatformLengthMeters: 90,
    traction: "electric",
    revision: "continuity-review-4",
    primarySource: "https://www.deutschebahn.com/de/ICE-3-7033052",
    productionTrainId: "ice3",
    approvalStatus: "private-review",
    reviewStage: "continuity",
    reviewSummary: "The rebuilt 403.0 and 403.1 use one shared body cross-section, continuous black glazing band and a slightly lower exact stripe datum. The rearmost cab pane now approaches the regular passenger-window width, and all five cab panes use the matching passenger-glass colour before tapering into the windscreen. The remaining six vehicles stay deferred until this continuity gate is approved.",
    comparisonCandidateId: "ice3-br403-v2-unified",
    comparisonLabel: "Complete unified formation",
  },
  "ice3-br403-v2-unified": {
    id: "ice3-br403-v2-unified",
    badge: "I3 U",
    label: "DB ICE 3 · Class 403 unified formation",
    shortLabel: "ICE 3 unified BR403",
    assetPath: "/models/trains/blender/ice3/ice3-br403-unified-blender.glb",
    assetRevision: "production-unified-1",
    vehicleCount: 8,
    nominalLengthMeters: 200.32,
    reviewPlatformLengthMeters: 220,
    traction: "electric",
    revision: "unified-production-1",
    primarySource: "https://www.deutschebahn.com/de/ICE-3-7033052",
    productionTrainId: "ice3",
    approvalStatus: "approved-production",
    reviewStage: "formation",
    reviewSummary: "Approved production Class 403. All eight vehicles share the accepted body, black glazing band and lowered red stripe datums; the Bordrestaurant, service, converter and transformer cars retain their distinct window and equipment rhythms. Normal gameplay uses this same metric GLB with emissive lenses and one combined moving headlight beam.",
    comparisonCandidateId: "ice3-br403-v2-continuity",
    comparisonLabel: "Approved two-car checkpoint",
    headlights: {
      frontInsetMeters: 0.28,
      heightMeters: 1.675,
      lateralMeters: 0.27,
      beamLengthMeters: 38,
      color: "#ffe3a3",
    },
  },
} as const satisfies Record<string, TrainReviewCandidate>;

export type TrainReviewCandidateId = keyof typeof TRAIN_REVIEW_CANDIDATES;

export const TRAIN_REVIEW_METRIC_SCALE = RAILWAY_METRIC_PROFILE.metersToWorld;

export function trainReviewAssetUrl(candidate: TrainReviewCandidate) {
  return `${candidate.assetPath}?v=${candidate.assetRevision}`;
}

export function trainReviewMotionPosition(mode: TrainReviewMotion, elapsedSeconds: number) {
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

export function trainReviewFormationRotation(leadingEnd: TrainReviewLeadingEnd) {
  return leadingEnd === "cab-car" ? Math.PI : 0;
}
