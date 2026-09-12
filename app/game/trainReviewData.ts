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
  supportsCabCarLeading?: boolean;
  locomotiveLabel?: string;
  headlights?: {
    frontInsetMeters: number;
    heightMeters: number;
    lateralMeters: number;
    beamLengthMeters: number;
    color: string;
  };
}

export const TRAIN_REVIEW_CANDIDATES = {
  "db-regional-express-r3": {
    id: "db-regional-express-r3", badge: "RE R3", label: "DB Regional-Express · rounded Dosto rebuild",
    shortLabel: "Regional-Express R3", assetPath: "/models/trains/blender/db-regional-express/db-regional-express-r3.glb",
    assetRevision: "rounded-r3", vehicleCount: 4, nominalLengthMeters: 99.84, reviewPlatformLengthMeters: 130,
    traction: "diesel", revision: "rounded-r3", primarySource: "https://www.tillig.com/Produkte/Doppelstockwagen.html",
    productionTrainId: "db-regional-express", approvalStatus: "approved-production", reviewStage: "formation",
    reviewSummary: "Now in the game: rounded roof shoulders, body-following upper windows, white double doors and a newly shaped driving trailer. The approved BR 245 is retained. Same formation as the normal Tier 2 service, with 75% locomotive-leading and 25% cab-car-leading arrivals.",
    supportsCabCarLeading: true, locomotiveLabel: "BR 245 locomotive",
    comparisonCandidateId: "db-regional-express", comparisonLabel: "Previous Regional-Express",
    headlights: { frontInsetMeters: .50, heightMeters: 1.7, lateralMeters: .64, beamLengthMeters: 30, color: "#fff1c4" },
  },
  "metronom-br146-flat": {
    id: "metronom-br146-flat", badge: "ME M2", label: "metronom · straight-band livery",
    shortLabel: "metronom flat livery", assetPath: "/models/trains/blender/metronom/metronom-flat.glb",
    assetRevision: "flat-livery-m2", vehicleCount: 4, nominalLengthMeters: 100.2, reviewPlatformLengthMeters: 130,
    traction: "electric", revision: "flat-livery-m2", primarySource: "https://www.der-metronom.de/unternehmen/ueber-uns/",
    productionTrainId: "metronom", approvalStatus: "approved-production", reviewStage: "formation",
    reviewSummary: "Straight horizontal yellow lower half, white upper sides and blue trim. Equal 50% livery chance alongside the curved version; leading-end choice remains separate.",
    supportsCabCarLeading: true, locomotiveLabel: "BR 146 locomotive",
    comparisonCandidateId: "metronom-br146", comparisonLabel: "Curved livery",
    headlights: { frontInsetMeters: .50, heightMeters: 1.55, lateralMeters: .64, beamLengthMeters: 30, color: "#fff1c4" },
  },
  "metronom-br146": {
    id: "metronom-br146",
    badge: "ME M1",
    label: "metronom · TRAXX 146.2 curved-livery set",
    shortLabel: "metronom 146.2",
    assetPath: "/models/trains/blender/metronom/metronom-curved.glb",
    assetRevision: "curved-livery-m1",
    vehicleCount: 4,
    nominalLengthMeters: 100.2,
    reviewPlatformLengthMeters: 130,
    traction: "electric",
    revision: "curved-livery-m1",
    primarySource: "https://www.der-metronom.de/unternehmen/ueber-uns/",
    productionTrainId: "metronom",
    approvalStatus: "approved-production",
    reviewStage: "formation",
    reviewSummary: "Four-vehicle curved-livery set. Equal 50% livery chance alongside the straight-band version; 75% locomotive-leading and 25% cab-car-leading independently.",
    comparisonCandidateId: "metronom-br146-flat",
    comparisonLabel: "Straight-band livery",
    supportsCabCarLeading: true,
    locomotiveLabel: "BR 146 locomotive",
    headlights: { frontInsetMeters: 0.50, heightMeters: 1.55, lateralMeters: 0.64, beamLengthMeters: 30, color: "#fff1c4" },
  },
  "railjet-classic-livery-v2": {
    id: "railjet-classic-livery-v2",
    badge: "RJ C2",
    label: "ÖBB Railjet classic · reference livery V2",
    shortLabel: "Classic Railjet livery V2",
    assetPath: "/models/trains/blender/railjet/railjet-classic-blender.glb",
    assetRevision: "production-livery-v2-1",
    vehicleCount: 8,
    nominalLengthMeters: 205.375,
    reviewPlatformLengthMeters: 280,
    traction: "electric",
    revision: "livery-review-2.1",
    primarySource: "https://www.oebb.at/de/reiseplanung-services/im-zug/unsere-zuege/railjet",
    productionTrainId: "railjet",
    approvalStatus: "approved-production",
    reviewStage: "formation",
    reviewSummary: "Approved production classic Railjet V2.1. The corrected wine-red, bright-red, graphite and aluminium formation shown here is the same metric asset used by normal gameplay.",
    comparisonCandidateId: "db-regional-express-r3",
    comparisonLabel: "View Regional-Express R3",
    supportsCabCarLeading: true,
    locomotiveLabel: "Taurus",
  },
  "railjet-nextgen-livery-v2": {
    id: "railjet-nextgen-livery-v2",
    badge: "RJ N2",
    label: "ÖBB Railjet new generation · reference livery V2",
    shortLabel: "New Railjet livery V2",
    assetPath: "/models/trains/blender/railjet/railjet-nextgen-blender.glb",
    assetRevision: "production-livery-v2-4",
    vehicleCount: 10,
    nominalLengthMeters: 258,
    reviewPlatformLengthMeters: 280,
    traction: "electric",
    revision: "livery-review-2.3",
    primarySource: "https://press.siemens.com/global/en/pressrelease/obb-puts-first-new-generation-railjet-siemens-mobility-service-and-orders-19-more",
    productionTrainId: "railjet",
    approvalStatus: "approved-production",
    reviewStage: "formation",
    reviewSummary: "Approved production new-generation Railjet. The Viaggio Next Level formation and refined Taurus livery shown here are the same metric asset used by normal gameplay.",
    supportsCabCarLeading: true,
    locomotiveLabel: "Taurus",
  },
  "db-regional-express": {
    id: "db-regional-express",
    badge: "R1",
    label: "DB Regional-Express · previous R2 baseline",
    shortLabel: "BR 245 Dosto",
    assetPath: "/models/trains/blender/db-regional-express/db-regional-express-blender.glb",
    assetRevision: "production-r2",
    vehicleCount: 4,
    nominalLengthMeters: 99.84,
    reviewPlatformLengthMeters: 130,
    traction: "diesel",
    revision: "blender-review-2",
    primarySource: "https://www.alstom.com/solutions/rolling-stock/locomotives/traxx-passenger-locomotives-comfortable-borderless-operations-passengers",
    productionTrainId: "db-regional-express",
    approvalStatus: "approved-production",
    reviewStage: "formation",
    reviewSummary: "Previous approved R2 formation, retained only for comparison. Normal gameplay now uses the rounded R3 rebuild.",
    comparisonCandidateId: "railjet-classic-livery-v2",
    comparisonLabel: "View classic Railjet",
    supportsCabCarLeading: true,
    locomotiveLabel: "BR 245",
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
    supportsCabCarLeading: true,
    locomotiveLabel: "Taurus",
  },
  // Retained as unlinked regeneration baselines only. app/page.tsx deliberately
  // exposes no route to these superseded ICE 3 reviews.
  "ice3-br403": {
    id: "ice3-br403",
    badge: "I3",
    label: "DB ICE 3 · superseded baseline",
    shortLabel: "ICE 3 legacy baseline",
    assetPath: "/models/train-lab/ice3-br403/ice3-br403-blender.glb",
    assetRevision: "1",
    vehicleCount: 8,
    nominalLengthMeters: 200.32,
    reviewPlatformLengthMeters: 220,
    traction: "electric",
    revision: "superseded-1",
    primarySource: "https://www.deutschebahn.com/de/ICE-3-7033052",
    productionTrainId: "ice3",
    approvalStatus: "private-review",
    reviewStage: "formation",
    reviewSummary: "Superseded internal regeneration baseline; no longer linked from the game or review laboratory.",
  },
  "ice3-br403-v2": {
    id: "ice3-br403-v2",
    badge: "I3 V2",
    label: "DB ICE 3 · superseded V2 baseline",
    shortLabel: "ICE 3 V2 baseline",
    assetPath: "/models/train-lab/ice3-br403-v2/ice3-br403-v2-blender.glb",
    assetRevision: "formation-1",
    vehicleCount: 8,
    nominalLengthMeters: 200.32,
    reviewPlatformLengthMeters: 220,
    traction: "electric",
    revision: "superseded-formation-1",
    primarySource: "https://www.deutschebahn.com/de/ICE-3-7033052",
    productionTrainId: "ice3",
    approvalStatus: "private-review",
    reviewStage: "formation",
    reviewSummary: "Superseded internal regeneration baseline; no longer linked from the game or review laboratory.",
  },
  "ice3-br403-v2-continuity": {
    id: "ice3-br403-v2-continuity",
    badge: "I3 C",
    label: "DB ICE 3 · superseded continuity baseline",
    shortLabel: "ICE 3 continuity baseline",
    assetPath: "/models/train-lab/ice3-br403-v2-continuity/ice3-br403-v2-continuity-checkpoint.glb",
    assetRevision: "continuity-4",
    vehicleCount: 2,
    nominalLengthMeters: 50.61,
    reviewPlatformLengthMeters: 90,
    traction: "electric",
    revision: "superseded-continuity-4",
    primarySource: "https://www.deutschebahn.com/de/ICE-3-7033052",
    productionTrainId: "ice3",
    approvalStatus: "private-review",
    reviewStage: "continuity",
    reviewSummary: "Superseded internal regeneration baseline; no longer linked from the game or review laboratory.",
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
