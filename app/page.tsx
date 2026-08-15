import CornerRails from "./CornerRails";
import RailjetLab, { type RailjetLabInitialState } from "./game/RailjetLab";

function queryValue<T extends string>(value: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && allowed.includes(candidate as T) ? candidate as T : fallback;
}

function numericQueryValue(value: string | string[] | undefined, fallback: number) {
  const candidate = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(candidate) ? Math.max(0, Math.min(candidate, 60)) : fallback;
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parameters = await searchParams;
  if (parameters.railjetLab !== "1") return <CornerRails />;
  const initialState: RailjetLabInitialState = {
    generation: queryValue(parameters.generation, ["classic", "nextgen"], "classic"),
    method: queryValue(parameters.method, ["generated-2d", "vector-2d", "hybrid-3d"], "generated-2d"),
    motion: queryValue(parameters.motion, ["stationary", "stopping", "pass"], "stationary"),
    atmosphere: queryValue(parameters.atmosphere, ["day", "night", "rain"], "day"),
    scale: queryValue(parameters.scale, ["normal", "inspect"], "normal"),
    loadCount: queryValue(parameters.load, ["1", "3"], "1") === "3" ? 3 : 1,
    captureMode: queryValue(parameters.capture, ["0", "1"], "0") === "1",
    capturePhaseSeconds: numericQueryValue(parameters.phase, 0),
    freezeMotion: queryValue(parameters.freeze, ["0", "1"], "0") === "1",
  };
  const labStateKey = [initialState.generation, initialState.method, initialState.motion, initialState.atmosphere, initialState.scale, initialState.loadCount, Number(initialState.captureMode), initialState.capturePhaseSeconds, Number(initialState.freezeMotion)].join(":");
  return <RailjetLab key={labStateKey} initialState={initialState} />;
}
