import { createInitialState } from "./data";
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
  if (activeTrain.visualVariantId === "nightjet-new-generation") {
    const interimDirection = (activeTrain as ActiveTrain & { travelDirection?: 1 | -1 }).travelDirection;
    const formationOrientation = activeTrain.formationOrientation === -1 || interimDirection === -1 ? -1 : 1;
    const normalized = { ...activeTrain } as ActiveTrain & { travelDirection?: 1 | -1 };
    delete normalized.travelDirection;
    return { ...normalized, formationOrientation };
  }
  if (activeTrain.trainId === "railjet" && !activeTrain.visualVariantId) {
    return { ...activeTrain, visualVariantId: "railjet-classic" };
  }
  return activeTrain;
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
  const defaults = createInitialState(parsed.prestige ?? 0);
  const legacy = parsed as GameState & { activeTrain?: ActiveTrain | null; spawnCountdown?: number };
  const serializableParsed = Object.fromEntries(
    Object.entries(parsed).filter(([key]) => key !== "activeTrain" && key !== "spawnCountdown"),
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
    toast: "Save imported — welcome back.",
    lastUpgrade: null,
  };
}
