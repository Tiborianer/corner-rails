import { createInitialState, TRAINS } from "./data";
import { isBadgeId } from "./badges";
import { trainVisualCabCarLeadingChance } from "./trainVisuals";
import type { ActiveTrain, GameState, PlatformLane } from "./types";

function checksum(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeSave(state: GameState): string {
  const cleanState: GameState = { ...state, toast: null, lastUpgrade: null };
  const payload = toBase64Url(JSON.stringify(cleanState));
  return `CR1.${payload}.${checksum(payload)}`;
}

function isValidState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<GameState>;
  return (
    state.saveVersion === 1 &&
    typeof state.coins === "number" &&
    typeof state.cleanliness === "number" &&
    typeof state.platforms === "number" &&
    typeof state.lengthLevel === "number" &&
    typeof state.tier === "number" &&
    typeof state.systems === "object" &&
    Array.isArray(state.boosts)
  );
}

function normalizeActiveTrain(activeTrain: ActiveTrain | null | undefined): ActiveTrain | null {
  if (!activeTrain) return null;
  const trainId = activeTrain.trainId === "desiro-hc" ? "db-regional-express" : activeTrain.trainId;
  const defaultVisualVariantId = trainId === "railjet"
    ? "railjet-classic"
    : trainId === "nightjet"
      ? "nightjet-new-generation"
      : trainId === "db-regional-express"
        ? "db-regional-express-br245-dosto"
      : trainId === "ice3"
        ? "ice3-br403-unified"
        : trainId === "metronom" ? "metronom-curved"
        : ["ic2", "ice2", "comfortjet"].includes(trainId)
          ? `${trainId}-legacy-v1`
          : undefined;
  const visualVariantId = trainId === "metronom" && activeTrain.visualVariantId === "metronom-legacy-v1"
    ? "metronom-curved" : activeTrain.visualVariantId ?? defaultVisualVariantId;
  const normalized = { ...activeTrain, trainId, ...(visualVariantId ? { visualVariantId } : {}) } as ActiveTrain & { travelDirection?: 1 | -1 };
  const interimDirection = normalized.travelDirection;
  delete normalized.travelDirection;
  if (visualVariantId && trainVisualCabCarLeadingChance(visualVariantId) > 0) {
    const formationOrientation = normalized.formationOrientation === -1 || interimDirection === -1 ? -1 : 1;
    return { ...normalized, formationOrientation };
  }
  return normalized;
}

export function decodeSave(code: string): GameState {
  const [prefix, payload, suppliedChecksum, ...rest] = code.trim().split(".");
  if (prefix !== "CR1" || !payload || !suppliedChecksum || rest.length > 0) {
    throw new Error("This is not a Corner Rails v1 save code.");
  }
  if (checksum(payload) !== suppliedChecksum) {
    throw new Error("The save code is damaged or incomplete.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(payload));
  } catch {
    throw new Error("The save code could not be read.");
  }
  if (!isValidState(parsed)) {
    throw new Error("The save code contains incompatible game data.");
  }
  const legacy = parsed as GameState & {
    activeTrain?: ActiveTrain | null;
    spawnCountdown?: number;
    raining?: boolean;
    rainRemaining?: number;
  };
  const defaults = createInitialState(legacy.prestige ?? 0);
  const knownTrainIds = new Set(TRAINS.map((train) => train.id));
  const servedTrainIds = Array.isArray(legacy.servedTrainIds)
    ? [...new Set(legacy.servedTrainIds
      .filter((trainId): trainId is string => typeof trainId === "string")
      .map((trainId) => trainId === "desiro-hc" ? "db-regional-express" : trainId)
      .filter((trainId) => knownTrainIds.has(trainId)))]
    : [];
  const unlockedBadges = Array.isArray(legacy.unlockedBadges) ? legacy.unlockedBadges.filter(isBadgeId) : [];
  const weather = legacy.weather === "rain" || legacy.weather === "thunderstorm" || legacy.weather === "clear"
    ? legacy.weather
    : legacy.raining ? "rain" : "clear";
  const weatherRemaining = typeof legacy.weatherRemaining === "number"
    ? Math.max(0, legacy.weatherRemaining)
    : legacy.raining ? Math.max(0, legacy.rainRemaining ?? 0) : 0;
  const serializableParsed = Object.fromEntries(
    Object.entries(parsed).filter(([key]) => !["activeTrain", "spawnCountdown", "raining", "rainRemaining"].includes(key)),
  ) as GameState;
  const suppliedLanes = Array.isArray(parsed.platformLanes) ? parsed.platformLanes : [];
  const platformLanes: PlatformLane[] = Array.from({ length: Math.max(1, parsed.platforms) }, (_, platformIndex) => {
    const supplied = suppliedLanes.find((lane) => lane?.platformIndex === platformIndex);
    if (supplied && typeof supplied.spawnCountdown === "number") {
      return {
        platformIndex,
        spawnCountdown: Math.max(0, supplied.spawnCountdown),
        activeTrain: normalizeActiveTrain(supplied.activeTrain),
      };
    }
    if (platformIndex === 0) {
      return {
        platformIndex,
        spawnCountdown: Math.max(0, legacy.spawnCountdown ?? 2),
        activeTrain: normalizeActiveTrain(legacy.activeTrain),
      };
    }
    return { platformIndex, spawnCountdown: 6 + platformIndex * 4, activeTrain: null };
  });
  return {
    ...defaults,
    ...serializableParsed,
    systems: { ...defaults.systems, ...parsed.systems },
    platformLanes,
    servedTrainIds,
    unlockedBadges: [...new Set(unlockedBadges)],
    cleanedFromCritical: legacy.cleanedFromCritical === true,
    stormNightjetServed: legacy.stormNightjetServed === true,
    weather,
    weatherRemaining,
    roadAgeSeconds: parsed.systems.roadAccess && Number.isFinite(legacy.roadAgeSeconds)
      ? Math.max(0, Math.min(legacy.roadAgeSeconds, 86_400)) : 0,
    nextLightningIn: typeof legacy.nextLightningIn === "number" ? Math.max(0, legacy.nextLightningIn) : 0,
    lightningStrikeId: typeof legacy.lightningStrikeId === "number" ? Math.max(0, Math.floor(legacy.lightningStrikeId)) : 0,
    thunderDelaySeconds: typeof legacy.thunderDelaySeconds === "number" ? Math.max(0, legacy.thunderDelaySeconds) : 0,
    toast: "Save imported — welcome back.",
    lastUpgrade: null,
  };
}
