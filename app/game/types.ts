export type RegionId = "germany" | "china" | "france" | "japan";

export type SystemId =
  | "electrification"
  | "signaling"
  | "roadAccess"
  | "maintenance"
  | "amenities"
  | "advancedSignaling";

export type TrainKind = "scheduled" | "event";
export type WeatherKind = "clear" | "rain" | "thunderstorm";
export type BadgeId =
  | "grand-terminus"
  | "storm-watcher"
  | "midnight-arrival"
  | "perfect-score"
  | "rush-hour"
  | "clean-comeback"
  | "millionaire"
  | "master-engineer"
  | "event-curator"
  | "complete-timetable"
  | "storm-sleeper"
  | "triple-prestige";
export type TrainStyle =
  | "dmu"
  | "regional"
  | "double"
  | "intercity"
  | "ice"
  | "international"
  | "night"
  | "steam"
  | "measurement";

export interface TrainRequirements {
  platforms: number;
  lengthLevel: number;
  systems: SystemId[];
  nightOnly?: boolean;
}

export interface TrainDefinition {
  id: string;
  name: string;
  operator: string;
  tier: 1 | 2 | 3 | 4 | 5;
  kind: TrainKind;
  style: TrainStyle;
  cars: number;
  dwell: [number, number];
  payout: [number, number];
  spawnWeight: number;
  requirements: TrainRequirements;
  modelKey: string;
  colors: {
    body: string;
    accent: string;
    roof: string;
    windows: string;
  };
  fact: string;
  source: string;
}

export interface ActiveTrain {
  trainId: string;
  visualVariantId?: string;
  /** Persisted formation facing. +1 keeps the exported order; -1 turns the whole consist 180 degrees. */
  formationOrientation?: 1 | -1;
  phase: "approach" | "dwell" | "depart" | "pass";
  phaseElapsed: number;
  phaseDuration: number;
  payout: number;
  firstService: boolean;
}

export interface PlatformLane {
  platformIndex: number;
  spawnCountdown: number;
  activeTrain: ActiveTrain | null;
}

export interface TemporaryBoost {
  id: string;
  label: string;
  amount: number;
  remaining: number;
}

export interface MissionState {
  id: "serve" | "develop" | "clean";
  progress: number;
  complete: boolean;
}

export interface UpgradeReceipt {
  kind: "platform" | "length" | "system";
  key: string;
  cost: number;
  previous: number | boolean;
  undoAvailable: boolean;
}

export interface GameState {
  saveVersion: 1;
  region: RegionId | null;
  platformPlaced: boolean;
  coins: number;
  lifetimeCoins: number;
  tier: 1 | 2 | 3 | 4 | 5;
  upgradesUsed: number;
  platforms: number;
  lengthLevel: number;
  systems: Record<SystemId, boolean>;
  cleanliness: number;
  speed: 1 | 2 | 3;
  simSeconds: number;
  /** Cosmetic neighborhood growth; advances only while the road exists. */
  roadAgeSeconds: number;
  wallSeconds: number;
  platformLanes: PlatformLane[];
  firstTrainComplete: boolean;
  arrivals: number;
  servedTrainIds: string[];
  unlockedBadges: BadgeId[];
  cleanedFromCritical: boolean;
  stormNightjetServed: boolean;
  prestige: number;
  weather: WeatherKind;
  weatherRemaining: number;
  nextLightningIn: number;
  lightningStrikeId: number;
  thunderDelaySeconds: number;
  seasonIndex: number;
  nextSeasonAt: number;
  eventWindow: "ice-s" | "br01" | null;
  eventRemaining: number;
  eventPassesRemaining: number;
  eventNextPassIn: number;
  boosts: TemporaryBoost[];
  mission: MissionState;
  lastUpgrade: UpgradeReceipt | null;
  rng: number;
  toast: string | null;
}

export type UpgradeAction =
  | { kind: "platform" }
  | { kind: "length" }
  | { kind: "system"; system: SystemId };
